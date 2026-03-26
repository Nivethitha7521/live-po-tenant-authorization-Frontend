import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { PurchaseSubcategory, PurchaseSubcategoryState, ImportResult, initialState } from '@/Models/purchasesubcategory';
const authHeader = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

// Async thun
export const fetchPurchaseSubcategories = createAsyncThunk<PurchaseSubcategory[]>(
  'purchaseSubcategory/fetch',
  async () => {
    try {
      const response = await axios.get('https://yenerp.com/purchasetestapi/purchasesubcategories/',
  { headers: authHeader() });
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to fetch purchase subcategories: ${error.message}`);
    }
  }
);

export const addPurchaseSubcategory = createAsyncThunk<PurchaseSubcategory, PurchaseSubcategory>(
  'purchaseSubcategory/add',
  async (purchaseSubcategory) => {
    try {
      const response = await axios.post('https://yenerp.com/purchasetestapi/purchasesubcategories/', purchaseSubcategory,
  { headers: authHeader() });
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to add purchase subcategory: ${error.message}`);
    }
  }
);

export const updatePurchaseSubcategory = createAsyncThunk<
  PurchaseSubcategory,
  { purchasesubcategoryId: string; purchasesubcategory: PurchaseSubcategory }
>(
  'purchaseSubcategory/update',
  async ({ purchasesubcategoryId, purchasesubcategory }) => {
    try {
      const response = await axios.patch(
        `https://yenerp.com/purchasetestapi/purchasesubcategories/${purchasesubcategoryId}`,
        purchasesubcategory,
  { headers: authHeader() }
      );
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to update purchase subcategory: ${error.message}`);
    }
  }
);

export const deactivatePurchaseSubcategory = createAsyncThunk<PurchaseSubcategory, string>(
  'purchaseSubcategory/deactivate',
  async (purchasesubcategoryId) => {
    try {
      const response = await axios.patch(
        `https://yenerp.com/purchasetestapi/purchasesubcategories/${purchasesubcategoryId}/deactivate`,
       {},
  { headers: authHeader() }
      );
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to deactivate purchase subcategory: ${error.message}`);
    }
  }
);

export const activatePurchaseSubcategory = createAsyncThunk<PurchaseSubcategory, string>(
  'purchaseSubcategory/activate',
  async (purchasesubcategoryId) => {
    try {
      const response = await axios.patch(
        `https://yenerp.com/purchasetestapi/purchasesubcategories/${purchasesubcategoryId}/activate`,
       {},
  { headers: authHeader() }
      );
      return response.data;
    } catch (error: any) {
      throw Error(`Failed to activate purchase subcategory: ${error.message}`);
    }
  }
);

export const importPurchaseSubcategoriesCSV = createAsyncThunk<
  ImportResult, // Return type for fulfilled case
  File, // Argument type
  { rejectValue: { message: string } } // Type for rejected case
>(
  'purchaseSubcategory/importCSV',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
      'https://yenerp.com/purchasetestapi/purchasesubcategories/import-csv',
        formData,
        {
          headers: { ...authHeader(),
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return {
        inserted_count: response.data.inserted_count ?? 0,
        updated_count: response.data.updated_count ?? 0,
        successful: response.data.successful ?? [],
        updated: response.data.updated ?? [],
        failed: response.data.failed ?? [],
        errorCount: response.data.errorCount ?? 0,
        message: response.data.message,
        error: response.data.error,
        detail: response.data.detail,
      } as ImportResult;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to import CSV';
      return rejectWithValue({ message: errorMessage });
    }
  }
);

export const exportPurchaseSubcategoriesCSV = createAsyncThunk<
  { message: string }, // Return type for fulfilled case
  void, // No arguments
  { rejectValue: string } // Type for rejected case
>(
  'purchaseSubcategory/exportCSV',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        'https://yenerp.com/purchasetestapi/purchasesubcategories/exportsubcategory/export-csv',
        {
          responseType: 'blob',
           headers: authHeader()
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'purchase_subcategories_export.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url); // Clean up URL

      return { message: 'Export started successfully' };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to export CSV');
    }
  }
);

const purchaseSubcategorySlice = createSlice({
  name: 'purchaseSubcategory',
  initialState,
  reducers: {
    setPurchaseSubcategoryData: (state, action: PayloadAction<PurchaseSubcategory>) => {
      state.purchaseSubcategoryData = action.payload;
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
    setShowImportResultDialog: (state, action: PayloadAction<boolean>) => {
      state.showImportResultDialog = action.payload;
    },
    resetImportResult: (state) => {
      state.importResult = null;
    },
    resetImportStatus: (state) => {
      state.importStatus = 'idle';
      state.importError = null;
      state.importResult = null; // Ensure importResult is reset
    },
    resetExportStatus: (state) => {
      state.exportStatus = 'idle';
      state.exportError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPurchaseSubcategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseSubcategories.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((purchaseSubcategory) => purchaseSubcategory.status === 'active');
        state.deactivatedSubcategories = action.payload.filter(
          (purchaseSubcategory) => purchaseSubcategory.status === 'deactivated'
        );
      })
      .addCase(fetchPurchaseSubcategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch purchase subcategories';
      })
      .addCase(addPurchaseSubcategory.fulfilled, (state, action) => {
        if (action.payload.status === 'active') {
          state.items.push(action.payload);
        } else {
          state.deactivatedSubcategories.push(action.payload);
        }
      })
      .addCase(updatePurchaseSubcategory.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.purchasesubcategoryId === action.payload.purchasesubcategoryId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deactivatePurchaseSubcategory.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.purchasesubcategoryId === action.payload.purchasesubcategoryId);
        if (index !== -1) {
          const [deactivatedItem] = state.items.splice(index, 1);
          state.deactivatedSubcategories.push(deactivatedItem);
        }
      })
      .addCase(activatePurchaseSubcategory.fulfilled, (state, action) => {
        const index = state.deactivatedSubcategories.findIndex(
          (item) => item.purchasesubcategoryId === action.payload.purchasesubcategoryId
        );
        if (index !== -1) {
          const [activatedItem] = state.deactivatedSubcategories.splice(index, 1);
          state.items.push(activatedItem);
        }
      })
      .addCase(importPurchaseSubcategoriesCSV.pending, (state) => {
        state.importStatus = 'loading';
        state.importError = null;
        state.importResult = null;
      })
      .addCase(importPurchaseSubcategoriesCSV.fulfilled, (state, action) => {
        state.importStatus = 'succeeded';
        state.importResult = action.payload;
        state.showImportResultDialog = true;
        state.snackbarMessage = action.payload.message || 'Purchase subcategories imported successfully';
        state.snackbarOpen = true;
        state.importError = null;
      })
      .addCase(importPurchaseSubcategoriesCSV.rejected, (state, action) => {
        state.importStatus = 'failed';
        state.importError = (action.payload as { message: string }).message || 'Failed to import CSV';
        state.importResult = null;
        state.showImportResultDialog = true;
        state.snackbarMessage = state.importError;
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseSubcategoriesCSV.pending, (state) => {
        state.exportStatus = 'loading';
        state.exportError = null;
      })
      .addCase(exportPurchaseSubcategoriesCSV.fulfilled, (state, action) => {
        state.exportStatus = 'succeeded';
        state.snackbarMessage = 'Export completed successfully';
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseSubcategoriesCSV.rejected, (state, action) => {
        state.exportStatus = 'failed';
        state.exportError = action.payload as string;
        state.snackbarMessage = state.exportError;
        state.snackbarOpen = true;
      });
  },
});

export const {
  setPurchaseSubcategoryData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setSearchQuery,
  setShowDeactivated,
  setShowImportResultDialog,
  resetImportResult,
  resetImportStatus,
  resetExportStatus,
} = purchaseSubcategorySlice.actions;

export const selectPurchaseSubcategoryItems = (state: RootState) => state.purchaseSubcategory;
export const selectImportStatus = (state: RootState) => state.purchaseSubcategory.importStatus;
export const selectExportStatus = (state: RootState) => state.purchaseSubcategory.exportStatus;
export const selectImportError = (state: RootState) => state.purchaseSubcategory.importError;
export const selectExportError = (state: RootState) => state.purchaseSubcategory.exportError;

export default purchaseSubcategorySlice.reducer;