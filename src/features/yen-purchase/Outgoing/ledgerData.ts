import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';

// Define interfaces matching your API response
export interface Transaction {
  date: string | null;
  type: string; // "invoice", "payment", "debit_note", "advance_payment"
  reference_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  status: string;
  payment_method?: string;
  notes?: string;
  formatted_date?: string; // Add this if your API includes formatted dates
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
  invoices: InvoiceDetail[];
  transactions: Transaction[]; // This should come from your API
  lastTransactionDate: string | null;
}

interface LedgerState {
  ledgerData: VendorLedgerResponse | null;
  loading: boolean;
  transactions: Transaction[];
  error: string | null;
  selectedVendorName: string | null;
}

const initialState: LedgerState = {
  ledgerData: null,
  loading: false,
  transactions: [],
  error: null,
  selectedVendorName: null,
};

export const fetchLedgerData = createAsyncThunk(
  'ledger/fetchLedgerData',
  async (vendorName: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `http://192.168.29.117:8000/purchaseapi/outgoingpayments/vendor/${encodeURIComponent(vendorName)}/ledger`
      );
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
    resetLedgerData: (state) => {
      state.ledgerData = null;
      state.error = null;
      state.selectedVendorName = null;
      state.transactions = [];
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
        
        // Use transactions directly from API response
        if (action.payload.transactions && action.payload.transactions.length > 0) {
          state.transactions = action.payload.transactions;
        } else {
          // Fallback: create transactions from invoices if API doesn't return transactions
          state.transactions = action.payload.invoices?.map((invoice, index) => ({
            date: invoice.invoiceDate,
            type: 'invoice',
            reference_id: invoice.invoiceNo,
            description: `Invoice ${invoice.invoiceNo} - PO ${invoice.poId}`,
            debit_amount: invoice.totalPayableAmount,
            credit_amount: invoice.paidAmount,
            balance: invoice.remainingAmount,
            status: invoice.status,
            notes: `GRN: ${invoice.grnId}`,
          })) || [];
        }
      })
      .addCase(fetchLedgerData.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error occurred';
        state.transactions = [];
      });
  },
});

export const { setSelectedVendorName, resetLedgerData } = ledgerSlice.actions;
export const selectLedger = (state: RootState) => state.outgoingLedger as LedgerState;
export default ledgerSlice.reducer;