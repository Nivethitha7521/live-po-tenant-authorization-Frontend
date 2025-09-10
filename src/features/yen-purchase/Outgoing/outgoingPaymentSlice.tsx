import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { Bank, BulkPaymentRequest, BulkPaymentResponse, DebitNote, GRN, initialState, Outgoing, OutgoingState, PaymentDetails, PaymentDone, TaxDetail, VendorDetail, VendorPayment } from '@/Models/outgoingModel';

interface ProcessPaymentRequest {
  outgoingId: string;
  paymentMode: 'Bank' | 'Cash';
  paymentType: 'full' | 'partial' | 'advance';
  totalPayableAmount: number;
  fullPaymentAmount?: number;
  partialAmount?: number;
  advanceAmount?: number;
  paymentMethod?: string;
  chequeNo?: string;
  neftNo?: string;
  rtgsNo?: string;
  impsNo?: string;
  upi?: string;
  pettyCashAmount?: number;
  hoCash?: number;
  bankName?: string;
  selectedDebitNotes?: string[]; // Changed to array to support multiple debit notes
}

export const fetchOutgoings = createAsyncThunk(
  'outgoings/fetchOutgoings',
  async (
    {
      page,
      size,
      fromDate,
      toDate,
      vendorName,
      filterBy,  // invoiceDate or paymentDate
      status,
      filterByAmount,
      filterByStatus
    }: {
      page: number;
      size: number;
      fromDate?: Date;
      toDate?: Date;
      vendorName?: string;
      filterBy?: string;  // invoiceDate or paymentDate
      status?: string;
      filterByAmount?: boolean | null;
      filterByStatus?: boolean | null;
    }) => {
    try {
      const url = 'http://192.168.29.117:8000/purchaseapi/outgoingpayments/';

      // Prepare query parameters dynamically based on provided arguments
      const params: any = {
        skip: (page - 1) * size, // Pagination skip
        limit: size,             // Pagination limit
        filterByAmount,          // Optional filter by amount
        filterByStatus,          // Optional filter by status
      };

      // Add filters to params if provided
      if (fromDate) {
        params.fromDate = fromDate.toISOString();
      }
      if (toDate) {
        params.toDate = toDate.toISOString();
      }
      if (vendorName) {
        params.vendorName = vendorName;
      }
      if (filterBy) {
        params.filterBy = filterBy;
      }
      if (status) {
        params.status = status;
      }

      // Make the GET request with query parameters
      const response = await axios.get(url, { params });

      return response.data;  // Returning the paginated and filtered outgoings

    } catch (error) {
      console.error('Failed to fetch outgoings:', error);
      throw new Error('Failed to fetch outgoings');
    }
  }
);
export const fetchVendorDetails = createAsyncThunk(
  'outgoing/fetchVendorDetails',
  async (filters: {
    status?: string;
    filterByAmount?: boolean;
    filterByStatus?: boolean;
    fetchAll?: boolean; // Added fetchAll parameter
  }) => {
    try {
      const params = new URLSearchParams();

      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.filterByAmount !== undefined) {
        params.append('filterByAmount', filters.filterByAmount.toString());
      }
      if (filters.filterByStatus !== undefined) {
        params.append('filterByStatus', filters.filterByStatus.toString());
      }
      if (filters.fetchAll !== undefined) {
        params.append('fetchAll', filters.fetchAll.toString());
      }

      const response = await axios.get<VendorDetail[]>(
        `http://192.168.29.117:8000/purchaseapi/outgoingpayments/vendors/details?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
);
export const fetchGRN = createAsyncThunk('purchaseorder/fetch', async () => {
  const response = await axios.get<GRN[]>(`http://192.168.29.117:8000/purchaseapi/grns/`);
  const grnData = response.data.map(item => ({
    grnId: item.grnId,
    randomId: item.randomId,
  }));
  return grnData;
});

// Async thunk to add a new Outgoing item
export const addOutgoing = createAsyncThunk<Outgoing, Omit<Outgoing, 'outgoingId'>>('outgoings/addOutgoing', async (outgoingData) => {
  const response = await axios.post('http://192.168.29.117:8000/purchaseapi/outgoingpayments/', outgoingData); // Adjust the API endpoint as needed
  return response.data;
});

// Async thunk to update an existing Outgoing item
export const updateOutgoing = createAsyncThunk<Outgoing, Outgoing>('outgoings/updateOutgoing', async (outgoingData) => {
  const response = await axios.patch(`http://192.168.29.117:8000/purchaseapi/outgoingpayments/${outgoingData.outgoingId}`, outgoingData); // Adjust the API endpoint as needed
  return response.data;
});

// // Async thunk to delete an Outgoing item
// export const deleteOutgoing = createAsyncThunk<void, string>('outgoings/deleteOutgoing', async (outgoingId) => {
//   await axios.delete(`http://192.168.29.117:8000/purchaseapi/outgoingpayments/${outgoingId}`); // Adjust the API endpoint as needed
// });

export const fetchBank = createAsyncThunk('bank/fetchBanks', async () => {
  const response = await axios.get(`https://yenerp.com/masterapi/bankmasters/`);
  return response.data;
});

export const processPayment = createAsyncThunk<
  void,
  ProcessPaymentRequest,
  { rejectValue: string }
>(
  'outgoings/processPayment',
  async (
    {
      outgoingId,
      paymentMode,
      paymentType,
      totalPayableAmount,
      fullPaymentAmount,
      partialAmount,
      advanceAmount,
      paymentMethod,
      chequeNo,
      neftNo,
      rtgsNo,
      impsNo,
      upi,
      pettyCashAmount,
      hoCash,
      bankName,
      selectedDebitNotes = [], // Already supports array
    },
    { rejectWithValue }
  ) => {
    try {
      const payload = {
        outgoingId,
        paymentMode,
        paymentType,
        totalPayableAmount,
        fullPaymentAmount: paymentType === 'full' ? fullPaymentAmount : 0,
        partialAmount: paymentType === 'partial' ? partialAmount : 0,
        advanceAmount: paymentType === 'advance' ? advanceAmount : 0,
        paymentMethod,
        chequeNo,
        neftNo,
        rtgsNo,
        impsNo,
        upi,
        pettyCashAmount,
        hoCash,
        bankName,
        selectedDebitNotes, // Pass the array as-is
      };

      await axios.patch(`http://192.168.29.117:8000/purchaseapi/outgoingpayments/${outgoingId}/payment`, payload);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.response?.data || 'Payment processing failed');
    }
  }
);
export const fetchActiveDebitsVendor = createAsyncThunk<
  DebitNote[],
  string, // vendorName
  {
    rejectValue: string;
  }
>(
  'debitNotes/fetchActiveDebitsVendor', // Unique action type
  async (vendorName, { rejectWithValue }) => {
    try {
      const response = await axios.get(`http://192.168.29.117:8000/purchaseapi/debitnote/vendor/${encodeURIComponent(vendorName)}/active-debits`);
      if (!response.data.debits) {
        throw new Error('No debits found in response');
      }
      return response.data.debits as DebitNote[];
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.response?.data?.message || 'Failed to fetch active debits');
    }
  }
);
export const fetchActiveDebitsMultipleVendor = createAsyncThunk<
  DebitNote[],
  string[], // vendorNames array
  {
    rejectValue: string;
  }
>(
  'debitNotes/fetchActiveDebitsMultipleVendor',
  async (vendorNames, { rejectWithValue }) => {
    try {
      // Fetch debits for each vendor sequentially
      const allDebits: DebitNote[] = [];
      
      for (const vendorName of vendorNames) {
        try {
          const response = await axios.get(`http://192.168.29.117:8000/purchaseapi/debitnote/vendor/${encodeURIComponent(vendorName)}/active-debits`);
          if (response.data.debits) {
            allDebits.push(...response.data.debits);
          }
        } catch (error) {
          console.error(`Failed to fetch debits for ${vendorName}:`, error);
          // Continue with other vendors even if one fails
        }
      }
      
      if (allDebits.length === 0) {
        throw new Error('No debits found for any vendor');
      }
      
      return allDebits;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch active debits');
    }
  }
);
export const processBulkPayment = createAsyncThunk<
  BulkPaymentResponse,
  BulkPaymentRequest,
  { rejectValue: string }
>(
  'outgoings/processBulkPayment',
  async (bulkPaymentRequest, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        'http://192.168.29.117:8000/purchaseapi/outgoingpayments/bulkpayment/bulk-payment',
        bulkPaymentRequest
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || 'Bulk payment processing failed'
      );
    }
  }
);

export const addNewPayment = createAsyncThunk<Outgoing, PaymentDetails>(
  'outgoings/addNewPayment',
  async (paymentData, { rejectWithValue }) => {
    console.log('addNewPayment called with data:', paymentData); // Log data received

    try {
      const outgoingWithDate = {
        ...paymentData,
      };

      const response = await axios.post('http://192.168.29.117:8000/purchaseapi/outgoingpayments/', outgoingWithDate);
      console.log('Response from API:', response.data); // Log response from API
      return response.data;
    } catch (error: any) {
      console.error('Error in addNewPayment:', error); // Log the error for further insight
      return rejectWithValue(error.response?.data || 'An error occurred while adding payment');
    }
  }
);
// Async thunk for adding new payment
export const addNewVendorPayment = createAsyncThunk(
  'outgoings/addNewVendorPayment',
  async (paymentData: any, { rejectWithValue }) => {
    console.log('addNewPayment called with data:', paymentData);
    try {
      const response = await axios.post('http://192.168.29.117:8000/purchaseapi/outgoingpayments/addvendorpayment/', {
        ...paymentData,
        isPreOutgoing: !paymentData.poId,
      });
      console.log('Response from API:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error in addNewPayment:', error);
      return rejectWithValue(error.response?.data?.detail || 'An error occurred while adding payment');
    }
  }
);

// Async thunk to fetch tax details for a specific outgoing payment
export const fetchTaxDetails = createAsyncThunk<TaxDetail[], string>(
  'outgoings/fetchTaxDetails',
  async (outgoingId) => {
    const response = await axios.get<TaxDetail[]>(`http://192.168.29.117:8000/purchaseapi/outgoingpayments/${outgoingId}/tax-details`);
    return response.data; // Assuming the response is directly an array of TaxDetail
  }
);

export const selectOutgoingPayment = createAsyncThunk<
  Outgoing,
  {
    outgoingId: string;
    paymentMode: string; // Added paymentMode
    paymentMethod: string; // For Bank payments: NEFT, RTGS, IMPS, UPI
    paymentType: string; // Full or Partial Payment
    paymentAmount: number;
    voucherNumber: string; // For voucher numbers
    pettyCashAmount?: number; // Optional, for Cash mode
    hoCash?: number; // Optional, for Cash mode
    bankName?: string; // Optional, for Bank mode
  }
>(
  'outgoings/selectOutgoingPayment',
  async (
    { outgoingId, paymentMode, paymentMethod, paymentType, paymentAmount, voucherNumber, pettyCashAmount, hoCash, bankName },
    { rejectWithValue }
  ) => {
    try {
      // Fetch outgoing payment details
      const response = await axios.get<Outgoing>(`http://192.168.29.117:8000/purchaseapi/outgoingpayments/${outgoingId}`);
      const outgoingData = response.data;

      const totalPayableAmount = outgoingData.totalPayableAmount ?? 0;

      // Initialize payment fields
      let paymentFields: Record<string, string | number> = {};

      // Handle based on paymentMode (Cash, Bank, etc.)
      switch (paymentMode.toLowerCase()) {
        case 'cash':
          paymentFields = {
            cashVoucherNo: voucherNumber,
            pettyCashAmount: pettyCashAmount ?? 0, // If Cash, include pettyCashAmount
            hoCash: hoCash ?? 0, // If Cash, include hoCash
          };
          break;

        case 'bank':
          paymentFields = {
            bankName: bankName ?? '', // Include bankName for Bank payments
            paymentMethod,
            [`${paymentMethod.toLowerCase()}No`]: voucherNumber, // NEFT, RTGS, IMPS, UPI
          };
          break;

        default:
          return rejectWithValue('Invalid payment mode');
      }

      // Handle full or partial payments
      let updatedOutgoing: Outgoing | null = null;
      if (paymentType === 'full') {
        updatedOutgoing = {
          ...outgoingData,
          totalPayableAmount: 0, // Full payment
          fullPaymentAmount: totalPayableAmount, // Full amount paid
          paymentType: 'full',
          status: 'Fully Paid',
          paymentMode, // Track payment mode
          ...paymentFields, // Add dynamic payment fields
        };
      } else if (paymentType === 'partial') {
        const remainingAmount = totalPayableAmount - paymentAmount;
        updatedOutgoing = {
          ...outgoingData,
          totalPayableAmount: remainingAmount, // Update remaining balance
          partialAmount: paymentAmount, // Partial amount
          paymentType: 'partial',
          status: remainingAmount === 0 ? 'Fully Paid' : 'Partially Paid',
          paymentMode, // Track payment mode
          ...paymentFields, // Add dynamic payment fields
        };
      } else {
        return rejectWithValue('Invalid payment type');
      }

      // Ensure updatedOutgoing is not null
      if (!updatedOutgoing) {
        return rejectWithValue('Failed to update outgoing payment: updatedOutgoing is null');
      }

      // Send updated data to the server
      await axios.patch(`http://192.168.29.117:8000/purchaseapi/outgoingpayments/${outgoingId}`, updatedOutgoing);

      return updatedOutgoing;
    } catch (error: any) {
      // Handle and log error if any occurs
      return rejectWithValue(error.response?.data || 'Error occurred while processing payment');
    }
  }
);

// Create slice for Outgoing items
const outgoingSlice = createSlice({
  name: 'outgoings',
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit'>) {
      state.dialogOpen = action.payload;
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    setEditIndex(state, action: PayloadAction<number | null>) {
      state.editIndex = action.payload;
    },
    clearSnackbarMessage(state) {
      state.snackbarMessage = '';
      state.snackbarOpen = false; // Close the snackbar when clearing the message
    },
    setPagination: (state, action: PayloadAction<{ page: number; size: number }>) => {
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.size;
    },
    setVendorPayment(
      state,
      action: PayloadAction<{
        vendorName: string;
        payment: VendorPayment;
      }>
    ) {
      state.vendorPayments[action.payload.vendorName] = action.payload.payment;
    },
    clearVendorPayments(state) {
      state.vendorPayments = {};
    },
    setVendorDebits(
      state,
      action: PayloadAction<{
        vendorName: string;
        debits: any[];
      }>
    ) {
      state.vendorDebits[action.payload.vendorName] = action.payload.debits;
    },
    clearVendorDebits(state) {
      state.vendorDebits = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOutgoings.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchOutgoings.fulfilled, (state, action) => {
        state.loading = false;
        state.outgoings = action.payload;
        state.currentPage = action.meta.arg.page;
        state.pageSize = action.meta.arg.size;
        state.totalItems = action.payload.totalItems; // Assuming the response has a 'totalItems' property
        state.daysFilterDate = action.payload.daysFilterDate ?? state.daysFilterDate;
      })
      .addCase(fetchOutgoings.rejected, (state) => {
        state.loading = false;
      })
      .addCase(fetchVendorDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(fetchVendorDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.outgoingvendor = action.payload; // Store the vendor names in the state
      })
      .addCase(fetchVendorDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendor names';
      })
      .addCase(addOutgoing.fulfilled, (state, action) => {
        state.outgoings.push(action.payload);
      })
      .addCase(updateOutgoing.fulfilled, (state, action) => {
        const index = state.outgoings.findIndex((item) => item.outgoingId === action.payload.outgoingId);
        if (index !== -1) {
          state.outgoings[index] = action.payload;
        }
      })
      // .addCase(deleteOutgoing.fulfilled, (state, action) => {
      //   state.outgoings = state.outgoings.filter((item) => item.outgoingId !== action.payload);
      // })
      .addCase(processPayment.pending, (state) => {
        state.loading = true; // Optionally handle loading state
      })
      .addCase(processPayment.fulfilled, (state) => {
        state.loading = false; // Optionally handle loading state
        // Optionally, you may want to fetch the updated list of outgoings if needed
        // dispatch(fetchOutgoings());
      })
      .addCase(processPayment.rejected, (state, action) => {
        state.loading = false; // Optionally handle loading state
        // Set snackbar message or handle the error
        state.snackbarOpen = true;
        state.snackbarMessage = action.payload as string;
      })
      .addCase(addNewPayment.pending, (state) => {
        state.loading = true;
      })
      .addCase(addNewPayment.fulfilled, (state, action) => {
        state.loading = false;
        // Assuming the API returns the created outgoing object
        state.outgoings.push(action.payload); // Add the newly created outgoing to the array
      })
      .addCase(addNewPayment.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(addNewVendorPayment.pending, (state) => {
        state.loading = true;
      })
      .addCase(addNewVendorPayment.fulfilled, (state, action) => {
        state.loading = false;
        // Assuming the API returns the created outgoing object
        state.outgoings.push(action.payload); // Add the newly created outgoing to the array
      })
      .addCase(addNewVendorPayment.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(fetchTaxDetails.fulfilled, (state, action) => {
        // Handle the fetched tax details
        // You may want to store these details in state or use them as needed
        console.log('Fetched Tax Details:', action.payload); // Just logging for now
      })
      .addCase(fetchGRN.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchGRN.fulfilled, (state, action: PayloadAction<GRN[]>) => {
        state.grns = action.payload;
      })
      .addCase(fetchGRN.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(fetchBank.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchBank.fulfilled, (state, action: PayloadAction<Bank[]>) => {
        state.banks = action.payload;
      })
      .addCase(fetchBank.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(selectOutgoingPayment.pending, (state) => {
        state.loading = true;
      })
      .addCase(selectOutgoingPayment.fulfilled, (state, action) => {
        state.loading = false;
        const updatedOutgoing = action.payload;
        const index = state.outgoings.findIndex((outgoing) => outgoing.outgoingId === updatedOutgoing.outgoingId);
        if (index !== -1) {
          state.outgoings[index] = updatedOutgoing;
        }
      })
      .addCase(selectOutgoingPayment.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(processBulkPayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(processBulkPayment.fulfilled, (state, action) => {
        state.loading = false;
        const { results, errors } = action.payload;

        // Update each outgoing with the results
        results.forEach((result) => {
          const index = state.outgoings.findIndex(
            (outgoing) => outgoing.outgoingId === result.outgoingId
          );

          if (index !== -1) {
            state.outgoings[index] = {
              ...state.outgoings[index],
              totalPayableAmount: result.pendingAmount,
              paidAmount: (state.outgoings[index].paidAmount || 0) + result.paymentAmount,
              debitAmount: (state.outgoings[index].debitAmount || 0) + result.debitAmountApplied,
              status: result.status,
              paymentType: result.paymentType,
              lastUpdatedDate: new Date(),
              paymentDate: new Date(),
              selectedDebitNotes: [
                ...(state.outgoings[index].selectedDebitNotes || []),
                ...result.debitNotesApplied
              ],
              hasDebitCreditNotes: result.debitNotesApplied.length > 0
            };
          }
        });

        // Show success message with error details if any
        const successMessage = `Processed ${results.length} payments successfully.`;
        const errorMessage = errors.length > 0 ? ` ${errors.length} failed.` : '';

        state.snackbarOpen = true;
        state.snackbarMessage = successMessage + errorMessage;
        state.vendorPayments = {};
        state.vendorDebits = {};
      })
      .addCase(processBulkPayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.snackbarOpen = true;
        state.snackbarMessage = action.payload as string;
      })
      .addCase(fetchActiveDebitsVendor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveDebitsVendor.fulfilled, (state, action: PayloadAction<DebitNote[]>) => {
        state.loading = false;
        state.debits = action.payload;
      })
      .addCase(fetchActiveDebitsVendor.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch active debits';
      })
  .addCase(fetchActiveDebitsMultipleVendor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveDebitsMultipleVendor.fulfilled, (state, action) => {
        state.loading = false;
        // Replace all debits with the new ones
        state.debits = action.payload;
      })
      .addCase(fetchActiveDebitsMultipleVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch debit notes';
      })
  },
});

// Export actions from slice
export const {
  setSearchQuery,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  clearSnackbarMessage,
  setEditIndex, setPagination, setVendorDebits, setVendorPayment, clearVendorDebits
} = outgoingSlice.actions;

// Selector to get Outgoing items from state
export const selectOutgoings = (state: RootState) => state.outgoingPayment;
export const selectCurrentPage = (state: RootState) => state.outgoingPayment.currentPage;
export const selectPageSize = (state: RootState) => state.outgoingPayment.pageSize;
export const selectTotalItems = (state: RootState) => state.outgoingPayment.totalItems;

// Export reducer from slice
export default outgoingSlice.reducer;
