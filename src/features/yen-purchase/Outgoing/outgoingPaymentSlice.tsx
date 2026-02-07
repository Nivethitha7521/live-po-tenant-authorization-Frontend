import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import purchaseApi from "@/utils/api";

import { RootState } from '../../../redux/store';
import { Bank, BulkPaymentRequest, BulkPaymentResponse, DebitNote, FetchOutgoingsArgs, GRN, initialState, Outgoing, PaymentDetails, PaymentDone, PaymentHistory, ProcessPaymentRequest, TaxDetail, VendorDetail, VendorPayment } from '@/Models/outgoingModel';

export const fetchOutgoings = createAsyncThunk<
  { outgoings: Outgoing[]; totalItems: number; totalPayableAmount: number },
  FetchOutgoingsArgs,
  { rejectValue: string }
>(
  'outgoings/fetchOutgoings',
  async (args, { rejectWithValue }) => {
    try {
      const url = 'http://127.0.0.1:8000/purchasetestapi/outgoingpayments/';
      const params: any = {
        skip: (args.page - 1) * args.size,
        limit: args.size,
        filterByAmount: args.filterByAmount ?? false,
        filterByStatus: args.filterByStatus ?? false,
        sortOrder: args.sortOrder,
        filterAll: args.filterAll,
        sortBy: args.sortBy,
      };

      if (args.fromDate) params.fromDate = args.fromDate.toISOString();
      if (args.toDate) params.toDate = args.toDate.toISOString();
      if (args.vendorName) params.vendorName = args.vendorName;
      if (args.filterBy) params.filterBy = args.filterBy;
      if (args.status) params.status = args.status;

      console.log('🔍 API Call Params:', params);

      const response = await purchaseApi.get("/outgoingpayments/", { params });

      // DEBUG: Log the actual API response
      console.log('🔍 RAW API RESPONSE:', response.data);
      console.log('🔍 Response keys:', Object.keys(response.data));
      console.log('🔍 Has totalPayableAmount?', 'totalPayableAmount' in response.data);
      console.log('🔍 totalPayableAmount value:', response.data.totalPayableAmount);
      console.log('🔍 totalItems value:', response.data.totalItems);
      console.log('🔍 outgoings count:', response.data.outgoings?.length);

      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch outgoings:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch outgoings');
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

       const response = await purchaseApi.get<VendorDetail[]>(
        `/outgoingpayments/vendors/details?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
);
export const fetchGRN = createAsyncThunk('purchaseorder/fetch', async () => {
  const response = await purchaseApi.get<GRN[]>(`/grns/`);
  const grnData = response.data.map(item => ({
    grnId: item.grnId,
    randomId: item.randomId,
  }));
  return grnData;
});

// Async thunk to add a new Outgoing item
export const addOutgoing = createAsyncThunk<Outgoing, Omit<Outgoing, 'outgoingId'>>('outgoings/addOutgoing', async (outgoingData) => {
  const response = await purchaseApi.post("/outgoingpayments/", outgoingData); // Adjust the API endpoint as needed
  return response.data;
});

// Async thunk to update an existing Outgoing item
export const updateOutgoing = createAsyncThunk<Outgoing, Outgoing>('outgoings/updateOutgoing', async (outgoingData) => {
 const response = await purchaseApi.patch(
      `/outgoingpayments/${outgoingData.outgoingId}`,
      outgoingData,
    );  return response.data;
});
// Thunk
export const fetchBank = createAsyncThunk<Bank[], void, { dispatch: any }>(
  'outgoingPayment/fetchBanks',  // Updated path to match slice
  async (_, { dispatch }) => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/masterapi/bankmasters/');  // Fixed double slash
      return response.data;
    } catch (error) {
      dispatch(setSnackbarMessage('Failed to fetch banks. Please try again.'));
      dispatch(setSnackbarOpen(true));
      throw error;  // Re-throw for rejected case
    }
  }
);
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
      paymentMethod,
      chequeNo,
      neftNo,
      rtgsNo,
      impsNo,
      upi,
      cashAmount,
      bankName,
      selectedDebitNotes = [],
      selectedAdvancePayments = [],
      paymentDate,
    },
    { rejectWithValue }
  ) => {
    try {
      if (!['full', 'partial'].includes(paymentType)) {
        throw new Error('Payment type must be "full" or "partial"');
      }
      const payload = {
        outgoingId,
        paymentMode,
        paymentType,
        totalPayableAmount,
        fullPaymentAmount: paymentType === 'full' ? fullPaymentAmount : 0,
        partialAmount: paymentType === 'partial' ? partialAmount : 0,
        paymentMethod,
        chequeNo,
        neftNo,
        rtgsNo,
        impsNo,
        upi,
        cashAmount,
        bankName,
        selectedDebitNotes,
        selectedAdvancePayments,
        paymentDate: paymentDate.toISOString(),
      };

  await purchaseApi.patch(
        `/outgoingpayments/${outgoingId}/payment`,
        payload,
      );    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Payment processing failed');
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
const response = await purchaseApi.get(
        `/debitnote/vendor/${encodeURIComponent(vendorName)}/active-debits`,
      );      if (!response.data.debits) {
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
      if (!vendorNames || vendorNames.length === 0) {
        return []; // Return empty if no vendors
      }

      // Use the multiple endpoint for efficiency
      const vendorNamesStr = vendorNames.join(',');
      const response = await purchaseApi.get(
        `/debitnote/multiplevendors/active-debits?vendor_names=${encodeURIComponent(vendorNamesStr)}`,
      );

      return response.data.debits || [];
    } catch (error: any) {
      console.error('Failed to fetch active debits:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch active debits');
    }
  }
);

// Updated outgoingPaymentSlice.ts (handle Date parsing/serialization)
export const processBulkPayment = createAsyncThunk<
  BulkPaymentResponse,
  BulkPaymentRequest,
  { rejectValue: string }
>(
  'outgoings/processBulkPayment',
  async (bulkPaymentRequest, { rejectWithValue }) => {
    try {
      // Serialize Date to string (YYYY-MM-DD) for API request
      const requestPayload = {
        ...bulkPaymentRequest,
        paymentDate: bulkPaymentRequest.paymentDate
          ? bulkPaymentRequest.paymentDate.toISOString().split('T')[0]
          : undefined,
      };

      const response = await purchaseApi.patch(
        "/outgoingpayments/bulk/bulk-payment",
        requestPayload,
      );

      if (response.status === 207) {
        // Parse string back to Date in response
        const parsedData = {
          ...response.data,
          results: response.data.results.map((result: any) => ({
            ...result,
            paymentDate: result.paymentDate ? new Date(result.paymentDate) : undefined,
          })),
        };
        return parsedData as BulkPaymentResponse;
      }

      // If no parsing needed (no paymentDate), return as-is
      return response.data as BulkPaymentResponse;
    } catch (error: any) {
      if (error.response?.status === 207 && error.response?.data) {
        // Parse error response similarly if it contains paymentDate
        const parsedErrorData = {
          ...error.response.data,
          results: error.response.data.results?.map((result: any) => ({
            ...result,
            paymentDate: result.paymentDate ? new Date(result.paymentDate) : undefined,
          })) || [],
        };
        return parsedErrorData as BulkPaymentResponse;
      }

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

  const response = await purchaseApi.post(
        "/outgoingpayments/",
        outgoingWithDate,
      );      console.log('Response from API:', response.data); // Log response from API
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
      const response = await purchaseApi.post("/outgoingpayments/advance/", {
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
 const response = await purchaseApi.get<TaxDetail[]>(
      `/outgoingpayments/${outgoingId}/tax-details`,
    );    return response.data; // Assuming the response is directly an array of TaxDetail
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
  const response = await purchaseApi.get<Outgoing>(
        `/outgoingpayments/${outgoingId}`,
      );      const outgoingData = response.data;

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
 await purchaseApi.patch(
        `/outgoingpayments/${outgoingId}`,
        updatedOutgoing,
      );
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
    // ADD THE MISSING ACTION HERE
    setSelectedOutgoingId: (state, action: PayloadAction<string | null>) => {
      state.selectedOutgoingId = action.payload;
    },
    
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit'>) {
      state.dialogOpen = action.payload;
    },
    // ADD THESE NEW REDUCERS FOR SELECTION
    setSelectedOutgoingIds: (state, action: PayloadAction<string[]>) => {
      state.selection.selectedOutgoingIds = action.payload;
    },

    setSelectedOutgoings: (state, action: PayloadAction<Outgoing[]>) => {
      state.selection.selectedOutgoings = action.payload;
    },

        toggleOutgoingSelection: (state, action: PayloadAction<{ outgoingId: string; outgoing: Outgoing }>) => {
      const { outgoingId, outgoing } = action.payload;
      const existingIndex = state.selection.selectedOutgoingIds.indexOf(outgoingId);
      
      if (existingIndex >= 0) {
        // Remove from selection
        state.selection.selectedOutgoingIds.splice(existingIndex, 1);
        state.selection.selectedOutgoings = state.selection.selectedOutgoings.filter(
          item => item.outgoingId !== outgoingId
        );
      } else {
        // Add to selection
        state.selection.selectedOutgoingIds.push(outgoingId);
        state.selection.selectedOutgoings.push(outgoing);
      }
    },

    // Add this to sync selections when data changes
    syncSelectionsWithCurrentData: (state) => {
      const currentOutgoingIds = new Set(state.outgoings.map(o => o.outgoingId));
      
      // Remove selections that are no longer in current data
      state.selection.selectedOutgoingIds = state.selection.selectedOutgoingIds.filter(
        id => currentOutgoingIds.has(id)
      );
      state.selection.selectedOutgoings = state.selection.selectedOutgoings.filter(
        outgoing => currentOutgoingIds.has(outgoing.outgoingId)
      );
    },
    clearSelection: (state) => {
      state.selection.selectedOutgoingIds = [];
      state.selection.selectedOutgoings = [];
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
    // ... your existing reducers
    clearAdvances: (state) => {
      state.advances = [];
    },
    clearBulkPaymentState: (state) => {
      state.loading = false;
      state.error = null;
      state.snackbarOpen = false;
      state.snackbarMessage = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOutgoings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOutgoings.fulfilled, (state, action) => {
        state.loading = false;
        state.outgoings = action.payload.outgoings.map(outgoing => ({
          ...outgoing,
          totalPaid: (outgoing.advanceAmount || 0) + (outgoing.partialAmount || 0) + (outgoing.fullPaymentAmount || 0),
          remainingAmount: Math.max(0, (outgoing.totalPayableAmount || 0) -
            ((outgoing.advanceAmount || 0) + (outgoing.partialAmount || 0) + (outgoing.fullPaymentAmount || 0))),
        }));
        state.totalItems = action.payload.totalItems;
        state.totalPayableAmount = action.payload.totalPayableAmount || 0;

        // UPDATE: Sync selected outgoings with fresh data when outgoings change
        state.selection.selectedOutgoings = state.selection.selectedOutgoingIds.map(id =>
          action.payload.outgoings.find(outgoing => outgoing.outgoingId === id)
        ).filter(Boolean) as Outgoing[];
      })
      .addCase(fetchOutgoings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
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
        state.loading = false;
        state.banks = action.payload.filter((bank) => bank.status === 'active');  // Filter active banks here (or in component)
      })
      .addCase(fetchBank.rejected, (state, action) => {
        state.loading = false;
        state.banks = [];  // Reset on error
        console.error('Fetch banks error:', action.error);
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
      // outgoingPaymentSlice.ts
      .addCase(processBulkPayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // Updated fulfilled case (no change needed, as parsing is done in thunk)
      .addCase(processBulkPayment.fulfilled, (state, action) => {
        state.loading = false;
        const { results, errors } = action.payload;

        const successCount = results.length;
        const errorCount = errors.length;

        let message = `Processed ${successCount} payments successfully.`;
        if (errorCount > 0) {
          message += ` ${errorCount} payments failed.`;
        }

        state.snackbarOpen = true;
        state.snackbarMessage = message;
        // Clear temp states if needed
        state.vendorPayments = {};
        state.vendorDebits = {};
        // No local updates here - rely on fetchOutgoings for refresh
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
  setEditIndex, 
  setPagination, 
  setVendorDebits, 
  setVendorPayment, 
  clearVendorDebits, 
  clearAdvances,  
  toggleOutgoingSelection,
  clearSelection,
  syncSelectionsWithCurrentData,
  clearBulkPaymentState,
  // ADD THE MISSING ACTION TO EXPORTS
  setSelectedOutgoingId,  // <-- ADD THIS
  setSelectedOutgoingIds, // Already exists
  setSelectedOutgoings    // Already exists
} = outgoingSlice.actions;

// Selector to get Outgoing items from state
export const selectOutgoings = (state: RootState) => state.outgoingPayment;
export const selectCurrentPage = (state: RootState) => state.outgoingPayment.currentPage;
export const selectPageSize = (state: RootState) => state.outgoingPayment.pageSize;
export const selectTotalItems = (state: RootState) => state.outgoingPayment.totalItems;
export const selectTotalPayableAmount = (state: RootState) => state.outgoingPayment.totalPayableAmount;
// Export reducer from slice
export default outgoingSlice.reducer;