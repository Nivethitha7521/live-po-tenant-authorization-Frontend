from datetime import datetime, timedelta
import ftplib
import io
import logging
import math
import os
import re
import traceback
import pandas as pd
from typing import Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile,Request
from bson import ObjectId
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from dependencies.auth import validate_token

from purchaseOrder.models import ImportResponse, ImportReturnItem, PurchaseOrderPost, PurchaseOrderState
from utils.database import get_purchaseitem_collection, get_purchaseorder_collection
from purchaseitem.models import PurchaseItem, PurchaseItemPost
from purchaseitem.utils import get_purchaseitem_collection
from middlewares.permission_middleware import check_permission

router = APIRouter()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FrontendItemDetail(BaseModel):
    itemId:Optional[str]=None
    itemName: Optional[str]=None
    receivedQuantity: Optional[int]=None
    poQuantity:Optional[int]=None
    newPrice: Optional[float]=None
    totalPrice: Optional[float]=None
    taxPercentage: Optional[float]=None
    taxAmount: Optional[float] =None
    discountAmount:Optional[float]=None
    finalPrice:Optional[float]=None

class FrontendPOResponse(BaseModel):
    purchaseOrderId: str
    randomId: str
    vendorName:str
    orderDate:datetime
    itemDetails: List[FrontendItemDetail]

# Utility Functions
def get_purchase_item_master(tenant_id:str,item_name: str) -> Optional[PurchaseItem]:
    """Fetch item master data from purchase item collection."""
    try:
        collection = get_purchaseitem_collection(tenant_id)
        cleaned_item_name = item_name.strip()
        logger.info(f"Searching for item: '{cleaned_item_name}'")

        search_queries = [
            {"itemName": {"$regex": f"^{re.escape(cleaned_item_name)}$", "$options": "i"}, "status": {"$ne": "deleted"}},
            {"itemName": {"$regex": f"^{re.escape(cleaned_item_name)}$", "$options": "i"}},
            {"itemName": {"$regex": f"^{re.escape(cleaned_item_name)}$", "$options": "i"}, "status": "active"},
            {"itemName": cleaned_item_name},
            {"itemName": {"$regex": f"^{cleaned_item_name}$", "$options": "i"}}
        ]

        for i, query in enumerate(search_queries):
            logger.info(f"Trying query {i+1}: {query}")
            item_data = collection.find_one(query)
            if item_data:
                logger.info(f"SUCCESS: Found item '{item_data.get('itemName')}' with query {i+1}")
                logger.info(f"Item data fields: {list(item_data.keys())}")
                return PurchaseItem(**item_data)
            else:
                logger.info(f"Query {i+1} returned no results")

        logger.info("Getting sample items to check database structure...")
        sample_items = list(collection.find({}).limit(3))
        for idx, item in enumerate(sample_items):
            logger.info(f"Sample item {idx+1}: itemName='{item.get('itemName')}', status='{item.get('status')}', fields={list(item.keys())}")

        logger.info("Trying search without any status filters...")
        all_items = list(collection.find({"itemName": {"$regex": f".*{cleaned_item_name}.*", "$options": "i"}}).limit(5))
        logger.info(f"Found {len(all_items)} items containing '{cleaned_item_name}':")
        for item in all_items:
            logger.info(f"  - '{item.get('itemName')}' (status: '{item.get('status')}')")

        return None

    except Exception as e:
        logger.error(f"Error fetching purchase item master: {str(e)}")
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
        if file.filename.endswith('.csv'):
            content = file.file.read().decode('utf-8')
            df = pd.read_csv(io.StringIO(content))
        elif file.filename.endswith(('.xlsx', '.xls')):
            content = file.file.read()
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
        for old_col, new_col in column_mapping.items():
            if old_col in df.columns:
                df = df.rename(columns={old_col: new_col})
        return df.to_dict('records')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

def process_import(file_data: List[Dict],tenant_id:str) -> ImportResponse:
    """Process CSV or Excel import data, validating Price, Tax(%), and UOM against master."""
    imported_items = []
    duplicates_merged = []
    errors = []
    warnings = []  # Track tax and UOM variance warnings
    updated_items = []  # Track items with price updates in master
    success_messages = []  # Track successful imports
    item_lookup = {}
    master_items_cache = {}
    items_to_update = []  # Items to update in master (price only)
    common_errors = {"item_not_found": 0}  # Track common errors

    collection = get_purchaseitem_collection(tenant_id)

    for row_index, row in enumerate(file_data, start=1):
        try:
            if not row.get('itemName') or pd.isna(row.get('itemName')):
                errors.append(f"Row {row_index}: Item Name is required")
                continue

            item_name = str(row['itemName']).strip()
            normalized_name = normalize_item_name(item_name)

            if normalized_name not in master_items_cache:
                master_item = get_purchase_item_master(item_name,tenant_id)
                if not master_item:
                    common_errors["item_not_found"] += 1
                    errors.append(f"Row {row_index}: Item '{item_name}' not found in purchase item master")
                    continue
                master_items_cache[normalized_name] = master_item
            else:
                master_item = master_items_cache[normalized_name]

            # Quantity logic
            total_quantity = float(row.get('totalQuantity', 0)) if row.get('totalQuantity') and not pd.isna(row.get('totalQuantity')) else 0
            count = float(row.get('count', 0)) if row.get('count') and not pd.isna(row.get('count')) else 0
            quantity = float(row.get('quantity', 0)) if row.get('quantity') and not pd.isna(row.get('quantity')) else 0

            if total_quantity > 0:
                pending_count = 1
                pending_quantity = total_quantity
            elif count > 0 and quantity > 0:
                pending_count = count
                pending_quantity = quantity
                total_quantity = count * quantity
            else:
                errors.append(f"Row {row_index}: TotalQuantity or (Count and Quantity) must be provided and greater than 0")
                continue

            # Price handling
            try:
                master_price = float(master_item.purchasePrice or 0)
                provided_price = float(row.get('price', master_price)) if row.get('price') and not pd.isna(row.get('price')) else master_price
                existing_price = master_price  # Use master price as existingPrice
                unit_price = provided_price  # Use provided price as newPrice
                price_variance = existing_price - unit_price  # Calculate as existingPrice - newPrice
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
                provided_tax = float(row.get('tax', master_tax)) if row.get('tax') and not pd.isna(row.get('tax')) else master_tax
                tax_percentage = provided_tax  # Use provided tax for PO
                if abs(provided_tax - master_tax) > 0.01:
                    warnings.append(f"Row {row_index}: Tax for item '{item_name}' differs from master ({master_tax}%) to provided ({provided_tax}%). Using provided tax in PO.")
            except (ValueError, TypeError):
                errors.append(f"Row {row_index}: Invalid tax value for item '{item_name}'. Tax must be a valid number.")
                continue

            # UOM handling
            master_uom = master_item.uom or ''
            provided_uom = str(row.get('uom', '')).strip() if row.get('uom') and not pd.isna(row.get('uom')) else master_uom
            uom = master_uom  # Always use master UOM for PO
            if provided_uom and provided_uom.lower() != master_uom.lower() and not pd.isna(provided_uom):
                warnings.append(f"Row {row_index}: UOM for item '{item_name}' differs from master ({master_uom}) to provided ({provided_uom}). Using master UOM in PO.")

            # Other fields
            bef_tax_discount = float(row.get('beforeTaxDiscount', 0)) if row.get('beforeTaxDiscount') and not pd.isna(row.get('beforeTaxDiscount')) else 0
            af_tax_discount = float(row.get('afterTaxDiscount', 0)) if row.get('afterTaxDiscount') and not pd.isna(row.get('afterTaxDiscount')) else 0
            tax_type = str(row.get('taxType', '')).strip() if row.get('taxType') and not pd.isna(row.get('taxType')) else "cgst_sgst"

            if tax_type not in ["cgst_sgst", "igst"]:
                errors.append(f"Row {row_index}: Invalid taxType '{tax_type}', must be 'cgst_sgst' or 'igst'")
                continue

            if normalized_name in item_lookup:
                existing = item_lookup[normalized_name]
                existing["total_quantity"] += total_quantity
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
            else:
                item_lookup[normalized_name] = {
                    "item_name": item_name,
                    "master_item": master_item,
                    "pending_count": pending_count,
                    "pending_quantity": pending_quantity,
                    "total_quantity": total_quantity,
                    "existing_price": existing_price,
                    "unit_price": unit_price,
                    "price_variance": price_variance,
                    "tax_percentage": tax_percentage,
                    "bef_tax_discount": bef_tax_discount,
                    "af_tax_discount": af_tax_discount,
                    "uom": uom,
                    "tax_type": tax_type
                }
                success_messages.append(f"Row {row_index}: Item '{item_name}' imported successfully")

        except Exception as e:
            errors.append(f"Row {row_index}: Error processing item - {str(e)}")
            continue

    if common_errors["item_not_found"] > 0:
        errors.append(f"{common_errors['item_not_found']} item(s) not found in purchase item master")

    if errors:
        return ImportResponse(
            success=False,
            message=f"Import failed due to {len(errors)} errors",
            imported_items=[],
            total_pending_order_amount=0.0,
            totalTax=0.0,
            totalDiscount=0.0,
            duplicates_merged=duplicates_merged,
            errors=errors,
            updated_items=updated_items,
            warnings=warnings,
            success_messages=success_messages
        )

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

            totals = calculate_item_totals(
                total_quantity,
                unit_price,
                bef_tax_discount,
                af_tax_discount,
                tax_percentage,
                tax_type
            )

            new_item = ImportReturnItem(
                itemId=master_item.purchaseitemId,  # FIXED: Added itemId from master_item
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
                **totals
            )

            imported_items.append(new_item)

        except Exception as e:
            errors.append(f"Error processing merged item '{item_name}': {str(e)}")  # FIXED: Used item_name instead of undefined row_index

    if errors:
        return ImportResponse(
            success=False,
            message=f"Import failed due to {len(errors)} errors",
            imported_items=[],
            total_pending_order_amount=0.0,
            totalTax=0.0,
            totalDiscount=0.0,
            duplicates_merged=duplicates_merged,
            errors=errors,
            updated_items=updated_items,
            warnings=warnings,
            success_messages=success_messages
        )

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
            errors.append(f"Error updating master for item '{item_update['itemName']}': {str(e)}")  # FIXED: Removed undefined row_index

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
        message += f", encountered {len(errors)} errors during master update"

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
async def import_items(request:Request,file: UploadFile = File(...)):
    """Import items from CSV or Excel file."""
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV, XLSX, or XLS files are allowed")
    tenant_id = request.state.tenant_id
    try:
        file_data = parse_file_content(file)
        if not file_data:
            raise HTTPException(status_code=400, detail="File is empty or invalid")

        result = process_import(file_data,tenant_id)
        return result

    except Exception as e:
        logger.error(f"Error processing file import: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file import: {str(e)}")

@router.get("/debug-items")
def debug_purchase_items(request:Request,search: Optional[str] = Query(None), user = Depends(validate_token),
   permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))
):
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
        template_info = get_csv_import_template_info()
        headers = template_info["template_headers"]
        
        sample_data = [{
            "Item Name": "Sample",
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
        
        df = pd.DataFrame(sample_data, columns=headers)
        
        # Create a file-like buffer
        buffer = io.StringIO()
        df.to_csv(buffer, index=False)
        buffer.seek(0)
        
        # Create a streaming response
        return StreamingResponse(
            io.BytesIO(buffer.getvalue().encode('utf-8')),
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
            "required_fields": ["Item Name", "TotalQuantity"],
            "optional_fields": ["Count", "Quantity", "UOM", "Price", "Tax(%)", "Before Tax Discount(%)", "After Tax Discount(%)", "Tax Type"],
            "notes": [
                "Item Name must exist in purchase item master",
                "If Count and Quantity are provided, TotalQuantity will be calculated as Count × Quantity",
                "If Price is not provided, default price from master will be used",
                "If Tax(%) is not provided, default tax from master will be used",
                "Tax Type must be 'cgst_sgst' or 'igst' if provided, defaults to 'cgst_sgst'",
                "Duplicate items will be merged by adding quantities together",
                "All percentage fields should be numbers (e.g., 12 for 12%)"
            ]
        }
    }

# purchaseOrder/router.py
@router.get("/getOutgoing/{poId}", response_model=FrontendPOResponse)
async def get_purchase_order_by_id(request:Request,poId: str, user = Depends(validate_token), permissions: dict = Depends(check_permission("yenerp", "purchaseorders_pending", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_purchaseorder_collection(tenant_id)
    """
    Fetch a single purchase order by its purchaseOrderId.
    """
    try:
        # Query the purchase order collection by _id (assuming poId is the MongoDB _id)
        po = collection.find_one({"_id": ObjectId(poId)}, {
            "_id": 1,
            "randomId": 1,
            "vendorName": 1,
            "orderDate": 1,
            "items": 1,
        })

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