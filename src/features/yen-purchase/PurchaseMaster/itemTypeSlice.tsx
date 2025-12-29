import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { initialState, PurchaseItemType } from '@/Models/itemType';

export const fetchPurchaseTypeItems = createAsyncThunk('purchaseTypeItems/fetchPurchaseTypeItems', async () => {
  const response = await axios.get<PurchaseItemType[]>('https://yenerp.com/purchasetestapi/itemtypes/');
  return response.data;
});

export const addPurchaseTypeItem = createAsyncThunk<PurchaseItemType, Omit<PurchaseItemType, 'itemtypeId'>>('purchaseTypeItems/addPurchaseTypeItem', async (groupItemData, { rejectWithValue }) => {
  try {
    const response = await axios.post('https://yenerp.com/purchasetestapi/itemtypes/', groupItemData);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.detail || error.message);
  }
});

export const updatePurchaseTypeItem = createAsyncThunk<PurchaseItemType, PurchaseItemType>('purchaseTypeItems/updatePurchaseTypeItem', async (groupItemData, { rejectWithValue }) => {
  try {
    const response = await axios.patch(`https://yenerp.com/purchasetestapi/itemtypes/${groupItemData.itemtypeId}`, groupItemData);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.detail || error.message);
  }
});

export const deactivatePurchaseTypeItem = createAsyncThunk<PurchaseItemType, string>('purchaseTypeItems/deactivatePurchaseTypeItem', async (itemtypeId, { rejectWithValue }) => {
  try {
    const response = await axios.patch(`https://yenerp.com/purchasetestapi/itemtypes/${itemtypeId}`, { status: 'deactivated' });
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.detail || error.message);
  }
});

export const activatePurchaseTypeItem = createAsyncThunk<PurchaseItemType, string>('purchaseTypeItems/activatePurchaseTypeItem', async (itemtypeId, { rejectWithValue }) => {
  try {
    const response = await axios.patch(`https://yenerp.com/purchasetestapi/itemtypes/${itemtypeId}`, { status: 'active' });
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.detail || error.message);
  }
});

export const importPurchaseTypeItem = createAsyncThunk(
  'purchaseTypeItem/import',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(
        'https://yenerp.com/purchasetestapi/itemtypes/import-csv',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      console.log('Item Type Import API response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Item Type Import error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const exportPurchaseTypeItem = createAsyncThunk(
  'purchaseTypeItem/export',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        'https://yenerp.com/purchasetestapi/itemtypes/export-itemtype/export-csv',
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'item_types.csv');
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

const purchaseTypeItemSlice = createSlice({
  name: 'purchaseTypeItems',
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit' | 'deactivated'>) {
      state.dialogOpen = action.payload;
    },
    setPurchaseTypeItemData(state, action: PayloadAction<PurchaseItemType>) {
      state.purchaseItemTypeData = action.payload;
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
      state.importResult = null;
      state.showImportResultDialog = false;
    },
    resetExportStatus(state) {
      state.exportStatus = 'idle';
      state.exportError = null;
    },
    setShowImportResultDialog(state, action: PayloadAction<boolean>) {
      state.showImportResultDialog = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPurchaseTypeItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseTypeItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((item) => item.status === 'active');
        state.deactivatedItems = action.payload.filter((item) => item.status === 'deactivated');
      })
      .addCase(fetchPurchaseTypeItems.rejected, (state) => {
        state.loading = false;
      })
      .addCase(addPurchaseTypeItem.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updatePurchaseTypeItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.itemtypeId === action.payload.itemtypeId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deactivatePurchaseTypeItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.itemtypeId === action.payload.itemtypeId);
        if (index !== -1) {
          state.items[index].status = 'deactivated';
          state.deactivatedItems.push(state.items[index]);
          state.items.splice(index, 1);
        }
      })
      .addCase(activatePurchaseTypeItem.fulfilled, (state, action) => {
        const index = state.deactivatedItems.findIndex((item) => item.itemtypeId === action.payload.itemtypeId);
        if (index !== -1) {
          state.deactivatedItems[index].status = 'active';
          state.items.push(state.deactivatedItems[index]);
          state.deactivatedItems.splice(index, 1);
        }
      })
      .addCase(importPurchaseTypeItem.pending, (state) => {
        state.importStatus = 'loading';
        state.importError = null;
      })
      .addCase(importPurchaseTypeItem.fulfilled, (state, action) => {
        state.importResult = action.payload;
        state.showImportResultDialog = true;
        state.snackbarMessage = action.payload.message || 'Item Type imported successfully';
        state.snackbarOpen = true;
      })
      .addCase(importPurchaseTypeItem.rejected, (state, action) => {
        state.importStatus = 'failed';
        state.importError = action.payload as string || 'Import failed';
        state.snackbarMessage = state.importError;
        state.snackbarOpen = true;
      })
      .addCase(exportPurchaseTypeItem.pending, (state) => {
        state.exportStatus = 'loading';
        state.exportError = null;
      })
      .addCase(exportPurchaseTypeItem.fulfilled, (state) => {
        state.exportStatus = 'succeeded';
      })
      .addCase(exportPurchaseTypeItem.rejected, (state, action) => {
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
  setPurchaseTypeItemData,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  setEditIndex,
  resetImportStatus,
  resetExportStatus,
  setShowImportResultDialog,
} = purchaseTypeItemSlice.actions;

export const selectPurchaseTypeItems = (state: RootState) => state.itemtype;
export const selectImportStatus = (state: RootState) => state.itemtype.importStatus;
export const selectExportStatus = (state: RootState) => state.itemtype.exportStatus;
export const selectImportError = (state: RootState) => state.itemtype.importError;
export const selectExportError = (state: RootState) => state.itemtype.exportError;

export default purchaseTypeItemSlice.reducer;