from pydantic import BaseModel, Field
from typing import List,Literal, Optional, Union
from datetime import datetime
# ============================================
# PYDANTIC MODELS FOR RESPONSE
# ============================================

class DebitItemDetail(BaseModel):
    itemId: str
    itemName: Optional[str] = None
    noteType: str  # "debit" or "credit"
    quantity: float
    uom: Optional[str] = None
    unitPrice: float
    totalPrice: float
    finalPrice: float
    reason: Optional[str] = None
    isAmountOnly: bool = False
    
    # Make these fields optional for amount-only notes
    taxAmount: Optional[float] = 0.0
    discountAmount: Optional[float] = 0.0
    taxPercentage: Optional[float] = 0.0
    discountPercentage: Optional[float] = 0.0
    amountOnlyReason: Optional[str] = None

    class Config:
        json_encoders = {float: lambda v: round(v, 2)}


class DebitNote(BaseModel):
    _id: str
    noteId: str
    grnId: Optional[str] = None  # Make optional for amount-only notes
    vendorName: str
    itemDetails: List[DebitItemDetail] = []
    createdDate: datetime
    createdBy: str
    lastUpdatedDate: datetime
    totalAmount: Optional[float] = 0.0
    totalTax: Optional[float] = 0.0
    totalDiscount: Optional[float] = 0.0
    finalAmount: float
    noteType: str  # "debit", "credit", or "amount_only"
    status: str
    returnDate: str
    randomId: str
    clearedAgainstOutgoing: Optional[str] = None
    clearedBy: Optional[str] = None
    clearedDate: Optional[datetime] = None
    paymentHistory: Optional[List[dict]] = []
    pendingAmount: Optional[float] = 0.0
    formattedCreatedDate: Optional[str] = None
    agingDay: Optional[int] = None
    
    # Additional fields for amount-only notes
    documentId: Optional[str] = None
    documentType: Optional[str] = None
    isAmountOnly: Optional[bool] = False
    remainingPayableAmount: Optional[float] = None
    debitAmount: Optional[float] = None  # Add this for amount-only notes
    reason: Optional[str] = None  # Add this for amount-only notes
    sourceDocument: Optional[dict] = None  # Add this for amount-only notes
    
    class Config:
        json_encoders = {float: lambda v: round(v, 2)}
        # Allow extra fields to handle different note types
        extra = "allow"


class DebitNoteResponse(BaseModel):
    noteId: str
    message: str
    totalAmount: Optional[float] = None  # For amount-only notes
    totalDebitAmount: Optional[float] = None  # For item-wise notes
    totalCreditAmount: Optional[float] = None  # For item-wise notes
    netAmount: float
    itemsProcessed: int
    remainingPayableAmount: Optional[float] = None
    sourceDocument: Optional[dict] = None
    noteNumber: Optional[str] = None  # Added for sequential note number

    class Config:
        json_encoders = {float: lambda v: round(v, 2)}


class DebitNoteViewItem(BaseModel):
    itemId: str
    itemName: str
    noteType: str
    quantity: float
    unitPrice: float
    totalPrice: float
    finalPrice: float
    reason: Optional[str] = None
    isAmountOnly: bool = False

class DebitNotePaymentHistory(BaseModel):
    date: datetime
    outgoingPaymentId: Optional[str] = None
    clearedBy: Optional[str] = None
    amount: float

class ComprehensiveDebitNoteView(BaseModel):
    noteId: str
    noteNumber: str  # Sequential note number (NOTE1, NOTE2, etc.)
    mongoId: Optional[str] = None  # Optional, not shown in UI
    documentId: str  # Show randomId/document reference, not ObjectId
    documentType: str  # "grn", "ap_invoice", "outgoing_payment"
    vendorName: str
    status: str  # "Active", "Cleared", "Partially Cleared"
    noteType: str  # "item_wise", "amount_only"
    isAmountOnly: bool
    
    # Financial Details
    totalAmount: float
    finalAmount: float
    pendingAmount: float
    remainingPayableAmount: Optional[float] = None
    
    # Dates
    createdDate: datetime
    createdBy: str
    createdDateFormatted: str
    agingDays: int
    
    # Clearance Information
    clearedAgainstOutgoing: Optional[str] = None
    clearedBy: Optional[str] = None
    clearedDate: Optional[datetime] = None
    
    # Items
    items: List[DebitNoteViewItem] = []
    
    # Payment History
    paymentHistory: List[DebitNotePaymentHistory] = []
    
    # Source Document Reference
    sourceDocumentRef: Optional[str] = None  # randomId of source document
    sourceDocumentDetails: Optional[dict] = None
    
    # Additional Info
    reason: Optional[str] = None
    comments: Optional[str] = None
    
    class Config:
        json_encoders = {
            float: lambda v: round(v, 2),
            datetime: lambda v: v.strftime("%d %B %Y, %I:%M %p")
        }

class DebitNotesSummary(BaseModel):
    documentId: str
    documentType: str
    totalActiveDebitNotes: int
    totalClearedDebitNotes: int
    totalAmount: float
    totalPendingAmount: float
    totalClearedAmount: float
    activeDebitNotes: List[ComprehensiveDebitNoteView]
    clearedDebitNotes: List[ComprehensiveDebitNoteView]
    availableForNewDebit: Optional[float] = None



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
