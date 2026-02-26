from datetime import datetime
from http.client import HTTPException
import logging
from typing import List, Optional, Union, Dict, Tuple
from collections import defaultdict
import csv
from io import StringIO, BytesIO
from middlewares.permission_middleware import check_permission
from dependencies.auth import validate_token
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from bson import ObjectId
from fastapi import APIRouter, Path, Query, HTTPException, Response,Depends,Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from utils.database import get_outgoingpayment_collection
router = APIRouter()
# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
class BaseModelWithConfig(BaseModel):
    """Base model with datetime configuration"""
   
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None
        }
        validate_assignment = True
        allow_population_by_field_name = True
class UpdatePaymentRequest(BaseModelWithConfig):
    # Non-default (required) fields first
    paymentType: str
    totalPayableAmount: float
    paymentMethod: str
    paymentMode: str
    # Default fields follow
    fullPaymentAmount: float = 0
    partialAmount: float = 0
    cashAmount: float = 0
    chequeNo: Optional[str] = None
    upi: Optional[str] = None
    bankName: Optional[str] = None
    impsNo: Optional[str] = None
    neftNo: Optional[str] = None
    rtgsNo: Optional[str] = None
    selectedDebitNotes: List[str] = []
    selectedAdvancePayments: List[str] = []
    paymentDate: Optional[datetime] = Field(None, description="ISO format datetime")
class PaymentHistoryEntry(BaseModelWithConfig):
    """Model for individual payment history entry"""
    amount: float
    paymentType: str
    paymentMethod: str
    paymentMode: str
    cashAmount: Optional[float] = 0
    bankName: Optional[str] = ""
    impsNo: Optional[str] = ""
    neftNo: Optional[str] = ""
    rtgsNo: Optional[str] = ""
    upi: Optional[str] = ""
    date: datetime
    debitNotesApplied: List[str] = []
    debitAmount: float = 0
    advancePaymentsApplied: List[str] = []
    advanceAmount: float = 0
    paymentId: Optional[str] = None # Made optional to handle legacy data without paymentId
class PaymentsByIdResponse(BaseModelWithConfig):
    """Response model for payments by ID (or all if no ID specified)"""
    paymentId: Optional[str] = None # Made optional to support "all" view
    totalPayments: int
    totalAmount: float
    payments: List[PaymentHistoryEntry]
    outgoings: List[dict] # Full outgoing docs (all details)
    page: int = 1
    limit: int = 10
    totalPages: int = 1
    hasNext: bool = False
    hasPrev: bool = False
@router.get("/payments/paymentwise", response_model=PaymentsByIdResponse)
async def get_payments_by_id(request:Request,
    payment_id: Optional[str] = Query(None, description="Optional Payment ID to filter by, e.g., PV0001. Omit for all payments."),
    date: Optional[datetime] = Query(None, description="Optional date filter: show payments from this date onwards (ISO format datetime)."),
    format: Optional[str] = Query(None, regex="^(json|csv|pdf)$", description="Response format: json (default), csv, or pdf."),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of results per page"), user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "paymenthistory", "read"))
):
    tenant_id = request.state.tenant_id
    outgoing_collection = get_outgoingpayment_collection(tenant_id)
    """
    GET endpoint to fetch payments (filtered by Payment ID if provided, otherwise all).
    Optionally filters by date (from specified date onwards).
    Supports export formats: json (default), csv, pdf.
    For PDF/CSV: Groups by vendor/outgoing, shows vendor name, amount, outgoing random ID,
    payment date range, invoice date range (formatted DD/MM/YYYY), paid amount for vendor.
    Each vendor/outgoing shown individually.
    """
    logger.info(f"Fetching payments for paymentId: {payment_id}, date: {date}, format: {format}, page: {page}, limit: {limit}")
   
    if outgoing_collection is None:
        logger.error("Outgoing collection not available")
        raise HTTPException(status_code=500, detail="Database connection error")
    export_mode = format and format != "json"
    if export_mode:
        # For exports, fetch all data (no pagination)
        fetch_page = 1
        fetch_limit = None
    else:
        fetch_page = page
        fetch_limit = limit
    try:
        # Build match conditions for outgoings
        match_conditions = []
        if payment_id:
            match_conditions.append({
                "$or": [
                    {"paymentId": payment_id},
                    {"paymentHistory.paymentId": payment_id}
                ]
            })
        if date:
            match_conditions.append({
                "paymentHistory.date": {"$gte": date}
            })
        if match_conditions:
            match_stage = {"$match": {"$and": match_conditions} if len(match_conditions) > 1 else match_conditions[0]}
        else:
            match_stage = {"$match": {}}
        # Build filter for relevantHistory
        cond_parts = []
        if payment_id:
            cond_parts.append({"$eq": ["$$history.paymentId", payment_id]})
        if date:
            cond_parts.append({"$gte": ["$$history.date", date]})
        if cond_parts:
            cond = {"$and": cond_parts} if len(cond_parts) > 1 else cond_parts[0]
            history_filter = {
                "$filter": {
                    "input": "$paymentHistory",
                    "as": "history",
                    "cond": cond
                }
            }
            history_project = {"relevantHistory": history_filter}
        else:
            history_filter = "$paymentHistory"
            history_project = {"relevantHistory": history_filter}
        # Build allHistory (unwind relevantHistory for total stats)
        all_history_unwind = {"$unwind": "$relevantHistory"}
        all_history_match = {"$match": {}}
        # Data stage for facet
        if export_mode:
            data_stage = [
                {"$project": {"_id": 0}}
            ]
        else:
            data_stage = [
                {"$skip": (fetch_page - 1) * fetch_limit},
                {"$limit": fetch_limit},
                {"$project": {"_id": 0}}
            ]
        # Aggregate query (add outgoing details like invoice_date if available)
        pipeline = [
            match_stage,
            {
                "$project": {
                    "_id": 0,
                    "randomId": 1,
                    "vendorName": 1, # Ensure vendorName is projected
                    "invoice_date": 1, # Assuming outgoing has invoice_date field; adjust if different
                    "paidAmount": 1,
                    **history_project
                }
            },
            {
                "$facet": {
                    "data": data_stage,
                    "total": [{"$count": "count"}],
                    "allHistory": [
                        all_history_unwind,
                        all_history_match,
                        {
                            "$group": {
                                "_id": None,
                                "totalPayments": {"$sum": 1},
                                "totalAmount": {"$sum": "$relevantHistory.amount"}
                            }
                        }
                    ]
                }
            }
        ]
        result = list(outgoing_collection.aggregate(pipeline))
        if not result:
            if payment_id:
                logger.warning(f"No payments found for paymentId: {payment_id}")
                raise HTTPException(status_code=404, detail=f"No payments found for Payment ID: {payment_id}")
            else:
                logger.warning("No outgoings found")
                if format == "csv":
                    return generate_csv([], payment_id, None, page, limit)
                elif format == "pdf":
                    return generate_pdf([], payment_id, None, page, limit)
                return PaymentsByIdResponse(
                    paymentId=None,
                    totalPayments=0,
                    totalAmount=0.0,
                    payments=[],
                    outgoings=[],
                    page=page,
                    limit=limit,
                    totalPages=0,
                    hasNext=False,
                    hasPrev=False
                )
        facet = result[0]
        # Extract data (full details now)
        outgoings_data = facet.get("data", [])
        total_count = facet["total"][0]["count"] if facet.get("total") else 0
        history_stats = facet["allHistory"][0] if facet.get("allHistory") else {"totalPayments": 0, "totalAmount": 0.0}
        # Extract all relevant history entries for the response (from paginated outgoings)
        all_payments = []
        for outgoing in outgoings_data:
            for hist in outgoing.get("relevantHistory", []):
                all_payments.append(PaymentHistoryEntry(**hist))
        # For exports, prepare grouped data
        if format == "csv" or format == "pdf":
            export_data, common_payment_date_str = prepare_export_data(outgoings_data, payment_id, date)
            if format == "csv":
                return generate_csv(export_data, payment_id, common_payment_date_str, page, limit)
            else: # pdf
                return generate_pdf(export_data, payment_id, common_payment_date_str, page, limit)
        # Pagination
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1
        response = PaymentsByIdResponse(
            paymentId=payment_id,
            totalPayments=history_stats["totalPayments"],
            totalAmount=round(history_stats["totalAmount"], 2),
            payments=all_payments,
            outgoings=outgoings_data, # Now full docs with all details
            page=page,
            limit=limit,
            totalPages=total_pages,
            hasNext=has_next,
            hasPrev=has_prev
        )
        logger.info(f"Retrieved {len(outgoings_data)} outgoings and {len(all_payments)} payments for {payment_id or 'all'} with date filter {date}")
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching payments for {payment_id or 'all'} with date {date}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
def format_date(dt: Optional[Union[datetime, str]]) -> str:
    """Format a single date (datetime or ISO string) as DD/MM/YYYY, or 'None' if missing."""
    if not dt:
        return "None"
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except ValueError:
            logger.warning(f"Invalid date format for parsing: {dt}. Returning 'None'.")
            return "None"
    return dt.strftime("%d/%m/%Y")
def format_date_range(date_from: Optional[Union[datetime, str]], date_to: Optional[Union[datetime, str]]) -> str:
    """Format date range as DD/MM/YYYY to DD/MM/YYYY or single date if same."""
    from_str = format_date(date_from)
    if not from_str or from_str == "None":
        return "None"
    to_str = format_date(date_to)
    if to_str == "None" or from_str == to_str:
        return from_str
    return f"{from_str} to {to_str}"
def prepare_export_data(outgoings_data: List[dict], payment_id: Optional[str], date: Optional[datetime]) -> Tuple[List[dict], Optional[str]]:
    """Prepare grouped export data: aggregate by vendor, sum amounts, compute date ranges, list outids. Also compute common payment date."""
    grouped: Dict[str, Dict] = {}
    all_payment_dates = []
    for outgoing in outgoings_data:
        vendor = outgoing.get("vendorName", "Unknown Vendor")  # Ensure fallback
        random_id = outgoing.get("randomId", "Unknown ID")
        paid_amount = outgoing.get("paidAmount", 0.0)
        invoice_date = outgoing.get("invoice_date")  # Assume datetime or ISO str; adjust if different
        # Collect all payment dates for common
        histories = outgoing.get("relevantHistory", [])
        for h in histories:
            d = h.get("date")
            if d:
                all_payment_dates.append(d)
        total_amount = sum(h.get("amount", 0) for h in histories)
        if vendor not in grouped:
            grouped[vendor] = {
                "vendor_name": vendor,
                "amount": 0.0,
                "outgoing_random_ids": [],
                "invoice_dates": [],
                "paid_amount": 0.0
            }
        grouped[vendor]["amount"] += total_amount
        grouped[vendor]["outgoing_random_ids"].append(random_id)
        grouped[vendor]["invoice_dates"].append(invoice_date)
        grouped[vendor]["paid_amount"] += paid_amount
    # Compute common payment date
    common_payment_date_str = None
    if all_payment_dates:
        parsed_dates = []
        for d in all_payment_dates:
            if isinstance(d, str):
                try:
                    parsed_dates.append(datetime.fromisoformat(d))
                except ValueError:
                    logger.warning(f"Invalid date format in history: {d}")
            elif isinstance(d, datetime):
                parsed_dates.append(d)
        if parsed_dates:
            min_payment = min(parsed_dates)
            common_payment_date_str = format_date(min_payment)
    if not common_payment_date_str:
        common_payment_date_str = "N/A"
    # Sort by vendor name and prepare export list
    export_list = []
    for vendor in sorted(grouped.keys()):
        data = grouped[vendor]
        if not data["outgoing_random_ids"]:
            continue
        # Parse and find min/max for invoice dates
        parsed_invoice_dates = []
        for d in data["invoice_dates"]:
            if isinstance(d, str):
                try:
                    parsed_invoice_dates.append(datetime.fromisoformat(d))
                except ValueError:
                    logger.warning(f"Invalid invoice date format: {d}")
            elif isinstance(d, datetime):
                parsed_invoice_dates.append(d)
        min_invoice = min(parsed_invoice_dates) if parsed_invoice_dates else None
        max_invoice = max(parsed_invoice_dates) if parsed_invoice_dates else None
        invoice_range = format_date_range(min_invoice, max_invoice)
        # Outgoing IDs as comma-separated string
        outids_str = ", ".join(sorted(set(data["outgoing_random_ids"])))  # Unique and sorted
        export_entry = {
            "vendor_name": vendor,
            "amount": data["amount"],
            "outgoing_random_id": outids_str,
            "invoice_date_range": invoice_range,
            "paid_amount": data["paid_amount"]
        }
        export_list.append(export_entry)
    return export_list, common_payment_date_str
def generate_csv(export_data: List[dict], payment_id: Optional[str], common_date: Optional[str], page: int, limit: int) -> Response:
    """Generate CSV response."""
    output = StringIO()
    fieldnames = ["Vendor Name", "Total Amount", "Outgoing Random ID", "Invoice Date Range", "Paid Amount"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in export_data:
        csv_row = {
            "Vendor Name": row["vendor_name"],
            "Total Amount": f"₹{row['amount']:.2f}",
            "Outgoing Random ID": row["outgoing_random_id"],
            "Invoice Date Range": row["invoice_date_range"],
            "Paid Amount": f"₹{row['paid_amount']:.2f}"
        }
        writer.writerow(csv_row)
    csv_content = output.getvalue()
    date_str = common_date.replace('/', '_') if common_date and common_date != "N/A" else 'all_dates'
    filename = f"payment_export_{payment_id or 'all'}_{date_str}.csv"
    return StreamingResponse(
        iter([csv_content.encode("utf-8")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
def generate_pdf(export_data: List[dict], payment_id: Optional[str], common_date: Optional[str], page: int, limit: int) -> Response:
    """Generate PDF response using ReportLab."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1  # Center
    )
    story.append(Paragraph("Payment Voucher", title_style))
    story.append(Spacer(1, 0.2 * inch))
    # Reference and Date
    ref_style = ParagraphStyle(
        'RefStyle',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=6,
        alignment=0  # Left
    )
    story.append(Paragraph(f"Payment Reference: {payment_id or 'N/A'}", ref_style))
    story.append(Paragraph(f"Payment Date: {common_date}", ref_style))
    story.append(Spacer(1, 0.3 * inch))
    # Data Table
    data = [["Vendor Name", "Total Amount", "Outgoing Random ID", "Invoice Date Range", "Paid Amount"]]
    for row in export_data:
        data.append([
            row["vendor_name"],
            f"₹{row['amount']:.2f}",
            row["outgoing_random_id"],
            row["invoice_date_range"],
            f"₹{row['paid_amount']:.2f}"
        ])
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Vendor
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),  # Amount
        ('ALIGN', (2, 1), (2, -1), 'LEFT'),  # Out ID
        ('ALIGN', (3, 1), (3, -1), 'LEFT'),  # Invoice
        ('ALIGN', (4, 1), (4, -1), 'RIGHT'),  # Paid
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(table)
    doc.build(story)
    buffer.seek(0)
    date_str = common_date.replace('/', '_') if common_date and common_date != "N/A" else 'all_dates'
    filename = f"payment_export_{payment_id or 'all'}_{date_str}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )