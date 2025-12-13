import { VendorSummary } from "@/Models/vendor";
import { GrnData } from "../../../../Models/grnModel";
import { OverallDiscountResponse } from "../../PurchaseOrder/Models/Itemcalculation";

export interface Freight {
  id: string;
  name: string;
  tCode: string;
  amt: number;
  tAmt: number;
  totalAmt: number;
  taxType: 'cgst_sgst' | 'igst';
  sgst: number;
  cgst: number;
  igst: number;
  taxPercentage: number;
}

export interface ServiceData {
  serviceId: string;
  vendorId: string;
  vendorName: string;
  vendorContact: string;
  workOrderDate: string | null;
  approvedDate?: string | null;
  rejectedDate?: string | null;
  invoiceDate?: string | null;
  invoiceNo?: string;
  status: string;
  
  // Use ONLY flat arrays (no nested objects)
  sacCode: string[];
  desc_ids: string[];
  desc_descriptions: string[]; // Renamed from 'descriptions'
  from_dates: (string | null)[]; // Date strings or null
  to_dates: (string | null)[];   // Date strings or null
  fees: number[];
  desc_tax_types: ('cgst_sgst' | 'igst')[];
  desc_tax_pers: number[];
  desc_sgst: number[];
  desc_cgst: number[];
  desc_igst: number[];
  desc_tax_amounts: number[];
  desc_totals: number[];
  desc_total_fees: number[];
  desc_discount_amounts: number[];
  desc_overall_discounts: number[]; // NEW: Per-description overall discounts
  mongoId:string;
  totalAmount: number;
  paymentTerms: string;
  shippingAddress: string;
  billingAddress: string;
  comments: string;
  termsandConditions: string[];
  contactpersonEmail: string;
  address: string;
  country: string;
  state: string;
  city: string;
  creditLimit: number;
  locationName: string;
  freights?: Freight[];
  totalFreightAmount?: number;
  totalFreightTaxAmount?: number;
  roundOffValue: number;
  overallDiscountValue: number;
  overallDiscountType: 'percentage' | 'amount';
  totalTax: number;
  serviceCreatedPerson?: string | null;
  serviceApprovedPerson?: string | null;
  serviceRejectedPerson?: string | null; 
  imageUrl?: string;
  createdDate?: string | null;
  createdTime?: string | null;
  lastUpdatedDate?: string | null;
  lastUpdatedTime?: string | null;
  quantity:number[];
  remarks:string[];
}

// For the flat array response from backend
export interface ServiceFlatResponse {
  serviceId: string;
  randomId: string;
  vendorName?: string;
  descriptions: string[];
  desc_ids: string[];
  from_dates: string[];
  to_dates: string[];
  fees: number[];
  desc_tax_types: string[];
  desc_tax_pers: number[];
  desc_sgst: number[];
  desc_cgst: number[];
  desc_igst: number[];
  // Include other fields as needed
}

export interface ServiceSearchAdd {
  serviceId: string;
  serviceName: string;
  serviceTaxName: number;
  serviceFee: number;
  serviceCategoryName: string;
  serviceSubcategoryName: any;
  uom: string;
  hsnCode: string;
  randomId: string;
}

// Added 'desc_discount_amounts' property to match usage in your code (per-description individual discounts)
export interface ServiceTotalsResponse {
  totalFees: number;
  totalDiscount: number;
  totalTax: number;
  totalFreightAmount: number;
  totalFreightTaxAmount: number;
  totalAmount: number;
  descriptionTaxAmount: number;
  freightTaxAmount: number;
  amountAfterDiscount: number;
  totalIndividualDiscount: number; // NEW
  totalOverallDiscount: number; // NEW
  desc_sgst: number[]; // NEW
  desc_cgst: number[]; // NEW
  desc_igst: number[]; // NEW
  desc_tax_amounts: number[]; // NEW
  desc_totals: number[]; // NEW
  desc_total_fees: number[]; // NEW
  desc_overall_discounts: number[]; // NEW
  desc_discount_amounts: number[]; // NEW: Added to resolve TS error (per-description individual discounts)
  sacCodes: string[]; // NEW
  remarks: string[]; // NEW
  quantity: number[]; // NEW
}
export interface ServiceState {
  serviceData: ServiceData;
  newDescription: ServiceDescription; // ADD THIS BACK
  services: ServiceData[];
  vendors: VendorSummary[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  searchQuery: string;
  snackbarMessage: string;
  snackbarOpen: boolean;
  totalFees: number;
  totalDiscount: number;
  totalTax: number;
  total: number;
  skip: number;
  limit: number;
  discountMode: 'percentage' | 'amount';
  serviceTotalsLoading: boolean;
  calculatedTotals: ServiceTotalsResponse | null;
}

export interface ServiceRandomId {
  serviceId: string;
  randomId: string;
}

export interface ServiceInvoice {
  serviceId: string;
  invoiceNo: string;
  vendorName?: string;
}

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
  [serviceId: string]: string[];
}
// Types for description calculation (analogous to item)
export interface DescriptionCalculationRequest {
  description: string;
  fromDate: string | Date | null;
  toDate: string | Date | null;
  fee: number;
  taxType: 'cgst_sgst' | 'igst';
  taxPer?: number;
  quantity?: number; // NEW: Optional
  remarks?:string;
}
// Updated to match the ServiceDescription interface
export interface DescriptionDetailResponseService {
  id?: string;
  description: string;
  from_date: string | null;
  to_date: string | null;
  fee: number;
  tax_type: string;
  tax_per: number;
  // Additional calculated fields if needed
  totalFee?: number;
  taxAmount?: number;
  discountAmount?: number;
  finalFee?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  total?: number;
}

export interface ServiceListState {
  serviceList: ServiceData[];
  pendingServiceList: ServiceData[];
  pendingTotalItems: number;
  services: ServiceData[];
  serviceinvoice: ServiceInvoice[];
  serviceDialogOpen: boolean;
  grnList: GrnData[];
  loading: boolean;
  photoData: any;
  error: string | null;
  searchQueryDescription: string;
  randomIdSearch: string;
  serviceRandomIds: ServiceData[];
  selectedOrder: any | null;
  selectedServiceId: string | null;
  snackbarMessage: string;
  snackbarOpen: boolean;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  imageUrls: ImageUrlsState;
  fetchedServiceIds: string[];
  selectedImageIndex: number | null;
  uploadStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  uploadError: string | null;
  randomIds: ServiceRandomId[];
  page: number;
  hasMore: boolean;
  searchQuery: string;
  previousSearches: string[];
  importDuplicates: string[];
  importWarnings: string[];
  importErrors: string[];
  importSuccessMessages: string[];
  importUpdatedItems: string[];
  calculatedOverallDiscount: OverallDiscountResponse | null;
  isCalculatingDiscount: boolean;
}

export const initialServiceListState: ServiceListState = {
  serviceList: [],
  services: [],
  serviceinvoice: [],
  serviceDialogOpen: false,
  randomIds: [],
  grnList: [],
  loading: false,
  photoData: {},
  error: null,
  searchQueryDescription: '',
  imageUrls: {},
  fetchedServiceIds: [],
  selectedImageIndex: null,
  uploadStatus: 'idle',
  uploadError: null,
  randomIdSearch: '',
  serviceRandomIds: [],
  selectedOrder: null,
  selectedServiceId: null,
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
  importWarnings: [],
  importSuccessMessages: [],
  importUpdatedItems: [],
  calculatedOverallDiscount: null,
  isCalculatingDiscount: false,
  pendingServiceList: [],
  pendingTotalItems: 0
};

// UPDATED: ServiceDescription with quantity and remarks
export interface ServiceDescription {
  id?: string;
  sacCode: string;
  description: string;
  from_date?: string | null; // OPTIONAL
  to_date?: string | null;   // OPTIONAL
  fee: number;
  tax_type: 'cgst_sgst' | 'igst';
  tax_per: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  taxAmount: number;
  totalFee: number;
  finalFee: number;
  discountAmount?: number;
  quantity: number; // NEW: Optional
  remarks: string; // NEW: Required
}
// Added 'baseAmount' property to match usage in your code (likely the pre-tax fee input)
export interface DescriptionCalculationResponse {
  baseAmount: number; // NEW: Added to resolve TS error (e.g., the original fee before calculations)
  totalFee: number;
  sgst: number;
  cgst: number;
  igst: number;
  totalTax: number;
  total: number;
}
export interface DescriptionCalculationResponse {
  totalFee: number;
  sgst: number;
  cgst: number;
  igst: number;
  totalTax: number;
  total: number;
}
// Update ServiceTotalsRequest to accept nested descriptions
export interface ServiceTotalsRequest {
  // Use nested descriptions
  descriptions: ServiceDescription[];
  overall_discount_value?: number;
  overall_discount_type?: 'percentage' | 'amount';
  round_off?: number;
}

// Raw response type from backend (flat arrays)
export interface RawServiceData {
  serviceId: string;
  vendorId?: string;
  vendorName: string;
  vendorContact: string;
  workOrderDate: string | null;
  approvedDate: string | null; 
  rejectedDate: string | null;
  invoiceDate: string | null;
  invoiceNo: string;
  status: string;
  descriptions: string[] | null;
  sacCode: string[];
  desc_ids?: string[];
  remarks:string[];
  quantity:number[];
  desc_descriptions?: string[]; // NEW: Handle if backend uses this
  from_dates: string[];
  to_dates: string[];
  fees: number[];
  desc_tax_types: ('cgst_sgst' | 'igst')[];
  desc_tax_pers: number[];
  desc_sgst?: number[];
  desc_cgst?: number[];
  desc_igst?: number[];
  desc_overall_discounts?: number[]; // NEW
  totalAmount: number;
  paymentTerms: string;
  shippingAddress: string;
  billingAddress: string;
  comments: string;
  termsandConditions: string[];
  contactpersonEmail: string;
  address: string;
  country: string;
  state: string;
  city: string;
  creditLimit: number;
  locationName: string;
  overallDiscountValue: number;
  overallDiscountType: 'percentage' | 'amount';
  roundOffValue: number;
  totalTax: number;
  mongoId: string;
  imageUrl:string;
  createdDate?: string | null;
  createdTime?: string | null;
  lastUpdatedDate?: string | null;
  lastUpdatedTime?: string | null;
  serviceCreatedPerson?: string | null;
  serviceApprovedPerson?: string | null;
  serviceRejectedPerson?: string | null;
  freights?: Freight[];
  totalFreightAmount?: number;
  totalFreightTaxAmount?: number;
}

// Add this interface to your Models/servicepo.ts
export interface OverallDiscountServiceResponseDescription {
  id?: string;
  discountAmount?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  total?: number;
  // Add any other properties that might be returned
  fee?: number;
  taxAmount?: number;
}

// Update your OverallDiscountServiceResponse interface
export interface OverallDiscountServiceResponse {
  success: boolean;
  error?: string;
  descriptions?: OverallDiscountServiceResponseDescription[];
  summary?: {
    totalFinalAmount?: number;
    totalDiscount?: number;
    totalTax?: number;
    [key: string]: any;
  };
}