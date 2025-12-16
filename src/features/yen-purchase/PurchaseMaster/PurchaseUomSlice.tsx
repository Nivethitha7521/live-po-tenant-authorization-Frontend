import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { initialState, UOMItem } from '@/Models/uom';

export const fetchUOMItems = createAsyncThunk<UOMItem[]>('uom/fetchUOMItems', async () => {
  const response = await axios.get('https://yenerp.com/purchaseapi/purchaseuoms/');
  return response.data;
});

export const addUOMItem = createAsyncThunk<UOMItem, UOMItem>('uom/addUOMItem', async (uomData) => {
  const response = await axios.post('https://yenerp.com/purchaseapi/purchaseuoms', uomData);
  return response.data;
});

export const updateUOMItem = createAsyncThunk<UOMItem, UOMItem>('uom/updateUOMItem', async (uomData) => {
  const response = await axios.put(`https://yenerp.com/purchaseapi/purchaseuoms/${uomData.purchaseuomId}`, uomData);
  return response.data;
});

export const deactivateUOMItem = createAsyncThunk<UOMItem, string>('uom/deactivateUOMItem', async (purchaseuomId) => {
  const response = await axios.put(`https://yenerp.com/purchaseapi/purchaseuoms/${purchaseuomId}`, { status: 'deactivated' });
  return response.data;
});

export const activateUOMItem = createAsyncThunk<UOMItem, string>('uom/activateUOMItem', async (purchaseuomId) => {
  const response = await axios.put(`https://yenerp.com/purchaseapi/purchaseuoms/${purchaseuomId}`, { status: 'active' });
  return response.data;
});

export const importPurchaseUom = createAsyncThunk(
  'purchaseUoms/import',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(
        'https://yenerp.com/purchaseapi/purchaseuoms/import-csv',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      console.log('UOM Import API response:', response.data); // Debug log
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
});

export const exportPurchaseUom = createAsyncThunk(
  'purchaseUoms/export',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        'https://yenerp.com/purchaseapi/purchaseuoms/export-uom/export-csv',
        {
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'purchase_uoms.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { message: 'Export successful' };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
});

const purchaseUomSlice = createSlice({
  name: 'uom',
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit' | 'deactivated'>) {
      state.dialogOpen = action.payload;
    },
    setUOMData(state, action: PayloadAction<UOMItem>) {
      state.uomData = action.payload;
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
    resetImportStatus(state) {
      state.importStatus = 'idle';
      state.importError = null;
    },
    resetExportStatus(state) {
      state.exportStatus = 'idle';
      state.exportError = null;
    },
    setShowImportResultDialog(state, action: PayloadAction<boolean>) {
      state.showImportResultDialog = action.payload;
    },
    resetImportResult(state) {
      state.importResult = null;
      state.showImportResultDialog = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUOMItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUOMItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((item) => item.status === 'active');
        state.deactivatedItems = action.payload.filter((item) => item.status === 'deactivated');
      })
      .addCase(fetchUOMItems.rejected, (state) => {
        state.loading = false;
      })
      .addCase(addUOMItem.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateUOMItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.purchaseuomId === action.payload.purchaseuomId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deactivateUOMItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.purchaseuomId === action.payload.purchaseuomId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(activateUOMItem.fulfilled, (state, action) => {
        const index = state.deactivatedItems.findIndex((item) => item.purchaseuomId === action.payload.purchaseuomId);
        if (index !== -1) {
          state.deactivatedItems[index] = action.payload;
        }
      })
      .addCase(importPurchaseUom.pending, (state) => {
        state.importStatus = 'loading';
        state.importError = null;
      })
      .addCase(importPurchaseUom.fulfilled, (state, action) => {
        state.importStatus = 'succeeded';
        state.importResult = {
          new_count: action.payload.new_count || action.payload.added || 0,
          updated_count: action.payload.updated_count || action.payload.updated || 0,
          duplicate_in_csv_count: action.payload.duplicate_in_csv_count || action.payload.skipped || 0,
        };
        state.showImportResultDialog = true;
        state.snackbarMessage = action.payload.message || 'UOMs imported successfully';
        state.snackbarOpen = true;
      })
      .addCase(importPurchaseUom.rejected, (state, action) => {
        state.importStatus = 'failed';
        state.importError = action.payload as string || 'Import failed';
        state.snackbarMessage = state.importError;
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseUom.pending, (state) => {
        state.exportStatus = 'loading';
        state.exportError = null;
      })
      .addCase(exportPurchaseUom.fulfilled, (state) => {
        state.exportStatus = 'succeeded';
        state.snackbarMessage = 'Export completed successfully';
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseUom.rejected, (state, action) => {
        state.exportStatus = 'failed';
        state.exportError = action.payload as string || 'Export failed';
        state.snackbarMessage = state.exportError;
        state.snackbarOpen = true;
      });
  },
});

export const {
  setSearchQuery,
  setDialogOpen,
  setUOMData,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  setEditIndex,
  resetImportStatus,
  resetExportStatus,
  setShowImportResultDialog,
  resetImportResult,
} = purchaseUomSlice.actions;

export const selectUOMItems = (state: RootState) => state.purchaseUom;
export const selectImportStatus = (state: RootState) => state.purchaseUom.importStatus;
export const selectExportStatus = (state: RootState) => state.purchaseUom.exportStatus;
export const selectImportError = (state: RootState) => state.purchaseUom.importError;
export const selectExportError = (state: RootState) => state.purchaseUom.exportError;
export const selectImportResult = (state: RootState) => state.purchaseUom.importResult;
export const selectShowImportResultDialog = (state: RootState) => state.purchaseUom.showImportResultDialog;

export default purchaseUomSlice.reducer;