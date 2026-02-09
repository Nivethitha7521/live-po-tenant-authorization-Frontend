import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import purchaseApi from "@/utils/api";
import { RootState } from '../../../redux/store';

// Interfaces (updated to make paymentId optional)
export interface PaymentHistoryEntry {
  amount: number;
  paymentType: string;
  paymentMethod: string;
  paymentMode: string;
  cashAmount?: number;
  bankName?: string;
  impsNo?: string;
  neftNo?: string;
  rtgsNo?: string;
  upi?: string;
  date: string;
  debitNotesApplied: string[];
  debitAmount: number;
  advancePaymentsApplied: string[];
  advanceAmount: number;
  paymentId?: string;  // Made optional to handle cases without paymentId
}

export interface OutgoingDoc {
  randomId: string;
  vendorName: string;
  status: string;
  totalPayableAmount: number;
  paidAmount: number;
  relevantHistory: PaymentHistoryEntry[];
}

export interface PaymentsByIdResponse {
  paymentId: string | null;
  totalPayments: number;
  totalAmount: number;
  payments: PaymentHistoryEntry[];
  outgoings: OutgoingDoc[];
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PaymentsState {
  data: PaymentsByIdResponse | null;
  loading: boolean;
  error: string | null;
  currentPaymentId: string | null;
  currentPage: number;
  exportLoading: boolean; // Separate loading for exports
  exportError: string | null; // Separate error for exports
}

const initialState: PaymentsState = {
  data: null,
  loading: false,
  error: null,
  currentPaymentId: null,
  currentPage: 1,
  exportLoading: false,
  exportError: null,
};

export const fetchPaymentsById = createAsyncThunk(
  'payments/fetchPaymentsById',
  async ({ paymentId, page = 1, limit = 10, date }: { paymentId?: string; page?: number; limit?: number; date?: string }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (paymentId) { // Only add if provided (for specific ID)
        params.append('payment_id', paymentId);
      }
      if (date) {
        params.append('date', date);
      }
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      const url = `http://127.0.0.1:8000/purchasetestapi/outgoingpayments/payments/paymentwise?${params.toString()}`;
      console.log('Fetching from URL:', url);
      const response = await purchaseApi.get(
  `/outgoingpayments/payments/paymentwise?${params.toString()}`
);

      console.log('API Response received:', response.data);
      return response.data as PaymentsByIdResponse;
    } catch (error: any) {
      console.error('API Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      const errorMsg = error.response?.status === 404 
        ? `No payments found${paymentId ? ` for ID "${paymentId}"` : ' in database'}`
        : error.response?.data?.detail || error.message || 'Failed to fetch payments data';
      return rejectWithValue(errorMsg);
    }
  }
);

// New thunk for CSV export (fetches as blob)
export const exportPaymentsCSV = createAsyncThunk(
  'payments/exportPaymentsCSV',
  async ({ paymentId, date }: { paymentId?: string; date?: string }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (paymentId) {
        params.append('payment_id', paymentId);
      }
      if (date) {
        params.append('date', date);
      }
      params.append('format', 'csv');
      const url = `http://127.0.0.1:8000/purchasetestapi/outgoingpayments/payments/paymentwise?${params.toString()}`;
      console.log('Exporting CSV from URL:', url);
const response = await purchaseApi.get(
  `/outgoingpayments/payments/paymentwise?${params.toString()}`,
  { responseType: "blob" }
);
      return response.data; // Blob
    } catch (error: any) {
      console.error('CSV Export Error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to export CSV';
      return rejectWithValue(errorMsg);
    }
  }
);

// New thunk for PDF export (fetches as blob)
export const exportPaymentsPDF = createAsyncThunk(
  'payments/exportPaymentsPDF',
  async ({ paymentId, date }: { paymentId?: string; date?: string }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (paymentId) {
        params.append('payment_id', paymentId);
      }
      if (date) {
        params.append('date', date);
      }
      params.append('format', 'pdf');
      const url = `http://127.0.0.1:8000/purchasetestapi/outgoingpayments/payments/paymentwise?${params.toString()}`;
      console.log('Exporting PDF from URL:', url);
const response = await purchaseApi.get(
  `/outgoingpayments/payments/paymentwise?${params.toString()}`,
  { responseType: "blob" }
);
      return response.data; // Blob
    } catch (error: any) {
      console.error('PDF Export Error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to export PDF';
      return rejectWithValue(errorMsg);
    }
  }
);

// Slice (updated with export handling)
const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    resetPaymentsData: (state) => {
      state.data = null;
      state.error = null;
      state.currentPaymentId = null;
      state.currentPage = 1;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    resetExport: (state) => {
      state.exportLoading = false;
      state.exportError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Existing fetch cases
      .addCase(fetchPaymentsById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPaymentsById.fulfilled, (state, action: PayloadAction<PaymentsByIdResponse>) => {
        state.loading = false;
        state.data = action.payload;
        state.currentPaymentId = action.payload.paymentId || null;
        state.currentPage = action.payload.page;
      })
      .addCase(fetchPaymentsById.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error occurred';
        state.data = null;
      })
      // CSV export cases
      .addCase(exportPaymentsCSV.pending, (state) => {
        state.exportLoading = true;
        state.exportError = null;
      })
      .addCase(exportPaymentsCSV.fulfilled, (state) => {
        state.exportLoading = false;
      })
      .addCase(exportPaymentsCSV.rejected, (state, action: PayloadAction<any>) => {
        state.exportLoading = false;
        state.exportError = action.payload || 'Unknown export error occurred';
      })
      // PDF export cases
      .addCase(exportPaymentsPDF.pending, (state) => {
        state.exportLoading = true;
        state.exportError = null;
      })
      .addCase(exportPaymentsPDF.fulfilled, (state) => {
        state.exportLoading = false;
      })
      .addCase(exportPaymentsPDF.rejected, (state, action: PayloadAction<any>) => {
        state.exportLoading = false;
        state.exportError = action.payload || 'Unknown export error occurred';
      });
  },
});

export const { resetPaymentsData, setCurrentPage, resetExport } = paymentsSlice.actions;
export const selectPayments = (state: RootState) => state.payments as PaymentsState;
export default paymentsSlice.reducer;