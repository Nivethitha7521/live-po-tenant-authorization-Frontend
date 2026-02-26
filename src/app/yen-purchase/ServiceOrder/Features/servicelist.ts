// features/yen-purchase/ServiceOrder/Features/servicepo.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import purchaseApi from "@/utils/api";
import { initialState } from "./servicepo";
import { ServiceData } from "../Models/servicepo";

// Interface for conversion request
interface ServiceToAPRequest {
  service_id: string;
  apRoundOff?: string;
  invoiceNo?: string;
  invoiceDate?: string;
}

// Interface for conversion response
interface ServiceToAPResponse {
  success: boolean;
  message: string;
  conversionType: 'new_conversion' | 'returned_reconversion';
  timestamp: string;
  idMapping: {
    serviceId: string;
    serviceObjectId: string;
    vendorId: string;
    apInvoiceId: string;
    apRandomId: string;
    apStatus: string;
    outgoingId: string;
    outgoingRandomId: string;
    outgoingStatus: string;
  };
  datesUsed: {
    apInvoiceDate: string;
    outgoingDate: string;
    invoiceDate: string;
  };
  financialSummary: {
    serviceAmount: number;
    apRoundOffApplied: number;
    apInvoiceAmount: number;
    totalServiceFees: number;
    totalTax: number;
    totalDiscount: number;
    totalFreightAmount: number;
    totalFreightTax: number;
    payableAmount: number;
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
    newStatus?: string;
  };
  vendorUpdate?: any;
}

// Interface for conversion status check
interface ConversionStatusResponse {
  serviceId: string;
  serviceIdField: string;
  vendorName: string;
  serviceStatus: string;
  conversionStatus: 'NOT_CONVERTED' | 'CONVERTED_ACTIVE' | 'CONVERTED_RETURNED' | 'CONVERTED_PARTIAL';
  canConvert: boolean;
  lastUpdated?: string;
  existingConversion?: {
    apInvoice: {
      id: string;
      randomId: string;
      invoiceNo: string;
      invoiceAmount: number;
      status: string;
      createdDate: string;
    };
    outgoingPayment?: {
      exists: boolean;
      id?: string;
      randomId?: string;
      status?: string;
      createdDate?: string;
    } | null;
  };
}

// Interface for validation response
interface ValidationResponse {
  canConvert: boolean;
  serviceId: string;
  serviceIdField: string;
  vendorName: string;
  currentServiceStatus: string;
  conversionStatus: string;
  validationPassed: boolean;
  errorCode?: string;
  message?: string;
  existingApId?: string;
  existingApRandomId?: string;
  existingApStatus?: string;
}

// Interface for reversal response
interface ReversalResponse {
  success: boolean;
  message: string;
  serviceId: string;
  previousConversionStatus: string;
  reversalDetails: {
    vendorReversal?: any;
    documentsDeleted: {
      count: number;
      deletedIds: string[];
    };
    serviceStatus: {
      updated: boolean;
      newStatus: string;
    };
  };
  canConvertAgain: boolean;
}

// Interface for service return request (by service ID)
interface ServiceReturnRequest {
  serviceId: string;
  remarks?: string;
}

// NEW: Interface for service return by AP invoice request
interface ServiceReturnByApRequest {
  apInvoiceId: string;
  remarks?: string;
}

// Interface for service return response
interface ServiceReturnResponse {
  success: boolean;
  message: string;
  serviceId: string;
  status: string;
  returnedDate: string;
  remarks?: string;
}

// Interface for error response
interface ConversionError {
  message: string;
  detail?: string;
  error?: string;
  existingConversion?: any;
}

export const convertServiceToAPOutgoing = createAsyncThunk<
  ServiceToAPResponse,
  ServiceToAPRequest,
  { rejectValue: string }
>(
  'serviceOrders/convertToAPOutgoing',
  async (request: ServiceToAPRequest, { rejectWithValue }) => {
    try {
      const { service_id, apRoundOff = "0.00", invoiceNo, invoiceDate } = request;
      
      if (!service_id) throw new Error("Service ID is required");

      // Build query parameters
      const params = new URLSearchParams();
      
      // Ensure apRoundOff is a string with proper format
      const roundOffValue = String(apRoundOff || "0.00");
      params.append('apRoundOff', roundOffValue);
      
      // Only add invoiceNo and invoiceDate if provided
      if (invoiceNo && invoiceNo.trim()) {
        params.append('invoiceNo', invoiceNo.trim());
      }
      
      if (invoiceDate) {
        params.append('invoiceDate', invoiceDate);
      }

      console.log('API Request params:', Object.fromEntries(params)); // Debug log

      const response = await purchaseApi.post<ServiceToAPResponse>(
        `/servicepo/convert-service-to-ap-outgoing/${service_id}`,
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
      console.error('Conversion error:', error.response?.data || error);
      
      // Handle 409 Conflict (already converted) specially
      if (error.response?.status === 409) {
        const errorData = error.response?.data;
        return rejectWithValue(JSON.stringify({
          error: "SERVICE_ALREADY_CONVERTED",
          message: errorData?.message || "Service already converted to active AP Invoice",
          existingConversion: errorData?.existingConversion
        }));
      }
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to convert service to AP and outgoing';
      return rejectWithValue(errorMessage);
    }
  }
);

// Check conversion status
export const checkConversionStatus = createAsyncThunk<
  ConversionStatusResponse,
  string,
  { rejectValue: string }
>(
  'serviceOrders/checkConversionStatus',
  async (service_id: string, { rejectWithValue }) => {
    try {
      if (!service_id) throw new Error("Service ID is required");

      const response = await purchaseApi.get<ConversionStatusResponse>(
        `/servicepo/service/${service_id}/conversion-status`
      );
      
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to check conversion status';
      return rejectWithValue(errorMessage);
    }
  }
);

// Validate before conversion
export const validateServiceConversion = createAsyncThunk<
  ValidationResponse,
  string,
  { rejectValue: string }
>(
  'serviceOrders/validateConversion',
  async (service_id: string, { rejectWithValue }) => {
    try {
      if (!service_id) throw new Error("Service ID is required");

      const response = await purchaseApi.post<ValidationResponse>(
        `/servicepo/validate-service-conversion/${service_id}`
      );
      
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to validate conversion';
      return rejectWithValue(errorMessage);
    }
  }
);

// Reverse conversion (for returned invoices or to undo)
export const reverseServiceConversion = createAsyncThunk<
  ReversalResponse,
  { service_id: string; deleteDocuments?: boolean },
  { rejectValue: string }
>(
  'serviceOrders/reverseConversion',
  async ({ service_id, deleteDocuments = true }, { rejectWithValue }) => {
    try {
      if (!service_id) throw new Error("Service ID is required");

      const params = new URLSearchParams();
      params.append('deleteDocuments', String(deleteDocuments));

      const response = await purchaseApi.post<ReversalResponse>(
        `/servicepo/reverse-service-conversion/${service_id}`,
        null,
        { params }
      );
      
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to reverse conversion';
      return rejectWithValue(errorMessage);
    }
  }
);
export const returnServiceInvoice = createAsyncThunk<
  ServiceReturnResponse,
  { serviceId: string; remarks?: string },
  { rejectValue: string }
>(
  'serviceOrders/returnServiceInvoice',
  async ({ serviceId, remarks }, { rejectWithValue }) => {
    try {
      if (!serviceId) throw new Error("Service ID is required");

      const response = await purchaseApi.patch<ServiceReturnResponse>(
        `/servicepo/return-service/${serviceId}`,
        { remarks },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Return service error:', error.response?.data || error);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to return service invoice';
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

      const response = await purchaseApi.get(
        `/service-to-ap/ap-invoice/${ap_id}/service-details`
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

// Deactivate Service Order
export const deactivateServiceOrder = createAsyncThunk(
  'serviceOrders/deactivate',
  async (mongoId: string, { rejectWithValue }) => {
    try {
      if (!mongoId) throw new Error("Invalid service order ID");

      const response = await purchaseApi.patch(
        `/servicepo/deactivated/${mongoId}`
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to deactivate');
    }
  }
);

// Update Service Order Status to Pending
export const updateServiceOrderStatusToPending = createAsyncThunk(
  'serviceOrders/updateStatusToPending',
  async (mongoId: string, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(
        `/servicepo/pending/${mongoId}`
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
      const response = await purchaseApi.get(
        `/servicepo/getOutgoing/${identifier}`
      );

      const data = response.data;

      // Transform dates to ISO strings
      const transformed: ServiceData = {
        ...data,
        createdDate: data.createdDate ? String(data.createdDate) : null,
        lastUpdatedDate: data.lastUpdatedDate ? String(data.lastUpdatedDate) : null,
        workOrderDate: data.workOrderDate ? String(data.workOrderDate) : null,
        approvedDate: data.approvedDate ? String(data.approvedDate) : null,
        rejectedDate: data.rejectedDate ? String(data.rejectedDate) : null,
        invoiceDate: data.invoiceDate ? String(data.invoiceDate) : null,
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

// Update the servicepo.ts initial state interface
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
  conversionType: 'new' | 'returned' | null;
  
  // Status check state
  statusCheckLoading: boolean;
  statusCheckData: ConversionStatusResponse | null;
  
  // Validation state
  validationLoading: boolean;
  validationData: ValidationResponse | null;
  
  // Reversal state
  reversalLoading: boolean;
  reversalData: ReversalResponse | null;
  
  // Return service state (by service ID)
  returnServiceLoading: boolean;
  returnServiceError: string | null;
  returnServiceSuccess: boolean;
  returnServiceData: ServiceReturnResponse | null;
  
  // NEW: Return service by AP state
  returnByApLoading: boolean;
  returnByApError: string | null;
  returnByApSuccess: boolean;
  returnByApData: ServiceReturnResponse | null;
  
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
    conversionType: null,
    
    // Status check state
    statusCheckLoading: false,
    statusCheckData: null,
    
    // Validation state
    validationLoading: false,
    validationData: null,
    
    // Reversal state
    reversalLoading: false,
    reversalData: null,
    
    // Return service state
    returnServiceLoading: false,
    returnServiceError: null,
    returnServiceSuccess: false,
    returnServiceData: null,
    
    // NEW: Return by AP state
    returnByApLoading: false,
    returnByApError: null,
    returnByApSuccess: false,
    returnByApData: null,
    
    // AP Details state initialization
    apDetailsLoading: false,
    apDetailsError: null,
    apDetails: null,
  } as ServicePOState,
  reducers: {
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
      state.returnServiceError = null;
      state.returnByApError = null;
    },
    clearConversionState: (state) => {
      state.conversionLoading = false;
      state.conversionError = null;
      state.conversionSuccess = false;
      state.conversionData = null;
      state.conversionType = null;
    },
    clearStatusCheck: (state) => {
      state.statusCheckLoading = false;
      state.statusCheckData = null;
    },
    clearValidation: (state) => {
      state.validationLoading = false;
      state.validationData = null;
    },
    clearReversal: (state) => {
      state.reversalLoading = false;
      state.reversalData = null;
    },
    clearReturnServiceState: (state) => {
      state.returnServiceLoading = false;
      state.returnServiceError = null;
      state.returnServiceSuccess = false;
      state.returnServiceData = null;
    },
    // NEW: Clear return by AP state
    clearReturnByApState: (state) => {
      state.returnByApLoading = false;
      state.returnByApError = null;
      state.returnByApSuccess = false;
      state.returnByApData = null;
    },
    clearAPDetails: (state) => {
      state.apDetailsLoading = false;
      state.apDetailsError = null;
      state.apDetails = null;
    },
    addService: (state, action: PayloadAction<any>) => {
      state.services.unshift(action.payload);
    },
    updateServiceInList: (state, action: PayloadAction<{ mongoId: string; updates: any }>) => {
      const index = state.services.findIndex(service => service.mongoId === action.payload.mongoId);
      if (index !== -1) {
        state.services[index] = { ...state.services[index], ...action.payload.updates };
      }
    },
    removeServiceFromList: (state, action: PayloadAction<string>) => {
      state.services = state.services.filter(service => service.mongoId !== action.payload);
    },
  },
  extraReducers: (builder) => {
    // Handle convertServiceToAPOutgoing
    builder.addCase(convertServiceToAPOutgoing.pending, (state) => {
      state.conversionLoading = true;
      state.conversionError = null;
      state.conversionSuccess = false;
      state.conversionData = null;
      state.conversionType = null;
      state.error = null;
    });
    
    builder.addCase(convertServiceToAPOutgoing.fulfilled, (state, action) => {
      state.conversionLoading = false;
      state.conversionSuccess = true;
      state.conversionData = action.payload;
      state.conversionType = action.payload.conversionType === 'returned_reconversion' ? 'returned' : 'new';
      
      // Update the service order status in the list to "APConverted"
      const serviceObjectId = action.payload.idMapping.serviceObjectId;
      const index = state.services.findIndex(
        service => service._id === serviceObjectId || service.mongoId === serviceObjectId
      );
      if (index !== -1) {
        state.services[index].status = "APConverted";
        state.services[index].lastUpdatedDate = new Date().toISOString();
        
        // Store AP and Outgoing IDs for reference
        state.services[index].apInvoiceId = action.payload.idMapping.apInvoiceId;
        state.services[index].apRandomId = action.payload.idMapping.apRandomId;
        state.services[index].outgoingId = action.payload.idMapping.outgoingId;
        state.services[index].outgoingRandomId = action.payload.idMapping.outgoingRandomId;
      }
      
      // Show appropriate success message
      const message = action.payload.conversionType === 'returned_reconversion' 
        ? 'Returned invoice successfully reconverted to AP and Outgoing'
        : action.payload.message || 'Service successfully converted to AP and Outgoing';
      
      state.snackbarMessage = message;
      state.snackbarOpen = true;
    });
    
    builder.addCase(convertServiceToAPOutgoing.rejected, (state, action) => {
      state.conversionLoading = false;
      
      // Try to parse error if it's JSON string
      try {
        const errorData = JSON.parse(action.payload as string);
        state.conversionError = errorData.message || 'Conversion failed';
        
        // If it's a 409 conflict, store the existing conversion data
        if (errorData.error === 'SERVICE_ALREADY_CONVERTED' && errorData.existingConversion) {
          state.statusCheckData = {
            ...errorData.existingConversion,
            canConvert: false,
            conversionStatus: 'CONVERTED_ACTIVE'
          } as ConversionStatusResponse;
        }
      } catch {
        state.conversionError = action.payload as string || 'Failed to convert service to AP and outgoing';
      }
      
      state.snackbarMessage = state.conversionError || 'Conversion failed';
      state.snackbarOpen = true;
    });

    // Handle checkConversionStatus
    builder.addCase(checkConversionStatus.pending, (state) => {
      state.statusCheckLoading = true;
      state.statusCheckData = null;
    });
    
    builder.addCase(checkConversionStatus.fulfilled, (state, action) => {
      state.statusCheckLoading = false;
      state.statusCheckData = action.payload;
    });
    
    builder.addCase(checkConversionStatus.rejected, (state, action) => {
      state.statusCheckLoading = false;
      state.statusCheckData = null;
    });

    // Handle validateServiceConversion
    builder.addCase(validateServiceConversion.pending, (state) => {
      state.validationLoading = true;
      state.validationData = null;
    });
    
    builder.addCase(validateServiceConversion.fulfilled, (state, action) => {
      state.validationLoading = false;
      state.validationData = action.payload;
    });
    
    builder.addCase(validateServiceConversion.rejected, (state, action) => {
      state.validationLoading = false;
      state.validationData = null;
    });

    // Handle reverseServiceConversion
    builder.addCase(reverseServiceConversion.pending, (state) => {
      state.reversalLoading = true;
      state.reversalData = null;
    });
    
    builder.addCase(reverseServiceConversion.fulfilled, (state, action) => {
      state.reversalLoading = false;
      state.reversalData = action.payload;
      
      // Update service status in list
      const index = state.services.findIndex(
        service => service._id === action.payload.serviceId || service.mongoId === action.payload.serviceId
      );
      if (index !== -1) {
        state.services[index].status = "Active";
        state.services[index].lastUpdatedDate = new Date().toISOString();
        
        // Remove AP/Outgoing references
        delete state.services[index].apInvoiceId;
        delete state.services[index].apRandomId;
        delete state.services[index].outgoingId;
        delete state.services[index].outgoingRandomId;
      }
      
      state.snackbarMessage = action.payload.message || 'Conversion reversed successfully';
      state.snackbarOpen = true;
    });
    
    builder.addCase(reverseServiceConversion.rejected, (state, action) => {
      state.reversalLoading = false;
      state.snackbarMessage = action.payload as string || 'Failed to reverse conversion';
      state.snackbarOpen = true;
    });

    // Handle returnServiceInvoice (by service ID)
    builder.addCase(returnServiceInvoice.pending, (state) => {
      state.returnServiceLoading = true;
      state.returnServiceError = null;
      state.returnServiceSuccess = false;
      state.returnServiceData = null;
    });
    
    builder.addCase(returnServiceInvoice.fulfilled, (state, action) => {
      state.returnServiceLoading = false;
      state.returnServiceSuccess = true;
      state.returnServiceData = action.payload;
      
      // Update service status in list to "Returned"
      const index = state.services.findIndex(
        service => service._id === action.payload.serviceId || service.mongoId === action.payload.serviceId
      );
      if (index !== -1) {
        state.services[index].status = "Returned";
        state.services[index].lastUpdatedDate = new Date().toISOString();
        state.services[index].returnRemarks = action.payload.remarks;
      }
      
      state.snackbarMessage = action.payload.message || 'Service invoice returned successfully';
      state.snackbarOpen = true;
    });
    
    builder.addCase(returnServiceInvoice.rejected, (state, action) => {
      state.returnServiceLoading = false;
      state.returnServiceError = action.payload as string || 'Failed to return service invoice';
      state.snackbarMessage = state.returnServiceError;
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

// Export actions
export const { 
  setSnackbarOpen, 
  setSnackbarMessage, 
  clearError, 
  clearConversionState,
  clearStatusCheck,
  clearValidation,
  clearReversal,
  clearReturnServiceState,
  clearReturnByApState, // NEW: Export this
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
export const selectConversionType = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.conversionType;

// Status check selectors
export const selectStatusCheckLoading = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.statusCheckLoading;
export const selectStatusCheckData = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.statusCheckData;

// Validation selectors
export const selectValidationLoading = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.validationLoading;
export const selectValidationData = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.validationData;

// Reversal selectors
export const selectReversalLoading = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.reversalLoading;
export const selectReversalData = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.reversalData;

// Return service selectors (by service ID)
export const selectReturnServiceLoading = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.returnServiceLoading;
export const selectReturnServiceError = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.returnServiceError;
export const selectReturnServiceSuccess = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.returnServiceSuccess;
export const selectReturnServiceData = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.returnServiceData;

// NEW: Return by AP selectors
export const selectReturnByApLoading = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.returnByApLoading;
export const selectReturnByApError = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.returnByApError;
export const selectReturnByApSuccess = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.returnByApSuccess;
export const selectReturnByApData = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.returnByApData;

// AP Details selectors
export const selectAPDetailsLoading = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.apDetailsLoading;
export const selectAPDetailsError = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.apDetailsError;
export const selectAPDetails = (state: { serviceOrder: ServicePOState }) => 
  state.serviceOrder.apDetails;

export default serviceListSlice.reducer;