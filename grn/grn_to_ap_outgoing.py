from datetime import datetime
import logging
from typing import List, Optional
from database import db

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Body,Depends,Request
from pymongo import UpdateOne, MongoClient
from pymongo.errors import PyMongoError, DuplicateKeyError
import pytz
from decimal import Decimal, ROUND_HALF_UP  # For precise decimals
from apinvoice.routes import generate_ap_id
from grn.models import ItemUpdate
from grn.routes import custom_round  # Keep if needed, but we'll use Decimal.quantize primarily
from grn.utils import calculate_item_financials
from apinvoice.utils import get_safe_value

from outgoingPayment.routes import generate_outgoing_random_id, get_current_date_and_time
from utils.database import get_outgoingpayment_collection,get_grn_collection,get_apinvoice_collection, get_vendor_collection
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
router = APIRouter()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Helper to safely convert float/str to Decimal
def to_decimal(value, default=Decimal('0.0')):
    if value is None:
        return default
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value)).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    except:
        return default

def validate_and_prepare_grn_updates(grn_id: str, ap_round_off: Decimal, item_updates: List[ItemUpdate], grn_collection):
    """Validate inputs and prepare GRN update operations."""
    # Validate grn_id
    if not ObjectId.is_valid(grn_id):
        logger.error(f"Invalid GRN ID: {grn_id}")
        raise HTTPException(status_code=400, detail=f"Invalid GRN ID: {grn_id}")
    # Validate AP round off value - allow any Decimal between -2 and 2 with exactly two decimal places
    if not (Decimal('-2') <= ap_round_off <= Decimal('2')):
        raise HTTPException(
            status_code=400,
            detail="AP round off must be between -2 and 2"
        )
    # Enforce exactly two decimal places (quantize already does this)
    if ap_round_off != ap_round_off.quantize(Decimal('0.00')):
        raise HTTPException(
            status_code=400,
            detail="AP round off must have exactly two decimal places"
        )
    # Fetch GRN and check existence
    grn = grn_collection.find_one({"_id": ObjectId(grn_id)})
    if not grn:
        logger.error(f"GRN not found for ID: {grn_id}")
        raise HTTPException(status_code=404, detail="GRN not found")
   
    return grn

def process_item_updates(grn_id: str, grn, item_updates, ap_round_off: Decimal):
    """Process item updates and calculate totals."""
    update_operations = []
    updated_items = []
    total_received_amount = Decimal('0.0')
    total_discount = Decimal('0.0')
    total_tax = Decimal('0.0')
    total_debit_amount = to_decimal(grn.get("totalReturnedAmount", 0))
   
    # Item details map
    item_details_map = {item["itemId"]: item for item in grn.get("itemDetails", [])}
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
        
        # FIXED: Use unitPrice instead of grnPrice
        received_quantity = to_decimal(existing_item.get("receivedQuantity", 0))
        unit_price = to_decimal(existing_item.get("unitPrice", 0))  # FIXED: Changed from grnPrice to unitPrice
        tax_percentage = to_decimal(existing_item.get("purchasetaxName", 0))
        tax_type = existing_item.get("taxType", "cgst_sgst")
       
        # Update only the specified fields
        bef_tax_discount = to_decimal(item_update.befTaxDiscount if item_update.befTaxDiscount is not None else existing_item.get("befTaxDiscount", 0))
        af_tax_discount = to_decimal(item_update.afTaxDiscount if item_update.afTaxDiscount is not None else existing_item.get("afTaxDiscount", 0))
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
            financials_float = calculate_item_financials(
                {
                    "unitPrice": float(unit_price),
                    "befTaxDiscount": float(bef_tax_discount),
                    "afTaxDiscount": float(af_tax_discount),
                    "purchasetaxName": float(tax_percentage),
                    "taxType": tax_type,
                    "itemId": item_id
                },
                float(received_quantity)
            )
            # Convert back to Decimal
            financials = {k: to_decimal(v) for k, v in financials_float.items()}
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
        
        # Prepare update operation
        update_operations.append(
            UpdateOne(
                {"_id": ObjectId(grn_id), "itemDetails.itemId": item_id},
                {"$set": {
                    f"itemDetails.$.receivedQuantity": float(received_quantity),
                    f"itemDetails.$.unitPrice": float(unit_price),
                    f"itemDetails.$.totalPrice": float(total_price.quantize(Decimal('0.00'))),
                    f"itemDetails.$.befTaxDiscount": float(bef_tax_discount),
                    f"itemDetails.$.afTaxDiscount": float(af_tax_discount),
                    f"itemDetails.$.befTaxDiscountAmount": float(bef_tax_discount_amount.quantize(Decimal('0.00'))),
                    f"itemDetails.$.afTaxDiscountAmount": float(af_tax_discount_amount.quantize(Decimal('0.00'))),
                    f"itemDetails.$.discountAmount": float((bef_tax_discount_amount + af_tax_discount_amount).quantize(Decimal('0.00'))),
                    f"itemDetails.$.purchasetaxName": float(tax_percentage),
                    f"itemDetails.$.taxAmount": float(tax_amount.quantize(Decimal('0.00'))),
                    f"itemDetails.$.finalPrice": float(final_price.quantize(Decimal('0.00'))),
                    f"itemDetails.$.sgst": float(sgst.quantize(Decimal('0.00'))),
                    f"itemDetails.$.cgst": float(cgst.quantize(Decimal('0.00'))),
                    f"itemDetails.$.igst": float(igst.quantize(Decimal('0.00'))),
                    f"itemDetails.$.expiryDate": expiry_date,
                    f"itemDetails.$.taxType": tax_type,
                }}
            )
        )
        updated_items.append({
            **existing_item,
            "receivedQuantity": float(received_quantity),
            "unitPrice": float(unit_price),
            "totalPrice": float(total_price.quantize(Decimal('0.00'))),
            "befTaxDiscount": float(bef_tax_discount),
            "afTaxDiscount": float(af_tax_discount),
            "befTaxDiscountAmount": float(bef_tax_discount_amount.quantize(Decimal('0.00'))),
            "afTaxDiscountAmount": float(af_tax_discount_amount.quantize(Decimal('0.00'))),
            "discountAmount": float((bef_tax_discount_amount + af_tax_discount_amount).quantize(Decimal('0.00'))),
            "purchasetaxName": float(tax_percentage),
            "taxAmount": float(tax_amount.quantize(Decimal('0.00'))),
            "finalPrice": float(final_price.quantize(Decimal('0.00'))),
            "sgst": float(sgst.quantize(Decimal('0.00'))),
            "cgst": float(cgst.quantize(Decimal('0.00'))),
            "igst": float(igst.quantize(Decimal('0.00'))),
            "expiryDate": expiry_date,
            "taxType": tax_type,
        })
    
    if not update_operations:
        logger.error("No valid items provided for update")
        raise HTTPException(status_code=400, detail="No valid items provided for update")
    
    # Add totals for non-updated items
    updated_item_ids = {item["itemId"] for item in updated_items}
    for item in grn.get("itemDetails", []):
        if item["itemId"] not in updated_item_ids:
            total_received_amount += to_decimal(item.get("finalPrice", 0))
            total_discount += to_decimal(item.get("discountAmount", 0))
            total_tax += to_decimal(item.get("taxAmount", 0))
    
    # Apply rounding
    total_received_amount = total_received_amount.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    total_debit_amount = total_debit_amount.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    total_discount = total_discount.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    total_tax = total_tax.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    
    return update_operations, updated_items, total_received_amount, total_discount, total_tax, total_debit_amount

def check_existing_conversions(grn_id, convertToAp, convertToOutgoing, apinvoice_collection, outgoing_collection):
    """Check for existing AP and Outgoing conversions with proper ID matching."""
    existing_ap = None
    already_converted_ap = False
    ap_id = None
   
    existing_outgoing = None
    already_converted_outgoing = False
    outgoing_id = None
    
    # Always check for existing AP invoice by grnId
    existing_ap = apinvoice_collection.find_one({"grnId": str(grn_id)})
    if existing_ap:
        already_converted_ap = True
        ap_id = existing_ap["_id"]
        logger.info(f"Found existing AP invoice: {ap_id}, randomId: {existing_ap.get('randomId')} for GRN: {grn_id}")
       
        # Check if outgoing exists using the CORRECT AP invoice ID
        existing_outgoing = outgoing_collection.find_one({"invoiceId": str(ap_id)})
        if existing_outgoing:
            already_converted_outgoing = True
            outgoing_id = existing_outgoing["_id"]
            logger.info(f"Found existing Outgoing: {outgoing_id} for AP: {ap_id}")
    
    return (existing_ap, already_converted_ap, ap_id,
            existing_outgoing, already_converted_outgoing, outgoing_id)

def generate_unique_ap_id(tenant_id,apinvoice_collection, max_attempts=10):
    """Generate a unique AP ID with collision detection and retry logic."""
    for attempt in range(max_attempts):
        random_id = generate_ap_id(tenant_id)
       
        # Check if this randomId already exists
        existing_ap = apinvoice_collection.find_one({"randomId": random_id})
       
        if not existing_ap:
            logger.info(f"Generated unique AP ID: {random_id} (attempt {attempt + 1})")
            return random_id
        else:
            logger.warning(f"AP ID collision detected: {random_id}, retrying... (attempt {attempt + 1})")
   
    # If we've exhausted all attempts, raise an error
    logger.error(f"Failed to generate unique AP ID after {max_attempts} attempts")
    raise HTTPException(
        status_code=500,
        detail="Unable to generate unique AP invoice ID. Please try again."
    )

def update_ap_invoice(tenant_id,apinvoice_collection, grn, updated_items, total_received_amount: Decimal, total_discount: Decimal,
                     total_tax: Decimal, apInvoiceDate, already_converted, ap_id=None, total_debit_amount: Decimal = Decimal('0'), set_outgoing_status=False, ap_round_off: Decimal = Decimal('0')):
    """Update or create AP Invoice with AP round off handling."""
   
    current_datetime = datetime.now(pytz.timezone("Asia/Kolkata"))
    
    # FIXED: Use the grnAmount directly from GRN instead of recalculating
    # The grnAmount already includes everything: items, freight, tax, etc.
    grn_amount = to_decimal(grn.get("grnAmount", 0))
    
    # Apply AP round off to the grnAmount to get the final invoice amount
    invoice_amount = (grn_amount + ap_round_off).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    
    # Get freight amounts for informational purposes
    total_freight = to_decimal(grn.get("totalFreightAmount", 0))
    total_freight_tax = to_decimal(grn.get("totalFreightTaxAmount", 0))
    
    # Create AP invoice data with AP round off
    ap_invoice_data = {
        "grnId": str(grn["_id"]),
        "purchaseOrderId": grn.get("purchaseOrderId", ""),
        "poRandomId": grn.get("poRandomID", ""),
        "invoiceType":"goods",
        "grnRandomId": grn.get("randomId", ""),
        "vendorName": grn.get("vendorName", ""),
        "vendorId": grn.get("vendorId", ""),
        "invoiceNo": grn.get("invoiceNo", ""),
        "invoiceDate": grn.get("invoiceDate"),
        "poDate": grn.get("poDate"),
        "grnDate": grn.get("grnDate"),
        "dueDate": None,
        "itemDetails": [],
        "invoiceAmount": float(invoice_amount), # FINAL amount with AP round off applied to grnAmount
        "discountDetails": float(total_discount.quantize(Decimal('0.00'))),
        "taxDetails": float(total_tax.quantize(Decimal('0.00'))),
        "totalFreightAmount": float(total_freight.quantize(Decimal('0.00'))),
        "totalFreightTaxAmount": float(total_freight_tax.quantize(Decimal('0.00'))),
        "apRoundOff": float(ap_round_off.quantize(Decimal('0.00'))), # Store AP round off separately
        "debitAmount": float(total_debit_amount.quantize(Decimal('0.00'))),
        "paymentTerms": grn.get("paymentTerms", ""),
        "paymentStatus": "",
        "comments": grn.get("comments", ""),
        "attachments": grn.get("attachments"),
        'createdDate': current_datetime,
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
        "hasDebitCreditNotes": grn.get("hasDebitCreditNotes", False)
    }
    
    # Build item details - COMPLETE ITEM DETAILS FROM GRN
    updated_items_map = {item["itemId"]: item for item in updated_items}
    ap_items = []
   
    for item in grn.get("itemDetails", []):
        item_id = item["itemId"]
        source_item = updated_items_map.get(item_id, item)
       
        received_quantity = to_decimal(source_item.get("receivedQuantity", 0))
        returned_quantity = to_decimal(source_item.get("returnedQuantity", 0))
        # FIXED: Use unitPrice instead of grnPrice
        unit_price = to_decimal(source_item.get("unitPrice", 0))  # Changed from grnPrice to unitPrice
        count = to_decimal(source_item.get("nos", 1))
        each_quantity = to_decimal(source_item.get("eachQuantity", received_quantity / count if count > 0 else received_quantity))
       
        # Calculate adjusted quantities
        adjusted_each_quantity = max(Decimal('0'), each_quantity - (returned_quantity / count)) if count > 0 else Decimal('0')
        stock_quantity = max(Decimal('0'), received_quantity - returned_quantity)
       
        if item_id in updated_items_map:
            updated_item = updated_items_map[item_id]
            # Use updated values
            tax_type = updated_item.get("taxType", "cgst_sgst")
            sgst = to_decimal(updated_item.get("sgst", 0))
            cgst = to_decimal(updated_item.get("cgst", 0))
            igst = to_decimal(updated_item.get("igst", 0))
            befTaxDiscount = to_decimal(updated_item.get("befTaxDiscount", 0))
            afTaxDiscount = to_decimal(updated_item.get("afTaxDiscount", 0))
            befTaxDiscountAmount = to_decimal(updated_item.get("befTaxDiscountAmount", 0))
            afTaxDiscountAmount = to_decimal(updated_item.get("afTaxDiscountAmount", 0))
            discountAmount = to_decimal(updated_item.get("discountAmount", 0))
            taxAmount = to_decimal(updated_item.get("taxAmount", 0))
            purchasetaxName = to_decimal(updated_item.get("purchasetaxName", 0))
            totalPrice = to_decimal(updated_item.get("totalPrice", 0))
            finalPrice = to_decimal(updated_item.get("finalPrice", 0))
        else:
            # Use original values
            tax_type = "igst" if to_decimal(source_item.get("igst", 0)) > 0 else "cgst_sgst"
            sgst = to_decimal(source_item.get("sgst", 0))
            cgst = to_decimal(source_item.get("cgst", 0))
            igst = to_decimal(source_item.get("igst", 0))
            befTaxDiscount = to_decimal(source_item.get("befTaxDiscount", 0))
            afTaxDiscount = to_decimal(source_item.get("afTaxDiscount", 0))
            befTaxDiscountAmount = to_decimal(source_item.get("befTaxDiscountAmount", 0))
            afTaxDiscountAmount = to_decimal(source_item.get("afTaxDiscountAmount", 0))
            discountAmount = to_decimal(source_item.get("discountAmount", 0))
            taxAmount = to_decimal(source_item.get("taxAmount", 0))
            purchasetaxName = to_decimal(source_item.get("purchasetaxName", 0))
            totalPrice = to_decimal(source_item.get("totalPrice", 0))
            finalPrice = to_decimal(source_item.get("finalPrice", 0))
       
        if stock_quantity > 0 and unit_price > 0:
            ap_items.append({
                "itemId": item_id,
                "itemName": source_item.get("itemName", ""),
                "nos": float(count),
                "eachQuantity": float(adjusted_each_quantity.quantize(Decimal('0.00'))),
                "quantity": float(received_quantity),
                "stockQuantity": float(stock_quantity),
                "uom": source_item.get("uom", ""),
                "befTaxDiscount": float(befTaxDiscount),
                "afTaxDiscount": float(afTaxDiscount),
                "befTaxDiscountAmount": float(befTaxDiscountAmount.quantize(Decimal('0.00'))),
                "afTaxDiscountAmount": float(afTaxDiscountAmount.quantize(Decimal('0.00'))),
                "taxType": tax_type,
                "sgst": float(sgst.quantize(Decimal('0.00'))),
                "cgst": float(cgst.quantize(Decimal('0.00'))),
                "igst": float(igst.quantize(Decimal('0.00'))),
                "discountAmount": float(discountAmount.quantize(Decimal('0.00'))),
                "taxAmount": float(taxAmount.quantize(Decimal('0.00'))),
                "purchasetaxName": float(purchasetaxName),
                "hsnCode": source_item.get("hsnCode", ""),
                "purchasecategoryName": source_item.get("purchasecategoryName", ""),
                "purchasesubcategoryName": source_item.get("purchasesubcategoryName", ""),
                "returnedQuantity": float(returned_quantity),
                "unitPrice": float(unit_price),
                "totalPrice": float(totalPrice.quantize(Decimal('0.00'))),
                "finalPrice": float(finalPrice.quantize(Decimal('0.00'))),
                "status": "Received",
                "itemCode": source_item.get("item_rand"),
                "expiryDate": source_item.get("expiryDate"),
            })
   
    ap_invoice_data["itemDetails"] = ap_items
    
    if already_converted and ap_id:
        # UPDATE EXISTING - PRESERVE RANDOM ID
        existing_invoice = apinvoice_collection.find_one({"_id": ap_id})
        if not existing_invoice:
            raise HTTPException(status_code=404, detail="Existing AP invoice not found")
           
        # CRITICAL: Preserve the randomId to maintain consistency
        ap_invoice_data["randomId"] = existing_invoice.get("randomId")
       
        # Smart status handling
        current_status = existing_invoice.get("status")
        if current_status == "Returned":
            new_status = "Outgoing Posted" if set_outgoing_status else "Pending"
        elif current_status in ["Fully Paid", "Partially Paid"]:
            new_status = current_status # Preserve payment status
        else:
            new_status = "Outgoing Posted" if set_outgoing_status else "Pending"
           
        ap_invoice_data["status"] = new_status
       
        logger.info(f"UPDATING AP: {ap_id}, randomId: {ap_invoice_data['randomId']}, status: {current_status}→{new_status}")
       
        try:
            update_result = apinvoice_collection.update_one(
                {"_id": ap_id},
                {"$set": ap_invoice_data}
            )
           
            return {
                "invoiceId": str(ap_id),
                "status": "updated",
                "randomId": ap_invoice_data["randomId"],
                "previousStatus": current_status,
                "newStatus": new_status
            }
        except DuplicateKeyError as e:
            logger.error(f"Duplicate key error while updating AP invoice: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Duplicate AP invoice detected. Please try again."
            )
       
    else:
        # CREATE NEW - GENERATE UNIQUE RANDOM ID
        try:
            ap_invoice_data["randomId"] = generate_unique_ap_id(tenant_id,apinvoice_collection)
            ap_invoice_data["status"] = "Outgoing Posted" if set_outgoing_status else "Pending"
           
            logger.info(f"CREATING NEW AP with randomId: {ap_invoice_data['randomId']}")
           
            result = apinvoice_collection.insert_one(ap_invoice_data)
            new_ap_id = result.inserted_id
           
            return {
                "invoiceId": str(new_ap_id),
                "status": "created",
                "randomId": ap_invoice_data["randomId"],
                "newStatus": ap_invoice_data["status"]
            }
        except DuplicateKeyError as e:
            logger.error(f"Duplicate key error while creating AP invoice: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Duplicate AP invoice detected. Please try again."
            )

def generate_unique_outgoing_id(tenant_id,outgoing_collection, max_attempts=10):
    """Generate a unique Outgoing ID with collision detection and retry logic."""
    for attempt in range(max_attempts):
        random_id = generate_outgoing_random_id(tenant_id)
       
        # Check if this randomId already exists
        existing_outgoing = outgoing_collection.find_one({"randomId": random_id})
       
        if not existing_outgoing:
            logger.info(f"Generated unique Outgoing ID: {random_id} (attempt {attempt + 1})")
            return random_id
        else:
            logger.warning(f"Outgoing ID collision detected: {random_id}, retrying... (attempt {attempt + 1})")
   
    # If we've exhausted all attempts, raise an error
    logger.error(f"Failed to generate unique Outgoing ID after {max_attempts} attempts")
    raise HTTPException(
        status_code=500,
        detail="Unable to generate unique Outgoing payment ID. Please try again."
    )

def create_or_update_outgoing(tenant_id,outgoing_collection, ap_invoice, outgoing_discount: Decimal, outgoing_date, current_datetime,
                             already_outgoing, outgoing_id=None, total_debit_amount: Decimal = Decimal('0'), updated_items=None, ap_round_off: Decimal = Decimal('0')):
    """Create or update Outgoing with AP round off."""
   
    # Use the EXACT AP invoice data
    ap_random_id = ap_invoice.get("randomId", "")
    ap_invoice_id = str(ap_invoice["_id"])
   
    logger.info(f"Processing Outgoing for AP: {ap_invoice_id}, randomId: {ap_random_id}")
    
    # Get financial data from AP invoice
    invoice_amount = to_decimal(get_safe_value(ap_invoice, "invoiceAmount", 0.0))
    discount_details = to_decimal(get_safe_value(ap_invoice, "discountDetails", 0.0))
    tax_details = to_decimal(get_safe_value(ap_invoice, "taxDetails", 0.0))
    ap_round_off_value = to_decimal(get_safe_value(ap_invoice, "apRoundOff", 0.0))
    total_freight = to_decimal(get_safe_value(ap_invoice, "totalFreightAmount", 0.0))
    total_freight_tax = to_decimal(get_safe_value(ap_invoice, "totalFreightTaxAmount", 0.0))
   
    # Calculate payable amounts
    total_payable_amount = invoice_amount
    payable_amount = total_payable_amount
   
    # Calculate total price from all items
    total_price = Decimal('0.0')
    outgoing_item_details = []
   
    # Process each item from AP invoice
    for item in ap_invoice.get("itemDetails", []):
        item_id = item.get("itemId")
        item_name = item.get("itemName", "")
        quantity = to_decimal(item.get("quantity", 0))
        stock_quantity = to_decimal(item.get("stockQuantity", 0))
        unit_price = to_decimal(item.get("unitPrice", 0))
        uom = item.get("uom", "")
        tax_type = item.get("taxType", "cgst_sgst")
        purchasetax_rate = to_decimal(item.get("purchasetaxName", 0))
        total_price_item = to_decimal(item.get("totalPrice", 0))
        final_price_item = to_decimal(item.get("finalPrice", 0))
        tax_amount_item = to_decimal(item.get("taxAmount", 0))
        discount_amount_item = to_decimal(item.get("discountAmount", 0))
        bef_tax_discount = to_decimal(item.get("befTaxDiscount", 0))
        af_tax_discount = to_decimal(item.get("afTaxDiscount", 0))
        bef_tax_discount_amount = to_decimal(item.get("befTaxDiscountAmount", 0))
        af_tax_discount_amount = to_decimal(item.get("afTaxDiscountAmount", 0))
        sgst = to_decimal(item.get("sgst", 0))
        cgst = to_decimal(item.get("cgst", 0))
        igst = to_decimal(item.get("igst", 0))
        hsn_code = item.get("hsnCode", "")
        nos = to_decimal(item.get("nos", 1))
        each_quantity = to_decimal(item.get("eachQuantity", 0))
        returned_quantity = to_decimal(item.get("returnedQuantity", 0))
        item_rand = item.get("item_rand")
        expiry_date = item.get("expiryDate")
        purchasecategory_name = item.get("purchasecategoryName", "")
        purchasesubcategory_name = item.get("purchasesubcategoryName", "")
       
        # Calculate tax rates for display
        sgst_rate = Decimal('0.0')
        cgst_rate = Decimal('0.0')
        igst_rate = Decimal('0.0')
       
        if tax_type == "cgst_sgst":
            sgst_rate = purchasetax_rate / Decimal('2')
            cgst_rate = purchasetax_rate / Decimal('2')
        else: # igst
            igst_rate = purchasetax_rate
       
        # Add to total price
        total_price += total_price_item
       
        # Create complete outgoing item details
        outgoing_item_details.append({
            "itemId": item_id,
            "itemName": item_name,
            "quantity": float(stock_quantity),
            "unitPrice": float(unit_price),
            "purchasetaxName": float(purchasetax_rate),
            "taxType": tax_type,
            "sgst": float(sgst.quantize(Decimal('0.00'))),
            "cgst": float(cgst.quantize(Decimal('0.00'))),
            "igst": float(igst.quantize(Decimal('0.00'))),
            "taxAmount": float(tax_amount_item.quantize(Decimal('0.00'))),
            "totalPrice": float(total_price_item.quantize(Decimal('0.00'))),
            "finalPrice": float(final_price_item.quantize(Decimal('0.00'))),
            "discountAmount": float(discount_amount_item.quantize(Decimal('0.00'))),
            "uom": uom,
            "hsnCode": hsn_code,
            "item_rand": item_rand,
            "nos": float(nos),
            "eachQuantity": float(each_quantity),
            "returnedQuantity": float(returned_quantity),
            "expiryDate": expiry_date,
            "purchasecategoryName": purchasecategory_name,
            "purchasesubcategoryName": purchasesubcategory_name,
            "befTaxDiscount": float(bef_tax_discount),
            "afTaxDiscount": float(af_tax_discount),
            "befTaxDiscountAmount": float(bef_tax_discount_amount.quantize(Decimal('0.00'))),
            "afTaxDiscountAmount": float(af_tax_discount_amount.quantize(Decimal('0.00'))),
            "sgstRate": float(sgst_rate),
            "cgstRate": float(cgst_rate),
            "igstRate": float(igst_rate),
        })
    
    # Prepare outgoing data with AP round off
    outgoing_data = {
        "invoiceId": ap_invoice_id,
        "invoiceNo": ap_invoice.get("invoiceNo"),
        "invoiceDate": ap_invoice.get("invoiceDate"),
        "invoiceType":"goods",
        "apinvoiceDate": ap_invoice.get("apinvoiceDate"),
        "purchaseOrderId": ap_invoice.get("purchaseOrderId"),
        "poRandomId": ap_invoice.get("poRandomId"),
        "grnRandomId": ap_invoice.get("grnRandomId"),
        "apRandomId": ap_random_id,
        "grnId": ap_invoice.get("grnId"),
        "vendorName": ap_invoice.get("vendorName"),
        "vendorId": ap_invoice.get("vendorId"),
        "grnDate": ap_invoice.get("grnDate"),
        "poDate": ap_invoice.get("poDate"),
        "outgoingDate": outgoing_date,
        "taxDetails": float(tax_details.quantize(Decimal('0.00'))),
        "discountDetails": float(discount_details.quantize(Decimal('0.00'))),
        "totalFreightAmount": float(total_freight.quantize(Decimal('0.00'))),
        "totalFreightTaxAmount": float(total_freight_tax.quantize(Decimal('0.00'))),
        "apRoundOff": float(ap_round_off_value.quantize(Decimal('0.00'))),
        "payableAmount": float(payable_amount.quantize(Decimal('0.00'))),
        "totalPayableAmount": float(total_payable_amount.quantize(Decimal('0.00'))),
        "debitAmount": float(total_debit_amount.quantize(Decimal('0.00'))),
        "hasDebitCreditNotes": ap_invoice.get("hasDebitCreditNotes", False),
        "paidAmount": 0,
        "comments": ap_invoice.get("comments"),
        "status": "active",
        "totalPrice": float(total_price.quantize(Decimal('0.00'))),
        "city": ap_invoice.get("city"),
        "state": ap_invoice.get("state"),
        "contactpersonEmail": ap_invoice.get("contactpersonEmail"),
        "country": ap_invoice.get("country"),
        "address": ap_invoice.get("address"),
        "postalCode": ap_invoice.get("postalCode"),
        "gstNumber": ap_invoice.get("gstNumber"),
        "shippingAddress": ap_invoice.get("shippingAddress"),
        "billingAddress": ap_invoice.get("billingAddress"),
        "paymentTerms": ap_invoice.get("paymentTerms"),
        "itemDetails": outgoing_item_details,
        "createdDate": current_datetime,
        "lastUpdatedDate": current_datetime,
    }
    
    if already_outgoing and outgoing_id:
        # UPDATE EXISTING OUTGOING
        existing_outgoing = outgoing_collection.find_one({"_id": outgoing_id})
        if not existing_outgoing:
            raise HTTPException(status_code=404, detail="Existing outgoing payment not found")
           
        outgoing_data["randomId"] = existing_outgoing.get("randomId")
       
        logger.info(f"UPDATING OUTGOING: {outgoing_id} for AP: {ap_invoice_id}")
       
        try:
            outgoing_collection.update_one(
                {"_id": outgoing_id},
                {"$set": outgoing_data}
            )
           
            return {
                "outgoingId": str(outgoing_id),
                "status": "updated",
                "randomId": outgoing_data["randomId"],
                "apInvoiceId": ap_invoice_id,
                "apRandomId": ap_random_id
            }
        except DuplicateKeyError as e:
            logger.error(f"Duplicate key error while updating outgoing payment: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Duplicate outgoing payment detected. Please try again."
            )
    else:
        # CREATE NEW OUTGOING WITH UNIQUE ID
        try:
            outgoing_data["randomId"] = generate_unique_outgoing_id(tenant_id,outgoing_collection)
           
            logger.info(f"CREATING NEW OUTGOING for AP: {ap_invoice_id} with randomId: {outgoing_data['randomId']}")
           
            result = outgoing_collection.insert_one(outgoing_data)
           
            return {
                "outgoingId": str(result.inserted_id),
                "status": "created",
                "randomId": outgoing_data["randomId"],
                "apInvoiceId": ap_invoice_id,
                "apRandomId": ap_random_id
            }
        except DuplicateKeyError as e:
            logger.error(f"Duplicate key error while creating outgoing payment: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Duplicate outgoing payment detected. Please try again."
            )

@router.patch("/convert-to-ap/ap-to-outgoing/{grn_id}")
async def patch_item_totals(request:Request,
    grn_id: str,
    item_updates: List[ItemUpdate] = Body(..., description="Item updates"),
    apRoundOff: str = Query("0.00", description="AP Round Off adjustment (as string for precision, e.g., '0.30')"),
    apInvoiceDate: Optional[datetime] = Query(None, description="AP Invoice Date"),
    outgoingDate: Optional[datetime] = Query(None, description="Outgoing Date"),user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "edit"))
):
    tenant_id = request.state.tenant_id
    convertToAp = True
    convertToOutgoing = True
   
    ap_round_off = to_decimal(apRoundOff)  # Convert to Decimal early
    logger.info(f"=== STARTING CONVERSION FOR GRN: {grn_id} ===")
    logger.info(f"AP Round Off: {ap_round_off}")
    
    # Get collections
    grn_collection = get_grn_collection(tenant_id)
    vendor_collection = get_vendor_collection(tenant_id)
    apinvoice_collection = get_apinvoice_collection(tenant_id)
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
   
    # Validate GRN
    if not ObjectId.is_valid(grn_id):
        raise HTTPException(status_code=400, detail="Invalid GRN ID")
   
    grn = grn_collection.find_one({"_id": ObjectId(grn_id)})
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
   
    # Validate and prepare
    grn = validate_and_prepare_grn_updates(grn_id, ap_round_off, item_updates, grn_collection)
   
    # STEP 1: Check existing conversions
    (existing_ap, already_converted_ap, ap_id,
     existing_outgoing, already_converted_outgoing, outgoing_id) = check_existing_conversions(
        grn_id, convertToAp, convertToOutgoing, apinvoice_collection, outgoing_collection
    )
    logger.info(f"Conversion Check - AP exists: {already_converted_ap}, Outgoing exists: {already_converted_outgoing}")
    
    # STEP 2: Process item updates
    update_operations, updated_items, total_received_amount, total_discount, total_tax, total_debit_amount = process_item_updates(
        grn_id, grn, item_updates, ap_round_off
    )
    
    # Get the GRN amount (already includes everything)
    grn_amount = to_decimal(grn.get("grnAmount", 0))
    
    # Apply AP round off to grnAmount to get final AP invoice amount
    ap_invoice_amount = (grn_amount + ap_round_off).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
    
    current_datetime = datetime.now(pytz.timezone("Asia/Kolkata"))
    apInvoiceDate = apInvoiceDate or current_datetime
    outgoingDate = outgoingDate or current_datetime
    


    username = user.get("username")
    if not username:
     raise HTTPException(status_code=401, detail="Invalid login user")

    user_doc = await db["users"].find_one({"username": username})
    if not user_doc:
     raise HTTPException(status_code=401, detail="User not found in database")

    verified_person_id = str(user_doc["_id"])
    # STEP 3: Update GRN
    grn_root_update = UpdateOne(
        {"_id": ObjectId(grn_id)},
        {"$set": {
            "itemDetails": updated_items,
            "totalReceivedAmount": float(total_received_amount),
            "apRoundOff": float(ap_round_off),
            "totalDiscount": float(total_discount),
            "totalTax": float(total_tax),
            "totalDebitAmount": float(total_debit_amount),
            "status": "APInvoiceConverted",
            "lastUpdatedDate": current_datetime,
            "grnVerifiedDate": current_datetime,
            "grnVerifiedPersonId": verified_person_id
        }}
    )
    update_operations.append(grn_root_update)
    
    # Execute operations
    ap_invoice_result = None
    outgoing_result = None
   
    try:
        # 1. Update GRN
        grn_result = grn_collection.bulk_write(update_operations)
        logger.info(f"GRN updated: {grn_result.modified_count} documents")
        
        # 2. Process AP Invoice with AP round off applied to grnAmount
        ap_invoice_result = update_ap_invoice(tenant_id,
            apinvoice_collection, grn, updated_items, total_received_amount, total_discount,
            total_tax, apInvoiceDate, already_converted_ap, ap_id, total_debit_amount,
            True, # set_outgoing_status
            ap_round_off # Pass AP round off separately
        )
        
        # 3. VERIFY: Get the actual AP invoice that was created/updated
        final_ap_id = ObjectId(ap_invoice_result["invoiceId"])
        final_ap = apinvoice_collection.find_one({"_id": final_ap_id})
       
        if not final_ap:
            raise HTTPException(status_code=404, detail="AP Invoice not found after creation")
           
        logger.info(f"VERIFIED AP - ID: {final_ap_id}, RandomId: {final_ap.get('randomId')}")
        
        # 4. Create/Update Outgoing with VERIFIED AP data
        outgoing_discount = Decimal('0.0')
        outgoing_result = create_or_update_outgoing(tenant_id,
            outgoing_collection, final_ap, outgoing_discount, outgoingDate, current_datetime,
            already_converted_outgoing, outgoing_id, total_debit_amount, updated_items,
            ap_round_off # Pass AP round off to outgoing
        )
        
        # 5. Update vendor payable amount (using AP invoice amount)
        vendor_name = grn.get("vendorName")
        if vendor_name:
            logger.info(f"Updating vendor payable for: {vendor_name}")
            vendor = vendor_collection.find_one({"vendorName": vendor_name}, {"payableAmount": 1})
            if vendor:
                current_payable_amount = to_decimal(vendor.get("payableAmount", 0))
                amount_to_add = ap_invoice_amount - total_debit_amount # Use AP amount
                new_payable_amount = (current_payable_amount + amount_to_add).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
                vendor_collection.update_one(
                    {"vendorName": vendor_name},
                    {
                        "$set": {
                            "payableAmount": float(new_payable_amount),
                            "updatedDate": current_datetime
                        }
                    }
                )
                logger.info(f"Updated vendor payableAmount: {new_payable_amount} (AP amount: {ap_invoice_amount})")
        
        # 6. FINAL VERIFICATION
        final_outgoing = outgoing_collection.find_one({"_id": ObjectId(outgoing_result["outgoingId"])})
        if final_outgoing:
            logger.info(f"FINAL VERIFICATION - Outgoing {outgoing_result['outgoingId']} linked to AP: {final_outgoing.get('invoiceId')}")
        
        logger.info("=== CONVERSION COMPLETED SUCCESSFULLY ===")
    
    except PyMongoError as e:
        logger.error(f"MongoDB error during conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    
    # Response
    response = {
        "message": "GRN successfully converted to AP Invoice and Outgoing Payment",
        "idMapping": {
            "grnId": grn_id,
            "apInvoiceId": ap_invoice_result["invoiceId"],
            "apRandomId": ap_invoice_result["randomId"],
            "outgoingId": outgoing_result["outgoingId"],
            "outgoingRandomId": outgoing_result["randomId"]
        },
        "financialSummary": {
            "grnAmount": f"{grn_amount:.2f}",
            "apRoundOffApplied": f"{ap_round_off:.2f}",
            "apInvoiceAmount": f"{ap_invoice_amount:.2f}",
            "totalDiscount": f"{total_discount:.2f}",
            "totalTax": f"{total_tax:.2f}",
            "totalDebitAmount": f"{total_debit_amount:.2f}",
            "payableAmount": f"{ap_invoice_amount:.2f}" # Payable amount uses AP total
        },
        "apInvoiceDetails": ap_invoice_result,
        "outgoingDetails": outgoing_result
    }
    return response