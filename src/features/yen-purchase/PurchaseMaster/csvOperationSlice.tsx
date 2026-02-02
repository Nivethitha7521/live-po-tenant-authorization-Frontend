import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { ImportResult } from '@/Models/itemgroup';

// Interface for CSV operations state
interface CSVOperationsState {
  importing: boolean;
  exporting: boolean;
  importSuccess: boolean;
  exportSuccess: boolean;
  importError: string | null;
  exportError: string | null;
  importResult: ImportResult | null;
  showImportResultDialog: boolean;
  snackbarOpen: boolean;
  snackbarMessage: string;
}

// Initial state for CSV operations
const initialState: CSVOperationsState = {
  importing: false,
  exporting: false,
  importSuccess: false,
  exportSuccess: false,
  importError: null,
  exportError: null,
  importResult: null,
  showImportResultDialog: false,
  snackbarOpen: false,
  snackbarMessage: '',
};

// Async thunk for importing CSV
export const importCSV = createAsyncThunk(
  'csvOperations/importCSV',
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

      const response = await axios.post('http://127.0.0.1:8000/purchasetestapi/itemgroups/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data) { 
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ detail: 'Failed to import CSV' });
    }
  }
);

// Async thunk for exporting CSV
export const exportCSV = createAsyncThunk('csvOperations/exportCSV', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.get('http://127.0.0.1:8000/purchasetestapi/itemgroups/export-csv', {
      responseType: 'blob',
    });

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
    if (error.response && error.response.data) {
      const blob = error.response.data;
      const text = await new Response(blob).text();
      let errorMessage;
      try {
        errorMessage = JSON.parse(text).detail;
      } catch {
        errorMessage = 'Failed to export CSV';
      }
      return rejectWithValue({ detail: errorMessage });
    }
    return rejectWithValue({ detail: 'Failed to export CSV' });
  }
});

// Create the CSV operations slice
const csvOperationsSlice = createSlice({
  name: 'csvOperations',
  initialState,
  reducers: {
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
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    setShowImportResultDialog(state, action: PayloadAction<boolean>) {
      state.showImportResultDialog = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Import CSV cases
      .addCase(importCSV.pending, (state) => {
        state.importing = true;
        state.importSuccess = false;
        state.importError = null;
        state.importResult = null;
      })
      .addCase(importCSV.fulfilled, (state, action) => {
        state.importing = false;
        state.importSuccess = true;
        state.importResult = {
          inserted_count: action.payload.inserted_count || 0,
          updated_count: action.payload.updated_count || 0,
          successful: action.payload.successful || [],
          updated: action.payload.updated || [],
          failed: action.payload.failed || [],
          errorCount: action.payload.errorCount || 0,
          message: action.payload.message,
        };
        state.showImportResultDialog = true;
        state.snackbarMessage = action.payload.message || 'Item groups imported successfully';
        state.snackbarOpen = true;
      })
      .addCase(importCSV.rejected, (state, action: any) => {
        state.importing = false;
        state.importError = typeof action.payload?.detail === 'object' ? action.payload.detail.message : action.payload?.detail || 'Failed to import CSV';
        state.importResult = {
          detail: {
            message: typeof action.payload?.detail === 'object' ? action.payload.detail.message : action.payload?.detail || 'Failed to import CSV',
            missing: action.payload?.detail?.missing || [],
            required: action.payload?.detail?.required || [],
          },
        };
        state.showImportResultDialog = true;
        state.snackbarMessage = typeof action.payload?.detail === 'object' ? action.payload.detail.message : action.payload?.detail || 'Failed to import CSV';
        state.snackbarOpen = true;
      })
      // Export CSV cases
      .addCase(exportCSV.pending, (state) => {
        state.exporting = true;
        state.exportSuccess = false;
        state.exportError = null;
      })
      .addCase(exportCSV.fulfilled, (state) => {
        state.exporting = false;
        state.exportSuccess = true;
        state.snackbarMessage = 'Item groups exported successfully';
        state.snackbarOpen = true;
      })
      .addCase(exportCSV.rejected, (state, action: any) => {
        state.exporting = false;
        state.exportError = action.payload?.detail || 'Failed to export CSV';
        state.snackbarMessage = action.payload?.detail || 'Failed to export CSV';
        state.snackbarOpen = true;
      });
  },
});

// Export actions
export const { resetImportState, resetExportState, setSnackbarOpen, setSnackbarMessage, setShowImportResultDialog } =
  csvOperationsSlice.actions;

// Selector to get CSV operations state
export const selectCSVOperations = (state: RootState) => state.csvOperations;

// Export reducer
export default csvOperationsSlice.reducer;