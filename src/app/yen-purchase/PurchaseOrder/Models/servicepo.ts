import { VendorSummary } from "@/Models/vendor";
import { GrnData } from "../../../../Models/grnModel";
import { OverallDiscountResponse } from "./Itemcalculation";

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

export interface ServiceDescription {
  id?: string;
  description: string;
  from_date: string | null;
  to_date: string | null;
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
  discountAmount?: number; // Optional for discounts
}

export interface ServiceData {
  serviceId: string;
  vendorName: string;
  vendorContact: string;
  orderDate: string | null;
  approvedDate: string | null;
  rejectedDate: string | null;
  invoiceDate: string | null;
  invoiceNo: string;
  expectedDeliveryDate: string | null;
  status: string;
  descriptions: ServiceDescription[]; // Nested array for frontend
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
  freights: Freight[];
  totalFreightAmount: number;
  totalFreightTaxAmount: number;
  serviceType: 'workorder' | 'ap';
  workOrderNumber: string;
  roundOffValue: number;
  overallDiscountValue: number;
  totalTax: number;
  serviceCreatedPerson?: string;
  serviceApprovedPerson?: string;
  serviceRejectedPerson?: string;
  randomId: string;
  imageUrl?: string;
  createdDate?: string;
  createdTime?: string;
  lastUpdatedDate?: string;
  lastUpdatedTime?: string;
  // Flat arrays for backend compatibility (populated by transform)
  desc_ids?: string[];
  from_dates?: string[];
  to_dates?: string[];
  fees?: number[];
  desc_tax_types?: string[];
  desc_tax_pers?: number[];
  desc_sgst?: number[];
  desc_cgst?: number[];
  desc_igst?: number[];
}


// For the structured response from backend
export interface ServiceResponse {
  serviceId: string;
  randomId: string;
  vendorName?: string;
  orderDate?: string | null;
  descriptions: ServiceDescription[];
  // Include other fields as needed
}

// For the flat array response from backend
export interface ServiceFlatResponse {
  serviceId: string;
  randomId: string;
  vendorName?: string;
  orderDate?: string | null;
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
  totalFees: number;
  totalDiscount: number;
  totalTax: number;
  totalFreightAmount: number;
  totalFreightTaxAmount: number;
  totalAmount: number;
  descriptionTaxAmount: number;
  freightTaxAmount: number;
  amountAfterDiscount: number;
}

export interface ServiceState {
  serviceData: ServiceData;
  newDescription: ServiceDescription;
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

// Updated to match the ServiceDescription interface
export interface DescriptionDetailResponseService {
  id?: string;
  description: string;
  from_date: string;
  to_date: string;
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
  selectedService: ServiceResponse | ServiceFlatResponse | null;
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