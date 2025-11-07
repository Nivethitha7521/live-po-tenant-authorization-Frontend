import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';

// Define interfaces matching your API response
export interface Transaction {
  date: string | null;
  type: string; // "invoice", "payment", "debit_note", "advance_payment", "opening_balance"
  reference_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  status: string;
  payment_method?: string;
  notes?: string;
  formatted_date?: string;
}

export interface InvoiceDetail {
  poId: string;
  grnId: string;
  invoiceNo: string;
  invoiceDate: string | null;
  totalPayableAmount: number;
  paidAmount: number;
  debitAmount: number;
  creditAmount: number;
  remainingAmount: number;
  status: string;
  lastPaymentDate: string | null;
}

export interface VendorLedgerResponse {
  vendorId?: string | null;
  vendorName?: string | null;
  totalPayableAmount: number;
  totalPaidAmount: number;
  totalDebitAmount: number;
  totalCreditAmount: number;
  outstandingAmount: number;
  openingBalance: number;
  invoices: InvoiceDetail[];
  transactions: Transaction[];
  lastTransactionDate: string | null;
  totalActiveAdvances: number;
  totalActiveDebitNotes: number;
  totalAvailableCredits: number;
}

interface LedgerState {
  ledgerData: VendorLedgerResponse | null;
  loading: boolean;
  transactions: Transaction[];
  error: string | null;
  selectedVendorName: string | null;
  dateRange: {
    startDate: Date | null;
    endDate: Date | null;
  };
}

const initialState: LedgerState = {
  ledgerData: null,
  loading: false,
  transactions: [],
  error: null,
  selectedVendorName: null,
  dateRange: {
    startDate: null,
    endDate: null,
  },
};

export const fetchLedgerData = createAsyncThunk(
  'ledger/fetchLedgerData',
  async ({ vendorName, startDate, endDate }: { vendorName: string; startDate?: string; endDate?: string }, { rejectWithValue }) => {
    try {
      let url = `http://https://yenerp.com00/purchaseapi/outgoingpayments/vendor/${encodeURIComponent(vendorName)}/ledger`;
      
      // Add date parameters if provided
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await axios.get(url);
      return response.data as VendorLedgerResponse;
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to fetch ledger data');
    }
  }
);

const ledgerSlice = createSlice({
  name: 'outgoingLedger',
  initialState,
  reducers: {
    setSelectedVendorName: (state, action: PayloadAction<string | null>) => {
      state.selectedVendorName = action.payload;
    },
    setDateRange: (state, action: PayloadAction<{ startDate: Date | null; endDate: Date | null }>) => {
      state.dateRange = action.payload;
    },
    resetLedgerData: (state) => {
      state.ledgerData = null;
      state.error = null;
      state.selectedVendorName = null;
      state.transactions = [];
      state.dateRange = {
        startDate: null,
        endDate: null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLedgerData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLedgerData.fulfilled, (state, action: PayloadAction<VendorLedgerResponse>) => {
        state.loading = false;
        state.ledgerData = action.payload;
        
        // Use transactions directly from API response with correct balances
        if (action.payload.transactions && action.payload.transactions.length > 0) {
          state.transactions = action.payload.transactions.map(transaction => ({
            ...transaction,
            // Ensure balance is properly set from API
            balance: transaction.balance || 0
          }));
        } else {
          state.transactions = [];
        }
      })
      .addCase(fetchLedgerData.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error occurred';
        state.transactions = [];
      });
  },
});

export const { setSelectedVendorName, setDateRange, resetLedgerData } = ledgerSlice.actions;
export const selectLedger = (state: RootState) => state.outgoingLedger as LedgerState;
export default ledgerSlice.reducer;