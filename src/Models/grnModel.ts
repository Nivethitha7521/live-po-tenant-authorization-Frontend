import { Freight, PurchaseRandomId } from "./purchaseModel";

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
  grnPrice:number;
  status?: string;
  barcode?: string;
  sgst: number;
  cgst: number;
  returnedTotalPrice?:number;
  returnedTaxAmount?: number;
  returnedDiscountAmount?: number;
  returnedFinalPrice?: number;
  returnedSgst?:number;
  returnedCgst?:number;
returnHistory?: ReturnHistory[];
}

export interface GrnData {
  grnId: string;
  purchaseOrderId: string;
  poRandomID: string;
  vendorName: string;
  grnDate: Date;
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
  totalDebitAmount?: number; // Added
  totalReturnedAmount?: number; // Added
  totalReturnedTax?: number; // Added
  totalReturnedDiscount?: number; // Added
  hasDebitCreditNotes: boolean; // Ensure this field is present
  apRoundOff:number;
  grnRoundOffAmount:number;
  totalFreightAmount:number;
totalFreightTaxAmount:number;
freights:Freight[];
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
export interface ReturnItemDetail {
  itemId: string;
  nos?: number;
  eachQuantity?: number;
  returnedQuantity:number;
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
export interface ReturnReason{
reason:string;
createdDate:Date | null;
}

export interface GrnState {
  grns: GrnData[];
  itemwise: GrnData[];
  itemDetails: ItemDetail[];
  searchQuery: string;
  selectedGrnId: string | null;
  view: 'grn';
  error: string | null;
  newItem: ItemDetail;
  vendors: Vendor[];
  purchaseitems: PurchaseItem[];
  purchaseorders: PurchaseRandomId[];
  apinvoice: ApInvoice[];
  loading: boolean;
  updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  snackbarMessageGRN: string;
  snackbarOpenGRN: boolean;
  selectedHeaders: string[]; // Fixed: Use string[] instead of allHeaders
  currentPage: number;
  pageSize: number;
  totalItems: number;
  debitCreditNotes: DebitCreditNote[]; // Add this field
  hasDebitCreditNotes: { [grnId: string]: boolean }; //
  returnReasons: ReturnReason[];
   // Revert-related state properties
  revertLoading: boolean;
  revertError: string | null;
  revertedGrns: GrnData[]; // Store reverted GRNs separately if needed
  revertHistory: Array<{
    grnId: string;
    purchaseOrderId: string;
    revertedAt: string;
    poAction: 'updated' | 'created';
  }>;
}

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
export interface ItemUpdate {
  itemId: string;
  befTaxDiscount?: number;
  afTaxDiscount?: number;
  expiryDate?: Date | null;
}
export interface RevertGrnToPOResponse {
  message: string;
  purchaseOrderId: string;
  grnId: string;
  poStatus: string;  // Renamed from poAction (always 'updated' implicitly)
  itemStatus: string;
  revertedItemsCount: number;  // Backend returns count instead of array
  pendingOrderAmount: number;
  // Optional: Add totalOrderAmount if needed
  totalOrderAmount?: number;
}
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
export interface ItemDetails {
  itemId: string;
  itemName: string;
  noteType: string; // Change from string[] to string
  quantity: number;
  unitPrice: number;
  totalPrice: number; // Add this field
  taxAmount: number;
  discountAmount: number;
  finalPrice: number;
  sgst: number;
  cgst: number;
  igst: number; // Allow null as per API
  reason: string;
}
  
export interface DebitCreditNote{
noteId:string;
grnId:string;
randomId:string;
vendorName:string;
itemDetails:ItemDetails[];
createdDate:Date;
createdBy:string;
lastUpdatedDate:string;
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

export const initialState: GrnState = {
  grns: [],
  itemwise: [],
  itemDetails: [],
  searchQuery: '',
  selectedGrnId: null,
  view: 'grn',
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
  error: null,
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
    // Revert-related initial state
  revertLoading: false,
  revertError: null,
  revertedGrns: [],
  revertHistory: [],
};
