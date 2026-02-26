import { VendorSummary } from "@/Models/vendor";

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
  mongoId: string;
  
  sacCode: string[];
  desc_ids: string[];
  descriptions: string[];
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
  base_amounts: number[];
  desc_discount_amounts: number[];
  desc_discount_percentages: number[];
  desc_overall_discounts: number[];
  include_tax: boolean[];
  
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
  overallDiscountAppliedOn: string;
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
  remarks: string[];
  totalFees: number;
  totalDiscount: number;
}

export interface ServiceTotalsResponse {
  base_amounts: number[];
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
  desc_base_amounts: number[];
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

export interface ServiceDescription {
  id?: string;
  sacCode: string;
  description: string;
  from_date?: string | null;
  to_date?: string | null;
  fee: number;
  fee_with_tax?: number;
  base_amount?: number;
  include_tax: boolean;
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
  discount_percentage?: number;
  discount_amount?: number;
  quantity: number;
  remarks: string;
  calculated_base_per_unit?: number;
  calculated_tax_per_unit?: number;
  calculated_total_per_unit?: number;
}

export interface DescriptionCalculationRequest {
  description: string;
  fromDate: string | Date | null;
  toDate: string | Date | null;
  fee: number;
  taxType: 'cgst_sgst' | 'igst';
  taxPer?: number;
  quantity?: number;
  remarks?: string;
  include_tax?: boolean;
  base_amount?: number;
}

export interface DescriptionCalculationResponse {
  description: string;
  quantity: number;
  baseAmount: number;
  fee: number;
  subtotalAfterDiscount: number;
  sgst: number;
  cgst: number;
  igst: number;
  totalTax: number;
  total: number;
  taxableBase?: number;
  from_date?: string | null;
  to_date?: string | null;
  remarks?: string;
  totalFee?: number;
  include_tax: boolean;
}

export interface ServiceTotalsRequest {
  descriptions: ServiceDescription[];
  overall_discount_value?: number;
  overall_discount_type?: 'percentage' | 'amount';
  overall_discount_applied_on?: 'before_tax' | 'after_tax';
  round_off?: number;
  total_freight_amount?: number;
  total_freight_tax?: number;
  fees_are_total_including_tax: true;
}

export interface RawServiceData {
  _id?: string;
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
  remarks: string[];
  quantity: number[];
  descriptions?: string[];
  from_dates: string[];
  to_dates: string[];
  fees: number[];
  desc_tax_types: ('cgst_sgst' | 'igst')[];
  desc_tax_pers: number[];
  desc_sgst?: number[];
  desc_cgst?: number[];
  desc_igst?: number[];
  base_amounts: number[];
  desc_totals: number[];
  desc_overall_discounts?: number[];
  desc_discount_percentages: number[];
  desc_discount_amounts: number[];
  desc_tax_amounts: number[];
  include_tax?: boolean[];
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
  vendorPhone: string;
  overallDiscountValue: number;
  overallDiscountType: 'percentage' | 'amount';
  overallDiscountAppliedOn: string;
  roundOffValue: number;
  totalTax: number;
  mongoId: string;
  imageUrl: string;
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
  totalDiscount?: number;
  totalFees?: number;
}