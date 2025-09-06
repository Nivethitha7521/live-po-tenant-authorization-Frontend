// purchaseTaxSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { initialState, PurchaseTax } from '@/Models/purchasetax';

export const fetchPurchaseTaxes = createAsyncThunk<PurchaseTax[]>('purchaseTaxes/fetch', async () => {
  try {
    const response = await axios.get('http://192.168.29.117:8000/purchaseapi/purchasetaxes/');
    return response.data;
  } catch (error: any) {
    throw Error(`Failed to fetch purchase taxes: ${error.message}`);
  }
});

export const addPurchaseTax = createAsyncThunk<PurchaseTax, Omit<PurchaseTax, 'purchasetaxId'>>(
  'purchaseTaxes/add',
  async (tax) => {
    try {
      const response = await axios.post('http://192.168.29.117:8000/purchaseapi/purchasetaxes', tax);
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to add purchase tax: ${error.message}`);
    }
  }
);

export const updatePurchaseTax = createAsyncThunk<PurchaseTax, PurchaseTax>(
  'purchaseTaxes/update',
  async (tax, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `http://192.168.29.117:8000/purchaseapi/purchasetaxes/${tax.purchasetaxId}`,
        tax
      );
      if (!response.data) {
        return rejectWithValue('Empty response from backend');
      }
      return { ...tax, ...response.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const deactivatePurchaseTax = createAsyncThunk<PurchaseTax, string>(
  'purchaseTaxes/deactivate',
  async (id) => {
    try {
      const response = await axios.patch(`http://192.168.29.117:8000/purchaseapi/purchasetaxes/${id}`, { status: 'deactivated' });
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to deactivate purchase tax: ${error.message}`);
    }
  }
);

export const activatePurchaseTax = createAsyncThunk<PurchaseTax, string>(
  'purchaseTaxes/activate',
  async (id) => {
    try {
      const response = await axios.patch(`http://192.168.29.117:8000/purchaseapi/purchasetaxes/${id}`, { status: 'active' });
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to activate purchase tax: ${error.message}`);
    }
  }
);

export const importPurchaseTaxes = createAsyncThunk(
  'purchaseTaxes/import',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(
        'http://192.168.29.117:8000/purchaseapi/purchasetaxes/import-csv',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      console.log('Tax Import API response:', {
        response: response.data,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
      return response.data;
    } catch (error: any) {
      console.error('Tax Import error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const exportPurchaseTaxes = createAsyncThunk(
  'purchaseTaxes/export',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        'http://192.168.29.117:8000/purchaseapi/purchasetaxes/export-tax/export-csv',
        {
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'purchase_taxes.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { message: 'Export completed successfully' };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

const purchaseTaxSlice = createSlice({
  name: 'purchaseTaxes',
  initialState,
  reducers: {
    setTaxData: (state, action: PayloadAction<PurchaseTax>) => {
      state.taxData = action.payload;
    },
    setEditIndex: (state, action: PayloadAction<number | null>) => {
      state.editIndex = action.payload;
    },
    setDialogOpen: (state, action: PayloadAction<'none' | 'edit' | 'deactivated'>) => {
      state.dialogOpen = action.payload;
    },
    setSnackbarOpen: (state, action: PayloadAction<boolean>) => {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage: (state, action: PayloadAction<string>) => {
      state.snackbarMessage = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setShowDeactivated: (state, action: PayloadAction<boolean>) => {
      state.showDeactivated = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    resetImportStatus: (state) => {
      state.importStatus = 'idle';
      state.importError = null;
    },
    resetExportStatus: (state) => {
      state.exportStatus = 'idle';
      state.exportError = null;
    },
    setShowImportResultDialog: (state, action: PayloadAction<boolean>) => {
      state.showImportResultDialog = action.payload;
    },
    resetImportResult: (state) => {
      state.importResult = null;
      state.showImportResultDialog = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPurchaseTaxes.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseTaxes.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((tax) => tax.status === 'active');
        state.deactivatedItems = action.payload.filter((tax) => tax.status === 'deactivated');
      })
      .addCase(fetchPurchaseTaxes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch purchase taxes';
      })
      .addCase(addPurchaseTax.fulfilled, (state, action) => {
        if (action.payload.status === 'active') {
          state.items.push(action.payload);
        } else {
          state.deactivatedItems.push(action.payload);
        }
      })
      .addCase(updatePurchaseTax.fulfilled, (state, action) => {
        const updatedTax = action.payload;
        if (!updatedTax?.purchasetaxId) {
          console.error('Invalid tax data received:', updatedTax);
          return;
        }
        const index = state.items.findIndex((item) => item.purchasetaxId === updatedTax.purchasetaxId);
        if (index !== -1) {
          state.items[index] = updatedTax;
        }
      })
      .addCase(updatePurchaseTax.rejected, (state, action) => {
        console.error('Update failed:', action.payload || action.error.message);
      })
      .addCase(deactivatePurchaseTax.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.purchasetaxId === action.payload.purchasetaxId);
        if (index !== -1) {
          const [deactivatedItem] = state.items.splice(index, 1);
          state.deactivatedItems.push(deactivatedItem);
        }
      })
      .addCase(activatePurchaseTax.fulfilled, (state, action) => {
        const index = state.deactivatedItems.findIndex((item) => item.purchasetaxId === action.payload.purchasetaxId);
        if (index !== -1) {
          const [activatedItem] = state.deactivatedItems.splice(index, 1);
          state.items.push(activatedItem);
        }
      })
      .addCase(importPurchaseTaxes.pending, (state) => {
        state.importStatus = 'loading';
        state.importError = null;
      })
      .addCase(importPurchaseTaxes.fulfilled, (state, action) => {
        state.importStatus = 'succeeded';
        state.importResult = {
          new_count: action.payload.new_count || action.payload.added || 0,
          updated_count: action.payload.updated_count || action.payload.updated || 0,
          duplicate_in_csv_count: action.payload.duplicate_in_csv_count || action.payload.skipped || 0,
        };
        state.showImportResultDialog = true;
        state.snackbarMessage = `Import completed: ${state.importResult.new_count} new, ${state.importResult.updated_count} updated, ${state.importResult.duplicate_in_csv_count} duplicates skipped`;
        state.snackbarOpen = true;
      })
      .addCase(importPurchaseTaxes.rejected, (state, action) => {
        state.importStatus = 'failed';
        state.importError = action.payload as string || 'Import failed';
        state.snackbarMessage = state.importError;
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseTaxes.pending, (state) => {
        state.exportStatus = 'loading';
        state.exportError = null;
      })
      .addCase(exportPurchaseTaxes.fulfilled, (state) => {
        state.exportStatus = 'succeeded';
        state.snackbarMessage = 'Export completed successfully';
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseTaxes.rejected, (state, action) => {
        state.exportStatus = 'failed';
        state.exportError = action.payload as string || 'Export failed';
        state.snackbarMessage = state.exportError;
        state.snackbarOpen = true;
      });
  },
});

export const {
  setTaxData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setSearchQuery,
  setShowDeactivated,
  setLoading,
  resetImportStatus,
  resetExportStatus,
  setShowImportResultDialog,
  resetImportResult,
} = purchaseTaxSlice.actions;

export const selectPurchaseTaxes = (state: RootState) => state.purchaseTax;
export const selectImportStatus = (state: RootState) => state.purchaseTax.importStatus;
export const selectExportStatus = (state: RootState) => state.purchaseTax.exportStatus;
export const selectImportError = (state: RootState) => state.purchaseTax.importError;
export const selectExportError = (state: RootState) => state.purchaseTax.exportError;
export const selectImportResult = (state: RootState) => state.purchaseTax.importResult;
export const selectShowImportResultDialog = (state: RootState) => state.purchaseTax.showImportResultDialog;

export default purchaseTaxSlice.reducer;
