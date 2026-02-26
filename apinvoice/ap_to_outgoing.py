from bson import ObjectId
from fastapi import APIRouter, HTTPException,Request
import pytz
from datetime import datetime
from apinvoice.models import PostOutgoingAndUpdateDiscountRequest
from apinvoice.utils import get_safe_value
from outgoingPayment.routes import generate_outgoing_random_id, get_current_date_and_time
from utils.database import get_outgoingpayment_collection,get_apinvoice_collection,get_vendor_collection
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission
from fastapi import Depends
router = APIRouter()

@router.patch("/{invoice_id}/convert-to-outgoing-and-discount")
async def patch_outgoing_and_update_discount( request_http: Request,invoice_id: str, request: PostOutgoingAndUpdateDiscountRequest, user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "apinvoices", "edit"))):
    tenant_id = request_http.state.tenant_id
    # Get collections and current datetime
    apinvoice_collection = get_apinvoice_collection(tenant_id)
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    vendor_collection = get_vendor_collection(tenant_id)
    current_datetime = get_current_date_and_time()['datetime']
    ap_discount_price = request.apDiscountPrice or 0.0

    # Ensure current_datetime is offset-aware
    if current_datetime.tzinfo is None:
        current_datetime = pytz.timezone("Asia/Kolkata").localize(current_datetime)

    # Validate and process outgoingDate
    outgoing_date = request.outgoingDate
    if outgoing_date:
        if not isinstance(outgoing_date, datetime):
            raise HTTPException(status_code=400, detail="outgoingDate must be a valid datetime")
        # Ensure outgoing_date is offset-aware (convert to Asia/Kolkata if needed)
        if outgoing_date.tzinfo is None:
            outgoing_date = pytz.timezone("Asia/Kolkata").localize(outgoing_date)
        else:
            # Convert to Asia/Kolkata to ensure consistency
            outgoing_date = outgoing_date.astimezone(pytz.timezone("Asia/Kolkata"))
    else:
        outgoing_date = current_datetime
        print(f"No outgoingDate provided; defaulting to {current_datetime}")

    # Fetch the AP Invoice
    apinvoice = apinvoice_collection.find_one({"_id": ObjectId(invoice_id)})
    if not apinvoice:
        raise HTTPException(status_code=404, detail="AP Invoice not found")

    # Extract values
    original_invoice_amount = get_safe_value(apinvoice, "invoiceAmount")
    existing_discount_price = get_safe_value(apinvoice, "discountPrice", 0.0)
    existing_discount_details = get_safe_value(apinvoice, "discountDetails", 0.0)
    has_debit_credit_notes = apinvoice.get("hasDebitCreditNotes", False)
    item_details = apinvoice.get("itemDetails", [])

    # Calculate new discount values
    new_discount_price = existing_discount_price + ap_discount_price
    new_discount_details = existing_discount_details + ap_discount_price

    # Initialize totals
    total_base_price = 0.0
    total_tax_amount = 0.0
    calculated_debit_amount = 0.0
    outgoing_item_details = []

    # Process each item for quantity adjustments and dynamic tax calculation
    for item in item_details:
        received_quantity = get_safe_value(item, "stockQuantity", 0)
        original_quantity = get_safe_value(item, "quantity", 0)
        unit_price = get_safe_value(item, "unitPrice", 0.0)
        tax_type = item.get("taxType", "cgst_sgst")
        purchasetax_rate = get_safe_value(item, "purchasetaxName", 0)

        if original_quantity == 0:
            continue

        # Calculate base price for received quantity
        item_base_price = unit_price * received_quantity
        total_base_price += item_base_price

        # Calculate debit for returned quantity
        returned_quantity = original_quantity - received_quantity
        item_debit_amount = returned_quantity * unit_price
        calculated_debit_amount += item_debit_amount

        # Calculate dynamic tax rates
        if tax_type == "cgst_sgst":
            sgst_rate = purchasetax_rate / 2 / 100
            cgst_rate = purchasetax_rate / 2 / 100
            igst_rate = 0.0
            sgst_amount = item_base_price * sgst_rate
            cgst_amount = item_base_price * cgst_rate
            igst_amount = 0
        else:  # IGST case
            sgst_rate = 0.0
            cgst_rate = 0.0
            igst_rate = purchasetax_rate / 100
            sgst_amount = 0
            cgst_amount = 0
            igst_amount = item_base_price * igst_rate

        item_tax = sgst_amount + cgst_amount + igst_amount
        total_tax_amount += item_tax

        # Calculate item final price
        item_final_price = item_base_price + item_tax

        # Distribute discount proportionally across items
        item_discount = round(
            new_discount_price * (item_base_price / total_base_price) if total_base_price > 0 else 0.0, 2
        )

        # Prepare outgoing item details
        outgoing_item_details.append({
            "itemId": item.get("itemId"),
            "itemName": item.get("itemName"),
            "quantity": received_quantity,
            "returnedQuantity": returned_quantity,
            "unitPrice": unit_price,
            "totalPrice": round(item_base_price, 2),
            "taxAmount": round(item_tax, 2),
            "finalPrice": round(item_final_price - item_discount, 2),
            "taxType": tax_type,
            "sgst": round(sgst_amount, 2),
            "cgst": round(cgst_amount, 2),
            "igst": round(igst_amount, 2),
            "sgstRate": round(sgst_rate * 100, 2),
            "cgstRate": round(cgst_rate * 100, 2),
            "igstRate": round(igst_rate * 100, 2),
            "uom": item.get("uom"),
            "hsnCode": item.get("hsnCode"),
            "discountAmount": item_discount,
            "discountApplied": item_discount
        })

    # Round all amounts
    total_base_price = round(total_base_price, 2)
    total_tax_amount = round(total_tax_amount, 2)
    calculated_debit_amount = round(calculated_debit_amount, 2)

    # Modified logic for total_payable_amount based on original_invoice_amount
    total_payable_amount = round(original_invoice_amount - ap_discount_price, 2)

    # Handle debit tax split if hasDebitCreditNotes
    debit_after_sgst_amount = 0.0
    debit_after_cgst_amount = 0.0
    debit_after_igst_amount = 0.0
    debit_on_tax_amount = 0.0
    debit_on_base_price_amount = calculated_debit_amount

    if has_debit_credit_notes and calculated_debit_amount > 0:
        if tax_type == "cgst_sgst":
            debit_after_sgst_amount = round(calculated_debit_amount * (purchasetax_rate / 2 / 100), 2)
            debit_after_cgst_amount = round(calculated_debit_amount * (purchasetax_rate / 2 / 100), 2)
            debit_on_tax_amount = debit_after_sgst_amount + debit_after_cgst_amount
            debit_on_base_price_amount = calculated_debit_amount
        elif tax_type == "igst":
            debit_after_igst_amount = round(calculated_debit_amount * (purchasetax_rate / 100), 2)
            debit_on_tax_amount = debit_after_igst_amount

    # Create outgoing payment data
    outgoing_data = {
        "invoiceId": str(apinvoice["_id"]),
        "invoiceNo": apinvoice.get("invoiceNo"),
        "invoiceDate": apinvoice.get("invoiceDate"),
        "apinvoiceDate": apinvoice.get("apinvoiceDate"),
        "purchaseOrderId": apinvoice.get("purchaseOrderId"),
        "poRandomId": apinvoice.get("poRandomId"),
        "grnRandomId": apinvoice.get("grnRandomId"),
        "apRandomId": apinvoice.get("randomId"),
        "grnId": apinvoice.get("grnId"),
        "vendorName": apinvoice.get("vendorName"),
        "grnDate": apinvoice.get("grnDate"),
        "poDate": apinvoice.get("poDate"),
        "outgoingDate": outgoing_date,  # Use the validated user-selected date
        "taxDetails": total_tax_amount,
        "discountDetails": new_discount_details,
        "payableAmount": total_payable_amount,
        "totalPayableAmount": total_payable_amount,
        "debitAmount": calculated_debit_amount,
        "debitAfterTaxAmount": debit_on_tax_amount if has_debit_credit_notes else 0.0,
        "debitAfterDiscountAmount": calculated_debit_amount if has_debit_credit_notes else 0.0,
        "debitAfterSgstAmount": debit_after_sgst_amount,
        "debitAfterCgstAmount": debit_after_cgst_amount,
        "debitAfterIgstAmount": debit_after_igst_amount,
        "debitOnBasePriceAmount": debit_on_base_price_amount,
        "debitOnTaxAmount": debit_on_tax_amount,
        "hasDebitCreditNotes": has_debit_credit_notes,
        "paidAmount": 0,
        "comments": apinvoice.get("comments"),
        "status": "active",
        "totalPrice": total_base_price,
        "city": apinvoice.get("city"),
        "state": apinvoice.get("state"),
        "contactpersonEmail": apinvoice.get("contactpersonEmail"),
        "country": apinvoice.get("country"),
        "address": apinvoice.get("address"),
        "postalCode": apinvoice.get("postalCode"),
        "gstNumber": apinvoice.get("gstNumber"),
        "shippingAddress": apinvoice.get("shippingAddress"),
        "billingAddress": apinvoice.get("billingAddress"),
        "paymentTerms": apinvoice.get("paymentTerms"),
        "itemDetails": outgoing_item_details,
        "createdDate": current_datetime,
        "lastUpdatedDate": current_datetime,
        "randomId": generate_outgoing_random_id(tenant_id)
    }

    # Insert the outgoing payment
    outgoing_result = outgoing_collection.insert_one(outgoing_data)
    outgoing_id = str(outgoing_result.inserted_id)

    # Update the AP invoice (do not change invoiceAmount)
    apinvoice_collection.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": {
            "discountPrice": new_discount_price,
            "discountDetails": new_discount_details,
            "status": "Outgoing Posted",
            "lastUpdatedDate": current_datetime,
            "debitAmount": calculated_debit_amount
        }}
    )

    # Update vendor's payable amount
    if vendor_name := apinvoice.get("vendorName"):
        vendor = vendor_collection.find_one({"vendorName": vendor_name})
        if vendor:
            current_payable = get_safe_value(vendor, "payableAmount", 0.0)
            new_payable = max(current_payable - ap_discount_price, 0.0)
            vendor_collection.update_one(
                {"vendorName": vendor_name},
                {"$set": {
                    "payableAmount": round(new_payable, 2),
                    "updatedDate": current_datetime
                }}
            )

    # Create breakdown
    breakdown = {
        "originalInvoiceAmount": original_invoice_amount,
        "adjustedInvoiceAmount": total_base_price + total_tax_amount,
        "calculatedDebit": calculated_debit_amount,
        "totalTax": total_tax_amount,
        "discountApplied": new_discount_price,
        "payableAmount": total_payable_amount,
        "itemWiseBreakdown": [
            {
                "itemId": item.get("itemId"),
                "itemName": item.get("itemName"),
                "quantity": item.get("quantity"),
                "returnedQuantity": item.get("returnedQuantity"),
                "unitPrice": item.get("unitPrice"),
                "totalPrice": item.get("totalPrice"),
                "taxAmount": item.get("taxAmount"),
                "finalPrice": item.get("finalPrice"),
                "sgst": item.get("sgst"),
                "cgst": item.get("cgst"),
                "igst": item.get("igst"),
                "sgstRate": item.get("sgstRate"),
                "cgstRate": item.get("cgstRate"),
                "igstRate": item.get("igstRate"),
                "discountAmount": item.get("discountAmount")
            } for item in outgoing_item_details
        ],
        "taxBreakdown": {
            "sgst": sum(item.get("sgst", 0) for item in outgoing_item_details),
            "cgst": sum(item.get("cgst", 0) for item in outgoing_item_details),
            "igst": sum(item.get("igst", 0) for item in outgoing_item_details)
        }
    }

    # Return the response with outgoingDate for verification
    return {
        "message": "Outgoing payment created with accurate quantity adjustments",
        "outgoingId": outgoing_id,
        "originalInvoiceAmount": original_invoice_amount,
        "calculatedDebit": calculated_debit_amount,
        "payableAmount": total_payable_amount,
        "outgoingDate": outgoing_date.isoformat(),  # Return as ISO string for frontend
        "itemSummary": {
            "totalReceived": sum(item['quantity'] for item in outgoing_item_details),
            "totalReturned": sum(item.get('returnedQuantity', 0) for item in outgoing_item_details)
        },
        "breakdown": breakdown
    }