# File: debitnote/routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status,Request
from fastapi.responses import FileResponse
from fastapi.responses import  StreamingResponse
import io
from pydantic import BaseModel, Field, validator
from typing import List, Literal, Optional, Dict, Any, Union
from pymongo import DESCENDING
from bson import ObjectId
import pymongo
import logging
import traceback
from datetime import datetime, date
import pytz
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
import tempfile
import requests
import re
from ast import parse
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from utils.database import get_apinvoice_collection,get_outgoingpayment_collection,get_debit_collection,get_grn_collection
from .utils import (
    get_current_ist_datetime,is_valid_object_id
)
from .debitmodels import DebitNote, DebitNoteResponse
from grn.debitnoteutils import calculate_available_amount_for_new_debit, check_debit_note_availability, format_debit_note_for_view, generate_debit_note_number, get_current_date_and_time, get_document_type_and_details, sanitize_note_for_response, update_source_document_for_debit_note
from grn.pdfutils import generate_all_notes_pdf_content, generate_debit_note_pdf_content
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================
# MODELS
# ============================================

class DebitCreditItemRequest(BaseModel):
    itemId: str = Field(..., description="Item ID from source document")
    itemName: Optional[str] = None
    noteType: Optional[str] = None
    quantity: float = Field(..., gt=0, description="Quantity for the note")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for this debit/credit")

    class Config:
        json_encoders = {float: lambda v: round(v, 2)}


class CreateDebitNoteRequest(BaseModel):
    documentId: str = Field(..., description="ID of source document")
    documentType: Literal["grn", "ap_invoice", "outgoing_payment"] = Field(..., description="Type of source document")
    items: List[DebitCreditItemRequest] = Field(..., min_items=1)
    createdBy: str = Field(..., min_length=1)
    comments: Optional[str] = None


class CreateAmountDebitNoteRequest(BaseModel):
    documentId: str = Field(..., description="ID of source document")
    documentType: Literal["grn", "ap_invoice", "outgoing_payment"] = Field(..., description="Type of source document")
    totalAmount: float = Field(..., gt=0, description="Total debit amount")
    createdBy: str = Field(..., min_length=1)
    reason: Optional[str] = Field(None, max_length=500, description="Reason for debit")
    comments: Optional[str] = None


class DebitNoteHistory(BaseModel):
    noteId: str
    documentId: str
    documentType: str
    totalAmount: float
    status: str
    createdDate: datetime
    createdBy: str
    remainingPayableAmount: float
    reason: Optional[str] = None
    noteNumber: Optional[str] = None  # Added for sequential note number


# ============================================
# UTILITY FUNCTIONS
# ============================================

def get_current_date_and_time_from_api() -> datetime:
    """
    Fetch current date and time from API and return as datetime object with IST timezone
    Returns: datetime object with timezone (Asia/Kolkata) in format: 2026-01-13T12:44:00+05:30
    """
    try:
        response = requests.get("https://yenerp.com/liveapi/datetime", timeout=5)
        response.raise_for_status()
        data = response.json()
        
        date_str = data.get("current_date", "")  # e.g., "13-01-2026"
        time_str = data.get("current_time", "")  # e.g., "12:44 PM"
        
        if not date_str or not time_str:
            raise ValueError("Invalid response from date/time API")
        
        # Parse date (DD-MM-YYYY format)
        day, month, year = map(int, date_str.split('-'))
        
        # Parse time (HH:MM AM/PM format)
        if "AM" in time_str.upper() or "PM" in time_str.upper():
            time_part = time_str.split()[0]
            hour, minute = map(int, time_part.split(':'))
            
            # Convert to 24-hour format
            time_upper = time_str.upper()
            if "PM" in time_upper and hour != 12:
                hour += 12
            elif "AM" in time_upper and hour == 12:
                hour = 0
        else:
            # If time is already in 24-hour format
            hour, minute = map(int, time_str.split(':'))
        
        # Create datetime object with Asia/Kolkata timezone
        ist_tz = pytz.timezone("Asia/Kolkata")
        current_dt = ist_tz.localize(datetime(
            year=year,
            month=month,
            day=day,
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0
        ))
        
        logger.info(f"Fetched datetime from API: {current_dt.isoformat()}")
        return current_dt
        
    except Exception as e:
        logger.error(f"Failed to fetch date/time from API: {str(e)}. Using local time.")
        # Fallback to local time with timezone
        ist_tz = pytz.timezone("Asia/Kolkata")
        return ist_tz.localize(datetime.now())


def get_current_date_and_time() -> datetime:
    """
    Get current date and time as datetime object with IST timezone
    """
    return get_current_date_and_time_from_api()


def normalize_payment_status(status: str) -> str:
    if not status:
        return ""
    return " ".join(status.strip().split()).lower()


# ============================================
# HELPER FUNCTIONS - DEBIT NOTE NUMBER GENERATION
# ============================================

def generate_debit_note_number(tenant_id) -> str:
    """
    Generate CONTINUOUS sequential debit note number for ALL note types.
    
    Returns: NOTE1, NOTE2, NOTE3, etc. in a single unified sequence
    
    This ensures both item-wise and amount-wise notes share the same sequence.
    Example: If last note is NOTE5, next note will be NOTE6 (regardless of type)
    """
    try:
        debit_collection = get_debit_collection(tenant_id)
        
        # Find the highest noteId with pattern NOTE<number>
        # Use aggregation pipeline for more reliable max finding
        pipeline = [
            {
                "$match": {
                    "noteId": {"$regex": "^NOTE\\d+$"}  # Match NOTE followed by digits
                }
            },
            {
                "$project": {
                    "noteId": 1,
                    "numericPart": {
                        "$toInt": {
                            "$substr": ["$noteId", 4, -1]  # Extract number after "NOTE"
                        }
                    }
                }
            },
            {
                "$sort": {"numericPart": -1}
            },
            {
                "$limit": 1
            }
        ]
        
        result = list(debit_collection.aggregate(pipeline))
        
        # Determine next number
        if result:
            max_number = result[0].get("numericPart", 0)
            logger.info(f"Found highest noteId: {result[0].get('noteId')} (number: {max_number})")
        else:
            max_number = 0
            logger.info("No existing noteIds found, starting from NOTE1")
        
        next_number = max_number + 1
        new_note_id = f"NOTE{next_number}"
        
        # Safety check: Verify uniqueness (handles race conditions)
        retry_count = 0
        max_retries = 10
        
        while debit_collection.count_documents({"noteId": new_note_id}) > 0:
            logger.warning(f"noteId {new_note_id} already exists, incrementing...")
            next_number += 1
            new_note_id = f"NOTE{next_number}"
            retry_count += 1
            
            if retry_count >= max_retries:
                logger.error(f"Failed to generate unique noteId after {max_retries} retries")
                # Fallback to timestamp-based ID
                timestamp = int(datetime.now().timestamp())
                new_note_id = f"NOTE{timestamp}"
                logger.warning(f"Using timestamp-based fallback: {new_note_id}")
                break
        
        logger.info(f"✓ Generated new noteId: {new_note_id} (previous max: NOTE{max_number})")
        return new_note_id
        
    except Exception as e:
        logger.error(f"Error in generate_debit_note_number: {str(e)}\n{traceback.format_exc()}")
        # Emergency fallback: timestamp-based ID
        timestamp_id = f"NOTE{int(datetime.now().timestamp())}"
        logger.error(f"Emergency fallback noteId: {timestamp_id}")
        return timestamp_id


# ============================================
# HELPER FUNCTIONS - DEBIT NOTE VALIDATION
# ============================================

async def check_debit_note_availability(
    tenant_id: str,
    document_type: str,
    document_id: str,
    requested_amount: float
) -> Dict[str, Any]:
    """
    Check if a debit note can be created for the given document.
    
    For outgoing_payment: Check available payable amount
    For grn/ap_invoice: Check existing debit notes and available amount
    """
    try:
        debit_collection = get_debit_collection(tenant_id)
        
        # Count existing debit notes for this document
        existing_notes_query = {
            "$or": [
                {"documentId": document_id},
                {"grnId": document_id},
                {"apInvoiceId": document_id},
                {"outgoingPaymentId": document_id}
            ]
        }
        
        existing_notes_count = debit_collection.count_documents(existing_notes_query)
        
        # Fetch source document
        source_doc = None
        original_available = 0
        total_existing_debit = 0
        
        if document_type == "outgoing_payment":
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            source_doc = outgoing_collection.find_one({"_id": ObjectId(document_id)})
            if not source_doc:
                return {
                    "can_create": False,
                    "message": "Outgoing payment not found",
                    "available_amount": 0,
                    "existing_notes_count": existing_notes_count
                }
            
            # Get payable amount from outgoing
            original_payable = source_doc.get("payableAmount", 0)
            total_payable = source_doc.get("totalPayableAmount", original_payable)
            
            # Calculate total existing debit for this document
            existing_notes = list(debit_collection.find(existing_notes_query))
            for note in existing_notes:
                if note.get("isAmountOnly") or note.get("noteType") == "amount_only":
                    total_existing_debit += note.get("totalAmount", note.get("debitAmount", 0))
                else:
                    total_existing_debit += note.get("netAmount", 0)
            
            # Available amount = total payable - existing debits
            available_amount = total_payable - total_existing_debit
            
            if requested_amount > available_amount:
                return {
                    "can_create": False,
                    "message": f"Requested amount {requested_amount} exceeds available amount {available_amount}",
                    "available_amount": available_amount,
                    "existing_notes_count": existing_notes_count,
                    "total_existing_debit": total_existing_debit,
                    "original_available": total_payable,
                    "remaining_available": available_amount - requested_amount
                }
            
            return {
                "can_create": True,
                "message": "Amount available for debit note",
                "available_amount": available_amount,
                "existing_notes_count": existing_notes_count,
                "total_existing_debit": total_existing_debit,
                "original_available": total_payable,
                "remaining_available": available_amount - requested_amount
            }
            
        elif document_type == "grn":
            grn_collection = get_grn_collection(tenant_id)
            source_doc = grn_collection.find_one({"_id": ObjectId(document_id)})
            if not source_doc:
                return {
                    "can_create": False,
                    "message": "GRN not found",
                    "available_amount": 0,
                    "existing_notes_count": existing_notes_count
                }
            
            # For GRN, we need to check item-level availability
            return {
                "can_create": True,
                "message": "GRN debit note validation passed at item level",
                "existing_notes_count": existing_notes_count
            }
            
        elif document_type == "ap_invoice":
            ap_collection = get_apinvoice_collection(tenant_id)
            source_doc = ap_collection.find_one({"_id": ObjectId(document_id)})
            if not source_doc:
                return {
                    "can_create": False,
                    "message": "AP Invoice not found",
                    "available_amount": 0,
                    "existing_notes_count": existing_notes_count
                }
            
            # For AP Invoice, similar to outgoing payment
            invoice_amount = source_doc.get("invoiceAmount", 0)
            
            # Calculate total existing debit
            existing_notes = list(debit_collection.find(existing_notes_query))
            for note in existing_notes:
                if note.get("isAmountOnly") or note.get("noteType") == "amount_only":
                    total_existing_debit += note.get("totalAmount", note.get("debitAmount", 0))
                else:
                    total_existing_debit += note.get("netAmount", 0)
            
            available_amount = invoice_amount - total_existing_debit
            
            if requested_amount > available_amount:
                return {
                    "can_create": False,
                    "message": f"Requested amount {requested_amount} exceeds available amount {available_amount}",
                    "available_amount": available_amount,
                    "existing_notes_count": existing_notes_count,
                    "total_existing_debit": total_existing_debit,
                    "original_available": invoice_amount,
                    "remaining_available": available_amount - requested_amount
                }
            
            return {
                "can_create": True,
                "message": "Amount available for debit note",
                "available_amount": available_amount,
                "existing_notes_count": existing_notes_count,
                "total_existing_debit": total_existing_debit,
                "original_available": invoice_amount,
                "remaining_available": available_amount - requested_amount
            }
            
        else:
            return {
                "can_create": False,
                "message": f"Unsupported document type: {document_type}",
                "available_amount": 0,
                "existing_notes_count": existing_notes_count
            }
            
    except Exception as e:
        logger.error(f"Error checking debit note availability: {str(e)}\n{traceback.format_exc()}")
        return {
            "can_create": False,
            "message": f"Error checking availability: {str(e)}",
            "available_amount": 0,
            "existing_notes_count": 0
        }


async def update_source_document_for_debit_note(
    tenant_id:str,
    document_type: str,
    document_id: str,
    debit_amount: float,
    timestamp: datetime
) -> None:
    """
    Update source document when a debit note is created.
    For outgoing_payment: Update hasDebitCreditNotes flag only
    For grn/ap_invoice: Update hasDebitCreditNotes flag
    """
    try:
        if document_type == "outgoing_payment":
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            update_result = outgoing_collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$set": {
                        "hasDebitCreditNotes": True,
                        "lastUpdatedDate": timestamp
                    }
                }
            )
            logger.info(f"Updated outgoing payment {document_id} for debit note: {update_result.modified_count} modified")
            
        elif document_type == "grn":
            grn_collection = get_grn_collection(tenant_id)
            update_result = grn_collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$set": {
                        "hasDebitCreditNotes": True,
                        "lastUpdatedDate": timestamp
                    }
                }
            )
            logger.info(f"Updated GRN {document_id} for debit note: {update_result.modified_count} modified")
            
        elif document_type == "ap_invoice":
            ap_collection = get_apinvoice_collection(tenant_id)
            update_result = ap_collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$set": {
                        "hasDebitCreditNotes": True,
                        "lastUpdatedDate": timestamp
                    }
                }
            )
            logger.info(f"Updated AP invoice {document_id} for debit note: {update_result.modified_count} modified")
            
    except Exception as e:
        logger.error(f"Error updating source document for debit note: {str(e)}\n{traceback.format_exc()}")


# ============================================
# DATA SANITIZATION FUNCTIONS
# ============================================
def sanitize_note_for_response(note: dict) -> dict:
    """
    Ensure note has all required fields for Pydantic validation.
    Handles both item-wise and amount-only notes.
    """
    try:
        # Create a copy to avoid modifying original
        sanitized = note.copy()
        
        # Ensure _id exists and is string
        if "_id" not in sanitized:
            sanitized["_id"] = str(ObjectId())
        else:
            # Convert ObjectId to string if needed
            if isinstance(sanitized["_id"], ObjectId):
                sanitized["_id"] = str(sanitized["_id"])
        
        # Ensure noteId exists - use sequential noteId if available
        if "noteId" not in sanitized:
            sanitized["noteId"] = sanitized.get("randomId", str(sanitized["_id"]))
        
        # Determine note type
        is_amount_only = (
            sanitized.get("isAmountOnly", False) or 
            sanitized.get("noteType") == "amount_only" or
            sanitized.get("noteType") == "Amount Only" or
            (sanitized.get("itemDetails") and len(sanitized["itemDetails"]) == 0 and sanitized.get("totalAmount") > 0)
        )
        
        # Ensure itemDetails is a list
        if "itemDetails" not in sanitized or not isinstance(sanitized["itemDetails"], list):
            sanitized["itemDetails"] = []
        
        # For amount-only notes, create a dummy item if needed
        if is_amount_only and len(sanitized["itemDetails"]) == 0:
            sanitized["itemDetails"] = [{
                "itemId": sanitized.get("documentId", sanitized["_id"]),
                "itemName": f"Amount Adjustment - {sanitized.get('reason', 'Discount/Return')}",
                "noteType": sanitized.get("noteType", "debit"),
                "quantity": 1.0,
                "uom": "NOS",
                "unitPrice": sanitized.get("totalAmount", sanitized.get("debitAmount", 0)),
                "totalPrice": sanitized.get("totalAmount", sanitized.get("debitAmount", 0)),
                "finalPrice": sanitized.get("totalAmount", sanitized.get("debitAmount", 0)),
                "reason": sanitized.get("reason", ""),
                "isAmountOnly": True,
                "taxAmount": 0.0,
                "discountAmount": 0.0,
                "taxPercentage": 0.0,
                "discountPercentage": 0.0
            }]
        
        # Ensure item details have required fields
        for item in sanitized["itemDetails"]:
            if "uom" not in item:
                item["uom"] = "NOS"
            if "noteType" not in item:
                item["noteType"] = sanitized.get("noteType", "debit")
            if "isAmountOnly" not in item:
                item["isAmountOnly"] = is_amount_only
        
        # Ensure numeric fields exist with defaults
        numeric_fields = ["totalAmount", "totalTax", "totalDiscount", "finalAmount", "debitAmount"]
        for field in numeric_fields:
            if field not in sanitized or sanitized[field] is None:
                if field == "totalAmount" and is_amount_only:
                    sanitized[field] = sanitized.get("debitAmount", 0.0)
                else:
                    sanitized[field] = 0.0
        
        # Ensure finalAmount exists
        if "finalAmount" not in sanitized or sanitized["finalAmount"] is None:
            sanitized["finalAmount"] = sanitized.get("totalAmount", 0.0)
        
        # Ensure other required fields
        if "vendorName" not in sanitized:
            sanitized["vendorName"] = "Unknown Vendor"
        
        if "status" not in sanitized:
            sanitized["status"] = "Active"
        
        if "noteType" not in sanitized:
            sanitized["noteType"] = "debit" if is_amount_only else "item_wise"
        
        if "returnDate" not in sanitized:
            sanitized["returnDate"] = sanitized.get("createdDate", datetime.now()).isoformat()
        
        if "randomId" not in sanitized:
            sanitized["randomId"] = sanitized.get("noteId", str(sanitized["_id"]))
        
        # Ensure paymentHistory exists
        if "paymentHistory" not in sanitized:
            sanitized["paymentHistory"] = []
        
        # Ensure pendingAmount exists
        if "pendingAmount" not in sanitized:
            sanitized["pendingAmount"] = 0.0
        
        # Add fields for Pydantic model
        if "documentId" not in sanitized:
            sanitized["documentId"] = sanitized.get("grnId") or sanitized.get("outgoingPaymentId") or sanitized.get("apInvoiceId")
        
        if "documentType" not in sanitized:
            # Try to infer from existing fields
            if sanitized.get("grnId"):
                sanitized["documentType"] = "grn"
            elif sanitized.get("outgoingPaymentId"):
                sanitized["documentType"] = "outgoing_payment"
            elif sanitized.get("apInvoiceId"):
                sanitized["documentType"] = "ap_invoice"
            else:
                sanitized["documentType"] = "unknown"
        
        sanitized["isAmountOnly"] = is_amount_only
        
        if "remainingPayableAmount" not in sanitized:
            sanitized["remainingPayableAmount"] = None
        
        if "reason" not in sanitized:
            sanitized["reason"] = ""
        
        # Ensure createdDate and lastUpdatedDate are datetime objects
        if "createdDate" in sanitized and isinstance(sanitized["createdDate"], str):
            try:
                sanitized["createdDate"] = datetime.fromisoformat(sanitized["createdDate"].replace("Z", "+00:00"))
            except:
                sanitized["createdDate"] = datetime.now()
        
        if "lastUpdatedDate" in sanitized and isinstance(sanitized["lastUpdatedDate"], str):
            try:
                sanitized["lastUpdatedDate"] = datetime.fromisoformat(sanitized["lastUpdatedDate"].replace("Z", "+00:00"))
            except:
                sanitized["lastUpdatedDate"] = datetime.now()
        
        return sanitized
        
    except Exception as e:
        logger.error(f"Error sanitizing note: {str(e)}\n{traceback.format_exc()}")
        # Return minimal valid structure
        current_time = datetime.now()
        return {
            "_id": str(ObjectId()),
            "noteId": note.get("noteId", str(ObjectId())),
            "grnId": note.get("documentId", str(ObjectId())),
            "vendorName": "Unknown Vendor",
            "itemDetails": [],
            "createdDate": current_time,
            "createdBy": "system",
            "lastUpdatedDate": current_time,
            "totalAmount": note.get("totalAmount", 0.0),
            "totalTax": note.get("totalTax", 0.0),
            "totalDiscount": note.get("totalDiscount", 0.0),
            "finalAmount": note.get("totalAmount", note.get("finalAmount", 0.0)),
            "noteType": "debit",
            "status": "Active",
            "returnDate": current_time.isoformat(),
            "randomId": note.get("noteId", str(ObjectId())),
            "paymentHistory": [],
            "pendingAmount": 0.0,
            "documentId": note.get("documentId", str(ObjectId())),
            "documentType": "unknown",
            "isAmountOnly": True,
            "remainingPayableAmount": None,
            "reason": "",
            "debitAmount": note.get("debitAmount", 0.0)
        }
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
async def create_debit_credit_note(http_request: Request,request: CreateDebitNoteRequest,
    user = Depends(validate_token),
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
            availability_check = await check_debit_note_availability(
                tenant_id,
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
            await update_source_document_for_debit_note(
                tenant_id,
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
async def get_vendor_active_debits(request:Request,vendor_name: str,
    user = Depends(validate_token),
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
    document_type: str = Query(..., description="Type of document: grn, ap_invoice, or outgoing_payment"),
    include_cleared: bool = Query(True, description="Include cleared debit notes"),
    include_active: bool = Query(True, description="Include active debit notes")
):
    tenant_id = request.state.tenant_id
    """
    Get comprehensive view of ALL debit notes for a document
    WITH GRN CHAINING FOR AP INVOICES
    Returns cleaned response with noteId and source document reference
    """
    try:
        print(f"🔍 Comprehensive query for {document_type}: {document_id}")
        
        if document_type not in ["grn", "ap_invoice", "outgoing_payment"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid document_type: {document_type}"
            )
        
        # Get the actual document
        found_doc = None
        found_document_id = document_id
        vendor_name = ""
        source_doc_random_id = ""
        related_grn_id = None
        
        if document_type == "grn":
            grn_collection = get_grn_collection(tenant_id)
            # Try by ObjectId
            if len(document_id) == 24:
                try:
                    found_doc = grn_collection.find_one({"_id": ObjectId(document_id)})
                except:
                    pass
            # Try by randomId
            if not found_doc:
                found_doc = grn_collection.find_one({"randomId": document_id})
            
        elif document_type == "ap_invoice":
            ap_collection = get_apinvoice_collection(tenant_id)
            # Try by ObjectId
            if len(document_id) == 24:
                try:
                    found_doc = ap_collection.find_one({"_id": ObjectId(document_id)})
                except:
                    pass
            # Try by randomId
            if not found_doc:
                found_doc = ap_collection.find_one({"randomId": document_id})
            
            # For AP Invoice, get the GRN ID if it exists
            if found_doc:
                related_grn_id = found_doc.get("grnId")
                print(f"📌 AP Invoice has GRN ID: {related_grn_id}")
            
        elif document_type == "outgoing_payment":
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            # Try by ObjectId
            if len(document_id) == 24:
                try:
                    found_doc = outgoing_collection.find_one({"_id": ObjectId(document_id)})
                except:
                    pass
            # Try by randomId
            if not found_doc:
                found_doc = outgoing_collection.find_one({"randomId": document_id})
        
        if not found_doc:
            raise HTTPException(
                status_code=404,
                detail=f"{document_type.replace('_', ' ').title()} not found with ID: {document_id}"
            )
        
        # Get document details
        found_document_id = str(found_doc["_id"])
        vendor_name = found_doc.get("vendorName", "")
        source_doc_random_id = found_doc.get("randomId", "")
        
        print(f"✅ Found {document_type}: {source_doc_random_id}, Vendor: {vendor_name}")
        if related_grn_id:
            print(f"📌 Related GRN ID: {related_grn_id}")
        
        # Build COMPREHENSIVE query for debit notes
        debit_collection = get_debit_collection(tenant_id)
        query_conditions = []
        
        # Search by all possible references
        query_conditions.append({"documentId": found_document_id})
        query_conditions.append({"documentId": document_id})
        
        # Search by type-specific fields
        if document_type == "grn":
            query_conditions.append({"grnId": found_document_id})
            query_conditions.append({"grnId": document_id})
            
        elif document_type == "ap_invoice":
            query_conditions.append({"apInvoiceId": found_document_id})
            query_conditions.append({"apInvoiceId": document_id})
            
            # For AP Invoice, also search by its GRN ID
            if related_grn_id:
                print(f"🔍 Also searching debit notes by GRN ID: {related_grn_id}")
                query_conditions.append({"grnId": related_grn_id})
                
                # Also search by GRN documentId
                try:
                    grn_collection = get_grn_collection(tenant_id)
                    grn_doc = grn_collection.find_one({"_id": ObjectId(related_grn_id)})
                    if grn_doc:
                        grn_document_id = str(grn_doc["_id"])
                        query_conditions.append({"documentId": grn_document_id})
                        print(f"🔍 Also searching by GRN documentId: {grn_document_id}")
                except:
                    pass
                
        elif document_type == "outgoing_payment":
            query_conditions.append({"outgoingPaymentId": found_document_id})
            query_conditions.append({"outgoingPaymentId": document_id})
        
        # Build final query
        query = {"$or": query_conditions}
        print(f"🔍 Final query: {query}")
        
        # Filter by status if requested
        if not include_cleared and not include_active:
            raise HTTPException(status_code=400, detail="At least one of include_cleared or include_active must be True")
        
        if not include_cleared:
            query["status"] = {"$ne": "Cleared"}
        elif not include_active:
            query["status"] = "Cleared"
        
        # Execute query
        all_notes_cursor = debit_collection.find(query).sort("createdDate", DESCENDING)
        all_notes = list(all_notes_cursor)
        
        print(f"📊 Found {len(all_notes)} debit notes")
        
        # Calculate original document amount
        original_amount = 0
        try:
            if document_type == "grn":
                original_amount = found_doc.get("grandTotal", 0) or found_doc.get("totalReceivedAmount", 0) or 0
            elif document_type == "ap_invoice":
                original_amount = found_doc.get("invoiceAmount", 0) or found_doc.get("payableAmount", 0) or 0
            elif document_type == "outgoing_payment":
                original_amount = found_doc.get("totalPayableAmount", 0) or found_doc.get("payableAmount", 0) or 0
        except:
            original_amount = 0
        
        # Format notes
        current_datetime = get_current_date_and_time()
        formatted_notes = []
        total_amount = 0
        item_wise_count = 0
        amount_only_count = 0
        active_count = 0
        cleared_count = 0
        
        for note in all_notes:
            try:
                # Sanitize note first
                sanitized_note = sanitize_note_for_response(note)
                
                # Get noteId (sequential NOTE1, NOTE2, etc.)
                note_id = sanitized_note.get("noteId", "")
                
                # If noteId is missing or is ObjectId, generate a display ID
                if not note_id or len(note_id) == 24:
                    # Create a display ID based on timestamp or sequence
                    created_date = sanitized_note.get("createdDate", datetime.now())
                    if isinstance(created_date, str):
                        try:
                            created_date = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
                        except:
                            created_date = datetime.now()
                    note_id = f"DN-{created_date.strftime('%Y%m%d')}-{len(formatted_notes)+1}"
                
                # Calculate note amount
                if sanitized_note.get("isAmountOnly", False):
                    note_amount = sanitized_note.get("totalAmount", sanitized_note.get("debitAmount", 0))
                    note_type_display = "amount_only"
                    amount_only_count += 1
                else:
                    note_amount = sanitized_note.get("netAmount", sanitized_note.get("finalAmount", 0))
                    note_type_display = "item_wise"
                    item_wise_count += 1
                
                total_amount += note_amount
                
                # Determine status and count
                status = sanitized_note.get("status", "Active")
                if status == "Cleared":
                    cleared_count += 1
                else:
                    active_count += 1
                
                # Format created date
                created_date = sanitized_note.get("createdDate", datetime.now())
                if isinstance(created_date, str):
                    try:
                        created_date = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
                    except:
                        created_date = datetime.now()
                
                created_date_formatted = created_date.strftime("%d %B %Y")
                aging_days = (current_datetime - created_date).days
                
                # Get items
                items = []
                item_details = sanitized_note.get("itemDetails", [])
                if note_type_display == "amount_only":
                    # Single item for amount-only notes
                    items.append({
                        "itemName": f"Amount Adjustment - {sanitized_note.get('reason', 'Discount/Return')}",
                        "noteType": "debit",
                        "quantity": 1,
                        "unitPrice": note_amount,
                        "totalPrice": note_amount,
                        "finalPrice": note_amount,
                        "reason": sanitized_note.get("reason", ""),
                        "isAmountOnly": True
                    })
                elif item_details:
                    # Multiple items for item-wise notes
                    for item in item_details:
                        items.append({
                            "itemId": item.get("itemId", ""),
                            "itemName": item.get("itemName", ""),
                            "noteType": item.get("noteType", "debit"),
                            "quantity": item.get("quantity", 0),
                            "unitPrice": item.get("unitPrice", 0),
                            "totalPrice": item.get("totalPrice", 0),
                            "finalPrice": item.get("finalPrice", item.get("totalPrice", 0)),
                            "reason": item.get("reason", sanitized_note.get("reason", "")),
                            "isAmountOnly": item.get("isAmountOnly", False)
                        })
                
                # Build clean note response WITHOUT ObjectIds
                clean_note = {
                    "noteId": note_id,  # Sequential ID like NOTE1, NOTE2
                    "noteNumber": note_id,  # Same as noteId
                    "sourceDocumentRef": source_doc_random_id,  # Original document reference
                    "documentType": document_type,
                    "vendorName": vendor_name,
                    "status": status,
                    "noteType": note_type_display,
                    "isAmountOnly": note_type_display == "amount_only",
                    "totalAmount": round(note_amount, 2),
                    "finalAmount": round(note_amount, 2),
                    "pendingAmount": round(sanitized_note.get("pendingAmount", note_amount), 2),
                    "remainingPayableAmount": round(sanitized_note.get("remainingPayableAmount", 0), 2) if sanitized_note.get("remainingPayableAmount") else None,
                    "createdDate": created_date.isoformat(),
                    "createdBy": sanitized_note.get("createdBy", "system"),
                    "createdDateFormatted": created_date_formatted,
                    "agingDays": aging_days,
                    "clearedAgainstOutgoing": sanitized_note.get("clearedAgainstOutgoing"),
                    "clearedBy": sanitized_note.get("clearedBy"),
                    "clearedDate": sanitized_note.get("clearedDate"),
                    "items": items,
                    "paymentHistory": sanitized_note.get("paymentHistory", []),
                    "reason": sanitized_note.get("reason"),
                    "comments": sanitized_note.get("comments")
                }
                
                formatted_notes.append(clean_note)
                print(f"  - Note: {note_id} (Type: {note_type_display}, Amount: {note_amount})")
                
            except Exception as e:
                print(f"❌ Error formatting note: {str(e)}\n{traceback.format_exc()}")
                continue
        
        # Calculate available amount for new debit note
        available_for_new_debit = max(0, original_amount - total_amount)
        
        print(f"✅ Summary - Total: {total_amount}, Available: {available_for_new_debit}")
        
        # Return clean response
        return {
            "success": True,
            "sourceDocument": {
                "reference": source_doc_random_id,
                "type": document_type,
                "vendorName": vendor_name,
                "originalAmount": round(original_amount, 2)
            },
            "summary": {
                "totalNotes": len(formatted_notes),
                "itemWiseNotes": item_wise_count,
                "amountOnlyNotes": amount_only_count,
                "activeNotes": active_count,
                "clearedNotes": cleared_count,
                "totalDebitAmount": round(total_amount, 2),
                "availableForNewDebit": round(available_for_new_debit, 2),
                "remainingAmount": round(original_amount - total_amount, 2)
            },
            "notes": formatted_notes  # Contains only noteId, no ObjectIds
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_comprehensive_debit_notes: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    
@router.get("/returnprocess/debitnotes/for-ap-invoice/{ap_invoice_id}")
async def get_debit_notes_for_ap_invoice(request:Request,
    ap_invoice_id: str,
    include_cleared: bool = Query(True, description="Include cleared debit notes"),
    include_active: bool = Query(True, description="Include active debit notes")
):
    tenant_id = request.state.tenant_id
    """
    Get debit notes for AP Invoice (including through GRN chain)
    """
    try:
        print(f"🔍 Getting debit notes for AP Invoice: {ap_invoice_id}")
        
        ap_collection = get_apinvoice_collection(tenant_id)
        debit_collection = get_debit_collection(tenant_id)
        
        # Find AP Invoice
        ap_invoice = None
        # Try by ObjectId
        if len(ap_invoice_id) == 24:
            try:
                ap_invoice = ap_collection.find_one({"_id": ObjectId(ap_invoice_id)})
            except:
                pass
        # Try by randomId
        if not ap_invoice:
            ap_invoice = ap_collection.find_one({"randomId": ap_invoice_id})
        
        if not ap_invoice:
            raise HTTPException(status_code=404, detail="AP Invoice not found")
        
        ap_document_id = str(ap_invoice["_id"])
        vendor_name = ap_invoice.get("vendorName", "")
        random_id = ap_invoice.get("randomId", "")
        grn_id = ap_invoice.get("grnId")
        
        print(f"✅ Found AP Invoice: {random_id}, GRN ID: {grn_id}")
        
        # Build query - search by AP Invoice ID AND GRN ID
        query_conditions = []
        
        # Direct AP Invoice references
        query_conditions.append({"apInvoiceId": ap_document_id})
        query_conditions.append({"documentId": ap_document_id})
        
        # Also search by original query ID
        query_conditions.append({"apInvoiceId": ap_invoice_id})
        query_conditions.append({"documentId": ap_invoice_id})
        
        # Search by GRN ID if AP Invoice has one
        if grn_id:
            print(f"🔍 Searching debit notes by GRN ID: {grn_id}")
            query_conditions.append({"grnId": grn_id})
            
            # Also try to find GRN document ID
            grn_collection = get_grn_collection(tenant_id)
            grn_doc = grn_collection.find_one({"_id": ObjectId(grn_id)})
            if grn_doc:
                grn_document_id = str(grn_doc["_id"])
                query_conditions.append({"documentId": grn_document_id})
                print(f"🔍 Also searching by GRN documentId: {grn_document_id}")
        
        query = {"$or": query_conditions}
        print(f"🔍 Query: {query}")
        
        # Filter by status
        if not include_cleared and not include_active:
            raise HTTPException(status_code=400, detail="At least one of include_cleared or include_active must be True")
        
        if not include_cleared:
            query["status"] = {"$ne": "Cleared"}
        elif not include_active:
            query["status"] = "Cleared"
        
        # Execute query
        notes_cursor = debit_collection.find(query).sort("createdDate", DESCENDING)
        notes = list(notes_cursor)
        
        print(f"📊 Found {len(notes)} debit notes")
        
        # Format notes
        current_datetime = get_current_date_and_time()
        formatted_notes = []
        
        for note in notes:
            try:
                formatted_note = format_debit_note_for_view(tenant_id,note, current_datetime)
                formatted_notes.append(formatted_note.dict())
            except:
                continue
        
        # Calculate statistics
        total_amount = sum(n.get("finalAmount", 0) for n in formatted_notes)
        
        return {
            "documentId": ap_document_id,
            "documentType": "ap_invoice",
            "vendorName": vendor_name,
            "randomId": random_id,
            "grnId": grn_id,
            "notes": formatted_notes,
            "totalNotes": len(formatted_notes),
            "totalAmount": round(total_amount, 2),
            "searchMethod": "ap_invoice_with_grn_chain"
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
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
async def generate_all_debit_notes_pdf(request:Request,
    document_id: str,
    document_type: Optional[str] = Query(None, description="Type of document: grn, ap_invoice, or outgoing_payment")
):
    tenant_id = request.state.tenant_id
    """
    Generate PDF containing all debit notes for a document
    WITH COMPREHENSIVE SEARCH (like the comprehensive endpoint)
    """
    try:
        print(f"📄 Generating PDF for all debit notes for document: {document_id}")
        
        # If document_type is not provided, try to detect it
        if not document_type:
            print(f"⚠️ document_type not provided, attempting to detect...")
            # Try to detect document type
            collections = [
                ("grn", get_grn_collection(tenant_id)),
                ("ap_invoice", get_apinvoice_collection(tenant_id)),
                ("outgoing_payment", get_outgoingpayment_collection(tenant_id))
            ]
            
            for doc_type_name, collection in collections:
                # Try by ObjectId
                if len(document_id) == 24:
                    try:
                        doc = collection.find_one({"_id": ObjectId(document_id)})
                        if doc:
                            document_type = doc_type_name
                            print(f"✅ Detected document type: {document_type}")
                            break
                    except:
                        continue
                
                # Try by randomId
                doc = collection.find_one({"randomId": document_id})
                if doc:
                    document_type = doc_type_name
                    print(f"✅ Detected document type: {document_type}")
                    break
        
        # If still not detected, use get_document_type_and_details
        if not document_type or document_type not in ["grn", "ap_invoice", "outgoing_payment"]:
            document_type, vendor_name, random_id = get_document_type_and_details(tenant_id,document_id)
        
        print(f"📌 Final document type for PDF: {document_type}")
        
        # Build COMPREHENSIVE query like in the comprehensive endpoint
        query_conditions = []
        
        # Always search by documentId
        query_conditions.append({"documentId": document_id})
        
        # Search by type-specific fields
        if document_type == "grn":
            query_conditions.append({"grnId": document_id})
        elif document_type == "ap_invoice":
            query_conditions.append({"apInvoiceId": document_id})
            
            # For AP Invoice, also search by its GRN ID
            ap_collection = get_apinvoice_collection(tenant_id)
            ap_doc = None
            
            # Try by ObjectId
            if len(document_id) == 24:
                try:
                    ap_doc = ap_collection.find_one({"_id": ObjectId(document_id)})
                except:
                    pass
            
            # Try by randomId
            if not ap_doc:
                ap_doc = ap_collection.find_one({"randomId": document_id})
            
            if ap_doc:
                grn_id = ap_doc.get("grnId")
                if grn_id:
                    print(f"🔍 Also searching by GRN ID: {grn_id}")
                    query_conditions.append({"grnId": grn_id})
                    
                    # Also search by GRN documentId
                    try:
                        grn_collection = get_grn_collection(tenant_id)
                        grn_doc = grn_collection.find_one({"_id": ObjectId(grn_id)})
                        if grn_doc:
                            grn_document_id = str(grn_doc["_id"])
                            query_conditions.append({"documentId": grn_document_id})
                    except:
                        pass
                    
        elif document_type == "outgoing_payment":
            query_conditions.append({"outgoingPaymentId": document_id})
            
            # For outgoing payment, also search by AP Invoice and GRN
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            outgoing_doc = None
            
            # Try by ObjectId
            if len(document_id) == 24:
                try:
                    outgoing_doc = outgoing_collection.find_one({"_id": ObjectId(document_id)})
                except:
                    pass
            
            # Try by randomId
            if not outgoing_doc:
                outgoing_doc = outgoing_collection.find_one({"randomId": document_id})
            
            if outgoing_doc:
                ap_invoice_id = outgoing_doc.get("invoiceId")
                if ap_invoice_id:
                    # Search by AP Invoice
                    query_conditions.append({"apInvoiceId": ap_invoice_id})
                    
                    # Also get GRN from AP Invoice
                    ap_collection = get_apinvoice_collection(tenant_id)
                    ap_invoice = ap_collection.find_one({"_id": ObjectId(ap_invoice_id)})
                    if ap_invoice:
                        grn_id = ap_invoice.get("grnId")
                        if grn_id:
                            query_conditions.append({"grnId": grn_id})
        
        # Also search by vendor name for completeness
        # Get vendor name from source document
        vendor_name = ""
        try:
            if document_type == "grn":
                grn_collection = get_grn_collection(tenant_id)
                if len(document_id) == 24:
                    doc = grn_collection.find_one({"_id": ObjectId(document_id)})
                else:
                    doc = grn_collection.find_one({"randomId": document_id})
                if doc:
                    vendor_name = doc.get("vendorName", "")
            elif document_type == "ap_invoice":
                ap_collection = get_apinvoice_collection(tenant_id)
                if len(document_id) == 24:
                    doc = ap_collection.find_one({"_id": ObjectId(document_id)})
                else:
                    doc = ap_collection.find_one({"randomId": document_id})
                if doc:
                    vendor_name = doc.get("vendorName", "")
            elif document_type == "outgoing_payment":
                outgoing_collection = get_outgoingpayment_collection(tenant_id)
                if len(document_id) == 24:
                    doc = outgoing_collection.find_one({"_id": ObjectId(document_id)})
                else:
                    doc = outgoing_collection.find_one({"randomId": document_id})
                if doc:
                    vendor_name = doc.get("vendorName", "")
        except:
            pass
        
        if vendor_name:
            query_conditions.append({"vendorName": vendor_name})
        
        # Build final query
        query = {"$or": query_conditions}
        print(f"🔍 PDF generation query: {query}")
        
        # Fetch all debit notes
        debit_collection = get_debit_collection(tenant_id)
        all_notes = list(debit_collection.find(query).sort("createdDate", DESCENDING))
        
        if not all_notes:
            raise HTTPException(status_code=404, detail="No debit notes found for this document")
        
        print(f"📊 Found {len(all_notes)} debit notes for PDF generation")
        
        # Get original document amount for summary
        original_amount = 0
        try:
            if document_type == "grn":
                collection = get_grn_collection(tenant_id)
            elif document_type == "ap_invoice":
                collection = get_apinvoice_collection(tenant_id)
            elif document_type == "outgoing_payment":
                collection = get_outgoingpayment_collection(tenant_id)
            else:
                collection = None
            
            if collection:
                if len(document_id) == 24:
                    doc = collection.find_one({"_id": ObjectId(document_id)})
                else:
                    doc = collection.find_one({"randomId": document_id})
                
                if doc:
                    if document_type == "grn":
                        original_amount = doc.get("grandTotal", 0) or doc.get("totalReceivedAmount", 0) or 0
                    elif document_type == "ap_invoice":
                        original_amount = doc.get("invoiceAmount", 0) or doc.get("payableAmount", 0) or 0
                    elif document_type == "outgoing_payment":
                        original_amount = doc.get("totalPayableAmount", 0) or doc.get("payableAmount", 0) or 0
        except:
            pass
        
        # Generate PDF content
        pdf_content = generate_all_notes_pdf_content(
            all_notes, 
            document_id, 
            document_type, 
            vendor_name,
            original_amount
        )
        
        # Prepare response with better filename
        doc_ref = ""
        try:
            if document_type == "grn":
                collection = get_grn_collection(tenant_id)
            elif document_type == "ap_invoice":
                collection = get_apinvoice_collection(tenant_id)
            elif document_type == "outgoing_payment":
                collection = get_outgoingpayment_collection(tenant_id)
            else:
                collection = None
            
            if collection:
                if len(document_id) == 24:
                    doc = collection.find_one({"_id": ObjectId(document_id)})
                else:
                    doc = collection.find_one({"randomId": document_id})
                
                if doc:
                    doc_ref = doc.get("randomId", document_id)
        except:
            doc_ref = document_id
        
        filename = f"Debit_Notes_{document_type}_{doc_ref}.pdf".replace("_", " ").title()
        
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/pdf",
                "Content-Length": str(len(pdf_content))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PDF for all notes: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")