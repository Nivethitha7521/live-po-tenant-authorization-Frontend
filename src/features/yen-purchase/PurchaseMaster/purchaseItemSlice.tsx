import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../../redux/store';
import { format } from 'date-fns';
import { ChangeEvent } from 'react';
import { PurchaseItemSearchAdd } from '@/Models/purchaseModel';
import { ImportPayload, ImportResponse, initialState, PurchaseCategory, PurchaseItem, PurchaseItemSearch, PurchaseTax, SearchResponse, StorageLocationItem, UOM, Vendor } from '@/Models/purchaseitem';
import { PurchaseItemType } from '@/Models/itemType';
import { PurchaseGroupItem } from '@/Models/itemgroup';


const EXPORT_CSV_URL = 'https://yenerp.com/purchaseapi/rawMaterials/export_csv'; // Make sure this URL is correct
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Define an async thunk to handle the export of purchase items to CSV
export const exportPurchaseItemsToCSV = createAsyncThunk(
  'export/exportPurchaseItemsToCSV',
  async (_, { rejectWithValue }) => {
    try {
      // Ensure the export URL is set up correctly
      if (!EXPORT_CSV_URL) {
        throw new Error('Export URL is not defined');
      }

      // Send a request to the backend endpoint to export CSV
      const response = await axios.get(EXPORT_CSV_URL, {
        responseType: 'blob', // Ensure the response is treated as a file download
      });

      // Check for response status
      if (response.status !== 200) {
        throw new Error('Failed to export purchase items to CSV');
      }

      // Create a URL for the downloaded blob and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'purchase_items.csv');
      document.body.appendChild(link);
      link.click();
      link.remove(); // Clean up the link element after the download

      return true; // Return true to indicate success
    } catch (error: any) {
      // Capture error message and reject
      return rejectWithValue(error.message || 'Failed to export purchase items to CSV');
    }
  }
);

// Update your thunk to always use the latest filters
export const fetchPurchaseItems = createAsyncThunk(
  'purchaseItems/fetch',
  async ({
    page,
    size,
    ...filters
  }: {
    page: number;
    size: number;
    itemName?: string;
    purchasecategoryName?: string;
    purchasesubcategoryName?: string;
  }) => {
    const params: Record<string, any> = {
      skip: (page - 1) * size,
      limit: size,
    };

    // Add non-empty filters to params
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });

    try {
      const response = await axios.get('https://yenerp.com/purchaseapi/rawMaterials/', { params });
      return {
        items: response.data.items || [],
        totalItems: response.data.totalItems || 0
      };
    } catch (error) {
      throw new Error('Error fetching purchase items');
    }
  }
);
// Fetch all purchase subcategory
export const fetchPurchaseCategories = createAsyncThunk('purchaseSubcategory/fetch', async () => {
  const response = await axios.get<PurchaseCategory[]>('https://yenerp.com/purchaseapi/purchasecategories/');
  return response.data;
});

// Fetch all purchase uoms
export const fetchUom = createAsyncThunk('uom/fetch', async () => {
  const response = await axios.get<UOM[]>('https://yenerp.com/purchaseapi/purchaseuoms/');
  // Transform the response to only include the uom field
  const uoms = response.data.map(item => ({ uom: item.uom }));
  return uoms;
});

//fetch all itemtypes
export const fetchPurchaseItemtype = createAsyncThunk('itemtype/fetch', async () => {
  const response = await axios.get<PurchaseItemType[]>('https://yenerp.com/purchaseapi/itemtypes/');
  // Transform the response to match the PurchaseItemType structure
  const itemtypes = response.data.map(item => ({ itemtypeName: item.itemtypeName }));
  return itemtypes;
});


// Fetch all purchase taxes
export const fetchPurchaseTaxes = createAsyncThunk('purchaseTaxes/fetch', async () => {
  const response = await axios.get<PurchaseTax[]>('https://yenerp.com/purchaseapi/purchasetaxes/');
  const tax = response.data.map(item => ({ purchasetaxPercentage: item.purchasetaxPercentage }));
  return tax;
});

// Fetch all storage location items
export const fetchStorageLocationItems = createAsyncThunk('storageLocations/fetch', async () => {
  const response = await axios.get<StorageLocationItem[]>('https://yenerp.com/purchaseapi/storagelocations/');
  const location = response.data.map(item => ({ locationName: item.locationName }));
  return location;
});

// Fetch all purchase group items
export const fetchPurchaseGroupItems = createAsyncThunk('groupItems/fetch', async () => {
  const response = await axios.get<PurchaseGroupItem[]>('https://yenerp.com/purchaseapi/itemgroups/');
  const groupitem = response.data.map(item => ({ itemgroupName: item.itemgroupName }));
  return groupitem;
});

// Fetch all vendors
export const fetchAllVendors = createAsyncThunk('vendors/fetch', async () => {
  const response = await axios.get<Vendor[]>('https://yenerp.com/purchaseapi/vendors/');
  // Transform the response to include both vendorId and vendorName
  const vendorData = response.data.map(item => ({
    vendorId: item.vendorId,
    vendorName: item.vendorName
  }));
  return vendorData;
});

export const addPurchaseItem = createAsyncThunk(
  'purchaseItems/add',
  async (purchase: Omit<PurchaseItem, 'purchaseitemId'>, { dispatch }) => {
    try {
      const purchaseToAdd = {
        ...purchase,
      };

      const response = await axios.post<PurchaseItem>(
        'https://yenerp.com/purchaseapi/rawMaterials/', // Ensure the endpoint matches your backend route
        purchaseToAdd
      );

      // Invalidate cache after successful addition
      dispatch(invalidatePurchaseItemsCache());
      dispatch(invalidatePOCache());
      console.log(response.status);
      return response.data; // This will be the purchase item data returned from the server

    } catch (error: any) {
      console.error(`Failed to add purchase item: ${error.message}`);
      throw new Error(`Failed to add purchase item: ${error.message}`);
    }
  }
);

export const POsearchPurchaseItems = createAsyncThunk<PurchaseItemSearch[], { searchQuery: string, skip: number, limit: number }>(
  'purchaseItems/searchPurchaseItems',
  async ({ searchQuery, skip, limit }) => {
    const cacheKey = `purchaseItems_${searchQuery}_skip${skip}_limit${limit}`;
    const cachedData = localStorage.getItem(cacheKey);
    const now = Date.now();

    // Check if we have cached data
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);

      // If cached data is still valid (not expired), return it
      if (now - timestamp < CACHE_DURATION) {
        console.log('Using cached purchase items data');
        return data;
      } else {
        // If cached data is expired, remove it from localStorage
        console.log('Cache expired, fetching fresh data');
        localStorage.removeItem(cacheKey);
      }
    }

    // Fetch fresh data from the API if no valid cache is found
    const response = await axios.get<PurchaseItemSearch[]>(`https://yenerp.com/purchaseapi/rawMaterials/exact-name/`, {
      params: {
        item_name: searchQuery,
        skip,
        limit,
      },
    });

    // Store the fetched data in localStorage with a timestamp
    localStorage.setItem(cacheKey, JSON.stringify({
      data: response.data,
      timestamp: now,
    }));

    return response.data;
  }
);

export const invalidatePOCache = createAsyncThunk(
  'purchaseItems/invalidateCache',
  async () => {
    // Clear all related localStorage keys for purchaseItems
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('purchaseItems_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('Purchase items cache invalidated');
  }
);

export const searchPurchaseItems = createAsyncThunk<PurchaseItemSearchAdd[], { searchQuery: string; skip: number; limit: number; forceRefresh?: boolean }>(
  'purchaseOrder/searchPurchaseItems',
  async ({ searchQuery, skip, limit, forceRefresh = false }) => {
    const cacheKey = `searchPurchaseItems_${searchQuery}_${skip}_${limit}`;
    const now = Date.now();

    // Check if we have cached data
    const cachedData = localStorage.getItem(cacheKey);

    if (!forceRefresh && cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);

      // If cached data is still valid (not expired), return it
      if (now - timestamp < CACHE_DURATION) {
        console.log('Using cached purchase items data');
        return data || []; // Ensure we return an array even if data is undefined
      } else {
        // If cached data is expired, remove it from localStorage
        console.log('Cache expired, fetching fresh data');
        localStorage.removeItem(cacheKey);
      }
    }

    try {
      // Fetch fresh data from the API if no valid cache is found
      const response = await axios.get<SearchResponse>(`https://yenerp.com/purchaseapi/rawMaterials/search`, {
        params: { itemName: searchQuery, skip, limit },
      });
      // Store the fetched data in localStorage with a timestamp
      const items = response.data?.items || []; // Ensure items is always an array
      localStorage.setItem(cacheKey, JSON.stringify({
        data: items,
        timestamp: now,
      }));

      return items;
    } catch (error) {
      console.error('Error fetching purchase items:', error);
      return []; // Return empty array on error
    }
  }
);
export const invalidatePurchaseItemsCache = createAsyncThunk(
  'purchaseItems/invalidateCache',
  async () => {
    // Clear all related localStorage keys for purchaseItems
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('purchaseItems_') || key.startsWith('searchPurchaseItems_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('Purchase items cache invalidated');
  }
);
// Update existing purchase item
export const updatePurchaseItem = createAsyncThunk(
  'purchaseItems/update',
  async (purchase: PurchaseItem, { dispatch }) => {
    try {
      const purchaseToUpdate = {
        ...purchase,
      };
      const response = await axios.patch<PurchaseItem>(
        `https://yenerp.com/purchaseapi/rawMaterials/${purchase.purchaseitemId}`,
        purchaseToUpdate
      );

      // Invalidate cache after successful update
      dispatch(invalidatePurchaseItemsCache());
      dispatch(invalidatePOCache());
      return response.data;
    } catch (error: any) {
      // Handle errors here
      throw new Error(`Failed to update vendor: ${error.message}`);
    }
  }
);


// Deactivate purchase item
export const deactivatePurchaseItem = createAsyncThunk(
  'purchaseItems/deactivate',
  async (id: string) => {
    const response = await axios.patch<PurchaseItem>(
      `https://yenerp.com/purchaseapi/rawMaterials/${id}`,
      { status: 'deactivated' }
    );
    return id; // Return the ID directly since the status update is handled in the extraReducers
  }
);

// Activate purchase item
export const activatePurchaseItem = createAsyncThunk(
  'purchaseItems/activate',
  async (id: string) => {
    const response = await axios.patch<PurchaseItem>(
      `https://yenerp.com/purchaseapi/rawMaterials/${id}`,
      { status: 'active' }
    );
    return id; // Return the ID directly since the status update is handled in the extraReducers
  }
);
export const importPurchaseItems = createAsyncThunk(
  'purchaseItems/import',
  async ({ file, mode }: ImportPayload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);

      const response = await axios.post(
        'https://yenerp.com/purchaseapi/rawMaterials/import_csv', 
        formData, 
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data as ImportResponse;
    } catch (error: any) {
      if (error.response) {
        if (error.response.status === 422) {
          const detail = error.response.data.detail || {};
          if (detail.missing?.length > 0) {
            return rejectWithValue({
              message: detail.message || 'Validation failed',
              successful: [],
              updated: [],
              failed: [{
                row: 0,
                data: {},
                error: "Missing required columns in CSV file",
                missingFields: detail.missing || []
              }],
              errorCount: detail.error_count || 0
            });
          } else {
            return rejectWithValue({
              message: detail.message || 'Validation failed',
              successful: detail.successful || [],
              updated: detail.updated || [],
              failed: detail.sample_errors || [],
              errorCount: detail.error_count || 0
            });
          }
        }
        return rejectWithValue({
          message: error.response.data.detail?.message || error.response.data.message || 'Import failed',
          successful: [],
          updated: [],
          failed: [],
          errorCount: 0
        });
      }
      return rejectWithValue({
        message: error.message || 'Failed to import purchase items',
        successful: [],
        updated: [],
        failed: [],
        errorCount: 0
      });
    }
  }
);
// Async thunk for exporting purchase items (updated version)
export const exportPurchaseItems = createAsyncThunk(
  'purchaseItems/export',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://yenerp.com/purchaseapi/rawMaterials/purchaseitemexport/export_csv', {
        responseType: 'blob',
      });

      // Create download link and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'purchase_items.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      return true;
    } catch (error: any) {
      if (error.response) {
        return rejectWithValue(error.response.data.detail || error.response.data.message);
      }
      return rejectWithValue(error.message || 'Failed to export purchase items');
    }
  }
);

// Slice definition
const purchaseItemSlice = createSlice({
  name: 'purchaseItems',
  initialState,
  reducers: {
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setItemData: (state, action: PayloadAction<PurchaseItem>) => {
      state.itemData = action.payload;
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
    toggleShowDeactivated(state) {
      state.showDeactivated = !state.showDeactivated;
    },
    setEditIndex: (state, action: PayloadAction<number | null>) => {
      state.editIndex = action.payload;
    },
    setItemToActivate: (state, action: PayloadAction<PurchaseItem | null>) => {
      state.itemToActivate = action.payload;
    },
    setDeactivateDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.deactivateDialogOpen = action.payload;
    },
    setActivateDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.activateDialogOpen = action.payload;
    },
    setItemToDeactivate: (state, action: PayloadAction<PurchaseItem | null>) => {
      state.itemToDeactivate = action.payload;
    },
    setTags(state, action: PayloadAction<string[]>) {
      state.tags = action.payload;
    },
    removeTag(state, action: PayloadAction<string>) {
      state.tags = state.tags.filter(tag => tag !== action.payload);
    },

    setPagination: (state, action: PayloadAction<{ page: number; size: number }>) => {
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.size;
    },
    setFilters: (state, action: PayloadAction<{
      itemName?: string;
      purchasecategoryName?: string;
      purchasesubcategoryName?: string;
    }>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    resetImportStatus(state) {
      state.importStatus = 'idle';
      state.importError = null;
      state.importMessage = null;
    },
    resetExportStatus(state) {
      state.exportStatus = 'idle';
      state.exportError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch reducers
      .addCase(fetchPurchaseItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseItems.fulfilled, (state, action) => {
        state.loading = false;
        // Ensure we only update if the response matches current filters
        if (
          (!state.filters.itemName || state.filters.itemName === action.meta.arg.itemName) &&
          (!state.filters.purchasecategoryName || state.filters.purchasecategoryName === action.meta.arg.purchasecategoryName) &&
          (!state.filters.purchasesubcategoryName || state.filters.purchasesubcategoryName === action.meta.arg.purchasesubcategoryName)
        ) {
          state.items = action.payload.items.filter((item: PurchaseItem) => item.status === 'active');
          state.deactivatedItems = action.payload.items.filter((item: PurchaseItem) => item.status === 'deactivated');
          state.totalItems = action.payload.totalItems;
        }
      })
      .addCase(fetchPurchaseItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch purchase items';
      })
      .addCase(fetchPurchaseCategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
        state.error = null;
      })
      .addCase(fetchPurchaseCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch categories';
      })
      .addCase(fetchUom.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUom.fulfilled, (state, action) => {
        state.loading = false;
        state.uoms = action.payload;
        state.error = null;
      })
      .addCase(fetchUom.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch UOMs';
      })
      .addCase(fetchPurchaseTaxes.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseTaxes.fulfilled, (state, action) => {
        state.loading = false;
        state.taxes = action.payload;
        state.error = null;
      })
      .addCase(fetchPurchaseTaxes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch taxes';
      })
      .addCase(fetchStorageLocationItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchStorageLocationItems.fulfilled, (state, action) => {
        state.loading = false;
        state.locations = action.payload;
        state.error = null;
      })
      .addCase(fetchStorageLocationItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch locations';
      })
      .addCase(fetchPurchaseGroupItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseGroupItems.fulfilled, (state, action) => {
        state.loading = false;
        state.groupitems = action.payload;
        state.error = null;
      })
      .addCase(fetchPurchaseGroupItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch group items';
      })
      .addCase(fetchPurchaseItemtype.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseItemtype.fulfilled, (state, action) => {
        state.loading = false;
        state.itemtypes = action.payload;
        state.error = null;
      })
      .addCase(fetchAllVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendors';
      })
      .addCase(fetchAllVendors.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAllVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.vendors = action.payload;
        state.error = null;
      })
      // Add reducers
      .addCase(addPurchaseItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(addPurchaseItem.fulfilled, (state, action) => {
        state.loading = false;

        // Add the new item to the full item list first
        state.items.push(action.payload);
        state.successMessage = 'Purchase item created successfully.';
        state.error = null;
      })
      .addCase(addPurchaseItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add purchase item';
      })
      // Update reducers
      .addCase(updatePurchaseItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(updatePurchaseItem.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.map((item) =>
          item.purchaseitemId === action.payload.purchaseitemId ? { ...item, ...action.payload } : item
        );
        state.items = state.items.filter((item) => containsSearchQuery(item, state.searchQuery));
        state.successMessage = 'Purchase item updated successfully.';
        state.error = null;
      })
      .addCase(updatePurchaseItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update purchase item';
      })
      // Deactivate reducers
      .addCase(deactivatePurchaseItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(deactivatePurchaseItem.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.map((item) =>
          item.purchaseitemId === action.payload ? { ...item, status: 'deactivated' } : item
        );
        state.deactivatedItems.push(state.items.find(item => item.purchaseitemId === action.payload) as PurchaseItem);
        state.items = state.items.filter((item) => item.status !== 'deactivated');
        state.successMessage = 'Purchase item deactivated successfully.';
        state.error = null;
      })
      .addCase(deactivatePurchaseItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to deactivate purchase item';
      })

      // Activate reducers
      .addCase(activatePurchaseItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(activatePurchaseItem.fulfilled, (state, action) => {
        state.loading = false;
        state.deactivatedItems = state.deactivatedItems.filter((item) => item.purchaseitemId !== action.payload);
        state.items = state.items.map((item) =>
          item.purchaseitemId === action.payload ? { ...item, status: 'active' } : item
        );
        state.successMessage = 'Purchase item activated successfully.';
        state.error = null;
      })
      .addCase(activatePurchaseItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to activate purchase item';
      })
      .addCase(importPurchaseItems.pending,(state) =>{
        state.importStatus = 'loading'
        state.importError = null
        state.importMessage = null;
      })
      .addCase(importPurchaseItems.fulfilled, (state, action: PayloadAction<ImportResponse>) => {
      state.importStatus = 'succeeded';
      state.importMessage = action.payload.message;
      state.importResults = {
        successful: action.payload.successful || [],
        updated: action.payload.updated || [],
        failed: action.payload.failed || []
      };
    })
      .addCase(importPurchaseItems.rejected,(state,action) => {
        state.importStatus = 'failed';
        state.importError = action.error.message || 'Failed to import purchase items';
      })
      .addCase(exportPurchaseItems.pending,(state)=>{
        state.exportStatus = 'loading';
        state.exportError = null;
      })
      .addCase(exportPurchaseItems.fulfilled,(state)=>{
        state.exportStatus = 'succeeded';
      })
      .addCase(exportPurchaseItems.rejected,(state,action)=>{
        state.exportStatus ='failed';
        state.exportError= action.error.message || 'Failed to export purchase items'
      });
  },
});

// Helper function to check if an item contains the search query
const containsSearchQuery = (item: PurchaseItem, searchQuery: string) => {
  const query = searchQuery.toLowerCase().trim();
  const itemName = item.itemName ? item.itemName.toLowerCase() : ''; // Ensure itemName is defined

  return itemName.includes(query);
};

// Export actions and reducers
export const { clearSuccessMessage, setSearchQuery, setActivateDialogOpen,
  setDeactivateDialogOpen, setDialogOpen, setEditIndex, setItemData, setItemToActivate,
  setItemToDeactivate, setShowDeactivated, setSnackbarMessage, setSnackbarOpen, toggleShowDeactivated,
  setTags, removeTag, setPagination, setFilters, clearFilters,resetExportStatus,resetImportStatus
} = purchaseItemSlice.actions;
export const selectCurrentPage = (state: RootState) => state.purchaseItems.currentPage;
export const selectPageSize = (state: RootState) => state.purchaseItems.pageSize;
export const selectTotalItems = (state: RootState) => state.purchaseItems.totalItems;
// Selector to retrieve state from Redux store
export const selectPurchaseItems = (state: RootState) => state.purchaseItems;

// Export the slice reducer
export default purchaseItemSlice.reducer;
