import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store';
import { PurchaseOrderData, Item } from '@/Models/purchaseModel';
import purchaseApi from "@/utils/api";

const API_BASE_URL = 'http://127.0.0.1:8000/purchasetestapi';

// Interface for item update payload
interface ItemUpdate {
  itemId?: string; // Optional for new items
  itemName?: string;
  quantity?: number;
  count?: number;
  eachQuantity?: number;
  pendingCount?: number;
  pendingQuantity?: number;
  newPrice?: number;
  taxPercentage?: number;
  taxType?: 'cgst_sgst' | 'igst';
  befTaxDiscount?: number;
  afTaxDiscount?: number;
  expiryDate?: string;
  action: 'add' | 'edit' | 'delete'; 
}

// Interface for the API request payload
interface PurchaseOrderItemUpdate {
  items: ItemUpdate[];
  invoiceNo?: string;
  invoiceDate?: string;
  discountPrice?: number;
}

// Interface for the slice state
interface PurchaseOrderItemState {
  loading: boolean;
  error: string | null;
  snackbarOpen: boolean;
  snackbarMessage: string;
  selectedOrder: PurchaseOrderData | null;
}

// Initial state
const initialState: PurchaseOrderItemState = {
  loading: false,
  error: null,
  snackbarOpen: false,
  snackbarMessage: '',
  selectedOrder: null,
};

export const managePurchaseOrderItems = createAsyncThunk(
  "purchaseOrderItems/manage",
  async ({
    purchaseOrderId,
    updateData,
  }: {
    purchaseOrderId: string;
    updateData: PurchaseOrderItemUpdate;
  }) => {
    const response = await purchaseApi.patch(
      `/purchaseorders/${purchaseOrderId}/items/manage`,
      updateData,
    );
    return response.data;
  },
);


// Create the slice
const purchaseOrderItemSlice = createSlice({
  name: 'purchaseOrderItems',
  initialState,
  reducers: {
    setSelectedOrder: (state, action: PayloadAction<PurchaseOrderData | null>) => {
      state.selectedOrder = action.payload;
    },
    clearSelectedOrder: (state) => {
      state.selectedOrder = null;
    },
    setSnackbarOpen: (state, action: PayloadAction<boolean>) => {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage: (state, action: PayloadAction<string>) => {
      state.snackbarMessage = action.payload;
    },
    clearSnackbar: (state) => {
      state.snackbarMessage = '';
      state.snackbarOpen = false;
    },
    resetItemState: (state) => {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(managePurchaseOrderItems.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(managePurchaseOrderItems.fulfilled, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload.message || 'Items updated successfully';
        state.snackbarOpen = true;
        if (state.selectedOrder && state.selectedOrder.purchaseOrderId === action.payload.purchaseOrder.purchaseOrderId) {
          state.selectedOrder = action.payload.purchaseOrder;
        }
      })
      .addCase(managePurchaseOrderItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      });
  },
});

// Export actions
export const { setSelectedOrder, clearSelectedOrder, setSnackbarOpen, setSnackbarMessage, clearSnackbar, resetItemState } =
  purchaseOrderItemSlice.actions;

// Selectors
export const selectPurchaseOrderItemState = (state: RootState) => state.purchaseOrderItems;
export const selectLoading = (state: RootState) => state.purchaseOrderItems.loading;
export const selectError = (state: RootState) => state.purchaseOrderItems.error;
export const selectSnackbar = (state: RootState) => ({
  open: state.purchaseOrderItems.snackbarOpen,
  message: state.purchaseOrderItems.snackbarMessage,
});
export const selectSelectedOrder = (state: RootState) => state.purchaseOrderItems.selectedOrder;

// Export reducer
export default purchaseOrderItemSlice.reducer;