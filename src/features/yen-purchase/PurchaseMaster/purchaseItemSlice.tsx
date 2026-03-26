import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import purchaseApi from '@/utils/api';

import { RootState } from '../../../redux/store';
import { PurchaseItemSearchAdd } from '@/Models/purchaseModel';
import {
  ImportPayload,
  ImportResponse,
  initialState,
  PurchaseCategory,
  PurchaseItem,
  PurchaseItemSearch,
  SearchResponse,
  StorageLocationItem,
  UOM,
  Vendor
} from '@/Models/purchaseitem';
import { PurchaseItemType } from '@/Models/itemType';

// ✅ IMPORTANT: use the existing category thunk from PurchaseCategorySlice
import { fetchCategories } from './PurchaseCategorySlice';



const EXPORT_CSV_URL = 'https://yenerp.com/purchasetestapi/rawMaterials/export_csv';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// ---------- EXPORT (OLD) ----------
export const exportPurchaseItemsToCSV = createAsyncThunk(
  'export/exportPurchaseItemsToCSV',
  async (_, { rejectWithValue }) => {
    try {
      if (!EXPORT_CSV_URL) {
        throw new Error('Export URL is not defined');
      }

      const response = await axios.get(EXPORT_CSV_URL, {
        responseType: 'blob',
         
      });

      if (response.status !== 200) {
        throw new Error('Failed to export purchase items to CSV');
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'purchase_items.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();

      return true;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to export purchase items to CSV');
    }
  }
);

// ---------- FETCH ITEMS (WITH FILTERS) ----------
export const fetchPurchaseItems = createAsyncThunk(
  'purchaseItems/fetch',
  async ({
    page,
    size,
    showDeactivated = false, // Add this parameter
    ...filters
  }: {
    page: number;
    size: number;
    showDeactivated?: boolean;
    itemName?: string;
    purchasecategoryName?: string;
    purchasesubcategoryName?: string;
  }) => {
    const params: Record<string, any> = {
      skip: (page - 1) * size,
      limit: size,
      status: showDeactivated ? 'deactivated' : 'active', // Add status filter
    };

    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });

    try {
      console.log('📡 Fetching purchase items with params:', params);
      
      const response = await purchaseApi.get('https://yenerp.com/purchasetestapi/rawMaterials/', { 
        params,
        

      });
      
      console.log('📦 Raw API response:', response.data);
      
      let items = [];
      let totalItems = 0;
      
      if (Array.isArray(response.data)) {
        items = response.data;
        totalItems = response.data.length;
      } else if (response.data.items) {
        items = response.data.items || [];
        totalItems = response.data.totalItems || response.data.total || items.length;
      } else {
        items = response.data || [];
        totalItems = items.length;
      }
      
      console.log('✅ Processed items:', items);
      console.log('✅ Total items:', totalItems);
      
      return {
        items: items,
        totalItems: totalItems,
        showDeactivated, // Return this to handle in reducer
      };
    } catch (error: any) {
      console.error('❌ Error fetching purchase items:', error);
      console.error('❌ Error response:', error.response?.data);
      throw new Error(error.response?.data?.detail || 'Error fetching purchase items');
    }
  }
);

// ---------- UOM ----------
export const fetchUom = createAsyncThunk('uom/fetch', async () => {
  try {
    const username = localStorage.getItem('username') || 'default_user';
    
    const response = await purchaseApi.get<UOM[]>('https://yenerp.com/purchasetestapi/purchaseuoms/', {
    

    });
    
    console.log('UOM API Response:', response.data);
    
    const uoms = response.data.map((item) => ({ uom: item.uom }));
    return uoms;
  } catch (error: any) {
    console.error('Error fetching UOMs:', error);
    console.error('Error response:', error.response?.data);
    throw new Error(error.response?.data?.detail || 'Failed to fetch UOMs');
  }
});


// ---------- ITEM TYPE ----------
export const fetchPurchaseItemtype = createAsyncThunk('itemtype/fetch', async () => {
  try {
    // Get the username from your auth state or localStorage
    const username = localStorage.getItem('username') || 'default_user'; // Adjust based on your auth
    
    const response = await purchaseApi.get<PurchaseItemType[]>('https://yenerp.com/purchasetestapi/itemtypes/', {
    

    });

    console.log('Item Types API Response:', response.data);
    
    const itemtypes = response.data.map(item => ({
      itemtypeId: item.itemtypeId,
      itemtypeName: item.itemtypeName,
      randomId: item.randomId, // This is crucial for storing in itemTypeId
    }));

    return itemtypes;
  } catch (error: any) {
    console.error('Error fetching item types:', error);
    console.error('Error response:', error.response?.data);
    throw new Error(error.response?.data?.detail || 'Failed to fetch item types');
  }
});


// ---------- TAX ----------
export const fetchPurchaseTaxes = createAsyncThunk('purchaseTaxes/fetch', async () => {
  try {
    const username = localStorage.getItem('username') || 'default_user';
    
    const response = await purchaseApi.get('https://yenerp.com/purchasetestapi/purchasetaxes/', {
     

    });
    
    console.log('Tax API Response:', response.data);
    
    const tax = (response.data as any[]).map((item) => ({
      purchasetaxPercentage: item.purchasetaxPercentage,
    }));
    return tax;
  } catch (error: any) {
    console.error('Error fetching taxes:', error);
    console.error('Error response:', error.response?.data);
    throw new Error(error.response?.data?.detail || 'Failed to fetch taxes');
  }
});


// ---------- STORAGE LOCATION ----------
export const fetchStorageLocationItems = createAsyncThunk('storageLocations/fetch', async () => {
  try {
    const username = localStorage.getItem('username') || 'default_user';
    
    const response = await purchaseApi.get<StorageLocationItem[]>('https://yenerp.com/purchasetestapi/storagelocations/', {
      

    });
    
    console.log('Location API Response:', response.data);
    
    const location = response.data.map((item) => ({ locationName: item.locationName }));
    return location;
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    console.error('Error response:', error.response?.data);
    throw new Error(error.response?.data?.detail || 'Failed to fetch locations');
  }
});

export const fetchPurchaseGroupItems = createAsyncThunk('groupItems/fetch', async () => {
  try {
    const username = localStorage.getItem('username') || 'default_user'; // Adjust based on your auth
    
    const response = await purchaseApi.get('https://yenerp.com/purchasetestapi/itemgroups/', {
     

    });

    console.log('Group Items API Response:', response.data);

    const groupitem = response.data.map((item: any) => ({
      itemgroupId: item.itemgroupId,
      itemgroupName: item.itemgroupName
    }));

    return groupitem;
  } catch (error: any) {
    console.error('Error fetching group items:', error);
    console.error('Error response:', error.response?.data);
    throw new Error(error.response?.data?.detail || 'Failed to fetch group items');
  }
});


// ---------- VENDORS ----------
export const fetchAllVendors = createAsyncThunk('vendors/fetch', async () => {
  const response = await purchaseApi.get<Vendor[]>('https://yenerp.com/purchasetestapi/vendors/',);
  const vendorData = response.data.map((item) => ({
    vendorId: item.vendorId,
    vendorName: item.vendorName,
  }));
  return vendorData;
});

// ---------- ADD ITEM ----------
export const addPurchaseItem = createAsyncThunk(
  'purchaseItems/add',
  async (purchase: Omit<PurchaseItem, 'purchaseitemId'>, { dispatch, rejectWithValue }) => {
    try {
      const username = localStorage.getItem('username') || 'default_user';
      
      const purchaseToAdd = {
        ...purchase,
      };

      console.log('Sending purchase item data:', purchaseToAdd);

      const response = await purchaseApi.post<PurchaseItem>(
        'https://yenerp.com/purchasetestapi/rawMaterials/',
        purchaseToAdd,
       
      );

      console.log('Add purchase item response:', response.data);

      dispatch(invalidatePurchaseItemsCache());
      dispatch(invalidatePOCache());
      return response.data;
    } catch (error: any) {
      console.error('Failed to add purchase item:', error);
      console.error('Error response:', error.response?.data);
       console.error('❌ FULL Backend Response:', error.response);
       console.error('❌ Backend Data:', error.response?.data);
  console.error('❌ Backend Detail:', error.response?.data?.detail);
      // Return detailed error information
      return rejectWithValue({
        message: error.response?.data?.detail || error.response?.data?.message || 'Failed to add purchase item',
        validationErrors: error.response?.data?.detail || null,
        status: error.response?.status
      });
    }
  }
);

// ---------- SEARCH (PO) ----------
export const POsearchPurchaseItems = createAsyncThunk<
  PurchaseItemSearch[],
  { searchQuery: string; skip: number; limit: number }
>('purchaseItems/searchPurchaseItems', async ({ searchQuery, skip, limit }) => {
  const cacheKey = `purchaseItems_${searchQuery}_skip${skip}_limit${limit}`;
  const cachedData = localStorage.getItem(cacheKey);
  const now = Date.now();

  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);

    if (now - timestamp < CACHE_DURATION) {
      console.log('Using cached purchase items data');
      return data;
    } else {
      console.log('Cache expired, fetching fresh data');
      localStorage.removeItem(cacheKey);
    }
  }

  const response = await purchaseApi.get<PurchaseItemSearch[]>(
    `https://yenerp.com/purchasetestapi/rawMaterials/exact-name/`,
    {
      params: {
        item_name: searchQuery,
        skip,
        limit,
      },
      
    }
  );

  localStorage.setItem(
    cacheKey,
    JSON.stringify({
      data: response.data,
      timestamp: now,
    })
  );

  return response.data;
});


export const invalidatePOCache = createAsyncThunk('purchaseItems/invalidateCache', async () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('purchaseItems_')) {
      localStorage.removeItem(key);
    }
  });
  console.log('Purchase items cache invalidated');
});

// In purchaseItemSlice.ts, ensure the thunk is properly typed
export const searchPurchaseItems = createAsyncThunk<
  PurchaseItemSearchAdd[],  // Return type
  { 
    searchQuery: string; 
    skip: number; 
    limit: number; 
    forceRefresh?: boolean;
    locationId?: string | null;
  }
>('purchaseOrder/searchPurchaseItems', async ({ 
  searchQuery, 
  skip, 
  limit, 
  forceRefresh = false,
  locationId = null
}) => {
  try {
    console.log('🔍 searchPurchaseItems: Fetching fresh data with stock from API', { 
      searchQuery, 
      skip, 
      limit, 
      locationId 
    });
    
    // Build params object
    const params: Record<string, any> = { 
      itemName: searchQuery, 
      skip, 
      limit
    };
    
    // Add locationId to params if provided
    if (locationId) {
      params.locationId = locationId;
    }
    
    // Add cache-busting only if forceRefresh is true
    if (forceRefresh) {
      params._t = Date.now();
    }
    
    const response = await purchaseApi.get<SearchResponse>(
      `https://yenerp.com/purchasetestapi/rawMaterials/search-with-stock`,
      { params }
    );
    
    const items = response.data?.items || [];
    console.log(`✅ searchPurchaseItems: Received ${items.length} items with stock for location ${locationId || 'all'}`);
    
    // Log stock details for debugging
    items.forEach(item => {
      console.log(`  📦 ${item.itemName}: stock=${item.availableStock}, location=${item.locationId}`);
    });
    
    return items;
  } catch (error) {
    console.error('❌ Error fetching purchase items:', error);
    return [];
  }
});
export const invalidatePurchaseItemsCache = createAsyncThunk(
  'purchaseItems/invalidateCache',
  async () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('purchaseItems_') || key.startsWith('searchPurchaseItems_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('Purchase items cache invalidated');
  }
);

// ---------- UPDATE ITEM ----------
export const updatePurchaseItem = createAsyncThunk(
  'purchaseItems/update',
  async (purchase: PurchaseItem, { dispatch, rejectWithValue }) => {
    try {
      
      const purchaseToUpdate = {
        ...purchase,
      };
      
      console.log('✏️ Updating purchase item:', purchaseToUpdate);
      console.log('🆔 Update URL:', `https://yenerp.com/purchasetestapi/rawMaterials/${purchase.purchaseitemId}`);

      const response = await purchaseApi.patch<PurchaseItem>(
        `https://yenerp.com/purchasetestapi/rawMaterials/${purchase.purchaseitemId}`,
        purchaseToUpdate,
       
      );

      console.log('✅ Update response:', response.data);

      dispatch(invalidatePurchaseItemsCache());
      dispatch(invalidatePOCache());
      return response.data;
    } catch (error: any) {
      console.error('❌ Update error:', error);
      console.error('❌ Error response:', error.response?.data);
      
      return rejectWithValue({
        message: error.response?.data?.detail || 'Failed to update purchase item',
        validationErrors: error.response?.data?.detail,
        status: error.response?.status
      });
    }
  }
);

// ---------- DEACTIVATE ----------
export const deactivatePurchaseItem = createAsyncThunk('purchaseItems/deactivate', async (id: string, { rejectWithValue }) => {
  try {
    const username = localStorage.getItem('username') || 'default_user';
    
    console.log('🔴 Deactivating item with ID:', id);
    
    const response = await purchaseApi.patch<PurchaseItem>(
      `https://yenerp.com/purchasetestapi/rawMaterials/${id}/deactivate`,
      { status: 'deactivated' },
      
    );

    console.log('✅ Deactivation API response:', response.data);
    return id;
  } catch (error: any) {
    console.error('❌ Deactivate error:', error);
    console.error('❌ Error response:', error.response?.data);
    return rejectWithValue(error.response?.data?.detail || 'Failed to deactivate purchase item');
  }
});
// ---------- ACTIVATE ----------
export const activatePurchaseItem = createAsyncThunk('purchaseItems/activate', async (id: string, { rejectWithValue }) => {
  try {
    const username = localStorage.getItem('username') || 'default_user';
    
    await purchaseApi.patch<PurchaseItem>(
      `https://yenerp.com/purchasetestapi/rawMaterials/${id}/activate`,
      { status: 'active' },
      
    );
    return id;
  } catch (error: any) {
    console.error('Activate error:', error);
    return rejectWithValue(error.response?.data?.detail || 'Failed to activate purchase item');
  }
});
// ---------- IMPORT ----------
export const importPurchaseItems = createAsyncThunk(
  'purchaseItems/import',
  async ({ file, mode }: ImportPayload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);

      const response = await purchaseApi.post(
        'https://yenerp.com/purchasetestapi/rawMaterials/import_csv',
        formData,
      
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
              failed: [
                {
                  row: 0,
                  data: {},
                  error: 'Missing required columns in CSV file',
                  missingFields: detail.missing || [],
                },
              ],
              errorCount: detail.error_count || 0,
            });
          } else {
            return rejectWithValue({
              message: detail.message || 'Validation failed',
              successful: detail.successful || [],
              updated: detail.updated || [],
              failed: detail.sample_errors || [],
              errorCount: detail.error_count || 0,
            });
          }
        }
        return rejectWithValue({
          message: error.response.data.detail?.message || error.response.data.message || 'Import failed',
          successful: [],
          updated: [],
          failed: [],
          errorCount: 0,
        });
      }
      return rejectWithValue({
        message: error.message || 'Failed to import purchase items',
        successful: [],
        updated: [],
        failed: [],
        errorCount: 0,
      });
    }
  }
);

// ---------- EXPORT (NEW) ----------
export const exportPurchaseItems = createAsyncThunk(
  'purchaseItems/export',
  async (_, { rejectWithValue }) => {
    try {
      const response = await purchaseApi.get(
        'https://yenerp.com/purchasetestapi/rawMaterials/purchaseitemexport/export_csv',
        {

          responseType: 'blob',
        }
      );

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

// ---------- SLICE ----------
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
      state.tags = state.tags.filter((tag) => tag !== action.payload);
    },
    setPagination: (state, action: PayloadAction<{ page: number; size: number }>) => {
      state.currentPage = action.payload.page;
      state.pageSize = action.payload.size;
    },
    setFilters: (
      state,
      action: PayloadAction<{
        itemName?: string;
        purchasecategoryName?: string;
        purchasesubcategoryName?: string;
      }>
    ) => {
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
      // FETCH ITEMS
      .addCase(fetchPurchaseItems.pending, (state) => {
        state.loading = true;
      })
     // In your extraReducers, update the fetchPurchaseItems.fulfilled case:
.addCase(fetchPurchaseItems.fulfilled, (state, action) => {
  state.loading = false;
  
  const { items, totalItems, showDeactivated } = action.payload;
  
  if (showDeactivated) {
    // When fetching deactivated items
    state.deactivatedItems = items.filter((item: PurchaseItem) => item.status === 'deactivated');
    state.totalItems = totalItems;
  } else {
    // When fetching active items
    state.items = items.filter((item: PurchaseItem) => item.status === 'active');
    state.totalItems = totalItems;
    
    // Also fetch deactivated items count separately if needed
    const deactivatedCount = items.filter((item: PurchaseItem) => item.status === 'deactivated').length;
    console.log('🔵 Deactivated items count:', deactivatedCount);
  }
  
  state.error = null;
})
      .addCase(fetchPurchaseItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch purchase items';
      })

      // ✅ USE fetchCategories THUNK (from PurchaseCategorySlice)
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
        state.error = null;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch categories';
      })

      // UOM
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

      // TAX
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

      // LOCATION
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

      // GROUP ITEM
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

      // ITEM TYPE
      .addCase(fetchPurchaseItemtype.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPurchaseItemtype.fulfilled, (state, action) => {
        state.loading = false;
        state.itemtypes = action.payload;
        state.error = null;
      })
      .addCase(fetchPurchaseItemtype.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch item types';
      })

      // VENDORS
      .addCase(fetchAllVendors.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAllVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.vendors = action.payload;
        state.error = null;
      })
      .addCase(fetchAllVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vendors';
      })

      // ADD
      .addCase(addPurchaseItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(addPurchaseItem.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
        state.successMessage = 'Purchase item created successfully.';
        state.error = null;
      })
      .addCase(addPurchaseItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add purchase item';
      })

      // UPDATE
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

      // DEACTIVATE
      // In your purchaseItemSlice, update the deactivate extraReducer
.addCase(deactivatePurchaseItem.fulfilled, (state, action) => {
  state.loading = false;
  
  console.log('🔄 Redux: Processing deactivation for ID:', action.payload);
  console.log('🔄 Redux: Items before deactivation:', state.items.map(item => ({ id: item.purchaseitemId, name: item.itemName })));
  
  // Find the item being deactivated
  const itemToDeactivate = state.items.find(item => item.purchaseitemId === action.payload);
  console.log('🔄 Redux: Item to deactivate found:', itemToDeactivate);
  
  if (itemToDeactivate) {
    // Update the item status to deactivated in items array
    state.items = state.items.map((item) =>
      item.purchaseitemId === action.payload ? { ...item, status: 'deactivated' } : item
    );
    
    // Add to deactivatedItems array
    state.deactivatedItems.push({ ...itemToDeactivate, status: 'deactivated' });
    
    // Remove from active items array
    state.items = state.items.filter((item) => item.status !== 'deactivated');
  }
  
  console.log('🔄 Redux: Items after deactivation:', state.items.map(item => ({ id: item.purchaseitemId, name: item.itemName })));
  console.log('🔄 Redux: Deactivated items after:', state.deactivatedItems.map(item => ({ id: item.purchaseitemId, name: item.itemName })));
  
  state.successMessage = 'Purchase item deactivated successfully.';
  state.error = null;
})

      // ACTIVATE
      .addCase(activatePurchaseItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(activatePurchaseItem.fulfilled, (state, action) => {
        state.loading = false;
        state.deactivatedItems = state.deactivatedItems.filter(
          (item) => item.purchaseitemId !== action.payload
        );
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

      // IMPORT
      .addCase(importPurchaseItems.pending, (state) => {
        state.importStatus = 'loading';
        state.importError = null;
        state.importMessage = null;
      })
      .addCase(importPurchaseItems.fulfilled, (state, action: PayloadAction<ImportResponse>) => {
        state.importStatus = 'succeeded';
        state.importMessage = action.payload.message;
        state.importResults = {
          successful: action.payload.successful || [],
          updated: action.payload.updated || [],
          failed: action.payload.failed || [],
        };
      })
      .addCase(importPurchaseItems.rejected, (state, action) => {
        state.importStatus = 'failed';
        state.importError = action.error.message || 'Failed to import purchase items';
      })

      // EXPORT
      .addCase(exportPurchaseItems.pending, (state) => {
        state.exportStatus = 'loading';
        state.exportError = null;
      })
      .addCase(exportPurchaseItems.fulfilled, (state) => {
        state.exportStatus = 'succeeded';
      })
      .addCase(exportPurchaseItems.rejected, (state, action) => {
        state.exportStatus = 'failed';
        state.exportError = action.error.message || 'Failed to export purchase items';
      });
  },
});

// ---------- HELPERS ----------
const containsSearchQuery = (item: PurchaseItem, searchQuery: string) => {
  const query = searchQuery.toLowerCase().trim();
  const itemName = item.itemName ? item.itemName.toLowerCase() : '';
  return itemName.includes(query);
};

// ---------- EXPORTS ----------
export const {
  clearSuccessMessage,
  setSearchQuery,
  setActivateDialogOpen,
  setDeactivateDialogOpen,
  setDialogOpen,
  setEditIndex,
  setItemData,
  setItemToActivate,
  setItemToDeactivate,
  setShowDeactivated,
  setSnackbarMessage,
  setSnackbarOpen,
  toggleShowDeactivated,
  setTags,
  removeTag,
  setPagination,
  setFilters,
  clearFilters,
  resetExportStatus,
  resetImportStatus,
} = purchaseItemSlice.actions;

export const selectCurrentPage = (state: RootState) => state.purchaseItems.currentPage;
export const selectPageSize = (state: RootState) => state.purchaseItems.pageSize;
export const selectTotalItems = (state: RootState) => state.purchaseItems.totalItems;
export const selectPurchaseItems = (state: RootState) => state.purchaseItems;

export default purchaseItemSlice.reducer;

