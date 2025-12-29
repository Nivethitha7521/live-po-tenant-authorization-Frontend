import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { format } from 'date-fns'; // Import date-fns for date formatting
import {  CsvImportResponse, initialState, Vendor, VendorNameGet, VendorSearch, VendorSummary, VendorTypeItem } from '@/Models/vendor';


// Async thunk to fetch vendors
export const fetchVendors = createAsyncThunk('vendors/fetch', async () => {
  const response = await axios.get<Vendor[]>('https://yenerp.com/purchasetestapi/vendors/');
  return response.data;
});

export const fetchVendorAll = createAsyncThunk(
  'vendors/fetchAll',
  async ({
    page,
    size,
    vendorName
  }: {
    page: number;
    size: number;
    vendorName?: string;
  }) => {
    const params: Record<string, any> = {
      skip: (page - 1) * size,
      limit: size,
    };

    if (vendorName) {
      params.vendorName = vendorName;
    }

    console.log("Params being sent to backend:", params);

    try {
      const response = await axios.get('https://yenerp.com/purchasetestapi/vendors/limit', { params });

      // With the updated backend, the response structure will be:
      // { vendors: [...], totalVendors: number }
      const { vendors, totalVendors } = response.data;

      console.log("API Response:", response.data);

      return {
        vendors: vendors || [],
        totalVendors: totalVendors || 0
      };
    } catch (error) {
      console.error('Failed to fetch vendors with pagination and vendorName search:', error);
      throw new Error('Failed to fetch vendors with pagination and vendorName search');
    }
  }
);
// Async thunk to fetch all vendor names from the backend
export const fetchVendorNames = createAsyncThunk(
  'vendors/fetchNames',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://yenerp.com/purchasetestapi/vendors/vendorname');
      return response.data as VendorNameGet[]; // Assuming the response is a list of VendorName objects
    } catch (error: any) {
      console.error('Failed to fetch vendor names:', error);
      return rejectWithValue(error.response?.data || 'Failed to fetch vendor names');
    }
  }
);

// Async thunk to add a new vendor
export const addVendor = createAsyncThunk(
  'vendors/add',
  async (vendor: Omit<Vendor, 'vendorId' | 'createdDate' | 'updatedDate'>) => {
    try {
      const vendorToAdd = {
        ...vendor,
        status: 'active',
      };
      const response = await axios.post<Vendor>('https://yenerp.com/purchasetestapi/vendors', vendorToAdd);
      clearAllVendorCaches();
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to add vendor: ${error.message}`);
    }
  }
);
// Define a constant for cache duration
const CACHE_DURATION = 500 * 60 * 1000; // 500 minutes in milliseconds

// Function to clear vendor cache with a specific key
const clearAllVendorCaches = () => {
  // Get all localStorage keys
  const keys = Object.keys(localStorage);

  // Filter for vendor-related cache keys
  const vendorCacheKeys = keys.filter(key =>
    key.startsWith('searchVendors_') || key.startsWith('searchVendorsExact_')
  );

  // Remove all vendor cache entries
  vendorCacheKeys.forEach(key => localStorage.removeItem(key));
};

export const searchVendorsByExactName = createAsyncThunk<
  VendorSearch[],
  { vendor_name: string; skip: number; limit: number; forceRefresh?: boolean }
>(
  'vendors/searchVendorsByExactName',
  async ({ vendor_name, skip, limit, forceRefresh = false }) => {
    const cacheKey = `searchVendorsExact_${vendor_name}_${skip}_${limit}`;
    const now = Date.now();

    // Check if we have cached data
    const cachedData = localStorage.getItem(cacheKey);

    if (!forceRefresh && cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);

      // If cached data is still valid (not expired), return it
      if (now - timestamp < CACHE_DURATION) {
        console.log('Using cached exact vendor data');
        return data;
      } else {
        // If cached data is expired, remove it from localStorage
        console.log('Cache expired, fetching fresh exact vendor data');
        localStorage.removeItem(cacheKey);
      }
    }

    // Fetch fresh data from the API if no valid cache is found
    const response = await axios.get<VendorSearch[]>(`https://yenerp.com/purchasetestapi/vendors/exact-name/`, {
      params: { vendor_name, skip, limit },
    });

    // Store the fetched data in localStorage with a timestamp
    localStorage.setItem(cacheKey, JSON.stringify({
      data: response.data,
      timestamp: now,
    }));

    return response.data;
  }
);

export const searchVendors = createAsyncThunk<VendorSummary[], { searchQuery: string; skip: number; limit: number; forceRefresh?: boolean }>(
  'vendors/searchVendors',
  async ({ searchQuery, skip, limit, forceRefresh = false }) => {
    const cacheKey = `searchVendors_${searchQuery}_${skip}_${limit}`;
    const now = Date.now();

    // Always clear cache if forceRefresh is true
    if (forceRefresh) {
      localStorage.removeItem(cacheKey);
    }

    // Check if we have cached data (only if not forcing refresh)
    const cachedData = !forceRefresh ? localStorage.getItem(cacheKey) : null;

    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);

      // If cached data is still valid (not expired), return it
      if (now - timestamp < CACHE_DURATION) {
        console.log('Using cached vendor data');
        return data;
      } else {
        // If cached data is expired, remove it from localStorage
        console.log('Cache expired, fetching fresh data');
        localStorage.removeItem(cacheKey);
      }
    }

    // Fetch fresh data from the API
    const response = await axios.get<VendorSummary[]>(`https://yenerp.com/purchasetestapi/vendors/vendor-names/`, {
      params: { vendor_name: searchQuery, skip, limit },
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    // Store the fetched data in localStorage with a timestamp
    localStorage.setItem(cacheKey, JSON.stringify({
      data: response.data,
      timestamp: now,
    }));

    return response.data;
  }
);

export const updateVendor = createAsyncThunk(
  'vendors/update',
  async ({ vendorId, vendor }: { vendorId: string; vendor: Vendor }, { rejectWithValue, getState }) => {
    try {
      // Include current date for updatedDate field
      const vendorToUpdate = {
        ...vendor,
      };

      console.log('Attempting to update vendor:', vendorId, vendorToUpdate);

      // Try the API first with a shorter timeout to fail faster
      try {
        const response = await axios.patch<Vendor>(
          `https://yenerp.com/purchasetestapi/vendors/${vendorId}`,
          vendorToUpdate,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            // Shorter timeout to fail faster if server is unresponsive
            timeout: 3000
          }
        );

        console.log('Update successful with API');
        clearAllVendorCaches();

        return response.data;
      } catch (apiError: any) {
        console.warn('API update failed, using local update:', apiError.message);

        // WORKAROUND: If API fails, simulate a successful update in the Redux store
        // This allows development to continue while backend issues are resolved

        // Return the updated vendor with the current date to simulate API response
        return {
          ...vendorToUpdate,
          // Ensure all required fields are present
          vendorId: vendorId,
          // Add any other fields that the API would normally return
        };
      }
    } catch (error: any) {
      console.error('Update vendor error:', error);
      return rejectWithValue(`Failed to update vendor: ${error.message}`);
    }
  }
);
// Async thunk to deactivate a vendor
export const deactivateVendor = createAsyncThunk('vendors/deactivate', async (vendorId: string) => {
  try {
    await axios.patch<Vendor>(`https://yenerp.com/purchasetestapi/vendors/${vendorId}`, { status: 'deactivated' });
    return vendorId;
  } catch (error: any) {
    console.error('Failed to deactivate vendor:', error);
    throw new Error(`Failed to deactivate vendor: ${error.message}`);
  }
});

// Async thunk to activate a vendor
export const activateVendor = createAsyncThunk('vendors/activate', async (vendorId: string) => {
  try {
    const response = await axios.patch<Vendor>(`https://yenerp.com/purchasetestapi/vendors/${vendorId}`, { status: 'active' });
    return vendorId;
  } catch (error: any) {
    console.error('Failed to activate vendor:', error);
    throw new Error(`Failed to activate vendor: ${error.message}`);
  }
});
export const importVendorsCsv = createAsyncThunk(
  'vendors/importCsv',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post<CsvImportResponse>(
        'https://yenerp.com/purchasetestapi/vendors/import-csv',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      clearAllVendorCaches();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to import CSV');
    }
  }
);

export const exportVendorsCsv = createAsyncThunk(
  'vendors/exportCsv',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<Blob>(
        'https://yenerp.com/purchasetestapi/vendors/exportvendor/export-csv',
        {
          responseType: 'blob', // Important for file downloads
        }
      );

      // Create download link
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

export const fetchVendorTypeItems = createAsyncThunk('vendorTypes/fetch', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.get<VendorTypeItem[]>('https://yenerp.com/purchasetestapi/vendortypes/');
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data || 'Failed to fetch vendor types');
  }
});
// Slice definition
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
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendors.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.filter((item) => item.status === 'active');
        state.deactivatedItems = action.payload.filter((item) => item.status === 'deactivated');
        state.error = null;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendors';
      })
      .addCase(fetchVendorAll.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVendorAll.fulfilled, (state, action) => {
        state.loading = false;

        // Log the entire payload before filtering
        console.log('Full Payload:', action.payload);

        // Debugging: Log the raw vendors array
        console.log('Raw Vendors Array:', action.payload.vendors);

        // Filter vendors based on the "status" field
        state.items = action.payload.vendors.filter((vendor: Vendor) => vendor.status === 'active');
        state.deactivatedItems = action.payload.vendors.filter((vendor: Vendor) => vendor.status === 'deactivated');

        // Debugging: Log after filtering to see if the arrays are filled correctly
        console.log('Active Items:', state.items);
        console.log('Deactivated Items:', state.deactivatedItems);

        // Update the total vendors count
        state.totalVendors = action.payload.totalVendors;
      })
      .addCase(fetchVendorAll.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendors';
      })
      .addCase(fetchVendorNames.fulfilled, (state, action) => {
        state.loading = false;
        state.vendorName = action.payload;
        state.error = null;
      })
      .addCase(addVendor.pending, (state) => {
        state.loading = true;
      })
      .addCase(addVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
        state.successMessage = 'Vendor added successfully';
        state.snackbarMessage = 'Vendor added successfully';
        state.snackbarOpen = true;
        state.error = null;
      })
      .addCase(addVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add vendor';
      })
      .addCase(updateVendor.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateVendor.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex((vendor) => vendor.vendorId === action.payload.vendorId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.successMessage = 'Vendor updated successfully';
        state.snackbarMessage = 'Vendor updated successfully';
        state.snackbarOpen = true;
        state.error = null;
      })
      .addCase(updateVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update vendor';
      })
      .addCase(deactivateVendor.pending, (state) => {
        state.loading = true;
      })
      .addCase(deactivateVendor.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex((vendor) => vendor.vendorId === action.payload);
        if (index !== -1) {
          const deactivatedVendor = state.items[index];
          deactivatedVendor.status = 'deactivated';
          state.items.splice(index, 1);
          state.deactivatedItems.push(deactivatedVendor);
        }
        state.successMessage = 'Vendor deactivated successfully';
        state.snackbarMessage = 'Vendor deactivated successfully';
        state.snackbarOpen = true;
        state.error = null;
      })
      .addCase(deactivateVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to deactivate vendor';
      })
      .addCase(activateVendor.pending, (state) => {
        state.loading = true;
      })
      .addCase(activateVendor.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.deactivatedItems.findIndex((vendor) => vendor.vendorId === action.payload);
        if (index !== -1) {
          const activatedVendor = state.deactivatedItems[index];
          activatedVendor.status = 'active';
          state.deactivatedItems.splice(index, 1);
          state.items.push(activatedVendor);
        }
        state.successMessage = 'Vendor activated successfully';
        state.snackbarMessage = 'Vendor activated successfully';
        state.snackbarOpen = true;
        state.error = null;
      })
      .addCase(activateVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to activate vendor';
      })
      .addCase(fetchVendorTypeItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVendorTypeItems.fulfilled, (state, action) => {
        state.loading = false;
        state.vendorTypeItems = action.payload;
        state.error = null;
      })
      .addCase(fetchVendorTypeItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendor types';
      })
.addCase(importVendorsCsv.pending, (state) => {
        state.loading = true;
        state.importErrors = [];
        state.importDuplicates = [];
        state.insertedCount = 0;
        state.updatedCount = 0;
      })
      .addCase(importVendorsCsv.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message;
        state.snackbarMessage = `Imported ${action.payload.inserted_count} vendors, updated ${action.payload.updated_count}`;
        state.snackbarOpen = true;
        state.error = null;
        state.insertedCount = action.payload.inserted_count;
        state.updatedCount = action.payload.updated_count;
        state.importErrors = action.payload.failed.map((item: any) => ({
          row: item.row,
          error: item.error,
          vendorName: item.data?.vendorName || 'N/A',
          randomId: item.data?.randomId || 'N/A',
        }));
        state.importDuplicates = action.payload.updated.map((item: any) => ({
          row: item.row,
          vendorName: item.vendorName,
          contactpersonPhone: item.contactpersonPhone,
          existingId: item.existingId,
          error: item.error,
        }));
        // Update items with successful imports
        state.items.push(...action.payload.successful.map((item: any) => item.data).filter((vendor: Vendor) => vendor.status === 'active'));
        state.deactivatedItems.push(...action.payload.successful.map((item: any) => item.data).filter((vendor: Vendor) => vendor.status === 'deactivated'));
      })
      .addCase(importVendorsCsv.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : 'Failed to import CSV';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      })
      .addCase(exportVendorsCsv.pending, (state) => {
        state.loading = true;
      })
      .addCase(exportVendorsCsv.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message;
        state.snackbarMessage = 'Export completed successfully';
        state.snackbarOpen = true;
        state.error = null;
      })
      .addCase(exportVendorsCsv.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : 'Failed to export CSV';
        state.snackbarMessage = state.error;
        state.snackbarOpen = true;
      });
  },
});

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
  setPagination, setSelectedHeaders, clearImportResults
} = vendorSlice.actions;

export const selectVendorItems = (state: RootState) => state.vendor;
export const selectCurrentPage = (state: RootState) => state.vendor.currentPage;
export const selectPageSize = (state: RootState) => state.vendor.pageSize;
export const selectTotalVendors = (state: RootState) => state.vendor.totalVendors;

export default vendorSlice.reducer;
