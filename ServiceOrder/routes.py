from datetime import date, datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body,Request
import pytz
from pymongo import ReturnDocument
import logging
from dependencies.auth import validate_token

from middlewares.permission_middleware import check_permission
from fastapi import Depends
from ServiceOrder.utils import (
    calculate_service_totals_with_proportional_discount,
    calculate_single_description_totals,
    get_current_date_only,
    get_serviceworkorder_collection
)

from ServiceOrder.models import (
    CalculateTotalsRequest, ServicePost, ServiceState, 
    ServiceRejectRequest, ServiceStatusUpdate,
    parse_datetime_to_utc_date_only, parse_datetime_to_utc_full
)
from bson import ObjectId

router = APIRouter()
logger = logging.getLogger(__name__)

# ==============================================
# HELPER FUNCTIONS - MOVED TO TOP
# ==============================================
async def get_next_service_counter(service_type: str,tenant_id: str):
    collection = get_serviceworkorder_collection(tenant_id)
    counter_collection = collection.database["counters"]

    counter_id = f"service_{service_type}_id"
    counter = await counter_collection.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    
    return counter["sequence_value"]

async def generate_service_id(service_type: str, tenant_id: str):
    counter_value = await get_next_service_counter(service_type,tenant_id)
    return f"SR{counter_value:04d}"  

async def reset_service_counter(service_type: str,tenant_id: str):
    collection = get_serviceworkorder_collection(tenant_id)
    counter_collection = collection.database["counters"]
    counter_id = f"service_{service_type}_id"
    await counter_collection.update_one(
        {"_id": counter_id},
        {"$set": {"sequence_value": 0}},
        upsert=True
    )

def validate_and_format_dates(from_dates: List[Optional[Any]], to_dates: List[Optional[Any]]):
    """Validate and format date inputs."""
    formatted_from = []
    formatted_to = []
    
    current_date_only = get_current_date_only()
    
    for from_date, to_date in zip(from_dates, to_dates):
        if from_date is None or from_date == '':
            from_dt = current_date_only
        else:
            try:
                from_dt = parse_datetime_to_utc_date_only(from_date)
                from_dt = from_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            except:
                from_dt = current_date_only
        
        if to_date is None or to_date == '':
            to_dt = from_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        else:
            try:
                to_dt = parse_datetime_to_utc_date_only(to_date)
                to_dt = to_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
            except:
                to_dt = from_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        if to_dt < from_dt:
            to_dt = from_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        formatted_from.append(from_dt)
        formatted_to.append(to_dt)
    
    return formatted_from, formatted_to

# ==============================================
# CREATE SERVICE
# ==============================================
@router.post("/")
async def create_service(service: ServicePost,request: Request, user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_pending","add")
    )):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)
    service_type = "workorder"

    try:
      
        if await collection.count_documents({}) == 0:
            await reset_service_counter(service_type,tenant_id)

        service_id = await generate_service_id(service_type,tenant_id)
        current_date_only = get_current_date_only()

        # Convert service to dict
        service_dict = service.dict()
        
        # Calculate freight totals
        freight_total = 0
        freight_tax = 0
        if service_dict.get("freights"):
            for f in service_dict["freights"]:
                freight_total += f.get("amt", 0)
                freight_tax += f.get("tAmt", 0)
        
        freight_grand_total = freight_total + freight_tax
        
        # Calculate service totals
        totals = calculate_service_totals_with_proportional_discount(service_dict)
        
        # Get service amount after discount
        service_amount_after_discount = totals.get("total_service_amount", 0)
        
        # Prepare mongo data
        mongo_data = {
            'serviceId': service_id,
            'createdDate': current_date_only,
            'status': 'Pending',
            'serviceType': service_type,
            'lastUpdatedDate': current_date_only,
            'lastUpdatedTime': current_date_only.strftime('%H:%M:%S'),
            
            # SERVICE ONLY fields
            "totalServiceFees": totals.get("original_total_fees", 0),  # Original before discount
            "totalServiceTax": totals.get("total_service_tax", 0),     # Service tax after discount
            "totalServiceDiscount": totals.get("total_service_discount", 0),  # Discount amount
            "totalServiceAmount": service_amount_after_discount,       # Service amount after discount
            
            # SUMMARY fields - WITHOUT freight
            "totalFees": service_amount_after_discount,                # Service amount only
            "totalTax": totals.get("total_service_tax", 0),            # Service tax only
            "totalDiscount": totals.get("total_discount", 0),          # Service discount only
            "totalAmount": service_amount_after_discount + freight_grand_total,  # Service + Freight
            
            # FREIGHT totals
            "totalFreightAmount": freight_total,
            "totalFreightTaxAmount": freight_tax,
            
            # Rest of the fields...
            "desc_tax_amounts": totals.get("desc_tax_amounts", []),
            "desc_totals": totals.get("desc_totals", []),
            "base_amounts": totals.get("desc_base_per_units", []),
            "desc_sgst": totals.get("desc_sgst", []),
            "desc_cgst": totals.get("desc_cgst", []),
            "desc_igst": totals.get("desc_igst", []),
            
            "desc_individual_discount_amounts": totals.get("desc_individual_discount_amounts", []),
            "desc_overall_discounts": totals.get("desc_overall_discounts", []),
            "desc_discount_amounts": totals.get("desc_discount_amounts", []),
            "desc_discount_percentages": totals.get("desc_discount_percentages", []),
            
            "include_tax": service_dict.get("include_tax", []),
            "quantity": totals.get("desc_quantity", []),
            "fees": totals.get("desc_fees", []),
            
            "overallDiscountAppliedOn": service_dict.get("overallDiscountAppliedOn", "after_tax"),
        }

        # Copy other fields
        for key, value in service_dict.items():
            if key not in mongo_data and key not in ['createdDate', 'serviceId', '_id']:
                mongo_data[key] = value

        # Insert into database
        result = await collection.insert_one(mongo_data)
        created_service = await collection.find_one({"_id": result.inserted_id})

        if not created_service:
            raise HTTPException(status_code=500, detail="Failed to retrieve created service")

        created_service["_id"] = str(created_service["_id"])
        
        # Debug print
        print(f"✅ SAVED SERVICE - ID: {service_id}")
        print(f"  Service Amount: {service_amount_after_discount}")
        print(f"  Freight Total: {freight_grand_total}")
        print(f"  Final Amount (Service + Freight): {service_amount_after_discount + freight_grand_total}")
        
        return ServiceState(**created_service)

    except Exception as e:
        logger.error(f"Error creating service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
# ==============================================
# CALCULATE TOTALS ENDPOINT
# ==============================================
@router.post("/calculate-totals")
async def calculate_service_totals_endpoint(request: CalculateTotalsRequest):
    try:
        # CRITICAL FIX: Prepare data for calculation
        service_dict = {
            "fees": [
                d.fee_with_tax if d.include_tax else (
                    d.base_amount * (1 + (d.tax_per / 100)) if d.tax_per > 0 else d.base_amount
                )
                for d in request.descriptions
            ],  # ← ALWAYS PER UNIT WITH TAX
            "desc_tax_types": [d.tax_type for d in request.descriptions],
            "desc_tax_pers": [d.tax_per for d in request.descriptions],
            "desc_discount_amounts": [d.discount_amount for d in request.descriptions],
            "desc_discount_percentages": [d.discount_percentage for d in request.descriptions],
            "quantity": [d.quantity or 1 for d in request.descriptions],
            "sacCode": [d.sacCode for d in request.descriptions],
            "descriptions": [d.description for d in request.descriptions],
            "remarks": [d.remarks or "" for d in request.descriptions],
            "include_tax": [d.include_tax for d in request.descriptions],
            "overallDiscountValue": request.overall_discount_value,
            "overallDiscountAppliedOn": request.overall_discount_applied_on,
            "overallDiscountType": request.overall_discount_type,
            "roundOffValue": request.round_off,
            "totalFreightAmount": request.total_freight_amount,
            "totalFreightTaxAmount": request.total_freight_tax,
        }
        
        # Calculate totals using FIXED function
        totals = calculate_service_totals_with_proportional_discount(service_dict)
        
        # Prepare response
        response = {
            # Main totals
            "totalAmount": totals.get("total_final_amount", 0),
            "totalFees": totals.get("total_fees", 0),
            "totalTax": totals.get("total_tax", 0),
            "totalDiscount": totals.get("total_discount", 0),
            "totalOverallDiscount": totals.get("total_overall_discount", 0),
            
            # Service specific
            "totalServiceAmount": totals.get("total_service_amount", 0),
            "totalServiceFees": totals.get("total_fees", 0),
            "totalServiceTax": totals.get("total_tax", 0),
            "totalServiceDiscount": totals.get("total_discount", 0),
            
            # Freight totals
            "totalFreightAmount": totals.get("total_freight_amount", 0),
            "totalFreightTaxAmount": totals.get("total_freight_tax", 0),
            
            # Round off
            "roundOffValue": request.round_off,
            
            # Arrays for line items
            "sacCode": service_dict.get("sacCode", []),
            "descriptions": service_dict.get("descriptions", []),
            "from_dates": [d.from_date.isoformat() if d.from_date else None for d in request.descriptions],
            "to_dates": [d.to_date.isoformat() if d.to_date else None for d in request.descriptions],
            "fees": totals.get("desc_fees", []),  # PER UNIT WITH TAX
            "quantity": totals.get("desc_quantity", []),
            "remarks": totals.get("remarks", service_dict.get("remarks", [])),
            "desc_tax_types": [d.tax_type for d in request.descriptions],
            "desc_tax_pers": [d.tax_per for d in request.descriptions],
            "desc_tax_amounts": totals.get("desc_tax_amounts", []),
            "desc_totals": totals.get("desc_totals", []),
            "base_amounts": totals.get("desc_base_per_units", []),  # PER UNIT WITHOUT TAX
            "desc_sgst": totals.get("desc_sgst", []),
            "desc_cgst": totals.get("desc_cgst", []),
            "desc_igst": totals.get("desc_igst", []),
            "include_tax": service_dict.get("include_tax", []),
            
            # Discount arrays
            "desc_individual_discount_amounts": totals.get("desc_individual_discount_amounts", []),
            "desc_overall_discounts": totals.get("desc_overall_discounts", []),
            "desc_discount_amounts": totals.get("desc_discount_amounts", []),
            "desc_discount_percentages": totals.get("desc_discount_percentages", []),
        }
        
        return response
        
    except Exception as e:
        logger.error(f"🔥 Error calculating totals: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
# ==============================================
# GET SERVICE BY ID
# ==============================================
@router.get("/{identifier}", response_model=ServiceState)
async def get_service_by_identifier(identifier: str, request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_pending","read")
    )):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        
        service = await collection.find_one({"serviceId": identifier})

        if not service:
            try:
                obj_id = ObjectId(identifier)
                service = await collection.find_one({"_id": obj_id})
            except:
                pass

        if service:
            service["_id"] = str(service["_id"])
            for date_field in ['workOrderDate', 'approvedDate', 'rejectedDate', 'invoiceDate', 'createdDate', 'lastUpdatedDate']:
                if service.get(date_field) and isinstance(service[date_field], datetime):
                    service[date_field] = service[date_field].strftime('%Y-%m-%d')
            return ServiceState(**service)
        else:
            raise HTTPException(status_code=404, detail="Service not found")

    except Exception as e:
        logger.error(f"Error fetching service: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# UPDATE SERVICE
# ==============================================
@router.patch("/update/{mongo_id}", response_model=ServiceState)
async def patch_service_by_mongo_id(mongo_id: str,request: Request, service_update: ServicePost = Body(...),
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_pending","edit")
    )):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)
 
    try:
       
        obj_id = ObjectId(mongo_id)
        existing = await collection.find_one({"_id": obj_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Service not found")

        update_data = service_update.dict(exclude_unset=True, exclude_none=True)
        for protected in ["serviceId", "createdDate", "_id", "mongoId"]:
            update_data.pop(protected, None)

        # Check if we need to recalculate
        recalc_keys = [
            "descriptions", "from_dates", "to_dates", "fees",
            "desc_tax_types", "desc_tax_pers", "quantity", "remarks",
            "desc_discount_percentages", "desc_discount_amounts", "include_tax",
            "desc_individual_discount_amounts",
            "overallDiscountValue", "overallDiscountType", "overallDiscountAppliedOn",
            "roundOffValue", "totalFreightAmount", "totalFreightTaxAmount"
        ]
        needs_recalc = any(k in update_data for k in recalc_keys)

        if needs_recalc:
            # Merge with existing data - NO preserve_existing_discounts parameter!
            service_dict = {
                "fees": update_data.get('fees', existing.get('fees', [])),
                "desc_tax_types": update_data.get('desc_tax_types', existing.get('desc_tax_types', [])),
                "desc_tax_pers": update_data.get('desc_tax_pers', existing.get('desc_tax_pers', [])),
                "desc_individual_discount_amounts": update_data.get('desc_individual_discount_amounts', existing.get('desc_individual_discount_amounts', [])),
                "desc_discount_amounts": update_data.get('desc_discount_amounts', existing.get('desc_discount_amounts', [])),
                "desc_discount_percentages": update_data.get('desc_discount_percentages', existing.get('desc_discount_percentages', [])),
                "quantity": update_data.get('quantity', existing.get('quantity', [])),
                "include_tax": update_data.get('include_tax', existing.get('include_tax', [])),
                "overallDiscountValue": update_data.get('overallDiscountValue', existing.get('overallDiscountValue', 0)),
                "overallDiscountAppliedOn": update_data.get('overallDiscountAppliedOn', existing.get('overallDiscountAppliedOn', 'after_tax')),
                "overallDiscountType": update_data.get('overallDiscountType', existing.get('overallDiscountType', 'percentage')),
                "roundOffValue": update_data.get('roundOffValue', existing.get('roundOffValue', 0)),
                "totalFreightAmount": update_data.get('totalFreightAmount', existing.get('totalFreightAmount', 0)),
                "totalFreightTaxAmount": update_data.get('totalFreightTaxAmount', existing.get('totalFreightTaxAmount', 0)),
                "sacCode": update_data.get('sacCode', existing.get('sacCode', [])),
                "descriptions": update_data.get('descriptions', existing.get('descriptions', [])),
                "remarks": update_data.get('remarks', existing.get('remarks', [])),
            }
            
            # Calculate totals - REMOVE the preserve_existing_discounts parameter
            totals = calculate_service_totals_with_proportional_discount(service_dict)
            
            # Update with calculated values
            update_data.update({
                "totalServiceFees": totals["total_service_fees"],
                "totalServiceTax": totals["total_service_tax"],
                "totalServiceDiscount": totals["total_service_discount"],
                "totalServiceAmount": totals["total_service_amount"],
                "totalFees": totals["total_fees"],
                "totalTax": totals["total_tax"],
                "totalDiscount": totals["total_discount"],
                "totalAmount": totals["total_final_amount"],
                "totalFreightAmount": totals["total_freight_amount"],
                "totalFreightTaxAmount": totals["total_freight_tax"],
                "desc_tax_amounts": totals["desc_tax_amounts"],
                "desc_totals": totals["desc_totals"],
                "base_amounts": totals["desc_base_per_units"],
                "desc_sgst": totals["desc_sgst"],
                "desc_cgst": totals["desc_cgst"],
                "desc_igst": totals["desc_igst"],
                "desc_individual_discount_amounts": totals["desc_individual_discount_amounts"],
                "desc_overall_discounts": totals["desc_overall_discounts"],
                "desc_discount_amounts": totals["desc_discount_amounts"],
                "desc_discount_percentages": totals["desc_discount_percentages"],
                "fees": totals["desc_fees"],
                "quantity": totals["desc_quantity"],
            })

        current_date_only = get_current_date_only()
        update_data['lastUpdatedDate'] = current_date_only
        update_data['lastUpdatedTime'] = current_date_only.strftime('%H:%M:%S')

        result = await collection.find_one_and_update(
            {"_id": obj_id},
            {"$set": update_data},
            return_document=True
        )

        if not result:
            raise HTTPException(status_code=500, detail="Update failed")

        result["_id"] = str(result["_id"])
        result["mongoId"] = str(result["_id"])

        # Debug print
        print(f"✅ UPDATED SERVICE - ID: {mongo_id}")
        print(f"  Discount Mode: {result.get('overallDiscountAppliedOn')}")
        print(f"  Final Amount: {result.get('totalAmount', 0)}")
        print(f"  Total Tax: {result.get('totalTax', 0)}")

        for field in ['workOrderDate', 'approvedDate', 'rejectedDate', 'invoiceDate', 'createdDate', 'lastUpdatedDate']:
            if result.get(field) and isinstance(result[field], datetime):
                result[field] = result[field].isoformat()

        logger.info(f"Service patched successfully - mongoId: {mongo_id}")
        return ServiceState(**result)

    except Exception as e:
        logger.error(f"Error patching service by mongoId {mongo_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
# ==============================================
# DESCRIPTIONS TOTALS ENDPOINT
# ==============================================
@router.get("/descriptions/totals")
async def get_description_totals(
    description: str = Query(..., description="Description text"),
    fromDate: Optional[str] = Query(None, description="From date"),
    toDate: Optional[str] = Query(None, description="To date"),
    quantity: float = Query(1.0, ge=0.01, description="Quantity"),
    fee: float = Query(..., ge=0, description="PER UNIT amount (WITH TAX)"),
    taxType: str = Query(..., description="Tax type: 'cgst_sgst' or 'igst'"),
    taxPer: float = Query(0, ge=0, le=99.99, description="Tax percentage"),
    discount: float = Query(0, ge=0, description="Discount amount (total, not per unit)"),
    remarks: Optional[str] = Query(None, description="Remarks"),
    include_tax: bool = Query(True, description="User preference - ALWAYS send fee with tax")
):
    """Calculate totals for a single service description."""
    try:
        if taxType not in ["cgst_sgst", "igst"]:
            raise HTTPException(status_code=400, detail="Invalid taxType")
        
        # Parse dates
        from_date_parsed = None
        to_date_parsed = None
        
        if fromDate:
            try:
                from_date_parsed = parse_datetime_to_utc_date_only(fromDate)
            except:
                pass
        
        if toDate:
            try:
                to_date_parsed = parse_datetime_to_utc_date_only(toDate)
            except:
                pass
        
        # CRITICAL: fee is PER UNIT WITH TAX
        result = calculate_single_description_totals(
            description=description,
            from_date=from_date_parsed,
            to_date=to_date_parsed,
            tax_type=taxType,
            fee=fee,  # PER UNIT WITH TAX
            tax_per=taxPer,
            discount=discount,
            quantity=quantity
        )
        
        # Add include_tax flag for frontend
        result["include_tax"] = include_tax
        
        return result
        
    except Exception as e:
        logger.error(f"Error calculating description totals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================
# APPROVE / REJECT ENDPOINTS
# ==============================================
@router.patch("/approved/{mongo_id}")
async def approve_service(mongo_id: str,request: Request,
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_pending","approve")
    )):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
       
        obj_id = ObjectId(mongo_id)
        service = await collection.find_one({"_id": obj_id})
        if not service:
            raise HTTPException(status_code=404, detail="Service order not found")

        current_date_only = get_current_date_only()
        updated_fields = {
            'status': "Approved",
            'approvedDate': current_date_only,
            'lastUpdatedDate': current_date_only,
            'lastUpdatedTime': current_date_only.strftime('%H:%M:%S'),
        }

        result = await collection.find_one_and_update(
            {"_id": obj_id},
            {"$set": updated_fields},
            return_document=True
        )

        if not result:
            raise HTTPException(status_code=500, detail="Update failed")

        result["_id"] = str(result["_id"])
        logger.info(f"Service Order {service.get('serviceId')} approved successfully")

        return {
            "success": True,
            "message": "Service order approved successfully",
            "service": ServiceState(**result),
            "approved_date": current_date_only.isoformat()
        }

    except Exception as e:
        logger.error(f"Error approving service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.patch("/rejected/{mongo_id}")
async def reject_service(mongo_id: str, request: Request, request_body: ServiceRejectRequest = Body(...),
    user = Depends(validate_token),
    permissions: dict = Depends(
        check_permission("yenerp","serviceorders_pending","approve")
    )):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
     
        obj_id = ObjectId(mongo_id)
        service = await collection.find_one({"_id": obj_id})
        if not service:
            raise HTTPException(status_code=404, detail="Service order not found")

        current_date_only = get_current_date_only()
        updated_fields = {
            'status': "Rejected",
            'rejectedDate': current_date_only,
            'lastUpdatedDate': current_date_only,
            'lastUpdatedTime': current_date_only.strftime('%H:%M:%S'),
            'rejectionReason': request_body.reason,
            'serviceRejectedPerson': 'system'
        }

        existing_comments = service.get('statusComments', [])
        existing_comments.append({
            'status': 'Rejected',
            'comment': request_body.reason,
            'timestamp': current_date_only,
            'user': 'system'
        })
        updated_fields['statusComments'] = existing_comments

        result = await collection.find_one_and_update(
            {"_id": obj_id},
            {"$set": updated_fields},
            return_document=True
        )

        result["_id"] = str(result["_id"])
        logger.info(f"Service Order {service.get('serviceId')} rejected")

        return {
            "success": True,
            "message": "Service order rejected successfully",
            "service": ServiceState(**result),
            "rejected_date": current_date_only.isoformat(),
            "reason": request_body.reason
        }

    except Exception as e:
        logger.error(f"Error rejecting service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# STATUS UPDATE ENDPOINT
# ==============================================
@router.patch("/{service_id}/status")
async def update_service_status(service_id: str, request: Request,request_body: ServiceStatusUpdate):
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    valid_statuses = [
        "Pending", "Active", "Completed", "Cancelled",
        "On Hold", "Approved", "Rejected", "In Progress",
        "Delivered", "Closed", "Invoice Generated", "Paid"
    ]

    if request_body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    try:
     
        service = await collection.find_one({"serviceId": service_id})
        if not service:
            raise HTTPException(status_code=404, detail="Service order not found")

        current_date_only = get_current_date_only()
        updated_fields = {
            'status': request_body.status,
            'lastUpdatedDate': current_date_only,
            'lastUpdatedTime': current_date_only.strftime('%H:%M:%S')
        }

        if request_body.status == "Approved":
            updated_fields['approvedDate'] = current_date_only
            updated_fields['serviceApprovedPerson'] = 'system'
        elif request_body.status == "Rejected":
            updated_fields['rejectedDate'] = current_date_only
            updated_fields['serviceRejectedPerson'] = 'system'
        elif request_body.status == "Completed":
            updated_fields['completedDate'] = current_date_only
        elif request_body.status == "Delivered":
            updated_fields['deliveredDate'] = current_date_only
        elif request_body.status == "Invoice Generated":
            updated_fields['invoiceGeneratedDate'] = current_date_only
        elif request_body.status == "Paid":
            updated_fields['paidDate'] = current_date_only

        if request_body.comment:
            existing_comments = service.get('statusComments', [])
            existing_comments.append({
                'status': request_body.status,
                'comment': request_body.comment,
                'timestamp': current_date_only,
                'user': 'system'
            })
            updated_fields['statusComments'] = existing_comments

        result = await collection.find_one_and_update(
            {"serviceId": service_id},
            {"$set": updated_fields},
            return_document=True
        )

        result["_id"] = str(result["_id"])
        logger.info(f"Service Order {service.get('serviceId')} status updated to {request_body.status}")

        return {
            "success": True,
            "message": f"Service order status updated to {request_body.status}",
            "service": ServiceState(**result),
            "updated_date": current_date_only.isoformat(),
            "comment": request_body.comment
        }

    except Exception as e:
        logger.error(f"Error updating service status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# INVOICE UPDATE ENDPOINT
# ==============================================
@router.patch("/{service_id}/invoice")
async def update_service_invoice(
    service_id: str,
     request: Request,
    invoiceNo: str = Query(..., description="Invoice number"),
    invoiceDate: str = Query(..., description="Invoice date (YYYY-MM-DD or ISO)")
):
    """Update service invoice details"""
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        invoice_date_parsed = parse_datetime_to_utc_full(invoiceDate)
        invoice_dt_parsed = invoice_date_parsed.replace(tzinfo=pytz.UTC)
        
        current_date_only = get_current_date_only()

        update_data = {
            "invoiceNo": invoiceNo,
            "invoiceDate": invoice_dt_parsed,
            "lastUpdatedDate": current_date_only,
            "lastUpdatedTime": current_date_only.strftime('%H:%M:%S')
        }

        result = await collection.update_one(
            {"serviceId": service_id},
            {"$set": update_data}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Service not found")

        logger.info(f"✅ Invoice updated for service: {service_id}")
        return {"message": "Invoice details updated successfully"}
    
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice date format. Use YYYY-MM-DD or ISO 8601")
    except Exception as e:
        logger.error(f"🔥 Error updating invoice: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# SEARCH ENDPOINTS
# ==============================================
@router.get("/search/vendor", response_model=List[ServiceState])
async def search_services_by_vendor( request: Request,
    vendorName: str = Query(..., description="Vendor name to search for")
):
    """Search services by vendor name"""
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
        query = {
            "vendorName": {"$regex": vendorName, "$options": "i"}
        }
     
        cursor = collection.find(query).sort("createdDate", -1).limit(100)
        services = await cursor.to_list(length=100)
     
        formatted_services = []
        for service in services:
            service["_id"] = str(service["_id"])
            formatted_services.append(ServiceState(**service))
     
        logger.info(f"✅ Found {len(formatted_services)} services for vendor: {vendorName}")
        return formatted_services
        
    except Exception as e:
        logger.error(f"🔥 Error searching services by vendor: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ==============================================
# DASHBOARD SUMMARY
# ==============================================
@router.get("/dashboard/summary")
async def get_service_dashboard_summary(request: Request):
    """Get dashboard summary for services."""
    tenant_id = request.state.tenant_id
    collection = get_serviceworkorder_collection(tenant_id)

    try:
       
        
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "totalAmount": {"$sum": "$totalAmount"}
                }
            }
        ]
        
        status_counts = await collection.aggregate(pipeline).to_list(length=100)
        
        total_services = await collection.count_documents({})
        total_amount = sum(item.get('totalAmount', 0) for item in status_counts)
        
        cursor = collection.find().sort("createdDate", -1).limit(10)
        recent_services = await cursor.to_list(length=10)
        
        for service in recent_services:
            service["_id"] = str(service["_id"])
        
        logger.info(f"✅ Dashboard summary retrieved: {total_services} total services")
        return {
            "totalServices": total_services,
            "totalAmount": round(total_amount, 2),
            "statusCounts": status_counts,
            "recentServices": recent_services
        }
        
    except Exception as e:
        logger.error(f"🔥 Error getting dashboard summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")