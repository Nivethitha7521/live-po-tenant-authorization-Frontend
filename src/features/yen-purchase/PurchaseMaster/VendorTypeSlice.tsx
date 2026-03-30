import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { initialState, VendorTypeItem } from '@/Models/vendorType';

// ✅ ADD HEADER FUNCTION
export const getAuthHeaders = () => {
  const token = sessionStorage.getItem("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
};

// Fetch all vendor type items
export const fetchVendorTypeItems = createAsyncThunk<VendorTypeItem[], { signal?: AbortSignal }>(
  'vendorTypes/fetch',
  async ({ signal }, { rejectWithValue }) => {
    try {
      const source = axios.CancelToken.source();
      signal?.addEventListener('abort', () => {
        source.cancel('Request canceled');
      });
      const response = await axios.get('http://127.0.0.1:8000/purchasetestapi/vendortypes/', {
        cancelToken: source.token,
        headers: getAuthHeaders() // ✅ ADD HEADERS
      });
      return response.data;
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return rejectWithValue('Request canceled');
      }
      return rejectWithValue(`Failed to fetch vendor types: ${error.message}`);
    }
  }
);

// Add a new vendor type item
export const addVendorTypeItem = createAsyncThunk<VendorTypeItem, { data: VendorTypeItem; signal?: AbortSignal }>(
  'vendorTypes/add',
  async ({ data, signal }, { rejectWithValue }) => {
    try {
      const source = axios.CancelToken.source();
      signal?.addEventListener('abort', () => {
        source.cancel('Request canceled');
      });
      const response = await axios.post('http://127.0.0.1:8000/purchasetestapi/vendortypes', data, {
        cancelToken: source.token,
        headers: getAuthHeaders() // ✅ ADD HEADERS
      });
      return response.data;
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return rejectWithValue('Request canceled');
      }
      return rejectWithValue(`Failed to add vendor type: ${error.message}`);
    }
  }
);

// Update an existing vendor type item
export const updateVendorTypeItem = createAsyncThunk<
  VendorTypeItem,
  { vendortypeId: string; vendortype: VendorTypeItem; signal?: AbortSignal }
>(
  'vendorTypes/update',
  async ({ vendortypeId, vendortype, signal }, { rejectWithValue }) => {
    try {
      const source = axios.CancelToken.source();
      signal?.addEventListener('abort', () => {
        source.cancel('Request canceled');
      });
      const response = await axios.patch(`http://127.0.0.1:8000/purchasetestapi/vendortypes/${vendortypeId}`, vendortype, {
        cancelToken: source.token,
        headers: getAuthHeaders() // ✅ ADD HEADERS
      });
      return response.data;
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return rejectWithValue('Request canceled');
      }
      return rejectWithValue(`Failed to update vendor type: ${error.message}`);
    }
  }
);

// Deactivate a vendor type item
export const deactivateVendorTypeItem = createAsyncThunk<VendorTypeItem, { vendortypeId: string; signal?: AbortSignal }>(
  'vendorTypes/deactivate',
  async ({ vendortypeId, signal }, { rejectWithValue }) => {
    try {
      const source = axios.CancelToken.source();
      signal?.addEventListener('abort', () => {
        source.cancel('Request canceled');
      });
       const response = await axios.patch(
        `http://127.0.0.1:8000/purchasetestapi/vendortypes/${vendortypeId}/deactivate`,
        {},
        { cancelToken: source.token,
          headers: getAuthHeaders() }
        
      );
      return response.data;
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return rejectWithValue('Request canceled');
      }
      return rejectWithValue(`Failed to deactivate vendor type: ${error.message}`);
    }
  }
);

// Activate a vendor type item
export const activateVendorTypeItem = createAsyncThunk<VendorTypeItem, { vendortypeId: string; signal?: AbortSignal }>(
  'vendorTypes/activate',
  async ({ vendortypeId, signal }, { rejectWithValue }) => {
    try {
      const source = axios.CancelToken.source();
      signal?.addEventListener('abort', () => {
        source.cancel('Request canceled');
      });
       const response = await axios.patch(
        `http://127.0.0.1:8000/purchasetestapi/vendortypes/${vendortypeId}/activate`,
        {},
        { cancelToken: source.token,
          headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return rejectWithValue('Request canceled');
      }
      return rejectWithValue(`Failed to activate vendor type: ${error.message}`);
    }
  }
);

const vendorTypeSlice = createSlice({
  name: 'vendorTypes',
  initialState,
  reducers: {
    setVendorTypeData: (state, action: PayloadAction<VendorTypeItem>) => {
      state.vendorTypeData = action.payload;
    },
    setEditIndex: (state, action: PayloadAction<number | null>) => {
      state.editIndex = action.payload;
    },
    setDialogOpen: (state, action: PayloadAction<'none' | 'edit' | 'deactivated' | 'add'>) => {
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendorTypeItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVendorTypeItems.fulfilled, (state, action) => {
        state.loading = false;
        state.vendoritems = action.payload.filter((vendorType) => vendorType.status === 'active');
        state.deactivatedItems = action.payload.filter((vendorType) => vendorType.status === 'deactivated');
      })
      .addCase(fetchVendorTypeItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string ?? 'Failed to fetch vendor types';
      })
      .addCase(addVendorTypeItem.fulfilled, (state, action) => {
        if (action.payload.status === 'active') {
          state.vendoritems.push(action.payload);
        } else {
          state.deactivatedItems.push(action.payload);
        }
      })
      .addCase(updateVendorTypeItem.fulfilled, (state, action) => {
        const index = state.vendoritems.findIndex((item) => item.vendortypeId === action.payload.vendortypeId);
        if (index !== -1) {
          state.vendoritems[index] = action.payload;
        }
      })
      .addCase(deactivateVendorTypeItem.fulfilled, (state, action) => {
        const index = state.vendoritems.findIndex((item) => item.vendortypeId === action.payload.vendortypeId);
        if (index !== -1) {
          const [deactivatedItem] = state.vendoritems.splice(index, 1);
          state.deactivatedItems.push(deactivatedItem);
        }
      })
      .addCase(activateVendorTypeItem.fulfilled, (state, action) => {
        const index = state.deactivatedItems.findIndex((item) => item.vendortypeId === action.payload.vendortypeId);
        if (index !== -1) {
          const [activatedItem] = state.deactivatedItems.splice(index, 1);
          state.vendoritems.push(activatedItem);
        }
      });
  },
});

export const {
  setVendorTypeData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setSearchQuery,
  setShowDeactivated,
} = vendorTypeSlice.actions;

export const selectVendorTypeItems = (state: RootState) => state.vendorType;

export default vendorTypeSlice.reducer;

