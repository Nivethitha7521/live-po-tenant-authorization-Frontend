
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
// Interface for Outgoing item
export interface Outgoing {
  outgoingId: string;
  purchaseOrderId?: string;
  grnId: string;
  invoiceId: string;
  poRandomId: string;
  grnRandomId: string;
  apRandomId: string;
  vendorName?: string;
  orderDate?: Date | null;
  grnDate?: Date | null;
  invoiceDate?: Date | null;
  invoiceNo?: string;
  apinvoiceDate?: Date | null;
  poDate?: Date | null;
  receivingLocation?: string;
  payableAmount: number;
  totalPayableAmount?: number;
  comments?: string;
  createdDate?: Date | null;
  lastUpdatedDate?: Date | null;
  poCreatedPerson?: string;
  grnCreatedPerson?: string;
  apCreatedPerson?: string;
  grnVerifiedPerson?: string;
  apVerifiedPerson?: string;
  paymentMethod?: string;
  paymentDate: Date | null;
  advanceAmount?: number;
  totalPrice?: number;
  partialAmount?: number;
  fullPaymentAmount?: number;
  chequeNo?: number;
  paidAmount?:number;
  paymentType: string;
  onlinePayment?: number;
  intimationDays: string | null;
  itemDetails: ItemDetails[];
  discountDetails?: number;
  paymentMode: string;
  taxDetails: number;
  neftNo?: string;
  rtgsNo?: string;
  cashVoucherNo?: string;
  impsNo: string;
  upi: string;
  paymentCash: string;
  pettyCashAmount: number;
  hoCash: number;
  status?: string;
  randomId?: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: number;
  gstNumber: string;
  contactpersonEmail: string;
  shippingAddress: string;
  paymentTerms: string;
  billingAddress: string;
  bankName: string;
  hasDebitCreditNotes:boolean;
  debitAmount:number;
  invoiceplusdebit:number;
  selectedDebitNotes?: string[]; // Add this to support debit notes
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
  cashVoucherNo?: string;
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
  pettyCashAmount?: number;
  hoCash?: number;
  bankName?: string;
  selectedDebitNotes: string[];
}

export interface BulkPaymentRequest {
  payments: PaymentInfo[];
  outgoingIds: string[];
}