import { Freight, PurchaseRandomId } from "./purchaseModel";

// ====== CORE INTERFACES ======
export interface ItemDetail {
  itemId: string;
  itemName?: string;
  nos: number;
  eachQuantity: number;
  quantity: number;
  receivedQuantity: number;
  returnedQuantity: number;
  totalQuantity?: number;
  hsnCode: string;
  befTaxDiscount: number;
  afTaxDiscount: number;
  befTaxDiscountAmount: number;
  afTaxDiscountAmount: number;
  discount?: number;
  purchasecategoryName: string;
  purchasesubcategoryName: any;
  expiryDate: Date | null;
  damagedQuantity: number;
  discountAmount: number;
  taxAmount: number;
  taxType: 'cgst_sgst' | 'igst';
  igst: number;
  purchasetaxName: number;
  uom?: string;
  unitPrice: number;
  totalPrice: number;
  finalPrice: number;
  grnPrice: number;
  status?: string;
  barcode?: string;
  sgst: number;
  cgst: number;
  returnedTotalPrice?: number;
  returnedTaxAmount?: number;
  returnedDiscountAmount?: number;
  returnedFinalPrice?: number;
  returnedSgst?: number;
  returnedCgst?: number;
  returnHistory?: ReturnHistory[];
}

export interface GrnData {
  grnId: string;
  purchaseOrderId: string;
  poRandomID: string;
  vendorName: string;
  grnDate: Date;
  grnAmount: number;
  grnVerifiedDate: Date;
  grnReturnedDate: Date;
  agingDay: number;
  poDate: string;
  invoiceDate: Date | null;
  invoiceNo: string;
  receivingLocation: string;
  itemDetails: ItemDetail[];
  inspectionStatus: string;
  discountPrice: number;
  totalDiscount: number;
  totalTax: number;
  receivedBy: string;
  totalReceivedAmount: number;
  comments: string;
  attachments: string | null;
  createdDate: Date | null;
  lastUpdatedDate: Date | null;
  shippingAddress: string;
  billingAddress: string;
  status: string;
  randomId: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: number;
  paymentTerms: string;
  gstNumber: string;
  contactpersonEmail: string;
  grnVerifiedPerson: string;
  grnReturnedPerson: string;
  totalDebitAmount?: number;
  totalReturnedAmount?: number;
  totalReturnedTax?: number;
  totalReturnedDiscount?: number;
  hasDebitCreditNotes: boolean;
  apRoundOff: number;
  grnRoundOffAmount: number;
  totalFreightAmount: number;
  totalFreightTaxAmount: number;
  freights: Freight[];
}

export interface TaxDetails {
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
}

export interface ItemDetailResponse {
  itemId: string;
  itemName: string;
  receivedQuantity: number;
  returnedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  purchasetaxName: number;
  quantity: number;
  discountAmount: number;
  finalPrice: number;
}

export interface GrnResponse {
  grnId: string;
  randomId: string;
  vendorName: string;
  grnDate: Date;
  itemDetails: ItemDetailResponse[];
}

// ====== RETURN RELATED INTERFACES ======
export interface ReturnItemDetail {
  itemId: string;
  nos?: number;
  eachQuantity?: number;
  returnedQuantity: number;
  returnReason?: string;
}

export interface ReturnHistory {
  date?: string;
  by?: string;
  totalUnits?: number;
  reason?: string;
}

export interface ReturnGRNRequest {
  scenario: 'full' | 'partial';
  returnedDate: string;
  returnedBy: string;
  comments?: string;
  items?: ReturnItemDetail[];
}

export interface ReturnReason {
  reason: string;
  createdDate: Date | null;
}

// ====== DEBIT/CREDIT NOTE INTERFACES ======
export interface DebitCreditItemRequest {
  itemId: string;
  itemName?: string;
  noteType: 'debit' | 'credit';
  quantity: number;
  reason?: string;
}

export interface CreateDebitNoteRequest {
  documentId: string;
  documentType: 'grn' | 'ap_invoice' | 'outgoing_payment';
  items: DebitCreditItemRequest[];
  createdBy: string;
  comments?: string;
}

export interface DebitCreditNoteResponse {
  noteId: string;
  message: string;
  totalDebitAmount: number;
  totalCreditAmount: number;
  netAmount: number;
  itemsProcessed: number;
  noteType?: 'quantity_based' | 'amount_only';
  sourceDocument?: any;
}

export interface DebitCreditItemDetails {
  itemId: string;
  itemName: string;
  noteType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
  discountAmount: number;
  finalPrice: number;
  sgst: number;
  cgst: number;
  igst: number;
  reason: string;
  isAmountOnly?: boolean;
}

export interface DebitCreditNote {
  noteId: string;
  grnId: string;
  randomId: string;
  noteType?: 'quantity_based' | 'amount_only';
  isAmountOnly?: boolean;
  vendorName: string;
  itemDetails: DebitCreditItemDetails[];
  createdDate: Date;
  createdBy: string;
  lastUpdatedDate: string;
}

export interface AmountDebitNoteRequest {
  documentId: string;
  documentType: 'grn' | 'ap_invoice' | 'outgoing_payment';
  totalAmount: number;  // Changed from 'amount' to 'totalAmount'
  reason: string;
  createdBy: string;
  comments?: string;
}
export interface AmountDebitNoteResponse {
  success: boolean;
  noteId: string;
  mongoId: string;
  message: string;
  totalAmount: number;
  grnId?: string;  // Make optional since it's only for GRN documents
  finalAmount: number;
  reason: string;
  apInvoiceId?: string;  // For AP invoice documents
  remainingPayableAmount: number;
  createdAt: string;
  noteNumber: string;
  sourceDocument?: {
    type: string;
    id: string;
    randomId: string;
    available_before: number;
    existing_notes_before: number;
    original_totalPayableAmount: number;
    original_payableAmount: number;
  };
  note?: string;
  originalAmounts?: {
    totalPayableAmount: number;
    payableAmount: number;
    totalPrice: number;
  };
}

// ====== OTHER INTERFACES ======
export interface Vendor {
  vendorId: string;
  vendorName: string;
  contactpersonPhone: string;
}

export interface PurchaseItem {
  purchaseitemId: string;
  itemName: string;
  purchasetaxName: number;
  purchasePrice: number;
  uom: string;
}

export interface PurchaseOrder {
  purchaseOrderId: string;
  randomId: string;
  itemName: string;
}

export interface ItemDetails {
  itemId: string;
  itemName: string;
  nos: number;
  eachQuantity: number;
  quantity: number;
  uom: string;
  purchasecategoryName: string;
  purchasesubcategoryName: any;
  taxType: 'cgst_sgst' | 'igst';
  igst: number;
  cgst: number;
  sgst: number;
  befTaxDiscount: number;
  afTaxDiscount: number;
  befTaxDiscountAmount: number;
  afTaxDiscountAmount: number;
  discountAmount: number;
  taxAmount: number;
  hsnCode: string;
  purchasetaxName: number;
  stockQuantity: number;
  unitPrice: number;
  totalPrice: number;
  finalPrice: number;
  status: string;
}

export interface ApInvoice {
  invoiceId: string;
  vendorName: string;
  purchaseOrderId: string;
  grnId: string;
  apinvoiceDate: Date | null;
  grnDate: Date | null;
  invoiceDate: Date | null;
  invoiceNo: string;
  shippingAddress: string;
  billingAddress: string;
  poDate: Date | null;
  dueDate: Date | null;
  invoiceAmount: number;
  taxDetails: number;
  discountDetails: number;
  discountPrice: number;
  apDiscountPrice: number;
  paymentTerms: string;
  paymentStatus: string;
  itemDetails: ItemDetails[];
  comments: string;
  attachments: string | null;
  createdDate: Date | null;
  lastUpdatedDate: Date | null;
  status: string;
  randomId: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: number;
  gstNumber: string;
  contactpersonEmail: string;
}
// Add this interface for detailed stock update items
export interface StockUpdateItem {
  randomId: string;
  itemName: string;
  stockChange: number;           // Item Master stock change (negative for revert)
  newStock: number;               // Item Master new total stock
  locationStockChange?: number;   // Location-specific stock change (negative for revert)
  newLocationStock?: number;      // Location-specific new stock
  locationId?: string;            // Location ID
  priceUpdated: boolean;
  status: 'success' | 'failed';
  reason?: string;
}

// Update the StockUpdateResult interface
export interface StockUpdateResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  items: StockUpdateItem[];       // Detailed item-level information
  timestamp: string;
  purchaseitem_updates: number;
  inventory_updates: number;
  inventory_creates: number;
  errors: number;
}

// Update the RevertGrnToPOResponse interface
export interface RevertGrnToPOResponse {
  message: string;
  purchaseOrderId: string;
  grnId: string;
  poStatus: string;
  itemStatus: string;
  revertedItemsCount: number;
  pendingOrderAmount: number;
  totalOrderAmount?: number;
  stockUpdates?: StockUpdateResult; // Add this optional property
  canBeReUpdated?: boolean;
  pendingGrnId?: string;
}
// Add this interface near the top of your grnSlice.ts file
export interface ReturnStockUpdateResult {
  purchaseitem_updates: number;
  inventory_updates: number;
  inventory_not_found: number;
  inventory_errors: number;
  items?: ReturnStockUpdateItem[];
  message?: string;  // Add this line
  success?: boolean;  // Add this line
}

export interface ReturnStockUpdateItem {
  randomId: string;
  itemName: string;
  quantityToReduce: number;
  status: 'success' | 'failed';
  reason?: string;
  beforeStock?: number;
  afterStock?: number;
  beforeLocationStock?: number;
  afterLocationStock?: number;
}
// ====== FETCH INTERFACES ======
export interface FetchGrnsReturnPayload {
  grns: GrnData[];
  totalItems: number;
  hasDebitCreditNotes: Record<string, boolean>;
}

export interface FetchGrnsPayload {
  grns: GrnData[];
  totalItems: number;
  hasDebitCreditNotes: Record<string, boolean>;
}

export interface FetchGrnsArgs {
  page: number;
  size: number;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  vendorName?: string;
  dateFilterField?: 'grnDate' | 'grnVerifiedDate' | 'grnReturnedDate';
  daysFilterDate?: number;
}

// ====== GRN STATE INTERFACE ======
export interface GrnState {
  // Core data
  grns: GrnData[];
  itemwise: GrnData[];
  itemDetails: ItemDetail[];

  // UI state
  searchQuery: string;
  selectedGrnId: string | null;
  view: 'grn';
  error: string | null;
  newItem: ItemDetail;

  // Related data
  vendors: Vendor[];
  purchaseitems: PurchaseItem[];
  purchaseorders: PurchaseRandomId[];
  apinvoice: ApInvoice[];

  // Loading states
  loading: boolean;
  updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';

  // Notification
  snackbarMessageGRN: string;
  snackbarOpenGRN: boolean;

  // Table settings
  selectedHeaders: string[];

  // Pagination
  currentPage: number;
  pageSize: number;
  totalItems: number;

  // Debit/Credit notes
  debitCreditNotes: DebitCreditNote[];
  hasDebitCreditNotes: { [grnId: string]: boolean };

  // Return reasons
  returnReasons: ReturnReason[];

  // Revert-related
  revertLoading: boolean;
  revertError: string | null;
  revertedGrns: GrnData[];
  revertHistory: Array<{
    grnId: string;
    purchaseOrderId: string;
    revertedAt: string;
    poAction: 'updated' | 'created';
  }>;

  // Debit note loading states
  amountDebitNoteLoading: boolean;
  debitCreditNoteLoading: boolean;
  amountDebitNoteError: string | null;
  debitCreditNoteError: string | null;

  lastRevertStockUpdates?: StockUpdateResult;
  lastRevertedGrnId?: string | null;
  showStockUpdateDialog?: boolean;

    // RETURN STOCK UPDATES - ADD THESE LINES
  lastReturnStockUpdates?: ReturnStockUpdateResult;
  lastReturnedGrnId?: string | null;
  showReturnStockUpdateDialog: boolean;
}

// ====== INITIAL STATE ======
export const initialState: GrnState = {
  grns: [],
  itemwise: [],
  itemDetails: [],
  searchQuery: '',
  selectedGrnId: null,
  view: 'grn',
  error: null,
  newItem: {
    itemId: '',
    itemName: '',
    quantity: 0,
    unitPrice: 0,
    returnedQuantity: 0,
    uom: '',
    expiryDate: null,
    purchasetaxName: 0,
    befTaxDiscount: 0,
    afTaxDiscount: 0,
    befTaxDiscountAmount: 0,
    afTaxDiscountAmount: 0,
    receivedQuantity: 0,
    damagedQuantity: 0,
    totalPrice: 0,
    status: '',
    sgst: 0,
    cgst: 0,
    barcode: '',
    discount: 0,
    discountAmount: 0,
    taxAmount: 0,
    finalPrice: 0,
    nos: 0,
    eachQuantity: 0,
    taxType: 'igst',
    igst: 0,
    purchasecategoryName: '',
    purchasesubcategoryName: undefined,
    hsnCode: '',
    returnHistory: [],
    returnedTotalPrice: 0,
    returnedTaxAmount: 0,
    returnedDiscountAmount: 0,
    returnedFinalPrice: 0,
    returnedSgst: 0,
    returnedCgst: 0,
    grnPrice: 0
  },
  vendors: [],
  purchaseitems: [],
  purchaseorders: [],
  apinvoice: [],
  loading: false,
  updateStatus: 'idle',
  snackbarMessageGRN: '',
  snackbarOpenGRN: false,
  selectedHeaders: [
    'itemName', 'uom', 'unitPrice', 'befTaxDiscount', 'afTaxDiscount',
    'purchasetaxName', 'nos', 'eachQuantity', 'receivedQuantity',
    'returnedQuantity', 'totalQuantity', 'expiryDate', 'totalPrice'
  ],
  currentPage: 1,
  pageSize: 50,
  totalItems: 0,
  debitCreditNotes: [],
  hasDebitCreditNotes: {},
  returnReasons: [],
  revertLoading: false,
  revertError: null,
  revertedGrns: [],
  revertHistory: [],
  amountDebitNoteLoading: false,
  debitCreditNoteLoading: false,
  amountDebitNoteError: null,
  debitCreditNoteError: null,
  lastRevertStockUpdates: undefined,
  lastRevertedGrnId: null,
  showStockUpdateDialog: false,
  lastReturnStockUpdates: undefined,
  lastReturnedGrnId: null,
  showReturnStockUpdateDialog: false,

};