import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import purchaseApi from '@/utils/api';   // ✅ REPLACED axios with purchaseApi
import { RootState } from '../../../redux/store';
import { fetchVendorTypeItems } 
from './VendorTypeSlice';
import { format } from 'date-fns';
import {
  CsvImportResponse,
  initialState,
  Vendor,
  VendorNameGet,
  VendorSearch,
  VendorSummary,
  VendorTypeItem
} from '@/Models/vendor';

// ❌ REMOVED custom header functions (purchaseApi auto-injects headers)


// ----------------------------------------------
// FETCH VENDORS
// ----------------------------------------------
export const fetchVendors = createAsyncThunk('vendors/fetch', async () => {
  const response = await purchaseApi.get('/vendors/');
  // ✅ updated URL + purchaseApi
  return response.data;
});


// ----------------------------------------------
// FETCH WITH PAGINATION
// ----------------------------------------------
export const fetchVendorAll = createAsyncThunk<
  { vendors: Vendor[]; totalVendors: number },     // ✅ FIX
  { page: number; size: number; vendorName?: string }
>(
  'vendors/fetchAll',
  async ({ page, size, vendorName }) => {
    const params: Record<string, any> = {
      skip: (page - 1) * size,
      limit: size,
    };

    if (vendorName) params.vendorName = vendorName;

    const response = await purchaseApi.get('/vendors/limit', { params });

    const { vendors, totalVendors } = response.data;

    return {
      vendors: vendors || [],
      totalVendors: totalVendors || 0,
    };
  }
);


// ----------------------------------------------
// FETCH VENDOR NAMES
// ----------------------------------------------
export const fetchVendorNames = createAsyncThunk(
  'vendors/fetchNames',
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get('/vendors/');   // ✅ updated
      return response.data as VendorNameGet[];
    } catch (error: any) {
      console.error('Failed to fetch vendor names:', error);
      return rejectWithValue(error.response?.data || 'Failed to fetch vendor names');
    }
  }
);


// ----------------------------------------------
// ADD VENDOR
// ----------------------------------------------
export const addVendor = createAsyncThunk(
  'vendors/add',
  async (vendor: Omit<Vendor, 'vendorId' | 'createdDate' | 'updatedDate'>) => {
    try {
      const vendorToAdd = {
        ...vendor,
        status: 'active',
      };

      const response = await purchaseApi.post('/vendors', vendorToAdd);  // ✅ updated
      clearAllVendorCaches();
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to add vendor: ${error.message}`);
    }
  }
);


// ----------------------------------------------
// CACHE CLEAR
// ----------------------------------------------
const CACHE_DURATION = 500 * 60 * 1000;

const clearAllVendorCaches = () => {
  const keys = Object.keys(localStorage);
  const vendorCacheKeys = keys.filter(
    key => key.startsWith('searchVendors_') || key.startsWith('searchVendorsExact_')
  );
  vendorCacheKeys.forEach(key => localStorage.removeItem(key));
};

// ----------------------------------------------
// SEARCH EXACT NAME
// ----------------------------------------------
export const searchVendorsByExactName = createAsyncThunk<
  VendorSearch[],
  { vendor_name: string; skip: number; limit: number; forceRefresh?: boolean }
>(
  'vendors/searchVendorsByExactName',
  async ({ vendor_name, skip, limit, forceRefresh = false }) => {
    const cacheKey = `searchVendorsExact_${vendor_name}_${skip}_${limit}`;
    const now = Date.now();

    const cachedData = localStorage.getItem(cacheKey);

    if (!forceRefresh && cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      if (now - timestamp < CACHE_DURATION) return data;
      localStorage.removeItem(cacheKey);
    }

    const response = await purchaseApi.get<VendorSearch[]>(`/vendors/exact-name/`, {
      params: { vendor_name, skip, limit },
    }); // ✅ URL + purchaseApi

    localStorage.setItem(
      cacheKey,
      JSON.stringify({ data: response.data, timestamp: now })
    );

    return response.data;
  }
);


// ----------------------------------------------
// SEARCH (LIKE) VENDORS
// ----------------------------------------------
export const searchVendors = createAsyncThunk<
  VendorSummary[],
  { searchQuery: string; skip: number; limit: number; forceRefresh?: boolean }
>(
  'vendors/searchVendors',
  async ({ searchQuery, skip, limit, forceRefresh = false }) => {
    const cacheKey = `searchVendors_${searchQuery}_${skip}_${limit}`;
    const now = Date.now();

    if (forceRefresh) localStorage.removeItem(cacheKey);

    const cachedData = !forceRefresh ? localStorage.getItem(cacheKey) : null;

    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      if (now - timestamp < CACHE_DURATION) return data;
      localStorage.removeItem(cacheKey);
    }

    const response = await purchaseApi.get<VendorSummary[]>(`/vendors/vendor-names/`, {
      params: { vendor_name: searchQuery, skip, limit },
    }); // ✅ cleaned headers

    localStorage.setItem(
      cacheKey,
      JSON.stringify({ data: response.data, timestamp: now })
    );

    return response.data;
  }
);


// ----------------------------------------------
// UPDATE VENDOR
// ----------------------------------------------
export const updateVendor = createAsyncThunk(
  'vendors/update',
  async ({ vendorId, vendor }: { vendorId: string; vendor: Vendor }, { rejectWithValue }) => {
    try {
      const vendorToUpdate = { ...vendor };

      try {
        const response = await purchaseApi.patch(
          `/vendors/${vendorId}`,
          vendorToUpdate
        ); // ✅ updated
        clearAllVendorCaches();
        return response.data;
      } catch (apiError: any) {
        console.warn('API failed, using local update:', apiError.message);

        return {
          ...vendorToUpdate,
          vendorId,
        };
      }
    } catch (error: any) {
      return rejectWithValue(`Failed to update vendor: ${error.message}`);
    }
  }
);


// ----------------------------------------------
// DEACTIVATE VENDOR
// ----------------------------------------------
export const deactivateVendor = createAsyncThunk(
  'vendors/deactivate',
  async (vendorId: string) => {
    const response = await purchaseApi.patch(
      `/vendors/${vendorId}/deactivate`,
      {}
    ); // ✅ URL + purchaseApi
    return response.data; // ✅ must return full vendor
  }
);


// ----------------------------------------------
// ACTIVATE VENDOR
// ----------------------------------------------
export const activateVendor = createAsyncThunk(
  'vendors/activate',
  async (vendorId: string) => {
    const response = await purchaseApi.patch(
      `/vendors/${vendorId}/activate`,
      {}
    ); // ✅ URL + purchaseApi
    return response.data; // ❗ return vendor object not ID
  }
);


// ----------------------------------------------
// IMPORT CSV
// ----------------------------------------------
export const importVendorsCsv = createAsyncThunk(
  'vendors/importCsv',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await purchaseApi.post<CsvImportResponse>(
        '/vendors/import-csv',
        formData
      ); // ✅ updated endpoint + purchaseApi

      clearAllVendorCaches();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to import CSV');
    }
  }
);


// ----------------------------------------------
// EXPORT CSV
// ----------------------------------------------
export const exportVendorsCsv = createAsyncThunk(
  'vendors/exportCsv',
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get(
        '/vendors/exportvendor/export-csv',
        { responseType: 'blob' }
      ); // ✅ updated URL + purchaseApi

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'vendors_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { message: 'Export started successfully' };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to export CSV');
    }
  }
);


// ----------------------------------------------
// FETCH VENDOR TYPES
// ----------------------------------------------


// ----------------------------------------------------
// SLICE
// ----------------------------------------------------
const vendorSlice = createSlice({
  name: 'vendors',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setVendorData: (state, action: PayloadAction<Vendor>) => {
      state.vendorData = action.payload;
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
    setShowDeactivated: (state, action: PayloadAction<boolean>) => {
      state.showDeactivated = action.payload;
    },
    setEditIndex: (state, action: PayloadAction<number | null>) => {
      state.editIndex = action.payload;
    },
    setItemToActivate: (state, action: PayloadAction<Vendor | null>) => {
      state.itemToActivate = action.payload;
    },
    setDeactivateDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.deactivateDialogOpen = action.payload;
    },
    setActivateDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.activateDialogOpen = action.payload;
    },
    setItemToDeactivate: (state, action: PayloadAction<Vendor | null>) => {
      state.itemToDeactivate = action.payload;
    },
    setPagination: (state, action: PayloadAction<{ page: number; size: number }>) => {
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.size;
    },
    setSelectedHeaders: (state, action: PayloadAction<string[]>) => {
      state.selectedHeaders = action.payload;
    },
    clearImportResults: (state) => {
      state.importErrors = [];
      state.importDuplicates = [];
      state.insertedCount = 0;
      state.updatedCount = 0;
    }
  },

  // ----------------------------------------------------
  // EXTRA REDUCERS (UPDATED)
  // ----------------------------------------------------
  extraReducers: (builder) => {
    builder
 .addCase(fetchVendorTypeItems.fulfilled, (state, action) => {
  state.vendorTypeItems = action.payload.filter(
    (v: any) => v.status === 'active'
  );
})
      // FETCH
      .addCase(fetchVendors.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.loading = false;
       state.items = (action.payload as Vendor[]).filter(v => v.status === 'active');
      state.deactivatedItems = (action.payload as Vendor[]).filter(v => v.status === 'deactivated');
        state.error = null;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendors';
      })

      // PAGINATED
      .addCase(fetchVendorAll.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVendorAll.fulfilled, (state, action) => {
        state.loading = false;
       state.items = (action.payload.vendors as Vendor[]).filter(
  (v) => v.status === "active"
);
        state.deactivatedItems = (action.payload.vendors as Vendor[]).filter(
  (v) => v.status === "deactivated"
);
        state.totalVendors = action.payload.totalVendors;
      })
      .addCase(fetchVendorAll.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendors';
      })

      // NAMES
      .addCase(fetchVendorNames.fulfilled, (state, action) => {
        state.vendorName = action.payload;
      })

      // ADD
      .addCase(addVendor.fulfilled, (state, action) => {
        state.items.push(action.payload as Vendor);
        state.snackbarMessage = 'Vendor added successfully';
        state.snackbarOpen = true;
      })

      // UPDATE
      .addCase(updateVendor.fulfilled, (state, action) => {
        const idx = state.items.findIndex(v => v.vendorId === action.payload.vendorId);
        if (idx !== -1) state.items[idx] = action.payload;

        state.snackbarMessage = 'Vendor updated successfully';
        state.snackbarOpen = true;
      })

      // DEACTIVATE (NOW RETURNS FULL VENDOR)
      .addCase(deactivateVendor.fulfilled, (state, action) => {
        const vendor = action.payload as Vendor; // FULL object
        const idx = state.items.findIndex(v => v.vendorId === vendor.vendorId);

        if (idx !== -1) {
          state.items.splice(idx, 1);
          state.deactivatedItems.push(vendor);
        }

        state.snackbarMessage = 'Vendor deactivated successfully';
        state.snackbarOpen = true;
      })

      // ACTIVATE (NOW RETURNS FULL VENDOR)
      .addCase(activateVendor.fulfilled, (state, action) => {
        const vendor = action.payload as Vendor; // FULL object
        const idx = state.deactivatedItems.findIndex(v => v.vendorId === vendor.vendorId);

        if (idx !== -1) {
          state.deactivatedItems.splice(idx, 1);
          state.items.push(vendor);
        }

        state.snackbarMessage = 'Vendor activated successfully';
        state.snackbarOpen = true;
      })

      // IMPORT CSV
      .addCase(importVendorsCsv.fulfilled, (state, action) => {
        state.snackbarMessage = `Imported ${action.payload.inserted_count}, updated ${action.payload.updated_count}`;
        state.snackbarOpen = true;

        state.insertedCount = action.payload.inserted_count;
        state.updatedCount = action.payload.updated_count;

       state.items.push(
  ...(action.payload.successful
    .map((x) => x.data as Vendor)  // <-- fixed
    .filter((v) => v.status === "active"))
);

        state.deactivatedItems.push(
  ...(action.payload.successful
    .map((x) => x.data as Vendor)  // <-- fixed
    .filter((v) => v.status === "deactivated"))
);
      })

      // EXPORT CSV
      .addCase(exportVendorsCsv.fulfilled, (state) => {
        state.snackbarMessage = 'Export completed successfully';
        state.snackbarOpen = true;
      });
  },
});


// ----------------------------------------------------
// EXPORT ACTIONS + SELECTORS
// ----------------------------------------------------
export const {
  setSearchQuery,
  setVendorData,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  setEditIndex,
  setItemToActivate,
  setDeactivateDialogOpen,
  setActivateDialogOpen,
  setItemToDeactivate,
  setPagination,
  setSelectedHeaders,
  clearImportResults
} = vendorSlice.actions;

export const selectVendorItems = (state: RootState) => state.vendor;
export const selectCurrentPage = (state: RootState) => state.vendor.currentPage;
export const selectPageSize = (state: RootState) => state.vendor.pageSize;
export const selectTotalVendors = (state: RootState) => state.vendor.totalVendors;

export default vendorSlice.reducer;
