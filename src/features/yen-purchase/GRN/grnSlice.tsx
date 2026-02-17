import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { format } from 'date-fns';
import { RootState } from '../../../redux/store';
import { GrnData, GrnState, ItemDetail, ItemDetails, Vendor, PurchaseItem, PurchaseOrder, ApInvoice, ReturnGRNRequest, FetchGrnsPayload, FetchGrnsArgs, initialState, DebitCreditNote, FetchGrnsReturnPayload, ReturnReason, RevertGrnToPOResponse, CreateDebitNoteRequest, DebitCreditNoteResponse, AmountDebitNoteResponse, AmountDebitNoteRequest } from '@/Models/grnModel';
import { PurchaseRandomId } from '@/Models/purchaseModel';
import purchaseApi from "@/utils/api";

// Define a specific interface for item updates
export interface ItemUpdate {
  itemId: string;
  befTaxDiscount?: number;
  afTaxDiscount?: number;
  expiryDate?: Date | null;
}
const BASE_URL = 'http://127.0.0.1:8000/purchasetestapi';
const customRoundOf = (value: number) => {
  return Math.round(value * 100) / 100; // Round to two decimal placeshttp://192.168.29.117:8000
};

// Updated thunk - Fix URL to /grn/ (singular) and handle response
export const revertGrnToPO = createAsyncThunk<
  RevertGrnToPOResponse,
  string, // grnId
  { rejectValue: string }
>(
  'grn/revertGrnToPO',
  async (grnId: string, { rejectWithValue }) => {
    try {
      // Fix: Use /grn/ (singular) to match backend prefix
      const response = await purchaseApi.patch<RevertGrnToPOResponse>(
        `/grns/${grnId}/revert`  // Changed from /grns/ to /grn/
      );
      return response.data;
    } catch (error: any) {
      // Enhanced error handling: Log full error for debugging
      console.error('GRN revert error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.detail || 'Failed to revert GRN to PO');
    }
  }
);

// Add these new thunks to your grnSlice.ts
export const createQuantityBasedDebitNote = createAsyncThunk<
  DebitCreditNoteResponse,
  CreateDebitNoteRequest,
  { rejectValue: string }
>(
  'grn/createQuantityBasedDebitNote',
  async (debitNoteData: CreateDebitNoteRequest, { rejectWithValue }) => {
    try {
      console.log('Creating quantity-based debit note:', debitNoteData);

      // Quantity-based endpoint for item-wise returns
      const response = await purchaseApi.post<DebitCreditNoteResponse>(
        `/grns/returnprocess/DebitCreditNote/create`,
        debitNoteData
      );

      console.log('Quantity-based debit note created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Create quantity debit note error:', error);
      return rejectWithValue(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create quantity-based debit note'
      );
    }
  }
);
// Add this thunk to your existing slice
export const createAmountOnlyDebitNote = createAsyncThunk<
  AmountDebitNoteResponse,
  AmountDebitNoteRequest,
  { rejectValue: string }
>(
  'grn/createAmountOnlyDebitNote',
  async (debitNoteData: AmountDebitNoteRequest, { rejectWithValue }) => {
    try {
      console.log('Creating amount-only debit note with data:', debitNoteData);
      console.log('Request URL:', `${BASE_URL}/grns/returnprocess/AmountDebitNote/create`);

      const response = await purchaseApi.post<AmountDebitNoteResponse>(
        `/grns/returnprocess/AmountDebitNote/create`,
        debitNoteData,
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      console.log('Amount-only debit note created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Create amount debit note error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      return rejectWithValue(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create amount-only debit note'
      );
    }
  }
);

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
      const response = await purchaseApi.get<GrnData[]>("/grns/", { params });
      return {
        grns: response.data,
        totalItems: Number(
          response.headers["x-total-count"] ?? response.data.length,
        ),
        hasDebitCreditNotes: response.data.reduce(
          (acc, grn) => {
            acc[grn.grnId] = grn.hasDebitCreditNotes ?? false;
            return acc;
          },
          {} as Record<string, boolean>,
        ),
      };
    } catch (error: any) {
      return Promise.reject(
        error.response?.data?.detail ||
          error.response?.data ||
          "Error fetching GRNs",
      );
    }
  },
);
export const fetchReturnedGrns = createAsyncThunk<
  FetchGrnsReturnPayload,
  FetchGrnsArgs,
  { rejectValue: string }
>(
  'grns/fetchReturned',
  async ({ page, size, fromDate, toDate, vendorName, dateFilterField = 'grnReturnedDate', daysFilterDate }, { rejectWithValue }) => {
    const params: {
      skip?: number;
      limit?: number;
      fromDate?: string;
      toDate?: string;
      vendorName?: string;
      dateFilterField?: string;
      daysFilterDate?: number;
    } = {};

    params.skip = (page - 1) * size;
    params.limit = size;

    if (vendorName) params.vendorName = vendorName;
    if (fromDate) params.fromDate = fromDate.toISOString();
    if (toDate) params.toDate = toDate.toISOString();
    if (dateFilterField) params.dateFilterField = dateFilterField;
    if (daysFilterDate) params.daysFilterDate = daysFilterDate;

     try {
      const response = await purchaseApi.get<GrnData[]>(
        `/grns/returnprocess/Grnwise`,
        { params },
      );
      return {
        grns: response.data,
        totalItems: Number(
          response.headers["x-total-count"] ?? response.data.length,
        ),
        hasDebitCreditNotes: response.data.reduce(
          (acc, grn) => {
            acc[grn.grnId] =
              grn.hasDebitCreditNotes ??
              (grn.totalDebitAmount != null && grn.totalDebitAmount > 0);
            return acc;
          },
          {} as Record<string, boolean>,
        ),
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || "Error fetching returned GRNs",
      );
    }
  },
);

export const fetchItemwiseGrns = createAsyncThunk(
  'grn/fetchItemwiseGrns',
  async () => {
     try {
      const response = await purchaseApi.get(`/grns/getOutgoing/itemwise`);
      return response.data; // Returning the itemwise GRNs
    } catch (error) {
      console.error("Failed to fetch itemwise GRNs:", error);
      throw new Error("Failed to fetch itemwise GRNs");
    }
  },
);
export const fetchGrnById = createAsyncThunk(
  "grn/fetchById",
  async (grnId: string) => {
    const response = await purchaseApi.get(`/grns/${grnId}`);
    return response.data; // Returning the GRN details
  },
);
export const addGrn = createAsyncThunk(
  "grn/addGrn",
  async (grn: GrnData, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.post(`/grns`, grn);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to add GRN");
    }
  },
);

export const updateGrn = createAsyncThunk(
  "grn/updateGrn",
  async (grn: GrnData, { rejectWithValue }) => {
    try {
      const updatedGrn = { ...grn };
      const response = await purchaseApi.patch(
        `/grns/${grn.grnId}`,
        updatedGrn,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to update GRN");
    }
  },
);
// Thunk to update the invoice details
export const updateInvoiceDetails = createAsyncThunk(
  "grn/updateInvoiceDetails",
  async (
    payload: { grnId: string; invoiceDate?: string; invoiceNo?: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await purchaseApi.patch(
        `/grns/invoiceupdate/${payload.grnId}`,
        null,
        {
          params: {
            invoiceNo: payload.invoiceNo,
            invoiceDate: payload.invoiceDate,
          },
        },
      );
      return response.data;
    } catch (error: any) {
      // Handle errors and return the error response data
      return rejectWithValue(error.response?.data || error.message);
    }
  },
);


export const updateGrnStatus = createAsyncThunk(
  "grn/updateGrnStatus",
  async (
    { grnId, status }: { grnId: string; status: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await purchaseApi.patch(`/grns/${grnId}`, { status });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to update GRN");
    }
  },
);

// // Define a utility function to calculate discount
// const calculateDiscount = (amount: number, discountRate: number) => {
//   return discountRate ? (amount * discountRate) / 100 : 0;
// };

// In your grnSlice.ts
export const updateItemDetails = createAsyncThunk(
  "grn/updateItemDetails",
  async (
    {
      grnId,
      apRoundOff,
      itemUpdates,
      apInvoiceDate,
      outgoingDate,
    }: {
      grnId: string;
      apRoundOff: number;
      itemUpdates: ItemUpdate[];
      apInvoiceDate?: string;
      outgoingDate?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const response = await purchaseApi.patch(
        `/grns/convert-to-ap/ap-to-outgoing/${grnId}`,
        itemUpdates,
        {
          params: {
            apRoundOff,
            apInvoiceDate,
            outgoingDate,
          },
        },
      );

      return {
        grnId,
        itemUpdates: response.data.updatedItems,
        apRoundOff,
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
      console.error("Update item details error:", error);
       console.log("🔥 FULL ERROR OBJECT:", error);
  console.log("🔥 ERROR RESPONSE:", error?.response);
  console.log("🔥 ERROR STATUS:", error?.response?.status);
  console.log("🔥 ERROR DATA:", error?.response?.data);
  console.log("🔥 ERROR DETAIL:", error?.response?.data?.detail);
      return rejectWithValue(
        error.response?.data || "Failed to update item details",
      );
    }
  },
);
export const fetchGrnsWithItemStatus = createAsyncThunk<
  GrnData[],
  string, // status
  { rejectValue: string }
>("grn/fetchGrnsWithItemStatus", async (status, { rejectWithValue }) => {
  try {
    const response = await purchaseApi.get(`/api/grns/items/status/${status}`);
    return response.data;
  } catch (error) {
    return rejectWithValue(
      "Failed to fetch GRNs with the specified item status.",
    );
  }
});

export const fetchRandomNumbers = createAsyncThunk(
  "invoiceNumbers/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get<PurchaseRandomId[]>(
        "/purchaseorders/getByRandomId",
      );
      return response.data; // List of invoice numbers
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data || "Failed to fetch invoice numbers",
      );
    }
  },
);
export const fetchReturnReasons = createAsyncThunk(
  "grn/fetchReturnReasons",
  async (_, { rejectWithValue }) => {
    try {
      console.log("Fetching return reasons...");
      const response = await purchaseApi.get<ReturnReason[]>(
        "/grns/getgrn/return-reasons",
      );
      console.log("Return reasons fetched:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("Fetch return reasons error:", error);
      return rejectWithValue(
        error.response?.data?.detail || "Failed to fetch return reasons",
      );
    }
  },
);
export const addReturnReason = createAsyncThunk(
  "grn/addReturnReason",
  async (reason: string, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.post(
        "/purchaseapi/grns/return-reasons",
        { reason },
      );
      return response.data.reason;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || "Failed to add return reason",
      );
    }
  },
);
export const returnGrn = createAsyncThunk(
  "grn/returnGrn",
  async (
    payload: { grnId: string; returnData: ReturnGRNRequest },
    { rejectWithValue },
  ) => {
    try {
      const response = await purchaseApi.patch(
        `/grns/${payload.grnId}/return`,
        payload.returnData,
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || "Failed to return GRN",
      );
    }
  },
);

export const fetchDebitCreditNotesByGrn = createAsyncThunk<
  DebitCreditNote[],
  { grnId: string; page: number; size: number },
  { rejectValue: string }
>(
  "grn/fetchDebitCreditNotesByGrn",
  async ({ grnId, page, size }, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get<DebitCreditNote[]>(
        `/grns/returnprocess/DebitCreditNote/by-document/${grnId}`,
        {
          params: {
            skip: (page - 1) * size,
            limit: size,
          },
        },
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || "Error fetching Debit/Credit Notes",
      );
    }
  },
);

// Add these thunks to your existing slice
export const createAmountDebitNote = createAsyncThunk<
  AmountDebitNoteResponse,
  AmountDebitNoteRequest,
  { rejectValue: string }
>(
  'grn/createAmountDebitNote',
  async (debitNoteData: AmountDebitNoteRequest, { rejectWithValue }) => {
    try {
      console.log('Creating amount-only debit note:', debitNoteData);

      const response = await purchaseApi.post<AmountDebitNoteResponse>(
        `/grns/returnprocess/AmountDebitNote/create`,
        debitNoteData
      );

      console.log('Amount-only debit note created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Create amount debit note error:', error);
      return rejectWithValue(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create amount-only debit note'
      );
    }
  }
);

export const createDebitCreditNote = createAsyncThunk<
  DebitCreditNoteResponse,
  CreateDebitNoteRequest,
  { rejectValue: string }
>(
  'grn/createDebitCreditNote',
  async (debitNoteData: CreateDebitNoteRequest, { rejectWithValue }) => {
    try {
      console.log('Creating quantity-based debit note:', debitNoteData);

      const response = await purchaseApi.post<DebitCreditNoteResponse>(
        `/grns/returnprocess/DebitCreditNote/create`,
        debitNoteData
      );

      console.log('Quantity-based debit note created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Create debit credit note error:', error);
      return rejectWithValue(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create debit/credit note'
      );
    }
  }
);

// Update your existing fetchDebitCreditNotesByGrn to handle both types
export const fetchDebitCreditNotesByDocument = createAsyncThunk<
  DebitCreditNote[],
  {
    documentId: string;
    page: number;
    size: number;
    documentType?: 'grn' | 'ap_invoice' | 'outgoing_payment';
  },
  { rejectValue: string }
>(
  'grn/fetchDebitCreditNotesByDocument',
  async ({ documentId, page, size, documentType = 'grn' }, { rejectWithValue }) => {
    try {
      // This endpoint can fetch both types of notes
      const response = await purchaseApi.get<DebitCreditNote[]>(
        `/grns/returnprocess/DebitCreditNote/by-document/${documentId}`,
        {
          params: {
            skip: (page - 1) * size,
            limit: size
          },
        }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail ||
        'Error fetching debit/credit notes'
      );
    }
  }
);


export const updateGrnCancelStatus = createAsyncThunk(
  "grns/updateStatus",
  async (grnId: string, { rejectWithValue }) => {
    try {
      // Send the PATCH request to update the GRN status
      const response = await purchaseApi.patch(`/purchaseapi/grns/${grnId}`, {
        status: "active",
      });

      return response.data; // Ensure this contains the updated GRN object
    } catch (error: any) {
      // Handle error by returning a rejected value with an error message
      return rejectWithValue(error.response?.data || "Failed to update status");
    }
  },
);
export const updateItemStatus = createAsyncThunk(
  "itemStatus/updateItemStatus",
  async (
    {
      grnId,
      items,
    }: { grnId: string; items: { itemId: string; status: string }[] },
    { rejectWithValue },
  ) => {
    try {
      // Create an object mapping item IDs to their statuses
      const statusUpdateObject = items.reduce(
        (acc, { itemId, status }) => {
          acc[itemId] = status; // Add itemId as key and status as value
          return acc;
        },
        {} as Record<string, string>,
      );

      // Send the object in the request body
      const response = await purchaseApi.patch(
        `/grns/${grnId}/items/status`,
        statusUpdateObject,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      return response.data; // Return the response data upon success
    } catch (err: any) {
      return rejectWithValue(err.response.data); // Handle errors
    }
  },
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
      // In your extraReducers
      .addCase(updateItemDetails.pending, (state) => {
        state.error = null;
        state.loading = true;
      })
      .addCase(updateItemDetails.fulfilled, (state, action) => {
        const { grnId, itemUpdates, apRoundOff } = action.payload;

        // Find and update the specific GRN
        const grn = state.grns.find(grn => grn.grnId === grnId);
        if (grn) {
          grn.itemDetails = itemUpdates; // Update item details
          grn.apRoundOff = apRoundOff; // Update AP round off in the GRN
        }
        state.loading = false;
      })
      .addCase(updateItemDetails.rejected, (state, action) => {
        state.error = action.payload as string; // Set error message from API
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
      })
      .addCase(revertGrnToPO.pending, (state) => {
        state.revertLoading = true;
        state.revertError = null;
      })
      .addCase(revertGrnToPO.fulfilled, (state, action: PayloadAction<RevertGrnToPOResponse>) => {
        state.revertLoading = false;
        state.revertError = null;

        // Update the GRN status in the local state
        const grnIndex = state.grns.findIndex(grn => grn.grnId === action.payload.grnId);
        if (grnIndex !== -1) {
          state.grns[grnIndex].status = 'ReturnedPO';
        }

        state.snackbarMessageGRN = action.payload.message;
        state.snackbarOpenGRN = true;

        console.log('GRN reverted to PO:', action.payload);
      })
      .addCase(revertGrnToPO.rejected, (state, action) => {
        state.revertLoading = false;
        state.revertError = action.payload as string;
        state.snackbarMessageGRN = action.payload as string || 'Failed to revert GRN to PO';
        state.snackbarOpenGRN = true;
      })
      .addCase(createAmountDebitNote.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAmountDebitNote.fulfilled, (state, action: PayloadAction<AmountDebitNoteResponse>) => {
        state.loading = false;
        state.snackbarMessageGRN = 'Amount-only debit note created successfully';
        state.snackbarOpenGRN = true;

        // Optionally update the GRN's hasDebitCreditNotes flag
        const grnIndex = state.grns.findIndex(grn => grn.grnId === action.payload.grnId);
        if (grnIndex !== -1) {
          state.grns[grnIndex].hasDebitCreditNotes = true;
        }
      })
      .addCase(createAmountDebitNote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.snackbarMessageGRN = action.payload as string || 'Failed to create amount-only debit note';
        state.snackbarOpenGRN = true;
      })

      .addCase(createAmountOnlyDebitNote.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAmountOnlyDebitNote.fulfilled, (state, action: PayloadAction<AmountDebitNoteResponse>) => {
        state.loading = false;
        state.snackbarMessageGRN = action.payload.message;
        state.snackbarOpenGRN = true;

        console.log('Amount debit note created:', action.payload);
      })
      .addCase(createAmountOnlyDebitNote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;

        // Handle validation errors
        const errorData = action.payload;
        if (typeof errorData === 'string') {
          try {
            // Try to parse as JSON if it contains structured error
            const parsedError = JSON.parse(errorData);
            state.snackbarMessageGRN = parsedError.message || 'Failed to create amount-only debit note';
          } catch {
            state.snackbarMessageGRN = errorData;
          }
        } else {
          state.snackbarMessageGRN = 'Failed to create amount-only debit note';
        }
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
