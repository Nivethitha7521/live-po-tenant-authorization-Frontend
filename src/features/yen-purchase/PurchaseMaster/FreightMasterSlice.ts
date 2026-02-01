'use client';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import purchaseApi from '@/utils/api'; // ✅ USE purchaseApi
import { RootState } from '@/redux/store';
import { initialState, Freight, ImportResult } from '@/Models/freightModel';

// ✅ ADD PERMISSIONS TO INITIAL STATE (SAME AS GROUP MASTER)
const initialStateWithPermissions = {
  ...initialState,
  permissions: {
    canAdd: false,
    canEdit: false,
    canDelete: false,
    canRead: false,
    canImport: false,
    canExport: false
  }
};

// ✅ UPDATE ALL API CALLS TO USE purchaseApi

// Async thunk to fetch all Freight items
export const fetchFreightItems = createAsyncThunk(
  'freightItems/fetchFreightItems',
  async (_, { rejectWithValue }) => {
    try {
      console.log('🟡 Fetching all freight items...');
      const response = await purchaseApi.get<Freight[]>('/freights/');
      console.log('✅ Raw API response:', response.data);
      console.log('✅ Total items:', response.data.length);
      console.log('✅ Active items:', response.data.filter(item => item.status === 'active').length);
      console.log('✅ Inactive items:', response.data.filter(item => item.status === 'inactive').length);
      return response.data;
    } catch (error: any) {
      console.log('❌ Error fetching freight items:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch freight items');
    }
  }
);
  


export const addFreightItem = createAsyncThunk<Freight, Omit<Freight, 'freightId'>>(
  'freightItems/addFreightItem',
  async (freightData, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.post('/freights/', freightData); // ✅ USE purchaseApi
      return response.data;
    } catch (error: any) {
      console.log('🔴 API Error Response:', error.response);
      console.log('🔴 API Error Data:', error.response?.data);
      console.log('🔴 API Error Status:', error.response?.status);
      
      // Handle 422 validation errors (array of errors)
      if (error.response?.status === 422 && Array.isArray(error.response?.data)) {
        const firstError = error.response.data[0];
        const errorMsg = firstError?.msg || firstError?.message || 'Validation failed';
        return rejectWithValue(errorMsg);
      }
      
      const errorMsg = error.response?.data?.detail || 
                      error.response?.data?.message || 
                      error.message || 
                      'Failed to add freight item';
      return rejectWithValue(errorMsg);
    }
  }
);

// Async thunk to update an existing Freight item
export const updateFreightItem = createAsyncThunk<Freight, Freight>(
  'freightItems/updateFreightItem',
  async (freightData, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(
        `/freights/${freightData.freightId}`,
        freightData
      ); // ✅ USE purchaseApi
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update freight item');
    }
  }
);

// Async thunk to deactivate a Freight item
export const deactivateFreightItem = createAsyncThunk<Freight, string>(
  'freightItems/deactivateFreightItem',
  async (freightId, { rejectWithValue }) => {
    try {
      console.log('🟡 Deactivating freight ID:', freightId);
      const response = await purchaseApi.patch(`/freights/${freightId}/deactivate`);
      console.log('✅ Deactivation response:', response.data);
      return response.data;
    } catch (error: any) {
      console.log('❌ Deactivation failed:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to deactivate freight item');
    }
  }
);
// Async thunk to activate a Freight item
export const activateFreightItem = createAsyncThunk<Freight, string>(
  'freightItems/activateFreightItem',
  async (freightId, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(`/freights/${freightId}/activate`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to activate freight item');
    }
  }
);

// Async thunk for importing CSV
export const importCSV = createAsyncThunk<ImportResult, File>(
  'freightItems/importCSV',
  async (file: File, { rejectWithValue }) => {
    if (!file || file.size === 0) {
      return rejectWithValue('Please select a CSV file to import');
    }
    if (!file.name.endsWith('.csv')) {
      return rejectWithValue('Invalid file format. Please upload a CSV file');
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await purchaseApi.post(
        '/freights/import-csv',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      ); // ✅ USE purchaseApi
      return response.data as ImportResult;
    } catch (error: any) {
      // Always return string
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        return rejectWithValue(errorDetail);
      } else if (typeof errorDetail === 'object' && errorDetail.message) {
        return rejectWithValue(errorDetail.message);
      } else {
        return rejectWithValue('Failed to import CSV');
      }
    }
  }
);

// Async thunk for exporting CSV
export const exportCSV = createAsyncThunk('freightItems/exportCSV', async (_, { rejectWithValue }) => {
  try {
    const response = await purchaseApi.get('/freights/export-csv', {
      responseType: 'blob',
     
    }); // ✅ USE purchaseApi
    console.log('Export CSV response status:', response.status, 'headers:', response.headers);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'freights_export.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error: any) {
    console.error('Export CSV error:', error);
    if (error.response?.data) {
      const blob = error.response.data;
      let errorMessage = 'Failed to export CSV';
      try {
        const text = await new Response(blob).text();
        try {
          const parsed = JSON.parse(text);
          errorMessage = parsed.detail || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
      } catch {
        errorMessage = 'Unable to parse error response';
      }
      return rejectWithValue(errorMessage);
    }
    return rejectWithValue('Failed to export CSV');
  }
});

// ✅ KEEP THE REST OF YOUR SLICE EXACTLY THE SAME
const freightSlice = createSlice({
  name: 'freightItems',
  initialState: initialStateWithPermissions, // ✅ USE UPDATED INITIAL STATE
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit' | 'deactivated'>) {
      console.log('setDialogOpen dispatched with:', action.payload);
      state.dialogOpen = action.payload;
    },
    setFreightData(state, action: PayloadAction<Freight>) {
      state.freightData = action.payload;
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    setShowDeactivated(state, action: PayloadAction<boolean>) {
      state.showDeactivated = action.payload;
    },
    setEditIndex(state, action: PayloadAction<number | null>) {
      state.editIndex = action.payload;
    },
    setShowImportResultDialog(state, action: PayloadAction<boolean>) {
      state.showImportResultDialog = action.payload;
    },
    resetImportState(state) {
      state.importSuccess = false;
      state.importError = null;
      state.importResult = null;
      state.showImportResultDialog = false;
      state.snackbarOpen = false;
      state.snackbarMessage = '';
    },
    resetExportState(state) {
      state.exportSuccess = false;
      state.exportError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Freight Items
      .addCase(fetchFreightItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchFreightItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((item) => item.status === 'active');
        state.deactivatedItems = action.payload.filter((item) => item.status === 'inactive');
      })
      .addCase(fetchFreightItems.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Add Freight Item - SINGLE REDUCER ONLY
      .addCase(addFreightItem.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.snackbarMessage = 'Freight item added successfully';
        state.snackbarOpen = true;
      })
      .addCase(addFreightItem.rejected, (state, action) => {
        console.log('🔴 Add Freight Rejected Payload:', action.payload);
        
        let errorMessage = 'Failed to add freight item';
        const payload = action.payload as any;
        
        if (typeof payload === 'string') {
          errorMessage = payload;
        } else if (Array.isArray(payload)) {
          const firstError = payload[0];
          errorMessage = firstError?.msg || firstError?.message || 'Validation failed';
        } else if (payload && typeof payload === 'object') {
          errorMessage = payload.msg || payload.message || payload.detail || errorMessage;
        }
        
        console.log('🔴 Final error message:', errorMessage);
        state.snackbarMessage = errorMessage;
        state.snackbarOpen = true;
      })
      // Update Freight Item
      .addCase(updateFreightItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.freightId === action.payload.freightId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.snackbarMessage = 'Freight item updated successfully';
        state.snackbarOpen = true;
      })
      .addCase(updateFreightItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Deactivate Freight Item
      .addCase(deactivateFreightItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.freightId === action.payload.freightId);
        if (index !== -1) {
          state.items[index].status = 'deactivated';
          state.deactivatedItems.push(state.items[index]);
          state.items.splice(index, 1);
        }
        state.snackbarMessage = 'Freight item deactivated successfully';
        state.snackbarOpen = true;
      })
      .addCase(deactivateFreightItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Activate Freight Item
      .addCase(activateFreightItem.fulfilled, (state, action) => {
        const index = state.deactivatedItems.findIndex((item) => item.freightId === action.payload.freightId);
        if (index !== -1) {
          state.deactivatedItems[index].status = 'active';
          state.items.push(state.deactivatedItems[index]);
          state.deactivatedItems.splice(index, 1);
        }
        state.snackbarMessage = 'Freight item activated successfully';
        state.snackbarOpen = true;
      })
      .addCase(activateFreightItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Import CSV
      .addCase(importCSV.pending, (state) => {
        state.importing = true;
        state.importSuccess = false;
        state.importError = null;
        state.importResult = null;
      })
      .addCase(importCSV.fulfilled, (state, action) => {
        state.importing = false;
        state.importSuccess = true;
        state.importResult = action.payload;
        state.showImportResultDialog = true;
        state.snackbarMessage = action.payload.message || 'Freight items imported successfully';
        state.snackbarOpen = true;
      })
      .addCase(importCSV.rejected, (state, action) => {
        state.importing = false;
        
        let errorMessage = 'Failed to import CSV';
        const payload = action.payload as any;
        
        if (typeof payload === 'string') {
          errorMessage = payload;
        } else if (payload && typeof payload === 'object') {
          errorMessage = payload.msg || payload.message || payload.detail || errorMessage;
        }
        
        state.importError = errorMessage;
        state.importResult = {
          detail: {
            message: errorMessage,
            missing: [],
            required: [],
          },
        };
        state.showImportResultDialog = true;
        state.snackbarMessage = errorMessage;
        state.snackbarOpen = true;
      })
      // Export CSV
      .addCase(exportCSV.pending, (state) => {
        state.exporting = true;
        state.exportSuccess = false;
        state.exportError = null;
      })
      .addCase(exportCSV.fulfilled, (state) => {
        state.exporting = false;
        state.exportSuccess = true;
        state.snackbarMessage = 'Freight items exported successfully';
        state.snackbarOpen = true;
      })
      .addCase(exportCSV.rejected, (state, action) => {
        state.exporting = false;
        
        let errorMessage = 'Failed to export CSV';
        const payload = action.payload as any;
        
        if (typeof payload === 'string') {
          errorMessage = payload;
        } else if (payload && typeof payload === 'object') {
          errorMessage = payload.msg || payload.message || payload.detail || errorMessage;
        }
        
        state.exportError = errorMessage;
        state.snackbarMessage = errorMessage;
        state.snackbarOpen = true;
      });
  },
});

// Export actions
export const {
  setSearchQuery,
  setDialogOpen,
  setFreightData,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  setEditIndex,
  setShowImportResultDialog,
  resetImportState,
  resetExportState,
} = freightSlice.actions;

// Selector to get Freight state
export const selectFreightItems = (state: RootState) => state.freightItems;

// Export reducer
export default freightSlice.reducer;