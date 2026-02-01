'use client';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import purchaseApi from '@/utils/api'; // ✅ USE purchaseApi
import { RootState } from '@/redux/store';
import { initialState, PurchaseGroupItem, ImportResult } from '@/Models/itemgroup';

// ✅ REMOVE getAuthHeaders COMPLETELY - purchaseApi handles headers

// ✅ ADD PERMISSIONS TO INITIAL STATE (ONLY THIS LINE CHANGE)
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

// Async thunk to fetch all Purchase Group items
export const fetchPurchaseGroupItems = createAsyncThunk(
  'purchaseGroupItems/fetchPurchaseGroupItems',
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get<PurchaseGroupItem[]>('/itemgroups/'); // ✅ USE purchaseApi
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch purchase group items');
    }
  }
);

export const addPurchaseGroupItem = createAsyncThunk<PurchaseGroupItem, Omit<PurchaseGroupItem, 'itemgroupId'>>(
  'purchaseGroupItems/addPurchaseGroupItem',
  async (groupItemData, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.post('/itemgroups/', groupItemData); // ✅ USE purchaseApi
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
                      'Failed to add purchase group item';
      return rejectWithValue(errorMsg);
    }
  }
);

// Async thunk to update an existing Purchase Group item
export const updatePurchaseGroupItem = createAsyncThunk<PurchaseGroupItem, PurchaseGroupItem>(
  'purchaseGroupItems/updatePurchaseGroupItem',
  async (groupItemData, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(
        `/itemgroups/${groupItemData.itemgroupId}`,
        groupItemData
      ); // ✅ USE purchaseApi
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update purchase group item');
    }
  }
);

// Async thunk to deactivate a Purchase Group item
export const deactivatePurchaseGroupItem = createAsyncThunk<PurchaseGroupItem, string>(
  'purchaseGroupItems/deactivatePurchaseGroupItem',
  async (itemgroupId, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(
        `/itemgroups/${itemgroupId}`, 
        { status: 'deactivated' }
      ); // ✅ USE purchaseApi
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to deactivate purchase group item');
    }
  }
);

// Async thunk to activate a Purchase Group item
export const activatePurchaseGroupItem = createAsyncThunk<PurchaseGroupItem, string>(
  'purchaseGroupItems/activatePurchaseGroupItem',
  async (itemgroupId, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.patch(
        `/itemgroups/${itemgroupId}`,
        { status: 'active' }
      ); // ✅ USE purchaseApi
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to activate purchase group item');
    }
  }
);

// Async thunk for importing CSV
export const importCSV = createAsyncThunk<ImportResult, File>(
  'purchaseGroupItems/importCSV',
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
        '/itemgroups/import-csv',
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
export const exportCSV = createAsyncThunk('purchaseGroupItems/exportCSV', async (_, { rejectWithValue }) => {
  try {
     const username = localStorage.getItem('username')
    const response = await purchaseApi.get('/itemgroups/export-csv', {
      responseType: 'blob',
      headers: {
            'x-username': username // ✅ ADD HEADER MANUALLY
          }
    }); // ✅ USE purchaseApi
    console.log('Export CSV response status:', response.status, 'headers:', response.headers);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'itemgroups_export.csv');
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
const purchaseGroupItemSlice = createSlice({
  name: 'purchaseGroupItems',
  initialState: initialStateWithPermissions, // ✅ USE UPDATED INITIAL STATE
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit' | 'deactivated'>) {
      console.log('setDialogOpen dispatched with:', action.payload);
      state.dialogOpen = action.payload;
    },
    setPurchaseGroupItemData(state, action: PayloadAction<PurchaseGroupItem>) {
      state.purchaseGroupItemData = action.payload;
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
      // Fetch Purchase Group Items
      .addCase(fetchPurchaseGroupItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseGroupItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((item) => item.status === 'active');
        state.deactivatedItems = action.payload.filter((item) => item.status === 'deactivated');
      })
      .addCase(fetchPurchaseGroupItems.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Add Purchase Group Item - SINGLE REDUCER ONLY
      .addCase(addPurchaseGroupItem.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.snackbarMessage = 'Purchase group item added successfully';
        state.snackbarOpen = true;
      })
      .addCase(addPurchaseGroupItem.rejected, (state, action) => {
        console.log('🔴 Add Item Group Rejected Payload:', action.payload);
        
        let errorMessage = 'Failed to add purchase group item';
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
      // Update Purchase Group Item
      .addCase(updatePurchaseGroupItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.itemgroupId === action.payload.itemgroupId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.snackbarMessage = 'Purchase group item updated successfully';
        state.snackbarOpen = true;
      })
      .addCase(updatePurchaseGroupItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Deactivate Purchase Group Item
      .addCase(deactivatePurchaseGroupItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.itemgroupId === action.payload.itemgroupId);
        if (index !== -1) {
          state.items[index].status = 'deactivated';
          state.deactivatedItems.push(state.items[index]);
          state.items.splice(index, 1);
        }
        state.snackbarMessage = 'Purchase group item deactivated successfully';
        state.snackbarOpen = true;
      })
      .addCase(deactivatePurchaseGroupItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Activate Purchase Group Item
      .addCase(activatePurchaseGroupItem.fulfilled, (state, action) => {
        const index = state.deactivatedItems.findIndex((item) => item.itemgroupId === action.payload.itemgroupId);
        if (index !== -1) {
          state.deactivatedItems[index].status = 'active';
          state.items.push(state.deactivatedItems[index]);
          state.deactivatedItems.splice(index, 1);
        }
        state.snackbarMessage = 'Purchase group item activated successfully';
        state.snackbarOpen = true;
      })
      .addCase(activatePurchaseGroupItem.rejected, (state, action) => {
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
        state.snackbarMessage = action.payload.message || 'Purchase group items imported successfully';
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
        state.snackbarMessage = 'Purchase group items exported successfully';
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
  setPurchaseGroupItemData,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  setEditIndex,
  setShowImportResultDialog,
  resetImportState,
  resetExportState,
} = purchaseGroupItemSlice.actions;

// Selector to get Purchase Group state
export const selectPurchaseGroupItems = (state: RootState) => state.groupItems;

// Export reducer
export default purchaseGroupItemSlice.reducer;