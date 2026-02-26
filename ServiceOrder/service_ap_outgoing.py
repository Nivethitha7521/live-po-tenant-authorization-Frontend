# Create a new file: service_to_ap/routes.py
from datetime import datetime
import logging
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Body,Request
from pymongo.errors import PyMongoError, DuplicateKeyError, OperationFailure
import pytz
from decimal import Decimal, ROUND_HALF_UP
import traceback

from apinvoice.routes import generate_ap_id

from outgoingPayment.routes import generate_outgoing_random_id
from utils.database import get_apinvoice_collection,get_outgoingpayment_collection,get_vendor_collection,get_serviceworkorder_collection
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends
from ServiceOrder.utils import (
    
    validate_service, 
    to_decimal,  
    calculate_service_totals_with_proportional_discount,
    calculate_single_description_totals
)

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================
# HELPER FUNCTIONS - WITH RETURNED STATUS HANDLING
# ============================================

def check_service_conversion_status(service_id: str, apinvoice_collection, outgoing_collection):
    """
    Check service conversion status including Returned invoices
    Returns: (status, existing_ap_data, existing_outgoing_data)
    status: 'NOT_CONVERTED', 'CONVERTED_ACTIVE', 'CONVERTED_RETURNED', 'CONVERTED_PARTIAL'
    """
    try:
        # Check by serOId (service ObjectId)
        existing_ap = apinvoice_collection.find_one({"serOId": str(service_id)})
        
        if not existing_ap:
            return 'NOT_CONVERTED', None, None
        
        # Check if AP is returned
        ap_status = existing_ap.get("status", "")
        is_returned = ap_status == "Returned"
        
        # Check outgoing status
        existing_outgoing = outgoing_collection.find_one({"serOId": str(service_id)})
        outgoing_status = existing_outgoing.get("status", "") if existing_outgoing else None
        
        if is_returned:
            return 'CONVERTED_RETURNED', existing_ap, existing_outgoing
        elif existing_outgoing and outgoing_status == "active":
            return 'CONVERTED_ACTIVE', existing_ap, existing_outgoing
        else:
            return 'CONVERTED_PARTIAL', existing_ap, existing_outgoing
            
    except Exception as e:
        logger.error(f"Error checking conversion status: {str(e)}")
        return 'ERROR', None, None

def check_outgoing_exists(ap_id: str, outgoing_collection):
    """Check if outgoing payment already exists for AP invoice"""
    try:
        existing_outgoing = outgoing_collection.find_one({"invoiceId": str(ap_id)})
        if existing_outgoing:
            logger.error(f"❌ OUTGOING ALREADY EXISTS for AP: {ap_id}")
            return True, str(existing_outgoing["_id"]), existing_outgoing
        return False, None, None
    except Exception as e:
        logger.error(f"Error checking outgoing: {str(e)}")
        return False, None, None

def generate_unique_ap_id(apinvoice_collection,tenant_id, max_attempts=10):
    """Generate unique AP ID with collision detection"""
    for attempt in range(max_attempts):
        random_id = generate_ap_id(tenant_id)
        existing_ap = apinvoice_collection.find_one({"randomId": random_id})
        
        if not existing_ap:
            logger.info(f"Generated unique AP ID: {random_id}")
            return random_id
        else:
            logger.warning(f"AP ID collision: {random_id}, retrying...")
    
    raise HTTPException(
        status_code=500,
        detail="Unable to generate unique AP invoice ID"
    )

def generate_unique_outgoing_id(outgoing_collection,tenant_id,max_attempts=10):
    """Generate unique Outgoing ID with collision detection"""
    for attempt in range(max_attempts):
        random_id = generate_outgoing_random_id(tenant_id)
        existing_outgoing = outgoing_collection.find_one({"randomId": random_id})
        
        if not existing_outgoing:
            logger.info(f"Generated unique Outgoing ID: {random_id}")
            return random_id
        else:
            logger.warning(f"Outgoing ID collision: {random_id}, retrying...")
    
    raise HTTPException(
        status_code=500,
        detail="Unable to generate unique Outgoing payment ID"
    )

def update_vendor_payable_amount(
    vendor_collection,
    vendor_id: Optional[str],
    vendor_name: Optional[str],
    amount_to_add: float,
    current_datetime: datetime,
    operation: str = "add"
) -> dict:
    """Update vendor payable amount"""
    
    logger.info(f"Updating vendor payable - ID: {vendor_id}, Name: {vendor_name}, Amount: {amount_to_add}, Operation: {operation}")
    
    if not (vendor_id or vendor_name):
        logger.warning("No vendorId or vendorName provided. Skipping payable update.")
        return {
            "status": "skipped",
            "reason": "No vendor identifier provided",
            "matched": False
        }
    
    # Determine the amount operation
    if operation == "subtract":
        amount_to_update = -amount_to_add
    else:  # default is add
        amount_to_update = amount_to_add
    
    update_payload = {
        "$inc": {"payableAmount": amount_to_update},
        "$set": {"updatedDate": current_datetime}
    }
    
    update_result = None
    update_method = None
    
    # Priority 1: Update by vendorId if available
    if vendor_id:
        try:
            if isinstance(vendor_id, str) and ObjectId.is_valid(vendor_id):
                vendor_id_obj = ObjectId(vendor_id)
            else:
                vendor_id_obj = vendor_id
                
            update_result = vendor_collection.update_one(
                {"_id": vendor_id_obj},
                update_payload
            )
            update_method = "vendorId"
            logger.info(f"Vendor update attempted by ID: {vendor_id}, matched: {update_result.matched_count}")
        except Exception as e:
            logger.warning(f"Failed to update by vendorId {vendor_id}: {str(e)}")
            update_result = None
    
    # Priority 2: If vendorId failed or not available, try vendorName
    if not update_result or (update_result and update_result.matched_count == 0):
        if vendor_name:
            try:
                update_result = vendor_collection.update_one(
                    {"vendorName": vendor_name},
                    update_payload
                )
                update_method = "vendorName"
                logger.info(f"Vendor update attempted by Name: {vendor_name}, matched: {update_result.matched_count}")
            except Exception as e:
                logger.warning(f"Failed to update by vendorName {vendor_name}: {str(e)}")
                update_result = None
    
    # Prepare response
    if update_result and update_result.matched_count > 0:
        query_filter = {}
        if update_method == "vendorId" and vendor_id:
            if isinstance(vendor_id, str) and ObjectId.is_valid(vendor_id):
                query_filter = {"_id": ObjectId(vendor_id)}
            else:
                query_filter = {"_id": vendor_id}
        elif update_method == "vendorName" and vendor_name:
            query_filter = {"vendorName": vendor_name}
        
        updated_vendor = None
        if query_filter:
            updated_vendor = vendor_collection.find_one(
                query_filter,
                {"payableAmount": 1, "vendorName": 1, "vendorId": 1, "_id": 1}
            )
        
        response = {
            "status": "success",
            "method": update_method,
            "matched": True,
            "modified": update_result.modified_count > 0,
            "amount": amount_to_update,
            "operation": operation,
            "updatedVendor": {
                "id": str(updated_vendor.get("_id")) if updated_vendor else None,
                "name": updated_vendor.get("vendorName") if updated_vendor else None,
                "currentPayable": updated_vendor.get("payableAmount") if updated_vendor else None
            } if updated_vendor else None
        }
        
        logger.info(f"✅ Vendor payable updated via {update_method} - Amount: {amount_to_update}")
        return response
    else:
        response = {
            "status": "failed",
            "method": update_method or "none",
            "matched": False,
            "reason": "Vendor not found by ID or Name",
            "vendorId": vendor_id,
            "vendorName": vendor_name
        }
        
        logger.warning(f"⚠️ Vendor not found by ID or Name. Payable amount not updated.")
        return response

def update_existing_ap_for_returned(
    existing_ap: dict,
    service: dict,
    apinvoice_collection,
    ap_round_off: Decimal,
    apInvoiceDate: datetime,
    invoiceDate: Optional[datetime] = None,
    invoiceNo: Optional[str] = None,
    freight_total: float = 0.0,
    freight_tax_total: float = 0.0,
    current_datetime: datetime = None
):
    """UPDATE existing AP invoice that was Returned"""
    try:
        if current_datetime is None:
            current_datetime = datetime.now(pytz.timezone("Asia/Kolkata"))
        
        # Calculate totals
        totals = calculate_service_totals_with_proportional_discount(service)
        
        # Calculate service amount
        service_amount = Decimal('0')
        possible_amount_keys = [
            "total_amount", "total", "grand_total", "amount",
            "total_amount_with_tax", "net_amount", "invoice_amount", "final_amount"
        ]
        
        for key in possible_amount_keys:
            if key in totals:
                service_amount = to_decimal(totals[key])
                break
        
        if service_amount == Decimal('0'):
            # Calculate from components
            total_fees = Decimal('0')
            total_tax = Decimal('0')
            total_discount = Decimal('0')
            
            fee_keys = ["total_fees", "fees", "total_fee", "fee", "subtotal"]
            for key in fee_keys:
                if key in totals:
                    total_fees = to_decimal(totals[key])
                    break
            
            tax_keys = ["total_tax", "tax", "tax_amount", "total_tax_amount"]
            for key in tax_keys:
                if key in totals:
                    total_tax = to_decimal(totals[key])
                    break
            
            discount_keys = ["total_discount", "discount", "discount_amount", "total_discount_amount"]
            for key in discount_keys:
                if key in totals:
                    total_discount = to_decimal(totals[key])
                    break
            
            service_amount = total_fees + total_tax - total_discount
        
        # Add freight
        freight_total_decimal = to_decimal(freight_total)
        freight_tax_total_decimal = to_decimal(freight_tax_total)
        total_with_freight = service_amount + freight_total_decimal + freight_tax_total_decimal
        
        # Apply AP round off
        invoice_amount = (total_with_freight + ap_round_off).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
        
        # Get tax, fees, discount values
        total_fees = Decimal('0')
        total_tax = Decimal('0')
        total_discount = Decimal('0')
        
        if "total_fees" in totals:
            total_fees = to_decimal(totals["total_fees"])
        elif "fees" in totals:
            total_fees = to_decimal(totals["fees"])
        
        if "total_tax" in totals:
            total_tax = to_decimal(totals["total_tax"])
        elif "tax" in totals:
            total_tax = to_decimal(totals["tax"])
        
        if "total_discount" in totals:
            total_discount = to_decimal(totals["total_discount"])
        elif "discount" in totals:
            total_discount = to_decimal(totals["discount"])
        
        # Use provided invoice date/No or fallback to service values
        final_invoice_date = invoiceDate or service.get("invoiceDate", current_datetime)
        final_invoice_no = invoiceNo or service.get("invoiceNo", "")
        
        # Prepare update data
        update_data = {
            "serviceId": service.get("serviceId", ""),
            "vendorId": service.get("vendorId", ""),
            "vendorName": service.get("vendorName", ""),
            "invoiceNo": final_invoice_no,
            "invoiceDate": final_invoice_date,
            "workOrderDate": service.get("workOrderDate"),
            
            # Financial details
            "invoiceAmount": float(invoice_amount),
            "taxDetails": float(total_tax.quantize(Decimal('0.00'))),
            "discountDetails": float(total_discount.quantize(Decimal('0.00'))),
            "totalFreightAmount": float(freight_total_decimal.quantize(Decimal('0.00'))),
            "totalFreightTaxAmount": float(freight_tax_total_decimal.quantize(Decimal('0.00'))),
            "apRoundOff": float(ap_round_off.quantize(Decimal('0.00'))),
            
            # Service-specific totals
            "totalServiceFees": float(total_fees.quantize(Decimal('0.00'))),
            "totalServiceTax": float(total_tax.quantize(Decimal('0.00'))),
            "totalServiceDiscount": float(total_discount.quantize(Decimal('0.00'))),
            
            # Status - set to active (not returned)
            "status": "Outgoing Posted",
            
            # Other details
            "paymentTerms": service.get("paymentTerms", ""),
            "comments": service.get("comments", ""),
            "attachments": service.get("imageUrl", ""),
            "lastUpdatedDate": current_datetime,
            "apinvoiceDate": apInvoiceDate,
            "city": service.get("city", ""),
            "state": service.get("state", ""),
            "contactpersonEmail": service.get("contactpersonEmail", ""),
            "country": service.get("country", ""),
            "address": service.get("address", ""),
            "postalCode": service.get("postalCode"),
            "gstNumber": service.get("gstNumber", ""),
            "shippingAddress": service.get("shippingAddress", ""),
            "billingAddress": service.get("billingAddress", ""),
            
            # Store full service description arrays
            "sacCode": service.get("sacCode", []),
            "descriptions": service.get("descriptions", []),
            "from_dates": service.get("from_dates", []),
            "to_dates": service.get("to_dates", []),
            "fees": service.get("fees", []),
            "remarks": service.get("remarks", []),
            "quantity": service.get("quantity", []),
            "desc_tax_types": service.get("desc_tax_types", []),
            "desc_tax_pers": service.get("desc_tax_pers", []),
            "desc_sgst": service.get("desc_sgst", []),
            "desc_cgst": service.get("desc_cgst", []),
            "desc_igst": service.get("desc_igst", []),
            "desc_tax_amounts": service.get("desc_tax_amounts", []),
            "desc_totals": service.get("desc_totals", []),
            "desc_total_fees": service.get("desc_total_fees", [])
        }
        
        # Update the document
        result = apinvoice_collection.update_one(
            {"_id": existing_ap["_id"]},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise Exception("AP invoice not found for update")
        
        logger.info(f"✅ Updated existing AP invoice: {existing_ap['_id']}")
        
        # Get updated document
        updated_ap = apinvoice_collection.find_one({"_id": existing_ap["_id"]})
        
        return {
            "invoiceId": str(existing_ap["_id"]),
            "status": "updated",
            "randomId": existing_ap.get("randomId", ""),
            "newStatus": "Outgoing Posted"
        }
        
    except Exception as e:
        logger.error(f"❌ Error updating AP invoice: {str(e)}")
        logger.error(traceback.format_exc())
        raise

def update_existing_outgoing_for_returned(
    existing_outgoing: dict,
    updated_ap: dict,
    outgoing_collection,
    outgoingDate: datetime,
    current_datetime: datetime
):
    """UPDATE existing outgoing payment that was associated with Returned AP"""
    try:
        # Calculate payable amount
        invoice_amount = to_decimal(updated_ap.get("invoiceAmount", 0))
        
        # Prepare update data
        update_data = {
            "invoiceNo": updated_ap.get("invoiceNo", ""),
            "invoiceDate": updated_ap.get("invoiceDate"),
            "apinvoiceDate": updated_ap.get("apinvoiceDate"),
            
            # Service reference
            "serviceId": updated_ap.get("serviceId", ""),
            "invoiceType": "service",
            
            # Vendor info
            "vendorName": updated_ap.get("vendorName", ""),
            "vendorId": updated_ap.get("vendorId", ""),
            "workOrderDate": updated_ap.get("workOrderDate"),
            "outgoingDate": outgoingDate,
            
            # Financials
            "taxDetails": float(to_decimal(updated_ap.get("taxDetails", 0)).quantize(Decimal('0.00'))),
            "discountDetails": float(to_decimal(updated_ap.get("discountDetails", 0)).quantize(Decimal('0.00'))),
            "totalFreightAmount": float(to_decimal(updated_ap.get("totalFreightAmount", 0)).quantize(Decimal('0.00'))),
            "totalFreightTaxAmount": float(to_decimal(updated_ap.get("totalFreightTaxAmount", 0)).quantize(Decimal('0.00'))),
            "apRoundOff": float(to_decimal(updated_ap.get("apRoundOff", 0)).quantize(Decimal('0.00'))),
            "payableAmount": float(invoice_amount.quantize(Decimal('0.00'))),
            "totalPayableAmount": float(invoice_amount.quantize(Decimal('0.00'))),
            
            # Status - set to active
            "status": "active",
            
            # Basic totals
            "totalPrice": float(to_decimal(updated_ap.get("totalServiceFees", 0)).quantize(Decimal('0.00'))),
            
            # Address info
            "city": updated_ap.get("city", ""),
            "state": updated_ap.get("state", ""),
            "contactpersonEmail": updated_ap.get("contactpersonEmail", ""),
            "country": updated_ap.get("country", ""),
            "address": updated_ap.get("address", ""),
            "postalCode": updated_ap.get("postalCode"),
            "gstNumber": updated_ap.get("gstNumber", ""),
            "shippingAddress": updated_ap.get("shippingAddress", ""),
            "billingAddress": updated_ap.get("billingAddress", ""),
            "paymentTerms": updated_ap.get("paymentTerms", ""),
            
            # Timestamps
            "lastUpdatedDate": current_datetime
        }
        
        # Update the document
        result = outgoing_collection.update_one(
            {"_id": existing_outgoing["_id"]},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise Exception("Outgoing payment not found for update")
        
        logger.info(f"✅ Updated existing outgoing payment: {existing_outgoing['_id']}")
        
        # Get updated document
        updated_outgoing = outgoing_collection.find_one({"_id": existing_outgoing["_id"]})
        
        return {
            "outgoingId": str(existing_outgoing["_id"]),
            "status": "updated",
            "randomId": existing_outgoing.get("randomId", ""),
            "newStatus": "active"
        }
        
    except Exception as e:
        logger.error(f"❌ Error updating outgoing: {str(e)}")
        logger.error(traceback.format_exc())
        raise

def create_ap_invoice_for_service(
    service: dict,
    tenant_id: str,
    apinvoice_collection,
    ap_round_off: Decimal,
    apInvoiceDate: datetime,
    invoiceDate: Optional[datetime] = None,
    invoiceNo: Optional[str] = None,
    freight_total: float = 0.0,
    freight_tax_total: float = 0.0
):
    """Create NEW AP Invoice for service"""
    try:
        current_datetime = datetime.now(pytz.timezone("Asia/Kolkata"))
        
        # Calculate totals
        totals = calculate_service_totals_with_proportional_discount(service)
        
        # Calculate service amount
        service_amount = Decimal('0')
        possible_amount_keys = [
            "total_amount", "total", "grand_total", "amount",
            "total_amount_with_tax", "net_amount", "invoice_amount", "final_amount"
        ]
        
        for key in possible_amount_keys:
            if key in totals:
                service_amount = to_decimal(totals[key])
                break
        
        if service_amount == Decimal('0'):
            # Calculate from components
            total_fees = Decimal('0')
            total_tax = Decimal('0')
            total_discount = Decimal('0')
            
            fee_keys = ["total_fees", "fees", "total_fee", "fee", "subtotal"]
            for key in fee_keys:
                if key in totals:
                    total_fees = to_decimal(totals[key])
                    break
            
            tax_keys = ["total_tax", "tax", "tax_amount", "total_tax_amount"]
            for key in tax_keys:
                if key in totals:
                    total_tax = to_decimal(totals[key])
                    break
            
            discount_keys = ["total_discount", "discount", "discount_amount", "total_discount_amount"]
            for key in discount_keys:
                if key in totals:
                    total_discount = to_decimal(totals[key])
                    break
            
            service_amount = total_fees + total_tax - total_discount
        
        # Add freight
        freight_total_decimal = to_decimal(freight_total)
        freight_tax_total_decimal = to_decimal(freight_tax_total)
        total_with_freight = service_amount + freight_total_decimal + freight_tax_total_decimal
        
        # Apply AP round off
        invoice_amount = (total_with_freight + ap_round_off).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
        
        # Get tax, fees, discount values
        total_fees = Decimal('0')
        total_tax = Decimal('0')
        total_discount = Decimal('0')
        
        if "total_fees" in totals:
            total_fees = to_decimal(totals["total_fees"])
        elif "fees" in totals:
            total_fees = to_decimal(totals["fees"])
        
        if "total_tax" in totals:
            total_tax = to_decimal(totals["total_tax"])
        elif "tax" in totals:
            total_tax = to_decimal(totals["tax"])
        
        if "total_discount" in totals:
            total_discount = to_decimal(totals["total_discount"])
        elif "discount" in totals:
            total_discount = to_decimal(totals["discount"])
        
        # Use provided invoice date/No or fallback to service values
        final_invoice_date = invoiceDate or service.get("invoiceDate", current_datetime)
        final_invoice_no = invoiceNo or service.get("invoiceNo", "")
        
        # Prepare AP invoice data
        ap_invoice_data = {
            "serviceId": service.get("serviceId", ""),
            "vendorId": service.get("vendorId", ""),
            "serOId": str(service["_id"]),  # CRITICAL: Store service ObjectId as string
            "invoiceType": "service",
            "vendorName": service.get("vendorName", ""),
            "invoiceNo": final_invoice_no,
            "invoiceDate": final_invoice_date,
            "workOrderDate": service.get("workOrderDate"),
            "dueDate": None,
            
            # Financial details
            "invoiceAmount": float(invoice_amount),
            "taxDetails": float(total_tax.quantize(Decimal('0.00'))),
            "discountDetails": float(total_discount.quantize(Decimal('0.00'))),
            "totalFreightAmount": float(freight_total_decimal.quantize(Decimal('0.00'))),
            "totalFreightTaxAmount": float(freight_tax_total_decimal.quantize(Decimal('0.00'))),
            "apRoundOff": float(ap_round_off.quantize(Decimal('0.00'))),
            "debitAmount": 0,
            
            # Service-specific totals
            "totalServiceFees": float(total_fees.quantize(Decimal('0.00'))),
            "totalServiceTax": float(total_tax.quantize(Decimal('0.00'))),
            "totalServiceDiscount": float(total_discount.quantize(Decimal('0.00'))),
            
            # Other details
            "paymentTerms": service.get("paymentTerms", ""),
            "paymentStatus": "",
            "comments": service.get("comments", ""),
            "attachments": service.get("imageUrl", ""),
            "createdDate": current_datetime,
            "lastUpdatedDate": current_datetime,
            "apinvoiceDate": apInvoiceDate,
            "city": service.get("city", ""),
            "state": service.get("state", ""),
            "contactpersonEmail": service.get("contactpersonEmail", ""),
            "country": service.get("country", ""),
            "address": service.get("address", ""),
            "postalCode": service.get("postalCode"),
            "gstNumber": service.get("gstNumber", ""),
            "shippingAddress": service.get("shippingAddress", ""),
            "billingAddress": service.get("billingAddress", ""),
            "hasDebitCreditNotes": False,
            "status": "Outgoing Posted",
            
            # Store full service description arrays
            "sacCode": service.get("sacCode", []),
            "descriptions": service.get("descriptions", []),
            "from_dates": service.get("from_dates", []),
            "to_dates": service.get("to_dates", []),
            "fees": service.get("fees", []),
            "remarks": service.get("remarks", []),
            "quantity": service.get("quantity", []),
            "desc_tax_types": service.get("desc_tax_types", []),
            "desc_tax_pers": service.get("desc_tax_pers", []),
            "desc_sgst": service.get("desc_sgst", []),
            "desc_cgst": service.get("desc_cgst", []),
            "desc_igst": service.get("desc_igst", []),
            "desc_tax_amounts": service.get("desc_tax_amounts", []),
            "desc_totals": service.get("desc_totals", []),
            "desc_total_fees": service.get("desc_total_fees", [])
        }
        
        # Generate unique AP ID
        ap_invoice_data["randomId"] = generate_unique_ap_id(apinvoice_collection,tenant_id)
        
        logger.info(f"Creating new service AP invoice with randomId: {ap_invoice_data['randomId']}")
        
        # Insert new document
        result = apinvoice_collection.insert_one(ap_invoice_data)
        new_ap_id = result.inserted_id
        
        logger.info(f"✅ Created new AP invoice with ID: {new_ap_id}")
        
        return {
            "invoiceId": str(new_ap_id),
            "status": "created",
            "randomId": ap_invoice_data["randomId"],
            "newStatus": ap_invoice_data["status"]
        }
        
    except DuplicateKeyError as e:
        logger.error(f"❌ Duplicate key error: {str(e)}")
        raise HTTPException(status_code=500, detail="Duplicate AP invoice detected!")
    except Exception as e:
        logger.error(f"❌ Error creating AP invoice: {str(e)}")
        logger.error(traceback.format_exc())
        raise

def create_outgoing_for_service(
    ap_invoice: dict,
    tenant_id: str,
    outgoing_collection,
    outgoingDate: datetime,
    current_datetime: datetime
):
    """Create NEW Outgoing for service"""
    try:
        # Calculate payable amount
        invoice_amount = to_decimal(ap_invoice.get("invoiceAmount", 0))
        
        # Prepare outgoing data
        outgoing_data = {
            "invoiceId": str(ap_invoice["_id"]),
            "invoiceNo": ap_invoice.get("invoiceNo", ""),
            "invoiceDate": ap_invoice.get("invoiceDate"),
            "apinvoiceDate": ap_invoice.get("apinvoiceDate"),
            "apRandomId": ap_invoice.get("randomId", ""),
            
            # Service reference
            "serviceId": ap_invoice.get("serviceId", ""),
            "serOId": ap_invoice.get("serOId", ""),
            "invoiceType": "service",
            
            # Vendor info
            "vendorName": ap_invoice.get("vendorName", ""),
            "vendorId": ap_invoice.get("vendorId", ""),
            "workOrderDate": ap_invoice.get("workOrderDate"),
            "outgoingDate": outgoingDate,
            
            # Financials
            "taxDetails": float(to_decimal(ap_invoice.get("taxDetails", 0)).quantize(Decimal('0.00'))),
            "discountDetails": float(to_decimal(ap_invoice.get("discountDetails", 0)).quantize(Decimal('0.00'))),
            "totalFreightAmount": float(to_decimal(ap_invoice.get("totalFreightAmount", 0)).quantize(Decimal('0.00'))),
            "totalFreightTaxAmount": float(to_decimal(ap_invoice.get("totalFreightTaxAmount", 0)).quantize(Decimal('0.00'))),
            "apRoundOff": float(to_decimal(ap_invoice.get("apRoundOff", 0)).quantize(Decimal('0.00'))),
            "payableAmount": float(invoice_amount.quantize(Decimal('0.00'))),
            "totalPayableAmount": float(invoice_amount.quantize(Decimal('0.00'))),
            "debitAmount": 0,
            
            # Payment info
            "hasDebitCreditNotes": False,
            "paidAmount": 0,
            "comments": ap_invoice.get("comments", ""),
            "status": "active",
            
            # Basic totals
            "totalPrice": float(to_decimal(ap_invoice.get("totalServiceFees", 0)).quantize(Decimal('0.00'))),
            
            # Address info
            "city": ap_invoice.get("city", ""),
            "state": ap_invoice.get("state", ""),
            "contactpersonEmail": ap_invoice.get("contactpersonEmail", ""),
            "country": ap_invoice.get("country", ""),
            "address": ap_invoice.get("address", ""),
            "postalCode": ap_invoice.get("postalCode"),
            "gstNumber": ap_invoice.get("gstNumber", ""),
            "shippingAddress": ap_invoice.get("shippingAddress", ""),
            "billingAddress": ap_invoice.get("billingAddress", ""),
            "paymentTerms": ap_invoice.get("paymentTerms", ""),
            
            # Timestamps
            "createdDate": current_datetime,
            "lastUpdatedDate": current_datetime
        }
        
        # Generate unique outgoing ID
        outgoing_data["randomId"] = generate_unique_outgoing_id(outgoing_collection,tenant_id)
        
        logger.info(f"Creating new service outgoing with randomId: {outgoing_data['randomId']}")
        
        # Insert new document
        result = outgoing_collection.insert_one(outgoing_data)
        
        logger.info(f"✅ Created new outgoing with ID: {result.inserted_id}")
        
        return {
            "outgoingId": str(result.inserted_id),
            "status": "created",
            "randomId": outgoing_data["randomId"]
        }
        
    except DuplicateKeyError as e:
        logger.error(f"❌ Duplicate outgoing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Duplicate outgoing payment detected!")
    except Exception as e:
        logger.error(f"❌ Error creating outgoing: {str(e)}")
        logger.error(traceback.format_exc())
        raise

# ============================================
# API ENDPOINTS - WITH RETURNED STATUS HANDLING
# ============================================

@router.post("/convert-service-to-ap-outgoing/{service_id}")
async def convert_service_to_ap_outgoing(
    service_id: str,
    request: Request,
    apRoundOff: str = Query("0.00", description="AP Round Off adjustment"),
    invoiceNo: Optional[str] = Query(None, description="Original Invoice Number"),
    invoiceDate: Optional[str] = Query(None, description="Original Invoice Date in YYYY-MM-DD format"),
    updateVendorPayable: bool = Query(True, description="Whether to update vendor payable amount"),
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_approved","edit")
    )
):
  
    """
    Convert Service Order to AP Invoice and Outgoing Payment
    Handles: New conversion, Returned invoice re-conversion
    """
    tenant_id = request.state.tenant_id
    logger.info(f"=== STARTING SERVICE CONVERSION: {service_id} ===")
    logger.info(f"Parameters - apRoundOff: {apRoundOff}, invoiceNo: {invoiceNo}, invoiceDate: {invoiceDate}")
    
    # Validate service_id format
    if not ObjectId.is_valid(service_id):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INVALID_SERVICE_ID",
                "message": f"Invalid service ID format: {service_id}",
                "expected": "Valid MongoDB ObjectId"
            }
        )
    
    try:
        # Get collections
        service_collection = get_serviceworkorder_collection(tenant_id)
        vendor_collection = get_vendor_collection(tenant_id)
        apinvoice_collection = get_apinvoice_collection(tenant_id)
        outgoing_collection = get_outgoingpayment_collection(tenant_id)
        
        # ============================================
        # STEP 1: CHECK CONVERSION STATUS (including Returned)
        # ============================================
        logger.info("🔍 Checking service conversion status...")
        
        conversion_status, existing_ap, existing_outgoing = check_service_conversion_status(
            service_id, apinvoice_collection, outgoing_collection
        )
        
        logger.info(f"Conversion status: {conversion_status}")
        
        # ============================================
        # STEP 2: VALIDATE SERVICE EXISTS
        # ============================================
        logger.info("🔍 Validating service...")
        service = await validate_service(service_id, service_collection)
        logger.info(f"✅ Service validated: {service.get('serviceId', 'N/A')}, Vendor: {service.get('vendorName', 'N/A')}")
        
        # ============================================
        # STEP 3: HANDLE BASED ON CONVERSION STATUS
        # ============================================
        
        # If CONVERTED_ACTIVE - BLOCK (cannot convert again)
        if conversion_status == 'CONVERTED_ACTIVE':
            error_detail = {
                "error": "SERVICE_ALREADY_CONVERTED_ACTIVE",
                "message": f"Service has ALREADY been converted to ACTIVE AP Invoice.",
                "serviceId": service_id,
                "serviceName": service.get('serviceId', ''),
                "vendorName": service.get('vendorName', ''),
                "existingConversion": {
                    "apInvoiceId": str(existing_ap["_id"]) if existing_ap else None,
                    "apRandomId": existing_ap.get("randomId", "") if existing_ap else "",
                    "apStatus": existing_ap.get("status", "") if existing_ap else "",
                    "apCreatedDate": existing_ap.get("createdDate") if existing_ap else None,
                    "outgoingId": str(existing_outgoing["_id"]) if existing_outgoing else None,
                    "outgoingRandomId": existing_outgoing.get("randomId", "") if existing_outgoing else "",
                    "outgoingStatus": existing_outgoing.get("status", "") if existing_outgoing else ""
                },
                "actionRequired": "CANNOT CONVERT ACTIVE SERVICE AGAIN!",
                "possibleSolutions": [
                    "If this is a Returned invoice, it should have status 'Returned'",
                    "Use DELETE /reverse-service-conversion/{service_id} to undo first",
                    "Or use the Return flow to mark as Returned first"
                ]
            }
            
            logger.error(f"🚫 BLOCKED: Service already converted (ACTIVE)")
            raise HTTPException(status_code=409, detail=error_detail)
        
        # If CONVERTED_PARTIAL - This shouldn't happen, but handle gracefully
        if conversion_status == 'CONVERTED_PARTIAL':
            logger.warning(f"⚠️ Partial conversion detected. Will clean up and recreate.")
            # Could add cleanup logic here if needed
        
        # ============================================
        # STEP 4: VALIDATE AP ROUND OFF
        # ============================================
        logger.info("🔍 Validating AP round off...")
        ap_round_off = to_decimal(apRoundOff)
        if not (Decimal('-2') <= ap_round_off <= Decimal('2')):
            raise HTTPException(
                status_code=400,
                detail="AP round off must be between -2 and 2"
            )
        if ap_round_off != ap_round_off.quantize(Decimal('0.00')):
            raise HTTPException(
                status_code=400,
                detail="AP round off must have exactly two decimal places"
            )
        logger.info(f"✅ AP round off validated: {ap_round_off}")
        
        # ============================================
        # STEP 5: SET DATES
        # ============================================
        current_datetime = datetime.now(pytz.timezone("Asia/Kolkata"))
        apInvoiceDate = current_datetime
        outgoingDate = current_datetime
        
        # Invoice Date
        if invoiceDate:
            try:
                final_invoice_date = datetime.strptime(invoiceDate, "%Y-%m-%d")
                logger.info(f"Using provided invoice date: {final_invoice_date}")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid invoiceDate format. Use YYYY-MM-DD")
        else:
            service_invoice_date = service.get("invoiceDate")
            if service_invoice_date:
                final_invoice_date = service_invoice_date
                logger.info(f"Using service invoice date: {final_invoice_date}")
            else:
                final_invoice_date = current_datetime
                logger.info(f"Using current date as invoice date: {final_invoice_date}")
        
        # Invoice Number
        final_invoice_no = invoiceNo or service.get("invoiceNo", "")
        logger.info(f"Final invoice number: {final_invoice_no}")
        
        # ============================================
        # STEP 6: CALCULATE TOTALS
        # ============================================
        logger.info("📊 Calculating totals...")
        totals = calculate_service_totals_with_proportional_discount(service)
        
        # Calculate service amount
        service_amount = Decimal('0')
        possible_amount_keys = [
            "total_amount", "total", "grand_total", "amount",
            "total_amount_with_tax", "net_amount", "invoice_amount", "final_amount"
        ]
        
        for key in possible_amount_keys:
            if key in totals:
                service_amount = to_decimal(totals[key])
                logger.info(f"✅ Found amount using key '{key}': {service_amount}")
                break
        
        if service_amount == Decimal('0'):
            # Calculate from components
            total_fees = Decimal('0')
            total_tax = Decimal('0')
            total_discount = Decimal('0')
            
            fee_keys = ["total_fees", "fees", "total_fee", "fee", "subtotal"]
            for key in fee_keys:
                if key in totals:
                    total_fees = to_decimal(totals[key])
                    break
            
            tax_keys = ["total_tax", "tax", "tax_amount", "total_tax_amount"]
            for key in tax_keys:
                if key in totals:
                    total_tax = to_decimal(totals[key])
                    break
            
            discount_keys = ["total_discount", "discount", "discount_amount", "total_discount_amount"]
            for key in discount_keys:
                if key in totals:
                    total_discount = to_decimal(totals[key])
                    break
            
            service_amount = total_fees + total_tax - total_discount
        
        # Get tax, fees, discount values
        total_fees = Decimal('0')
        total_tax = Decimal('0')
        total_discount = Decimal('0')
        
        if "total_fees" in totals:
            total_fees = to_decimal(totals["total_fees"])
        elif "fees" in totals:
            total_fees = to_decimal(totals["fees"])
        
        if "total_tax" in totals:
            total_tax = to_decimal(totals["total_tax"])
        elif "tax" in totals:
            total_tax = to_decimal(totals["tax"])
        
        if "total_discount" in totals:
            total_discount = to_decimal(totals["total_discount"])
        elif "discount" in totals:
            total_discount = to_decimal(totals["discount"])
        
        # Freight totals
        freight_total = Decimal('0')
        freight_tax_total = Decimal('0')
        
        if service.get("freights"):
            for freight in service.get("freights", []):
                freight_total += to_decimal(freight.get("amt", 0))
                freight_tax_total += to_decimal(freight.get("tAmt", 0))
        
        # Final invoice amount
        total_with_freight = service_amount + freight_total + freight_tax_total
        invoice_amount = (total_with_freight + ap_round_off).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
        
        # ============================================
        # STEP 7: CREATE OR UPDATE DOCUMENTS BASED ON STATUS
        # ============================================
        
        vendor_payable_update_result = None
        ap_result = None
        outgoing_result = None
        
        if conversion_status == 'CONVERTED_RETURNED':
            # ===== UPDATE EXISTING RETURNED DOCUMENTS =====
            logger.info("📄 Updating existing Returned AP invoice...")
            
            # Update AP invoice
            ap_result = update_existing_ap_for_returned(
                existing_ap=existing_ap,
                service=service,
                apinvoice_collection=apinvoice_collection,
                ap_round_off=ap_round_off,
                apInvoiceDate=apInvoiceDate,
                invoiceDate=final_invoice_date,
                invoiceNo=final_invoice_no,
                freight_total=float(freight_total.quantize(Decimal('0.00'))),
                freight_tax_total=float(freight_tax_total.quantize(Decimal('0.00'))),
                current_datetime=current_datetime
            )
            
            logger.info(f"✅ AP invoice updated: {ap_result['invoiceId']}")
            
            # Get the updated AP invoice
            updated_ap = apinvoice_collection.find_one({"_id": ObjectId(ap_result["invoiceId"])})
            
            # Update outgoing payment if it exists
            if existing_outgoing:
                logger.info("💰 Updating existing Returned outgoing payment...")
                outgoing_result = update_existing_outgoing_for_returned(
                    existing_outgoing=existing_outgoing,
                    updated_ap=updated_ap,
                    outgoing_collection=outgoing_collection,
                    outgoingDate=outgoingDate,
                    current_datetime=current_datetime
                )
                logger.info(f"✅ Outgoing payment updated: {outgoing_result['outgoingId']}")
            else:
                # Create new outgoing if it doesn't exist
                logger.info("💰 Creating new outgoing payment...")
                outgoing_result = create_outgoing_for_service(
                    ap_invoice=updated_ap,
                    tenant_id=tenant_id,
                    outgoing_collection=outgoing_collection,
                    outgoingDate=outgoingDate,
                    current_datetime=current_datetime
                )
                logger.info(f"✅ Outgoing payment created: {outgoing_result['outgoingId']}")
            
            # Update vendor payable (adjust for difference if needed)
            if updateVendorPayable:
                vendor_id = service.get("vendorId")
                vendor_name = service.get("vendorName")
                invoice_amount_float = float(invoice_amount.quantize(Decimal('0.00')))
                
                # For returned invoices, we need to add the amount (since it was previously subtracted)
                vendor_payable_update_result = update_vendor_payable_amount(
                    vendor_collection=vendor_collection,
                    vendor_id=vendor_id,
                    vendor_name=vendor_name,
                    amount_to_add=invoice_amount_float,
                    current_datetime=current_datetime,
                    operation="add"
                )
                logger.info("✅ Vendor payable updated (added for returned invoice)")
            
        else:  # NOT_CONVERTED or CONVERTED_PARTIAL
            # ===== CREATE NEW DOCUMENTS =====
            logger.info("📄 Creating new AP invoice...")
            
            # Create AP invoice
            ap_result = create_ap_invoice_for_service(
                service=service,
                tenant_id=tenant_id,
                apinvoice_collection=apinvoice_collection,
                ap_round_off=ap_round_off,
                apInvoiceDate=apInvoiceDate,
                invoiceDate=final_invoice_date,
                invoiceNo=final_invoice_no,
                freight_total=float(freight_total.quantize(Decimal('0.00'))),
                freight_tax_total=float(freight_tax_total.quantize(Decimal('0.00')))
            )
            
            logger.info(f"✅ AP invoice created: {ap_result['invoiceId']}")
            
            # Get the created AP invoice
            new_ap = apinvoice_collection.find_one({"_id": ObjectId(ap_result["invoiceId"])})
            
            # Create outgoing payment
            logger.info("💰 Creating outgoing payment...")
            outgoing_result = create_outgoing_for_service(
                tenant_id=tenant_id,
                ap_invoice=new_ap,
                outgoing_collection=outgoing_collection,
                outgoingDate=outgoingDate,
                current_datetime=current_datetime
            )
            
            logger.info(f"✅ Outgoing payment created: {outgoing_result['outgoingId']}")
            
            # Update vendor payable
            if updateVendorPayable:
                vendor_id = service.get("vendorId")
                vendor_name = service.get("vendorName")
                invoice_amount_float = float(invoice_amount.quantize(Decimal('0.00')))
                
                vendor_payable_update_result = update_vendor_payable_amount(
                    vendor_collection=vendor_collection,
                    vendor_id=vendor_id,
                    vendor_name=vendor_name,
                    amount_to_add=invoice_amount_float,
                    current_datetime=current_datetime,
                    operation="add"
                )
                logger.info("✅ Vendor payable updated")
        
        # ============================================
        # STEP 8: UPDATE SERVICE STATUS
        # ============================================
        logger.info("🔄 Updating service status to APConverted...")
        try:
            service_update_result = service_collection.update_one(
                {"_id": ObjectId(service_id)},
                {
                    "$set": {
                        "status": "APConverted",
                        "lastUpdatedDate": current_datetime
                    }
                }
            )
            
            if hasattr(service_update_result, '__await__'):
                service_update_result = await service_update_result
            
            logger.info(f"✅ Service status updated to APConverted")
                
        except Exception as update_error:
            logger.error(f"⚠️ Service status update failed: {str(update_error)}")
            # Continue even if status update fails
        
        # ============================================
        # STEP 9: SUCCESS RESPONSE
        # ============================================
        logger.info("🎉 CONVERSION COMPLETED SUCCESSFULLY!")
        
        response_data = {
            "success": True,
            "message": f"Service successfully converted to AP Invoice and Outgoing Payment",
            "conversionType": "returned_reconversion" if conversion_status == 'CONVERTED_RETURNED' else "new_conversion",
            "timestamp": current_datetime.isoformat(),
            "idMapping": {
                "serviceId": service.get("serviceId", ""),
                "serviceObjectId": service_id,
                "vendorId": service.get("vendorId", ""),
                "apInvoiceId": ap_result["invoiceId"],
                "apRandomId": ap_result["randomId"],
                "apStatus": ap_result.get("newStatus", "Outgoing Posted"),
                "outgoingId": outgoing_result["outgoingId"],
                "outgoingRandomId": outgoing_result["randomId"],
                "outgoingStatus": outgoing_result.get("newStatus", "active")
            },
            "datesUsed": {
                "apInvoiceDate": apInvoiceDate.strftime("%Y-%m-%d %H:%M:%S"),
                "outgoingDate": outgoingDate.strftime("%Y-%m-%d %H:%M:%S"),
                "invoiceDate": final_invoice_date.strftime("%Y-%m-%d") if isinstance(final_invoice_date, datetime) else str(final_invoice_date)
            },
            "financialSummary": {
                "serviceAmount": float(service_amount.quantize(Decimal('0.00'))),
                "apRoundOffApplied": float(ap_round_off.quantize(Decimal('0.00'))),
                "apInvoiceAmount": float(invoice_amount.quantize(Decimal('0.00'))),
                "totalServiceFees": float(total_fees.quantize(Decimal('0.00'))),
                "totalTax": float(total_tax.quantize(Decimal('0.00'))),
                "totalDiscount": float(total_discount.quantize(Decimal('0.00'))),
                "totalFreightAmount": float(freight_total.quantize(Decimal('0.00'))),
                "totalFreightTax": float(freight_tax_total.quantize(Decimal('0.00'))),
                "payableAmount": float(invoice_amount.quantize(Decimal('0.00')))
            },
            "apInvoiceDetails": ap_result,
            "outgoingDetails": outgoing_result
        }
        
        if vendor_payable_update_result:
            response_data["vendorUpdate"] = vendor_payable_update_result
        
        return response_data
        
    except HTTPException:
        raise
    except PyMongoError as e:
        logger.error(f"❌ MongoDB error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

@router.post("/setup-indexes")
async def setup_database_indexes(request: Request):
    tenant_id = request.state.tenant_id
    apinvoice_collection = get_apinvoice_collection(tenant_id)

    """
    Create unique indexes to prevent duplicate conversions at database level
    Run this once during setup
    """
    try:
       
        
        # Create unique index on serOId field
        # This will cause MongoDB to REJECT any duplicate at database level
        apinvoice_collection.create_index(
            [("serOId", 1)], 
            unique=True, 
            name="unique_service_conversion",
            background=True
        )
        
        logger.info("✅ Created unique index on serOId field in apinvoice collection")
        
        return {
            "success": True,
            "message": "Database indexes created successfully",
            "indexes": [
                {
                    "collection": "apinvoice",
                    "field": "serOId",
                    "type": "unique",
                    "purpose": "Prevent duplicate service conversions"
                }
            ]
        }
        
    except Exception as e:
        logger.error(f"Index creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@router.patch("/return-service/{service_id}")
async def return_service(
    service_id: str,  request: Request,
    remarks: Optional[str] = Body(None, embed=True),
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_approved","edit")
    )
):
    tenant_id = request.state.tenant_id

    service_collection = get_serviceworkorder_collection(tenant_id)
    apinvoice_collection = get_apinvoice_collection(tenant_id)
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    """
    Return a service invoice - sets service status back to Pending
    This allows the service to be converted to AP again
    """
    
    logger.info(f"=== RETURNING SERVICE: {service_id} ===")
    
    # Validate service_id format
    if not ObjectId.is_valid(service_id):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid service ID format: {service_id}"
        )
    
    try:
       
        
        # Find the service - NEEDS AWAIT (async)
        service = await service_collection.find_one({"_id": ObjectId(service_id)})
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        current_datetime = datetime.now(pytz.timezone("Asia/Kolkata"))
        
        # Find associated AP invoice - NO AWAIT (synchronous)
        ap_invoice = apinvoice_collection.find_one({"serOId": service_id})
        
        # Update service status to Pending - NEEDS AWAIT (async)
        await service_collection.update_one(
            {"_id": ObjectId(service_id)},
            {
                "$set": {
                    "status": "Pending",
                    "lastUpdatedDate": current_datetime,
                    "returnRemarks": remarks
                }
            }
        )
        
        # If AP invoice exists, update its status to Returned
        if ap_invoice:
            # Update AP invoice - NO AWAIT (synchronous)
            apinvoice_collection.update_one(
                {"_id": ap_invoice["_id"]},
                {
                    "$set": {
                        "status": "Returned",
                        "lastUpdatedDate": current_datetime
                    }
                }
            )
            
            # Update outgoing if exists - NO AWAIT (synchronous)
            outgoing = outgoing_collection.find_one({"invoiceId": str(ap_invoice["_id"])})
            if outgoing:
                outgoing_collection.update_one(
                    {"_id": outgoing["_id"]},
                    {
                        "$set": {
                            "status": "returned",
                            "lastUpdatedDate": current_datetime
                        }
                    }
                )
            
            logger.info(f"✅ Updated AP invoice {ap_invoice.get('randomId')} status to Returned")
            if outgoing:
                logger.info(f"✅ Updated Outgoing payment {outgoing.get('randomId')} status to returned")
        
        logger.info(f"✅ Service returned to Pending: {service_id}")
        
        return {
            "success": True,
            "message": "Service returned to Pending successfully",
            "serviceId": service_id,
            "serviceDisplayId": service.get("serviceId"),
            "status": "Pending",
            "apInvoiceUpdated": bool(ap_invoice),
            "outgoingUpdated": bool(outgoing) if 'outgoing' in locals() else False
        }
        
    except Exception as e:
        logger.error(f"Error returning service: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))