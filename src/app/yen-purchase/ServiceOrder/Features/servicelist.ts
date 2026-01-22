// features/yen-purchase/ServiceOrder/Features/servicepo.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { initialState } from "./servicepo";
import { ServiceData } from "../Models/servicepo";

// Interface for conversion request
interface ServiceToAPRequest {
  service_id: string;
  apInvoiceDate?: string; // Optional ISO string
  outgoingDate?: string; // Optional ISO string
  apRoundOff?: string; // String for decimal precision
}
interface ServiceToAPResponse {
  message: string;
  idMapping: {
    serviceId: string;
    apInvoiceId: string;
    apRandomId: string;
    outgoingId: string;
    outgoingRandomId: string;
  };
  datesUsed: {           // Add this to see what dates backend used
    apInvoiceDate: string;
    outgoingDate: string;
    invoiceDate: string;
  };
  financialSummary: {
    serviceAmount: string;
    apRoundOffApplied: string;
    apInvoiceAmount: string;
    totalServiceFees: string;
    totalTax: string;
    totalDiscount: string;
    totalFreightAmount: string;
    totalFreightTax: string;
    payableAmount: string;
  };
  apInvoiceDetails: {
    invoiceId: string;
    status: string;
    randomId: string;
    newStatus?: string;
    previousStatus?: string;
  };
  outgoingDetails: {
    outgoingId: string;
    status: string;
    randomId: string;
  };
}

// Interface for error response
interface ConversionError {
  message: string;
  detail?: string;
}
// Update the request interface to match new requirements
interface ServiceToAPRequest {
  service_id: string;
  apRoundOff?: string;
  invoiceNo?: string;      // Add this
  invoiceDate?: string;    // Add this (just the date string like "2025-11-01")
  // Remove apInvoiceDate and outgoingDate since they're set in backend
}

// Convert Service to AP + Outgoing
export const convertServiceToAPOutgoing = createAsyncThunk(
  'serviceOrders/convertToAPOutgoing',
  async (request: ServiceToAPRequest, { rejectWithValue }) => {
    try {
      const { service_id, apRoundOff = "0.00", invoiceNo, invoiceDate } = request;
      
      if (!service_id) throw new Error("Service ID is required");

      // Build query parameters - ONLY pass these three parameters
      const params = new URLSearchParams();
      params.append('apRoundOff', apRoundOff);
      
      // Only add invoiceNo and invoiceDate if provided
      if (invoiceNo) {
        params.append('invoiceNo', invoiceNo);
      }
      
      if (invoiceDate) {
        params.append('invoiceDate', invoiceDate); // Just pass the date string
      }

      const response = await axios.post<ServiceToAPResponse>(
        `http://192.168.29.116:8000/purchasetestapi/servicepo/convert-service-to-ap-outgoing/${service_id}`,
        null,
        {
          params: params,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to convert service to AP and outgoing';
      return rejectWithValue(errorMessage);
    }
  }
);

// Get AP Invoice with Service Details
export const getAPInvoiceWithServiceDetails = createAsyncThunk(
  'serviceOrders/getAPWithServiceDetails',
  async (ap_id: string, { rejectWithValue }) => {
    try {
      if (!ap_id) throw new Error("AP Invoice ID is required");

      const response = await axios.get(
        `http://192.168.29.116:8000/api/service-to-ap/ap-invoice/${ap_id}/service-details`
      );
      
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to fetch AP invoice details';
      return rejectWithValue(errorMessage);
    }
  }
);

// Deactivate Service Order (from your existing code)
export const deactivateServiceOrder = createAsyncThunk(
  'serviceOrders/deactivate',
  async (mongoId: string, { rejectWithValue }) => {
    try {
      if (!mongoId) throw new Error("Invalid service order ID");

      const response = await axios.patch(
        `http://192.168.29.116:8000/purchasetestapi/servicepo/deactivated/${mongoId}`
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to deactivate');
    }
  }
);

// Update Service Order Status to Pending (from your existing code)
export const updateServiceOrderStatusToPending = createAsyncThunk(
  'serviceOrders/updateStatusToPending',
  async (mongoId: string, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `http://192.168.29.116:8000/purchasetestapi/servicepo/pending/${mongoId}`
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to set to pending');
    }
  }
);
export const fetchServiceById = createAsyncThunk(
  'service/fetchServiceById',
  async (identifier: string, { rejectWithValue }) => {
    try {
      // Use your actual backend base URL
      const response = await axios.get(
        `http://192.168.29.116:8000/purchasetestapi/servicepo/getOutgoing/${identifier}`
        // or `/api/service/getOutgoing/${identifier}` if using proxy
      );

      const data = response.data;

      // Optional: Transform dates to ISO strings if backend returns Date objects
      const transformed: ServiceData = {
        ...data,
        // Ensure all datetime fields are strings
        createdDate: data.createdDate ? String(data.createdDate) : null,
        lastUpdatedDate: data.lastUpdatedDate ? String(data.lastUpdatedDate) : null,
        workOrderDate: data.workOrderDate ? String(data.workOrderDate) : null,
        approvedDate: data.approvedDate ? String(data.approvedDate) : null,
        rejectedDate: data.rejectedDate ? String(data.rejectedDate) : null,
        invoiceDate: data.invoiceDate ? String(data.invoiceDate) : null,

        // Handle array dates
        from_dates: data.from_dates?.map((d: any) => (d ? String(d) : null)) || [],
        to_dates: data.to_dates?.map((d: any) => (d ? String(d) : null)) || [],
      };

      return transformed;
    } catch (error: any) {
      console.error('Failed to fetch Service details:', error);
      return rejectWithValue(
        error.response?.data?.detail || 'Failed to fetch service order'
      );
    }
  }
);
// Update the servicepo.ts initial state to include conversion state
interface ServicePOState {
  services: any[];
  loading: boolean;
  error: string | null;
  snackbarMessage: string;
  snackbarOpen: boolean;
  
  // Conversion state
  conversionLoading: boolean;
  conversionError: string | null;
  conversionSuccess: boolean;
  conversionData: ServiceToAPResponse | null;
  
  // AP Details state
  apDetailsLoading: boolean;
  apDetailsError: string | null;
  apDetails: any | null;
}

// Create the slice
const serviceListSlice = createSlice({
  name: 'serviceOrder',
  initialState: {
    services: [],
    loading: false,
    error: null,
    snackbarMessage: '',
    snackbarOpen: false,
    
    // Conversion state initialization
    conversionLoading: false,
    conversionError: null,
    conversionSuccess: false,
    conversionData: null,
    
    // AP Details state initialization
    apDetailsLoading: false,
    apDetailsError: null,
    apDetails: null,
  } as ServicePOState,
  reducers: {
    // Your existing reducers...
    setSnackbarOpen: (state, action: PayloadAction<boolean>) => {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage: (state, action: PayloadAction<string>) => {
      state.snackbarMessage = action.payload;
    },
    clearError: (state) => {
      state.error = null;
      state.conversionError = null;
      state.apDetailsError = null;
    },
    clearConversionState: (state) => {
      state.conversionLoading = false;
      state.conversionError = null;
      state.conversionSuccess = false;
      state.conversionData = null;
    },
    clearAPDetails: (state) => {
      state.apDetailsLoading = false;
      state.apDetailsError = null;
      state.apDetails = null;
    },
    // Add service after successful creation
    addService: (state, action: PayloadAction<any>) => {
      state.services.unshift(action.payload);
    },
    // Update service in list
    updateServiceInList: (state, action: PayloadAction<{ mongoId: string; updates: any }>) => {
      const index = state.services.findIndex(service => service.mongoId === action.payload.mongoId);
      if (index !== -1) {
        state.services[index] = { ...state.services[index], ...action.payload.updates };
      }
    },
    // Remove service from list
    removeServiceFromList: (state, action: PayloadAction<string>) => {
      state.services = state.services.filter(service => service.mongoId !== action.payload);
    },

  },
  extraReducers: (builder) => {
    // ... your existing extraReducers ...

    // Handle convertServiceToAPOutgoing
    builder.addCase(convertServiceToAPOutgoing.pending, (state) => {
      state.conversionLoading = true;
      state.conversionError = null;
      state.conversionSuccess = false;
      state.conversionData = null;
      state.error = null; // Clear general error
    });
    
    builder.addCase(convertServiceToAPOutgoing.fulfilled, (state, action) => {
      state.conversionLoading = false;
      state.conversionSuccess = true;
      state.conversionData = action.payload;
      
      // Update the service order status in the list to "APConverted"
      const serviceId = action.payload.idMapping.serviceId;
      const index = state.services.findIndex(
        service => service.mongoId === serviceId || service._id === serviceId
      );
      if (index !== -1) {
        state.services[index].status = "APConverted";
        state.services[index].lastUpdatedDate = new Date().toISOString();
      }
      
      // Show success message
      state.snackbarMessage = action.payload.message || 'Service successfully converted to AP and Outgoing';
      state.snackbarOpen = true;
    });
    
    builder.addCase(convertServiceToAPOutgoing.rejected, (state, action) => {
      state.conversionLoading = false;
      state.conversionError = action.payload as string || 'Failed to convert service to AP and outgoing';
      state.snackbarMessage = action.payload as string || 'Failed to convert service to AP and outgoing';
      state.snackbarOpen = true;
    });

    // Handle getAPInvoiceWithServiceDetails
    builder.addCase(getAPInvoiceWithServiceDetails.pending, (state) => {
      state.apDetailsLoading = true;
      state.apDetailsError = null;
      state.apDetails = null;
    });
    
    builder.addCase(getAPInvoiceWithServiceDetails.fulfilled, (state, action) => {
      state.apDetailsLoading = false;
      state.apDetails = action.payload;
    });
    
    builder.addCase(getAPInvoiceWithServiceDetails.rejected, (state, action) => {
      state.apDetailsLoading = false;
      state.apDetailsError = action.payload as string || 'Failed to fetch AP invoice details';
      state.snackbarMessage = action.payload as string || 'Failed to fetch AP invoice details';
      state.snackbarOpen = true;
    });

    // Handle deactivateServiceOrder (from your existing code)
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

    // Handle updateServiceOrderStatusToPending (from your existing code)
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

// Export actions
export const { 
  setSnackbarOpen, 
  setSnackbarMessage, 
  clearError, 
  clearConversionState,
  clearAPDetails,
  addService,
  updateServiceInList,
  removeServiceFromList
} = serviceListSlice.actions;

// Export selectors
export const selectServices = (state: { serviceOrder: ServicePOState }) => state.serviceOrder.services;
export const selectLoading = (state: { serviceOrder: ServicePOState }) => state.serviceOrder.loading;
export const selectError = (state: { serviceOrder: ServicePOState }) => state.serviceOrder.error;
export const selectSnackbar = (state: { serviceOrder: ServicePOState }) => ({
  message: state.serviceOrder.snackbarMessage,
  open: state.serviceOrder.snackbarOpen
});

// Conversion selectors
export const selectConversionLoading = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.conversionLoading;
export const selectConversionError = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.conversionError;
export const selectConversionSuccess = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.conversionSuccess;
export const selectConversionData = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.conversionData;

// AP Details selectors
export const selectAPDetailsLoading = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.apDetailsLoading;
export const selectAPDetailsError = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.apDetailsError;
export const selectAPDetails = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.apDetails;

export default serviceListSlice.reducer;