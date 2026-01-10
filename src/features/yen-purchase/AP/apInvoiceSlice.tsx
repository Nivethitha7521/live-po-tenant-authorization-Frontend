import { RootState } from '@/redux/store';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { ApInvoice, ApInvoiceRandomId, ApInvoiceState, initialState } from '@/Models/apModel';


const BASE_URL = 'https://yenerp.com/purchaseapi';
// Fetch AP Invoices with pagination and advanced filtering
// Add this async thunk for loading more statuses
export const loadMoreStatuses = createAsyncThunk(
  'apInvoice/loadMoreStatuses',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const { statusSearch, statuses } = state.apInvoice;

    const currentPage = Math.ceil(statuses.length / 50) + 1;

    dispatch(setStatusesLoading(true));
    try {
      const response = await axios.get('https://yenerp.com/purchaseapi/apinvoices/statuses', {
        params: {
          search: statusSearch || '',
          page: currentPage,
          limit: 50
        }
      });

      if (currentPage === 1) {
        dispatch(setStatuses(response.data.data));
      } else {
        dispatch(appendStatuses(response.data.data));
      }

      dispatch(setHasMoreStatuses(response.data.hasMore));
    } catch (error) {
      console.error('Failed to load more statuses:', error);
      dispatch(setSnackbarMessage('Failed to load statuses'));
      dispatch(setSnackbarOpen(true));
    } finally {
      dispatch(setStatusesLoading(false));
    }
  }
);
// Update fetchApStatuses thunk in apInvoiceSlice.ts
export const fetchApStatuses = createAsyncThunk(
  'apInvoice/fetchApStatuses',
  async ({ search = '', page = 1 }: { search?: string; page?: number }, { dispatch, rejectWithValue }) => {
    dispatch(setStatusesLoading(true));
    try {
      const response = await axios.get('https://yenerp.com/purchaseapi/apinvoices/statuses', {
        params: {
          search: search,
          page: page,
          limit: 50
        }
      });

      // Check if response has the expected structure
      const statusData = response.data?.data || response.data || [];
      const hasMore = response.data?.hasMore || false;

      if (page === 1) {
        dispatch(setStatuses(statusData));
      } else {
        dispatch(appendStatuses(statusData));
      }

      dispatch(setHasMoreStatuses(hasMore));

      return statusData;
    } catch (error: any) {
      console.error('Failed to fetch statuses:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch statuses';
      dispatch(setSnackbarMessage(errorMessage));
      dispatch(setSnackbarOpen(true));
      return rejectWithValue(errorMessage);
    } finally {
      dispatch(setStatusesLoading(false));
    }
  }
);
export const fetchApInvoices = createAsyncThunk(
  'apinvoice/fetchApInvoices',
  async (
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      vendorName?: string;
      fromDate?: string;
      toDate?: string;
      invoiceType?: string;
      date_filter_field?: string;
    } = {},
    { rejectWithValue }
  ) => {
    try {
      // Calculate skip from page
      const page = params.page || 1;
      const limit = params.limit || 50;
      const skip = (page - 1) * limit;

      console.log('Fetching invoices with params:', {
        ...params,
        page,
        limit,
        skip
      });

      // Build query parameters for the API
      const queryParams: any = {
        limit: limit
      };

      // Add skip parameter (important for pagination)
      if (skip > 0) {
        queryParams.skip = skip;
      }

      // Add other filters
      if (params.date_filter_field) {
        queryParams.date_filter_field = params.date_filter_field;
      }
      if (params.fromDate) {
        queryParams.fromDate = params.fromDate;
      }
      if (params.toDate) {
        queryParams.toDate = params.toDate;
      }
      if (params.vendorName) {
        queryParams.vendorName = params.vendorName;
      }
      if (params.invoiceType && params.invoiceType !== 'all') {
        queryParams.invoiceType = params.invoiceType;
      }
      if (params.status) {
        queryParams.status = params.status;
      }

      const response = await axios.get(`${BASE_URL}/apinvoices/`, {
        params: queryParams
      });

      console.log('Backend response:', {
        dataLength: response.data.data?.length,
        total: response.data.total,
        page: response.data.page,
        totalPages: response.data.totalPages,
        hasMore: response.data.hasMore
      });

      return {
        data: response.data.data || [],
        total: response.data.total || 0,
        page: page, // Use the requested page, not response.page
        limit: limit,
        totalPages: response.data.totalPages || 1,
        hasMore: response.data.hasMore || false,
      };
    } catch (error: any) {
      console.error('Failed to fetch AP Invoices:', error);
      return rejectWithValue(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to fetch AP Invoices'
      );
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
    // Status filtering actions
    setSelectedStatus: (state, action: PayloadAction<string | null>) => {
      state.selectedStatus = action.payload;
    },

    setStatusSearch: (state, action: PayloadAction<string>) => {
      state.statusSearch = action.payload;
    },

    clearStatus: (state) => {
      state.selectedStatus = null;
      state.statusSearch = '';
    },

    setStatuses: (state, action: PayloadAction<string[]>) => {
      state.statuses = action.payload;
    },

    appendStatuses: (state, action: PayloadAction<string[]>) => {
      state.statuses = [...state.statuses, ...action.payload];
    },

    setStatusesLoading: (state, action: PayloadAction<boolean>) => {
      state.statusesLoading = action.payload;
    },

    setHasMoreStatuses: (state, action: PayloadAction<boolean>) => {
      state.hasMoreStatuses = action.payload;
    },

    resetStatuses: (state) => {
      state.statuses = [];
      state.statusesLoading = false;
      state.hasMoreStatuses = false;
      state.statusSearch = '';
      state.selectedStatus = null;
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
    goToNextPage: (state) => {
      if (state.currentPage < state.totalPages) {
        state.currentPage += 1;
      }
    },

    goToPrevPage: (state) => {
      if (state.currentPage > 1) {
        state.currentPage -= 1;
      }
    },

    goToFirstPage: (state) => {
      state.currentPage = 1;
    },

    goToLastPage: (state) => {
      state.currentPage = state.totalPages;
    },

    setCurrentPage: (state, action: PayloadAction<number>) => {
      const page = action.payload;
      if (page >= 1 && page <= state.totalPages) {
        state.currentPage = page;
      }
    },

    // Reset everything
    resetAll: (state) => {
      state.searchQuery = '';
      state.selectedStatus = null;
      state.currentPage = 1;
      state.totalItems = 0;
      state.totalPages = 1;
      state.hasMore = false;
      state.apInvoices = [];
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
    setIsSearchActive: (state, action: PayloadAction<boolean>) => {
      state.isSearchActive = action.payload;
    },

  },
  extraReducers: (builder) => {
    builder
      // Fetch AP Invoices
      .addCase(fetchApStatuses.pending, (state) => {
        state.statusesError = null;
      })
      .addCase(fetchApStatuses.fulfilled, (state, action) => {
        state.statusesLoading = false;
      })
      .addCase(fetchApStatuses.rejected, (state, action) => {
        state.statusesLoading = false;
        state.statusesError = action.payload as string;
      })
      .addCase(fetchApInvoices.fulfilled, (state, action) => {
        state.loading = false;

        const { data, total, page, limit, totalPages, hasMore } = action.payload;

        console.log('Setting pagination state:', {
          dataLength: data.length,
          totalItems: total,
          currentPage: page,
          totalPages: totalPages,
          hasMore: hasMore,
          skip: (page - 1) * limit
        });

        // Only update totalItems if it's a valid number
        if (total > 0) {
          state.totalItems = total;
        }

        state.apInvoices = data;
        state.currentPage = page;
        state.pageSize = limit;
        state.totalPages = totalPages;
        state.hasMore = hasMore;
      })

      .addCase(fetchApInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(loadMoreStatuses.pending, (state) => {
        state.statusesLoading = true;
      })
      .addCase(loadMoreStatuses.fulfilled, (state) => {
        state.statusesLoading = false;
      })
      .addCase(loadMoreStatuses.rejected, (state) => {
        state.statusesLoading = false;
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

export const { setSearchQuery, setSelectedStatus, clearError, setSelectedinvoiceId, setSnackbarMessage, setSnackbarOpen, setPagination, clearSnackbarMessage,
  setApDialogOpen, clearStatus,
  setStatusSearch,
  setStatuses,
  setStatusesLoading,
  setHasMoreStatuses,
  appendStatuses,
  setIsSearchActive, resetStatuses, goToNextPage,
  goToPrevPage,
  goToFirstPage,
  goToLastPage,
  setCurrentPage,
  resetAll, } = apInvoiceSlice.actions;

export const selectApinvoice = (state: RootState) => state.apInvoice;
export const selectCurrentPage = (state: RootState) => state.apInvoice.currentPage;
export const selectPageSize = (state: RootState) => state.apInvoice.pageSize;
export const selectTotalItems = (state: RootState) => state.apInvoice.totalItems;
export const selectStatuses = (state: RootState) => state.apInvoice.statuses;
export const selectStatusesLoading = (state: RootState) => state.apInvoice.statusesLoading;
export const selectHasMoreStatuses = (state: RootState) => state.apInvoice.hasMoreStatuses;

export default apInvoiceSlice.reducer;
