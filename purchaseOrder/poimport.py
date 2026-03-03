# purchaseOrder/poimport.py
from datetime import datetime
import io
import logging
import re
import traceback
import pandas as pd
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, Request
from bson import ObjectId
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dependencies.auth import validate_token

from purchaseOrder.models import ImportResponse, ImportReturnItem
from utils.database import get_purchaseitem_collection, get_purchaseorder_collection
from purchaseitem.models import PurchaseItem
from middlewares.permission_middleware import check_permission

router = APIRouter()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FrontendItemDetail(BaseModel):
    itemId: Optional[str] = None
    itemName: Optional[str] = None
    receivedQuantity: Optional[int] = None
    poQuantity: Optional[int] = None
    newPrice: Optional[float] = None
    totalPrice: Optional[float] = None
    taxPercentage: Optional[float] = None
    taxAmount: Optional[float] = None
    discountAmount: Optional[float] = None
    finalPrice: Optional[float] = None
    randomId: Optional[str] = None

class FrontendPOResponse(BaseModel):
    purchaseOrderId: str
    randomId: str
    vendorName: str
    orderDate: datetime
    itemDetails: List[FrontendItemDetail]

# Utility Functions
def get_purchase_item_master(tenant_id: str, item_name: str) -> Optional[PurchaseItem]:
    """Fetch item master data from purchase item collection."""
    try:
        # Validate tenant_id format
        if not tenant_id or len(tenant_id) != 24 or not all(c in '0123456789abcdefABCDEF' for c in tenant_id):
            logger.error(f"Invalid tenant_id format: '{tenant_id}' - must be a 24-character hex string")
            return None
            
        collection = get_purchaseitem_collection(tenant_id)
        cleaned_item_name = item_name.strip()
        logger.info(f"Searching for item: '{cleaned_item_name}' in tenant: {tenant_id}")

        # Try multiple search strategies
        search_queries = [
            {"itemName": {"$regex": f"^{re.escape(cleaned_item_name)}$", "$options": "i"}, "status": {"$ne": "deleted"}},
            {"itemName": {"$regex": f"^{re.escape(cleaned_item_name)}$", "$options": "i"}},
            {"itemName": {"$regex": f"^{re.escape(cleaned_item_name)}$", "$options": "i"}, "status": "active"},
            {"itemName": cleaned_item_name},
            {"itemName": {"$regex": f".*{re.escape(cleaned_item_name)}.*", "$options": "i"}}
        ]

        for i, query in enumerate(search_queries):
            logger.info(f"Trying query {i+1}: {query}")
            item_data = collection.find_one(query)
            if item_data:
                logger.info(f"SUCCESS: Found item '{item_data.get('itemName')}'")
                
                # CRITICAL FIX: Ensure randomId exists
                if 'randomId' not in item_data or not item_data.get('randomId'):
                    new_random_id = str(ObjectId())
                    logger.info(f"randomId missing for item, generating: {new_random_id}")
                    
                    # Update the master record with the new randomId
                    update_result = collection.update_one(
                        {"_id": item_data["_id"]},
                        {"$set": {"randomId": new_random_id}}
                    )
                    
                    if update_result.modified_count > 0:
                        logger.info(f"Successfully updated master with randomId: {new_random_id}")
                        item_data['randomId'] = new_random_id
                    else:
                        logger.error(f"Failed to update master with randomId")
                else:
                    logger.info(f"Item already has randomId: {item_data['randomId']}")
                
                # Convert _id to string for Pydantic model
                if '_id' in item_data:
                    item_data['purchaseitemId'] = str(item_data['_id'])
                
                return PurchaseItem(**item_data)

        logger.info(f"No item found with name: {cleaned_item_name}")
        return None

    except Exception as e:
        logger.error(f"Error fetching purchase item master for item '{item_name}': {str(e)}")
        logger.error(traceback.format_exc())
        return None

def normalize_item_name(name: str) -> str:
    """Normalize item name for comparison."""
    return name.strip().lower()

def calculate_item_totals(
    pending_total_quantity: float,
    unit_price: float,
    bef_tax_discount: float = 0,
    af_tax_discount: float = 0,
    tax_percentage: float = 0,
    tax_type: str = "cgst_sgst"
) -> dict[str, float]:
    """Calculate item totals, skipping tax/discount if 0."""
    total_price_before_discount = pending_total_quantity * unit_price
    pending_bef_tax_discount_amount = total_price_before_discount * (bef_tax_discount / 100) if bef_tax_discount > 0 else 0
    total_price_after_bef_discount = total_price_before_discount - pending_bef_tax_discount_amount

    pending_sgst = pending_cgst = pending_igst = pending_tax_amount = 0
    if tax_percentage > 0:
        if tax_type == "cgst_sgst":
            pending_sgst = total_price_after_bef_discount * (tax_percentage / 2 / 100)
            pending_cgst = total_price_after_bef_discount * (tax_percentage / 2 / 100)
            pending_tax_amount = pending_sgst + pending_cgst
        elif tax_type == "igst":
            pending_igst = total_price_after_bef_discount * (tax_percentage / 100)
            pending_tax_amount = pending_igst

    total_price_after_tax = total_price_after_bef_discount + pending_tax_amount
    pending_af_tax_discount_amount = total_price_after_tax * (af_tax_discount / 100) if af_tax_discount > 0 else 0
    pending_final_price = total_price_after_tax - pending_af_tax_discount_amount

    return {
        "pendingTotalPrice": round(total_price_before_discount, 2),
        "pendingBefTaxDiscountAmount": round(pending_bef_tax_discount_amount, 2),
        "pendingAfTaxDiscountAmount": round(pending_af_tax_discount_amount, 2),
        "pendingTaxAmount": round(pending_tax_amount, 2),
        "pendingSgst": round(pending_sgst, 2),
        "pendingCgst": round(pending_cgst, 2),
        "pendingIgst": round(pending_igst, 2),
        "pendingFinalPrice": round(pending_final_price, 2)
    }

def parse_file_content(file: UploadFile) -> List[Dict]:
    """Parse CSV or Excel file content and return list of dictionaries."""
    try:
        content = file.file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Only CSV, XLSX, or XLS files are allowed")

        df.columns = df.columns.str.strip()
        column_mapping = {
            'Item Name': 'itemName',
            'Count': 'count',
            'Quantity': 'quantity',
            'TotalQuantity': 'totalQuantity',
            'UOM': 'uom',
            'Price': 'price',
            'Tax(%)': 'tax',
            'Before Tax Discount(%)': 'beforeTaxDiscount',
            'After Tax Discount(%)': 'afterTaxDiscount',
            'Tax Type': 'taxType'
        }
        
        # Rename columns if they exist
        for old_col, new_col in column_mapping.items():
            if old_col in df.columns:
                df = df.rename(columns={old_col: new_col})
        
        # Handle NaN values
        df = df.fillna('')
        return df.to_dict('records')
    except Exception as e:
        logger.error(f"Error parsing file: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

def process_import(file_data: List[Dict], tenant_id: str) -> ImportResponse:
    """Process CSV or Excel import data, validating against master and including randomId."""
    
    # Validate tenant_id format
    if not tenant_id or len(tenant_id) != 24 or not all(c in '0123456789abcdefABCDEF' for c in tenant_id):
        return ImportResponse(
            success=False,
            message=f"Invalid tenant ID format",
            imported_items=[],
            total_pending_order_amount=0.0,
            totalTax=0.0,
            totalDiscount=0.0,
            duplicates_merged=[],
            errors=[f"Invalid tenant ID format: '{tenant_id}' - must be a 24-character hex string"],
            updated_items=[],
            warnings=[],
            success_messages=[]
        )
    
    imported_items = []
    duplicates_merged = []
    errors = []
    warnings = []
    updated_items = []
    success_messages = []
    item_lookup = {}
    master_items_cache = {}
    items_to_update = []
    common_errors = {"item_not_found": 0}

    collection = get_purchaseitem_collection(tenant_id)

    for row_index, row in enumerate(file_data, start=1):
        try:
            # Skip empty rows
            if not any(row.values()):
                continue

            if not row.get('itemName') or row.get('itemName') == '':
                errors.append(f"Row {row_index}: Item Name is required")
                continue

            item_name = str(row['itemName']).strip()
            normalized_name = normalize_item_name(item_name)

            # Get master item with caching - FIXED: Pass tenant_id first
            if normalized_name not in master_items_cache:
                master_item = get_purchase_item_master(tenant_id, item_name)
                if not master_item:
                    common_errors["item_not_found"] += 1
                    errors.append(f"Row {row_index}: Item '{item_name}' not found in purchase item master")
                    continue
                master_items_cache[normalized_name] = master_item
            else:
                master_item = master_items_cache[normalized_name]

            # CRITICAL FIX: Get randomId from master item
            master_random_id = getattr(master_item, 'randomId', None)
            
            # Double-check if randomId is None and try to generate/update
            if not master_random_id:
                logger.warning(f"randomId is None for item '{item_name}', generating new one")
                master_random_id = str(ObjectId())
                
                # Update master immediately
                try:
                    update_result = collection.update_one(
                        {"_id": ObjectId(master_item.purchaseitemId)},
                        {"$set": {"randomId": master_random_id}}
                    )
                    if update_result.modified_count > 0:
                        logger.info(f"Updated master with new randomId: {master_random_id}")
                        # Update the master_item object
                        master_item.randomId = master_random_id
                    else:
                        logger.error(f"Failed to update master with randomId")
                except Exception as e:
                    logger.error(f"Error updating master with randomId: {e}")
            
            logger.info(f"Item '{item_name}' has randomId: {master_random_id}")

            # Quantity logic
            total_quantity = 0
            try:
                total_quantity = float(row.get('totalQuantity', 0)) if row.get('totalQuantity') and str(row.get('totalQuantity')).strip() not in ['', 'nan'] else 0
            except (ValueError, TypeError):
                pass

            count = 0
            try:
                count = float(row.get('count', 0)) if row.get('count') and str(row.get('count')).strip() not in ['', 'nan'] else 0
            except (ValueError, TypeError):
                pass

            quantity = 0
            try:
                quantity = float(row.get('quantity', 0)) if row.get('quantity') and str(row.get('quantity')).strip() not in ['', 'nan'] else 0
            except (ValueError, TypeError):
                pass

            if total_quantity > 0:
                pending_count = 1
                pending_quantity = total_quantity
                final_total_quantity = total_quantity
            elif count > 0 and quantity > 0:
                pending_count = count
                pending_quantity = quantity
                final_total_quantity = count * quantity
            else:
                errors.append(f"Row {row_index}: TotalQuantity or (Count and Quantity) must be provided and greater than 0")
                continue

            # Price handling
            try:
                master_price = float(master_item.purchasePrice or 0)
                price_val = row.get('price', '')
                if price_val and str(price_val).strip() not in ['', 'nan']:
                    provided_price = float(price_val)
                else:
                    provided_price = master_price
                
                existing_price = master_price
                unit_price = provided_price
                price_variance = existing_price - unit_price
                
                if abs(price_variance) > 0.01:
                    updated_items.append(f"Row {row_index}: Item '{item_name}' price updated from {master_price} to {unit_price} in master")
                    items_to_update.append({
                        "purchaseitemId": master_item.purchaseitemId,
                        "itemName": item_name,
                        "purchasePrice": unit_price
                    })
            except (ValueError, TypeError):
                errors.append(f"Row {row_index}: Invalid price value for item '{item_name}'. Price must be a valid number.")
                continue

            # Tax handling
            try:
                master_tax = float(master_item.purchasetaxName or 0)
                tax_val = row.get('tax', '')
                if tax_val and str(tax_val).strip() not in ['', 'nan']:
                    provided_tax = float(tax_val)
                else:
                    provided_tax = master_tax
                
                tax_percentage = provided_tax
                if abs(provided_tax - master_tax) > 0.01:
                    warnings.append(f"Row {row_index}: Tax for item '{item_name}' differs from master ({master_tax}%) to provided ({provided_tax}%). Using provided tax in PO.")
            except (ValueError, TypeError):
                errors.append(f"Row {row_index}: Invalid tax value for item '{item_name}'. Tax must be a valid number.")
                continue

            # UOM handling
            master_uom = master_item.uom or ''
            uom_val = row.get('uom', '')
            if uom_val and str(uom_val).strip() not in ['', 'nan']:
                provided_uom = str(uom_val).strip()
            else:
                provided_uom = master_uom
            
            uom = master_uom
            if provided_uom and provided_uom.lower() != master_uom.lower() and master_uom:
                warnings.append(f"Row {row_index}: UOM for item '{item_name}' differs from master ({master_uom}) to provided ({provided_uom}). Using master UOM in PO.")

            # Discount fields
            bef_tax_discount = 0
            try:
                btd_val = row.get('beforeTaxDiscount', 0)
                if btd_val and str(btd_val).strip() not in ['', 'nan']:
                    bef_tax_discount = float(btd_val)
            except (ValueError, TypeError):
                pass

            af_tax_discount = 0
            try:
                atd_val = row.get('afterTaxDiscount', 0)
                if atd_val and str(atd_val).strip() not in ['', 'nan']:
                    af_tax_discount = float(atd_val)
            except (ValueError, TypeError):
                pass

            # Tax type
            tax_type = "cgst_sgst"
            tt_val = row.get('taxType', '')
            if tt_val and str(tt_val).strip() not in ['', 'nan']:
                provided_tax_type = str(tt_val).strip().lower()
                if provided_tax_type in ["cgst_sgst", "igst"]:
                    tax_type = provided_tax_type
                else:
                    errors.append(f"Row {row_index}: Invalid taxType '{provided_tax_type}', must be 'cgst_sgst' or 'igst'")
                    continue

            # Check for duplicates
            if normalized_name in item_lookup:
                existing = item_lookup[normalized_name]
                existing["total_quantity"] += final_total_quantity
                existing["pending_count"] += pending_count
                existing["pending_quantity"] += pending_quantity
                duplicates_merged.append(f"Row {row_index}: Merged duplicate item '{item_name}'")
                existing["existing_price"] = existing_price
                existing["unit_price"] = unit_price
                existing["price_variance"] = price_variance
                existing["tax_percentage"] = tax_percentage
                existing["bef_tax_discount"] = bef_tax_discount
                existing["af_tax_discount"] = af_tax_discount
                existing["uom"] = uom
                existing["tax_type"] = tax_type
                existing["master_random_id"] = master_random_id
            else:
                item_lookup[normalized_name] = {
                    "item_name": item_name,
                    "master_item": master_item,
                    "pending_count": pending_count,
                    "pending_quantity": pending_quantity,
                    "total_quantity": final_total_quantity,
                    "existing_price": existing_price,
                    "unit_price": unit_price,
                    "price_variance": price_variance,
                    "tax_percentage": tax_percentage,
                    "bef_tax_discount": bef_tax_discount,
                    "af_tax_discount": af_tax_discount,
                    "uom": uom,
                    "tax_type": tax_type,
                    "master_random_id": master_random_id
                }
                success_messages.append(f"Row {row_index}: Item '{item_name}' imported successfully with randomId: {master_random_id}")

        except Exception as e:
            errors.append(f"Row {row_index}: Error processing item - {str(e)}")
            logger.error(f"Row {row_index} error: {str(e)}")
            continue

    if common_errors["item_not_found"] > 0:
        errors.append(f"{common_errors['item_not_found']} item(s) not found in purchase item master")

    # Process merged items
    for normalized_name, item_data in item_lookup.items():
        try:
            item_name = item_data["item_name"]
            master_item = item_data["master_item"]
            total_quantity = item_data["total_quantity"]
            pending_count = item_data["pending_count"]
            pending_quantity = item_data["pending_quantity"]
            existing_price = item_data["existing_price"]
            unit_price = item_data["unit_price"]
            price_variance = item_data["price_variance"]
            tax_percentage = item_data["tax_percentage"]
            bef_tax_discount = item_data["bef_tax_discount"]
            af_tax_discount = item_data["af_tax_discount"]
            uom = item_data["uom"]
            tax_type = item_data["tax_type"]
            master_random_id = item_data.get("master_random_id")

            totals = calculate_item_totals(
                total_quantity,
                unit_price,
                bef_tax_discount,
                af_tax_discount,
                tax_percentage,
                tax_type
            )

            # CRITICAL: Log the randomId being set
            logger.info(f"Creating ImportReturnItem for '{item_name}' with randomId: {master_random_id}")

            new_item = ImportReturnItem(
                itemId=master_item.purchaseitemId,
                itemCode=master_item.itemCode,
                itemName=master_item.itemName,
                purchasecategoryName=master_item.purchasecategoryName,
                purchasesubcategoryName=master_item.purchasesubcategoryName,
                uom=uom,
                pendingCount=pending_count,
                pendingQuantity=pending_quantity,
                pendingTotalQuantity=total_quantity,
                existingPrice=existing_price,
                newPrice=unit_price,
                priceVariance=price_variance,
                taxPercentage=tax_percentage,
                taxType=tax_type,
                befTaxDiscount=bef_tax_discount,
                afTaxDiscount=af_tax_discount,
                randomId=master_random_id,  # This must be set
                **totals
            )

            imported_items.append(new_item)

        except Exception as e:
            errors.append(f"Error processing merged item '{item_name}': {str(e)}")
            logger.error(f"Error processing merged item: {str(e)}")

    # Update master items with new prices
    for item_update in items_to_update:
        try:
            collection.update_one(
                {"purchaseitemId": item_update["purchaseitemId"]},
                {
                    "$set": {
                        "purchasePrice": item_update["purchasePrice"],
                        "lastUpdatedDate": datetime.utcnow(),
                        "lastUpdatedTime": datetime.utcnow()
                    }
                }
            )
            logger.info(f"Updated PurchaseItem master for '{item_update['itemName']}': price={item_update['purchasePrice']}")
        except Exception as e:
            logger.error(f"Error updating PurchaseItem master for item '{item_update['itemName']}': {str(e)}")
            errors.append(f"Error updating master for item '{item_update['itemName']}': {str(e)}")

    # Calculate totals
    total_pending_order_amount = sum(item.pendingFinalPrice or 0 for item in imported_items)
    total_tax = sum(item.pendingTaxAmount or 0 for item in imported_items)
    total_discount = sum((item.pendingBefTaxDiscountAmount or 0) + (item.pendingAfTaxDiscountAmount or 0) for item in imported_items)
    
    success = len(imported_items) > 0
    message = f"Successfully imported {len(imported_items)} items"

    if duplicates_merged:
        message += f", merged {len(duplicates_merged)} duplicates"
    if updated_items:
        message += f", updated {len(updated_items)} master item prices"
    if warnings:
        message += f", encountered {len(warnings)} warnings"
    if errors:
        message += f", encountered {len(errors)} errors during import"

    # Log the final imported items with randomIds
    for item in imported_items:
        logger.info(f"Final imported item: {item.itemName} with randomId: {item.randomId}")

    return ImportResponse(
        success=success,
        message=message,
        imported_items=imported_items,
        total_pending_order_amount=round(total_pending_order_amount, 2),
        totalTax=round(total_tax, 2),
        totalDiscount=round(total_discount, 2),
        duplicates_merged=duplicates_merged,
        errors=errors,
        updated_items=updated_items,
        warnings=warnings,
        success_messages=success_messages
    )

@router.post("/import-items-csv", response_model=ImportResponse)
async def import_items(request: Request, file: UploadFile = File(...)):
    """Import items from CSV or Excel file."""
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV, XLSX, or XLS files are allowed")

    tenant_id = request.state.tenant_id
    logger.info(f"Processing import for tenant: {tenant_id}")
    
    # Validate tenant_id format
    if not tenant_id or len(tenant_id) != 24:
        raise HTTPException(status_code=400, detail=f"Invalid tenant ID format: {tenant_id}")

    try:
        file_data = parse_file_content(file)
        if not file_data:
            raise HTTPException(status_code=400, detail="File is empty or invalid")

        result = process_import(file_data, tenant_id)
        return result

    except Exception as e:
        logger.error(f"Error processing file import: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error processing file import: {str(e)}")

@router.get("/debug-items")
def debug_purchase_items(request: Request, search: Optional[str] = Query(None), 
                        user = Depends(validate_token),
                        permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))):
    
    tenant_id = request.state.tenant_id
    collection = get_purchaseitem_collection(tenant_id)
    """Debug endpoint to list purchase items."""
    try:
        if search:
            queries = [
                {"itemName": {"$regex": f"^{re.escape(search)}$", "$options": "i"}},
                {"itemName": {"$regex": f".*{re.escape(search)}.*", "$options": "i"}},
                {"itemName": search},
                {}
            ]
            results = {}
            for i, query in enumerate(queries):
                items = list(collection.find(query).limit(10))
                results[f"query_{i+1}"] = {
                    "query": query,
                    "count": len(items),
                    "items": [
                        {
                            "itemName": item.get("itemName"),
                            "itemCode": item.get("itemCode"),
                            "status": item.get("status"),
                            "purchasePrice": item.get("purchasePrice"),
                            "randomId": item.get("randomId"),
                            "_id": str(item.get("_id"))
                        } for item in items
                    ]
                }
            return results
        else:
            items = list(collection.find({}).limit(20))
            item_list = [
                {
                    "itemName": item.get("itemName"),
                    "itemCode": item.get("itemCode"),
                    "status": item.get("status"),
                    "purchasePrice": item.get("purchasePrice"),
                    "randomId": item.get("randomId"),
                    "all_fields": list(item.keys())
                } for item in items
            ]
            return {"total_found": len(item_list), "items": item_list}

    except Exception as e:
        return {"error": f"Error fetching items: {str(e)}", "traceback": traceback.format_exc()}

@router.get("/download-csv-template")
async def download_csv_template():
    """Download a CSV template for importing items."""
    try:
        headers = [
            "Item Name", "Count", "Quantity", "TotalQuantity", "UOM", "Price",
            "Tax(%)", "Before Tax Discount(%)", "After Tax Discount(%)", "Tax Type"
        ]
        
        sample_data = [{
            "Item Name": "Sample Item",
            "Count": 1,
            "Quantity": 10,
            "TotalQuantity": "",
            "UOM": "Kg",
            "Price": 140,
            "Tax(%)": 12,
            "Before Tax Discount(%)": "",
            "After Tax Discount(%)": "",
            "Tax Type": "cgst_sgst"
        }]
        
        df = pd.DataFrame(sample_data)
        
        # Create a file-like buffer
        buffer = io.BytesIO()
        df.to_csv(buffer, index=False)
        buffer.seek(0)
        
        # Create a streaming response
        return StreamingResponse(
            buffer,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=item_import_template.csv",
                "Content-Type": "text/csv; charset=utf-8"
            }
        )
    
    except Exception as e:
        logger.error(f"Error generating CSV template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating CSV template: {str(e)}")

@router.get("/import-template-info")
def get_csv_import_template_info():
    """Get CSV import template information."""
    return {
        "template_headers": [
            "Item Name", "Count", "Quantity", "TotalQuantity", "UOM", "Price",
            "Tax(%)", "Before Tax Discount(%)", "After Tax Discount(%)", "Tax Type"
        ],
        "instructions": {
            "required_fields": ["Item Name"],
            "optional_fields": ["Count", "Quantity", "TotalQuantity", "UOM", "Price", "Tax(%)", "Before Tax Discount(%)", "After Tax Discount(%)", "Tax Type"],
            "notes": [
                "Item Name must exist in purchase item master",
                "If TotalQuantity is provided, it will be used directly",
                "If Count and Quantity are provided, TotalQuantity will be calculated as Count × Quantity",
                "If Price is not provided, default price from master will be used",
                "If Tax(%) is not provided, default tax from master will be used",
                "Tax Type must be 'cgst_sgst' or 'igst' if provided, defaults to 'cgst_sgst'",
                "Duplicate items will be merged by adding quantities together",
                "Each item will inherit randomId from master for stock tracking"
            ]
        }
    }

@router.get("/getOutgoing/{poId}", response_model=FrontendPOResponse)
async def get_purchase_order_by_id(request: Request, poId: str, 
                                  user = Depends(validate_token),
                                  permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))):
    
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    """
    Fetch a single purchase order by its purchaseOrderId.
    """
    try:
        # Query the purchase order collection by _id
        po = collection.find_one({"_id": ObjectId(poId)})

        if not po:
            raise HTTPException(status_code=404, detail=f"Purchase Order with ID {poId} not found")

        # Process item details
        item_details = []
        for item in po.get("items", []):
            try:
                item_details.append({
                    "itemId": str(item.get("itemId", "N/A")),
                    "itemName": str(item.get("itemName", "N/A")),
                    "receivedQuantity": int(item.get("receivedQuantity", 0)),
                    "poQuantity": float(item.get("poQuantity", 0.0)),
                    "newPrice": float(item.get("newPrice", 0.0)),
                    "totalPrice": float(item.get("totalPrice", 0.0)),
                    "taxPercentage": float(item.get("taxPercentage", 0)),
                    "taxAmount": float(item.get("taxAmount", 0)),
                    "discountAmount": float(item.get("discountAmount", 0.0)),
                    "finalPrice": float(item.get("finalPrice", 0.0)),
                    "randomId": item.get("randomId")  # Include randomId in response
                })
            except Exception as e:
                logger.error(f"Error processing item in PO {poId}: {str(e)}")
                continue

        # Handle orderDate conversion
        order_date = po.get("orderDate")
        if isinstance(order_date, str):
            try:
                order_date = datetime.fromisoformat(order_date)
            except ValueError:
                logger.error(f"Invalid orderDate format in PO {poId}: {order_date}")
                order_date = None

        formatted_po = {
            "purchaseOrderId": str(po["_id"]),
            "randomId": po.get("randomId", ""),
            "vendorName": po.get("vendorName", ""),
            "orderDate": order_date,
            "itemDetails": item_details
        }

        return FrontendPOResponse(**formatted_po)

    except ValueError as ve:
        logger.error(f"Invalid poId format: {poId}, error: {str(ve)}")
        raise HTTPException(status_code=400, detail="Invalid purchase order ID format")
    except Exception as e:
        logger.error(f"Error fetching purchase order {poId}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")