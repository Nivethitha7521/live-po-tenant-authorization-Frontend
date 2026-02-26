# Full updated bulkpayment_models.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date

class BaseModelWithConfig(BaseModel):
    class Config:
        validate_assignment = True
        allow_population_by_field_name = True
        # Note: json_encoders is v1; for v2, we'll handle serialization manually in the response

class PaymentInfo(BaseModelWithConfig):
    outgoingId: str
    paymentType: str
    totalPayableAmount: float
    paymentMethod: str
    paymentMode: str
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

class BulkPaymentRequest(BaseModelWithConfig):
    payments: List[PaymentInfo]
    outgoingIds: List[str]
    paymentDate: Optional[date] = None  # Changed to date for proper type handling

class PaymentResult(BaseModelWithConfig):
    outgoingId: str
    message: str
    effectivePaymentAmount: float
    debitAmount: float
    advanceAmount: float
    originalTotalPayableAmount: float
    remainingPayableAmount: float
    totalPaidAmount: float
    totalDebitAmount: float
    status: str
    vendorPayableReduction: float
    debitNotesApplied: List[str] = []
    advancePaymentsApplied: List[str] = []
    paymentDate: Optional[date] = None  # Changed to date for proper type handling

class BulkPaymentResponse(BaseModelWithConfig):
    results: List[PaymentResult]
    errors: List[dict]
    totalProcessed: int
    totalFailed: int
    totalVendorReduction: float
    paymentId: Optional[str] = None  # Added shared PaymentID for bulk