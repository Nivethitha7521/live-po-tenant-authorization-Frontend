import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { format } from 'date-fns';
import { RootState } from '../../../redux/store';
import { GrnData, GrnState, ItemDetail, ItemDetails, Vendor, PurchaseItem, PurchaseOrder, ApInvoice, ReturnGRNRequest, FetchGrnsPayload, FetchGrnsArgs, initialState, DebitCreditNote, FetchGrnsReturnPayload, ReturnReason } from '@/Models/grnModel';
import { PurchaseRandomId } from '@/Models/purchaseModel';

// Define a specific interface for item updates
export interface ItemUpdate {
  itemId: string;
  befTaxDiscount?: number;
  afTaxDiscount?: number;
  expiryDate?: Date | null;
}
const BASE_URL = 'https://yenerp.com/purchaseapi';
const customRoundOf = (value: number) => {
  return Math.round(value * 100) / 100; // Round to two decimal places
};

export const fetchGrns = createAsyncThunk<FetchGrnsPayload, FetchGrnsArgs>(
  'grns/fetch',
  async ({ page, size, status = '', fromDate, toDate, vendorName, dateFilterField = 'grnDate', daysFilterDate }) => {
    const params: {
      skip?: number;
      limit?: number;
      status?: string;
      fromDate?: string;
      toDate?: string;
      vendorName?: string;
      dateFilterField?: string;
      daysFilterDate?: number;
    } = {};

    params.skip = (page - 1) * size;
    params.limit = size;

    if (status) params.status = status;
    if (vendorName) params.vendorName = vendorName;
    if (fromDate) params.fromDate = fromDate.toISOString();
    if (toDate) params.toDate = toDate.toISOString();
    if (dateFilterField) params.dateFilterField = dateFilterField;
    if (daysFilterDate) params.daysFilterDate = daysFilterDate;

    try {
      const response = await axios.get<GrnData[]>(`${BASE_URL}/grns/`, { params });
      return {
        grns: response.data,
        totalItems: Number(response.headers['x-total-count'] ?? response.data.length),
        hasDebitCreditNotes: response.data.reduce((acc, grn) => {
          acc[grn.grnId] = grn.hasDebitCreditNotes ?? false;
          return acc;
        }, {} as Record<string, boolean>),
      };
    } catch (error: any) {
      return Promise.reject(error.response?.data || 'Error fetching GRNs');
    }
  }
);
export const fetchReturnedGrns = createAsyncThunk<
  FetchGrnsReturnPayload,
  FetchGrnsArgs,
  { rejectValue: string }
>(
  'grns/fetchReturned',
  async ({ page, size, status, fromDate, toDate, vendorName, dateFilterField = 'grnReturnedDate', daysFilterDate }, { rejectWithValue }) => {
    const params: {
      skip?: number;
      limit?: number;
      status?: string;
      fromDate?: string;
      toDate?: string;
      vendorName?: string;
      dateFilterField?: string;
      daysFilterDate?: number;
    } = {};

    params.skip = (page - 1) * size;
    params.limit = size;

    if (status) params.status = status;
    if (vendorName) params.vendorName = vendorName;
    if (fromDate) params.fromDate = fromDate.toISOString();
    if (toDate) params.toDate = toDate.toISOString();
    if (dateFilterField) params.dateFilterField = dateFilterField;
    if (daysFilterDate) params.daysFilterDate = daysFilterDate;

    try {
      const response = await axios.get<GrnData[]>(`${BASE_URL}/grns/returnprocess/Grnwise`, { params });
      return {
        grns: response.data,
        totalItems: Number(response.headers['x-total-count'] ?? response.data.length),
        hasDebitCreditNotes: response.data.reduce((acc, grn) => {
          acc[grn.grnId] = grn.hasDebitCreditNotes ?? (grn.totalDebitAmount != null && grn.totalDebitAmount > 0);
          return acc;
        }, {} as Record<string, boolean>),
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Error fetching returned GRNs');
    }
  }
);
export const fetchItemwiseGrns = createAsyncThunk(
  'grn/fetchItemwiseGrns',
  async () => {
    try {
      const response = await axios.get(`${BASE_URL}/grns/getOutgoing/itemwise`);
      return response.data;  // Returning the itemwise GRNs
    } catch (error) {
      console.error('Failed to fetch itemwise GRNs:', error);
      throw new Error('Failed to fetch itemwise GRNs');
    }
  }
);
export const fetchGrnById = createAsyncThunk(
  'grn/fetchById',
  async (grnId: string) => {
    const response = await axios.get(`${BASE_URL}/grns/${grnId}`);
    return response.data; // Returning the GRN details
  }
);
export const addGrn = createAsyncThunk(
  'grn/addGrn',
  async (grn: GrnData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/grns`, grn);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to add GRN');
    }
  }
);

export const updateGrn = createAsyncThunk(
  'grn/updateGrn',
  async (grn: GrnData, { rejectWithValue }) => {
    try {
      const updatedGrn = { ...grn };
      const response = await axios.patch(`${BASE_URL}/grns/${grn.grnId}`, updatedGrn);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to update GRN');
    }
  }
);
// Thunk to update the invoice details
export const updateInvoiceDetails = createAsyncThunk(
  'grn/updateInvoiceDetails',
  async (payload: { grnId: string; invoiceDate?: string; invoiceNo?: string }, { rejectWithValue }) => {
    try {
      // Construct the URL with query parameters
      const url = `${BASE_URL}/grns/invoiceupdate/${payload.grnId}?invoiceNo=${payload.invoiceNo}&invoiceDate=${payload.invoiceDate}`;

      // Make the PATCH request
      const response = await axios.patch(url);

      // Return the updated data from the response
      return response.data;
    } catch (error: any) {
      // Handle errors and return the error response data
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateGrnStatus = createAsyncThunk(
  'grn/updateGrnStatus',
  async ({ grnId, status }: { grnId: string, status: string }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${BASE_URL}/grns/${grnId}`, { status });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to update GRN');
    }
  }
);

// // Define a utility function to calculate discount
// const calculateDiscount = (amount: number, discountRate: number) => {
//   return discountRate ? (amount * discountRate) / 100 : 0;
// };


export const updateItemDetails = createAsyncThunk(
  'grn/updateItemDetails',
  async (
    {
      grnId,
      discountPrice,
      itemUpdates,
      apInvoiceDate,
      outgoingDate,
    }: {
      grnId: string;
      discountPrice: number;
      itemUpdates: ItemUpdate[];
      apInvoiceDate?: string;
      outgoingDate?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const url = new URL(`${BASE_URL}/grns/convert-to-ap/ap-to-outgoing/${grnId}`);
      url.searchParams.append('discountPrice', discountPrice.toString());
      if (apInvoiceDate) {
        url.searchParams.append('apInvoiceDate', apInvoiceDate);
      }
      if (outgoingDate) {
        url.searchParams.append('outgoingDate', outgoingDate);
      }

      const response = await axios.patch(url.toString(), itemUpdates);

      return {
        grnId,
        itemUpdates: response.data.updatedItems,
        discountPrice,
        success: true,
        apInvoiceConverted: response.data.apInvoiceConverted,
        apInvoiceDetails: response.data.apInvoiceDetails,
        outgoingConverted: response.data.outgoingConverted,
        outgoingDetails: response.data.outgoingDetails,
        totalReceivedAmount: response.data.totalReceivedAmount,
        totalDiscount: response.data.totalDiscount,
        totalTax: response.data.totalTax,
        grnStatus: response.data.grnStatus,
      };
    } catch (error: any) {
      console.error('Update item details error:', error);
      return rejectWithValue(error.response?.data || 'Failed to update item details');
    }
  }
);
export const fetchGrnsWithItemStatus = createAsyncThunk<
  GrnData[],
  string, // status
  { rejectValue: string }
>(
  'grn/fetchGrnsWithItemStatus',
  async (status, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/api/grns/items/status/${status}`);
      return response.data;
    } catch (error) {
      return rejectWithValue('Failed to fetch GRNs with the specified item status.');
    }
  }
);

export const fetchRandomNumbers = createAsyncThunk(
  'invoiceNumbers/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<PurchaseRandomId[]>('https://yenerp.com/purchaseapi/purchaseorders/getByRandomId');
      return response.data;  // List of invoice numbers
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch invoice numbers');
    }
  }
);
export const fetchReturnReasons = createAsyncThunk(
  'grn/fetchReturnReasons',
  async (_, { rejectWithValue }) => {
    try {
      console.log('Fetching return reasons...');
      const response = await axios.get<ReturnReason[]>('https://yenerp.com/purchaseapi/grns/getgrn/return-reasons');
      console.log('Return reasons fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Fetch return reasons error:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch return reasons');
    }
  }
);
export const addReturnReason = createAsyncThunk(
  'grn/addReturnReason',
  async (reason: string, { rejectWithValue }) => {
    try {
      const response = await axios.post('https://yenerp.com/purchaseapi/grns/return-reasons', { reason });
      return response.data.reason;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add return reason');
    }
  }
);

export const returnGrn = createAsyncThunk(
  'grn/returnGrn',
  async (payload: { grnId: string; returnData: ReturnGRNRequest }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`https://yenerp.com/purchaseapi/grns/${payload.grnId}/return`, payload.returnData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to return GRN');
    }
  }
);
export const fetchDebitCreditNotesByGrn = createAsyncThunk<
  DebitCreditNote[],
  { grnId: string; page: number; size: number },
  { rejectValue: string }
>(
  'grn/fetchDebitCreditNotesByGrn',
  async ({ grnId, page, size }, { rejectWithValue }) => {
    try {
      const response = await axios.get<DebitCreditNote[]>(`https://yenerp.com/purchaseapi/grns/returnprocess/DebitNote/${grnId}`, {
        params: { skip: (page - 1) * size, limit: size },
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Error fetching DebitCreditNotes');
    }
  }
);
// // Async thunk to fetch GRNs based on filters
// export const fetchGrnFilter = createAsyncThunk(
//   'grns/fetchGrnFilter',
//   async (filters: { fromDate?: Date; toDate?: Date; vendorName?: string; status?: string }) => {
//     const { fromDate, toDate, vendorName, status } = filters;

//     // Convert Date objects to ISO string format (if they exist)
//     const params: { fromDate?: string; toDate?: string; vendorName?: string; status?: string } = {};

//     if (fromDate) {
//       params.fromDate = fromDate.toISOString();  // Convert to ISO string format
//     }

//     if (toDate) {
//       params.toDate = toDate.toISOString();  // Convert to ISO string format
//     }

//     if (vendorName) {
//       params.vendorName = vendorName;
//     }

//     if (status) {
//       params.status = status;
//     }

//     try {
//       // Make the API request with the correctly formatted parameters
//       const response = await axios.get('https://yenerp.com/purchaseapi/grns/from-date/', {
//         params: params,
//       });

//       console.log(response.data);  // Log the response data for debugging
//       return response.data;  // Return the data to be used in your Redux state
//     } catch (error: any) {
//       // Handle the error and return a custom error message
//       if (error.response && error.response.status === 404) {
//         return { errorMessage: 'No matching GRNs found.' };  // Intimation message for 404
//       } else {
//         return { errorMessage: 'Error fetching GRNs.' };  // Generic error message
//       }
//     }
//   }
// );

// export const returnGrn = createAsyncThunk(
//   'grn/returnGrn',
//   async (payload: { grnId: string; returnData: ReturnGRNRequest }, { rejectWithValue }) => {
//     try {
//       const response = await axios.patch(`${BASE_URL}/grns/${payload.grnId}/return`, payload.returnData);
//       return response.data; // Returns updated GrnData
//     } catch (error: any) {
//       return rejectWithValue(error.response?.data || 'Failed to return GRN');
//     }
//   }
// );


export const updateGrnCancelStatus = createAsyncThunk(
  'grns/updateStatus',
  async (grnId: string, { rejectWithValue }) => {
    try {
      // Send the PATCH request to update the GRN status
      const response = await axios.patch(`https://yenerp.com/purchaseapi/grns/${grnId}`, {
        status: 'active',
      });

      return response.data; // Ensure this contains the updated GRN object
    } catch (error: any) {
      // Handle error by returning a rejected value with an error message
      return rejectWithValue(error.response?.data || 'Failed to update status');
    }
  }
);
export const updateItemStatus = createAsyncThunk(
  'itemStatus/updateItemStatus',
  async ({ grnId, items }: { grnId: string; items: { itemId: string; status: string }[] }, { rejectWithValue }) => {
    try {
      // Create an object mapping item IDs to their statuses
      const statusUpdateObject = items.reduce((acc, { itemId, status }) => {
        acc[itemId] = status; // Add itemId as key and status as value
        return acc;
      }, {} as Record<string, string>);

      // Send the object in the request body
      const response = await axios.patch(`${BASE_URL}/grns/${grnId}/items/status`, statusUpdateObject, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data; // Return the response data upon success
    } catch (err: any) {
      return rejectWithValue(err.response.data); // Handle errors
    }
  }
);

export const grnSlice = createSlice({
  name: 'grn',
  initialState,
  reducers: {
    setSelectedGrnId(state, action: PayloadAction<string | null>) {
      state.selectedGrnId = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setView(state, action: PayloadAction<'grn'>) {
      state.view = action.payload;
    },
    setNewItem(state, action: PayloadAction<ItemDetail>) {
      state.newItem = action.payload;
    },

    setVendors(state, action: PayloadAction<Vendor[]>) {
      state.vendors = action.payload;
    },
    setPurchaseItems(state, action: PayloadAction<PurchaseItem[]>) {
      state.purchaseitems = action.payload;
    },
    setPurchaseOrders(state, action: PayloadAction<PurchaseOrder[]>) {
      state.purchaseorders = action.payload;
    },
    setApInvoice(state, action: PayloadAction<ApInvoice[]>) {
      state.apinvoice = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setSnackbarOpenGRN: (state, action: PayloadAction<boolean>) => {
      state.snackbarOpenGRN = action.payload;
    },
    setSnackbarMessageGRN: (state, action: PayloadAction<string>) => {
      state.snackbarMessageGRN = action.payload;
    },
    clearSnackbarMessage(state) {
      state.snackbarMessageGRN = '';
      state.snackbarOpenGRN = false; // Close the snackbar when clearing the message
    },
    setPagination: (state, action: PayloadAction<{ page: number; size: number }>) => {
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.size;
    },
    setSelectedHeaders(state, action: PayloadAction<string[]>) {
      state.selectedHeaders = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchGrns.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGrns.fulfilled, (state, action) => {
        state.loading = false;
        state.grns = action.payload.grns;
        state.totalItems = action.payload.totalItems;
        state.currentPage = action.meta.arg.page;
        state.pageSize = action.meta.arg.size;
      })
      .addCase(fetchGrns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.snackbarMessageGRN = action.payload as string;
        state.snackbarOpenGRN = true;
      })
      .addCase(fetchReturnedGrns.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReturnedGrns.fulfilled, (state, action) => {
        state.loading = false;
        state.itemwise = action.payload.grns; // Or store in a different state field, e.g., state.returnedGrns
        state.totalItems = action.payload.totalItems;
        state.currentPage = action.meta.arg.page;
        state.pageSize = action.meta.arg.size;
      })
      .addCase(fetchReturnedGrns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.snackbarMessageGRN = action.payload as string;
        state.snackbarOpenGRN = true;
      })
      .addCase(addGrn.fulfilled, (state, action: PayloadAction<GrnData>) => {
        state.grns.push(action.payload);
      })
      .addCase(updateGrn.fulfilled, (state, action: PayloadAction<GrnData>) => {
        const index = state.grns.findIndex(grn => grn.grnId === action.payload.grnId);
        if (index !== -1) {
          state.grns[index] = action.payload;
        }
      })
      .addCase(updateGrnStatus.fulfilled, (state, action: PayloadAction<GrnData>) => {
        const index = state.grns.findIndex(grn => grn.grnId === action.payload.grnId);
        if (index !== -1) {
          state.grns[index] = action.payload;
        }
      })
      .addCase(updateItemDetails.pending, (state) => {
        state.error = null;
        state.loading = true;
      })
      .addCase(updateItemDetails.fulfilled, (state, action) => {
        const { grnId, itemUpdates, discountPrice } = action.payload;

        // Find and update the specific GRN
        const grn = state.grns.find(grn => grn.grnId === grnId);
        if (grn) {
          grn.itemDetails = itemUpdates; // Update item details
          grn.discountPrice = discountPrice; // Update discount price in the GRN
        }
        state.loading = false;
      })
      .addCase(updateItemDetails.rejected, (state, action) => {
        state.error = null; // Set error message from API
        state.loading = false;
      })
      .addCase(fetchRandomNumbers.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchRandomNumbers.fulfilled, (state, action: PayloadAction<PurchaseRandomId[]>) => {
        state.purchaseorders = action.payload;
      })
      .addCase(fetchRandomNumbers.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to fetch purchase orders';
      })
      .addCase(updateItemStatus.pending, (state) => {
        state.updateStatus = 'loading';
      })
      .addCase(updateItemStatus.fulfilled, (state) => {
        state.updateStatus = 'succeeded';
      })
      .addCase(updateItemStatus.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.error = action.payload as string;
      })
      .addCase(updateGrnCancelStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateGrnCancelStatus.fulfilled, (state, action: PayloadAction<GrnData>) => {
        const updatedGrn = action.payload; // Extract updated GRN data from the payload

        // Find the index of the GRN to be updated
        const index = state.grns.findIndex(grn => grn.grnId === updatedGrn.grnId);

        if (index !== -1) {
          // Update the GRN at the found index with the new data
          state.grns[index] = updatedGrn;
        }

        // Optionally, you can set the status to succeeded or clear any errors
        state.loading = false;
      })
      .addCase(updateGrnCancelStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update GRN status';
      })
      .addCase(returnGrn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(returnGrn.fulfilled, (state, action: PayloadAction<GrnData>) => {
        state.loading = false;
        const index = state.grns.findIndex(grn => grn.grnId === action.payload.grnId);
        if (index !== -1) {
          state.grns[index] = action.payload; // Update the GRN with returned data
          state.snackbarMessageGRN = 'GRN returned successfully';
          state.snackbarOpenGRN = true;
        }
      })
      .addCase(returnGrn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.snackbarMessageGRN = action.payload as string || 'Failed to return GRN';
        state.snackbarOpenGRN = true;
      })
      .addCase(fetchGrnsWithItemStatus.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchGrnsWithItemStatus.fulfilled, (state, action: PayloadAction<GrnData[]>) => {
        state.grns = action.payload;
      })
      .addCase(fetchGrnsWithItemStatus.rejected, (state, action) => {

        state.error = action.payload as string;
      })
   
      .addCase(fetchItemwiseGrns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchItemwiseGrns.fulfilled, (state, action) => {
        state.loading = false;
        state.itemwise = action.payload;  // Update the state with fetched GRNs
      })
      .addCase(fetchItemwiseGrns.rejected, (state, action) => {
        state.loading = false;
      })
      // Handling fetchGrnById thunk lifecycle
      .addCase(fetchGrnById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGrnById.fulfilled, (state, action) => {
        state.selectedGrnId = action.payload; // Set the fetched GRN
        state.loading = false;
      })
      .addCase(fetchGrnById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateInvoiceDetails.pending, (state) => {
        state.updateStatus = 'loading'; // Set loading status
      })
      .addCase(updateInvoiceDetails.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded'; // Set success status
        // Optionally, update state with the response data if needed
      })
      .addCase(updateInvoiceDetails.rejected, (state, action) => {
        state.updateStatus = 'failed'; // Set failed status
      })
      .addCase(fetchDebitCreditNotesByGrn.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchDebitCreditNotesByGrn.fulfilled, (state, action: PayloadAction<DebitCreditNote[]>) => {
      state.loading = false;
      state.debitCreditNotes = action.payload;
      console.log('Updated debitCreditNotes:', action.payload); // Debug log
    })
    .addCase(fetchDebitCreditNotesByGrn.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
      state.snackbarMessageGRN = action.payload as string || 'Failed to fetch DebitCreditNotes';
      state.snackbarOpenGRN = true;
    })

      .addCase(fetchReturnReasons.fulfilled, (state, action: PayloadAction<ReturnReason[]>) => {
        state.loading = false;
        state.returnReasons = action.payload;
      })
      .addCase(fetchReturnReasons.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessageGRN = action.payload as string || 'Failed to fetch return reasons';
        state.snackbarOpenGRN = true;
      })
     .addCase(addReturnReason.fulfilled, (state, action: PayloadAction<ReturnReason>) => {
        state.returnReasons.push(action.payload);
      })
      .addCase(addReturnReason.rejected, (state, action) => {
        state.error = action.payload as string;
        state.snackbarMessageGRN = action.payload as string;
        state.snackbarOpenGRN = true;
      });
  },
});

export const {
  setSelectedGrnId,
  setSearchQuery,
  setView,
  setNewItem,
  setVendors,
  setPurchaseItems,
  setPurchaseOrders,
  setApInvoice,
  setError,
  setLoading,
  clearSnackbarMessage, setSnackbarOpenGRN, setSnackbarMessageGRN, setPagination, setSelectedHeaders,
} = grnSlice.actions;

export const selectCurrentPage = (state: RootState) => state.grn.currentPage;
export const selectPageSize = (state: RootState) => state.grn.pageSize;
export const selectTotalItems = (state: RootState) => state.grn.totalItems;

export const selectGrn = (state: RootState) => state.grn;

export default grnSlice.reducer;
