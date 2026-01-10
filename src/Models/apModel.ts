import { GrnData } from "./grnModel";

export interface ItemDetails {
  itemId: string;
  purchasetaxName: number;
  taxType: string;
  sgst: number;
  cgst: number;
  hsnCode: string;
  igst: number;
  taxAmount: number;
}

export interface Outgoing {
  outgoingId?: string;
  purchaseOrderId?: string;
  serviceId: string;
  invoiceType: string;
  poRandomId: string;
  grnRandomId: string;
  grnId?: string;
  invoiceId: string;
  vendorName?: string;
  orderDate?: Date | null;
  grnDate: Date | null;
  receivingLocation?: string;
  payableAmount: number;
  paymentMode: string;
  totalPayableAmount?: number;
  comments?: string;
  createdDate?: Date | null;
  impsNo: string;
  upi: string;
  paymentCash: string;
  pettyCashAmount: number;
  hoCash: number;
  poDate: Date | null;
  invoiceDate: Date | null;
  invoiceNo: string;
  shippingAddress: string;
  billingAddress: string;
  apinvocieDate: Date | null;
  paymentDate: Date | null;
  intimationDays: string;
  lastUpdatedDate?: Date | null;
  poCreatedPerson?: string;
  grnCreatedPerson?: string;
  apCreatedPerson?: string;
  grnVerifiedPerson?: string;
  apVerifiedPerson?: string;
  paymentMethod?: string;
  chequeNo?: number;
  onlinePayment?: number;
  neftNo?: string;
  rtgsNo?: string;
  cashVoucherNo?: string;
  itemDetails: ItemDetails[];
  discountDetails: number;
  taxDetails: number;
  bankName: string;
  status?: string;
  randomId?: string;
  address: string;
  country: string;
  state: string;
  city: string;
  paymentTerms: string;
  postalCode: number;
  gstNumber: string;
  contactpersonEmail: string;
}

export interface ItemDetail {
  itemId: string;
  itemName: string;
  nos: number;
  eachQuantity: number;
  quantity: number;
  uom: string;
  befTaxDiscount: number;
  afTaxDiscount: number;
  purchasecategoryName: string;
  purchasesubcategoryName: any;
  befTaxDiscountAmount: number;
  afTaxDiscountAmount: number;
  discountAmount: number;
  taxAmount: number;
  purchasetaxName: number;
  stockQuantity: number;
  returnedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  finalPrice: number;
  taxType: 'cgst_sgst' | 'igst';
  sgst: number;
  cgst: number;
  igst: number;
  status: string;
  hsnCode: string;
  additionalTaxes?: { [key: string]: number };
}

export interface FrontendItemDetail {
  itemId: string;
  itemName: string;
  stockQuantity: number;
  unitPrice: number;
  totalPrice: number;
  purchasetaxName: number;
  taxAmount: number;
  discountAmount: number;
  finalPrice: number;
}

export interface FrontendApInvoiceResponse {
  invoiceId: string;
  randomId?: string;
  grnId?: string;
  grnRandomId?: string;
  vendorName?: string;
  apInvoiceDate?: string;
  invoiceNo?: string;
  itemDetails?: FrontendItemDetail[];
  invoiceAmount?: number;
  paymentStatus?: string;
  invoiceType: 'goods' | 'service';
  // Service-specific arrays
  descriptions?: string[];
  sacCode?: string[];
  from_dates?: string[];
  to_dates?: string[];
  fees?: number[];
  quantity?: number[];
  desc_tax_pers?: number[];
  desc_tax_amounts?: number[];
  desc_totals?: number[];
}

export interface ApInvoice {
  invoiceId: string;
  vendorName: string;
  purchaseOrderId: string;
  poRandomId: string;
  grnRandomId: string;
  apRandomId: string;
  grnId: string;
  apinvoiceDate: Date | null;
  apReturnedDate: Date | null;
  invoiceDate: Date | null;
  invoiceNo: string;
  poDate: Date | null;
  dueDate: Date | null;
  grnDate: Date | null;
  invoiceAmount: number;
  taxDetails: number;
  discountDetails: number;
  apDiscountPrice: number;
  discountPrice: number;
  paymentTerms: string;
  paymentStatus: string;
  itemDetails: ItemDetail[];
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
  gstNumber: string;
  contactpersonEmail: string;
  apPerson: string;
  apReturnedPerson: string;
  debitAmount?: number;
  hasDebitCreditNotes: boolean;
  apRoundOff: number;
  totalFreightAmount: number;
  totalFreightTaxAmount: number;
  invoiceType: 'goods' | 'service';
  serviceId?: string;
  sacCode: string[];
  descriptions: string[];
  from_dates: (Date | null)[];
  to_dates: (Date | null)[];
  fees: number[];
  remarks: (string | null)[];
  quantity: (number | null)[];
  desc_tax_types: string[];
  desc_tax_pers: number[];
  desc_sgst: number[];
  desc_cgst: number[];
  desc_igst: number[];
  desc_tax_amounts: number[];
  desc_totals: number[];
  desc_total_fees: number[];
  totalServiceFees: number;
  totalServiceTax: number;
  totalServiceDiscount: number;
}

export interface ApInvoiceRandomId {
  invoiceId: string;
  randomId: string;
}

// Add interface for fetchApStatuses response
export interface ApStatusesResponse {
  statuses: string[];
  hasMore: boolean;
  page: number;
  searchTerm: string;
}

export interface ApInvoiceState {
  apInvoices: ApInvoice[];
  randomIdap: ApInvoiceRandomId[];
  allapInvoices: ApInvoice[];
  outgoings: Outgoing[];
  grns: GrnData[];
  itemwiseap: FrontendApInvoiceResponse[];
  searchQuery: string;
  selectedStatus: string | null;
  statusSearch: string;
  selectedinvoiceId: string | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  snackbarMessage: string;
  snackbarOpen: boolean;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;  // ADD THIS LINE - Total pages count
  apDialogOpen: boolean;
  // Status related properties
  statuses: string[];
  statusesLoading: boolean;
  statusesError: string | null;
  hasMoreStatuses: boolean;
  currentStatusPage: number;
  lastStatusSearch: string;
  // Search and load more properties
  hasMore: boolean;
  isSearchActive: boolean;
}

export const initialState: ApInvoiceState = {
  apInvoices: [],
  allapInvoices: [],
  randomIdap: [],
  grns: [],
  outgoings: [],
  itemwiseap: [],
  searchQuery: '',
  selectedStatus: '',
  selectedinvoiceId: null,
  loading: false,
  error: null,
  successMessage: null,
  snackbarMessage: '',
  snackbarOpen: false,
  currentPage: 1,
  pageSize: 50,
  totalItems: 0,
  totalPages: 0,  // ADD THIS LINE - Initialize to 0
  apDialogOpen: false,
  // Status related initial state
  statuses: [],
  statusesLoading: false,
  statusesError: null,
  hasMoreStatuses: false,
  currentStatusPage: 1,
  lastStatusSearch: '',
  // Search and load more initial state
  hasMore: false,
  isSearchActive: false,
  statusSearch: ""
};
