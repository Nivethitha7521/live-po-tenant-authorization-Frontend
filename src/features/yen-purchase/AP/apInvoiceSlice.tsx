import { RootState } from '@/redux/store';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { ApInvoice, ApInvoiceRandomId, ApInvoiceState, initialState } from '@/Models/apModel';


const BASE_URL = 'http://https://yenerp.com00/purchaseapi';


// Fetch AP Invoices with pagination and advanced filtering
export const fetchApInvoices = createAsyncThunk(
  'apinvoice/fetchApInvoices',
  async (
    { page, size, fromDate, toDate, vendorName, dateFilterField }: {
      page: number;
      size: number;
      fromDate?: Date;
      toDate?: Date;
      vendorName?: string;
      dateFilterField?: string;  // New parameter for date field
    },
    { rejectWithValue }
  ) => {
    try {
      // Prepare the parameters for the API call
      const params: {
        skip: number;
        limit: number;
        fromDate?: string;
        toDate?: string;
        vendorName?: string;
        dateFilterField?: string;  // Add dateFilterField to params
      } = {
        skip: (page - 1) * size, // Pagination skip
        limit: size,             // Pagination limit
      };

      // Add filters to the params object if they exist
      if (fromDate) {
        params.fromDate = fromDate.toISOString();  // Convert to ISO string format
      }

      if (toDate) {
        params.toDate = toDate.toISOString();  // Convert to ISO string format
      }

      if (vendorName) {
        params.vendorName = vendorName;
      }

      if (dateFilterField) {
        params.dateFilterField = dateFilterField;  // Add the date filter field to the params
      }

      // Make the API request with the correctly formatted parameters
      const response = await axios.get(`${BASE_URL}/apinvoices/`, {
        params: params,
      });

      return response.data; // Returning the paginated and filtered AP Invoices
    } catch (error: any) {
      console.error('Failed to fetch AP Invoices:', error);
      return rejectWithValue(error.response?.data || 'Failed to fetch AP Invoices');
    }
  }
);

// Add AP Invoice
export const addApInvoice = createAsyncThunk(
  'apinvoice/add',
  async (apInvoice: ApInvoice, { rejectWithValue }) => {
    try {
      const newApInvoice = { ...apInvoice };
      const response = await axios.post(`${BASE_URL}/apinvoices/`, newApInvoice);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to add AP Invoice');
    }
  }
);
export const fetchAllApInvoices = createAsyncThunk(
  'apinvoice/fetchAll',
  async (_, { rejectWithValue }) => { // No parameters needed here for fetching all
    try {
      const response = await axios.get(`${BASE_URL}/apinvoices/getAll`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch AP Invoices');
    }
  }
);
export const fetchRandomIDApInvoices = createAsyncThunk(
  'apinvoice/fetchRandomId',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<ApInvoiceRandomId[]>(`${BASE_URL}/apinvoices/getInvoiceIds`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch AP Invoices');
    }
  }
);

// Update AP Invoice
export const updateApInvoice = createAsyncThunk(
  'apinvoice/updateap',
  async (apInvoice: ApInvoice, { rejectWithValue }) => {
    try {
      const updatedApInvoice = { ...apInvoice };
      const response = await axios.patch(`${BASE_URL}/apinvoices/${apInvoice.invoiceId}`, updatedApInvoice);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to update AP Invoice');
    }
  }
);
export const cancelApInvoice = createAsyncThunk(
  'apinvoice/cancel',
  async (invoiceId: string, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${BASE_URL}/apinvoices/${invoiceId}`, {
        status: 'Canceled',
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to cancel AP Invoice');
    }
  }
);
export const convertToGrnFromApReturned = createAsyncThunk(
  'apinvoice/convertToGrnFromApReturned',
  async (invoiceId: string, { rejectWithValue }) => {
    try {
      console.log('Received invoiceId:', invoiceId);

      // Single API call to handle all updates
      const response = await axios.patch(
        `${BASE_URL}/apinvoices/convert-to-grn-from-returned/${invoiceId}`
      );

      console.log('Conversion successful:', response.data);
      return response.data;

    } catch (error: any) {
      console.error('Error in convertToGrnFromApReturned:', error);
      return rejectWithValue(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'Failed to convert AP Returned to GRN'
      );
    }
  }
);
export const fetchItemwiseAps = createAsyncThunk(
  'ap/fetchItemwiseAps',
  async () => {
    try {
      const response = await axios.get(`${BASE_URL}/apinvoices/getOutgoing/apinvoice`);
      return response.data;  // Returning the itemwise GRNs
    } catch (error) {
      console.error('Failed to fetch itemwise Aps:', error);
      throw new Error('Failed to fetch itemwise Aps');
    }
  }
);

export const postOutgoingAndUpdateDiscount = createAsyncThunk(
  'apinvoice/postOutgoingAndUpdateDiscount',
  async (
    { invoiceId, apDiscountPrice, outgoingDate }: { invoiceId: string; apDiscountPrice: number; outgoingDate?: Date | null },
    { rejectWithValue }
  ) => {
    try {
      const effectiveDate = outgoingDate ? outgoingDate.toISOString() : new Date().toISOString();
      console.log('Sending payload:', { invoiceId, apDiscountPrice, outgoingDate: effectiveDate });
      const response = await axios.patch(
        `${BASE_URL}/apinvoices/${invoiceId}/convert-to-outgoing-and-discount`,
        { invoiceId, apDiscountPrice, outgoingDate: effectiveDate }
      );
      console.log('Server response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error in postOutgoingAndUpdateDiscount:', error);
      return rejectWithValue(error.response?.data || 'Failed to post outgoing and update discount');
    }
  }
);
export const updateApdiscountInvoice = createAsyncThunk(
  'apinvoice/update',
  async (payload: { invoiceId: string; apDiscountPrice: number }, { rejectWithValue }) => {
    try {
      const { invoiceId, apDiscountPrice } = payload;

      // Fetch the existing AP Invoice using the provided id
      const { data: apInvoice } = await axios.get(`${BASE_URL}/apinvoices/${invoiceId}`);

      // Calculate new values
      const newApDiscountPrice = (apInvoice.discountPrice || 0) + apDiscountPrice;
      const discountDetails = apInvoice.discountDetails + apDiscountPrice;
      const totalPayableAmount = apInvoice.invoiceAmount - apDiscountPrice; // Adjusted

      // Create the updated invoice object
      const updatedApInvoice = {
        ...apInvoice,
        discountPrice: newApDiscountPrice,
        invoiceAmount: totalPayableAmount,
        discountDetails: discountDetails, // Ensure to initialize correctly
        apDiscountPrice: apDiscountPrice
      };

      // Make the API call to update the invoice
      const response = await axios.patch(`${BASE_URL}/apinvoices/${invoiceId}`, updatedApInvoice);
      return response.data; // Return the updated invoice data
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to update AP Invoice');
    }
  }
);

const apInvoiceSlice = createSlice({
  name: 'apInvoice',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    clearSnackbarMessage(state) {
      state.snackbarMessage = '';
      state.snackbarOpen = false; // Close the snackbar when clearing the message
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setSelectedinvoiceId(state, action: PayloadAction<string | null>) {
      state.selectedinvoiceId = action.payload;
    },
    setPagination: (state, action: PayloadAction<{ page: number; size: number }>) => {
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.size;
    },
    setApDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.apDialogOpen = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch AP Invoices
      .addCase(fetchApInvoices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchApInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.apInvoices = action.payload;
        state.totalItems = action.payload.totalItems; // Total items for pagination 
        state.currentPage = action.meta.arg.page;
        state.pageSize = action.meta.arg.size;

      })
      .addCase(fetchApInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAllApInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.allapInvoices = action.payload;
      })
      // Add AP Invoice
      .addCase(addApInvoice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addApInvoice.fulfilled, (state, action) => {
        state.loading = false;
        state.apInvoices.push(action.payload);
      })
      .addCase(addApInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update AP Invoice
      .addCase(updateApInvoice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateApInvoice.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.apInvoices.findIndex(apInvoice => apInvoice.invoiceId === action.payload.invoiceId);
        if (index !== -1) {
          state.apInvoices[index] = action.payload; // Update the invoice in the state
        }
      })
      .addCase(updateApInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(convertToGrnFromApReturned.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(convertToGrnFromApReturned.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
        // No state update needed - backend handled everything
        // You can refetch data if needed, or rely on background updates
      })
      .addCase(convertToGrnFromApReturned.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(postOutgoingAndUpdateDiscount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(postOutgoingAndUpdateDiscount.fulfilled, (state, action) => {
        state.loading = false;
        // No manual update needed; refetch in finally() handles refreshing the list
      })
      .addCase(postOutgoingAndUpdateDiscount.rejected, (state, action) => {
        state.loading = false;
        state.error = 'Failed to post outgoing and update discount';
      })
      // Cancel AP Invoice
      .addCase(cancelApInvoice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelApInvoice.fulfilled, (state, action) => {
        state.loading = false;
        state.apInvoices = state.apInvoices.map((invoice) =>
          invoice.invoiceId === action.payload.invoiceId ? action.payload : invoice
        );
      })
      .addCase(cancelApInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateApdiscountInvoice.pending, (state) => {
        state.loading = true;
        state.error = null; // Reset the error when request is pending
      })
      .addCase(updateApdiscountInvoice.fulfilled, (state, action) => {
        state.loading = false;
        const updatedInvoiceIndex = state.apInvoices.findIndex(invoice => invoice.invoiceId === action.payload.invoiceId);
        if (updatedInvoiceIndex !== -1) {
          state.apInvoices[updatedInvoiceIndex] = action.payload; // Keep this line but ensure immutability
        }
      })
      .addCase(updateApdiscountInvoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Something went wrong while updating the AP invoice';
      })
      .addCase(fetchRandomIDApInvoices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRandomIDApInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.randomIdap = action.payload;
      })
      .addCase(fetchRandomIDApInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchItemwiseAps.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchItemwiseAps.fulfilled, (state, action) => {
        state.loading = false;
        state.itemwiseap = action.payload;  // Update the state with fetched GRNs
      })
      .addCase(fetchItemwiseAps.rejected, (state, action) => {
        state.loading = false;
      });
  },
});

export const { setSearchQuery, clearError, setSelectedinvoiceId, setSnackbarMessage, setSnackbarOpen, setPagination, clearSnackbarMessage,
  setApDialogOpen, } = apInvoiceSlice.actions;

export const selectApinvoice = (state: RootState) => state.apInvoice;
export const selectCurrentPage = (state: RootState) => state.apInvoice.currentPage;
export const selectPageSize = (state: RootState) => state.apInvoice.pageSize;
export const selectTotalItems = (state: RootState) => state.apInvoice.totalItems;


export default apInvoiceSlice.reducer;
