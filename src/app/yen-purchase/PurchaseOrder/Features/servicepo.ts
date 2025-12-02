import { createSlice, PayloadAction, createAsyncThunk, createAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';
import {
  ServiceDescription,
  ServiceData,
  ServiceState,
  ServiceTotalsResponse,
  Freight
} from "../Models/servicepo"
import { VendorSummary } from "@/Models/vendor";
import { OverallDiscountServiceResponse, OverallDiscountServiceRequest } from '../Models/Itemcalculation';

// Types for description calculation (analogous to item)
interface DescriptionCalculationRequest {
  description: string;
  fromDate: string;
  toDate: string;
  fee: number;
  taxType: 'cgst_sgst' | 'igst';
  taxPer?: number;
}
interface DescriptionCalculationResponse {
  totalFee: number;
  sgst: number;
  cgst: number;
  igst: number;
  totalTax: number;
  total: number;
}
interface ServiceTotalsRequest {
  descriptions: ServiceDescription[];
}

// Raw response type from backend (flat arrays)
interface RawServiceData {
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
  descriptions: string[];
  desc_ids?: string[];
  from_dates: string[];
  to_dates: string[];
  fees: number[];
  desc_tax_types: ('cgst_sgst' | 'igst')[];
  desc_tax_pers: number[];
  desc_sgst?: number[];
  desc_cgst?: number[];
  desc_igst?: number[];
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
  serviceType: 'workorder' | 'ap';
  workOrderNumber: string;
  overallDiscountValue: number;
  roundOffValue: number;
  totalTax: number;
  randomId: string;
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
const transformRawToNested = (raw: RawServiceData): ServiceData => {
  const numDescriptions = raw.descriptions.length;
  const descriptions: ServiceDescription[] = raw.descriptions.map((description, index) => {
    const fee = raw.fees[index] || 0;
    const sgst = raw.desc_sgst?.[index] || 0;
    const cgst = raw.desc_cgst?.[index] || 0;
    const igst = raw.desc_igst?.[index] || 0;
    const total = fee + sgst + cgst + igst;
    const taxAmount = sgst + cgst + igst;
    return {
      id: raw.desc_ids?.[index] || '',
      description,
      from_date: raw.from_dates[index] || null,
      to_date: raw.to_dates[index] || null,
      fee,
      tax_type: raw.desc_tax_types[index] || 'cgst_sgst',
      tax_per: raw.desc_tax_pers[index] || 0,
      sgst,
      cgst,
      igst,
      total,
      taxAmount,
      totalFee: fee,
      finalFee: fee,
    };
  });

  return {
    ...raw,
    createdDate: raw.createdDate ?? undefined,
    createdTime: raw.createdTime ?? undefined,
    lastUpdatedDate: raw.lastUpdatedDate ?? undefined,
    lastUpdatedTime: raw.lastUpdatedTime ?? undefined,
    serviceCreatedPerson: raw.serviceCreatedPerson ?? undefined,
    serviceApprovedPerson: raw.serviceApprovedPerson ?? undefined,
    serviceRejectedPerson: raw.serviceRejectedPerson ?? undefined,
    descriptions,
    freights: raw.freights || [],
    totalFreightAmount: raw.totalFreightAmount || 0,
    totalFreightTaxAmount: raw.totalFreightTaxAmount || 0,
    // Ensure flat arrays are also set for backward compatibility if needed
    desc_ids: raw.desc_ids || [],
    from_dates: raw.from_dates || [],
    to_dates: raw.to_dates || [],
    fees: raw.fees || [],
    desc_tax_types: raw.desc_tax_types || [],
    desc_tax_pers: raw.desc_tax_pers || [],
    desc_sgst: raw.desc_sgst || [],
    desc_cgst: raw.desc_cgst || [],
    desc_igst: raw.desc_igst || [],
  };
};

export const initialState: ServiceState = {
  serviceData: {
    serviceId: '',
    vendorName: '',
    vendorContact: '',
    orderDate: null,
    approvedDate: null,
    rejectedDate: null,
    invoiceDate: null,
    invoiceNo: '',
    expectedDeliveryDate: null,
    status: '',
    descriptions: [],
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
    serviceType: 'workorder',
    workOrderNumber: '',
    overallDiscountValue: 0,
    roundOffValue: 0,
    totalTax: 0,
    randomId: '',
    desc_ids: [],
    from_dates: [],
    to_dates: [],
    fees: [],
    desc_tax_types: [],
    desc_tax_pers: [],
    desc_sgst: [],
    desc_cgst: [],
    desc_igst: []
  },
  newDescription: {
    id: '',
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
  // Totals loading
  serviceTotalsLoading: false,
  calculatedTotals: null,
};

const BASE_URL = 'http://192.168.29.116:8000/purchaseapi'; // Assumed base URL for services
// Async thunks
export const calculateServiceTotals = createAsyncThunk(
  'serviceOrder/calculateServiceTotals',
  async (request: ServiceTotalsRequest): Promise<ServiceTotalsResponse> => {
    const response = await axios.post<ServiceTotalsResponse>(
      `${BASE_URL}/servicepo/calculate-totals`, // Add /purchaseapi/
      {
        descriptions: request.descriptions,
      }
    );
    return response.data;
  }
);
export const fetchServices = createAsyncThunk(
  'serviceOrder/fetchServices',
  async (): Promise<ServiceData[]> => {
    const response = await axios.get<RawServiceData[]>(`${BASE_URL}/servicepo/`);
    return response.data.map(transformRawToNested);
  }
);
export const fetchAllVendors = createAsyncThunk(
  'serviceOrder/fetchAllVendors',
  async (_, { getState }) => {
    const localData = localStorage.getItem('serviceVendors');
    if (localData) {
      const cachedVendors = JSON.parse(localData);
      return cachedVendors;
    }
    const response = await axios.get<VendorSummary[]>(`${BASE_URL}/vendors/`);
    localStorage.setItem('serviceVendors', JSON.stringify(response.data));
    return response.data;
  }
);
export const fetchServiceById = createAsyncThunk(
  'serviceOrder/fetchServiceById',
  async (serviceId: string): Promise<ServiceData> => {
    const response = await axios.get<RawServiceData>(`${BASE_URL}/servicepo/${serviceId}`);
    return transformRawToNested(response.data);
  }
);
export const calculateDescriptionTotals = createAsyncThunk(
  'serviceOrder/calculateDescriptionTotals',
  async (
    {
      description,
      fromDate,
      toDate,
      fee,
      taxPer,
      taxType,
    }: DescriptionCalculationRequest,
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { serviceOrder: ServiceState };
      const { discountMode } = state.serviceOrder;
      const params: any = {
        description,
        fromDate,
        toDate,
        fee,
        taxPer: taxPer || 0,
        taxType,
      };
      const response = await axios.get<{
        totalFee: number;
        sgst: number;
        cgst: number;
        igst: number;
        totalTax: number;
        total: number;
      }>(`${BASE_URL}/servicepo/descriptions/totals`, { params });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'An unknown error occurred'
      );
    }
  }
);
export const calculateOverallDiscountForAllDescriptions = createAsyncThunk<
  OverallDiscountServiceResponse,
  OverallDiscountServiceRequest,
  { rejectValue: OverallDiscountServiceResponse }
>(
  'serviceOrder/calculateOverallDiscountForAllDescriptions',
  async (payload: OverallDiscountServiceRequest, { rejectWithValue }) => {
    try {
      console.log('Sending to backend:', payload);
      const response = await axios.post<OverallDiscountServiceResponse>(`${BASE_URL}/servicepo/descriptions/calculate-overall-discount`, payload);
      const result: OverallDiscountServiceResponse = response.data;
      console.log('Backend response:', result);
      return result;
    } catch (error: any) {
      console.error('Error calculating overall discount:', error);
      return rejectWithValue({
        success: false,
        error: error.response?.data?.message || error.message || 'Unknown error occurred',
        descriptions: [], // Assumed
        summary: {
          totalSubtotal: 0,
          overallDiscountTotalAmount: 0,
          totalFinalAmount: 0,
          totalTaxAmount: 0,
          totalDiscountAmount: 0,
          totalDescriptions: 0,
        },
      });
    }
  }
);
export const addService = createAsyncThunk(
  'services/add',
  async (
    service: Omit<ServiceData, 'serviceId'> & { serviceType: 'workorder' | 'ap' },
    { dispatch }
  ) => {
    // Destructure to exclude nested arrays
    const { descriptions: _, ...serviceWithoutNested } = service;
    // Flatten descriptions
    const descriptionsFlat = service.descriptions.map(d => d.description);
    const descIdsFlat = service.descriptions.map(d => d.id || '');
    const fromDatesFlat = service.descriptions.map(d => d.from_date || '');
    const toDatesFlat = service.descriptions.map(d => d.to_date || '');
    const feesFlat = service.descriptions.map(d => d.fee || 0);
    const descTaxTypesFlat = service.descriptions.map(d => d.tax_type || 'cgst_sgst');
    const descTaxPersFlat = service.descriptions.map(d => d.tax_per || 0);
    const descSgstFlat = service.descriptions.map(d => d.sgst || 0);
    const descCgstFlat = service.descriptions.map(d => d.cgst || 0);
    const descIgstFlat = service.descriptions.map(d => d.igst || 0);
    const serviceToAdd = {
      ...serviceWithoutNested,
      // Flat descriptions
      descriptions: descriptionsFlat,
      desc_ids: descIdsFlat,
      from_dates: fromDatesFlat,
      to_dates: toDatesFlat,
      fees: feesFlat,
      desc_tax_types: descTaxTypesFlat,
      desc_tax_pers: descTaxPersFlat,
      desc_sgst: descSgstFlat,
      desc_cgst: descCgstFlat,
      desc_igst: descIgstFlat,
    };
    const rawResponse = await axios.post<RawServiceData>(`${BASE_URL}/servicepo/`, serviceToAdd);
    dispatch(setSnackbarMessage('Service order processed'));
    return transformRawToNested(rawResponse.data);
  }
);
export const updateService = createAsyncThunk(
  'services/update',
  async ({ serviceId, service }: { serviceId: string; service: Partial<ServiceData> & { serviceType?: 'workorder' | 'ap' } }) => {
    // Destructure to exclude nested arrays
    const { descriptions: _, ...serviceWithoutNested } = service;
    // Same flattening logic as addService
    const descriptionsFlat = (service.descriptions || []).map(d => d.description);
    const descIdsFlat = (service.descriptions || []).map(d => d.id || '');
    const fromDatesFlat = (service.descriptions || []).map(d => d.from_date || '');
    const toDatesFlat = (service.descriptions || []).map(d => d.to_date || '');
    const feesFlat = (service.descriptions || []).map(d => d.fee || 0);
    const descTaxTypesFlat = (service.descriptions || []).map(d => d.tax_type || 'cgst_sgst');
    const descTaxPersFlat = (service.descriptions || []).map(d => d.tax_per || 0);
    const descSgstFlat = (service.descriptions || []).map(d => d.sgst || 0);
    const descCgstFlat = (service.descriptions || []).map(d => d.cgst || 0);
    const descIgstFlat = (service.descriptions || []).map(d => d.igst || 0);
    const serviceToUpdate = {
      ...serviceWithoutNested,
      descriptions: descriptionsFlat,
      desc_ids: descIdsFlat,
      from_dates: fromDatesFlat,
      to_dates: toDatesFlat,
      fees: feesFlat,
      desc_tax_types: descTaxTypesFlat,
      desc_tax_pers: descTaxPersFlat,
      desc_sgst: descSgstFlat,
      desc_cgst: descCgstFlat,
      desc_igst: descIgstFlat,
    };
    const rawResponse = await axios.patch<RawServiceData>(`${BASE_URL}/servicepo/${serviceId}`, serviceToUpdate);
    return transformRawToNested(rawResponse.data);
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
      state.serviceData = { ...state.serviceData, ...action.payload };
    },
    setNewDescriptionData(state, action: PayloadAction<Partial<ServiceDescription>>) {
      state.newDescription = { ...state.newDescription, ...action.payload };
    },
    addDescriptionToService(state) {
      const existingDescIndex = state.serviceData.descriptions.findIndex(desc => desc.id === state.newDescription.id);
      if (existingDescIndex !== -1) {
        state.serviceData.descriptions[existingDescIndex] = state.newDescription;
      } else {
        state.serviceData.descriptions.push(state.newDescription);
      }
      state.newDescription = initialState.newDescription;
    },
    deleteDescriptionFromService(state, action: PayloadAction<string>) {
      state.serviceData.descriptions = state.serviceData.descriptions.filter(desc => desc.id !== action.payload);
    },
    setDescriptionForEditing(state, action: PayloadAction<ServiceDescription>) {
      state.newDescription = {
        ...action.payload,
        description: action.payload.description,
        from_date: action.payload.from_date,
        to_date: action.payload.to_date,
        fee: action.payload.fee,
        tax_type: action.payload.tax_type,
        tax_per: action.payload.tax_per,
        sgst: action.payload.sgst,
        cgst: action.payload.cgst,
        igst: action.payload.igst,
        total: action.payload.total,
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
    updateSkip: (state, action) => {
      state.skip = action.payload;
    },
    setCalculatedTotals: (state, action: PayloadAction<ServiceTotalsResponse | null>) => {
      state.calculatedTotals = action.payload;
    },
    clearCalculatedTotals: (state) => {
      state.calculatedTotals = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Service totals calculation cases
      .addCase(calculateServiceTotals.pending, (state) => {
        state.serviceTotalsLoading = true;
      })
      .addCase(calculateServiceTotals.fulfilled, (state, action) => {
        state.serviceTotalsLoading = false;
        state.calculatedTotals = action.payload;
      })
      .addCase(calculateServiceTotals.rejected, (state) => {
        state.serviceTotalsLoading = false;
      })
      // Fetch services
      .addCase(fetchServices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServices.fulfilled, (state, action: PayloadAction<ServiceData[]>) => {
        state.loading = false;
        state.services = action.payload;
      })
      .addCase(fetchServices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch services';
      })
      // Fetch vendors
      .addCase(fetchAllVendors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllVendors.fulfilled, (state, action: PayloadAction<VendorSummary[]>) => {
        state.loading = false;
        state.vendors = action.payload;
        localStorage.setItem('serviceVendors', JSON.stringify(action.payload));
      })
      .addCase(fetchAllVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendors';
      })
      // Calculate description totals
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
          totalFee: action.payload.totalFee,
          finalFee: action.payload.totalFee,
          total: action.payload.total,
          sgst: action.payload.sgst,
          cgst: action.payload.cgst,
          igst: action.payload.igst,
        };
      })
      .addCase(calculateDescriptionTotals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to calculate description totals';
      })
      // Fetch service by ID
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
      // Add service
      .addCase(addService.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addService.fulfilled, (state, action: PayloadAction<ServiceData>) => {
        state.loading = false;
        state.services.push(action.payload);
        state.error = null;
      })
      .addCase(addService.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add service';
      })
      // Update service
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
      })
      .addCase(updateService.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update service';
      })
      // Overall discount
      .addCase(calculateOverallDiscountForAllDescriptions.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.totalDiscount = action.payload.summary.totalDiscountAmount;
        }
      })
      .addCase(setDiscountMode, (state, action) => {
        const { mode, recalculate = true } = action.payload;
        state.discountMode = mode;
      });
  },
});
export const {
  setServiceData,
  setNewDescriptionData,
  addDescriptionToService,
  setSearchQuery,
  setSnackbarMessage,
  clearSnackbarMessage,
  setSnackbarOpen,
  deleteDescriptionFromService,
  setDescriptionForEditing,
  clearDescriptionForEditing,
  setReduxTotals,
  clearVendors,
  updateSkip,
  setCalculatedTotals,
  clearCalculatedTotals,
} = serviceOrderSlice.actions;
export const selectServiceState = (state: RootState) => state.serviceOrder;
export default serviceOrderSlice.reducer;