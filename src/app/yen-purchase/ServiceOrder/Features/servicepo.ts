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

// FIXED: Helper for date-only formatting (YYYY-MM-DD) for UI display
const formatDateOnly = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) return '';
  let dt: Date;
  if (typeof dateValue === 'string') {
    dt = new Date(dateValue);
  } else {
    dt = new Date(dateValue);
  }
  if (isNaN(dt.getTime())) return '';
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// FIXED: Helper for backend datetime (ISO with time 00:00:00 for date-only fields)
const formatDateTimeForBackend = (dateTimeValue: Date | string | null | undefined): string => {
  if (!dateTimeValue) return '';
  let dt: Date;
  if (typeof dateTimeValue === 'string') {
    dt = new Date(dateTimeValue);
  } else {
    dt = new Date(dateTimeValue);
  }
  if (isNaN(dt.getTime())) return '';
  // Set time to 00:00:00.000 for date-only fields
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString();
};

// FIXED: Transform backend flat arrays to frontend ServiceData
const transformRawToNested = (raw: RawServiceData): ServiceData => {
  const sacCodesRaw = raw.sacCode || [];
  const descIdsRaw = raw.desc_ids || [];
  const descriptionsRaw = raw.descriptions || raw.desc_descriptions || [];
  const fromDatesRaw = raw.from_dates || [];
  const toDatesRaw = raw.to_dates || [];
  const feesRaw = raw.fees || [];
  const descTaxTypesRaw = raw.desc_tax_types || [];
  const descTaxPersRaw = raw.desc_tax_pers || [];
  const descSgstRaw = raw.desc_sgst || [];
  const descCgstRaw = raw.desc_cgst || [];
  const descIgstRaw = raw.desc_igst || [];
  const descOverallDiscountsRaw = raw.desc_overall_discounts || [];
  const remarksRaw = raw.remarks || [];
  const quantityRaw = raw.quantity || [];
  
  // Calculate additional arrays
  const descTaxAmountsRaw = descSgstRaw.map((sgst, i) =>
    sgst + (descCgstRaw[i] || 0) + (descIgstRaw[i] || 0)
  );
  
  const descTotalsRaw = feesRaw.map((fee, i) =>
    fee + descTaxAmountsRaw[i] - (descOverallDiscountsRaw[i] || 0)
  );
  
  const descDiscountAmountsRaw = new Array(feesRaw.length).fill(0);

  // FIXED: Format dates for frontend (YYYY-MM-DD for date-only display)
  const formattedWorkOrderDate = raw.workOrderDate ? formatDateOnly(raw.workOrderDate) : null;
  const formattedCreatedDate = raw.createdDate ? formatDateOnly(raw.createdDate) : null;
  
  // For description dates, keep as date-only strings for UI
  const formattedFromDates = fromDatesRaw.map(d => formatDateOnly(d));
  const formattedToDates = toDatesRaw.map(d => formatDateOnly(d));
  
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
    
    // FLAT ARRAYS (date-only strings for UI)
    sacCode: sacCodesRaw,
    desc_ids: descIdsRaw,
    desc_descriptions: descriptionsRaw,
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
    desc_overall_discounts: descOverallDiscountsRaw,
    
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
    creditLimit: raw.creditLimit || 0,
    locationName: raw.locationName || '',
    freights: raw.freights || [],
    totalFreightAmount: raw.totalFreightAmount || 0,
    totalFreightTaxAmount: raw.totalFreightTaxAmount || 0,
    roundOffValue: raw.roundOffValue || 0,
    overallDiscountValue: raw.overallDiscountValue || 0,
    overallDiscountType: raw.overallDiscountType || 'percentage',
    totalTax: raw.totalTax || 0,
    serviceCreatedPerson: raw.serviceCreatedPerson ?? null,
    serviceApprovedPerson: raw.serviceApprovedPerson ?? null,
    serviceRejectedPerson: raw.serviceRejectedPerson ?? null,
    mongoId: raw.mongoId || '',
    imageUrl: raw.imageUrl || '',
    createdDate: formattedCreatedDate || null,
    createdTime: raw.createdTime || null,
    lastUpdatedDate: raw.lastUpdatedDate ? formatDateOnly(raw.lastUpdatedDate) : null,
    lastUpdatedTime: raw.lastUpdatedTime || null,
  };
};


// Helper to format time string
const formatTimeString = (timeValue: any): string | null => {
  if (!timeValue) return null;
  const dt = new Date(`1970-01-01T${timeValue}`);
  return dt.toTimeString().slice(0, 8);
};

// Helper to calculate tax values for a description (unchanged)
const calculateTaxValues = (fee: number, taxPer: number, taxType: 'cgst_sgst' | 'igst') => {
  const taxAmount = fee * (taxPer / 100);
  let sgst = 0, cgst = 0, igst = 0;
 
  if (taxType === 'cgst_sgst') {
    sgst = taxAmount / 2;
    cgst = taxAmount / 2;
  } else {
    igst = taxAmount;
  }
 
  const total = fee + taxAmount;
 
  return {
    taxAmount,
    sgst,
    cgst,
    igst,
    total
  };
};
// FIXED: Helper to add description to flat arrays
const addDescriptionToFlatArrays = (
  currentData: ServiceData,
  newDesc: ServiceDescription
): ServiceData => {
  const { taxAmount, sgst, cgst, igst, total } = calculateTaxValues(
    newDesc.fee * (newDesc.quantity || 1), // Multiply by quantity
    newDesc.tax_per || 0,
    newDesc.tax_type
  );
 
  const uniqueId = `desc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
 
  return {
    ...currentData,
    sacCode: [...currentData.sacCode, newDesc.sacCode || ''],
    desc_ids: [...currentData.desc_ids, uniqueId],
    desc_descriptions: [...currentData.desc_descriptions, newDesc.description],
    from_dates: [...currentData.from_dates, newDesc.from_date || null],
    to_dates: [...currentData.to_dates, newDesc.to_date || null],
    fees: [...currentData.fees, newDesc.fee],
    remarks: [...currentData.remarks, newDesc.remarks || ''],
    quantity: [...currentData.quantity, newDesc.quantity || 1],
    desc_tax_types: [...currentData.desc_tax_types, newDesc.tax_type],
    desc_tax_pers: [...currentData.desc_tax_pers, newDesc.tax_per || 0],
    desc_sgst: [...currentData.desc_sgst, sgst],
    desc_cgst: [...currentData.desc_cgst, cgst],
    desc_igst: [...currentData.desc_igst, igst],
    desc_tax_amounts: [...currentData.desc_tax_amounts, taxAmount],
    desc_totals: [...currentData.desc_totals, total],
    desc_total_fees: [...currentData.desc_total_fees, newDesc.fee * (newDesc.quantity || 1)],
    desc_discount_amounts: [...currentData.desc_discount_amounts, newDesc.discountAmount || 0],
    desc_overall_discounts: [...(currentData.desc_overall_discounts || []), 0],
  };
};


// FIXED: Helper to update description in flat arrays
const updateDescriptionInFlatArrays = (
  currentData: ServiceData,
  index: number,
  updatedDesc: ServiceDescription
): ServiceData => {
  if (index < 0 || index >= currentData.desc_descriptions.length) {
    return currentData; // Invalid index, no update
  }

  const { taxAmount, sgst, cgst, igst, total } = calculateTaxValues(
    updatedDesc.fee * (updatedDesc.quantity || 1),
    updatedDesc.tax_per || 0,
    updatedDesc.tax_type
  );

  // Create new arrays with updated values at index
  const updateArray = <T>(arr: T[], idx: number, value: T): T[] => {
    const newArr = [...arr];
    newArr[idx] = value;
    return newArr;
  };

  return {
    ...currentData,
    sacCode: updateArray(currentData.sacCode, index, updatedDesc.sacCode || ''),
    desc_ids: updateArray(currentData.desc_ids, index, updatedDesc.id || currentData.desc_ids[index]),
    desc_descriptions: updateArray(currentData.desc_descriptions, index, updatedDesc.description),
    from_dates: updateArray(currentData.from_dates, index, updatedDesc.from_date || null),
    to_dates: updateArray(currentData.to_dates, index, updatedDesc.to_date || null),
    fees: updateArray(currentData.fees, index, updatedDesc.fee),
    remarks: updateArray(currentData.remarks, index, updatedDesc.remarks || ''),
    quantity: updateArray(currentData.quantity, index, updatedDesc.quantity || 1),
    desc_tax_types: updateArray(currentData.desc_tax_types, index, updatedDesc.tax_type),
    desc_tax_pers: updateArray(currentData.desc_tax_pers, index, updatedDesc.tax_per || 0),
    desc_sgst: updateArray(currentData.desc_sgst, index, sgst),
    desc_cgst: updateArray(currentData.desc_cgst, index, cgst),
    desc_igst: updateArray(currentData.desc_igst, index, igst),
    desc_tax_amounts: updateArray(currentData.desc_tax_amounts, index, taxAmount),
    desc_totals: updateArray(currentData.desc_totals, index, total),
    desc_total_fees: updateArray(currentData.desc_total_fees, index, updatedDesc.fee * (updatedDesc.quantity || 1)),
    desc_discount_amounts: updateArray(currentData.desc_discount_amounts, index, updatedDesc.discountAmount || 0),
    desc_overall_discounts: updateArray(currentData.desc_overall_discounts, index, currentData.desc_overall_discounts[index] || 0), // Preserve existing overall discount
  };
};

export const initialState: ServiceState = {
  serviceData: {
    serviceId: '',
    vendorId: '',
    vendorName: '',
    vendorContact: '',
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
    desc_descriptions: [],
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
    desc_overall_discounts: [], // NEW

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
    quantity:[],
  },
  
  // FIXED: newDescription with quantity and remarks
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
    quantity: 1, // NEW
    remarks: '', // NEW
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

const BASE_URL = 'http://192.168.29.116:8000/purchaseapi';

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
  async (): Promise<ServiceData[]> => {
    const response = await axios.get<RawServiceData[]>(`${BASE_URL}/servicepo/`);
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

export const calculateDescriptionTotals = createAsyncThunk<
  DescriptionCalculationResponse,
  DescriptionCalculationRequest & { quantity?: number },
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
      quantity = 1, // FIXED: Default quantity
      remarks
    },
    { rejectWithValue }
  ) => {
    try {
      const params: any = {
        description,
        fromDate: formatDateOnly(fromDate), // Date-only
        toDate: formatDateOnly(toDate),
        fee,
        taxPer: taxPer || 0,
        taxType,
        quantity, // NEW: Include quantity if provided
        remarks
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
        
        // Convert date strings to datetime for backend
        from_dates: service.from_dates.map(dateStr => 
          dateStr ? formatDateTimeForBackend(dateStr) : ''
        ),
        to_dates: service.to_dates.map(dateStr => 
          dateStr ? formatDateTimeForBackend(dateStr) : ''
        ),
        
        // Map arrays
        descriptions: service.desc_descriptions,
        sacCode: service.sacCode || [],
        
        // Include all array fields
        desc_ids: service.desc_ids || [],
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
        desc_discount_amounts: service.desc_discount_amounts || [],
        desc_overall_discounts: service.desc_overall_discounts || [],
        
        overallDiscountType: service.overallDiscountType || 'percentage',
      };
      
      console.log('Sending to backend:', JSON.stringify(serviceToAdd, null, 2));
      
      const rawResponse = await axios.post<RawServiceData>(
        `${BASE_URL}/servicepo/`, 
        serviceToAdd
      );
      
      return transformRawToNested(rawResponse.data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to add service');
    }
  }
);


export const updateService = createAsyncThunk<
  ServiceData,
  { serviceId: string; service: ServiceData },
  { rejectValue: string }
>(
  'services/update',
  async ({ serviceId, service }, { rejectWithValue }) => {
    try {
      const serviceToUpdate = {
        ...service,
        workOrderDate: formatDateTimeForBackend(service.workOrderDate),
        descriptions: service.desc_descriptions,
        from_dates: service.from_dates.map(dateStr => dateStr ? formatDateTimeForBackend(dateStr) : ''),
        to_dates: service.to_dates.map(dateStr => dateStr ? formatDateTimeForBackend(dateStr) : ''),
        sacCode: service.sacCode || [],
        overallDiscountType: service.overallDiscountType || 'percentage',
        desc_overall_discounts: service.desc_overall_discounts || [], // NEW
      };
      
      const rawResponse = await axios.put<RawServiceData>(
        `${BASE_URL}/servicepo/${serviceId}`, 
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
  async (serviceId, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${BASE_URL}/servicepo/approved/${serviceId}`, { send_whatsapp: true });
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
  async (serviceId, { rejectWithValue }) => {
    try {
      await axios.patch(`${BASE_URL}/servicepo/rejected/${serviceId}`, { reason: 'Rejected by user', send_notification: true });
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
      // FIXED: Merge with defaults for arrays, ensure desc_overall_discounts
      state.serviceData = {
        ...initialState.serviceData,
        ...action.payload,
        desc_overall_discounts: action.payload.desc_overall_discounts || initialState.serviceData.desc_overall_discounts,
      };
    },
    
    setNewDescriptionData(state, action: PayloadAction<Partial<ServiceDescription>>) {
      state.newDescription = { ...state.newDescription, ...action.payload };
    },
   // In your serviceSlice.ts, check the addDescriptionToService reducer
addDescriptionToService: (state, action: PayloadAction<ServiceDescription>) => {
  const desc = action.payload;
  state.serviceData = {
    ...state.serviceData,
    // Add to all flat arrays
    sacCode: [...state.serviceData.sacCode, desc.sacCode || ''],
    desc_ids: [...state.serviceData.desc_ids, desc.id || ''],
    desc_descriptions: [...state.serviceData.desc_descriptions, desc.description || ''],
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
    desc_discount_amounts: [...state.serviceData.desc_discount_amounts, desc.discountAmount || 0],
    desc_overall_discounts: [...state.serviceData.desc_overall_discounts, 0],
  };
},
    // FIXED: Update description by index (include remarks, quantity, desc_overall_discounts)
    updateDescription: (state, action: PayloadAction<{ index: number; desc: ServiceDescription }>) => {
      const { index, desc } = action.payload;
      state.serviceData = updateDescriptionInFlatArrays(state.serviceData, index, desc);
    },
    // FIXED: Delete description by index (include desc_overall_discounts)
    deleteDescriptionFromService: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      
      // Remove from all arrays at the same index
      const arraysToUpdate = [
        'sacCode', 'desc_ids', 'desc_descriptions', 'from_dates', 'to_dates',
        'fees', 'desc_tax_types', 'desc_tax_pers', 'desc_sgst', 'desc_cgst',
        'desc_igst', 'desc_tax_amounts', 'desc_totals', 'desc_total_fees',
        'desc_discount_amounts', 'desc_overall_discounts','remarks','quantity' // NEW
      ] as const;
      
      arraysToUpdate.forEach(arrayKey => {
        if (Array.isArray(state.serviceData[arrayKey])) {
          (state.serviceData[arrayKey] as any[]).splice(index, 1);
        }
      });
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
    
    // Helper to clear service data
    clearServiceData: (state) => {
      state.serviceData = initialState.serviceData;
      state.newDescription = initialState.newDescription;
    },
  },
  
  extraReducers: (builder) => {
    builder
      // FIXED: calculateServiceTotals cases
      .addCase(calculateServiceTotals.pending, (state) => {
        state.serviceTotalsLoading = true;
        state.error = null;
      })
      .addCase(calculateServiceTotals.fulfilled, (state, action) => {
        state.serviceTotalsLoading = false;
        state.calculatedTotals = action.payload;
        state.error = null;
      })
      .addCase(calculateServiceTotals.rejected, (state, action) => {
        state.serviceTotalsLoading = false;
        state.error = action.payload as string || 'Failed to calculate totals';
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
          totalFee: action.payload.totalFee || action.payload.baseAmount,
          finalFee: action.payload.totalFee || action.payload.baseAmount,
          total: action.payload.total,
        };
        state.error = null;
      })
      .addCase(calculateDescriptionTotals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to calculate description totals';
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
} = serviceOrderSlice.actions;

export const selectServiceState = (state: RootState) => state.serviceOrder;

export default serviceOrderSlice.reducer;