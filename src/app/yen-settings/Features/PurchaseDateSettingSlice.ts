// features/settings/purchaseDateSettingsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import purchaseApi from "@/utils/api";

// Export these types so they can be imported in other files
export type RestrictionType = 'no_restriction' | 'current_only' | 'days_before' | 'days_after' | 'date_range';
export type InvoiceRestrictionType = 'same_as_order' | 'after_order' | 'any';

export interface DateRestriction {
  id?: string;
  restrictionType: RestrictionType;
  daysValue: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export interface PurchaseDateSettings {
  orderDateRestriction: DateRestriction;
  expectedDeliveryDays: number;
  invoiceDateRestriction: InvoiceRestrictionType;
  invoiceDaysAfterOrder: number;
}



// Define payload types for reducers
export interface UpdateRestrictionPayload {
  restrictionType?: RestrictionType;
  daysValue?: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
}

export interface UpdateInvoicePayload {
  type: InvoiceRestrictionType;
  days?: number;
}

interface SettingsState {
  settings: PurchaseDateSettings | null;
 
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: SettingsState = {
  settings: null,
 
  loading: false,
  error: null,
  lastUpdated: null
};

// Fetch date settings
export const fetchDateSettings = createAsyncThunk(
  'purchaseDateSettings/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get('/purchasesettings/date-settings');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch settings');
    }
  }
);

// Save date settings
export const saveDateSettings = createAsyncThunk(
  'purchaseDateSettings/save',
  async (settings: PurchaseDateSettings, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.post('/purchasesettings/date-settings', settings);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to save settings');
    }
  }
);



// Validate order date
export const validateOrderDate = createAsyncThunk(
  'purchaseDateSettings/validateOrderDate',
  async (date: Date, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get('/purchasesettings/validate-order-date', {
        params: { date: date.toISOString() }
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Validation failed');
    }
  }
);

// Calculate expected delivery
export const calculateExpectedDelivery = createAsyncThunk(
  'purchaseDateSettings/calculateExpectedDelivery',
  async (orderDate: Date, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get('/purchasesettings/expected-delivery', {
        params: { order_date: orderDate.toISOString() }
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Calculation failed');
    }
  }
);

// Validate invoice date
export const validateInvoiceDate = createAsyncThunk(
  'purchaseDateSettings/validateInvoiceDate',
  async ({ invoiceDate, orderDate }: { invoiceDate: Date; orderDate: Date }, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get('/purchasesettings/validate-invoice-date', {
        params: {
          invoice_date: invoiceDate.toISOString(),
          order_date: orderDate.toISOString()
        }
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Validation failed');
    }
  }
);

const purchaseDateSettingsSlice = createSlice({
  name: 'purchaseDateSettings',
  initialState,
  reducers: {
    updateOrderDateRestriction: (state, action: PayloadAction<UpdateRestrictionPayload>) => {
      if (state.settings) {
        state.settings.orderDateRestriction = {
          ...state.settings.orderDateRestriction,
          ...action.payload
        };
      }
    },
    updateExpectedDeliveryDays: (state, action: PayloadAction<number>) => {
      if (state.settings) {
        state.settings.expectedDeliveryDays = action.payload;
      }
    },
    updateInvoiceRestriction: (state, action: PayloadAction<UpdateInvoicePayload>) => {
      if (state.settings) {
        state.settings.invoiceDateRestriction = action.payload.type;
        if (action.payload.days !== undefined) {
          state.settings.invoiceDaysAfterOrder = action.payload.days;
        }
      }
    },
    resetSettings: () => initialState,
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch settings
      .addCase(fetchDateSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDateSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchDateSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Save settings
      .addCase(saveDateSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveDateSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(saveDateSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      
  }
});

export const {
  updateOrderDateRestriction,
  updateExpectedDeliveryDays,
  updateInvoiceRestriction,
  resetSettings,
  clearError
} = purchaseDateSettingsSlice.actions;

export default purchaseDateSettingsSlice.reducer;