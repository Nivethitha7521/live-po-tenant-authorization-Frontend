import { ImportResult } from '@/Models/importResult';
import { Category,initialState, Subcategory } from '@/Models/purchasecategory';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchCategories = createAsyncThunk<Category[]>('category/fetchCategories', async () => {
  const response = await axios.get('http://192.168.29.117:8000/purchaseapi/purchasecategories/');
  return response.data;
});

export const addCategory = createAsyncThunk<Category, Category>('category/addCategory', async (category) => {
  const response = await axios.post('http://192.168.29.117:8000/purchaseapi/purchasecategories', category);
  return response.data;
});
export const removeSubcategory = createAsyncThunk<
  Category,
  { categoryId: string; subcategory: string }
>(
  'category/removeSubcategory',
  async ({ categoryId, subcategory }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `http://192.168.29.117:8000/purchaseapi/purchasecategories/${categoryId}/subcategories/remove`,
        { subcategoryToRemove: subcategory },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Remove subcategory error:', error.response?.data);
      return rejectWithValue(error.response?.data?.detail || 'Failed to remove subcategory');
    }
  }
);
export const updateCategory = createAsyncThunk<Category, { purchasecategoryId: string, category: Category }>(
  'category/updateCategory',
  async ({ purchasecategoryId, category }) => {
    const response = await axios.patch(`http://192.168.29.117:8000/purchaseapi/purchasecategories/${purchasecategoryId}`, category);
    return response.data;
  }
);

export const deactivateCategory = createAsyncThunk<Category, string>('category/deactivateCategory', async (purchasecategoryId) => {
  const response = await axios.patch(`http://192.168.29.117:8000/purchaseapi/purchasecategories/${purchasecategoryId}`, { status: 'deactivated' });
  return response.data;
});

export const activateCategory = createAsyncThunk<Category, string>('category/activateCategory', async (purchasecategoryId) => {
  const response = await axios.patch(`http://192.168.29.117:8000/purchaseapi/purchasecategories/${purchasecategoryId}`, { status: 'active' });
  return response.data;
});

export const fetchSubcategories = createAsyncThunk<Subcategory[]>('subcategory/fetchSubcategories', async () => {
  const response = await axios.get('http://192.168.29.117:8000/purchaseapi/purchasesubcategories/');
  return response.data;
});

export const importPurchaseCategoriesCSV = createAsyncThunk(
  'purchaseCategory/importCSV',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(
        'http://192.168.29.117:8000/purchaseapi/purchasecategories/import_csv',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      console.log('Category Import API response:', response.data); // Debug log
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to import CSV');
    }
});

export const exportPurchaseCategoriesCSV = createAsyncThunk(
  'purchaseCategory/exportCSV',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        'http://192.168.29.117:8000/purchaseapi/purchasecategories/exportcategory/export_csv',
        {
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'purchase_categories_export.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { message: 'Export completed successfully' };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to export CSV');
    }
});

const categorySlice = createSlice({
  name: 'category',
  initialState,
  reducers: {
    setCategoryData(state, action: PayloadAction<Category>) {
      state.categoryData = action.payload;
    },
    setEditIndex(state, action: PayloadAction<string | null>) {
      state.editIndex = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit' | 'deactivated' | 'add'>) {
      state.dialogOpen = action.payload;
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    toggleShowDeactivated(state) {
      state.showDeactivated = !state.showDeactivated;
    },
    resetImportStatus(state) {
      state.importStatus = 'idle';
      state.importError = null;
    },
    resetExportStatus(state) {
      state.exportStatus = 'idle';
      state.exportError = null;
    },
    setImportedData(state, action: PayloadAction<Category[]>) {
      state.importedData = action.payload;
    },
    setImportDialogOpen(state, action: PayloadAction<boolean>) {
      state.importDialogOpen = action.payload;
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
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<Category[]>) => {
        state.loading = false;
        state.categories = action.payload.filter((category) => category.status === 'active');
        state.deactivatedItems = action.payload.filter((category) => category.status === 'deactivated');
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch categories';
      })
      .addCase(addCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        state.categories.push(action.payload);
      })
      .addCase(updateCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        const index = state.categories.findIndex((category) => category.purchasecategoryId === action.payload.purchasecategoryId);
        if (index !== -1) {
          state.categories[index] = action.payload;
        }
      })
      .addCase(deactivateCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        const index = state.categories.findIndex((category) => category.purchasecategoryId === action.payload.purchasecategoryId);
        if (index !== -1) {
          state.categories[index].status = 'deactivated';
          state.deactivatedItems.push(state.categories[index]);
          state.categories.splice(index, 1);
        }
      })
      .addCase(activateCategory.fulfilled, (state, action: PayloadAction<Category>) => {
        const index = state.deactivatedItems.findIndex((category) => category.purchasecategoryId === action.payload.purchasecategoryId);
        if (index !== -1) {
          state.deactivatedItems[index].status = 'active';
          state.categories.push(state.deactivatedItems[index]);
          state.deactivatedItems.splice(index, 1);
        }
      })
      .addCase(fetchSubcategories.fulfilled, (state, action: PayloadAction<Subcategory[]>) => {
        state.subcategories = action.payload;
      })
      .addCase(importPurchaseCategoriesCSV.pending, (state) => {
        state.importStatus = 'loading';
        state.importError = null;
      })
    .addCase(importPurchaseCategoriesCSV.fulfilled, (state, action: PayloadAction<ImportResult>) => {
      state.importStatus = 'succeeded';
        state.importResult = action.payload;
        state.showImportResultDialog = true;
        state.snackbarMessage = action.payload.message || 'Purchase subcategories imported successfully';
        state.snackbarOpen = true;
        state.importError = null;
      })
      .addCase(importPurchaseCategoriesCSV.rejected, (state, action) => {
        state.importStatus = 'failed';
        state.importError = action.payload as string || 'Import failed';
        state.snackbarMessage = state.importError;
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseCategoriesCSV.pending, (state) => {
        state.exportStatus = 'loading';
        state.exportError = null;
      })
      .addCase(exportPurchaseCategoriesCSV.fulfilled, (state) => {
        state.exportStatus = 'succeeded';
        state.snackbarMessage = 'Export completed successfully';
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseCategoriesCSV.rejected, (state, action) => {
        state.exportStatus = 'failed';
        state.exportError = action.payload as string || 'Export failed';
        state.snackbarMessage = state.exportError;
        state.snackbarOpen = true;
      })
.addCase(removeSubcategory.fulfilled, (state, action: PayloadAction<Category>) => {
  const index = state.categories.findIndex(
    (category) => category.purchasecategoryId === action.payload.purchasecategoryId
  );
  if (index !== -1) {
    state.categories[index] = action.payload;
  }
  state.snackbarMessage = 'Subcategory removed successfully';
  state.snackbarOpen = true;
})
.addCase(removeSubcategory.rejected, (state, action) => {
  state.error = action.payload as string || 'Failed to remove subcategory';
  state.snackbarMessage = state.error === 'PurchaseCategory not found'
    ? 'Category not found. Please refresh and try again.'
    : state.error === 'Subcategory not found in this category'
    ? 'Subcategory does not exist in this category.'
    : 'Failed to remove subcategory';
  state.snackbarOpen = true;
});
  },
});

export const {
  setCategoryData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setSearchQuery,
  toggleShowDeactivated,
  resetImportStatus,
  resetExportStatus,
  setImportedData,
  setImportDialogOpen,
  setShowImportResultDialog,
  resetImportResult,
} = categorySlice.actions;

export default categorySlice.reducer;
