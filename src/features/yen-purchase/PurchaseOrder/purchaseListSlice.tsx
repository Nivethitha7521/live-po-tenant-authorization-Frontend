import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';
import { format } from 'date-fns';
import { initialState, PhotoResponse, PhotosResponse, Item, PurchaseInvoice, PurchaseOrderData, PurchaseRandomId, UploadResponse } from '@/Models/purchaseModel';
import { GrnData } from '@/Models/grnModel';


const LIMIT = 20;
const API_BASE_URL = 'https://yenerp.com/purchaseapi';
const API_PHOTO_URL = 'https://yenerp.com/share/upload/purchaseorder/receipts';

export const fetchPurchaseOrderRandomIds = createAsyncThunk(
  'purchaseOrder/fetchRandomIds',
  async ({ skip, query }: { skip: number; query: string }, { rejectWithValue }) => {
    try {
      const response = await axios.get<PurchaseRandomId[]>(
        `${API_BASE_URL}/purchaseorders/getRandomId`,
        {
          params: {
            random_id: query || undefined,
            skip,
            limit: LIMIT
          }
        }
      );

      return {
        data: response.data,
        skip,
        query
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch purchase order random IDs');
    }
  }
);
const formatDate = (date: Date): string => {
  return format(date, 'dd/MM/yyyy');  // Format as day/month/year
};
const customRound = (value: number) => {
  return Math.round(value * 100) / 100; // Round to two decimal places
};
function customRoundOff(value: number): number {
  // Extract the decimal part to check if it's .5 or above
  const decimalPart = value % 1;

  // If decimal part is 0.5 or above, round up; otherwise, round down
  if (decimalPart >= 0.5) {
    return Math.ceil(value);  // Round up to the nearest whole number
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
    dateField = 'orderDate' // Add an optional parameter for date field
  }: {
    page: number;
    size: number;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    vendorName?: string;
    itemName?: string;
    randomId?: string;
    dateField?: 'orderDate' | 'approvedDate' | 'rejectedDate'; // Specify which date field to filter by
  }) => {
    const params: {
      skip?: number;
      limit?: number;
      status?: string;
      fromDate?: string;
      toDate?: string;
      vendorName?: string;
      itemName?: string;
      randomId?: string;
      filterBy?: string; // Optional field for dynamic date filtering
    } = {};

    // Pagination
    params.skip = (page - 1) * size;
    params.limit = size;

    // Filters
    if (status) params.status = status;
    if (vendorName) params.vendorName = vendorName;
    if (itemName) params.itemName = itemName;
    if (randomId) params.randomId = randomId;

    // Date filters for specific fields (orderDate, approvedDate, rejectedDate)
    if (fromDate) params.fromDate = fromDate.toISOString();
    if (toDate) params.toDate = toDate.toISOString();

    // Add the filterBy parameter to specify which date field to filter by
    if (dateField) params.filterBy = dateField;

    try {
      const response = await axios.get('https://yenerp.com/purchaseapi/purchaseorders/', {
        params,
      });

      if (response.data.length === 0) {
        return [];  // Return empty array if no data
      }

      console.log('Fetched purchase orders:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching purchase orders:', error);

      // Handle error gracefully and return an empty array
      return { errorMessage: 'Error fetching purchase orders. Please try again.' };
    }
  }
);
// Async thunk to fetch all purchase orders
export const fetchAllPurchaseOrders = createAsyncThunk(
  'purchaseOrder/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<PurchaseOrderData[]>('https://yenerp.com/purchaseapi/purchaseorders/getAll');
      return response.data;  // List of purchase orders
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch purchase orders');
    }
  }
);
export const fetchInvoiceNumbers = createAsyncThunk(
  'invoiceNumbers/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<PurchaseInvoice[]>('https://yenerp.com/purchaseapi/purchaseorders/getByInvoiceNo');
      return response.data;  // List of invoice numbers
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch invoice numbers');
    }
  }
);

// Define an async thunk to deactivate a purchase order
export const deactivatePurchaseOrder = createAsyncThunk(
  'purchaseList/deactivate',
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {
      // Make sure that purchaseOrderId is a valid string
      if (!purchaseOrderId) throw new Error("Invalid purchase order ID");

      // Send a PATCH request to update the poStatus to "deactivated"
      await axios.patch(`https://yenerp.com/purchaseapi/purchaseorders/${purchaseOrderId}`, {
        poStatus: 'deactivated' // or any other status you use to mark it as deactivated
      });
    } catch (error: any) {
      console.error('Error deactivating purchase order:', error);
      return rejectWithValue('Failed to deactivate purchase order');
    }
  }
);

export const updatePurchaseOrder = createAsyncThunk(
  'purchaseOrders/update',
  async ({ purchaseOrderId, purchaseOrder }: { purchaseOrderId: string; purchaseOrder: Partial<PurchaseOrderData> }) => {
    try {
      const currentDate = new Date();
      const formattedDate = formatDate(currentDate);
      const purchaseOrderToUpdate = {
        ...purchaseOrder,

      };
      const response = await axios.patch<PurchaseOrderData>(`https://yenerp.com/purchaseapi/purchaseorders/${purchaseOrderId}`, purchaseOrderToUpdate);
      return response.data;
    } catch (error: any) {
      return Promise.reject(`Failed to update purchase order: ${error.response?.data?.message || error.message}`);
    }
  }
);

export const updatePurchaseOrderStatusToPending = createAsyncThunk(
  'purchaseOrders/updateStatusToPending',
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `https://yenerp.com/purchaseapi/purchaseorders/${purchaseOrderId}`, // Make sure the endpoint matches your backend structure
        {
          poStatus: 'Pending',

        }
      );
      return response.data; // Return the updated purchase order data
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to update purchase order status');
    }
  }
);
export const approvePurchaseOrder = createAsyncThunk(
  'purchaseOrders/approve',
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `https://yenerp.com/purchaseapi/purchaseorders/approved/${purchaseOrderId}`
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to approve purchase order');
    }
  }
);

export const rejectPurchaseOrder = createAsyncThunk(
  'purchaseOrders/reject',
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {

      const response = await axios.patch(
        `https://yenerp.com/purchaseapi/purchaseorders/rejected/${purchaseOrderId}`
      );

      return response.data; // Return the updated purchase order data
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to reject purchase order');
    }
  }
);

// Async thunk action to update multiple items
export const updateMultipleItemQuantities = createAsyncThunk(
  'purchaseOrders/updateMultipleItemQuantities',
  async (params: { purchaseOrderId: string; updatedItems: { itemId: string; updatedItem: Partial<Item> }[] }, { rejectWithValue }) => {
    try {
      // Transform the data structure to match what the backend expects
      const items = params.updatedItems.map(item => ({
        itemId: item.itemId,
        ...item.updatedItem  // Spread the updatedItem properties to the top level
      }));

      const response = await axios.patch<PurchaseOrderData>(
        `https://yenerp.com/purchaseapi/purchaseorders/${params.purchaseOrderId}/items`,
        { items }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response.data || error.message);
    }
  }
);

export const fetchPoById = createAsyncThunk(
  'po/fetchPoById',
  async (poId: string) => {
    try {
      const response = await axios.get(`https://yenerp.com/purchaseapi/poimport/getOutgoing/${poId}`);
      const data = response.data;
      console.log('API response:', data); // Debug: Verify orderDate is a string
      return {
        ...data,
        orderDate: data.orderDate || null, // Keep as string or null
      };
    } catch (error) {
      console.error('Failed to fetch PO details:', error);
      throw new Error('Failed to fetch PO details');
    }
  }
);

export const updateReceivedDamagedQuantities = createAsyncThunk(
  'purchaseOrder/updateReceivedDamagedQuantities',
  async (params: {
    purchaseOrderId: string;
    items: Array<{
      itemId: string;
      receivedQuantity: number;
      befTaxDiscount: number;
      afTaxDiscount: number;
      expiryDate: Date | null;
    }>;
    invoiceNo: string;
    invoiceDate: Date | null;
    grnDate: Date | null; // New field
    discountPrice: number;
  }, { rejectWithValue }) => {
    try {
      // Validate purchaseOrderId before making the request
      if (!params.purchaseOrderId) {
        throw new Error('purchaseOrderId is required');
      }
      const response = await axios.patch(
        `http://192.168.1.122:8000/purchaseorders/receivedupdates/${params.purchaseOrderId}`,
        params
      );
      return response.data;
    } catch (error: any) {
      console.error('Error in updateReceivedDamagedQuantities:', error);
      return rejectWithValue(error.message || 'Failed to update purchase order');
    }
  }
);
// Updated async thunks
export const uploadPurchaseOrderPhotos = createAsyncThunk<
  UploadResponse,
  { purchaseOrderId: string; files: File[]; index?: number }
>(
  'purchaseOrders/uploadPhotos',
  async ({ purchaseOrderId, files, index }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (index !== undefined) formData.append('index', index.toString());

      const response = await axios.post<UploadResponse>(
        `${API_BASE_URL}/purchaseorders/upload/${purchaseOrderId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Upload failed');
    }
  }
);
// Fetch a specific image by index
export const fetchImageByIndex = createAsyncThunk(
  'photos/fetchPhotoByIndex',
  async ({ purchaseOrderId, index }: { purchaseOrderId: string, index: number }, { rejectWithValue }) => {
    try {
      // Convert frontend's 0-based index to backend's 1-based
      const backendIndex = index + 1;

      const response = await axios.get<PhotoResponse>(
        `${API_BASE_URL}/purchaseorders/view/${purchaseOrderId}/${backendIndex}`
      );

      const timestamp = new Date().getTime();
      const imageUrl = `${response.data.imageUrl}?t=${timestamp}`;

      return {
        imageUrl,
        purchaseOrderId,
        index // Return original 0-based index
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Error fetching photo');
    }
  }
);

// Fetch all images for a purchase order
export const fetchAllImages = createAsyncThunk(
  'photos/fetchAllPhotos',
  async (purchaseOrderId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get<PhotosResponse>(
        `${API_BASE_URL}/purchaseorders/view-all/${purchaseOrderId}`
      );
      return { purchaseOrderId, imageUrls: response.data.imageUrls };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Fetch failed');
    }
  }
);

export const editPhotoByIndex = createAsyncThunk(
  'purchaseOrders/editPhoto',
  async ({ purchaseOrderId, index, file }: {
    purchaseOrderId: string;
    index: number; // 1-based from backend
    file: File;
  }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.patch(
        `${API_BASE_URL}/purchaseorders/edit/${purchaseOrderId}/${index}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return {
        message: response.data.message,
        purchaseOrderId,
        index: index - 1, // Convert to 0-based for frontend
        imageUrl: response.data.imageUrl
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to edit the photo');
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
      .addCase(fetchPurchaseOrderRandomIds.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchPurchaseOrderRandomIds.fulfilled, (state, action) => {
        const { data, skip, query } = action.payload;

        // Only update if the current query matches the response query
        // This prevents race conditions with multiple requests
        if (query === state.searchQuery) {
          // If we're loading the first page (skip=0), replace the list
          // Otherwise, append the new items
          if (skip === 0) {
            state.randomIds = data;
          } else {
            // Append new items, avoiding duplicates by ID
            const existingIds = new Set(state.randomIds.map(item => item.purchaseOrderId));
            const newItems = data.filter(item => !existingIds.has(item.purchaseOrderId));
            state.randomIds = [...state.randomIds, ...newItems];
          }

          // Update pagination state
          state.hasMore = data.length >= LIMIT;
          state.page = Math.floor(state.randomIds.length / LIMIT);
        }

        state.loading = false;
      })
      .addCase(fetchPurchaseOrderRandomIds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
     .addCase(fetchPoById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedPo = action.payload;
        state.poDialogOpen = true;
      });
  },
});

export const { setSearchQueryItem, setRandomQueryItem, resetPurchaseOrderState, setSelectedOrder, setOrderImageUrls, setPoRandomIds, clearSelectedOrder, setPagination, clearSnackbarMessage, addGrn, updateInvoiceDetails, setImageUrls,setPoDialogOpen,setSelectedPo
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
