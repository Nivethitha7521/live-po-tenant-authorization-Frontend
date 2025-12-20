// features/yen-purchase/ServiceOrder/Features/servicepo.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { initialState } from "./servicepo";
// Deactivate
export const deactivateServiceOrder = createAsyncThunk(
  'serviceOrders/deactivate',
  async (mongoId: string, { rejectWithValue }) => {
    try {
      if (!mongoId) throw new Error("Invalid service order ID");

      const response = await axios.patch(
        `http://192.168.29.116:8000/purchaseapi/servicepo/deactivated/${mongoId}`
        // No body needed!
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to deactivate');
    }
  }
);

// To Pending
export const updateServiceOrderStatusToPending = createAsyncThunk(
  'serviceOrders/updateStatusToPending',
  async (mongoId: string, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `http://192.168.29.116:8000/purchaseapi/servicepo/pending/${mongoId}`
        // No body!
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to set to pending');
    }
  }
);


// In your extraReducers, add these:
const serviceListSlice = createSlice({
  name: 'serviceOrder',
  initialState,
  reducers: {
    // ... your existing reducers ...
  },
  extraReducers: (builder) => {
    // ... your existing extraReducers ...

    // Handle deactivateServiceOrder
    builder.addCase(deactivateServiceOrder.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(deactivateServiceOrder.fulfilled, (state, action) => {
      state.loading = false;
      // Remove the deactivated service order from the list
      state.services = state.services.filter(service => 
        service.mongoId !== action.payload?.mongoId
      );
      state.snackbarMessage = 'Service order deactivated successfully';
      state.snackbarOpen = true;
    });
    builder.addCase(deactivateServiceOrder.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string || 'Failed to deactivate service order';
      state.snackbarMessage = action.payload as string || 'Failed to deactivate service order';
      state.snackbarOpen = true;
    });

    // Handle updateServiceOrderStatusToPending
    builder.addCase(updateServiceOrderStatusToPending.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(updateServiceOrderStatusToPending.fulfilled, (state, action) => {
      state.loading = false;
      // Update the service order status in the list
      const index = state.services.findIndex(
        service => service.mongoId === action.payload.mongoId
      );
      if (index !== -1) {
        state.services[index] = action.payload;
      }
      state.snackbarMessage = 'Service order moved to pending successfully';
      state.snackbarOpen = true;
    });
    builder.addCase(updateServiceOrderStatusToPending.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string || 'Failed to move service order to pending';
      state.snackbarMessage = action.payload as string || 'Failed to move service order to pending';
      state.snackbarOpen = true;
    });
  },
});


export default serviceListSlice.reducer;