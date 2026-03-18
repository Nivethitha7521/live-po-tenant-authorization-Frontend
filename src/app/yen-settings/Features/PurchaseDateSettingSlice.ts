// features/yen-settings/PurchaseDateSettingSlice.ts - FIXED VERSION

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import purchaseApi from "@/utils/api";
import { defaultRestriction, initialState, PurchaseDateSettings, UpdateRestrictionPayload } from '../Models/Datesetting';


const getTenantId = (): string | null => {
  return sessionStorage.getItem("tenant_id");
};

// FETCH settings (GET)
export const fetchDateSettings = createAsyncThunk(
  'purchaseDateSettings/fetch',
  async (_, { rejectWithValue, getState }) => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) return rejectWithValue('Tenant ID not found');

      const response = await purchaseApi.get('/purchasesettings/', {
        headers: { 'x-tenant-id': tenantId }
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch settings');
    }
  }
);

// SAVE settings - FIXED VERSION
export const saveDateSettings = createAsyncThunk(
  'purchaseDateSettings/save',
  async (settings: PurchaseDateSettings, { rejectWithValue, dispatch }) => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) return rejectWithValue('Tenant ID not found');

      // Remove id from payload
      const { id, ...settingsToSend } = settings;
      
      console.log('📤 Attempting PATCH with tenant:', tenantId);
      
      // Try PATCH first (updates existing)
      const patchResponse = await purchaseApi.patch(
        '/purchasesettings/', 
        settingsToSend, 
        { headers: { 'x-tenant-id': tenantId } }
      );
      
      console.log('✅ PATCH successful');
      
      // IMPORTANT FIX: Return the settings that were sent, not the response
      // The PATCH endpoint returns { message: "Updated successfully" }
      return {
        ...settings,  // Use the settings we sent
        updatedAt: new Date().toISOString() // Add updated timestamp
      };
      
    } catch (error: any) {
      // If 404 (not found), then do POST (create new)
      if (error.response?.status === 404) {
        console.log('📤 Settings not found, attempting POST...');
        
        // Re-check tenant ID
        const tenantIdForPost = getTenantId();
        if (!tenantIdForPost) {
          return rejectWithValue('Tenant ID not found for POST request');
        }
        
        try {
          const { id, ...settingsToSend } = settings;
          
          // Add metadata for creation
          const postPayload = {
            ...settingsToSend,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          const postResponse = await purchaseApi.post(
            '/purchasesettings/', 
            postPayload,
            { headers: { 'x-tenant-id': tenantIdForPost } }
          );
          
          console.log('✅ POST successful with tenant:', tenantIdForPost);
          
          // IMPORTANT FIX: Return the settings with the response data merged
          // The POST endpoint returns the created document
          return {
            ...settings,  // Start with our settings
            ...postResponse.data, // Override with any server-generated fields
            id: postResponse.data._id || postResponse.data.id, // Ensure ID is set
            updatedAt: new Date().toISOString()
          };
          
        } catch (postError: any) {
          console.error('❌ POST failed:', postError);
          return rejectWithValue(postError.response?.data?.detail || 'Failed to create settings');
        }
      }
      
      return rejectWithValue(error.response?.data?.detail || 'Failed to save settings');
    }
  }
);

// VALIDATE date
export const validateDate = createAsyncThunk(
  'purchaseDateSettings/validateDate',
  async ({ date, dateType, orderDate }: { 
    date: Date; 
    dateType: 'order' | 'expected' | 'invoice';
    orderDate?: Date;
  }, { rejectWithValue }) => {
    try {
      const tenantId = getTenantId();
      let url = `/purchasesettings/validate/${dateType}?date=${encodeURIComponent(date.toISOString())}`;
      
      if (orderDate) {
        url += `&order_date=${encodeURIComponent(orderDate.toISOString())}`;
      }

      const response = await purchaseApi.get(url, {
        headers: { "x-tenant-id": tenantId }
      });
      
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Validation failed');
    }
  }
);

// CALCULATE expected delivery
export const calculateExpectedDelivery = createAsyncThunk(
  'purchaseDateSettings/calculateExpectedDelivery',
  async (orderDate: Date, { rejectWithValue }) => {
    try {
      const tenantId = getTenantId();
      const response = await purchaseApi.get('/purchasesettings/calculate-expected', {
        params: { order_date: orderDate.toISOString() },
        headers: { 'x-tenant-id': tenantId }
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Calculation failed');
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
    updateExpectedDeliveryRestriction: (state, action: PayloadAction<UpdateRestrictionPayload>) => {
      if (state.settings) {
        state.settings.expectedDeliveryRestriction = {
          ...state.settings.expectedDeliveryRestriction,
          ...action.payload
        };
      }
    },
    updateInvoiceDateRestriction: (state, action: PayloadAction<UpdateRestrictionPayload>) => {
      if (state.settings) {
        state.settings.invoiceDateRestriction = {
          ...state.settings.invoiceDateRestriction,
          ...action.payload
        };
      }
    },
    updateExpectedDeliveryDays: (state, action: PayloadAction<number>) => {
      if (state.settings) {
        state.settings.expectedDeliveryDays = action.payload;
      }
    },
    updateInvoiceDaysAfterOrder: (state, action: PayloadAction<number>) => {
      if (state.settings) {
        state.settings.invoiceDaysAfterOrder = action.payload;
      }
    },
    resetSettings: () => initialState,
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // FETCH
      .addCase(fetchDateSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDateSettings.fulfilled, (state, action) => {
        state.loading = false;
        const settings = action.payload;
        state.settings = {
          orderDateRestriction: settings.orderDateRestriction || defaultRestriction,
          expectedDeliveryRestriction: settings.expectedDeliveryRestriction || { 
            ...defaultRestriction, 
            restrictionType: 'days_after', 
            daysValue: 7 
          },
          invoiceDateRestriction: settings.invoiceDateRestriction || { 
            ...defaultRestriction, 
            restrictionType: 'days_after', 
            daysValue: 0 
          },
          expectedDeliveryDays: settings.expectedDeliveryDays || 7,
          invoiceDaysAfterOrder: settings.invoiceDaysAfterOrder || 0,
          ...settings
        };
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchDateSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // SAVE - FIXED: Now properly updates state
      .addCase(saveDateSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveDateSettings.fulfilled, (state, action) => {
        state.loading = false;
        // IMPORTANT FIX: Update state with the returned settings
        state.settings = action.payload;
        state.lastUpdated = new Date().toISOString();
        
        // Don't auto-fetch - we already have the data!
        console.log('✅ Redux state updated with saved settings');
      })
      .addCase(saveDateSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const {
  updateOrderDateRestriction,
  updateExpectedDeliveryRestriction,
  updateInvoiceDateRestriction,
  updateExpectedDeliveryDays,
  updateInvoiceDaysAfterOrder,
  resetSettings,
  clearError
} = purchaseDateSettingsSlice.actions;

export default purchaseDateSettingsSlice.reducer;