'use client';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';
import { initialState, Freight, ImportResult } from '../../../Models/freightModel';

// Async thunk to fetch all Freight items
export const fetchFreightItems = createAsyncThunk(
  'freightItems/fetchFreightItems',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<Freight[]>('http://192.168.29.117:8000/purchaseapi/freights/');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch freight items');
    }
  }
);

// Async thunk to add a new Freight item
export const addFreightItem = createAsyncThunk<Freight, Omit<Freight, 'freightId'>>(
  'freightItems/addFreightItem',
  async (freightData, { rejectWithValue }) => {
    try {
      const response = await axios.post('http://192.168.29.117:8000/purchaseapi/freights/', freightData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add freight item');
    }
  }
);

// Async thunk to update an existing Freight item
export const updateFreightItem = createAsyncThunk<Freight, Freight>(
  'freightItems/updateFreightItem',
  async (freightData, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `http://192.168.29.117:8000/purchaseapi/freights/${freightData.freightId}`,
        freightData
      );
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
      const response = await axios.patch(`http://192.168.29.117:8000/purchaseapi/freights/${freightId}`, {
        status: 'deactivated',
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to deactivate freight item');
    }
  }
);

// Async thunk to activate a Freight item
export const activateFreightItem = createAsyncThunk<Freight, string>(
  'freightItems/activateFreightItem',
  async (freightId, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`http://192.168.29.117:8000/purchaseapi/freights/${freightId}`, {
        status: 'active',
      });
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
      return rejectWithValue({ detail: 'Please select a CSV file to import' });
    }
    if (!file.name.endsWith('.csv')) {
      return rejectWithValue({ detail: 'Invalid file format. Please upload a CSV file' });
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post('http://192.168.29.117:8000/purchaseapi/freights/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as ImportResult;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { detail: 'Failed to import CSV' });
    }
  }
);

// Async thunk for exporting CSV
export const exportCSV = createAsyncThunk('freightItems/exportCSV', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.get('http://192.168.29.117:8000/purchaseapi/freights/export-csv', {
      responseType: 'blob',
    });
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
      return rejectWithValue({ detail: errorMessage, status: error.response.status });
    }
    return rejectWithValue({ detail: 'Failed to export CSV', status: error.response?.status || 500 });
  }
});

// Create the Freight slice
const freightSlice = createSlice({
  name: 'freightItems',
  initialState,
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
        state.deactivatedItems = action.payload.filter((item) => item.status === 'deactivated');
      })
      .addCase(fetchFreightItems.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Add Freight Item
      .addCase(addFreightItem.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.snackbarMessage = 'Freight item added successfully';
        state.snackbarOpen = true;
      })
      .addCase(addFreightItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
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
      .addCase(importCSV.rejected, (state, action: any) => {
        state.importing = false;
        state.importError =
          typeof action.payload?.detail === 'object'
            ? action.payload.detail.message
            : action.payload?.detail || 'Failed to import CSV';
        state.importResult = {
          detail: {
            message:
              typeof action.payload?.detail === 'object'
                ? action.payload.detail.message
                : action.payload?.detail || 'Failed to import CSV',
            missing: action.payload?.detail?.missing || [],
            required: action.payload?.detail?.required || [],
          },
        };
        state.showImportResultDialog = true;
        state.snackbarMessage = `Import failed: ${action.payload?.detail || 'Unknown error'} (Status: ${action.payload?.status || 'Unknown'})`;
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
      .addCase(exportCSV.rejected, (state, action: any) => {
        state.exporting = false;
        state.exportError = action.payload?.detail || 'Failed to export CSV';
        state.snackbarMessage = `Export failed: ${action.payload?.detail || 'Unknown error'} (Status: ${action.payload?.status || 'Unknown'})`;
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