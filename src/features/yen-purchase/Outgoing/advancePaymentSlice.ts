import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { AdvancePayment, VendorDetail, AdvanceState } from '@/Models/advanceModel';

const initialState: AdvanceState = {
  advances: [],
  advanceVendors: [],
  singleadvance:[],
  activeAdvances: [],
  loading: false,
  snackbarMessage: '',
  snackbarOpen: false,
  currentPage: 1,
  pageSize: 10,
  totalItems: 0,
};

export const fetchAdvances = createAsyncThunk<
  { data: AdvancePayment[]; totalItems: number },
  { status?: string; filterBy?: string; fromDate?: Date; toDate?: Date; vendorName?: string },
  { rejectValue: string }
>(
  'advances/fetchAdvances',
  async ({ status, filterBy, fromDate, toDate, vendorName }, { rejectWithValue }) => {
    try {
      // Validate status to only allow 'pending' or 'partially cleared'
      if (status && !['pending', 'partially cleared'].includes(status.toLowerCase())) {
        console.warn(`Invalid status: ${status}. Allowed statuses: pending, partially cleared`);
        return { data: [], totalItems: 0 };
      }

      const params = new URLSearchParams({
        ...(status && { status }),
        ...(filterBy && { filterBy }),
        ...(fromDate && { fromDate: fromDate.toISOString() }),
        ...(toDate && { toDate: toDate.toISOString() }),
        ...(vendorName && { vendorName }),
      });

      const response = await axios.get(`http://192.168.29.116:8000/purchaseapi/advancevendor/vendorwise/advance?${params}`);
      return {
        data: response.data.data || [],
        totalItems: response.data.totalItems || 0,
      };
    } catch (error: any) {
      console.error('Error in fetchAdvances:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch advance payments');
    }
  }
);
export const fetchVendorDetails = createAsyncThunk<VendorDetail[], { status?: string }, { rejectValue: string }>(
  'advances/fetchVendorDetails',
  async ({ status }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      const response = await axios.get(`http://192.168.29.116:8000/purchaseapi/advancevendor/vendors`, { params });
      return response.data || [];
    } catch (error: any) {
      console.error('Error in fetchVendorDetails:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch vendor details');
    }
  }
);

export const createAdvancePayment = createAsyncThunk<
  AdvancePayment,
  Partial<AdvancePayment>,
  { rejectValue: string }
>(
  'advances/createAdvancePayment',
  async (payment, { rejectWithValue }) => {
    try {
      const response = await axios.post('http://192.168.29.116:8000/purchaseapi/advancevendor/advance', payment);
      return response.data;
    } catch (error: any) {
      console.error('Error in createAdvancePayment:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to create advance payment');
    }
  }
);
export const fetchActiveAdvancesVendor = createAsyncThunk(
  'outgoings/fetchActiveAdvancesVendor',
  async (vendorId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `http://192.168.29.116:8000/purchaseapi/advancevendor/vendor/${vendorId}/advance-payments`
      );
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch advance payments');
    }
  }
);
export const fetchActiveAdvancesVendorByName = createAsyncThunk(
  'outgoings/fetchActiveAdvancesVendorByName',
  async (vendorName: string, { rejectWithValue }) => {
    try {
      if (!vendorName || vendorName.trim() === '') {
        return rejectWithValue('Vendor name is required');
      }
      const encodedVendorName = encodeURIComponent(vendorName);
      const response = await axios.get(
        `http://192.168.29.116:8000/purchaseapi/advancevendor/vendorname/${encodedVendorName}/advance-payments`
      );
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch advance payments by vendor name');
    }
  }
);
// Add these new async thunks for fetching advances
export const fetchActiveAdvancesMultipleVendor = createAsyncThunk<
  AdvancePayment[],
  string[], // vendorNames array
  {
    rejectValue: string;
  }
>(
  'advancePayments/fetchActiveAdvancesMultipleVendor',
  async (vendorNames, { rejectWithValue }) => {
    try {
      if (vendorNames.length === 0) {
        return [];
      }

      const vendorNamesStr = vendorNames.join(',');
      const response = await axios.get(
        `http://192.168.29.116:8000/purchaseapi/advancevendor/vendors/active-advances?vendorNames=${encodeURIComponent(vendorNamesStr)}`
      );
      return response.data.advances || [];
    } catch (error: any) {
      console.error('Failed to fetch active advances for multiple vendors:', error);
      return rejectWithValue(error.message || 'Failed to fetch active advances');
    }
  }
);
const advancePaymentSlice = createSlice({
  name: 'advances',
  initialState,
  reducers: {
    setSnackbarMessage(state, action) {
      state.snackbarMessage = action.payload;
    },
    setSnackbarOpen(state, action) {
      state.snackbarOpen = action.payload;
    },
    clearSnackbarMessage(state) {
      state.snackbarMessage = '';
      state.snackbarOpen = false;
    },
    setPagination(state, action) {
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.size;
    },
    clearAdvances: (state) => {
      state.advances = [];
    },
    clearBulkPaymentState: (state) => {
      state.loading = false;
      state.snackbarOpen = false;
      state.snackbarMessage = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdvances.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAdvances.fulfilled, (state, action) => {
        state.loading = false;
        state.advances = action.payload.data;
        state.totalItems = action.payload.totalItems;
        state.snackbarMessage = 'Advance payments fetched successfully';
        state.snackbarOpen = true;
      })
      .addCase(fetchAdvances.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      .addCase(fetchVendorDetails.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVendorDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.advanceVendors = action.payload;
        state.snackbarMessage = 'Vendor details fetched successfully';
        state.snackbarOpen = true;
      })
      .addCase(fetchVendorDetails.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      .addCase(createAdvancePayment.pending, (state) => {
        state.loading = true;
      })
      .addCase(createAdvancePayment.fulfilled, (state, action) => {
        state.loading = false;
        state.advances.push(action.payload);
        state.snackbarMessage = 'Advance payment created successfully';
        state.snackbarOpen = true;
      })
      .addCase(createAdvancePayment.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      .addCase(fetchActiveAdvancesMultipleVendor.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchActiveAdvancesMultipleVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.activeAdvances = action.payload;
        state.totalItems = action.payload.length;
      })
    .addCase(fetchActiveAdvancesVendorByName.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchActiveAdvancesVendorByName.fulfilled, (state, action) => {
        state.loading = false;
        state.singleadvance = action.payload;
        state.totalItems = action.payload.length;
      })
      .addCase(fetchActiveAdvancesVendorByName.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
  },
});

export const { setSnackbarMessage, setSnackbarOpen, clearSnackbarMessage, setPagination } = advancePaymentSlice.actions;
export const selectAdvances = (state: any) => state.advances as AdvanceState;
export const selectCurrentPage = (state: any) => state.advances.currentPage;
export const selectPageSize = (state: any) => state.advances.pageSize;
export const selectTotalItems = (state: any) => state.advances.totalItems;
export default advancePaymentSlice.reducer;