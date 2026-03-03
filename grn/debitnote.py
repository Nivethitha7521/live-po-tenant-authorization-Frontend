# File: debitnote/routes.py
import io
from fastapi import APIRouter, Depends, HTTPException, Query, status,Request
from fastapi.responses import  StreamingResponse
from pydantic import BaseModel, Field, validator
from typing import List, Literal, Optional
from pymongo import DESCENDING
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from bson import ObjectId
import logging
import traceback
from datetime import datetime, date
import pytz
from grn.debitnoteutils import calculate_available_amount_for_new_debit, check_debit_note_availability, format_debit_note_for_view, generate_debit_note_number, get_current_date_and_time, get_document_type_and_details, sanitize_note_for_response, update_source_document_for_debit_note
from grn.pdfutils import generate_all_notes_pdf_content, generate_debit_note_pdf_content
from utils.database import get_apinvoice_collection,get_outgoingpayment_collection,get_debit_collection,get_grn_collection
from .utils import (
    get_current_ist_datetime,is_valid_object_id
)
from .debitmodels import CreateAmountDebitNoteRequest, CreateDebitNoteRequest, DebitNote, DebitNoteResponse, DebitNotesSummary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================
# ROUTES
# ============================================

@router.post("/returnprocess/AmountDebitNote/create")
async def create_amount_debit_note(http_request: Request,request: CreateAmountDebitNoteRequest):
    tenant_id = http_request.state.tenant_id
    """
    Create amount-only debit note for GRN, AP Invoice, or Outgoing Payment
    WITH VALIDATION: Checks available payable amount and existing debit notes
    For outgoing_payment: Does NOT modify payable amounts, only records debit note
    """
    try:
        if not is_valid_object_id(request.documentId):
            raise HTTPException(status_code=400, detail="Invalid document ID format")

        # Log the incoming request
        logger.info(f"Creating amount debit note: {request.dict()}")

        # Check if debit note can be created based on available amount
        availability_check = await check_debit_note_availability(tenant_id,
            request.documentType,
            request.documentId,
            request.totalAmount
        )
        
        if not availability_check["can_create"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": availability_check["message"],
                    "available_amount": availability_check["available_amount"],
                    "requested_amount": request.totalAmount,
                    "existing_notes_count": availability_check.get("existing_notes_count", 0)
                }
            )
        
        # Generate sequential note ID FIRST
        note_id = generate_debit_note_number(tenant_id)
        logger.info(f"Generated amount-wise debit note ID: {note_id} for {request.documentType}")
        
        # Determine document type and fetch document
        source_doc = None
        document_type = request.documentType
        document_id = request.documentId

        if document_type == "outgoing_payment":
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            source_doc = outgoing_collection.find_one({"_id": ObjectId(document_id)})
            
            if not source_doc:
                # Also try finding by randomId if _id doesn't match
                source_doc = outgoing_collection.find_one({"randomId": document_id})
                
            if not source_doc:
                logger.error(f"Outgoing Payment not found: ID={document_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Outgoing Payment not found with ID: {document_id}"
                )
            
            logger.info(f"Found outgoing payment: {source_doc.get('randomId')}, vendor: {source_doc.get('vendorName')}")

        elif document_type == "grn":
            grn_collection = get_grn_collection(tenant_id)
            source_doc = grn_collection.find_one({"_id": ObjectId(document_id)})
            if not source_doc:
                source_doc = grn_collection.find_one({"randomId": document_id})
                
        elif document_type == "ap_invoice":
            ap_collection = get_apinvoice_collection(tenant_id)
            source_doc = ap_collection.find_one({"_id": ObjectId(document_id)})
            if not source_doc:
                source_doc = ap_collection.find_one({"randomId": document_id})

        if not source_doc:
            raise HTTPException(
                status_code=404,
                detail=f"{document_type.replace('_', ' ').title()} not found with ID: {document_id}"
            )

        # Get current timestamp
        now_ist = get_current_ist_datetime()
        current_time = get_current_date_and_time()
        
        # Create debit note document
        debit_note_doc = {
            "_id": ObjectId(),  # MongoDB _id
            "noteId": note_id,  # Sequential note ID (NOTE1, NOTE2, etc.)
            "documentId": document_id,
            "documentType": document_type,
            "randomId": source_doc.get("randomId", document_id),
            "vendorName": source_doc.get("vendorName", ""),
            "address": source_doc.get("address", ""),
            "city": source_doc.get("city", ""),
            "state": source_doc.get("state", ""),
            "country": source_doc.get("country", ""),
            "gstNumber": source_doc.get("gstNumber", ""),
            "totalAmount": request.totalAmount,
            "debitAmount": request.totalAmount,
            "reason": request.reason,
            "createdDate": now_ist,
            "createdBy": request.createdBy,
            "lastUpdatedDate": now_ist,
            "comments": request.comments or "",
            "status": "Active",
            "noteType": "amount_only",
            "returnDate": current_time.isoformat(),
            "isAmountOnly": True,
            "remainingPayableAmount": availability_check.get("remaining_available", 0),
            "sourceDocument": {
                "type": document_type,
                "id": document_id,
                "randomId": source_doc.get("randomId"),
                "vendorName": source_doc.get("vendorName"),
                "originalPayableAmount": availability_check.get("original_available", 0),
                "existingDebitNotesCount": availability_check.get("existing_notes_count", 0),
                "totalExistingDebit": availability_check.get("total_existing_debit", 0),
                # Include original financial data for reference
                "totalPayableAmount": source_doc.get("totalPayableAmount"),
                "payableAmount": source_doc.get("payableAmount"),
                "totalPrice": source_doc.get("totalPrice"),
                "debitAmount": source_doc.get("debitAmount", 0)
            }
        }

        # Add document-specific references
        if document_type == "grn":
            debit_note_doc["grnId"] = document_id
        elif document_type == "ap_invoice":
            debit_note_doc["apInvoiceId"] = document_id
        elif document_type == "outgoing_payment":
            debit_note_doc["outgoingPaymentId"] = document_id

        # Insert into debit collection
        insert_result = get_debit_collection(tenant_id).insert_one(debit_note_doc)
        mongo_id = str(insert_result.inserted_id)

        # Update source document WITHOUT modifying financial amounts
        await update_source_document_for_debit_note(tenant_id,
            document_type,
            document_id,
            request.totalAmount,
            now_ist
        )

        logger.info(f"Amount debit note created successfully: {note_id} (MongoDB ID: {mongo_id})")
        
        # Prepare response
        response_data = {
            "success": True,
            "noteId": note_id,  # Sequential note ID
            "mongoId": mongo_id,  # MongoDB _id
            "message": "Amount-only debit note created successfully",
            "totalAmount": request.totalAmount,
            "reason": request.reason,
            "remainingPayableAmount": availability_check.get("remaining_available", 0),
            "createdAt": now_ist.isoformat(),
            "noteNumber": note_id,  # Same as noteId for compatibility
            "sourceDocument": {
                "type": document_type,
                "id": document_id,
                "randomId": source_doc.get("randomId"),
                "available_before": availability_check.get("available_amount", 0),
                "existing_notes_before": availability_check.get("existing_notes_count", 0),
                "original_totalPayableAmount": source_doc.get("totalPayableAmount"),
                "original_payableAmount": source_doc.get("payableAmount")
            }
        }
        
        # For outgoing_payment, add a note that amounts were not modified
        if document_type == "outgoing_payment":
            response_data["note"] = "Outgoing payment amounts remain unchanged. Debit note recorded separately."
            response_data["originalAmounts"] = {
                "totalPayableAmount": source_doc.get("totalPayableAmount"),
                "payableAmount": source_doc.get("payableAmount"),
                "totalPrice": source_doc.get("totalPrice")
            }

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating amount debit note: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/returnprocess/DebitCreditNote/create", response_model=DebitNoteResponse)
async def create_debit_credit_note(http_request: Request,request: CreateDebitNoteRequest, user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "add"))):
    tenant_id = http_request.state.tenant_id
    """
    Create Debit/Credit Note with proper handling:
    - GRN: Item-wise returns with quantity reduction
    - AP Invoice/Outgoing Payment: Amount-only debit without quantity reduction
    WITH VALIDATION: Checks available payable amount and existing debit notes
    """
    try:
        if not is_valid_object_id(request.documentId):
            raise HTTPException(status_code=400, detail="Invalid Document ID format")
        
        # Validate items
        if not request.items or len(request.items) == 0:
            raise HTTPException(status_code=400, detail="At least one item is required")
        
        # Get current datetime
        current_time = get_current_date_and_time()
        
        # Generate sequential note ID FIRST
        note_id = generate_debit_note_number(tenant_id)
        logger.info(f"Generated item-wise debit note ID: {note_id} for {request.documentType}")
        
        # Fetch source document
        source_document = None
        collection = None
        grn_id = None
        ap_invoice_id = None
        outgoing_payment_id = None
        
        if request.documentType == "grn":
            collection = get_grn_collection(tenant_id)
            source_document = collection.find_one({"_id": ObjectId(request.documentId)})
            if source_document:
                grn_id = request.documentId
        
        elif request.documentType == "ap_invoice":
            collection = get_apinvoice_collection(tenant_id)
            source_document = collection.find_one({"_id": ObjectId(request.documentId)})
            if source_document:
                ap_invoice_id = request.documentId
                grn_id = source_document.get("grnId")
        
        elif request.documentType == "outgoing_payment":
            collection = get_outgoingpayment_collection(tenant_id)
            source_document = collection.find_one({"_id": ObjectId(request.documentId)})
            if source_document:
                outgoing_payment_id = request.documentId
                ap_invoice_id = source_document.get("invoiceId")
                if ap_invoice_id:
                    ap_invoice = get_apinvoice_collection(tenant_id).find_one({"_id": ObjectId(ap_invoice_id)})
                    if ap_invoice:
                        grn_id = ap_invoice.get("grnId")
        
        if not source_document:
            raise HTTPException(status_code=404, detail="Source document not found")
        
        if not source_document.get("randomId"):
            raise HTTPException(status_code=400, detail="Source document is missing randomId")
        
        # Process items
        processed_items = []
        total_debit_amount = 0.0
        total_credit_amount = 0.0
        items_processed = 0
        
        if request.documentType == "grn":
            # GRN: Item-wise processing with quantity reduction
            source_item_details = source_document.get("itemDetails", [])
            if not source_item_details:
                raise HTTPException(status_code=400, detail="GRN has no item details")
            
            for req_item in request.items:
                # Find matching item in source document
                source_item = None
                for src_item in source_item_details:
                    if src_item.get("itemId") == req_item.itemId:
                        source_item = src_item
                        break
                
                if not source_item:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Item with ID {req_item.itemId} not found in GRN"
                    )
                
                # Validate quantity doesn't exceed available
                if req_item.noteType == "debit":
                    available_quantity = source_item.get("quantity", 0)
                    if req_item.quantity > available_quantity:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Requested debit quantity {req_item.quantity} exceeds available quantity {available_quantity}"
                        )
                
                # Calculate item amounts
                unit_price = source_item.get("unitPrice", 0)
                total_price = unit_price * req_item.quantity
                
                # Get tax and discount percentages from source item
                tax_percentage = source_item.get("taxPercentage", 0)
                discount_percentage = source_item.get("discountPercentage", 0)
                tax_amount = (total_price * tax_percentage) / 100
                discount_amount = (total_price * discount_percentage) / 100
                
                processed_item = {
                    "itemId": req_item.itemId,
                    "itemName": req_item.itemName or source_item.get("itemName", ""),
                    "noteType": req_item.noteType,
                    "quantity": req_item.quantity,
                    "uom": source_item.get("uom", "PCS"),
                    "unitPrice": unit_price,
                    "totalPrice": total_price,
                    "finalPrice": total_price + tax_amount - discount_amount,
                    "reason": req_item.reason,
                    "isAmountOnly": False,
                    "taxAmount": tax_amount,
                    "discountAmount": discount_amount,
                    "taxPercentage": tax_percentage,
                    "discountPercentage": discount_percentage
                }
                
                if req_item.noteType == "debit":
                    total_debit_amount += processed_item["finalPrice"]
                else:
                    total_credit_amount += processed_item["finalPrice"]
                
                processed_items.append(processed_item)
                items_processed += 1
        else:
            # AP Invoice or Outgoing Payment: Amount-only processing
            # First check availability for amount-only notes
            net_amount = 0
            for req_item in request.items:
                # For amount-only, quantity field holds the amount
                amount = req_item.quantity
                if req_item.noteType == "debit":
                    net_amount += amount
                else:
                    net_amount -= amount
            
            # Check availability for the net amount
            availability_check = await check_debit_note_availability(tenant_id,
                request.documentType,
                request.documentId,
                net_amount
            )
            
            if not availability_check["can_create"] and net_amount > 0:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": availability_check["message"],
                        "available_amount": availability_check["available_amount"],
                        "requested_amount": net_amount,
                        "existing_notes_count": availability_check.get("existing_notes_count", 0)
                    }
                )
            
            for req_item in request.items:
                # For amount-only, quantity field holds the amount
                amount = req_item.quantity
                
                processed_item = {
                    "itemId": req_item.itemId or request.documentId,
                    "itemName": req_item.itemName or f"Amount Adjustment - {req_item.reason}",
                    "noteType": req_item.noteType,
                    "quantity": 1.0,  # Fixed at 1 for amount-only
                    "uom": "NOS",
                    "unitPrice": amount,
                    "totalPrice": amount,
                    "finalPrice": amount,
                    "reason": req_item.reason,
                    "isAmountOnly": True,
                    "taxAmount": 0.0,
                    "discountAmount": 0.0,
                    "taxPercentage": 0.0,
                    "discountPercentage": 0.0
                }
                
                if req_item.noteType == "debit":
                    total_debit_amount += amount
                else:
                    total_credit_amount += amount
                
                processed_items.append(processed_item)
                items_processed += 1
        
        # Calculate net amount
        net_amount = total_debit_amount - total_credit_amount
        
        # Create debit/credit note document
        debit_note = {
            "_id": ObjectId(),  # MongoDB _id
            "noteId": note_id,  # Sequential note ID
            "grnId": grn_id,
            "apInvoiceId": ap_invoice_id,
            "outgoingPaymentId": outgoing_payment_id,
            "sourceDocumentType": request.documentType,
            "sourceDocumentId": request.documentId,
            "randomId": source_document["randomId"],
            "vendorName": source_document.get("vendorName"),
            "address": source_document.get("address", ""),
            "city": source_document.get("city", ""),
            "state": source_document.get("state", ""),
            "country": source_document.get("country", ""),
            "gstNumber": source_document.get("gstNumber", ""),
            "itemDetails": processed_items,
            "totalDebitAmount": total_debit_amount,
            "totalCreditAmount": total_credit_amount,
            "netAmount": net_amount,
            "createdDate": current_time,
            "createdBy": request.createdBy,
            "lastUpdatedDate": current_time,
            "comments": request.comments or "",
            "status": "Active",
            "noteType": "item_wise" if request.documentType == "grn" else "amount_only",
            "returnDate": current_time.isoformat()
        }
        
        # Add amount-only fields if needed
        if request.documentType != "grn":
            debit_note["totalAmount"] = total_debit_amount
            debit_note["isAmountOnly"] = True
            # Store remaining payable amount for amount-only notes
            if request.documentType in ["outgoing_payment", "ap_invoice"]:
                # Calculate remaining amount
                availability_check = await check_debit_note_availability(tenant_id,
                    request.documentType,
                    request.documentId,
                    net_amount
                )
                if availability_check.get("remaining_available") is not None:
                    debit_note["remainingPayableAmount"] = availability_check["remaining_available"]
        
        # Insert the debit/credit note
        result = get_debit_collection(tenant_id).insert_one(debit_note)
        mongo_id = str(result.inserted_id)
        
        # Update source document based on type
        if request.documentType == "grn":
            # GRN: Update quantities and amounts
            grn_collection = get_grn_collection(tenant_id)
            for item in processed_items:
                if item["noteType"] == "debit":
                    grn_collection.update_one(
                        {"_id": ObjectId(request.documentId), "itemDetails.itemId": item["itemId"]},
                        {
                            "$inc": {
                                "itemDetails.$.quantity": -item["quantity"],
                                "itemDetails.$.stockQuantity": -item["quantity"],
                                "itemDetails.$.returnedQuantity": item["quantity"]
                            }
                        }
                    )
            
            grn_collection.update_one(
                {"_id": ObjectId(request.documentId)},
                {
                    "$inc": {"totalDebitAmount": net_amount},
                    "$set": {
                        "lastUpdatedDate": current_time,
                        "hasDebitCreditNotes": True
                    }
                }
            )
        else:
            # For amount-only notes, update source document WITHOUT modifying financial amounts
            await update_source_document_for_debit_note(tenant_id,
                request.documentType,
                request.documentId,
                net_amount,
                current_time
            )
        
        logger.info(f"Created Debit/Credit Note {note_id} (MongoDB ID: {mongo_id}) for {request.documentType}")
        
        return DebitNoteResponse(
            noteId=note_id,
            message=f"Debit/Credit Note created successfully",
            totalAmount=total_debit_amount if request.documentType != "grn" else None,
            totalDebitAmount=total_debit_amount,
            totalCreditAmount=total_credit_amount,
            netAmount=net_amount,
            itemsProcessed=items_processed,
            remainingPayableAmount=debit_note.get("remainingPayableAmount"),
            noteNumber=note_id,  # Add note number to response
            sourceDocument={
                "documentType": request.documentType,
                "documentId": request.documentId,
                "randomId": source_document.get("randomId"),
                "vendorName": source_document.get("vendorName")
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Debit/Credit Note: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/returnprocess/DebitCreditNote/debit-history/{document_id}")
async def get_debit_note_history(http_request: Request,
    document_id: str,
    status: Optional[str] = Query(None, description="Filter by status (Active, Cleared, etc.)")
):
    tenant_id = http_request.state.tenant_id
    """
    Get history of all debit notes for a specific document
    """
    try:
        if not is_valid_object_id(document_id):
            raise HTTPException(status_code=400, detail="Invalid Document ID format")
        
        # Build query for debit notes
        query = {
            "$or": [
                {"documentId": document_id},
                {"grnId": document_id},
                {"apInvoiceId": document_id},
                {"outgoingPaymentId": document_id}
            ]
        }
        
        # Add status filter if provided
        if status:
            query["status"] = status
        
        # Fetch debit notes
        debit_notes = list(get_debit_collection(tenant_id).find(query).sort("createdDate", DESCENDING))
        
        if not debit_notes:
            return {"history": [], "total_debit_amount": 0, "count": 0}
        
        history = []
        total_debit_amount = 0
        
        for note in debit_notes:
            # Sanitize note data first
            sanitized_note = sanitize_note_for_response(note)
            
            # Calculate note amount
            if sanitized_note.get("isAmountOnly") or sanitized_note.get("noteType") == "amount_only":
                note_amount = sanitized_note.get("totalAmount", sanitized_note.get("debitAmount", 0))
            else:
                note_amount = sanitized_note.get("netAmount", 0)
            
            total_debit_amount += note_amount
            
            # Create history entry
            history_entry = {
                "noteId": sanitized_note.get("noteId", str(sanitized_note["_id"])),  # Use sequential noteId if available
                "mongoId": str(sanitized_note["_id"]),  # MongoDB _id
                "documentId": sanitized_note.get("documentId", document_id),
                "documentType": sanitized_note.get("documentType", "unknown"),
                "totalAmount": note_amount,
                "status": sanitized_note.get("status", "Active"),
                "createdDate": sanitized_note.get("createdDate"),
                "createdBy": sanitized_note.get("createdBy", "system-user"),
                "reason": sanitized_note.get("reason"),
                "noteType": sanitized_note.get("noteType"),
                "randomId": sanitized_note.get("randomId"),
                "isAmountOnly": sanitized_note.get("isAmountOnly", False),
                "noteNumber": sanitized_note.get("noteId")  # Add note number
            }
            
            history.append(history_entry)
        
        return {
            "history": history,
            "total_debit_amount": total_debit_amount,
            "count": len(debit_notes),
            "document_id": document_id
        }
        
    except Exception as e:
        logger.error(f"Error fetching debit note history: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/returnprocess/DebitCreditNote/by-document/{document_id}", response_model=List[DebitNote])
async def get_debit_credit_notes_by_document(request:Request,
    document_id: str,
    skip: int = Query(0, ge=0, title="Skip", description="Number of records to skip for pagination"),
    limit: int = Query(50, le=5000, title="Limit", description="Maximum number of records to return"),user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))
):
    tenant_id = request.state.tenant_id
    """Retrieve Debit/Credit Notes by GRN, AP Invoice, or Outgoing Payment ID"""
    try:
        if not is_valid_object_id(document_id):
            # Try to find by randomId or noteId
            debit_collection = get_debit_collection(tenant_id)
            
            # First check if it's a randomId
            note_by_random = debit_collection.find_one({"randomId": document_id})
            if note_by_random:
                # If found by randomId, use its documentId to find all related notes
                actual_document_id = note_by_random.get("documentId") or note_by_random.get("grnId") or note_by_random.get("outgoingPaymentId") or note_by_random.get("apInvoiceId")
                if actual_document_id:
                    document_id = actual_document_id
            
            # Also check if it's a noteId
            note_by_noteid = debit_collection.find_one({"noteId": document_id})
            if note_by_noteid:
                actual_document_id = note_by_noteid.get("documentId") or note_by_noteid.get("grnId") or note_by_noteid.get("outgoingPaymentId") or note_by_noteid.get("apInvoiceId")
                if actual_document_id:
                    document_id = actual_document_id
        
        # Build COMPREHENSIVE query for debit notes
        # Search in ALL possible document reference fields
        query = {
            "$or": [
                {"documentId": document_id},
                {"grnId": document_id},
                {"apInvoiceId": document_id},
                {"outgoingPaymentId": document_id},
                # For amount-only notes, also check these fields
                {"sourceDocumentId": document_id},
                {"sourceDocument.id": document_id},
                # Check for randomId matching
                {"randomId": document_id},
                # Check for noteId matching
                {"noteId": document_id}
            ]
        }
        
        notes_cursor = get_debit_collection(tenant_id).find(query).sort("createdDate", DESCENDING).skip(skip).limit(limit)
        notes = list(notes_cursor)
        
        if not notes:
            logger.info(f"No DebitCreditNotes found for document_id: {document_id}")
            return []
        
        formatted_notes = []
        current_date = get_current_date_and_time()
        
        for note in notes:
            if "_id" not in note:
                logger.warning(f"Skipping DebitCreditNote with missing _id: {note}")
                continue
            
            # SANITIZE THE NOTE FIRST - THIS IS CRITICAL
            sanitized_note = sanitize_note_for_response(note)
            
            # For amount-only notes, ensure we have proper itemDetails
            is_amount_only = sanitized_note.get("isAmountOnly", False) or sanitized_note.get("noteType") == "amount_only"
            
            if is_amount_only and (not sanitized_note.get("itemDetails") or len(sanitized_note["itemDetails"]) == 0):
                # Create a dummy item for amount-only notes
                sanitized_note["itemDetails"] = [{
                    "itemId": sanitized_note.get("documentId", sanitized_note["_id"]),
                    "itemName": f"Amount Adjustment - {sanitized_note.get('reason', 'Discount/Return')}",
                    "noteType": sanitized_note.get("noteType", "debit"),
                    "quantity": 1,
                    "uom": "NOS",
                    "unitPrice": sanitized_note.get("totalAmount", sanitized_note.get("debitAmount", 0)),
                    "totalPrice": sanitized_note.get("totalAmount", sanitized_note.get("debitAmount", 0)),
                    "finalPrice": sanitized_note.get("totalAmount", sanitized_note.get("debitAmount", 0)),
                    "reason": sanitized_note.get("reason", ""),
                    "isAmountOnly": True,
                    "taxAmount": 0.0,
                    "discountAmount": 0.0,
                    "taxPercentage": 0.0,
                    "discountPercentage": 0.0
                }]
            
            # Calculate aging days
            selected_date = sanitized_note.get("createdDate")
            if selected_date and isinstance(selected_date, datetime):
                try:
                    sanitized_note["formattedCreatedDate"] = selected_date.strftime("%d %B %Y")
                    days_diff = (current_date - selected_date.replace(tzinfo=pytz.timezone("Asia/Kolkata"))).days
                    sanitized_note["agingDay"] = days_diff
                except Exception as e:
                    logger.warning(f"Invalid date format for createdDate in DebitCreditNote {sanitized_note['noteId']}: {str(e)}")
                    sanitized_note["agingDay"] = None
                    sanitized_note["formattedCreatedDate"] = None
            else:
                sanitized_note["agingDay"] = None
                sanitized_note["formattedCreatedDate"] = None
            
            # Ensure itemDetails is a list
            if "itemDetails" not in sanitized_note or not isinstance(sanitized_note["itemDetails"], list):
                sanitized_note["itemDetails"] = []
            
            # Add missing fields for Pydantic model
            if "documentId" not in sanitized_note:
                sanitized_note["documentId"] = document_id
            
            if "documentType" not in sanitized_note:
                # Try to infer from existing fields
                if sanitized_note.get("grnId"):
                    sanitized_note["documentType"] = "grn"
                elif sanitized_note.get("apInvoiceId"):
                    sanitized_note["documentType"] = "ap_invoice"
                elif sanitized_note.get("outgoingPaymentId"):
                    sanitized_note["documentType"] = "outgoing_payment"
                else:
                    sanitized_note["documentType"] = "unknown"
            
            if "isAmountOnly" not in sanitized_note:
                sanitized_note["isAmountOnly"] = is_amount_only
            
            if "remainingPayableAmount" not in sanitized_note:
                sanitized_note["remainingPayableAmount"] = None
            
            try:
                formatted_notes.append(DebitNote(**sanitized_note))
            except Exception as e:
                logger.error(f"Pydantic validation failed for DebitCreditNote {sanitized_note.get('noteId', 'unknown')}: {str(e)}")
                # Create a minimal valid note
                try:
                    minimal_note = {
                        "_id": str(sanitized_note.get("_id", ObjectId())),
                        "noteId": sanitized_note.get("noteId", str(sanitized_note.get("_id", ObjectId()))),
                        "grnId": sanitized_note.get("grnId", document_id),
                        "vendorName": sanitized_note.get("vendorName", "Unknown Vendor"),
                        "itemDetails": sanitized_note.get("itemDetails", []),
                        "createdDate": sanitized_note.get("createdDate", datetime.now()),
                        "createdBy": sanitized_note.get("createdBy", "system"),
                        "lastUpdatedDate": sanitized_note.get("lastUpdatedDate", datetime.now()),
                        "totalAmount": sanitized_note.get("totalAmount", 0.0),
                        "totalTax": sanitized_note.get("totalTax", 0.0),
                        "totalDiscount": sanitized_note.get("totalDiscount", 0.0),
                        "finalAmount": sanitized_note.get("finalAmount", sanitized_note.get("totalAmount", 0.0)),
                        "noteType": sanitized_note.get("noteType", "debit"),
                        "status": sanitized_note.get("status", "Active"),
                        "returnDate": sanitized_note.get("returnDate", datetime.now().isoformat()),
                        "randomId": sanitized_note.get("randomId", sanitized_note.get("noteId", str(sanitized_note.get("_id", ObjectId())))),
                        "clearedAgainstOutgoing": sanitized_note.get("clearedAgainstOutgoing"),
                        "clearedBy": sanitized_note.get("clearedBy"),
                        "clearedDate": sanitized_note.get("clearedDate"),
                        "paymentHistory": sanitized_note.get("paymentHistory", []),
                        "pendingAmount": sanitized_note.get("pendingAmount", 0.0),
                        "formattedCreatedDate": sanitized_note.get("formattedCreatedDate"),
                        "agingDay": sanitized_note.get("agingDay"),
                        "documentId": sanitized_note.get("documentId", document_id),
                        "documentType": sanitized_note.get("documentType", "unknown"),
                        "isAmountOnly": sanitized_note.get("isAmountOnly", False),
                        "remainingPayableAmount": sanitized_note.get("remainingPayableAmount")
                    }
                    formatted_notes.append(DebitNote(**minimal_note))
                except Exception as e2:
                    logger.error(f"Failed to create minimal note: {str(e2)}")
                    continue
        
        logger.info(f"Returning {len(formatted_notes)} DebitCreditNotes for document_id: {document_id}")
        return formatted_notes
    
    except Exception as e:
        logger.error(f"Internal Server Error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/vendor/{vendor_name}/active-debits")
async def get_vendor_active_debits(request:Request,vendor_name: str,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))):
    tenant_id = request.state.tenant_id
    debit_collection = get_debit_collection(tenant_id)
    
    debits = list(debit_collection.find({
        "vendorName": vendor_name,
        "status": {"$in": ["Active", "Partially Cleared"]}
    }))
    
    if not debits:
        logger.info(f"No active debits found for vendor: {vendor_name}")
        return {"debits": []}
    
    # Sanitize each debit note
    sanitized_debits = []
    for debit in debits:
        try:
            sanitized = sanitize_note_for_response(debit)
            sanitized["_id"] = str(sanitized["_id"])
            sanitized_debits.append(sanitized)
        except Exception as e:
            logger.error(f"Error sanitizing debit note: {str(e)}")
            continue
    
    return {"debits": sanitized_debits}


@router.get("/multiplevendors/active-debits")
async def get_multiple_vendors_active_debits(request:Request,vendor_names: str = Query(..., description="Comma-separated vendor names"),user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "grns", "read"))):
    tenant_id = request.state.tenant_id
    debit_collection = get_debit_collection(tenant_id)
    
    # Split comma-separated vendor names
    vendor_list = [name.strip() for name in vendor_names.split(',')]
    
    debits = list(debit_collection.find({
        "vendorName": {"$in": vendor_list},
        "status": {"$in": ["Active", "Partially Cleared"]}
    }))
    
    # Sanitize each debit note
    sanitized_debits = []
    for debit in debits:
        try:
            sanitized = sanitize_note_for_response(debit)
            sanitized["_id"] = str(sanitized["_id"])
            sanitized_debits.append(sanitized)
        except Exception as e:
            logger.error(f"Error sanitizing debit note: {str(e)}")
            continue
    
    return {"debits": sanitized_debits}


# ============================================
# DEBIT NOTE STATUS MANAGEMENT
# ============================================

@router.post("/returnprocess/DebitCreditNote/{note_id}/clear")
async def clear_debit_note(request:Request,
    note_id: str,
    outgoing_payment_id: Optional[str] = Query(None, description="ID of outgoing payment that clears this debit"),
    cleared_by: str = Query(..., description="Username who cleared the debit note")
):
    tenant_id = request.state.tenant_id
    """
    Mark a debit note as cleared against an outgoing payment
    """
    try:
        debit_collection = get_debit_collection(tenant_id)
        
        # Find the debit note
        note = debit_collection.find_one({"noteId": note_id})
        if not note:
            # Try by MongoDB _id
            if is_valid_object_id(note_id):
                note = debit_collection.find_one({"_id": ObjectId(note_id)})
        
        if not note:
            raise HTTPException(status_code=404, detail="Debit note not found")
        
        # Check if already cleared
        if note.get("status") == "Cleared":
            raise HTTPException(status_code=400, detail="Debit note is already cleared")
        
        current_time = get_current_date_and_time()
        
        # Update the debit note
        update_data = {
            "$set": {
                "status": "Cleared",
                "clearedAgainstOutgoing": outgoing_payment_id,
                "clearedBy": cleared_by,
                "clearedDate": current_time,
                "lastUpdatedDate": current_time,
                "pendingAmount": 0.0
            }
        }
        
        # Add to payment history
        payment_history = note.get("paymentHistory", [])
        payment_history.append({
            "date": current_time,
            "outgoingPaymentId": outgoing_payment_id,
            "clearedBy": cleared_by,
            "amount": note.get("finalAmount", note.get("totalAmount", 0))
        })
        
        update_data["$set"]["paymentHistory"] = payment_history
        
        result = debit_collection.update_one(
            {"_id": ObjectId(str(note["_id"]))},
            update_data
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update debit note")
        
        logger.info(f"Debit note {note_id} cleared by {cleared_by} against outgoing {outgoing_payment_id}")
        
        return {
            "success": True,
            "message": "Debit note cleared successfully",
            "noteId": note_id,
            "clearedDate": current_time.isoformat(),
            "clearedBy": cleared_by,
            "outgoingPaymentId": outgoing_payment_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing debit note: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/returnprocess/DebitCreditNote/{note_id}/details")
async def get_debit_note_details(request:Request,note_id: str):
    tenant_id = request.state.tenant_id
    """
    Get detailed information about a specific debit note
    """
    try:
        debit_collection = get_debit_collection(tenant_id)
        
        # Find the debit note
        note = debit_collection.find_one({"noteId": note_id})
        if not note:
            # Try by MongoDB _id
            if is_valid_object_id(note_id):
                note = debit_collection.find_one({"_id": ObjectId(note_id)})
        
        if not note:
            raise HTTPException(status_code=404, detail="Debit note not found")
        
        # Sanitize the note for response
        sanitized_note = sanitize_note_for_response(note)
        
        # Add additional details
        response_data = {
            "noteId": sanitized_note["noteId"],
            "mongoId": str(sanitized_note["_id"]),
            "vendorName": sanitized_note["vendorName"],
            "status": sanitized_note["status"],
            "createdDate": sanitized_note["createdDate"],
            "createdBy": sanitized_note["createdBy"],
            "totalAmount": sanitized_note["totalAmount"],
            "finalAmount": sanitized_note["finalAmount"],
            "noteType": sanitized_note["noteType"],
            "isAmountOnly": sanitized_note.get("isAmountOnly", False),
            "itemDetails": sanitized_note["itemDetails"],
            "paymentHistory": sanitized_note.get("paymentHistory", []),
            "pendingAmount": sanitized_note.get("pendingAmount", 0),
            "remainingPayableAmount": sanitized_note.get("remainingPayableAmount")
        }
        
        # Add clearance information if cleared
        if sanitized_note["status"] == "Cleared":
            response_data["clearance"] = {
                "clearedAgainstOutgoing": sanitized_note.get("clearedAgainstOutgoing"),
                "clearedBy": sanitized_note.get("clearedBy"),
                "clearedDate": sanitized_note.get("clearedDate")
            }
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error getting debit note details: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    
@router.get("/returnprocess/debitnotes/view/{document_id}", response_model=DebitNotesSummary)
async def get_debit_notes_comprehensive_view(request: Request, 
    document_id: str,
    include_cleared: bool = Query(True, description="Include cleared debit notes"),
    include_active: bool = Query(True, description="Include active debit notes")
):
    tenant_id = request.state.tenant_id
    """
    Get comprehensive view of all debit notes for a document
    Shows both amount-wise and item-wise debit notes with status and details
    """
    try:
        if not is_valid_object_id(document_id):
            # Try to find by randomId
            debit_collection = get_debit_collection(tenant_id)
            
            # First, try to find if this is a noteId
            note = debit_collection.find_one({"noteId": document_id})
            if note:
                # If it's a noteId, get the actual documentId
                document_id = note.get("documentId") or note.get("grnId") or note.get("apInvoiceId") or note.get("outgoingPaymentId")
                if not document_id:
                    raise HTTPException(status_code=400, detail="Could not determine source document ID")
            
            # Try to find by randomId in source documents
            else:
                grn_collection = get_grn_collection(tenant_id)
                grn = grn_collection.find_one({"randomId": document_id})
                if grn:
                    document_id = str(grn["_id"])
                
                else:
                    ap_collection = get_apinvoice_collection(tenant_id)
                    ap_invoice = ap_collection.find_one({"randomId": document_id})
                    if ap_invoice:
                        document_id = str(ap_invoice["_id"])
                    
                    else:
                        outgoing_collection = get_outgoingpayment_collection(tenant_id)
                        outgoing = outgoing_collection.find_one({"randomId": document_id})
                        if outgoing:
                            document_id = str(outgoing["_id"])
        
        # Get document type and details
        document_type, vendor_name, source_doc_ref = get_document_type_and_details(tenant_id,document_id)
        
        if document_type == "unknown":
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Build query for all debit notes related to this document
        query = {
            "$or": [
                {"documentId": document_id},
                {"grnId": document_id},
                {"apInvoiceId": document_id},
                {"outgoingPaymentId": document_id}
            ]
        }
        
        # Filter by status if requested
        status_filter = {}
        if not include_cleared and not include_active:
            raise HTTPException(status_code=400, detail="At least one of include_cleared or include_active must be True")
        
        if not include_cleared:
            status_filter = {"status": {"$ne": "Cleared"}}
        elif not include_active:
            status_filter = {"status": "Cleared"}
        
        if status_filter:
            query = {"$and": [query, status_filter]}
        
        # Fetch all debit notes
        debit_collection = get_debit_collection(tenant_id)
        all_notes_cursor = debit_collection.find(query).sort("createdDate", DESCENDING)
        all_notes = list(all_notes_cursor)
        
        if not all_notes:
            return DebitNotesSummary(
                documentId=document_id,
                documentType=document_type,
                totalActiveDebitNotes=0,
                totalClearedDebitNotes=0,
                totalAmount=0,
                totalPendingAmount=0,
                totalClearedAmount=0,
                activeDebitNotes=[],
                clearedDebitNotes=[]
            )
        
        current_datetime = get_current_date_and_time()
        
        # Separate active and cleared notes
        active_notes = []
        cleared_notes = []
        
        for note in all_notes:
            formatted_note = format_debit_note_for_view(tenant_id, note, current_datetime)
            
            if note.get("status") == "Cleared":
                cleared_notes.append(formatted_note)
            else:
                active_notes.append(formatted_note)
        
        # Calculate totals
        total_amount = 0
        total_pending_amount = 0
        total_cleared_amount = 0
        
        for note in all_notes:
            note_amount = note.get("finalAmount", note.get("totalAmount", 0))
            total_amount += note_amount
            
            if note.get("status") == "Cleared":
                total_cleared_amount += note_amount
            else:
                total_pending_amount += note.get("pendingAmount", note_amount)
        
        # Calculate available amount for new debit note
        total_existing_debit = total_amount
        available_for_new_debit = calculate_available_amount_for_new_debit(tenant_id,
            document_type, 
            document_id, 
            total_existing_debit
        )
        
        return DebitNotesSummary(
            documentId=document_id,
            documentType=document_type,
            totalActiveDebitNotes=len(active_notes),
            totalClearedDebitNotes=len(cleared_notes),
            totalAmount=round(total_amount, 2),
            totalPendingAmount=round(total_pending_amount, 2),
            totalClearedAmount=round(total_cleared_amount, 2),
            activeDebitNotes=active_notes,
            clearedDebitNotes=cleared_notes,
            availableForNewDebit=round(available_for_new_debit, 2)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting comprehensive debit notes view: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/returnprocess/debitnotes/summary/{vendor_name}")
async def get_vendor_debit_notes_summary(request:Request,vendor_name: str):
    tenant_id = request.state.tenant_id
    """
    Get summary of all debit notes for a vendor
    """
    try:
        debit_collection = get_debit_collection(tenant_id)
        
        # Get all debit notes for this vendor
        query = {"vendorName": vendor_name}
        all_notes = list(debit_collection.find(query).sort("createdDate", DESCENDING))
        
        if not all_notes:
            return {
                "vendorName": vendor_name,
                "totalDebitNotes": 0,
                "activeDebitNotes": 0,
                "clearedDebitNotes": 0,
                "totalAmount": 0,
                "pendingAmount": 0,
                "clearedAmount": 0,
                "notesByDocumentType": {},
                "recentNotes": []
            }
        
        # Categorize by status and document type
        summary = {
            "vendorName": vendor_name,
            "totalDebitNotes": len(all_notes),
            "activeDebitNotes": 0,
            "clearedDebitNotes": 0,
            "totalAmount": 0,
            "pendingAmount": 0,
            "clearedAmount": 0,
            "notesByDocumentType": {
                "grn": {"count": 0, "amount": 0},
                "ap_invoice": {"count": 0, "amount": 0},
                "outgoing_payment": {"count": 0, "amount": 0}
            },
            "recentNotes": []
        }
        
        current_datetime = get_current_date_and_time()
        
        # Process each note
        for note in all_notes[:10]:  # Get last 10 notes for recent list
            note_amount = note.get("finalAmount", note.get("totalAmount", 0))
            summary["totalAmount"] += note_amount
            
            # Count by status
            if note.get("status") == "Cleared":
                summary["clearedDebitNotes"] += 1
                summary["clearedAmount"] += note_amount
            else:
                summary["activeDebitNotes"] += 1
                summary["pendingAmount"] += note.get("pendingAmount", note_amount)
            
            # Count by document type
            doc_type = note.get("documentType", "unknown")
            if doc_type in summary["notesByDocumentType"]:
                summary["notesByDocumentType"][doc_type]["count"] += 1
                summary["notesByDocumentType"][doc_type]["amount"] += note_amount
            
            # Add to recent notes
            formatted_note = format_debit_note_for_view(tenant_id,note, current_datetime)
            summary["recentNotes"].append({
                "noteId": formatted_note.noteId,
                "documentType": formatted_note.documentType,
                "status": formatted_note.status,
                "amount": formatted_note.finalAmount,
                "createdDate": formatted_note.createdDateFormatted,
                "agingDays": formatted_note.agingDays
            })
        
        # Round all amounts
        for key in ["totalAmount", "pendingAmount", "clearedAmount"]:
            summary[key] = round(summary[key], 2)
        
        for doc_type in summary["notesByDocumentType"]:
            summary["notesByDocumentType"][doc_type]["amount"] = round(
                summary["notesByDocumentType"][doc_type]["amount"], 2
            )
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting vendor debit notes summary: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/returnprocess/debitnotes/comprehensive/{document_id}")
async def get_comprehensive_debit_notes(request:Request,
    document_id: str,
    include_cleared: bool = Query(True, description="Include cleared debit notes"),
    include_active: bool = Query(True, description="Include active debit notes")
):
    tenant_id = request.state.tenant_id
    """
    Get comprehensive view of ALL debit notes for a document
    Returns all notes (both item-wise and amount-only) with full details
    """
    try:
        if not is_valid_object_id(document_id):
            # Try to find by randomId or noteId
            debit_collection = get_debit_collection(tenant_id)
            
            # Try to find if this is a noteId
            note = debit_collection.find_one({"noteId": document_id})
            if note:
                document_id = note.get("documentId") or note.get("grnId") or note.get("apInvoiceId") or note.get("outgoingPaymentId")
                if not document_id:
                    raise HTTPException(status_code=400, detail="Could not determine source document ID")
            
            # Try by randomId
            else:
                grn_collection = get_grn_collection(tenant_id)
                grn = grn_collection.find_one({"randomId": document_id})
                if grn:
                    document_id = str(grn["_id"])
                
                else:
                    ap_collection = get_apinvoice_collection(tenant_id)
                    ap_invoice = ap_collection.find_one({"randomId": document_id})
                    if ap_invoice:
                        document_id = str(ap_invoice["_id"])
                    
                    else:
                        outgoing_collection = get_outgoingpayment_collection(tenant_id)
                        outgoing = outgoing_collection.find_one({"randomId": document_id})
                        if outgoing:
                            document_id = str(outgoing["_id"])
        
        # Get ALL debit notes for this document
        query = {
            "$or": [
                {"documentId": document_id},
                {"grnId": document_id},
                {"apInvoiceId": document_id},
                {"outgoingPaymentId": document_id}
            ]
        }
        
        # Filter by status if requested
        status_filter = {}
        if not include_cleared and not include_active:
            raise HTTPException(status_code=400, detail="At least one of include_cleared or include_active must be True")
        
        if not include_cleared:
            status_filter = {"status": {"$ne": "Cleared"}}
        elif not include_active:
            status_filter = {"status": "Cleared"}
        
        if status_filter:
            query = {"$and": [query, status_filter]}
        
        # Fetch ALL debit notes
        debit_collection = get_debit_collection(tenant_id)
        all_notes_cursor = debit_collection.find(query).sort("createdDate", DESCENDING)
        all_notes = list(all_notes_cursor)
        
        if not all_notes:
            return {
                "documentId": document_id,
                "totalNotes": 0,
                "itemWiseNotes": 0,
                "amountOnlyNotes": 0,
                "activeNotes": 0,
                "clearedNotes": 0,
                "totalAmount": 0,
                "pendingAmount": 0,
                "clearedAmount": 0,
                "notes": [],
                "summary": {
                    "documentId": document_id,
                    "documentType": "unknown",
                    "vendorName": "Unknown",
                    "totalActiveDebitNotes": 0,
                    "totalClearedDebitNotes": 0,
                    "totalAmount": 0,
                    "totalPendingAmount": 0,
                    "totalClearedAmount": 0
                }
            }
        
        # Format all notes
        current_datetime = get_current_date_and_time()
        formatted_notes = []
        
        for note in all_notes:
            formatted_note = format_debit_note_for_view(tenant_id,note, current_datetime)
            formatted_notes.append(formatted_note.dict())
        
        # Calculate statistics
        total_notes = len(formatted_notes)
        item_wise_count = sum(1 for n in formatted_notes if n.get("noteType") == "item_wise")
        amount_only_count = sum(1 for n in formatted_notes if n.get("noteType") == "amount_only")
        active_count = sum(1 for n in formatted_notes if n.get("status") != "Cleared")
        cleared_count = sum(1 for n in formatted_notes if n.get("status") == "Cleared")
        
        total_amount = sum(n.get("finalAmount", 0) for n in formatted_notes)
        pending_amount = sum(n.get("pendingAmount", 0) for n in formatted_notes)
        cleared_amount = sum(n.get("finalAmount", 0) for n in formatted_notes if n.get("status") == "Cleared")
        
        # Get document type and details
        doc_type, vendor_name, _ = get_document_type_and_details(tenant_id,document_id)
        
        # Calculate available amount for new debit note
        available_for_new = calculate_available_amount_for_new_debit(tenant_id,
            doc_type, 
            document_id, 
            total_amount
        )
        
        return {
            "documentId": document_id,
            "totalNotes": total_notes,
            "itemWiseNotes": item_wise_count,
            "amountOnlyNotes": amount_only_count,
            "activeNotes": active_count,
            "clearedNotes": cleared_count,
            "totalAmount": round(total_amount, 2),
            "pendingAmount": round(pending_amount, 2),
            "clearedAmount": round(cleared_amount, 2),
            "availableForNewDebit": round(available_for_new, 2),
            "notes": formatted_notes,
            "summary": {
                "documentId": document_id,
                "documentType": doc_type,
                "vendorName": vendor_name,
                "totalActiveDebitNotes": active_count,
                "totalClearedDebitNotes": cleared_count,
                "totalAmount": round(total_amount, 2),
                "totalPendingAmount": round(pending_amount, 2),
                "totalClearedAmount": round(cleared_amount, 2),
                "availableForNewDebit": round(available_for_new, 2)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting comprehensive debit notes: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/returnprocess/debitnotes/note/{note_id}")
async def get_specific_debit_note_details(request:Request,note_id: str):
    tenant_id = request.state.tenant_id
    """
    Get detailed information about a specific debit note
    """
    try:
        debit_collection = get_debit_collection(tenant_id)
        
        # Find the debit note
        note = debit_collection.find_one({"noteId": note_id})
        if not note:
            # Try by MongoDB _id
            if is_valid_object_id(note_id):
                note = debit_collection.find_one({"_id": ObjectId(note_id)})
        
        if not note:
            # Try by randomId
            note = debit_collection.find_one({"randomId": note_id})
        
        if not note:
            raise HTTPException(status_code=404, detail="Debit note not found")
        
        current_datetime = get_current_date_and_time()
        formatted_note = format_debit_note_for_view(tenant_id,note, current_datetime)
        
        # Add additional details
        response = formatted_note.dict()
        
        # Add source document details if available
        document_id = note.get("documentId")
        if document_id:
            doc_type, vendor_name, source_doc_ref = get_document_type_and_details(tenant_id,document_id)
            response["sourceDocument"] = {
                "id": document_id,
                "type": doc_type,
                "reference": source_doc_ref,
                "vendorName": vendor_name
            }
        
        # Add clearance details if cleared
        if note.get("status") == "Cleared":
            response["clearanceDetails"] = {
                "outgoingPaymentId": note.get("clearedAgainstOutgoing"),
                "clearedBy": note.get("clearedBy"),
                "clearedDate": note.get("clearedDate"),
                "paymentHistory": note.get("paymentHistory", [])
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting debit note details: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/returnprocess/debitnotes/status-counts")
async def get_debit_notes_status_counts(request:Request):
    tenant_id = request.state.tenant_id
    """
    Get counts of debit notes by status
    """
    try:
        debit_collection = get_debit_collection(tenant_id)
        
        # Aggregate counts by status
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "totalAmount": {"$sum": "$finalAmount"},
                    "avgAmount": {"$avg": "$finalAmount"}
                }
            }
        ]
        
        results = list(debit_collection.aggregate(pipeline))
        
        status_counts = {}
        for result in results:
            status = result["_id"] or "Unknown"
            status_counts[status] = {
                "count": result["count"],
                "totalAmount": round(result.get("totalAmount", 0), 2),
                "avgAmount": round(result.get("avgAmount", 0), 2)
            }
        
        # Get total counts
        total_count = debit_collection.count_documents({})
        
        return {
            "totalDebitNotes": total_count,
            "statusCounts": status_counts,
            "byDocumentType": {
                "grn": debit_collection.count_documents({"documentType": "grn"}),
                "ap_invoice": debit_collection.count_documents({"documentType": "ap_invoice"}),
                "outgoing_payment": debit_collection.count_documents({"documentType": "outgoing_payment"})
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting debit notes status counts: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
@router.get("/returnprocess/DebitCreditNote/pdf/{note_id}")
async def generate_debit_note_pdf(request:Request,note_id: str):
    tenant_id = request.state.tenant_id
    """
    Generate PDF for a specific debit/credit note
    """
    try:
        debit_collection = get_debit_collection(tenant_id)
        
        # Find the debit note
        note = debit_collection.find_one({"noteId": note_id})
        if not note:
            # Try by MongoDB _id
            if is_valid_object_id(note_id):
                note = debit_collection.find_one({"_id": ObjectId(note_id)})
        
        if not note:
            # Try by randomId
            note = debit_collection.find_one({"randomId": note_id})
        
        if not note:
            raise HTTPException(status_code=404, detail="Debit note not found")
        
        # Sanitize the note
        sanitized_note = sanitize_note_for_response(note)
        
        # Generate PDF content
        pdf_content = generate_debit_note_pdf_content(sanitized_note)
        
        # Prepare response
        filename = f"DebitNote_{sanitized_note.get('noteId', note_id)}.pdf"
        
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@router.get("/returnprocess/DebitCreditNote/pdf-all/{document_id}")
async def generate_all_debit_notes_pdf(request:Request,document_id: str):
    tenant_id = request.state.tenant_id
    """
    Generate PDF containing all debit notes for a document
    """
    try:
        # Build query for all debit notes
        query = {
            "$or": [
                {"documentId": document_id},
                {"grnId": document_id},
                {"apInvoiceId": document_id},
                {"outgoingPaymentId": document_id}
            ]
        }
        
        # Fetch all debit notes
        debit_collection = get_debit_collection(tenant_id)
        all_notes = list(debit_collection.find(query).sort("createdDate", DESCENDING))
        
        if not all_notes:
            raise HTTPException(status_code=404, detail="No debit notes found for this document")
        
        # Get document info
        document_type, vendor_name, _ = get_document_type_and_details(tenant_id,document_id)
        
        # Generate PDF content
        pdf_content = generate_all_notes_pdf_content(
            all_notes, 
            document_id, 
            document_type, 
            vendor_name
        )
        
        # Prepare response
        filename = f"All_DebitNotes_{document_id}.pdf"
        
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF for all notes: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
