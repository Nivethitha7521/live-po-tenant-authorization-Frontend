import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';
import { format } from 'date-fns';
import { initialState, PhotoResponse, PhotosResponse, Item, PurchaseInvoice, PurchaseOrderData, PurchaseRandomId, UploadResponse } from '@/Models/purchaseModel';
import { GrnData } from '@/Models/grnModel';
import { OverallDiscountRequest, OverallDiscountResponse } from '@/app/yen-purchase/PurchaseOrder/Models/Itemcalculation';
import { FreightData } from '@/app/yen-purchase/PurchaseOrder/Component/freightSelectionDialog';
import purchaseApi from "@/utils/api";


const LIMIT = 20;
const API_BASE_URL = 'https://yenerp.com/purchasetestapi';

export const fetchPurchaseOrderRandomIds = createAsyncThunk(
  "purchaseOrder/fetchRandomIds",
  async (
    { skip, query }: { skip: number; query: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await purchaseApi.get<PurchaseRandomId[]>(
        "purchaseorders/getRandomId",
        {
          params: {
            random_id: query || undefined,
            skip,
            limit: LIMIT,
          },
        },
      );

      return {
        data: response.data,
        skip,
        query,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data || "Failed to fetch purchase order random IDs",
      );
    }
  },
);
const formatDate = (date: Date): string => {
  return format(date, "dd/MM/yyyy"); // Format as day/month/year
};
const customRound = (value: number) => {
  return Math.round(value * 100) / 100; // Round to two decimal places
};
function customRoundOff(value: number): number {
  // Extract the decimal part to check if it's .5 or above
  const decimalPart = value % 1;

  // If decimal part is 0.5 or above, round up; otherwise, round down
  if (decimalPart >= 0.5) {
    return Math.ceil(value); // Round up to the nearest whole number
  } else {
    return Math.floor(value); // Round down to the nearest whole number
  }
}
// // Custom rounding function to achieve the desired behavior
// function customRoundOf(value: number): number {
//   // Multiply by 100 to work with two decimal places
//   const multipliedValue = value * 100;

//   // If the decimal part is 0.50 or more, round up; otherwise, round down
//   if (multipliedValue % 1 >= 0.50) {
//     return Math.ceil(value); // Round up
//   } else {
//     return Math.floor(value); // Round down
//   }
// }

export const fetchPurchaseOrders = createAsyncThunk(
  'purchaseOrders/fetch',
  async ({
    page,
    size,
    status = '',
    fromDate,
    toDate,
    vendorName,
    itemName,
    randomId,
    dateField = 'orderDate'
  }: {
    page: number;
    size: number;
    status?: string;
    fromDate?: string | Date;
    toDate?: string | Date;
    vendorName?: string;
    itemName?: string;
    randomId?: string;
    dateField?: 'orderDate' | 'approvedDate' | 'rejectedDate';
  }) => {

    try {

      const params: {
        skip?: number;
        limit?: number;
        status?: string;
        fromDate?: string;
        toDate?: string;
        vendorName?: string;
        itemName?: string;
        randomId?: string;
        filterBy?: string;
      } = {};

      // Pagination
      params.skip = (page - 1) * size;
      params.limit = size;

      // Filters
      if (status) params.status = status;
      if (vendorName) params.vendorName = vendorName;
      if (itemName) params.itemName = itemName;
      if (randomId) params.randomId = randomId;

      // Date filters
      if (fromDate) {
        const fromDateObj =
          typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
        params.fromDate = fromDateObj.toISOString();
      }

      if (toDate) {
        const toDateObj =
          typeof toDate === 'string' ? new Date(toDate) : toDate;
        params.toDate = toDateObj.toISOString();
      }

      // Filter field
      if (dateField) params.filterBy = dateField;

      const response = await purchaseApi.get("/purchaseorders/", { params });
      return response.data;

    } catch (error: any) {

      console.error('Error fetching purchase orders:', error);
      throw error;

    }
  }
);

export const fetchPendingPurchaseOrders = createAsyncThunk(
  'pendingPurchaseOrders/fetch',
  async ({
    page,
    size,
    fromDate,
    toDate,
    vendorName,
    itemName,
    randomId,
  }: {
    page: number;
    size: number;
    fromDate?: string | Date;  // Allow both string and Date
    toDate?: string | Date;    // Allow both string and Date
    vendorName?: string;
    itemName?: string;
    randomId?: string;
  }) => {
    const params: {
      skip?: number;
      limit?: number;
      fromDate?: string;
      toDate?: string;
      vendorName?: string;
      itemName?: string;
      randomId?: string;
    } = {};

    // Pagination
    params.skip = (page - 1) * size;
    params.limit = size;

    // Filters (no status or filterBy needed—backend handles pending and orderDate automatically)
    if (vendorName) params.vendorName = vendorName;
    if (itemName) params.itemName = itemName;
    if (randomId) params.randomId = randomId;

    // Handle date conversion - convert string dates to Date objects if needed
    if (fromDate) {
      const fromDateObj = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
      params.fromDate = fromDateObj.toISOString();
    }
    
    if (toDate) {
      const toDateObj = typeof toDate === 'string' ? new Date(toDate) : toDate;
      params.toDate = toDateObj.toISOString();
    }

    try {
      const response = await purchaseApi.get('/purchaseorders/pending/purchase', {
        params,
      });

      if (response.data.purchaseOrders.length === 0) {  // Assuming response structure with purchaseOrders array
        return [];  // Return empty array if no data
      }

      console.log('Fetched pending purchase orders:', response.data);
      return response.data.purchaseOrders;  // Return the array directly for consistency
    } catch (error: any) {
      console.error('Error fetching pending purchase orders:', error);
      return { errorMessage: 'Error fetching pending purchase orders. Please try again.' };
    }
  }
);
// Async thunk to fetch all purchase orders
export const fetchAllPurchaseOrders = createAsyncThunk(
  "purchaseOrders/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get<PurchaseOrderData[]>(
        "/purchaseorders/getAll",
      );
      return response.data; // List of purchase orders
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data || "Failed to fetch purchase orders",
      );
    }
  },
);
export const fetchInvoiceNumbers = createAsyncThunk(
  "invoiceNumbers/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get<PurchaseInvoice[]>(
        "/purchaseorders/getByInvoiceNo",
      );
      return response.data; // List of invoice numbers
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data || "Failed to fetch invoice numbers",
      );
    }
  },
);

// Define an async thunk to deactivate a purchase order
export const deactivatePurchaseOrder = createAsyncThunk(
  "purchaseList/deactivate",
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {
      // Make sure that purchaseOrderId is a valid string
      if (!purchaseOrderId) throw new Error("Invalid purchase order ID");

      // Send a PATCH request to update the poStatus to "deactivated"
      await purchaseApi.patch(
        `/purchaseorders/${purchaseOrderId}`,
        { poStatus: "deactivated" },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      return purchaseOrderId;
    } catch (error: any) {
      console.error("Error deactivating purchase order:", error);
      return rejectWithValue("Failed to deactivate purchase order");
    }
  },
);

export const updatePurchaseOrder = createAsyncThunk(
  "purchaseOrders/update",
  async ({
    purchaseOrderId,
    purchaseOrder,
  }: {
    purchaseOrderId: string;
    purchaseOrder: Partial<PurchaseOrderData>;
  }) => {
    try {
      const response = await purchaseApi.patch(
        `/purchaseorders/${purchaseOrderId}`,
        purchaseOrder,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;

    } catch (error: any) {
      console.error("Failed to update purchase order:", error);
      throw error;
    }
  }
);

export const updatePurchaseOrderStatusToPending = createAsyncThunk(
  "purchaseOrders/updateStatusToPending",
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(
        `/purchaseorders/${purchaseOrderId}`,
        { poStatus: "Pending" },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      return response.data; // Return the updated purchase order data
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data || "Failed to update purchase order status",
      );
    }
  },
);
export const approvePurchaseOrder = createAsyncThunk(
  'purchaseOrders/approve',
  async (
    payload: { purchaseOrderId: string },
    { rejectWithValue }
  ) => {
    const { purchaseOrderId } = payload;

    try {
      console.log(`[Thunk] Approving PO: ${purchaseOrderId}`);

      // Always use the SMS/WhatsApp endpoint
      const url = `/purchaseorders/approved/${purchaseOrderId}`;

      const response = await purchaseApi.patch(
        url,
        {},
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("[Thunk] Approval response:", response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[Thunk] Error approving PO ${purchaseOrderId}:`, error);
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to approve purchase order"
      );
    }
  }
);

export const rejectPurchaseOrder = createAsyncThunk(
  "purchaseOrders/reject",
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(
        `/purchaseorders/rejected/${purchaseOrderId}`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data || "Failed to reject purchase order",
      );
    }
  },
);

// Async thunk action to update multiple items
export const updateMultipleItemQuantities = createAsyncThunk(
  "purchaseOrders/updateMultipleItemQuantities",
  async (
    params: {
      purchaseOrderId: string;
      updatedItems: { itemId: string; updatedItem: Partial<Item> }[];
    },
    { rejectWithValue },
  ) => {
    try {
      const items = params.updatedItems.map((item) => ({
        itemId: item.itemId,
        ...item.updatedItem,
      }));

      const response = await purchaseApi.patch(
        `/purchaseorders/${params.purchaseOrderId}/items`,
        { items },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to update items");
    }
  },
);

export const fetchPoById = createAsyncThunk(
  "po/fetchPoById",
  async (poId: string, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get(`/poimport/getOutgoing/${poId}`);
      const data = response.data;
      return {
        ...data,
        orderDate: data.orderDate || null,
      };
    } catch (error: any) {
      console.error("Failed to fetch PO details:", error);
      return rejectWithValue(
        error.response?.data || "Failed to fetch PO details",
      );
    }
  },
);
// In purchaseListSlice.ts - updateReceivedDamagedQuantities thunk
export const updateReceivedDamagedQuantities = createAsyncThunk(
  "purchaseOrder/updateReceivedDamagedQuantities",
  async (
    params: {
      purchaseOrderId: string;
      items: Array<{
        itemId: string;
        receivedQuantity: number;
        befTaxDiscount: number;
        afTaxDiscount: number;
        expiryDate: string | null; // Change to string
        grnPrice?: number;
      }>;
      invoiceNo: string;
      invoiceDate: Date | null;
      grnDate: Date | null;
      discountPrice: number;
      grnRoundOffAmount?: number;
      freights?: any[];
    },
    { rejectWithValue },
  ) => {
    try {
      if (!params.purchaseOrderId) {
        throw new Error("purchaseOrderId is required");
      }

      // Format dates to ISO strings
      const requestData = {
        grnDate: params.grnDate ? params.grnDate.toISOString() : null,
        invoiceDate: params.invoiceDate ? params.invoiceDate.toISOString() : null,
        invoiceNo: params.invoiceNo,
        discountPrice: params.discountPrice,
        grnRoundOffAmount: params.grnRoundOffAmount || 0,
        items: params.items.map((item) => ({
          itemId: item.itemId,
          receivedQuantity: item.receivedQuantity,
          damagedQuantity: 0,
          befTaxDiscount: item.befTaxDiscount,
          afTaxDiscount: item.afTaxDiscount,
          expiryDate: item.expiryDate, // Already string
          grnPrice: item.grnPrice,
        })),
        freights: params.freights || [], // Include freights array
      };

      console.log("Sending request data:", requestData); // Add logging

      const response = await purchaseApi.patch(
        `/purchaseorders/receivedupdates/${params.purchaseOrderId}`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error("Error in updateReceivedDamagedQuantities:", error);
      console.error("Error response:", error.response?.data);
      return rejectWithValue(
        error.response?.data || error.message || "Failed to update purchase order",
      );
    }
  },
);
// Updated async thunks
export const uploadPurchaseOrderPhotos = createAsyncThunk<
  UploadResponse,
  { purchaseOrderId: string; files: File[]; index?: number }
>(
  "purchaseOrders/uploadPhotos",
  async ({ purchaseOrderId, files, index }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      if (index !== undefined) formData.append("index", index.toString());

      const response = await purchaseApi.post<UploadResponse>(
        `/purchaseorders/upload/${purchaseOrderId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Upload failed");
    }
  },
);
// Fetch a specific image by index
export const fetchImageByIndex = createAsyncThunk(
  "photos/fetchPhotoByIndex",
  async (
    { purchaseOrderId, index }: { purchaseOrderId: string; index: number },
    { rejectWithValue },
  ) => {
    try {
      const backendIndex = index + 1;
      const response = await purchaseApi.get<PhotoResponse>(
        `/purchaseorders/view/${purchaseOrderId}/${backendIndex}`,
      );

      const timestamp = new Date().getTime();
      const imageUrl = `${response.data.imageUrl}?t=${timestamp}`;

      return {
        imageUrl,
        purchaseOrderId,
        index,
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Error fetching photo");
    }
  },
);
// Fetch all images for a purchase order
export const fetchAllImages = createAsyncThunk(
  "photos/fetchAllPhotos",
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get<PhotosResponse>(
        `/purchaseorders/view-all/${purchaseOrderId}`,
      );
      return { purchaseOrderId, imageUrls: response.data.imageUrls };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Fetch failed");
    }
  },
);

export const editPhotoByIndex = createAsyncThunk(
  "purchaseOrders/editPhoto",
  async (
    {
      purchaseOrderId,
      index,
      file,
    }: {
      purchaseOrderId: string;
      index: number;
      file: File;
    },
    { rejectWithValue },
  ) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await purchaseApi.patch(
        `/purchaseorders/edit/${purchaseOrderId}/${index}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return {
        message: response.data.message,
        purchaseOrderId,
        index: index - 1, // Convert to 0-based for frontend
        imageUrl: response.data.imageUrl,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data || "Failed to edit the photo",
      );
    }
  },
);

// New thunk for overall discount
export const calculateOverallDiscount = createAsyncThunk<
  OverallDiscountResponse,  // Return type
  OverallDiscountRequest,   // Arg type (define similarly if needed)
  { rejectValue: string }
>(
  'purchase/calculateOverallDiscount',
  async (request, { rejectWithValue }) => {
    try {
       const response = await purchaseApi.post(
        `/purchaseorders/items/grn/calculate-overall-discount`,
        request,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'API Error');
    }
  }
);
// Create the slice
const purchaseListSlice = createSlice({
  name: 'purchaseList',
  initialState,
  reducers: {
    setSearchQueryItem: (state, action) => {
      state.searchQueryItem = action.payload; // Update the search query
    },
    setPoRandomIds: (state, action) => {
      state.poRandomIds = action.payload; // Set poRandomIds
    },
    setSelectedOrder(state, action: PayloadAction<PurchaseOrderData | null>) {
      state.selectedOrder = action.payload;
    },
    clearSelectedOrder: (state) => {
      state.selectedOrder = null;
    },
    addGrn: (state, action: PayloadAction<GrnData>) => {
      state.grnList.push(action.payload);
    },
    updateInvoiceDetails(state, action: PayloadAction<{ invoiceNo: string; invoiceDate: string }>) {
      if (state.selectedOrder) {
        state.selectedOrder.invoiceNo = action.payload.invoiceNo;
        state.selectedOrder.invoiceDate = action.payload.invoiceDate;
      }
    },
    setSelectedImageIndex: (state, action: PayloadAction<number | null>) => {
      state.selectedImageIndex = action.payload;
    },
    setOrderImageUrls: (state, action: PayloadAction<{ orderId: string; urls: string[] }>) => {
      const { orderId, urls } = action.payload;
      state.imageUrls[orderId] = urls;
    },
    setImageUrls: (state, action: PayloadAction<{ purchaseOrderId: string; imageUrls: string[] }>) => {
      const { purchaseOrderId, imageUrls } = action.payload;
      state.imageUrls[purchaseOrderId] = imageUrls;
    },
    markOrderImagesFetched: (state, action: PayloadAction<string>) => {
      if (!state.fetchedPurchaseOrderIds.includes(action.payload)) {
        state.fetchedPurchaseOrderIds.push(action.payload);
      }
    },
    clearImageState: (state, action: PayloadAction<string>) => {
      delete state.imageUrls[action.payload];
      // Instead of using .delete() method
      state.fetchedPurchaseOrderIds = state.fetchedPurchaseOrderIds.filter(id => id !== action.payload);
    },
    setSnackbarOpen: (state, action: PayloadAction<boolean>) => {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage: (state, action: PayloadAction<string>) => {
      state.snackbarMessage = action.payload;
    },
    clearSnackbarMessage(state) {
      state.snackbarMessage = '';
      state.snackbarOpen = false; // Close the snackbar when clearing the message
    },
    setPagination: (state, action: PayloadAction<{ page: number; size: number }>) => {
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.size;
    },
    setRandomQueryItem: (state, action: PayloadAction<string>) => {
      const query = action.payload;

      // Only reset if the query is different
      if (state.searchQuery !== query) {
        state.searchQuery = query;
        state.page = 0;
        state.randomIds = []; // Clear previous results
        state.hasMore = true;

        // Add to previous searches if not already there and not empty
        if (query && !state.previousSearches.includes(query)) {
          state.previousSearches = [query, ...state.previousSearches].slice(0, 5);
        }
      }
    },
    resetRandomIds: (state) => {
      state.randomIds = [];
      state.hasMore = true;
      state.searchQuery = '';
    },
    resetPurchaseOrderState: (state) => {
      return { ...initialState, previousSearches: state.previousSearches };
    },
    
    setPoDialogOpen: (state, action) => {
      state.poDialogOpen = action.payload;
    },
    setSelectedPo: (state, action) => {
      state.selectedPo = action.payload;
    },

  },
  extraReducers: (builder) => {
    builder
      .addCase(updatePurchaseOrder.pending, (state) => {
        state.loading = true;
      })
      .addCase(updatePurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        // Update the purchase order in the list
        const updatedOrder = action.payload;
        const orderIndex = state.purchaseList.findIndex(order => order.purchaseOrderId === updatedOrder.purchaseOrderId);
        if (orderIndex !== -1) {
          state.purchaseList[orderIndex] = updatedOrder;
        }
      })
      .addCase(updatePurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update purchase order';
      })
      // .addCase(updateOrderAndConvertToGrn.pending, (state) => {
      //   state.loading = true;
      // })
      // .addCase(updateOrderAndConvertToGrn.fulfilled, (state, action) => {
      //   state.loading = false;
      //   // Add the created GRN to the list
      //   state.grnList.push(action.payload);
      //   // Optionally, update the purchaseList to reflect GRN conversion
      //   const orderIndex = state.purchaseList.findIndex(order => order.purchaseOrderId === action.payload.purchaseOrderId);
      //   if (orderIndex !== -1) {
      //     state.purchaseList[orderIndex] = {
      //       ...state.purchaseList[orderIndex],
      //     };
      //   }
      // })
      // .addCase(updateOrderAndConvertToGrn.rejected, (state, action) => {
      //   state.loading = false;
      //   state.error = action.error.message || 'Failed to update order and convert to GRN';
      // })
      .addCase(updateMultipleItemQuantities.pending, (state) => {
        state.loading = true; // Set loading state to true
        state.error = null; // Reset error
      })
      .addCase(updateMultipleItemQuantities.fulfilled, (state, action) => {
        state.loading = false; // Set loading to false on success
        state.purchaseList = state.purchaseList.map(order => {
          if (order.purchaseOrderId === action.payload.purchaseOrderId) {
            return action.payload; // Update the order with the new data
          }
          return order; // Return other orders unchanged
        });
      })
      .addCase(updateMultipleItemQuantities.rejected, (state, action) => {
        state.loading = false; // Set loading to false on failure
        state.error = action.payload as string; // Set error message
      })
      .addCase(updateReceivedDamagedQuantities.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateReceivedDamagedQuantities.fulfilled, (state, action) => {
        state.loading = false;
        const updatedOrder = action.payload;
        console.log('Updated Order from Backend:', updatedOrder); // Log the updated order
        const orderIndex = state.purchaseList.findIndex(order => order.purchaseOrderId === updatedOrder.purchaseOrderId);
        if (orderIndex !== -1) {
          state.purchaseList[orderIndex] = updatedOrder;
        }
      })
      // Handle rejected state for updating received and damaged quantities
      .addCase(updateReceivedDamagedQuantities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string; // Capture the error message
      })
      .addCase(updatePurchaseOrderStatusToPending.fulfilled, (state, action) => {
        state.loading = false;
        const updatedOrder = action.payload;
        const orderIndex = state.purchaseList.findIndex(order => order.purchaseOrderId === updatedOrder.purchaseOrderId);
        if (orderIndex !== -1) {
          // Update the purchase order in the state
          state.purchaseList[orderIndex] = updatedOrder;
        }
      })
      .addCase(updatePurchaseOrderStatusToPending.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update purchase order status'; // Use payload for a more specific error message
      })
      .addCase(approvePurchaseOrder.pending, (state) => {
        state.loading = true;
        state.error = null; // Clear previous errors when starting a new request
      })
      .addCase(approvePurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        const updatedOrder = action.payload;
        const orderIndex = state.purchaseList.findIndex(order => order.purchaseOrderId === updatedOrder.purchaseOrderId);
        if (orderIndex !== -1) {
          // Update the purchase order in the state
          state.purchaseList[orderIndex] = updatedOrder;
        }
      })
      .addCase(approvePurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to approve purchase order'; // Use payload for a more specific error message
      })
      .addCase(rejectPurchaseOrder.pending, (state) => {
        state.loading = true;
        state.error = null; // Clear previous errors when starting a new request
      })
      .addCase(rejectPurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        const updatedOrder = action.payload;
        const orderIndex = state.purchaseList.findIndex(order => order.purchaseOrderId === updatedOrder.purchaseOrderId);
        if (orderIndex !== -1) {
          // Update the purchase order in the state
          state.purchaseList[orderIndex] = updatedOrder;
        }
      })
      .addCase(rejectPurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to reject purchase order'; // Use payload for a more specific error message
      })
      .addCase(fetchAllPurchaseOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllPurchaseOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.purchaseOrders = action.payload;
      })
      .addCase(fetchAllPurchaseOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchInvoiceNumbers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInvoiceNumbers.fulfilled, (state, action) => {
        state.loading = false;
        state.purchaseinvoice = action.payload;
      })
      .addCase(fetchInvoiceNumbers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(uploadPurchaseOrderPhotos.fulfilled, (state, action) => {
        const { purchaseOrderId } = action.meta.arg;
        const uploadedPhotos = action.payload.uploaded_photos;

        if (!state.imageUrls[purchaseOrderId]) {
          state.imageUrls[purchaseOrderId] = [];
        }

        uploadedPhotos.forEach(photo => {
          // Ensure array is long enough
          while (state.imageUrls[purchaseOrderId].length <= photo.index) {
            state.imageUrls[purchaseOrderId].push('');
          }
          state.imageUrls[purchaseOrderId][photo.index] = photo.ftp_path;
        });

        state.uploadStatus = 'succeeded';
      })
      .addCase(fetchAllImages.fulfilled, (state, action) => {
        const { purchaseOrderId, imageUrls } = action.payload;
        state.imageUrls[purchaseOrderId] = imageUrls;
        // Instead of using .add() method
        if (!state.fetchedPurchaseOrderIds.includes(purchaseOrderId)) {
          state.fetchedPurchaseOrderIds.push(purchaseOrderId);
        }
      })
      .addCase(fetchImageByIndex.fulfilled, (state, action) => {
        const { purchaseOrderId, index, imageUrl } = action.payload;

        if (!state.imageUrls[purchaseOrderId]) {
          state.imageUrls[purchaseOrderId] = [];
        }

        // Store with 0-based index
        state.imageUrls[purchaseOrderId][index] = imageUrl;
      })
      // Handle edit photo by index
      .addCase(editPhotoByIndex.pending, (state) => {
        state.uploadStatus = 'loading';
        state.uploadError = null;
      })
      .addCase(editPhotoByIndex.fulfilled, (state, action) => {
        state.uploadStatus = 'succeeded';
        state.snackbarMessage = action.payload.message;
        state.snackbarOpen = true;

        // Update the specific image URL
        const { purchaseOrderId, index } = action.payload;
        if (state.imageUrls[purchaseOrderId] && state.imageUrls[purchaseOrderId][index]) {
          // Trigger a refetch of the updated image
          // You might want to dispatch fetchImageByIndex here
        }
      })
      .addCase(editPhotoByIndex.rejected, (state, action) => {
        state.uploadStatus = 'failed';
        state.uploadError = action.payload as string || 'An error occurred while editing the photo';
        state.snackbarMessage = state.uploadError;
        state.snackbarOpen = true;
      })
      .addCase(deactivatePurchaseOrder.pending, (state) => {
        state.loading = true;
        state.error = null; // Reset any previous errors
      })
      .addCase(deactivatePurchaseOrder.fulfilled, (state, action) => {
        state.loading = false;
        // Filter out the deleted purchase order by comparing the purchaseOrderId
        state.purchaseList = state.purchaseList.filter(
          (po) => po.purchaseOrderId !== action.meta.arg // action.meta.arg holds the purchaseOrderId
        );
      })
      .addCase(deactivatePurchaseOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string; // Assign error message from payload
      })
      .addCase(fetchPurchaseOrders.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.purchaseList = action.payload;  // Example: action.payload.purchaseList
        state.totalItems = action.payload.totalItems;
        state.currentPage = action.meta.arg.page;
        state.pageSize = action.meta.arg.size;
      })
      .addCase(fetchPurchaseOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch purchase orders';
      })
        .addCase(fetchPendingPurchaseOrders.pending, (state) => {
        console.log('Fetch pending purchase orders - PENDING');
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPendingPurchaseOrders.fulfilled, (state, action) => {
        console.log('Fetch pending purchase orders - FULFILLED', action.payload);
        state.loading = false;
        state.pendingPurchaseList = action.payload.data || action.payload; // Adjust based on your API response structure
        state.totalItems = action.payload.totalCount || action.payload.length;
      })
      .addCase(fetchPendingPurchaseOrders.rejected, (state, action) => {
        console.log('Fetch pending purchase orders - REJECTED', action.error);
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch purchase orders';
      })
           .addCase(fetchPurchaseOrderRandomIds.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchPurchaseOrderRandomIds.fulfilled, (state, action) => {
        const { data, skip, query } = action.payload;

        state.loading = false;
        state.searchQuery = query; // Store the current search query

        // If this is the first page (skip=0), replace all items
        if (skip === 0) {
          state.randomIds = data;
        } else {
          // Otherwise, append new items, avoiding duplicates
          const existingIds = new Set(state.randomIds.map(item => item.purchaseOrderId));
          const newItems = data.filter(item => !existingIds.has(item.purchaseOrderId));
          state.randomIds = [...state.randomIds, ...newItems];
        }

        // Update hasMore - if we got fewer items than LIMIT, no more items
        state.hasMore = data.length >= LIMIT;
      })
      .addCase(fetchPurchaseOrderRandomIds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.hasMore = false;
      })
     .addCase(fetchPoById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedPo = action.payload;
        state.poDialogOpen = true;
      })
      .addCase(calculateOverallDiscount.pending, (state) => {
      state.loading = true;
    })
    .addCase(calculateOverallDiscount.fulfilled, (state, action) => {
      state.loading = false;
      // Handle success if needed (e.g., update local state, but handled in component)
    })
    .addCase(calculateOverallDiscount.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const { setSearchQueryItem, setRandomQueryItem, resetPurchaseOrderState, setSelectedOrder, setOrderImageUrls, setPoRandomIds, clearSelectedOrder,resetRandomIds,setPagination, clearSnackbarMessage, addGrn, updateInvoiceDetails, setImageUrls,setPoDialogOpen,setSelectedPo
} = purchaseListSlice.actions;

export const selectOrderImages = (purchaseOrderId: string) => (state: RootState) =>
  state.purchaseList.imageUrls[purchaseOrderId] || [];

export const selectImageUploadStatus = (state: RootState) => ({
  status: state.purchaseList.uploadStatus,
  error: state.purchaseList.uploadError
});

// Create a selector to access the state
export const selectPurchaseListState = (state: RootState) => state.purchaseList;
export const selectCurrentPage = (state: RootState) => state.purchaseList.currentPage;
export const selectPageSize = (state: RootState) => state.purchaseList.pageSize;
export const selectTotalItems = (state: RootState) => state.purchaseList.totalItems;


export default purchaseListSlice.reducer;
