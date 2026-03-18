from datetime import datetime, timedelta, timezone
import logging
import re
import traceback
from fastapi import APIRouter, HTTPException, Query, logger,Depends,Request
from bson import ObjectId
from typing import List, Dict, Optional
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_any_permission

import pymongo
import pytz

from utils.financial_year import get_business_alias, get_financial_year

from .models import IST,  Outgoing, OutgoingPost, OutgoingResponse, OutgoingResponseGET, TaxDetail, VendorDetail
from utils.database import get_vendor_collection,get_outgoingpayment_collection,get_debit_collection


router = APIRouter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def calculate_date_difference(invoice_date: str) -> int:
    # Parse the invoice_date assuming it's in "day-month-year" format (e.g., "01-12-2024")
    invoice_datetime = datetime.strptime(invoice_date, "%d-%m-%Y")  # Adjust format to match your date format
    current_datetime = datetime.now()
    delta = current_datetime - invoice_datetime
    return delta.days


def get_current_date_and_time(timezone: str = "Asia/Kolkata") -> dict:
    try:
        # Get current time in IST
        tz = pytz.timezone(timezone)
        localized_now = datetime.now(tz)
        
        # Convert to naive datetime in IST for database storage
        naive_ist = localized_now.replace(tzinfo=None)
        
    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail="Invalid timezone")
    
    return {
        "datetime": naive_ist  # Naive datetime in IST timezone
    }

# def get_next_counter_value(tenant_id:str):
#     outgoing_collection = get_outgoingpayment_collection(tenant_id)
#     counter_collection = outgoing_collection.database["counters"]   
#     counter = counter_collection.find_one_and_update(
#         {"_id": "outgoingId"},
#         {"$inc": {"sequence_value": 1}},
#         upsert=True,
#         return_document=True
#     )
#     return counter["sequence_value"]

# def reset_counter(tenant_id: str):
#     outgoing_collection = get_outgoingpayment_collection(tenant_id)
#     counter_collection = outgoing_collection.database["counters"]
#     counter_collection.update_one(
#         {"_id": "outgoingId"},
#         {"$set": {"sequence_value": 0}},
#         upsert=True
#     )

def generate_outgoing_random_id(tenant_id: str):
    """
    Generates Outgoing ID with TRANSITION LOGIC - SYNC VERSION
    """
    current_date = datetime.now()
    TRANSITION_DATE = datetime(2026, 4, 1)
    
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    counter_collection = outgoing_collection.database["counters"]
    
    if current_date < TRANSITION_DATE:
        if outgoing_collection.count_documents({}) == 0:
            counter_collection.update_one(
                {"_id": "outgoingId"},
                {"$set": {"sequence_value": 0}},
                upsert=True
            )
        
        counter = counter_collection.find_one_and_update(
            {"_id": "outgoingId"},
            {"$inc": {"sequence_value": 1}},
            upsert=True,
            return_document=True
        )
        counter_value = counter["sequence_value"]
        outgoing_id = f"OT{counter_value:04d}"
        
        return outgoing_id
    else:
        financial_year = get_financial_year(current_date)
        business_alias = get_business_alias(tenant_id)  # Sync version
        
        counter_id = f"outgoingId_{financial_year}"
        
        counter = counter_collection.find_one_and_update(
            {"_id": counter_id},
            {"$inc": {"sequence_value": 1}},
            upsert=True,
            return_document=True
        )
        counter_value = counter["sequence_value"]
        outgoing_id = f"{business_alias}/{financial_year}/OT{counter_value:04d}"
        
        return outgoing_id

def get_vendor_debit_credit_totals(tenant_id: str,vendor_name: str):
    debit_collection = get_debit_collection(tenant_id)
    pipeline = [
        {"$match": {"vendorName": {"$regex": f"^{vendor_name}$", "$options": "i"}}},
        {"$unwind": "$itemDetails"},
        {"$group": {
            "_id": "$vendorName",
            "totalDebitAmount": {
                "$sum": {
                    "$cond": [{"$eq": ["$itemDetails.noteType", "debit"]}, "$itemDetails.finalPrice", 0]
                }
            },
            "totalCreditAmount": {
                "$sum": {
                    "$cond": [{"$eq": ["$itemDetails.noteType", "credit"]}, "$itemDetails.finalPrice", 0]
                }
            }
        }}
    ]
    result = list(debit_collection.aggregate(pipeline))
    if result:
        return result[0].get("totalDebitAmount", 0), result[0].get("totalCreditAmount", 0)
    return 0, 0

# Utility function to calculate the date difference in days
def calculate_date_difference(date_str: str) -> int:
    try:
        # Assuming the date is in dd-mm-yyyy format, change if necessary
        date_obj = datetime.strptime(date_str, "%d-%m-%Y")
        current_date = datetime.now()
        # Calculate the difference in days
        return (current_date - date_obj).days
    except ValueError:
        # Return None if there's an issue with the date format
        return None
def get_next_counter_value(tenant_id: str):
    counter_collection = get_outgoingpayment_collection(tenant_id).database["counters"]
    counter = counter_collection.find_one_and_update(
        {"_id": "outgoingId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

def reset_counter(tenant_id: str):
    counter_collection = get_outgoingpayment_collection(tenant_id).database["counters"]
    counter_collection.update_one(
        {"_id": "outgoingId"},
        {"$set": {"sequence_value": 0}},
        upsert=True
    )

# Routes
@router.post("/", response_model=str)
async def create_outgoing(request: Request,outgoing: OutgoingPost):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    if outgoing_collection.count_documents({}) == 0:
        reset_counter()

    random_id = generate_outgoing_random_id(tenant_id)
    new_outgoing_data = outgoing.dict()
    current_date_and_time = get_current_date_and_time()

    new_outgoing_data['randomId'] = random_id
    new_outgoing_data['createdDate'] = current_date_and_time['datetime']  # Add created date
    new_outgoing_data['lastUpdatedDate'] = current_date_and_time['datetime'] 
    new_outgoing_data['outgoingDate'] = current_date_and_time['datetime']  
    result = outgoing_collection.insert_one(new_outgoing_data)
    return str(result.inserted_id)
from bson import ObjectId

@router.get("/outgoings")
async def get_outgoings( request: Request,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "outgoingpayment", "read"))):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    vendor_collection = get_vendor_collection(tenant_id)
    debit_collection = get_debit_collection(tenant_id)

    outgoings = list(outgoing_collection.find({}))
    
    for outgoing in outgoings:
        # Convert Mongo _id to string
        if "_id" in outgoing and isinstance(outgoing["_id"], ObjectId):
            outgoing["_id"] = str(outgoing["_id"])
        
        vendor_name = outgoing.get('vendorName', '')

        vendor = vendor_collection.find_one({"vendorName": vendor_name})
        payable_amount = vendor.get("payableAmount", 0) if vendor else 0
        outgoing["vendorMasterPayableAmount"] = round(payable_amount, 2)

        pipeline = [
            {"$match": {"vendorName": {"$regex": f"^{vendor_name}$", "$options": "i"}}},
            {"$unwind": "$itemDetails"},
            {"$group": {
                "_id": "$vendorName",
                "totalDebitAmount": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$itemDetails.noteType", "debit"]},
                            "$itemDetails.finalPrice",
                            0
                        ]
                    }
                },
                "totalCreditAmount": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$itemDetails.noteType", "credit"]},
                            "$itemDetails.finalPrice",
                            0
                        ]
                    }
                }
            }}
        ]
        debit_credit_result = list(debit_collection.aggregate(pipeline))
        
        if debit_credit_result:
            total_debit = debit_credit_result[0].get("totalDebitAmount", 0)
            total_credit = debit_credit_result[0].get("totalCreditAmount", 0)
        else:
            total_debit = 0
            total_credit = 0

        outgoing["totalDebitAmount"] = round(total_debit, 2)
        outgoing["totalCreditAmount"] = round(total_credit, 2)
        outgoing["adjustedPayableAmount"] = round(
            payable_amount + total_debit - total_credit, 2
        )

    return outgoings
@router.get("/", response_model=OutgoingResponseGET)
async def get_outgoings(request: Request,
    fromDate: Optional[datetime] = Query(None, description="From date for either invoiceDate or paymentDate"),
    toDate: Optional[datetime] = Query(None, description="To date for either invoiceDate or paymentDate"),
    vendorName: Optional[str] = Query(None, description="Vendor name to filter by"),
    filterBy: Optional[str] = Query(None, description="Specify which date to filter by (invoiceDate or paymentDate or outgoingDate)"),
    status: Optional[str] = Query(None, description="Filter by outgoing payment status"),
    filterByAmount: Optional[bool] = Query(None, description="Filter outgoings based on totalPayableAmount > 0"),
    filterByStatus: Optional[bool] = Query(None, description="Filter outgoings based on their status"),
    filterAll: Optional[bool] = Query(True, description="Set to true to show all records, ignoring intimationDays"),
    sortOrder: Optional[str] = Query("ascending", description="Specify the sort order: 'ascending' or 'descending'"),
    sortBy: Optional[str] = Query("invoiceDate", description="Specify the field to sort by"),
    skip: int = Query(0, title="Skip", description="Number of records to skip"),
    limit: int = Query(50, title="Limit", description="Max number of records to retrieve"),
     user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "outgoingpayment", "read"))
):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    query = {}
    IST = pytz.timezone('Asia/Kolkata')

    logger.info("=== STARTING OUTGOING PAYMENTS QUERY ===")
    logger.info(f"Parameters received:")
    logger.info(f"  sortBy: {sortBy}")
    logger.info(f"  sortOrder: {sortOrder}")
    logger.info(f"  skip: {skip}, limit: {limit}")

    # Validate filterBy
    if filterBy not in ["invoiceDate", "paymentDate", "outgoingDate", None]:
        raise HTTPException(status_code=400, detail="filterBy must be 'invoiceDate', 'paymentDate', 'outgoingDate' or None")

    # Vendor name filtering
    if vendorName and vendorName.strip():
        decoded_vendor_name = vendorName.replace('+', ' ').strip()
        query["vendorName"] = {"$regex": f".*{re.escape(decoded_vendor_name)}.*", "$options": "i"}

    # Status filtering - ALWAYS EXCLUDE "Returned"
    query["status"] = {"$ne": "Returned"}

    # Additional status filtering if provided
    if filterByStatus:
        query["status"] = {"$in": ["Fully Paid", "Partially Paid", "Advance Paid"], "$ne": "Returned"}
    elif status:
        status_list = [s.strip() for s in status.split(",")]
        query["status"] = {"$in": status_list, "$ne": "Returned"}

    # Amount filtering - FIXED: Only show payments with remaining amount
    if filterByAmount:
        query["totalPayableAmount"] = {"$gt": 0}

    # Date filtering with proper timezone handling
    if filterBy and fromDate and toDate:
        from_date_utc = fromDate.astimezone(pytz.UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        to_date_utc = toDate.astimezone(pytz.UTC).replace(hour=23, minute=59, second=59, microsecond=999999)
        query[filterBy] = {"$gte": from_date_utc, "$lte": to_date_utc}

    # Retrieve outgoings
   
    if outgoing_collection is None:
        logger.error("Database connection error")
        raise HTTPException(status_code=500, detail="Database connection error")

    try:
        # Get total count FIRST for pagination
        total_items = outgoing_collection.count_documents(query)
        logger.info(f"TOTAL DOCUMENTS MATCHING QUERY: {total_items}")
        
        # Calculate totalPayableAmount sum over ALL matching documents (not just paginated)
        pipeline = [
            {"$match": query},
            {"$group": {"_id": None, "totalPayableAmount": {"$sum": "$totalPayableAmount"}}}
        ]
        result = list(outgoing_collection.aggregate(pipeline))
        total_payable_amount = result[0]["totalPayableAmount"] if result else 0.0
        logger.info(f"TOTAL PAYABLE AMOUNT: {total_payable_amount}")
        
        # ENHANCED: Comprehensive sorting with field mapping
        sort_field_mapping = {
            "intimationDays": "intimationDays",
            "dueDays": "intimationDays",
            "paymentTerms": "paymentTerms",
            "totalPayableAmount": "totalPayableAmount",
            "payableAmount": "payableAmount",
            "totalPrice": "totalPrice",
            "totalPaid": "totalPaid",
            "remainingAmount": "totalPayableAmount",
            "invoiceDate": "invoiceDate",
            "createdDate": "createdDate",
            "outgoingDate": "outgoingDate",
            "paymentDate": "paymentDate",
            "vendorName": "vendorName",
            "invoiceNo": "invoiceNo",
            "randomId": "randomId"
        }
        
        # Use the provided sortBy or default to createdDate
        sort_field = sort_field_mapping.get(sortBy, "createdDate")
        sort_direction = 1 if sortOrder.lower() == "ascending" else -1
        
        logger.info(f"SORTING: by {sort_field} in {sortOrder} direction ({sort_direction})")

        # Apply skip and limit at database level for efficiency
        all_outgoings = list(outgoing_collection.find(query)
            .sort(sort_field, sort_direction)
            .skip(skip)
            .limit(limit))
        
        logger.info(f"DOCUMENTS RETURNED AFTER SKIP/LIMIT: {len(all_outgoings)}")

        processed_outgoings = []
        current_date = datetime.now(IST).replace(tzinfo=None)

        for outgoing in all_outgoings:
            outgoing["outgoingId"] = str(outgoing["_id"])
            outgoing.pop("_id", None)

            # Ensure critical fields with proper defaults
            outgoing["advanceAmount"] = outgoing.get("advanceAmount", 0.0)
            outgoing["partialAmount"] = outgoing.get("partialAmount", 0.0)
            outgoing["fullPaymentAmount"] = outgoing.get("fullPaymentAmount", 0.0)
            outgoing["totalPayableAmount"] = outgoing.get("totalPayableAmount", 0.0)
            outgoing["payableAmount"] = outgoing.get("payableAmount", 0.0)
            outgoing["totalPrice"] = outgoing.get("totalPrice", 0.0)
            outgoing["discountDetails"] = outgoing.get("discountDetails", 0.0)
            outgoing["status"] = outgoing.get("status", "Pending")

            # Calculate computed fields for frontend - FIXED CALCULATION
            outgoing["totalPaid"] = (
                (outgoing["advanceAmount"] or 0) + 
                (outgoing["partialAmount"] or 0) + 
                (outgoing["fullPaymentAmount"] or 0)
            )
            
            # Remaining amount should be totalPayableAmount minus totalPaid
            outgoing["remainingAmount"] = max(0, outgoing["totalPayableAmount"] - outgoing["totalPaid"])

            # Calculate intimationDays if missing or null
            if (not outgoing.get("intimationDays") or outgoing.get("intimationDays") is None) and outgoing.get("invoiceDate"):
                try:
                    invoice_date_str = outgoing.get("invoiceDate")
                    invoice_date = None
                    
                    if isinstance(invoice_date_str, str):
                        if 'T' in invoice_date_str:
                            invoice_date = datetime.fromisoformat(invoice_date_str.replace("Z", "+00:00")).astimezone(IST).replace(tzinfo=None)
                        else:
                            try:
                                invoice_date = datetime.strptime(invoice_date_str, "%Y-%m-%d").replace(tzinfo=IST).replace(tzinfo=None)
                            except ValueError:
                                try:
                                    invoice_date = datetime.strptime(invoice_date_str, "%d-%m-%Y").replace(tzinfo=IST).replace(tzinfo=None)
                                except ValueError:
                                    pass
                    elif isinstance(invoice_date_str, datetime):
                        invoice_date = invoice_date_str.astimezone(IST).replace(tzinfo=None)
                    
                    if invoice_date:
                        payment_terms_str = outgoing.get("paymentTerms", "0")
                        digits = "".join(filter(str.isdigit, payment_terms_str))
                        payment_terms = int(digits) if digits else 0
                        
                        days_diff = (current_date - invoice_date).days
                        outgoing["intimationDays"] = payment_terms - days_diff
                        
                except (TypeError, ValueError, AttributeError) as e:
                    logger.warning(f"Error calculating intimationDays: {str(e)}")
                    outgoing["intimationDays"] = None

            # Convert dates to IST for response
            for field in ["invoiceDate", "paymentDate", "outgoingDate", "createdDate", "lastUpdatedDate"]:
                if outgoing.get(field):
                    if isinstance(outgoing[field], datetime):
                        outgoing[field] = outgoing[field].astimezone(IST).isoformat()
                    elif isinstance(outgoing[field], str):
                        try:
                            outgoing[field] = datetime.fromisoformat(outgoing[field].replace("Z", "+00:00")).astimezone(IST).isoformat()
                        except ValueError:
                            try:
                                outgoing[field] = datetime.strptime(outgoing[field], "%d-%m-%Y").replace(tzinfo=IST).isoformat()
                            except ValueError:
                                outgoing[field] = None

            processed_outgoings.append(outgoing)

        logger.info(f"PROCESSED OUTGOINGS: {len(processed_outgoings)}")
        logger.info("=== END OUTGOING PAYMENTS QUERY ===")
        
        return OutgoingResponseGET(
            outgoings=[Outgoing(**outgoing) for outgoing in processed_outgoings],
            totalItems=total_items,
            totalPayableAmount=total_payable_amount
        )
    except Exception as e:
        logger.error(f"Error fetching outgoings: {str(e)}")
        logger.error(f"Error details: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error processing outgoings: {str(e)}")
# Endpoint to get vendor details (no authentication)
@router.get("/vendors/details", response_model=List[VendorDetail])
async def get_vendor_details(request: Request,
    status: Optional[str] = Query(None, description="Filter by outgoing payment status"),
    filterByAmount: Optional[bool] = Query(None, description="Filter vendors with payableAmount > 0"),
    filterByStatus: Optional[bool] = Query(None, description="Filter vendors with specific status"),
    fetchAll: Optional[bool] = Query(False, description="Fetch all vendors, ignoring filters"),
     user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "paymentdone", "read"))
):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    pipeline = []
    match_conditions = {}

    if not fetchAll:  # Apply filters only if fetchAll is False
        if status:
            match_conditions["status"] = {"$regex": f"^{status}$", "$options": "i"}
        if filterByAmount:
            match_conditions["payableAmount"] = {"$gt": 0}
        if filterByStatus:
            match_conditions["status"] = {
                "$in": ["Fully Paid", "Advance Paid", "Partially Paid"]
            }

    if match_conditions:
        pipeline.append({"$match": match_conditions})

    pipeline.extend([
        {
            "$group": {
                "_id": "$vendorName",
                "count": {"$sum": 1},
                "totalAmount": {"$sum": "$payableAmount"},
                "statuses": {"$addToSet": "$status"}
            }
        },
        {
            "$match": {
                "_id": {"$ne": None}
            }
        },
        {
            "$project": {
                "vendorName": "$_id",
                "count": 1,
                "totalAmount": 1,
                "statuses": 1,
                "_id": 0
            }
        },
        {
            "$sort": {"vendorName": 1}
        }
    ])

    # Await the aggregation query
    vendors = list(outgoing_collection.aggregate(pipeline))  # Removed 'await' and used list() to consume the cursor
    return [VendorDetail(**vendor) for vendor in vendors]
@router.get("/{outgoing_id}", response_model=Outgoing)
async def get_outgoing_by_id(request: Request, outgoing_id: str,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "outgoingpayment", "read"))):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    outgoing = outgoing_collection.find_one({"_id": ObjectId(outgoing_id)})
    if outgoing:
        outgoing["outgoingId"] = str(outgoing["_id"])
        return Outgoing(**outgoing)
    else:
        raise HTTPException(status_code=404, detail="Outgoing document not found")

@router.get("/outgoing/getAll", response_model=List[Outgoing])
async def get_all_outgoings(request:Request, user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "outgoingpayment", "read"))):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    logger.info("Fetching all outgoing payments")
    outgoings = list(outgoing_collection.find())
    if not outgoings:
        logger.warning("No outgoing documents found")
        raise HTTPException(status_code=404, detail="No outgoing documents found")

    transformed_outgoings = []
    for outgoing in outgoings:
        # Convert _id to string
        outgoing["outgoingId"] = str(outgoing["_id"])
        del outgoing["_id"]

        # Transform paymentHistory if it exists and is a dict
        if "paymentHistory" in outgoing and isinstance(outgoing["paymentHistory"], dict):
            logger.debug(f"Transforming paymentHistory for outgoingId: {outgoing['outgoingId']}")
            payment_history_dict = outgoing["paymentHistory"]
            payment_history_list = []
            if payment_history_dict:
                # Get the length of one of the lists (e.g., amount)
                length = len(payment_history_dict.get("amount", []))
                for i in range(length):
                    payment_entry = {
                        "amount": payment_history_dict.get("amount", [None])[i],
                        "paymentDate": payment_history_dict.get("paymentDate", [None])[i],
                        "debitAmount": payment_history_dict.get("debitAmount", [None])[i],
                        "paymentType": payment_history_dict.get("paymentType", [None])[i],
                        "paymentMethod": payment_history_dict.get("paymentMethod", [None])[i],
                        "paymentMode": payment_history_dict.get("paymentMode", [None])[i],
                        "pettyCashAmount": payment_history_dict.get("pettyCashAmount", [None])[i],
                        "hoCash": payment_history_dict.get("hoCash", [None])[i],
                        "bankName": payment_history_dict.get("bankName", [None])[i],
                        "impsNo": payment_history_dict.get("impsNo", [None])[i],
                        "neftNo": payment_history_dict.get("neftNo", [None])[i],
                        "rtgsNo": payment_history_dict.get("rtgsNo", [None])[i],
                        "upi": payment_history_dict.get("upi", [None])[i],
                        "debitNotesApplied": payment_history_dict.get("debitNotesApplied", [None])[i] or [],
                    }
                    # Handle date conversion for paymentDate
                    if payment_entry["paymentDate"] and isinstance(payment_entry["paymentDate"], str):
                        try:
                            payment_entry["paymentDate"] = datetime.fromisoformat(payment_entry["paymentDate"].replace('Z', '+00:00')).astimezone(IST)
                        except ValueError:
                            logger.warning(f"Invalid date format for paymentDate: {payment_entry['paymentDate']}")
                            payment_entry["paymentDate"] = None
                    payment_history_list.append(payment_entry)
                outgoing["paymentHistory"] = payment_history_list
            else:
                outgoing["paymentHistory"] = []

        transformed_outgoings.append(outgoing)

    try:
        return [Outgoing(**outgoing) for outgoing in transformed_outgoings]
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")
@router.put("/{outgoing_id}")
async def update_outgoing(request: Request, outgoing_id: str, outgoing: OutgoingPost):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    updated_outgoing = outgoing.dict(exclude_unset=True)
    result = outgoing_collection.update_one({"_id": ObjectId(outgoing_id)}, {"$set": updated_outgoing})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Outgoing document not found")
    return {"message": "Outgoing document updated successfully"}

@router.patch("/{outgoing_id}")
async def patch_outgoing(request:Request,outgoing_id: str, outgoing_patch: OutgoingPost):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    existing_outgoing = outgoing_collection.find_one({"_id": ObjectId(outgoing_id)})
    if not existing_outgoing:
        raise HTTPException(status_code=404, detail="Outgoing document not found")

    updated_fields = {key: value for key, value in outgoing_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        updated_fields['lastUpdatedDate'] = get_current_date_and_time()['datetime']
        result = outgoing_collection.update_one({"_id": ObjectId(outgoing_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Outgoing document")

    updated_outgoing = outgoing_collection.find_one({"_id": ObjectId(outgoing_id)})
    updated_outgoing["_id"] = str(updated_outgoing["_id"])
    return updated_outgoing
@router.get("/{outgoing_id}/tax-details", response_model=OutgoingResponse)
async def get_outgoing_tax_details(request:Request,outgoing_id: str,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "outgoingpayment", "read"))):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    outgoing = outgoing_collection.find_one({"_id": ObjectId(outgoing_id)})
    if not outgoing:
        raise HTTPException(status_code=404, detail="Outgoing document not found")

    # Initialize a list to hold the tax details
    tax_details = []

    # Iterate through item details to process taxes
    for item in outgoing["itemDetails"]:
        tax_type = item["taxType"]
        tax_percentage = item["purchasetaxName"]

        if tax_type == "cgst_sgst":
            sgst = item.get("sgst", 0)
            cgst = item.get("cgst", 0)
            # Add SGST and CGST to tax details
            tax_details.append(TaxDetail(taxName=f"SGST({tax_percentage / 2}%)", taxPercentage=tax_percentage / 2, taxAmount=sgst))
            tax_details.append(TaxDetail(taxName=f"CGST({tax_percentage / 2}%)", taxPercentage=tax_percentage / 2, taxAmount=cgst))

            # Add IGST with 0 for each set of SGST/CGST
            tax_details.append(TaxDetail(taxName="IGST(0%)", taxPercentage=0, taxAmount=0))

        elif tax_type == "igst":
            igst = item.get("igst", 0)
            # Add IGST with the actual value
            tax_details.append(TaxDetail(taxName=f"IGST({tax_percentage}%)", taxPercentage=tax_percentage, taxAmount=igst))

            # Add SGST and CGST with 0 if IGST is applied
            tax_details.append(TaxDetail(taxName="SGST(0%)", taxPercentage=0, taxAmount=0))
            tax_details.append(TaxDetail(taxName="CGST(0%)", taxPercentage=0, taxAmount=0))

        else:
            # Handle other tax types if present
            tax_amount = item.get("taxAmount", 0)
            tax_details.append(TaxDetail(taxName=f"{tax_type.upper()}({tax_percentage}%)", taxPercentage=tax_percentage, taxAmount=tax_amount))

    return OutgoingResponse(taxes=tax_details)

@router.get("/filter/paymentdatefilters", response_model=List[Outgoing])
async def get_outgoings(request:Request,
    vendorName: Optional[str] = Query(None, description="Vendor name to filter by"),
    days_filterdate: Optional[int] = Query(None, title="Days filter", description="Filter based on days (30, 60, 90)"),user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "partialpayment", "read"))
):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)

    """
    Get Outgoings filtered by vendor name and/or date difference based on days filter.
    If both vendorName and days_filterdate are provided, the results will be filtered by both.
    """
    query = {}

    # Vendor name filtering if provided
    if vendorName:
        query["vendorName"] = {"$regex": f"^{vendorName}", "$options": "i"}

    # Retrieve outgoings from the collection
    outgoings = list(outgoing_collection.find(query))
    if not outgoings:
        return []

    # Get current date and ensure it's timezone naive
    current_date = get_current_date_and_time()["datetime"]
    if isinstance(current_date, str):
        current_date = datetime.strptime(current_date, "%Y-%m-%dT%H:%M:%S")
    elif isinstance(current_date, datetime):
        # If datetime is timezone aware, convert to naive
        if current_date.tzinfo is not None:
            current_date = current_date.replace(tzinfo=None)

    filtered_outgoings = []
    for outgoing in outgoings:
        outgoing["outgoingId"] = str(outgoing["_id"])

        invoice_date = outgoing.get("invoiceDate")
        payment_terms_str = outgoing.get("paymentTerms", "0")  # Default to 0 if paymentTerms is missing

        # Convert invoice_date to datetime if it's a string
        if invoice_date:
            if isinstance(invoice_date, str):
                try:
                    invoice_date = datetime.strptime(invoice_date, "%Y-%m-%dT%H:%M:%S")
                except ValueError:
                    try:
                        invoice_date = datetime.fromisoformat(invoice_date.replace('Z', '+00:00'))
                        invoice_date = invoice_date.replace(tzinfo=None)  # Make it naive
                    except ValueError:
                        continue  # Skip this record if date parsing fails

        # Calculate intimationDays based on invoice_date and paymentTerms
        if invoice_date:
            try:
                days_diff = (current_date - invoice_date).days
                digits = "".join(filter(str.isdigit, payment_terms_str))
                payment_terms = int(digits) if digits else 0
                intimation_days = payment_terms - days_diff
                outgoing["intimationDays"] = intimation_days

                # Filter by days_filterdate (if provided) - include records within range
                if days_filterdate is None or (0 <= intimation_days <= days_filterdate):
                    del outgoing["_id"]  # Remove _id before converting to Outgoing model
                    filtered_outgoings.append(Outgoing(**outgoing))
            except (TypeError, ValueError) as e:
                print(f"Error processing outgoing {outgoing.get('outgoingId')}: {str(e)}")
                continue
        elif days_filterdate is None:
            # Include records with no invoice date only if no days filter is applied
            del outgoing["_id"]
            filtered_outgoings.append(Outgoing(**outgoing))

    return filtered_outgoings










