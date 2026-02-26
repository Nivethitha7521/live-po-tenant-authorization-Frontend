
from datetime import datetime
import logging
import traceback
from typing import Any, Dict
from bson import ObjectId
from fastapi import requests
import pytz
from utils.database import get_apinvoice_collection,get_debit_collection,get_grn_collection,get_outgoingpayment_collection
from grn.debitmodels import ComprehensiveDebitNoteView, DebitNotePaymentHistory, DebitNoteViewItem
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import io

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_document_type_and_details(tenant_id: str,document_id: str) -> tuple:
    """
    Determine document type and fetch basic details
    """
    try:
        # Check if it's a GRN
        grn_collection = get_grn_collection(tenant_id)
        grn = grn_collection.find_one({"_id": ObjectId(document_id)})
        if grn:
            return "grn", grn.get("vendorName", ""), grn.get("randomId", "")
        
        # Check if it's an AP Invoice
        ap_collection = get_apinvoice_collection(tenant_id)
        ap_invoice = ap_collection.find_one({"_id": ObjectId(document_id)})
        if ap_invoice:
            return "ap_invoice", ap_invoice.get("vendorName", ""), ap_invoice.get("randomId", "")
        
        # Check if it's an Outgoing Payment
        outgoing_collection = get_outgoingpayment_collection(tenant_id)
        outgoing = outgoing_collection.find_one({"_id": ObjectId(document_id)})
        if outgoing:
            return "outgoing_payment", outgoing.get("vendorName", ""), outgoing.get("randomId", "")
        
        return "unknown", "", ""
        
    except Exception:
        return "unknown", "", ""

def calculate_available_amount_for_new_debit(tenant_id:str,document_type: str, document_id: str, existing_debit_amount: float) -> float:
    """
    Calculate available amount for new debit note creation
    """
    try:
        if document_type == "grn":
            collection = get_grn_collection(tenant_id)
            doc = collection.find_one({"_id": ObjectId(document_id)})
            if doc:
                grand_total = doc.get("grandTotal", 0) or doc.get("totalReceivedAmount", 0) or 0
                existing_returns = doc.get("totalReturnedAmount", 0) or 0
                return max(0, grand_total - existing_returns - existing_debit_amount)
        
        elif document_type == "ap_invoice":
            collection = get_apinvoice_collection(tenant_id)
            doc = collection.find_one({"_id": ObjectId(document_id)})
            if doc:
                invoice_amount = doc.get("invoiceAmount", 0) or doc.get("payableAmount", 0) or 0
                return max(0, invoice_amount - existing_debit_amount)
        
        elif document_type == "outgoing_payment":
            collection = get_outgoingpayment_collection(tenant_id)
            doc = collection.find_one({"_id": ObjectId(document_id)})
            if doc:
                payable_amount = doc.get("totalPayableAmount", 0) or doc.get("payableAmount", 0) or 0
                return max(0, payable_amount - existing_debit_amount)
        
        return 0.0
        
    except Exception as e:
        logger.error(f"Error calculating available amount: {str(e)}")
        return 0.0

# ============================================
# DATA SANITIZATION FUNCTIONS
# ============================================
# In your routes.py, update the sanitization function:
def sanitize_note_for_response(note: dict) -> dict:
    """
    Ensure note has all required fields for Pydantic validation.
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
        
        # Ensure randomId exists - if not, create from noteId or _id
        if "randomId" not in sanitized:
            sanitized["randomId"] = sanitized.get("noteId", f"NOTE_{sanitized['_id'][-6:]}")
        
        # For legacy notes, ensure noteId and randomId are properly set
        if sanitized.get("noteId") and isinstance(sanitized["noteId"], ObjectId):
            sanitized["noteId"] = str(sanitized["noteId"])
        
        # Continue with other sanitization...
        return sanitized
        
    except Exception as e:
        logger.error(f"Error sanitizing note: {str(e)}\n{traceback.format_exc()}")
        # Return minimal valid structure
        current_time = datetime.now()
        return {
            "_id": str(ObjectId()),
            "noteId": note.get("noteId", str(ObjectId())),
            "randomId": note.get("randomId", f"NOTE_{int(datetime.now().timestamp())}"),  # Generate randomId
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
            "paymentHistory": [],
            "pendingAmount": 0.0,
            "documentId": note.get("documentId", str(ObjectId())),
            "documentType": "unknown",
            "isAmountOnly": True,
            "remainingPayableAmount": None,
            "reason": "",
            "debitAmount": note.get("debitAmount", 0.0)
        }
def format_debit_note_for_view(tenant_id:str,note: dict, current_datetime: datetime) -> ComprehensiveDebitNoteView:
    """
    Format ANY debit note (item-wise OR amount-wise) for the comprehensive view
    HIDES ObjectId and shows proper document references
    """
    try:
        # Sanitize first
        sanitized_note = sanitize_note_for_response(note)
        
        # Determine note type
        is_amount_only = (
            sanitized_note.get("isAmountOnly", False) or 
            sanitized_note.get("noteType") == "amount_only" or
            sanitized_note.get("noteType") == "Amount Only" or
            (not sanitized_note.get("itemDetails") or len(sanitized_note["itemDetails"]) == 0) and 
            sanitized_note.get("totalAmount", 0) > 0
        )
        
        # For amount-only notes that were created via item-wise endpoint
        if not is_amount_only and sanitized_note.get("documentType") in ["ap_invoice", "outgoing_payment"]:
            # AP Invoice/Outgoing Payment notes via item-wise endpoint are actually amount-only
            is_amount_only = True
            sanitized_note["noteType"] = "amount_only"
            sanitized_note["isAmountOnly"] = True
        
        # Calculate aging days
        created_date = sanitized_note.get("createdDate", datetime.now())
        if isinstance(created_date, str):
            try:
                created_date = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
            except:
                created_date = datetime.now()
        
        # Make both timezone-aware
        if current_datetime.tzinfo is None:
            ist = pytz.timezone("Asia/Kolkata")
            current_datetime = ist.localize(current_datetime)
        
        if created_date.tzinfo is None:
            ist = pytz.timezone("Asia/Kolkata")
            created_date = ist.localize(created_date)
        
        aging_days = (current_datetime - created_date).days
        created_date_formatted = created_date.strftime("%d %B %Y")
        
        # Get document reference (show randomId instead of ObjectId)
        document_reference = ""
        if is_amount_only:
            # For amount-only notes, get source document reference
            source_doc = sanitized_note.get("sourceDocument", {})
            if source_doc:
                document_reference = source_doc.get("randomId", "")
        else:
            # For item-wise notes, get GRN randomId
            if sanitized_note.get("grnId"):
                grn_collection = get_grn_collection(tenant_id)
                grn = grn_collection.find_one({"_id": ObjectId(sanitized_note["grnId"])})
                if grn:
                    document_reference = grn.get("randomId", "")
        
        # Prepare items - handle BOTH item-wise and amount-only
        items = []
        item_details = sanitized_note.get("itemDetails", [])
        
        if is_amount_only:
            # For amount-only notes, create a single item representing the amount
            items.append(DebitNoteViewItem(
                itemId=document_reference or sanitized_note.get("documentId", ""),
                itemName=f"Amount Adjustment - {sanitized_note.get('reason', 'Discount/Return')}",
                noteType=sanitized_note.get("noteType", "debit"),
                quantity=1.0,
                unitPrice=sanitized_note.get("totalAmount", sanitized_note.get("debitAmount", 0)),
                totalPrice=sanitized_note.get("totalAmount", sanitized_note.get("debitAmount", 0)),
                finalPrice=sanitized_note.get("totalAmount", sanitized_note.get("debitAmount", 0)),
                reason=sanitized_note.get("reason", ""),
                isAmountOnly=True
            ))
        elif item_details and len(item_details) > 0:
            # For item-wise notes, process each item
            for item in item_details:
                items.append(DebitNoteViewItem(
                    itemId=item.get("itemId", ""),
                    itemName=item.get("itemName", ""),
                    noteType=item.get("noteType", sanitized_note.get("noteType", "debit")),
                    quantity=item.get("quantity", 0),
                    unitPrice=item.get("unitPrice", 0),
                    totalPrice=item.get("totalPrice", 0),
                    finalPrice=item.get("finalPrice", item.get("totalPrice", 0)),
                    reason=item.get("reason", sanitized_note.get("reason", "")),
                    isAmountOnly=item.get("isAmountOnly", False)
                ))
        
        # Prepare payment history
        payment_history = []
        for payment in sanitized_note.get("paymentHistory", []):
            if isinstance(payment, dict):
                payment_history.append(DebitNotePaymentHistory(
                    date=payment.get("date", datetime.now()),
                    outgoingPaymentId=payment.get("outgoingPaymentId"),
                    clearedBy=payment.get("clearedBy"),
                    amount=payment.get("amount", 0)
                ))
        
        # Get document type and proper reference
        doc_type = sanitized_note.get("documentType", "unknown")
        display_document_id = document_reference or sanitized_note.get("randomId", "")
        
        # Hide ObjectId in response
        display_mongo_id = sanitized_note.get("noteId", "")  # Show noteId instead of MongoDB _id
        
        return ComprehensiveDebitNoteView(
            noteId=sanitized_note.get("noteId", ""),
            noteNumber=sanitized_note.get("noteId", ""),  # Use noteId as noteNumber
            mongoId=display_mongo_id,  # Don't show ObjectId
            documentId=display_document_id,  # Show randomId, not ObjectId
            documentType=doc_type,
            vendorName=sanitized_note.get("vendorName", "Unknown Vendor"),
            status=sanitized_note.get("status", "Active"),
            noteType="amount_only" if is_amount_only else "item_wise",
            isAmountOnly=is_amount_only,
            totalAmount=sanitized_note.get("totalAmount", 
                                          sanitized_note.get("debitAmount", 
                                                           sanitized_note.get("netAmount", 0))),
            finalAmount=sanitized_note.get("finalAmount", 
                                          sanitized_note.get("totalAmount", 
                                                           sanitized_note.get("netAmount", 0))),
            pendingAmount=sanitized_note.get("pendingAmount", 0),
            remainingPayableAmount=sanitized_note.get("remainingPayableAmount"),
            createdDate=created_date,
            createdBy=sanitized_note.get("createdBy", "system"),
            createdDateFormatted=created_date_formatted,
            agingDays=aging_days,
            clearedAgainstOutgoing=sanitized_note.get("clearedAgainstOutgoing"),
            clearedBy=sanitized_note.get("clearedBy"),
            clearedDate=sanitized_note.get("clearedDate"),
            items=items,
            paymentHistory=payment_history,
            sourceDocumentRef=sanitized_note.get("randomId", ""),
            sourceDocumentDetails=sanitized_note.get("sourceDocument"),
            reason=sanitized_note.get("reason"),
            comments=sanitized_note.get("comments")
        )
        
    except Exception as e:
        logger.error(f"Error formatting debit note: {str(e)}\n{traceback.format_exc()}")
        # Return minimal view without ObjectId
        return ComprehensiveDebitNoteView(
            noteId=note.get("noteId", "unknown"),
            noteNumber=note.get("noteId", "unknown"),
            mongoId=note.get("noteId", "unknown"),  # Don't show ObjectId
            documentId=note.get("randomId", ""),
            documentType=note.get("documentType", "unknown"),
            vendorName=note.get("vendorName", "Unknown Vendor"),
            status=note.get("status", "Active"),
            noteType="amount_only",
            isAmountOnly=True,
            totalAmount=note.get("totalAmount", 0),
            finalAmount=note.get("totalAmount", 0),
            pendingAmount=note.get("pendingAmount", 0),
            createdDate=datetime.now(),
            createdBy=note.get("createdBy", "system"),
            createdDateFormatted=datetime.now().strftime("%d %B %Y"),
            agingDays=0,
            items=[],
            paymentHistory=[]
        )


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

def find_all_related_documents(tenant_id:str,document_id: str) -> Dict[str, Any]:
    """
    Find ALL related documents for a given document ID.
    A document can be linked to multiple other documents through relationships.
    """
    try:
        related_docs = {
            "primary_doc": None,
            "all_document_ids": set(),
            "document_tree": {}
        }
        
        # Get document type and basic info
        doc_type, vendor_name, random_id = get_document_type_and_details(tenant_id,document_id)
        
        if doc_type == "unknown":
            # Try to find by randomId
            collections = [
                ("grn", get_grn_collection(tenant_id)),
                ("ap_invoice", get_apinvoice_collection(tenant_id)),
                ("outgoing_payment", get_outgoingpayment_collection(tenant_id))
            ]
            
            for doc_type_name, collection in collections:
                doc = collection.find_one({"randomId": document_id})
                if doc:
                    doc_type = doc_type_name
                    vendor_name = doc.get("vendorName", "")
                    random_id = doc.get("randomId", "")
                    document_id = str(doc["_id"])
                    break
        
        if doc_type == "unknown":
            return {
                "success": False,
                "message": "Document not found",
                "related_docs": related_docs
            }
        
        # Start with the primary document
        related_docs["primary_doc"] = {
            "documentId": document_id,
            "documentType": doc_type,
            "vendorName": vendor_name,
            "randomId": random_id
        }
        
        # Add primary document to the set
        related_docs["all_document_ids"].add(document_id)
        
        # Build document tree
        related_docs["document_tree"] = {
            document_id: {
                "type": doc_type,
                "vendor": vendor_name,
                "randomId": random_id,
                "children": []  # Documents that reference this one
            }
        }
        
        # Find ALL related documents based on document type
        if doc_type == "outgoing_payment":
            # For outgoing payment, find related AP invoices and GRNs
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            outgoing = outgoing_collection.find_one({"_id": ObjectId(document_id)})
            
            if outgoing:
                # Find AP invoices linked to this outgoing payment
                ap_invoice_id = outgoing.get("invoiceId")
                if ap_invoice_id:
                    related_docs["all_document_ids"].add(ap_invoice_id)
                    
                    # Find GRN linked to this AP invoice
                    ap_collection = get_apinvoice_collection(tenant_id)
                    ap_invoice = ap_collection.find_one({"_id": ObjectId(ap_invoice_id)})
                    if ap_invoice:
                        grn_id = ap_invoice.get("grnId")
                        if grn_id:
                            related_docs["all_document_ids"].add(grn_id)
                        
                        # Add to document tree
                        related_docs["document_tree"][document_id]["children"].append({
                            "documentId": ap_invoice_id,
                            "documentType": "ap_invoice",
                            "relationship": "linked_from_outgoing"
                        })
                        
                        if grn_id:
                            related_docs["document_tree"][ap_invoice_id] = {
                                "type": "ap_invoice",
                                "vendor": ap_invoice.get("vendorName", ""),
                                "randomId": ap_invoice.get("randomId", ""),
                                "children": [{
                                    "documentId": grn_id,
                                    "documentType": "grn",
                                    "relationship": "linked_from_ap"
                                }]
                            }
                            
                            # Get GRN details
                            grn_collection = get_grn_collection(tenant_id)
                            grn = grn_collection.find_one({"_id": ObjectId(grn_id)})
                            if grn:
                                related_docs["document_tree"][grn_id] = {
                                    "type": "grn",
                                    "vendor": grn.get("vendorName", ""),
                                    "randomId": grn.get("randomId", ""),
                                    "children": []
                                }
        
        elif doc_type == "ap_invoice":
            # For AP invoice, find related GRN and outgoing payments
            ap_collection = get_apinvoice_collection(tenant_id)
            ap_invoice = ap_collection.find_one({"_id": ObjectId(document_id)})
            
            if ap_invoice:
                # Find GRN
                grn_id = ap_invoice.get("grnId")
                if grn_id:
                    related_docs["all_document_ids"].add(grn_id)
                    
                    related_docs["document_tree"][document_id]["children"].append({
                        "documentId": grn_id,
                        "documentType": "grn",
                        "relationship": "linked_from_ap"
                    })
                
                # Find outgoing payments that reference this AP invoice
                outgoing_collection = get_outgoingpayment_collection(tenant_id)
                outgoing_payments = outgoing_collection.find({"invoiceId": document_id})
                
                for outgoing in outgoing_payments:
                    outgoing_id = str(outgoing["_id"])
                    related_docs["all_document_ids"].add(outgoing_id)
                    
                    related_docs["document_tree"][document_id]["children"].append({
                        "documentId": outgoing_id,
                        "documentType": "outgoing_payment",
                        "relationship": "references_ap"
                    })
                    
                    # Add outgoing to document tree
                    related_docs["document_tree"][outgoing_id] = {
                        "type": "outgoing_payment",
                        "vendor": outgoing.get("vendorName", ""),
                        "randomId": outgoing.get("randomId", ""),
                        "children": []
                    }
        
        elif doc_type == "grn":
            # For GRN, find related AP invoices and outgoing payments
            grn_collection = get_grn_collection(tenant_id)
            grn = grn_collection.find_one({"_id": ObjectId(document_id)})
            
            if grn:
                # Find AP invoices that reference this GRN
                ap_collection = get_apinvoice_collection(tenant_id)
                ap_invoices = ap_collection.find({"grnId": document_id})
                
                for ap_invoice in ap_invoices:
                    ap_id = str(ap_invoice["_id"])
                    related_docs["all_document_ids"].add(ap_id)
                    
                    related_docs["document_tree"][document_id]["children"].append({
                        "documentId": ap_id,
                        "documentType": "ap_invoice",
                        "relationship": "created_from_grn"
                    })
                    
                    # Add AP to document tree
                    related_docs["document_tree"][ap_id] = {
                        "type": "ap_invoice",
                        "vendor": ap_invoice.get("vendorName", ""),
                        "randomId": ap_invoice.get("randomId", ""),
                        "children": []
                    }
                    
                    # Find outgoing payments for this AP invoice
                    outgoing_collection = get_outgoingpayment_collection(tenant_id)
                    outgoing_payments = outgoing_collection.find({"invoiceId": ap_id})
                    
                    for outgoing in outgoing_payments:
                        outgoing_id = str(outgoing["_id"])
                        related_docs["all_document_ids"].add(outgoing_id)
                        
                        related_docs["document_tree"][ap_id]["children"].append({
                            "documentId": outgoing_id,
                            "documentType": "outgoing_payment",
                            "relationship": "created_from_ap"
                        })
                        
                        # Add outgoing to document tree
                        related_docs["document_tree"][outgoing_id] = {
                            "type": "outgoing_payment",
                            "vendor": outgoing.get("vendorName", ""),
                            "randomId": outgoing.get("randomId", ""),
                            "children": []
                        }
        
        # Convert set to list for JSON serialization
        related_docs["all_document_ids"] = list(related_docs["all_document_ids"])
        
        # Get vendor name from all related documents (should be same)
        vendors = set()
        for doc_id in related_docs["all_document_ids"]:
            doc_type, vendor, _ = get_document_type_and_details(tenant_id,doc_id)
            if vendor:
                vendors.add(vendor)
        
        related_docs["vendor_names"] = list(vendors)
        
        return {
            "success": True,
            "message": f"Found {len(related_docs['all_document_ids'])} related documents",
            "related_docs": related_docs
        }
        
    except Exception as e:
        logger.error(f"Error finding related documents: {str(e)}\n{traceback.format_exc()}")
        return {
            "success": False,
            "message": f"Error: {str(e)}",
            "related_docs": {
                "primary_doc": None,
                "all_document_ids": [],
                "document_tree": {}
            }
        }

# ============================================
# HELPER FUNCTIONS - DEBIT NOTE NUMBER GENERATION
# ============================================

def generate_debit_note_number(tenant_id: str) -> str:
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

async def check_debit_note_availability(tenant_id: str,

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


async def update_source_document_for_debit_note(tenant_id:str,
    document_type: str,
    document_id: str,
    debit_amount: float,
    timestamp: datetime
) -> None:
    """
    Update source document when a debit note is created.
    Updates financial amounts for all document types.
    """
    try:
        if document_type == "outgoing_payment":
            outgoing_collection = get_outgoingpayment_collection(tenant_id)
            update_result = outgoing_collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$inc": {
                        "debitAmount": debit_amount,
                        "payableAmount": -debit_amount,  # REDUCE payable amount
                    },
                    "$set": {
                        "hasDebitCreditNotes": True,
                        "lastUpdatedDate": timestamp
                    }
                }
            )
            
        elif document_type == "ap_invoice":
            ap_collection = get_apinvoice_collection(tenant_id)
            update_result = ap_collection.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$inc": {
                        "debitAmount": debit_amount,
                        "pendingAmount": -debit_amount,  # REDUCE pending amount
                    },
                    "$set": {
                        "hasDebitCreditNotes": True,
                        "lastUpdatedDate": timestamp
                    }
                }
            )
            
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
            
    except Exception as e:
        logger.error(f"Error updating source document: {str(e)}")

def generate_all_notes_pdf_content(notes, document_id, document_type, vendor_name, 
                                   source_doc_ref, original_amount):
    """Generate PDF for ALL debit notes"""
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=12,
            alignment=1
        )
        
        story = []
        
        # Title
        doc_type_formatted = document_type.replace("_", " ").title()
        title_text = f"All Debit Notes - {doc_type_formatted}"
        story.append(Paragraph(title_text, title_style))
        
        # Document Info
        info_data = [
            ["Document ID:", document_id],
            ["Document Type:", doc_type_formatted],
            ["Vendor:", vendor_name],
            ["Source Ref:", source_doc_ref or "N/A"],
            ["Original Amount:", f"₹{original_amount:,.2f}"],
        ]
        
        info_table = Table(info_data, colWidths=[120, 280])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.grey),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.whitesmoke),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(info_table)
        story.append(Spacer(1, 20))
        
        # Summary
        total_amount = sum(n.get("finalAmount", n.get("totalAmount", 0)) for n in notes)
        item_wise_count = sum(1 for n in notes if n.get("noteType") == "item_wise" or not n.get("isAmountOnly"))
        amount_only_count = sum(1 for n in notes if n.get("noteType") == "amount_only" or n.get("isAmountOnly"))
        active_count = sum(1 for n in notes if n.get("status") != "Cleared")
        cleared_count = sum(1 for n in notes if n.get("status") == "Cleared")
        
        summary_data = [
            ["Total Notes:", str(len(notes))],
            ["Item-wise:", str(item_wise_count)],
            ["Amount-only:", str(amount_only_count)],
            ["Active:", str(active_count)],
            ["Cleared:", str(cleared_count)],
            ["Total Amount:", f"₹{total_amount:,.2f}"],
            ["Available:", f"₹{(original_amount - total_amount):,.2f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[100, 100])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 20))
        
        # Individual Notes
        for i, note in enumerate(notes, 1):
            story.append(Paragraph(f"Note {i}: {note.get('noteId', 'N/A')}", styles['Heading3']))
            
            note_details = [
                ["Type:", "Item-wise" if note.get("noteType") == "item_wise" else "Amount-only"],
                ["Status:", note.get("status", "Active")],
                ["Amount:", f"₹{note.get('finalAmount', 0):,.2f}"],
                ["Created:", note.get("createdDate", "N/A")],
                ["Reason:", note.get("reason", "N/A")[:50]],
            ]
            
            note_table = Table(note_details, colWidths=[80, 320])
            note_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            story.append(note_table)
            story.append(Spacer(1, 10))
        
        # Build PDF
        doc.build(story)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Error in generate_all_notes_pdf_content: {str(e)}")
        raise
