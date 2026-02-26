from datetime import datetime
import logging
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query,Request
from pymongo import UpdateOne
from database import db

import pytz
from utils.database import get_apinvoice_collection, get_vendor_collection,get_grn_collection
from apinvoice.routes import generate_ap_id
from grn.models import ItemUpdate
from grn.routes import custom_round
from grn.utils import calculate_item_financials
from fastapi import Depends
from dependencies.auth import validate_token

router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# PATCH endpoint to update GRN item totals and optionally convert to AP Invoice
@router.patch("/items/totals/{grn_id}")
async def patch_item_totals(request:Request,
    grn_id: str,
    discountPrice: float,
    item_updates: List[ItemUpdate],
    convertToAp: bool = Query(False),
    apInvoiceDate: Optional[datetime] = None,
    user = Depends(validate_token)  
):
    tenant_id = request.state.tenant_id

    logger.info(f"Received request for grn_id: {grn_id}, discountPrice: {discountPrice}, convertToAp: {convertToAp}, item_updates: {item_updates}")

    # Validate grn_id
    if not ObjectId.is_valid(grn_id):
        logger.error(f"Invalid GRN ID: {grn_id}")
        raise HTTPException(status_code=400, detail=f"Invalid GRN ID: {grn_id}")

    # Get collections
    grn_collection = get_grn_collection(tenant_id)
    vendor_collection = get_vendor_collection(tenant_id)
    apinvoice_collection = get_apinvoice_collection(tenant_id) if convertToAp else None
    
    # Fetch GRN and check existence
    try:
        grn = grn_collection.find_one({"_id": ObjectId(grn_id)})
        logger.info(f"GRN document: {grn}")
    except Exception as e:
        logger.error(f"Error fetching GRN: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid GRN ID: {str(e)}")
    if not grn:
        logger.error(f"GRN not found for ID: {grn_id}")
        raise HTTPException(status_code=404, detail="GRN not found")
    
    # Check if GRN is already converted to AP Invoice
    already_converted = False
    ap_id = None
    if convertToAp:
        existing_ap = apinvoice_collection.find_one({"grnId": str(grn_id)})
        if existing_ap:
            already_converted = True
            ap_id = existing_ap["_id"]
            if existing_ap["status"] not in ["Pending", "Returned"]:
                logger.error(f"Cannot update AP invoice with status {existing_ap['status']}")
                raise HTTPException(status_code=400, detail=f"AP invoice already exists with status {existing_ap['status']}")
        logger.info(f"AP Invoice status: already_converted={already_converted}, ap_id={ap_id}")

    # Initialize variables
    update_operations = []
    updated_items = []
    total_received_amount = 0
    total_discount = 0
    total_tax = 0
    total_debit_amount = round(grn.get("totalReturnedAmount", 0), 2)
    current_datetime = datetime.now(pytz.timezone("Asia/Kolkata"))

    # Validate apInvoiceDate
    if apInvoiceDate:
        # Ensure apInvoiceDate is not in the future
      # Ensure apInvoiceDate is timezone-aware and in Asia/Kolkata
       if apInvoiceDate.tzinfo is None:
         apInvoiceDate = pytz.timezone("Asia/Kolkata").localize(apInvoiceDate)
       logger.info(f"Using provided apInvoiceDate: {apInvoiceDate}")
    else:
        # Use the GRN's invoiceDate or current date if apInvoiceDate is None
        apInvoiceDate = grn.get("invoiceDate", current_datetime)

    # Create a dictionary for quick item lookup
    item_details_map = {item["itemId"]: item for item in grn.get("itemDetails", [])}
    logger.info(f"Item details map: {item_details_map}")

    # Process item updates
    for item_update in item_updates:
        item_id = item_update.itemId
        logger.info(f"Processing item_id: {item_id}")
        if not item_id:
            logger.error("Item ID is required")
            raise HTTPException(status_code=400, detail="Item ID is required")
        existing_item = item_details_map.get(item_id)
        if not existing_item:
            logger.error(f"Item ID {item_id} not found in GRN")
            raise HTTPException(status_code=404, detail=f"Item ID {item_id} not found in GRN")

        # Use existing values for all fields except the ones being updated
        nos = existing_item.get("nos", 0)
        each_quantity = existing_item.get("eachQuantity", 0)
        received_quantity = existing_item.get("receivedQuantity", 0)
        unit_price = existing_item.get("unitPrice", 0)
        tax_percentage = existing_item.get("purchasetaxName", 0)
        tax_type = existing_item.get("taxType", "cgst_sgst")
        return_history = existing_item.get("returnHistory", [])
        purchasecategory_name = existing_item.get("purchasecategoryName", "")
        purchasesubcategory_name = existing_item.get("purchasesubcategoryName")
        hsn_code = existing_item.get("hsnCode", "")
        quantity = existing_item.get("quantity", 0)
        uom = existing_item.get("uom", "")
        status = existing_item.get("status", "")
        barcode = existing_item.get("barcode", "")
        returned_quantity = existing_item.get("returnedQuantity", 0)
        returned_total_price = existing_item.get("returnedTotalPrice", 0)
        returned_tax_amount = existing_item.get("returnedTaxAmount", 0)
        returned_discount_amount = existing_item.get("returnedDiscountAmount", 0)
        returned_final_price = existing_item.get("returnedFinalPrice", 0)
        returned_sgst = existing_item.get("returnedSgst", 0)
        returned_cgst = existing_item.get("returnedCgst", 0)
        
        # Update only the specified fields
        bef_tax_discount = item_update.befTaxDiscount if item_update.befTaxDiscount is not None else existing_item.get("befTaxDiscount", 0)
        af_tax_discount = item_update.afTaxDiscount if item_update.afTaxDiscount is not None else existing_item.get("afTaxDiscount", 0)
        expiry_date = item_update.expiryDate if item_update.expiryDate is not None else existing_item.get("expiryDate")

        # Validate discounts
        total_price_before_discount = unit_price * received_quantity
        logger.info(f"Validating item {item_id}: unit_price={unit_price}, received_quantity={received_quantity}, total_price_before_discount={total_price_before_discount}")
        if bef_tax_discount < 0 or af_tax_discount < 0:
            logger.error(f"Discounts cannot be negative: befTaxDiscount={bef_tax_discount}, afTaxDiscount={af_tax_discount}")
            raise HTTPException(status_code=400, detail="Discounts cannot be negative")
        if bef_tax_discount > 100:
            logger.error(f"Before-tax discount cannot exceed 100%: befTaxDiscount={bef_tax_discount}")
            raise HTTPException(status_code=400, detail="Before-tax discount cannot exceed 100%")
        if af_tax_discount > 100:
            logger.error(f"After-tax discount cannot exceed 100%: afTaxDiscount={af_tax_discount}")
            raise HTTPException(status_code=400, detail="After-tax discount cannot exceed 100%")

        # Calculate financials
        try:
            financials = calculate_item_financials(
                {
                    "unitPrice": unit_price,
                    "befTaxDiscount": bef_tax_discount,
                    "afTaxDiscount": af_tax_discount,
                    "purchasetaxName": tax_percentage,
                    "taxType": tax_type,
                    "itemId": item_id
                },
                received_quantity
            )
            logger.info(f"Financials for item {item_id}: {financials}")
        except Exception as e:
            logger.error(f"Failed to calculate financials for item {item_id}: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to calculate financials for item {item_id}: {str(e)}")

        # Extract financial fields
        total_price = financials["totalPrice"]
        bef_tax_discount_amount = financials["befTaxDiscountAmount"]
        af_tax_discount_amount = financials["afTaxDiscountAmount"]
        tax_amount = financials["taxAmount"]
        sgst = financials["sgst"]
        cgst = financials["cgst"]
        igst = financials["igst"]
        final_price = financials["finalPrice"]

        # Accumulate totals
        total_received_amount += final_price
        total_discount += bef_tax_discount_amount + af_tax_discount_amount
        total_tax += tax_amount
        username = user.get("username")
        if not username:
         raise HTTPException(status_code=401, detail="Invalid login user")

        user_doc = await db["users"].find_one({"username": username})
        if not user_doc:
         raise HTTPException(status_code=401, detail="User not found")

        verified_person_id = str(user_doc["_id"])

        # Prepare update operation
        update_operations.append(
            UpdateOne(
                {"_id": ObjectId(grn_id), "itemDetails.itemId": item_id},
                {"$set": {
                    f"itemDetails.$.nos": nos,
                    f"itemDetails.$.eachQuantity": each_quantity,
                    f"itemDetails.$.receivedQuantity": received_quantity,
                    f"itemDetails.$.unitPrice": unit_price,
                    f"itemDetails.$.totalPrice": round(total_price, 2),
                    f"itemDetails.$.befTaxDiscount": bef_tax_discount,
                    f"itemDetails.$.afTaxDiscount": af_tax_discount,
                    f"itemDetails.$.befTaxDiscountAmount": round(bef_tax_discount_amount, 2),
                    f"itemDetails.$.afTaxDiscountAmount": round(af_tax_discount_amount, 2),
                    f"itemDetails.$.discountAmount": round(bef_tax_discount_amount + af_tax_discount_amount, 2),
                    f"itemDetails.$.purchasetaxName": tax_percentage,
                    f"itemDetails.$.taxAmount": round(tax_amount, 2),
                    f"itemDetails.$.finalPrice": round(final_price, 2),
                    f"itemDetails.$.sgst": round(sgst, 2),
                    f"itemDetails.$.cgst": round(cgst, 2),
                    f"itemDetails.$.igst": round(igst, 2),
                    f"itemDetails.$.expiryDate": expiry_date,
                    f"itemDetails.$.taxType": tax_type,
                    f"itemDetails.$.returnHistory": return_history,
                    f"itemDetails.$.purchasecategoryName": purchasecategory_name,
                    f"itemDetails.$.purchasesubcategoryName": purchasesubcategory_name,
                    f"itemDetails.$.hsnCode": hsn_code,
                    f"itemDetails.$.quantity": quantity,
                    f"itemDetails.$.uom": uom,
                    f"itemDetails.$.status": status,
                    f"itemDetails.$.barcode": barcode,
                    f"itemDetails.$.returnedQuantity": returned_quantity,
                    f"itemDetails.$.returnedTotalPrice": returned_total_price,
                    f"itemDetails.$.returnedTaxAmount": returned_tax_amount,
                    f"itemDetails.$.returnedDiscountAmount": returned_discount_amount,
                    f"itemDetails.$.returnedFinalPrice": returned_final_price,
                    f"itemDetails.$.returnedSgst": returned_sgst,
                    f"itemDetails.$.returnedCgst": returned_cgst
                }}
            )
        )

        updated_items.append({
            **existing_item,
            "nos": nos,
            "eachQuantity": each_quantity,
            "receivedQuantity": received_quantity,
            "unitPrice": unit_price,
            "totalPrice": round(total_price, 2),
            "befTaxDiscount": bef_tax_discount,
            "afTaxDiscount": af_tax_discount,
            "befTaxDiscountAmount": round(bef_tax_discount_amount, 2),
            "afTaxDiscountAmount": round(af_tax_discount_amount, 2),
            "discountAmount": round(bef_tax_discount_amount + af_tax_discount_amount, 2),
            "purchasetaxName": tax_percentage,
            "taxAmount": round(tax_amount, 2),
            "finalPrice": round(final_price, 2),
            "sgst": round(sgst, 2),
            "cgst": round(cgst, 2),
            "igst": round(igst, 2),
            "expiryDate": expiry_date,
            "taxType": tax_type,
            "returnHistory": return_history,
            "purchasecategoryName": purchasecategory_name,
            "purchasesubcategoryName": purchasesubcategory_name,
            "hsnCode": hsn_code,
            "quantity": quantity,
            "uom": uom,
            "status": status,
            "barcode": barcode,
            "returnedQuantity": returned_quantity,
            "returnedTotalPrice": returned_total_price,
            "returnedTaxAmount": returned_tax_amount,
            "returnedDiscountAmount": returned_discount_amount,
            "returnedFinalPrice": returned_final_price,
            "returnedSgst": returned_sgst,
            "returnedCgst": returned_cgst
        })

    if not update_operations:
        logger.error("No valid items provided for update")
        raise HTTPException(status_code=400, detail="No valid items provided for update")

    # Add totals for non-updated items
    updated_item_ids = {item["itemId"] for item in updated_items}
    for item in grn.get("itemDetails", []):
        if item["itemId"] not in updated_item_ids:
            total_received_amount += item.get("finalPrice", 0)
            total_discount += item.get("discountAmount", 0)
            total_tax += item.get("taxAmount", 0)

    # Apply discountPrice if not already converted
    if grn.get("status") not in ["GrnChecked", "APInvoiceConverted"]:
        total_received_amount -= discountPrice
        total_discount += discountPrice

    # Apply custom rounding
    total_received_amount = custom_round(total_received_amount)
    total_debit_amount = custom_round(total_debit_amount)
    total_discount = custom_round(total_discount)
    total_tax = custom_round(total_tax)

    # Determine GRN status
    grn_status = "APInvoiceConverted" if convertToAp else grn.get("status", "GrnChecked")
    logger.info(f"GRN status: {grn_status}")

    # Update GRN root document
    update_operations.append(
        UpdateOne(
            {"_id": ObjectId(grn_id)},
            {
                "$set": {
                    "itemDetails": updated_items,
                    "totalReceivedAmount": round(total_received_amount, 2),
                    "discountPrice": round(discountPrice, 2),
                    "totalDiscount": round(total_discount, 2),
                    "totalTax": round(total_tax, 2),
                    "totalDebitAmount": round(total_debit_amount, 2),
                    "status": grn_status,
                    "lastUpdatedDate": current_datetime,
                    "grnVerifiedDate": current_datetime,
                    "grnVerifiedPersonId": str(user["_id"])
                }
            }
        )
    )

    # Execute bulk write
    try:
        result = grn_collection.bulk_write(update_operations)
        logger.info(f"Bulk write result: modified_count={result.modified_count}")
        if result.modified_count == 0:
            logger.error("No items were updated")
            raise HTTPException(status_code=404, detail="No items were updated")
    except Exception as e:
        logger.error(f"Failed to update GRN: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update GRN: {str(e)}")

    # Handle AP Invoice conversion
    ap_invoice_result = None
    if convertToAp:
        try:
            ap_invoice_result = update_ap_invoice(tenant_id,
                grn, updated_items, total_received_amount, total_discount, total_tax,
                discountPrice, apInvoiceDate, already_converted, ap_id, total_debit_amount
            )
            if already_converted and apinvoice_collection.find_one({"_id": ObjectId(ap_id), "status": "Returned"}):
                # Update AP invoice status to "Pending" if it was "Returned"
                apinvoice_collection.update_one(
                    {"_id": ObjectId(ap_id), "status": "Returned"},
                    {"$set": {"status": "Pending", "lastUpdatedDate": current_datetime}}
                )
                logger.info(f"Updated AP invoice status to Pending for ap_id: {ap_id}")
            logger.info(f"AP Invoice conversion result: {ap_invoice_result}")
        except Exception as e:
            logger.error(f"Failed to convert to AP Invoice: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to convert to AP Invoice: {str(e)}")
    
    # Update vendor payableAmount
    vendor_name = grn.get("vendorName")
    if vendor_name and convertToAp:
        vendor = vendor_collection.find_one({"vendorName": vendor_name}, {"payableAmount": 1})
        if not vendor:
            logger.error(f"Vendor with name {vendor_name} not found")
            raise HTTPException(status_code=404, detail=f"Vendor with name {vendor_name} not found")

        current_payable_amount = vendor.get("payableAmount", 0) or 0
        amount_to_add = (total_received_amount - discountPrice - total_debit_amount) if discountPrice else (total_received_amount - total_debit_amount)
        new_payable_amount = current_payable_amount + amount_to_add

        try:
            vendor_collection.update_one(
                {"vendorName": vendor_name},
                {
                    "$set": {
                        "payableAmount": round(new_payable_amount, 2),
                        "updatedDate": current_datetime
                    }
                }
            )
            logger.info(f"Updated vendor payableAmount: {new_payable_amount}")
        except Exception as e:
            logger.error(f"Failed to update vendor payable amount: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to update vendor payable amount: {str(e)}")

    return {
        "updatedItems": updated_items,
        "totalReceivedAmount": round(total_received_amount, 2),
        "totalDiscount": round(total_discount, 2),
        "totalTax": round(total_tax, 2),
        "totalDebitAmount": round(total_debit_amount, 2),
        **({"apInvoiceConverted": True, "apInvoiceDetails": ap_invoice_result} if convertToAp else {})
    }

def update_ap_invoice(tenant_id,grn, updated_items, total_received_amount, total_discount, 
                     total_tax, discountPrice, apInvoiceDate, already_converted, ap_id=None, total_debit_amount=0):
    """Update an existing AP Invoice based on a GRN, or create a new one if none exists"""
    apinvoice_collection = get_apinvoice_collection(tenant_id)
    
    # Create a map of updated items for easier lookup
    updated_items_map = {item["itemId"]: item for item in updated_items}
    
    # Format the items for the AP Invoice
    ap_items = []
    for item in grn.get("itemDetails", []):
        item_id = item["itemId"]
        
        # If the item was updated, use the updated values
        if item_id in updated_items_map:
            updated_item = updated_items_map[item_id]
            
            # Get tax type
            tax_type = updated_item.get("taxType", 
                                     "igst" if updated_item.get("igst", 0) > 0 else "cgst_sgst")
                
            received_quantity = updated_item["receivedQuantity"]
            returned_quantity = updated_item.get("returnedQuantity", 0)
            unit_price = updated_item["unitPrice"]
            sgst = updated_item.get("sgst", 0)
            cgst = updated_item.get("cgst", 0)
            igst = updated_item.get("igst", 0)
            befTaxDiscount = updated_item.get("befTaxDiscount", 0)
            afTaxDiscount = updated_item.get("afTaxDiscount", 0)
            befTaxDiscountAmount = updated_item.get("befTaxDiscountAmount", 0)
            afTaxDiscountAmount = updated_item.get("afTaxDiscountAmount", 0)
            discountAmount = updated_item.get("discountAmount", 0)
            taxAmount = updated_item.get("taxAmount", 0)
            purchasetaxName = updated_item.get("purchasetaxName", 0)
            totalPrice = updated_item.get("totalPrice", 0)
            finalPrice = updated_item.get("finalPrice", 0)
            nos = updated_item.get("nos", 0)
            each_quantity = updated_item.get("eachQuantity", 0)
        else:
            # Use values from GRN
            sgst = item.get("sgst", 0)
            cgst = item.get("cgst", 0)
            igst = item.get("igst", 0)
            
            tax_type = "igst" if igst > 0 else "cgst_sgst"
                
            received_quantity = item.get("receivedQuantity", 0)
            returned_quantity = item.get("returnedQuantity", 0)
            unit_price = item.get("unitPrice", 0)
            befTaxDiscount = item.get("befTaxDiscount", 0)
            afTaxDiscount = item.get("afTaxDiscount", 0)
            befTaxDiscountAmount = item.get("befTaxDiscountAmount", 0)
            afTaxDiscountAmount = item.get("afTaxDiscountAmount", 0)
            discountAmount = item.get("discountAmount", 0)
            taxAmount = item.get("taxAmount", 0)
            purchasetaxName = item.get("purchasetaxName", 0)
            totalPrice = item.get("totalPrice", 0)
            finalPrice = item.get("finalPrice", 0)
            nos = item.get("nos", 0)
            each_quantity = item.get("eachQuantity", 0)
            
        # Calculate stock quantity (received minus returned)
        stock_quantity = received_quantity - returned_quantity
        
        # Determine count and eachQuantity based on GRN nos and eachQuantity
        if nos > 0 and each_quantity > 0:
            # If GRN has valid nos and eachQuantity, try to maintain the package structure
            if stock_quantity % each_quantity == 0:
                # Perfect package quantity
                count = stock_quantity // each_quantity
            else:
                # Partial package - create one package with the remaining quantity
                count = 1
                each_quantity = stock_quantity
        else:
            # No package structure specified in GRN, treat as single package
            count = 1
            each_quantity = stock_quantity
        
        # Only add item if we have a positive quantity and price
        if stock_quantity > 0 and unit_price > 0:
            ap_items.append({
                "itemId": item_id,
                "itemName": item.get("itemName", ""),
                "quantity": received_quantity,
                "stockQuantity": stock_quantity,
                "uom": item.get("uom", ""),
                "nos": count,
                "eachQuantity": each_quantity,
                "befTaxDiscount": befTaxDiscount,
                "afTaxDiscount": afTaxDiscount,
                "befTaxDiscountAmount": befTaxDiscountAmount,
                "afTaxDiscountAmount": afTaxDiscountAmount,
                "taxType": tax_type,
                "sgst": sgst,
                "cgst": cgst,
                "igst": igst,
                "discountAmount": discountAmount,
                "taxAmount": taxAmount,
                "purchasetaxName": purchasetaxName,
                "hsnCode": item.get("hsnCode", ""),
                "purchasecategoryName": item.get("purchasecategoryName", ""),
                "purchasesubcategoryName": item.get("purchasesubcategoryName", ""),
                "returnedQuantity": returned_quantity,
                "unitPrice": unit_price,
                "totalPrice": totalPrice,
                "finalPrice": finalPrice,
                "status": "Received",
            })
    
    # Prepare AP Invoice data
    current_datetime = datetime.now(pytz.timezone("Asia/Kolkata"))
    ap_invoice_data = {
        "grnId": str(grn["_id"]),
        "purchaseOrderId": grn.get("purchaseOrderId", ""),
        "poRandomId": grn.get("poRandomID"),
        "grnRandomId": grn.get("randomId", ""),
        "vendorName": grn.get("vendorName", ""),
        "invoiceNo": grn.get("invoiceNo", ""),
        "invoiceDate": grn.get("invoiceDate"),
        "poDate": grn.get("poDate"),
        "grnDate": grn.get("grnDate"),
        "dueDate": None,
        "itemDetails": ap_items,
        "invoiceAmount": round(total_received_amount, 2),
        "discountDetails": round(total_discount, 2),
        "taxDetails": round(total_tax, 2),
        "discountPrice": round(discountPrice, 2),
        "debitAmount": round(total_debit_amount, 2),
        "paymentTerms": grn.get("paymentTerms", ""),
        "paymentStatus": "",
        "comments": grn.get("comments", ""),
        "attachments": grn.get("attachments"),
        'createdDate':current_datetime,
        "lastUpdatedDate": current_datetime,
        "apinvoiceDate": apInvoiceDate,
        "city": grn.get("city", ""),
        "state": grn.get("state", ""),
        "contactpersonEmail": grn.get("contactpersonEmail", ""),
        "country": grn.get("country", ""),
        "address": grn.get("address", ""),
        "postalCode": grn.get("postalCode"),
        "gstNumber": grn.get("gstNumber", ""),
        "shippingAddress": grn.get("shippingAddress", ""),
        "billingAddress": grn.get("billingAddress", ""),
        "hasDebitCreditNotes": grn.get("hasDebitCreditNotes")
    }
    
    # Check for existing AP Invoice
    existing_invoice = apinvoice_collection.find_one({"grnId": str(grn["_id"])})
    
    if existing_invoice:
        # Preserve existing randomId and status, do not increment counter
        ap_invoice_data["randomId"] = existing_invoice.get("randomId")
        ap_invoice_data["status"] = existing_invoice.get("status", "Pending")
        logger.info(f"Updating existing AP invoice with data: {ap_invoice_data}")
        apinvoice_collection.update_one(
            {"_id": existing_invoice["_id"]},
            {"$set": ap_invoice_data}
        )
        return {
            "invoiceId": str(existing_invoice["_id"]),
            "status": "updated",
            "randomId": ap_invoice_data["randomId"]
        }
    else:
        # Create new AP Invoice with new randomId
        ap_invoice_data["randomId"] = generate_ap_id(tenant_id)
        ap_invoice_data["status"] = "Pending"
        logger.info(f"Creating new AP invoice with data: {ap_invoice_data}")
        result = apinvoice_collection.insert_one(ap_invoice_data)
        return {
            "invoiceId": str(result.inserted_id),
            "status": "created",
            "randomId": ap_invoice_data["randomId"]
        }