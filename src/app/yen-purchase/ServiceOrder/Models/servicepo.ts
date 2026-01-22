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
  descriptions: string[]; // Renamed from 'descriptions'
  from_dates: (string | null)[];
  to_dates: (string | null)[];
  fees: number[];
  desc_tax_types: ('cgst_sgst' | 'igst')[];
  desc_tax_pers: number[];
  desc_sgst: number[];
  desc_cgst: number[];
  desc_igst: number[];
  desc_tax_amounts: number[];
  desc_totals: number[];
  desc_total_fees: number[]; // REMOVE THIS LINE - we're not using it anymore
  desc_discount_amounts: number[];
  desc_discount_percentages: number[];
  desc_overall_discounts: number[];
  mongoId: string;
  totalAmount: number;
  paymentTerms: string;
  shippingAddress: string;
  billingAddress: string;
  comments: string;
  termsandConditions: string[];
  contactpersonEmail: string;
  address: string;
  country: string;
  vendorPhone: string;
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
  quantity: number[];
  base_amounts: number[]; // ADD THIS: base amounts WITHOUT tax
  remarks: string[];
  overallDiscountAppliedOn: string;
  totalFees:number;
  totalDiscount:number;
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
export interface ServiceTotalsResponse {
  base_amounts: never[];
  totalFees: number;
  totalDiscount: number;
  totalTax: number;
  totalFreightAmount: number;
  totalFreightTaxAmount: number;
  totalAmount: number;
  descriptionTaxAmount: number;
  freightTaxAmount: number;
  amountAfterDiscount: number;
  totalOverallDiscount: number;
  desc_sgst: number[];
  desc_cgst: number[];
  desc_igst: number[];
  desc_tax_amounts: number[];
  desc_totals: number[];
  desc_base_amounts: number[]; // CHANGE FROM desc_total_fees to desc_base_amounts
  desc_overall_discounts: number[];
  desc_discount_amounts: number[];
  desc_discount_percentages: number[];
  sacCodes: string[];
  remarks: string[];
  quantity: number[];
  overall_discount_applied_on?: 'before_tax' | 'after_tax';
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
  selectedService: ServiceData | null;
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
  selectedService: null,
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

// Also update the ServiceDescription interface to include discount_percentage and discount_amount
export interface ServiceDescription {
  id?: string;
  sacCode: string;
  description: string;
  from_date?: string | null;
  to_date?: string | null;
  fee: number; // This is TOTAL including tax
  tax_type: 'cgst_sgst' | 'igst';
  tax_per: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number; // Total WITH tax
  taxAmount: number;
  totalFee: number; // Base WITHOUT tax (rename this to base_amount for clarity)
  finalFee: number;
  base_amount: number; // ADD THIS: Base WITHOUT tax
  discountAmount?: number;
  discount_percentage?: number;
  discount_amount?: number;
  quantity: number;
  remarks: string;
}
export interface DescriptionCalculationResponse {
  baseAmount: number; // First definition
  totalFee: number;
  sgst: number;
  cgst: number;
  igst: number;
  totalTax: number;
  total: number;
}

// Replace the duplicate interfaces with this single correct one
export interface DescriptionCalculationResponse {
  description: string;
  quantity: number;
  baseAmount: number; // Original fee amount (taxable base)
  fee: number; // The total amount including tax (what user entered)
  subtotalAfterDiscount: number;
  sgst: number;
  cgst: number;
  igst: number;
  totalTax: number;
  total: number;
  taxableBase?: number; // Optional: calculated taxable base
  from_date?: string | null; // Optional: from date if provided
  to_date?: string | null; // Optional: to date if provided
  remarks?: string; // Optional: remarks if provided
}
// Update ServiceTotalsRequest to accept nested descriptions
export interface ServiceTotalsRequest {
  // Use nested descriptions
  descriptions: ServiceDescription[];
  overall_discount_value?: number;
  overall_discount_type?: 'percentage' | 'amount';
  overall_discount_applied_on?: 'before_tax' | 'after_tax'; // ADD THIS
  round_off?: number;
  total_freight_amount?: number;  // Add this
  total_freight_tax?: number;     // Add this
  fees_are_total_including_tax: true,  // ← ALWAYS TRUE
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
  sacCode: string[];
  desc_ids?: string[];
  remarks:string[];
  quantity:number[];
  descriptions?: string[]; // NEW: Handle if backend uses this
  from_dates: string[];
  to_dates: string[];
  fees: number[];
  desc_tax_types: ('cgst_sgst' | 'igst')[];
  desc_tax_pers: number[];
  desc_sgst?: number[];
  desc_cgst?: number[];
  desc_igst?: number[];
  base_amounts:number[];
  desc_overall_discounts?: number[]; // NEW
  desc_discount_percentages:number[];
  desc_discount_amounts: number[];
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
  vendorPhone:string;
  overallDiscountValue: number;
  overallDiscountType: 'percentage' | 'amount';
  overallDiscountAppliedOn:string;
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
  totalDiscount?:number;
  totalFees?:number;
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

export interface ServiceIdItem {
  mongoId: string;      // MongoDB _id
  serviceId: string;    // Custom ID like "SR0001"
}