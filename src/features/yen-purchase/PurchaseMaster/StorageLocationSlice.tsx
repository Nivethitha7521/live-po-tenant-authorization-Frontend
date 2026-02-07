import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { initialState, StorageLocationItem,Location } from '@/Models/storagelocation';
import { ImportResult } from '@/Models/importResult';

export const fetchStorageLocations = createAsyncThunk('storageLocations/fetchStorageLocations', async () => {
  const response = await axios.get('http://192.168.1.142:8000/purchaseapi/storagelocations/');
  return response.data;
});

export const fetchLocations = createAsyncThunk('locations/fetchLocations', async () => {
  const response = await axios.get('https://yenerp.com/fastapi/branches/');
  return response.data;
});

export const addStorageLocation = createAsyncThunk<StorageLocationItem, StorageLocationItem>('storageLocations/addStorageLocation', async (locationData, { rejectWithValue }) => {
  try {
    const response = await axios.post('http://192.168.1.142:8000/purchaseapi/storagelocations/', locationData);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.detail || error.message);
  }
});

export const updateStorageLocation = createAsyncThunk<StorageLocationItem, StorageLocationItem>('storageLocations/updateStorageLocation', async (locationData, { rejectWithValue }) => {
  try {
    const response = await axios.put(`http://192.168.1.142:8000/purchaseapi/storagelocations/${locationData.storageLocationId}`, locationData);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.detail || error.message);
  }
});

export const deactivateStorageLocation = createAsyncThunk<StorageLocationItem, string>('storageLocations/deactivateStorageLocation', async (storageLocationId, { rejectWithValue }) => {
  try {
    const response = await axios.put(`http://192.168.1.142:8000/purchaseapi/storagelocations/${storageLocationId}`, { status: 'deactivated' });
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.detail || error.message);
  }
});

export const activateStorageLocation = createAsyncThunk<StorageLocationItem, string>('storageLocations/activateStorageLocation', async (storageLocationId, { rejectWithValue }) => {
  try {
    const response = await axios.put(`http://192.168.1.142:8000/purchaseapi/storagelocations/${storageLocationId}`, { status: 'active' });
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.detail || error.message);
  }
});
export const importStorageLocation = createAsyncThunk<ImportResult, File>(
  'storageLocations/importStorageLocation',
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
      const response = await axios.post('http://192.168.1.142:8000/purchaseapi/storagelocations/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as ImportResult;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { detail: 'Failed to import CSV' });
    }
  }
);

export const exportStorageLocation = createAsyncThunk(
  'storageLocation/export',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        'http://192.168.1.142:8000/purchaseapi/storagelocations/exportstoragelocation/export-csv',
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'storagelocations.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { message: 'Export successful' };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

const storageLocationSlice = createSlice({
  name: 'storageLocations',
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit' | 'deactivated'>) {
      state.dialogOpen = action.payload;
    },
    setStorageLocationData(state, action: PayloadAction<StorageLocationItem>) {
      state.storageLocationData = action.payload;
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
    setEditIndex(state, action: PayloadAction<string | null>) {
      state.editIndex = action.payload;
    },
    setLocationNameTouched(state, action: PayloadAction<boolean>) {
      state.locationNameTouched = action.payload;
    },
   resetImportState(state) {
      state.importSuccess = false;
      state.importError = null;
      state.importResult = null;
      state.showImportResultDialog = false;
      state.snackbarOpen = false;
      state.snackbarMessage = '';
      state.importing = false;
    },
    resetExportState(state) {
      state.exportSuccess = false;
      state.exportError = null;
      state.exporting = false;
    },
    setShowImportResultDialog(state, action: PayloadAction<boolean>) {
      state.showImportResultDialog = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStorageLocations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchStorageLocations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((item: StorageLocationItem) => item.status === 'active');
        state.deactivatedItems = action.payload.filter((item: StorageLocationItem) => item.status === 'deactivated');
      })
      .addCase(fetchStorageLocations.rejected, (state) => {
        state.loading = false;
      })
       .addCase(fetchLocations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLocations.fulfilled, (state, action) => {
        state.loading = false;
        state.location = action.payload.filter((location: Location) => location.status === '1');
      })
      .addCase(fetchLocations.rejected, (state) => {
        state.loading = false;
      })
      .addCase(addStorageLocation.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.storageLocationData = initialState.storageLocationData; // Reset form state
      })
      .addCase(updateStorageLocation.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.storageLocationId === action.payload.storageLocationId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deactivateStorageLocation.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.storageLocationId === action.payload.storageLocationId);
        if (index !== -1) {
          state.items[index].status = 'deactivated';
          state.deactivatedItems.push(state.items[index]);
          state.items.splice(index, 1);
        }
      })
      .addCase(activateStorageLocation.fulfilled, (state, action) => {
        const index = state.deactivatedItems.findIndex((item) => item.storageLocationId === action.payload.storageLocationId);
        if (index !== -1) {
          state.deactivatedItems[index].status = 'active';
          state.items.push(state.deactivatedItems[index]);
          state.deactivatedItems.splice(index, 1);
        }
      })
     .addCase(importStorageLocation.pending, (state) => {
        state.importing = true;
        state.importSuccess = false;
        state.importError = null;
        state.importResult = null;
      })
      .addCase(importStorageLocation.fulfilled, (state, action) => {
        state.importing = false;
        state.importSuccess = true;
        state.importResult = action.payload;
        state.showImportResultDialog = true;
        state.snackbarMessage = action.payload.message || 'Storage locations imported successfully';
        state.snackbarOpen = true;
      })
      .addCase(importStorageLocation.rejected, (state, action: any) => {
        state.importError = action.payload as string || 'Import failed';
        state.snackbarMessage = state.importError;
        state.snackbarOpen = true;
      })
      .addCase(exportStorageLocation.pending, (state) => {
        state.exporting = true;
        state.exportSuccess = false;
        state.exportError = null;
      })
      .addCase(exportStorageLocation.fulfilled, (state) => {
        state.exporting = false;
        state.exportSuccess = true;
        state.snackbarMessage = 'Storage locations exported successfully';
        state.snackbarOpen = true;
      })
      .addCase(exportStorageLocation.rejected, (state, action: any) => {
        state.exporting = false;
        state.exportError = action.payload?.detail?.message || action.payload?.detail || 'Failed to export CSV';
        state.snackbarMessage = `Export failed: ${action.payload?.detail?.message || action.payload?.detail || 'Unknown error'}`;
        state.snackbarOpen = true;
      });
  },
});

export const {
  setSearchQuery,
  setDialogOpen,
  setStorageLocationData,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  setEditIndex,
  setLocationNameTouched,
 resetImportState,
  resetExportState,
  setShowImportResultDialog,
} = storageLocationSlice.actions;

export const selectStorageLocations = (state: RootState) => state.storageLocations;
export const selectImportError = (state: RootState) => state.storageLocations.importError;
export const selectExportError = (state: RootState) => state.storageLocations.exportError;

export default storageLocationSlice.reducer;