import { List } from "postcss/lib/list";
import { GrnData } from "./grnModel";

export interface Item {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  poQuantity: number;
  count: number;
  expiryDate: Date | null;
  eachQuantity: number;
  receivedQuantity?: string | number;
  damagedQuantity: number;
  purchasecategoryName: string;
  purchasesubcategoryName: any;
  existingPrice: number;
  newPrice: number;
  priceVariance:number;
  hsnCode: string;
  discountAmount: number;
  taxAmount: number;
  totalDiscount?: number;
  uom: string;
  taxPercentage: number;
  totalPrice: number;
  finalPrice: number;
  befTaxDiscountAmount: number;
  afTaxDiscountAmount: number;
  befTaxDiscount: number,
  afTaxDiscount: number,
  barcode: string,
  sgst: number,
  cgst: number,
  igst: number;
  pendingCount: number;
  pendingQuantity: number;
  pendingTotalQuantity: number;
  pendingTaxAmount?: number;
  pendingSgst?: number;
  pendingCgst?: number;
  pendingIgst?: number;
  pendingTotalPrice: number;
  pendingFinalPrice: number;
  pendingBefTaxDiscountAmount?: number;
  pendingAfTaxDiscountAmount?: number;
  befTaxDiscountType?:string;
  afTaxDiscountType?:string;
  pendingDiscountAmount: number;
  taxType: 'cgst_sgst' | 'igst';
  additionalTaxes?: { [key: string]: number }; // Optional additional taxes
  status: string;
}

export interface PurchaseOrderData {
  purchaseOrderId: string;
  vendorName: string;
  vendorContact: string;
  orderDate: Date | null;
  approvedDate: Date | null;
  rejectedDate: Date | null;
  expectedDeliveryDate: Date | null;
  poStatus: string;
  items: Item[];
  invoiceDate: Date | null;
  invoiceNo: string;
  creditLimit: number;
  totalOrderAmount: number;
  totalDiscount: number;
  totalTax: number;
  discountPrice: number;
  paymentTerms: string;
  shippingAddress: string;
  billingAddress: string;
  comments: string;
  randomId: string;
  imageUrl?: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: number;
  gstNumber: string;
  contactpersonEmail: string;
  itemStatus: string;
  termsandConditions: string[];
  pendingOrderAmount: number;
  pendingDiscountAmount: number;
  pendingTaxAmount: number;
  poCreatedPerson: string;
  poApprovedPerson: string;
  poRejectedPerson: string;
  discountMode: 'percentage' | 'amount'; // Added to track discount type
  roundOffValue:number;
  overallDiscountValue:number;
}

export type TaxDetails = Record<string, {
  amount: number;
  percentage: number;
  type: string;
}>;

export interface Vendor {
  vendorId: string;
  vendorName: string;
  contactpersonPhone: string;
  paymentTerms: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: number;
  gstNumber: string;
  contactpersonEmail: string;
}

export interface PurchaseItemSearchAdd {
  purchaseitemId: string;
  itemName: string;
  purchasetaxName: number;
  purchasePrice: number;
  purchasecategoryName: string;
  purchasesubcategoryName: any;
  uom: string;
  hsnCode: string;
}

export interface PurchaseOrderState {
  purchaseOrderData: PurchaseOrderData;
  newItem: Item;
  purchaseorderitems: PurchaseOrderData[];
  vendors: Vendor[];
  purchaseitems: PurchaseItemSearchAdd[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  searchQuery: string;
  snackbarMessage: string;
  snackbarOpen: boolean;
  // Add global total fields
  totalPrice: number;
  totalDiscount: number;
  totalTax: number;
  total: number; // Add total count for pagination
  skip: number; // Add skip for pagination
  limit: number; // Add limit for pagination
  importDialogOpen: boolean;
  importDuplicates: string[];
  importWarnings:string[];
  importErrors: string[];
  importSuccessMessages: string[]; // Added for success messages
  importUpdatedItems: string[]; // Added for updated items
  discountMode:string;
}

export interface PurchaseRandomId {
  purchaseOrderId: string;
  randomId: string;
}
export interface PurchaseInvoice {
  purchaseOrderId: string;
  invoiceNo: string;
  vendorName?: string; // Add vendorName as optional
}
// Photo interfaces
export interface PhotoInfo {
  index: number;
  ftp_path: string;
}

export interface PhotosResponse {
  imageUrls: string[];
}

export interface PhotoResponse {
  imageUrl: string;
}

export interface UploadResponse {
  message: string;
  uploaded_photos: PhotoInfo[];
}

export interface ImageUrlsState {
  [purchaseOrderId: string]: string[];
}
// Models/poModel.ts
export interface ItemDetailResponsePO {
  itemId?: string;
  itemName?: string;
  poQuantity?: number;
  newPrice?: number;
  totalPrice?: number;
  purchasetaxName?: number;
 receivedQuantity:number;
 taxPercentage:number;
  taxAmount?: number;
  discountAmount?: number;
  finalPrice?: number;
}

export interface PoResponse {
  purchaseOrderId: string;
  randomId: string;
  vendorName?: string;
  orderDate?: string | null;
  itemDetails: ItemDetailResponsePO[];
}
// Define the structure of the state for purchaseList
export interface PurchaseListState {
  purchaseList: PurchaseOrderData[];
  purchaseOrders: PurchaseOrderData[];
  purchaseinvoice: PurchaseInvoice[];
  selectedPo: PoResponse | null;
  poDialogOpen: boolean;
  grnList: GrnData[];
  loading: boolean;
  photoData: any;
  error: string | null;
  searchQueryItem: string;
  randomIdSearch: string;
  poRandomIds: PurchaseOrderData[], // List of poRandomIds
  selectedOrder: any | null;
  selectedPurchaseId: string | null;
  snackbarMessage: string,
  snackbarOpen: boolean,
  currentPage: number; // New
  pageSize: number; // New
  totalItems: number; // New
  imageUrls: ImageUrlsState;
  fetchedPurchaseOrderIds: string[]; // Back to using an array
  selectedImageIndex: number | null;
  uploadStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  uploadError: string | null; randomIds: PurchaseRandomId[];
  page: number;
  hasMore: boolean;
  searchQuery: string;
  previousSearches: string[];
  importDuplicates: string[];
  importWarnings:string[];
  importErrors: string[];
   importSuccessMessages: string[]; // Added for success messages
  importUpdatedItems: string[]; // Added for updated items
}
export const initialState: PurchaseListState = {
  purchaseList: [],
  purchaseOrders: [],
  purchaseinvoice: [],
  randomIds: [],
  grnList: [],
  loading: false,
  photoData: {},
  error: null,
  searchQueryItem: '',
  imageUrls: {},
  fetchedPurchaseOrderIds: [], // Initialize as an empty array
  selectedImageIndex: null,
  uploadStatus: 'idle',
  uploadError: null,
  randomIdSearch: '',
  poRandomIds: [], // List of poRandomIds
  selectedOrder: null,
  selectedPurchaseId: null,
  snackbarMessage: '',
  snackbarOpen: false,
  currentPage: 1,
  pageSize: 50,
  totalItems: 0,
  page: 0,
  hasMore: true,
  searchQuery: '',
  previousSearches: [],
  importDuplicates: [],
  importErrors: [],
  importWarnings:[],
  importSuccessMessages: [], // Initialize success messages
  importUpdatedItems: [], // Initialize updated items
  selectedPo: null,
  poDialogOpen: false,
};
// Define the Item type for the payload
export interface PurchaseOrderItem {
  id: string;
  pendingTotalQuantity: number;
  poQuantity: number;
  newPrice: number;
  befTaxDiscount: number;
  afTaxDiscount: number;
  befTaxDiscountAmount: number;
  afTaxDiscountAmount: number;
  befTaxDiscountType: 'percentage' | 'amount';
  afTaxDiscountType: 'percentage' | 'amount';
  taxPercentage: number;
  taxType: 'cgst_sgst' | 'igst';
}

// Define the response type for the thunk
export interface OverallDiscountResponse {
  success: boolean;
  error?: string;
  items: Array<{
    id: string;
    pendingTotalQuantity: number;
    poQuantity: number;
    newPrice: number;
    befTaxDiscount: number;
    afTaxDiscount: number;
    befTaxDiscountAmount: number;
    afTaxDiscountAmount: number;
    pendingFinalPrice: number;
    pendingOrderAmount: number;
    pendingTaxAmount: number;
    pendingAfTaxDiscountAmount:number;
    pendingDiscountAmount: number;
    pendingTotalPrice: number;
    pendingSgst: number;
    pendingCgst: number;
    pendingIgst: number;
  }>;
  summary: {
    totalSubtotal: number;
    overallDiscountTotalAmount: number;
    overallDiscountPercentage: number;
    totalFinalAmount: number;
    totalTaxAmount: number;
    totalDiscountAmount: number;
    totalItems: number;
  };
}

// Define the payload type for the thunk
export interface CalculateOverallDiscountPayload {
  items: PurchaseOrderItem[];
  overallDiscount: number;
  overallDiscountAmount: number;
  overallDiscountType: 'percentage' | 'amount';
  applyOverallDiscount: boolean;
}