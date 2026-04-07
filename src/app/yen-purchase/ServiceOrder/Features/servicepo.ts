import { createSlice, PayloadAction, createAsyncThunk, createAction } from '@reduxjs/toolkit';
import purchaseApi from "@/utils/api";
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
} from "../Models/servicepo";
import { VendorSummary } from "@/Models/vendor";
import qs from 'qs';

const formatDateOnly = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) return '';
  let dt: Date;
  if (typeof dateValue === 'string') {
    const parts = dateValue.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      dt = new Date(year, month, day);
    } else {
      dt = new Date(dateValue);
    }
  } else {
    dt = new Date(dateValue);
  }
  if (isNaN(dt.getTime())) return '';
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTimeForBackend = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) return '';
  let dt: Date;
  if (typeof dateValue === 'string') {
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
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      return new Date(year, month, day);
    }
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

  // CRITICAL: fees are PER UNIT WITH TAX
  const feesRaw = raw.fees || [];

  const descTaxTypesRaw = raw.desc_tax_types || [];
  const descTaxPersRaw = raw.desc_tax_pers || [];
  const descSgstRaw = raw.desc_sgst || [];
  const descCgstRaw = raw.desc_cgst || [];
  const descIgstRaw = raw.desc_igst || [];

  // CRITICAL: base_amounts are PER UNIT WITHOUT TAX
  const baseAmountsRaw = raw.base_amounts || [];

  const descOverallDiscountsRaw = raw.desc_overall_discounts || [];
  const remarksRaw = raw.remarks || [];
  const quantityRaw = raw.quantity || [];
  const descDiscountPercentagesRaw = raw.desc_discount_percentages || [];

  // include_tax preference
  const includeTaxRaw = raw.include_tax || [];

  // Tax amounts are line totals
  const descTaxAmountsRaw = raw.desc_tax_amounts ||
    descSgstRaw.map((sgst, i) => sgst + (descCgstRaw[i] || 0) + (descIgstRaw[i] || 0));

  // Totals are line totals WITH TAX after all discounts
  const descTotalsRaw = raw.desc_totals || [];
  const descDiscountAmountsRaw = raw.desc_discount_amounts || new Array(feesRaw.length).fill(0);

  const formattedWorkOrderDate = raw.workOrderDate ? formatDateOnly(raw.workOrderDate) : null;
  const formattedCreatedDate = raw.createdDate ? formatDateOnly(raw.createdDate) : null;
  const formattedFromDates = fromDatesRaw.map(d => formatDateOnly(d));
  const formattedToDates = toDatesRaw.map(d => formatDateOnly(d));
  const mongoId = raw.mongoId || (raw._id ? String(raw._id) : '');

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

    sacCode: sacCodesRaw,
    desc_ids: descIdsRaw,
    descriptions: descriptionsRaw,
    from_dates: formattedFromDates,
    to_dates: formattedToDates,
    fees: feesRaw,  // PER UNIT WITH TAX
    remarks: remarksRaw,
    quantity: quantityRaw,  // QUANTITY (separate)
    desc_tax_types: descTaxTypesRaw as ('cgst_sgst' | 'igst')[],
    desc_tax_pers: descTaxPersRaw,
    desc_sgst: descSgstRaw,  // LINE TOTAL
    desc_cgst: descCgstRaw,  // LINE TOTAL
    desc_igst: descIgstRaw,  // LINE TOTAL
    desc_tax_amounts: descTaxAmountsRaw,  // LINE TOTAL
    desc_totals: descTotalsRaw,  // LINE TOTAL WITH TAX
    base_amounts: baseAmountsRaw,  // PER UNIT WITHOUT TAX
    desc_discount_amounts: descDiscountAmountsRaw,  // LINE TOTAL
    desc_discount_percentages: descDiscountPercentagesRaw,
    desc_overall_discounts: descOverallDiscountsRaw,  // LINE TOTAL
    include_tax: includeTaxRaw,  // USER PREFERENCE

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
    base_amounts: [],
    desc_discount_amounts: [],
    desc_overall_discounts: [],
    include_tax: [],
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
    quantity: [],
    desc_discount_percentages: [],
    overallDiscountAppliedOn: 'after_tax',
    totalFees: 0,
    totalDiscount: 0,
  },

  newDescription: {
    id: '',
    sacCode: '',
    description: '',
    from_date: null,
    to_date: null,
    fee: 0,
    fee_with_tax: 0,
    base_amount: 0,
    include_tax: true,
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
    calculated_base_per_unit: 0,
    calculated_tax_per_unit: 0,
    calculated_total_per_unit: 0,
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


export const calculateServiceTotals = createAsyncThunk(
  'serviceOrder/calculateServiceTotals',
  async (request: ServiceTotalsRequest): Promise<ServiceTotalsResponse> => {
    const response = await purchaseApi.post<ServiceTotalsResponse>(
      `/servicepo/calculate-totals`,
      request
    );
    return response.data;
  }
);

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
    const defaultParams = {
      status: 'Pending',
      skip: 0,
      limit: 50,
      ...params
    };

    const response = await purchaseApi.get<RawServiceData[]>(
      `/servicepo/getServices/`,
      {
        params: defaultParams,
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: 'repeat' });
        }
      }
    );

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
      const response = await purchaseApi.get<VendorSummary[]>(`/vendors/`);
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
    const response = await purchaseApi.get<RawServiceData>(`/servicepo/${serviceId}`);
    return transformRawToNested(response.data);
  }
);

export const calculateDescriptionTotals = createAsyncThunk<
  DescriptionCalculationResponse,
  DescriptionCalculationRequest,
  { rejectValue: string }
>(
  'serviceOrder/calculateDescriptionTotals',
  async (
    {
      description,
      fromDate,
      toDate,
      fee,           // PER UNIT WITH TAX
      taxPer,
      taxType,
      quantity = 1,
      remarks,
      include_tax = true,
      base_amount
    },
    { rejectWithValue }
  ) => {
    try {
      // Always send PER UNIT WITH TAX to backend
      const params: any = {
        description,
        fromDate: formatDateOnly(fromDate),
        toDate: formatDateOnly(toDate),
        fee: fee,
        taxPer: taxPer || 0,
        taxType,
        quantity,
        remarks,
        include_tax: true
      };

      const response = await purchaseApi.get<DescriptionCalculationResponse>(
        `/servicepo/descriptions/totals`,
        { params }
      );

      return {
        ...response.data,
        include_tax: include_tax
      };
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
      const serviceToAdd = {
        ...service,
        workOrderDate: service.workOrderDate ? formatDateTimeForBackend(service.workOrderDate) : null,
        descriptions: service.descriptions || [],
        from_dates: service.from_dates.map(dateStr =>
          dateStr ? formatDateTimeForBackend(dateStr) : null
        ),
        to_dates: service.to_dates.map(dateStr =>
          dateStr ? formatDateTimeForBackend(dateStr) : null
        ),
        sacCode: service.sacCode || [],
        desc_discount_percentages: service.desc_discount_percentages ||
          Array(service.descriptions.length).fill(0),
        desc_discount_amounts: service.desc_discount_amounts ||
          Array(service.descriptions.length).fill(0),
        remarks: service.remarks || [],
        quantity: service.quantity || [],
        desc_tax_types: service.desc_tax_types || [],
        desc_tax_pers: service.desc_tax_pers || [],
        desc_sgst: service.desc_sgst || [],
        desc_cgst: service.desc_cgst || [],
        desc_igst: service.desc_igst || [],
        desc_tax_amounts: service.desc_tax_amounts || [],
        desc_totals: service.desc_totals || [],
        desc_overall_discounts: service.desc_overall_discounts || [],
        include_tax: service.include_tax || [],
        base_amounts: service.base_amounts || [],
        overallDiscountType: service.overallDiscountType || 'percentage',
        overallDiscountAppliedOn: service.overallDiscountAppliedOn || 'after_tax',
      };

      const rawResponse = await purchaseApi.post<RawServiceData>(
        `/servicepo/`,
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
        desc_overall_discounts: service.desc_overall_discounts || [],
        include_tax: service.include_tax || [],
        base_amounts: service.base_amounts || [],
      };

      const rawResponse = await purchaseApi.patch<RawServiceData>(
        `/servicepo/update/${mongoId}`,
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
      const response = await purchaseApi.patch(`/servicepo/approved/${mongoId}`, { send_whatsapp: false });
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
      await purchaseApi.patch(`/servicepo/rejected/${mongoId}`, { reason: 'Rejected by user', send_notification: false });
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
        include_tax: action.payload.include_tax || initialState.serviceData.include_tax,
        base_amounts: action.payload.base_amounts || initialState.serviceData.base_amounts,
      };
    },

    setNewDescriptionData(state, action: PayloadAction<Partial<ServiceDescription>>) {
      state.newDescription = { ...state.newDescription, ...action.payload };
    },

    addDescriptionToService: (state, action: PayloadAction<ServiceDescription>) => {
      const desc = action.payload;

      const feePerUnit = desc.fee || 0;
      const basePerUnit = desc.base_amount || 0;
      const includeTax = desc.include_tax !== undefined ? desc.include_tax : true;
      const quantity = desc.quantity || 1;

      const lineTotalWithTax = desc.total || 0;
      const lineTaxAmount = desc.taxAmount || 0;

      const currentDiscountAmounts = [...(state.serviceData.desc_discount_amounts || [])];
      const currentDiscountPercentages = [...(state.serviceData.desc_discount_percentages || [])];
      const currentOverallDiscounts = [...(state.serviceData.desc_overall_discounts || [])];

      currentDiscountAmounts.push(desc.discountAmount || 0);
      currentDiscountPercentages.push(desc.discount_percentage || 0);
      currentOverallDiscounts.push(0);

      state.serviceData = {
        ...state.serviceData,

        sacCode: [...state.serviceData.sacCode, desc.sacCode || ''],
        desc_ids: [...state.serviceData.desc_ids, desc.id || ''],
        descriptions: [...state.serviceData.descriptions, desc.description || ''],

        from_dates: [...state.serviceData.from_dates, desc.from_date ?? null],
        to_dates: [...state.serviceData.to_dates, desc.to_date ?? null],

        remarks: [...state.serviceData.remarks, desc.remarks || ''],

        // PER UNIT VALUES
        fees: [...state.serviceData.fees, Number(feePerUnit.toFixed(2))],
        base_amounts: [...state.serviceData.base_amounts, Number(basePerUnit.toFixed(2))],

        quantity: [...state.serviceData.quantity, quantity],

        desc_tax_types: [...state.serviceData.desc_tax_types, desc.tax_type || 'cgst_sgst'],
        desc_tax_pers: [...state.serviceData.desc_tax_pers, desc.tax_per || 0],
        include_tax: [...(state.serviceData.include_tax || []), includeTax],

        // LINE TOTALS
        desc_totals: [...state.serviceData.desc_totals, Number(lineTotalWithTax.toFixed(2))],
        desc_tax_amounts: [...state.serviceData.desc_tax_amounts, Number(lineTaxAmount.toFixed(2))],
        desc_sgst: [...state.serviceData.desc_sgst, desc.sgst || 0],
        desc_cgst: [...state.serviceData.desc_cgst, desc.cgst || 0],
        desc_igst: [...state.serviceData.desc_igst, desc.igst || 0],

        desc_discount_amounts: currentDiscountAmounts,
        desc_discount_percentages: currentDiscountPercentages,
        desc_overall_discounts: currentOverallDiscounts,
      };
    },

    updateDescription: (state, action: PayloadAction<{ index: number; desc: ServiceDescription }>) => {
      const { index, desc } = action.payload;

      if (index < 0 || index >= state.serviceData.descriptions.length) {
        return;
      }

      const feePerUnit = desc.fee || 0;
      const basePerUnit = desc.base_amount || 0;
      const includeTax = desc.include_tax !== undefined ? desc.include_tax : true;

      const existingDiscountAmount = state.serviceData.desc_discount_amounts?.[index] || 0;
      const existingDiscountPercentage = state.serviceData.desc_discount_percentages?.[index] || 0;
      const existingOverallDiscount = state.serviceData.desc_overall_discounts?.[index] || 0;

      if (index < state.serviceData.sacCode.length)
        state.serviceData.sacCode[index] = desc.sacCode || '';
      if (index < state.serviceData.desc_ids.length)
        state.serviceData.desc_ids[index] = desc.id || state.serviceData.desc_ids[index];
      if (index < state.serviceData.descriptions.length)
        state.serviceData.descriptions[index] = desc.description;

      if (index < state.serviceData.from_dates.length)
        state.serviceData.from_dates[index] = desc.from_date !== undefined ? desc.from_date : null;
      if (index < state.serviceData.to_dates.length)
        state.serviceData.to_dates[index] = desc.to_date !== undefined ? desc.to_date : null;

      if (index < state.serviceData.remarks.length)
        state.serviceData.remarks[index] = desc.remarks || '';

      // PER UNIT VALUES
      if (index < state.serviceData.fees.length)
        state.serviceData.fees[index] = Number(feePerUnit.toFixed(2));
      if (index < state.serviceData.base_amounts.length)
        state.serviceData.base_amounts[index] = Number(basePerUnit.toFixed(2));

      if (index < state.serviceData.quantity.length)
        state.serviceData.quantity[index] = desc.quantity || 1;

      if (index < state.serviceData.desc_tax_types.length)
        state.serviceData.desc_tax_types[index] = desc.tax_type;
      if (index < state.serviceData.desc_tax_pers.length)
        state.serviceData.desc_tax_pers[index] = desc.tax_per;
      if (index < state.serviceData.include_tax.length)
        state.serviceData.include_tax[index] = includeTax;

      // LINE TOTALS
      if (index < state.serviceData.desc_sgst.length)
        state.serviceData.desc_sgst[index] = desc.sgst || 0;
      if (index < state.serviceData.desc_cgst.length)
        state.serviceData.desc_cgst[index] = desc.cgst || 0;
      if (index < state.serviceData.desc_igst.length)
        state.serviceData.desc_igst[index] = desc.igst || 0;
      if (index < state.serviceData.desc_tax_amounts.length)
        state.serviceData.desc_tax_amounts[index] = desc.taxAmount || 0;
      if (index < state.serviceData.desc_totals.length)
        state.serviceData.desc_totals[index] = desc.total || 0;

      if (desc.discountAmount !== undefined) {
        if (index < state.serviceData.desc_discount_amounts.length)
          state.serviceData.desc_discount_amounts[index] = desc.discountAmount;
      } else if (existingDiscountAmount) {
        if (index < state.serviceData.desc_discount_amounts.length)
          state.serviceData.desc_discount_amounts[index] = existingDiscountAmount;
      }

      if (desc.discount_percentage !== undefined) {
        if (index < state.serviceData.desc_discount_percentages.length)
          state.serviceData.desc_discount_percentages[index] = desc.discount_percentage;
      } else if (existingDiscountPercentage) {
        if (index < state.serviceData.desc_discount_percentages.length)
          state.serviceData.desc_discount_percentages[index] = existingDiscountPercentage;
      }

      if (index < state.serviceData.desc_overall_discounts.length)
        state.serviceData.desc_overall_discounts[index] = existingOverallDiscount;
    },

    deleteDescriptionFromService: (state, action: PayloadAction<number>) => {
      const index = action.payload;

      if (index < 0 || index >= state.serviceData.descriptions.length) {
        return;
      }

      const removeFromArray = <T>(arr: T[], idx: number): T[] => {
        return arr.filter((_, i) => i !== idx);
      };

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
        base_amounts: removeFromArray(state.serviceData.base_amounts, index),
        desc_discount_amounts: removeFromArray(state.serviceData.desc_discount_amounts, index),
        desc_discount_percentages: removeFromArray(state.serviceData.desc_discount_percentages, index),
        desc_overall_discounts: removeFromArray(state.serviceData.desc_overall_discounts, index),
        include_tax: removeFromArray(state.serviceData.include_tax || [], index),
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
        // IMPORTANT: DO NOT SORT HERE - preserve the order from backend
        // Backend returns in DESC order (newest first)
        state.services = action.payload; // Just assign directly
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
          include_tax: action.payload.include_tax || true,
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
        const index = state.services.findIndex(s => s.serviceId === action.meta.arg);
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