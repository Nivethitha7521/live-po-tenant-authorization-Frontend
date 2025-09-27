
export interface ItemDetails {
  itemId: string;
  purchasetaxName: number;
  taxType: string;
  sgst: number;
  cgst: number;
  igst: number;
  taxAmount: number;
  hsnCode: string;
}
export interface Outgoing {
  outgoingId: string;
  purchaseOrderId?: string;
  grnId: string;
  invoiceId: string;
  poRandomId?: string;
  grnRandomId?: string;
  apRandomId?: string;
  vendorName?: string;
  orderDate?: string;
  grnDate?: string;
  outgoingDate?: string;
  createdDate?: Date | string;
  lastUpdatedDate?: Date | string;
  invoiceDate?: Date | null;
  poDate?: string;
  paymentDate?:Date;
  apinvoiceDate?: string;
  receivingLocation?: string;
  totalPayableAmount?: number;
  paidAmount?: number;
  comments?: string;
  invoiceNo?: string;
  poCreatedPerson?: string;
  grnCreatedPerson?: string;
  apCreatedPerson?: string;
  grnVerifiedPerson?: string;
  apVerifiedPerson?: string;
  intimationDays?: number;
  paymentMethod?: string;
  paymentMode?: string;
  advanceAmount?: number;
  totalPrice?: number;
  payableAmount?: number;
  partialAmount?: number;
  fullPaymentAmount?: number;
  paymentType?: string;
  chequeNo?: number;
  onlinePayment?: number;
  discountDetails?: number;
  taxDetails?: number;
  neftNo?: string;
  rtgsNo?: string;
  cashAmount:number;
  impsNo?: string;
  upi?: string;
  status?: string;
  randomId?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: number;
  gstNumber?: string;
  contactpersonEmail?: string;
  paymentTerms: string;
  shippingAddress?: string;
  billingAddress?: string;
  bankName?: string;
  hasDebitCreditNotes?: boolean;
  debitAmount?: number;
  selectedDebitNotes?: string[];
  paymentHistory?: PaymentHistory[];
  itemDetails?: ItemDetails[];
}

export interface TaxDetail {
  id: string;
  taxName: string;
  taxPercentage: number;
}

export interface TaxDetailsState {
  taxDetails: TaxDetail[];
  loading: boolean;
  error: string | null;
}
export interface GRN {
  grnId: string;
  randomId: string;
}
export interface Bank {
  bankMasterId: string;
  bankName: string;
  acountNumber: string;
  confirmAcountNumber: string;
  ifscCode: string;
  branchName: string;
}
export interface DebitNote {
  randomId: string;
  noteId: string;
  vendorName: string;
  totalAmount: number;
  finalAmount:number;
  status: string;
  createdDate: string;
}
export interface VendorPayment {
  outgoingIds: string[];
  paymentType: 'full' | 'partial' ;
  amount: number;
  selectedDebitNotes: string[];
}
export interface PaymentHistory {
  amount?: number;
  paymentType?: string;
  paymentMethod?: string;
  paymentMode?: string;
  cashAmount:number;
  bankName?: string;
  impsNo?: string;
  neftNo?: string;
  rtgsNo?: string;
  upi?: string;
  date?: string; // ISO string to match datetime in Pydantic
  debitNotesApplied?: string[];
  debitAmount?: number;
}
// Interface for Outgoing slice state
export interface OutgoingState {
  outgoings: Outgoing[];  // List of outgoings
  outgoingvendor: VendorDetail[];
  grns: GRN[];
  taxDetails: TaxDetail[];
  banks: Bank[];
  multiplePayments: PaymentDone[];
  debits: DebitNote[];
  loading: boolean;       // Loading state
  error: string | null;
  snackbarOpen: boolean;  // For showing notification
  snackbarMessage: string; // Message for notifications
  searchQuery: string;    // Search functionality
  editIndex: number | null;  // Index for editing an item
  dialogOpen: 'none' | 'edit';  // Modal state (edit or none)
  daysFilterDate: number | null;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  intimationData: Outgoing[];     // Assuming it's an array of Outgoing items
  vendorPayments: { [vendorName: string]: VendorPayment }; // Added for multiple payments
  vendorDebits: { [vendorName: string]: any[] }; // Added for debit notes per vendor
}


export interface PaymentDone {
  outgoingIds: string[];
  invoiceDate: string[];
  invoiceNo: string[];
  vendorName: string[];
  totalPayableAmount: number[];
  fullPaymentAmount: number[];
  paymentType: string;
  cashVoucherNo: string;
  chequeNo: string;
  neftNo: string;
  rtgsNo: string;
  totalPaymentAmount: number;
  onlinePayment: number;
  status: string;
}

export interface VendorDetail {
  vendorName: string;
  count: number;
  totalAmount: number;
  statuses: string[];
}

export interface PaymentDetails {
  outgoingId: string;
  paymentType: 'full' | 'partial' | 'advance';
  amount: number;
  vendorName: string;
  paymentMethod: string;
  chequeNo?: string;
  neftNo?: string;
  cashAmount:number;
  rtgsNo?: string;
  transactionNumber?: string;
  bankName: string;
}
// Initial state for Outgoing slice
export const initialState: OutgoingState = {
  outgoings: [],
  outgoingvendor: [],
  taxDetails: [],
  grns: [],
  debits: [],
  multiplePayments: [],
  loading: false,
  snackbarOpen: false,
  snackbarMessage: '',
  searchQuery: '', // Initial search query is empty
  editIndex: null,
  dialogOpen: 'none',
  error: null,
  daysFilterDate: null,
  banks: [],
  currentPage: 1,    // Start from page 1
  pageSize: 50,      // Default page size
  totalItems: 0,     // Set totalItems to 0 initially  
  intimationData: [],
  vendorPayments: {},
  vendorDebits: {},
};


// Add this to your types
export interface BulkPaymentResponse {
  results: Array<{
    outgoingId: string;
    message: string;
    pendingAmount: number;
    totalPayableAmount: number;
    paymentAmount: number;
    debitAmountApplied: number;
    paymentType: string;
    status: string;
    debitNotesApplied: string[];
  }>;
  errors: Array<{
    outgoingId?: string;
    debitNoteId?: string;
    error: string;
  }>;
  totalProcessed: number;
  totalFailed: number;
}

export interface PaymentInfo {
  paymentMode: 'Bank' | 'Cash';
  paymentType: 'full' | 'partial';
  fullPaymentAmount?: number;
  partialAmount?: number;
  paymentMethod?: string;
  chequeNo?: string;
  neftNo?: string;
  rtgsNo?: string;
  impsNo?: string;
  upi?: string;
  cashAmount:number;
  bankName?: string;
  selectedDebitNotes: string[];
}

export interface BulkPaymentRequest {
  payments: PaymentInfo[];
  outgoingIds: string[];
}