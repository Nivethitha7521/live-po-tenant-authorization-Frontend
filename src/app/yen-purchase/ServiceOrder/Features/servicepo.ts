import { createSlice, PayloadAction, createAsyncThunk, createAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';
import {
  ServiceData,
  ServiceState,
  ServiceTotalsResponse,
  Freight,
  RawServiceData,
  DescriptionCalculationRequest,
  DescriptionCalculationResponse,
  ServiceDescription,
  ServiceTotalsRequest
} from "../Models/servicepo"
import { VendorSummary } from "@/Models/vendor";
import qs from 'qs';
import { useCallback } from 'react';
// FIXED: Helper for date-only formatting (YYYY-MM-DD) for UI display - NO TIMEZONE CONVERSION
const formatDateOnly = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) return '';
  
  let dt: Date;
  if (typeof dateValue === 'string') {
    // Parse without timezone conversion
    const parts = dateValue.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
      const day = parseInt(parts[2]);
      dt = new Date(year, month, day);
    } else {
      dt = new Date(dateValue);
    }
  } else {
    dt = new Date(dateValue);
  }
  
  if (isNaN(dt.getTime())) return '';
  
  // Format as YYYY-MM-DD without timezone offset
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// FIXED: Helper for backend datetime (ISO with time 00:00:00.000Z)
const formatDateTimeForBackend = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) return '';
  
  let dt: Date;
  if (typeof dateValue === 'string') {
    // Parse without timezone conversion
    const parts = dateValue.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      dt = new Date(Date.UTC(year, month, day));
    } else {
      dt = new Date(dateValue);
    }
  } else {
    dt = new Date(dateValue);
  }
  
  if (isNaN(dt.getTime())) return '';
  
  // Create ISO string in UTC with time 00:00:00.000
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

// FIXED: Parse date string without timezone shifting
const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  
  try {
    // Extract date parts from YYYY-MM-DD format
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      
      // Create date in local timezone (but don't adjust for timezone)
      return new Date(year, month, day);
    }
    
    // Fallback for other formats
    return new Date(dateStr);
  } catch {
    return null;
  }
};
const transformRawToNested = (raw: RawServiceData): ServiceData => {
  const sacCodesRaw = raw.sacCode || [];
  const descIdsRaw = raw.desc_ids || [];
  const descriptionsRaw = raw.descriptions || [];
  const fromDatesRaw = raw.from_dates || [];
  const toDatesRaw = raw.to_dates || [];
  const feesRaw = raw.fees || [];
  const descTaxTypesRaw = raw.desc_tax_types || [];
  const descTaxPersRaw = raw.desc_tax_pers || [];
  const descSgstRaw = raw.desc_sgst || [];
  const descCgstRaw = raw.desc_cgst || [];
  const descIgstRaw = raw.desc_igst || [];
  const baseamounts = raw.base_amounts || [];
  const descOverallDiscountsRaw = raw.desc_overall_discounts || [];
  
  const remarksRaw = raw.remarks || [];
  const quantityRaw = raw.quantity || [];
  
  // FIXED: Add desc_discount_percentages from raw data
  const descDiscountPercentagesRaw = raw.desc_discount_percentages || [];
  const descDiscountAmountsRaw = raw.desc_discount_amounts || new Array(feesRaw.length).fill(0);

  // Calculate additional arrays
  const descTaxAmountsRaw = descSgstRaw.map((sgst, i) =>
    sgst + (descCgstRaw[i] || 0) + (descIgstRaw[i] || 0)
  );
  
  const descTotalsRaw = feesRaw.map((fee, i) =>
    fee + descTaxAmountsRaw[i] - (descOverallDiscountsRaw[i] || 0)
  );

  // FIXED: Format dates for frontend (YYYY-MM-DD for date-only display)
  const formattedWorkOrderDate = raw.workOrderDate ? formatDateOnly(raw.workOrderDate) : null;
  const formattedCreatedDate = raw.createdDate ? formatDateOnly(raw.createdDate) : null;
  
  // For description dates, keep as date-only strings for UI
  const formattedFromDates = fromDatesRaw.map(d => formatDateOnly(d));
  const formattedToDates = toDatesRaw.map(d => formatDateOnly(d));
  const mongoId = raw.mongoId || (raw.mongoId ? String(raw.mongoId) : '');
  
  return {
    serviceId: raw.serviceId,
    vendorId: raw.vendorId || '',
    vendorName: raw.vendorName || '',
    vendorContact: raw.vendorContact || '',
    workOrderDate: formattedWorkOrderDate || null,
    approvedDate: raw.approvedDate ? formatDateOnly(raw.approvedDate) : null,
    rejectedDate: raw.rejectedDate ? formatDateOnly(raw.rejectedDate) : null,
    invoiceDate: raw.invoiceDate ? formatDateOnly(raw.invoiceDate) : null,
    invoiceNo: raw.invoiceNo || '',
    status: raw.status || '',
    mongoId: mongoId,

    // FLAT ARRAYS (date-only strings for UI)
    sacCode: sacCodesRaw,
    desc_ids: descIdsRaw,
    descriptions: descriptionsRaw,
    from_dates: formattedFromDates,
    to_dates: formattedToDates,
    fees: feesRaw,
    remarks: remarksRaw,
    quantity: quantityRaw,
    desc_tax_types: descTaxTypesRaw as ('cgst_sgst' | 'igst')[],
    desc_tax_pers: descTaxPersRaw,
    desc_sgst: descSgstRaw,
    desc_cgst: descCgstRaw,
    desc_igst: descIgstRaw,
    desc_tax_amounts: descTaxAmountsRaw,
    desc_totals: descTotalsRaw,
    desc_total_fees: feesRaw,
    desc_discount_amounts: descDiscountAmountsRaw,
    desc_discount_percentages: descDiscountPercentagesRaw,
    desc_overall_discounts: descOverallDiscountsRaw,
    base_amounts: baseamounts,
    totalAmount: raw.totalAmount || 0,
    paymentTerms: raw.paymentTerms || '',
    shippingAddress: raw.shippingAddress || '',
    billingAddress: raw.billingAddress || '',
    comments: raw.comments || '',
    termsandConditions: raw.termsandConditions || [],
    contactpersonEmail: raw.contactpersonEmail || '',
    address: raw.address || '',
    country: raw.country || '',
    state: raw.state || '',
    city: raw.city || '',
    vendorPhone: raw.vendorPhone || '',
    creditLimit: raw.creditLimit || 0,
    locationName: raw.locationName || '',
    freights: raw.freights || [],
    totalFreightAmount: raw.totalFreightAmount || 0,
    totalFreightTaxAmount: raw.totalFreightTaxAmount || 0,
    roundOffValue: raw.roundOffValue || 0,
    overallDiscountValue: raw.overallDiscountValue || 0,
    overallDiscountType: raw.overallDiscountType || 'percentage',
    overallDiscountAppliedOn: raw.overallDiscountAppliedOn || 'after_tax',
    totalTax: raw.totalTax || 0,
    serviceCreatedPerson: raw.serviceCreatedPerson ?? null,
    serviceApprovedPerson: raw.serviceApprovedPerson ?? null,
    serviceRejectedPerson: raw.serviceRejectedPerson ?? null,
    imageUrl: raw.imageUrl || '',
    createdDate: formattedCreatedDate || null,
    createdTime: raw.createdTime || null,
    lastUpdatedDate: raw.lastUpdatedDate ? formatDateOnly(raw.lastUpdatedDate) : null,
    lastUpdatedTime: raw.lastUpdatedTime || null,
    totalFees: raw.totalFees || 0,
    totalDiscount: raw.totalDiscount || 0,
  };
};

export const initialState: ServiceState = {
  serviceData: {
    serviceId: '',
    vendorId: '',
    vendorName: '',
    vendorContact: '',
    vendorPhone: '',
    workOrderDate: null,
    approvedDate: null,
    rejectedDate: null,
    invoiceDate: null,
    invoiceNo: '',
    status: '',

    // FLAT ARRAYS (initialize all as empty)
    remarks: [],
    sacCode: [],
    desc_ids: [],
    descriptions: [],
    from_dates: [],
    to_dates: [],
    fees: [],
    desc_tax_types: [],
    desc_tax_pers: [],
    desc_sgst: [],
    desc_cgst: [],
    desc_igst: [],
    desc_tax_amounts: [],
    desc_totals: [],
    desc_total_fees: [],
    desc_discount_amounts: [],
    desc_discount_percentages: [],
    desc_overall_discounts: [],
    base_amounts: [],
    totalAmount: 0,
    paymentTerms: '',
    shippingAddress: '',
    billingAddress: '',
    comments: '',
    termsandConditions: [''],
    contactpersonEmail: '',
    address: '',
    country: '',
    state: '',
    city: '',
    creditLimit: 0,
    locationName: '',
    freights: [],
    totalFreightAmount: 0,
    totalFreightTaxAmount: 0,
    overallDiscountValue: 0,
    overallDiscountType: 'percentage',
    overallDiscountAppliedOn: 'after_tax',
    roundOffValue: 0,
    totalTax: 0,
    serviceCreatedPerson: null,
    serviceApprovedPerson: null,
    serviceRejectedPerson: null,
    mongoId: '',
    imageUrl: '',
    createdDate: null,
    createdTime: null,
    lastUpdatedDate: null,
    lastUpdatedTime: null,
    quantity: [],
    totalFees: 0,
    totalDiscount: 0,
  },
  
  // FIXED: newDescription with quantity and remarks AND discount fields
  newDescription: {
    id: '',
    sacCode: '',
    description: '',
    from_date: null,
    to_date: null,
    fee: 0,
    tax_type: 'cgst_sgst',
    tax_per: 0,
    sgst: 0,
    cgst: 0,
    igst: 0,
    total: 0,
    taxAmount: 0,
    totalFee: 0,
    finalFee: 0,
    discountAmount: 0,
    discount_percentage: 0,
    discount_amount: 0,
    quantity: 1,
    remarks: '',
    base_amount: 0,
  },
  
  services: [],
  vendors: [],
  loading: false,
  error: null,
  successMessage: '',
  searchQuery: '',
  snackbarMessage: '',
  snackbarOpen: false,
  totalFees: 0,
  totalDiscount: 0,
  totalTax: 0,
  total: 0,
  skip: 0,
  limit: 50,
  discountMode: 'percentage',
  serviceTotalsLoading: false,
  calculatedTotals: null,
};

const BASE_URL = 'http://192.168.29.116:8000/purchasetestapi';

// FIXED: Async thunk for calculateServiceTotals (sends nested ServiceDescription[])
export const calculateServiceTotals = createAsyncThunk(
  'serviceOrder/calculateServiceTotals',
  async (request: ServiceTotalsRequest): Promise<ServiceTotalsResponse> => {
    // FIXED: Send nested descriptions directly (backend expects List[ServiceDescription])
    const response = await axios.post<ServiceTotalsResponse>(
      `${BASE_URL}/servicepo/calculate-totals`,
      request
    );
    return response.data;
  }
);

// REMOVED: calculateOverallDiscountForAllDescriptions (integrated into calculateServiceTotals)
export const fetchServices = createAsyncThunk(
  'serviceOrder/fetchServices',
  async (params: {
    status?: string;
    skip?: number;
    limit?: number;
    vendorName?: string;
    serviceId?: string;
    fromDate?: string;
    toDate?: string;
    workOrderFrom?: string;
    workOrderTo?: string;
  } = {}): Promise<ServiceData[]> => {
    
    // Default to "Pending" for this page
    const defaultParams = {
      status: 'Pending', // Default status
      skip: 0,
      limit: 50,
      ...params
    };
    
    // FIXED: Expect RawServiceData[] from backend
    const response = await axios.get<RawServiceData[]>(
      `${BASE_URL}/servicepo/getServices/`,
      { 
        params: defaultParams,
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: 'repeat' });
        }
      }
    );
    
    // Transform each raw data to ServiceData
    return response.data.map(transformRawToNested);
  }
);
export const fetchAllVendors = createAsyncThunk<
  VendorSummary[],
  void,
  { rejectValue: string }
>(
  'serviceOrder/fetchAllVendors',
  async (_, { rejectWithValue }) => {
    try {
      const localData = localStorage.getItem('serviceVendors');
      if (localData) {
        return JSON.parse(localData);
      }
      const response = await axios.get<VendorSummary[]>(`${BASE_URL}/vendors/`);
      localStorage.setItem('serviceVendors', JSON.stringify(response.data));
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch vendors');
    }
  }
);

export const fetchServiceById = createAsyncThunk(
  'serviceOrder/fetchServiceById',
  async (serviceId: string): Promise<ServiceData> => {
    const response = await axios.get<RawServiceData>(`${BASE_URL}/servicepo/${serviceId}`);
    return transformRawToNested(response.data);
  }
);
// CRITICAL: Update calculateDescriptionTotals to include discount parameters
export const calculateDescriptionTotals = createAsyncThunk<
  DescriptionCalculationResponse,
  DescriptionCalculationRequest & { 
    quantity?: number; 
    discount?: number;
    discount_percentage?: number;
    sacCode?: string;
  },
  { rejectValue: string }
>(
  'serviceOrder/calculateDescriptionTotals',
  async (
    {
      description,
      fromDate,
      toDate,
      fee,
      taxPer,
      taxType,
      quantity = 1,
      remarks = '',
      discount = 0,
      discount_percentage = 0,
      sacCode = ''
    },
    { rejectWithValue }
  ) => {
    try {
      const params: any = {
        description,
        fromDate: formatDateOnly(fromDate),
        toDate: formatDateOnly(toDate),
        fee, // This is already the total amount including tax
        taxPer: taxPer || 0,
        taxType,
        quantity,
        remarks,
        discount,
        discount_percentage,
        sacCode
      };
      
      const response = await axios.get<DescriptionCalculationResponse>(
        `${BASE_URL}/servicepo/descriptions/totals`, 
        { params }
      );
      
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'An unknown error occurred'
      );
    }
  }
);
export const addService = createAsyncThunk<
  ServiceData,
  ServiceData,
  { rejectValue: string }
>(
  'services/add',
  async (service, { rejectWithValue }) => {
    try {
      // Prepare service data with proper datetime formatting
      const serviceToAdd = {
        ...service,
        workOrderDate: service.workOrderDate ? formatDateTimeForBackend(service.workOrderDate) : null,
        
        // Use 'descriptions' field for backend
        descriptions: service.descriptions || [],
        
        // Convert date strings to datetime for backend
        from_dates: service.from_dates.map(dateStr => 
          dateStr ? formatDateTimeForBackend(dateStr) : null
        ),
        to_dates: service.to_dates.map(dateStr => 
          dateStr ? formatDateTimeForBackend(dateStr) : null
        ),
        
        // Map arrays
        sacCode: service.sacCode || [],
        
        // CRITICAL: Include discount arrays
        desc_discount_percentages: service.desc_discount_percentages || 
          Array(service.descriptions.length).fill(0),
        desc_discount_amounts: service.desc_discount_amounts || 
          Array(service.descriptions.length).fill(0),
        
        // Include other array fields
        remarks: service.remarks || [],
        quantity: service.quantity || [],
        desc_tax_types: service.desc_tax_types || [],
        desc_tax_pers: service.desc_tax_pers || [],
        desc_sgst: service.desc_sgst || [],
        desc_cgst: service.desc_cgst || [],
        desc_igst: service.desc_igst || [],
        desc_tax_amounts: service.desc_tax_amounts || [],
        desc_totals: service.desc_totals || [],
        desc_total_fees: service.desc_total_fees || [],
        desc_overall_discounts: service.desc_overall_discounts || [],
        base_amounts: service.base_amounts || [],
        
        overallDiscountType: service.overallDiscountType || 'percentage',
        overallDiscountAppliedOn: service.overallDiscountAppliedOn || 'after_tax',
      };
      
      const rawResponse = await axios.post<RawServiceData>(
        `${BASE_URL}/servicepo/`, 
        serviceToAdd
      );
      
      return transformRawToNested(rawResponse.data);
    } catch (error: any) {
      console.error('Add service error:', error.response?.data || error.message);
      return rejectWithValue(
        error.response?.data?.message || 
        error.response?.data?.detail || 
        error.message || 
        'Failed to add service'
      );
    }
  }
);
export const updateService = createAsyncThunk<
  ServiceData,
  { mongoId: string; service: ServiceData },
  { rejectValue: string }
>(
  'services/update',
  async ({ mongoId, service }, { rejectWithValue }) => {
    try {
      const serviceToUpdate = {
        ...service,
        workOrderDate: formatDateTimeForBackend(service.workOrderDate),
        descriptions: service.descriptions,
        from_dates: service.from_dates.map(dateStr => dateStr ? formatDateTimeForBackend(dateStr) : ''),
        to_dates: service.to_dates.map(dateStr => dateStr ? formatDateTimeForBackend(dateStr) : ''),
        sacCode: service.sacCode || [],
        overallDiscountType: service.overallDiscountType || 'percentage',
        desc_overall_discounts: service.desc_overall_discounts || [], // NEW
      };
      
      const rawResponse = await axios.patch<RawServiceData>(
        `${BASE_URL}/servicepo/update/${mongoId}`, 
        serviceToUpdate
      );
      
      return transformRawToNested(rawResponse.data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to update service');
    }
  }
);

export const approveServiceOrder = createAsyncThunk<
  { whatsapp_sent: boolean; pdf_url?: string },
  string,
  { rejectValue: string }
>(
  'serviceOrder/approveServiceOrder',
  async (mongoId, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${BASE_URL}/servicepo/approved/${mongoId}`, { send_whatsapp: false });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to approve service order');
    }
  }
);

export const rejectServiceOrder = createAsyncThunk<
  void,
  string,
  { rejectValue: string }
>(
  'serviceOrder/rejectServiceOrder',
  async (mongoId, { rejectWithValue }) => {
    try {
      await axios.patch(`${BASE_URL}/servicepo/rejected/${mongoId}`, { reason: 'Rejected by user', send_notification: false });
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to reject service order');
    }
  }
);

export const setDiscountMode = createAction<{
  mode: 'percentage' | 'amount';
  recalculate?: boolean;
}>('serviceOrder/setDiscountMode');

const serviceOrderSlice = createSlice({
  name: 'serviceOrder',
  initialState,
  reducers: {
      setServiceData(state, action: PayloadAction<Partial<ServiceData>>) {
      state.serviceData = {
        ...initialState.serviceData,
        ...action.payload,
        desc_overall_discounts: action.payload.desc_overall_discounts || initialState.serviceData.desc_overall_discounts,
        desc_discount_percentages: action.payload.desc_discount_percentages || initialState.serviceData.desc_discount_percentages,
        desc_discount_amounts: action.payload.desc_discount_amounts || initialState.serviceData.desc_discount_amounts,
      };
    },
     setNewDescriptionData(state, action: PayloadAction<Partial<ServiceDescription>>) {
      state.newDescription = { ...state.newDescription, ...action.payload };
    },
     // CRITICAL: Update addDescriptionToService to include discount fields
    addDescriptionToService: (state, action: PayloadAction<ServiceDescription>) => {
      const desc = action.payload;
      state.serviceData = {
        ...state.serviceData,
        // Add to all flat arrays
        sacCode: [...state.serviceData.sacCode, desc.sacCode || ''],
        desc_ids: [...state.serviceData.desc_ids, desc.id || ''],
        descriptions: [...state.serviceData.descriptions, desc.description || ''],
        from_dates: [...state.serviceData.from_dates, desc.from_date || null],
        to_dates: [...state.serviceData.to_dates, desc.to_date || null],
        fees: [...state.serviceData.fees, desc.fee || 0],
        quantity: [...state.serviceData.quantity, desc.quantity || 1],
        remarks: [...state.serviceData.remarks, desc.remarks || ''],
        desc_tax_types: [...state.serviceData.desc_tax_types, desc.tax_type || 'cgst_sgst'],
        desc_tax_pers: [...state.serviceData.desc_tax_pers, desc.tax_per || 0],
        desc_sgst: [...state.serviceData.desc_sgst, desc.sgst || 0],
        desc_cgst: [...state.serviceData.desc_cgst, desc.cgst || 0],
        desc_igst: [...state.serviceData.desc_igst, desc.igst || 0],
        desc_totals: [...state.serviceData.desc_totals, desc.total || 0],
        desc_tax_amounts: [...state.serviceData.desc_tax_amounts, desc.taxAmount || 0],
        desc_total_fees: [...state.serviceData.desc_total_fees, desc.totalFee || 0],
        desc_discount_amounts: [...state.serviceData.desc_discount_amounts, desc.discount_amount || 0],
        desc_discount_percentages: [...state.serviceData.desc_discount_percentages, desc.discount_percentage || 0],
        desc_overall_discounts: [...state.serviceData.desc_overall_discounts, 0],
        base_amounts: [...(state.serviceData.base_amounts || []), desc.base_amount || 0],
      };
    },
   // CRITICAL: Update updateDescription to include discount fields
    updateDescription: (state, action: PayloadAction<{ index: number; desc: ServiceDescription }>) => {
      const { index, desc } = action.payload;
      
      if (index < 0 || index >= state.serviceData.descriptions.length) {
        return;
      }
      
      // Update all arrays at the specified index
      const arraysToUpdate = [
        'sacCode', 'desc_ids', 'descriptions', 'from_dates', 'to_dates',
        'fees', 'quantity', 'remarks', 'desc_tax_types', 'desc_tax_pers',
        'desc_sgst', 'desc_cgst', 'desc_igst', 'desc_tax_amounts',
        'desc_totals', 'desc_total_fees', 'desc_discount_amounts', 
        'desc_discount_percentages', 'base_amounts'
      ] as const;
      
      arraysToUpdate.forEach(arrayKey => {
        if (Array.isArray(state.serviceData[arrayKey]) && index < state.serviceData[arrayKey].length) {
          switch(arrayKey) {
            case 'sacCode': 
              state.serviceData.sacCode[index] = desc.sacCode; 
              break;
            case 'desc_ids': 
              state.serviceData.desc_ids[index] = desc.id || state.serviceData.desc_ids[index]; 
              break;
            case 'descriptions': 
              state.serviceData.descriptions[index] = desc.description; 
              break;
            case 'from_dates': 
              state.serviceData.from_dates[index] = desc.from_date !== undefined ? desc.from_date : null; 
              break;
            case 'to_dates': 
              state.serviceData.to_dates[index] = desc.to_date !== undefined ? desc.to_date : null; 
              break;
            case 'fees': 
              state.serviceData.fees[index] = desc.fee; 
              break;
            case 'quantity': 
              state.serviceData.quantity[index] = desc.quantity; 
              break;
            case 'remarks': 
              state.serviceData.remarks[index] = desc.remarks; 
              break;
            case 'desc_tax_types': 
              state.serviceData.desc_tax_types[index] = desc.tax_type; 
              break;
            case 'desc_tax_pers': 
              state.serviceData.desc_tax_pers[index] = desc.tax_per; 
              break;
            case 'desc_sgst': 
              state.serviceData.desc_sgst[index] = desc.sgst; 
              break;
            case 'desc_cgst': 
              state.serviceData.desc_cgst[index] = desc.cgst; 
              break;
            case 'desc_igst': 
              state.serviceData.desc_igst[index] = desc.igst; 
              break;
            case 'desc_tax_amounts': 
              state.serviceData.desc_tax_amounts[index] = desc.taxAmount; 
              break;
            case 'desc_totals': 
              state.serviceData.desc_totals[index] = desc.total; 
              break;
            case 'desc_total_fees': 
              state.serviceData.desc_total_fees[index] = desc.totalFee; 
              break;
            case 'desc_discount_amounts': 
              state.serviceData.desc_discount_amounts[index] = desc.discount_amount || 0; 
              break;
            case 'desc_discount_percentages': 
              state.serviceData.desc_discount_percentages[index] = desc.discount_percentage || 0;
              break;
            case 'base_amounts': 
              state.serviceData.base_amounts[index] = desc.base_amount || 0;
              break;
          }
        }
      });
    },
       // CRITICAL: Update deleteDescriptionFromService to remove from discount arrays
    deleteDescriptionFromService: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      
      if (index < 0 || index >= state.serviceData.descriptions.length) {
        return;
      }
      
      // Helper function to remove element at index
      const removeFromArray = <T>(arr: T[], idx: number): T[] => {
        return arr.filter((_, i) => i !== idx);
      };
      
      // Remove from all flat arrays
      state.serviceData = {
        ...state.serviceData,
        sacCode: removeFromArray(state.serviceData.sacCode, index),
        desc_ids: removeFromArray(state.serviceData.desc_ids, index),
        descriptions: removeFromArray(state.serviceData.descriptions, index),
        from_dates: removeFromArray(state.serviceData.from_dates, index),
        to_dates: removeFromArray(state.serviceData.to_dates, index),
        fees: removeFromArray(state.serviceData.fees, index),
        quantity: removeFromArray(state.serviceData.quantity, index),
        remarks: removeFromArray(state.serviceData.remarks, index),
        desc_tax_types: removeFromArray(state.serviceData.desc_tax_types, index),
        desc_tax_pers: removeFromArray(state.serviceData.desc_tax_pers, index),
        desc_sgst: removeFromArray(state.serviceData.desc_sgst, index),
        desc_cgst: removeFromArray(state.serviceData.desc_cgst, index),
        desc_igst: removeFromArray(state.serviceData.desc_igst, index),
        desc_tax_amounts: removeFromArray(state.serviceData.desc_tax_amounts, index),
        desc_totals: removeFromArray(state.serviceData.desc_totals, index),
        desc_total_fees: removeFromArray(state.serviceData.desc_total_fees, index),
        desc_discount_amounts: removeFromArray(state.serviceData.desc_discount_amounts, index),
        desc_discount_percentages: removeFromArray(state.serviceData.desc_discount_percentages, index),
        desc_overall_discounts: removeFromArray(state.serviceData.desc_overall_discounts, index),
        base_amounts: removeFromArray(state.serviceData.base_amounts || [], index),
      };
    },
     setDescriptionForEditing(state, action: PayloadAction<ServiceDescription & { index?: number }>) {
      state.newDescription = {
        ...initialState.newDescription,
        ...action.payload,
      };
    },
    
    clearDescriptionForEditing(state) {
      state.newDescription = initialState.newDescription;
    },
    
    setReduxTotals: (state, action: PayloadAction<{
      totalFees: number;
      totalAmount: number;
      totalDiscount: number;
      totalTax: number;
    }>) => {
      state.serviceData.totalAmount = action.payload.totalAmount;
      state.totalFees = action.payload.totalFees;
      state.totalDiscount = action.payload.totalDiscount;
      state.totalTax = action.payload.totalTax;
    },
    
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    
    clearSnackbarMessage(state) {
      state.snackbarMessage = '';
      state.snackbarOpen = false;
    },
    
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    
    clearVendors: (state) => {
      state.vendors = [];
      localStorage.removeItem('serviceVendors');
    },
    
    updateSkip: (state, action: PayloadAction<number>) => {
      state.skip = action.payload;
    },
    
    setCalculatedTotals: (state, action: PayloadAction<ServiceTotalsResponse | null>) => {
      state.calculatedTotals = action.payload;
    },
    
    clearCalculatedTotals: (state) => {
      state.calculatedTotals = null;
    },
    
    clearServiceData: (state) => {
      state.serviceData = initialState.serviceData;
      state.newDescription = initialState.newDescription;
    },
    
    // NEW: Clear description discount fields
    clearDescriptionDiscount: (state) => {
      state.newDescription = {
        ...state.newDescription,
        discount_percentage: 0,
        discount_amount: 0,
      };
    },
    
    // NEW: Set overall discount applied on
    setOverallDiscountAppliedOn: (state, action: PayloadAction<'before_tax' | 'after_tax'>) => {
      state.serviceData.overallDiscountAppliedOn = action.payload;
    },
  },
  
  extraReducers: (builder) => {
    builder
       .addCase(calculateServiceTotals.pending, (state) => {
        state.serviceTotalsLoading = true;
        state.error = null;
      })
      .addCase(calculateServiceTotals.fulfilled, (state, action) => {
        state.serviceTotalsLoading = false;
        state.calculatedTotals = action.payload;
        state.error = null;
        
        // Update service data with calculated values
        if (action.payload) {
          state.serviceData = {
            ...state.serviceData,
            desc_sgst: action.payload.desc_sgst || [],
            desc_cgst: action.payload.desc_cgst || [],
            desc_igst: action.payload.desc_igst || [],
            desc_tax_amounts: action.payload.desc_tax_amounts || [],
            base_amounts: action.payload.desc_base_amounts || [],
            desc_totals: action.payload.desc_totals || [],
            desc_discount_amounts: action.payload.desc_discount_amounts || [],
            desc_discount_percentages: action.payload.desc_discount_percentages || [],
            desc_overall_discounts: action.payload.desc_overall_discounts || [],
            totalFees: action.payload.totalFees || 0,
            totalDiscount: action.payload.totalDiscount || 0,
            totalTax: action.payload.totalTax || 0,
            totalAmount: action.payload.totalAmount || 0,
          };
        }
      })
      .addCase(calculateServiceTotals.rejected, (state, action) => {
        state.serviceTotalsLoading = false;
        state.error = action.payload as string || 'Failed to calculate totals';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      })
      
      .addCase(calculateDescriptionTotals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(calculateDescriptionTotals.fulfilled, (state, action: PayloadAction<DescriptionCalculationResponse>) => {
        state.loading = false;
        state.newDescription = {
          ...state.newDescription,
          ...action.payload,
          taxAmount: action.payload.totalTax,
          totalFee: action.payload.baseAmount || 0,
          finalFee: action.payload.total || 0,
          total: action.payload.total,
          base_amount: action.payload.baseAmount || 0,
        };
        state.error = null;
      })
      .addCase(calculateDescriptionTotals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to calculate description totals';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      })
      .addCase(fetchServices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServices.fulfilled, (state, action: PayloadAction<ServiceData[]>) => {
        state.loading = false;
        state.services = action.payload;
        state.error = null;
      })
      .addCase(fetchServices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || action.error.message || 'Failed to fetch services';
      })      
      .addCase(fetchAllVendors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllVendors.fulfilled, (state, action: PayloadAction<VendorSummary[]>) => {
        state.loading = false;
        state.vendors = action.payload;
        localStorage.setItem('serviceVendors', JSON.stringify(action.payload));
        state.error = null;
      })
      .addCase(fetchAllVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch vendors';
      })

      .addCase(fetchServiceById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServiceById.fulfilled, (state, action: PayloadAction<ServiceData>) => {
        state.loading = false;
        state.serviceData = action.payload;
        state.error = null;
      })
      .addCase(fetchServiceById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch service';
      })
      
      .addCase(addService.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addService.fulfilled, (state, action: PayloadAction<ServiceData>) => {
        state.loading = false;
        state.services.push(action.payload);
        state.serviceData = action.payload;
        state.error = null;
        state.successMessage = 'Service order created successfully';
        state.snackbarMessage = state.successMessage;
        state.snackbarOpen = true;
      })
      .addCase(addService.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to add service';
        state.snackbarMessage = state.error || '';
        state.snackbarOpen = true;
      })
      
      .addCase(updateService.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateService.fulfilled, (state, action: PayloadAction<ServiceData>) => {
        state.loading = false;
        const index = state.services.findIndex(s => s.serviceId === action.payload.serviceId);
        if (index !== -1) {
          state.services[index] = action.payload;
        }
        state.serviceData = action.payload;
        state.error = null;
        state.successMessage = 'Service order updated successfully';
        state.snackbarMessage = state.successMessage;
        state.snackbarOpen = true;
      })
      .addCase(updateService.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to update service';
        state.snackbarMessage = state.error || '';
        state.snackbarOpen = true;
      })
      
      .addCase(approveServiceOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(approveServiceOrder.fulfilled, (state, action) => {
        state.loading = false;
        // Update the service in list if found
        const index = state.services.findIndex(s => s.serviceId === action.meta.arg); // serviceId from arg
        if (index !== -1) {
          state.services[index].status = 'Approved';
          state.services[index].approvedDate = new Date().toISOString();
        }
        if (state.serviceData.serviceId === action.meta.arg) {
          state.serviceData.status = 'Approved';
          state.serviceData.approvedDate = new Date().toISOString();
        }
        state.error = null;
        state.successMessage = 'Service order approved successfully';
        state.snackbarMessage = state.successMessage;
        state.snackbarOpen = true;
      })
      .addCase(approveServiceOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to approve service order';
        state.snackbarMessage = state.error || '';
        state.snackbarOpen = true;
      })
      
      .addCase(rejectServiceOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(rejectServiceOrder.fulfilled, (state, action) => {
        state.loading = false;
        // Update the service in list if found
        const index = state.services.findIndex(s => s.serviceId === action.meta.arg);
        if (index !== -1) {
          state.services[index].status = 'Rejected';
          state.services[index].rejectedDate = new Date().toISOString();
        }
        if (state.serviceData.serviceId === action.meta.arg) {
          state.serviceData.status = 'Rejected';
          state.serviceData.rejectedDate = new Date().toISOString();
        }
        state.error = null;
        state.successMessage = 'Service order rejected successfully';
        state.snackbarMessage = state.successMessage;
        state.snackbarOpen = true;
      })
      .addCase(rejectServiceOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to reject service order';
        state.snackbarMessage = state.error || '';
        state.snackbarOpen = true;
      })
      
      .addCase(setDiscountMode, (state, action) => {
        state.discountMode = action.payload.mode;
      });
  },
});

export const {
  setServiceData,
  setNewDescriptionData,
  addDescriptionToService,
  updateDescription,
  deleteDescriptionFromService,
  setDescriptionForEditing,
  clearDescriptionForEditing,
  setReduxTotals,
  setSearchQuery,
  setSnackbarMessage,
  clearSnackbarMessage,
  setSnackbarOpen,
  clearVendors,
  updateSkip,
  setCalculatedTotals,
  clearCalculatedTotals,
  clearServiceData,
  clearDescriptionDiscount,
  setOverallDiscountAppliedOn,
} = serviceOrderSlice.actions;

export const selectServiceState = (state: RootState) => state.serviceOrder;

export default serviceOrderSlice.reducer;