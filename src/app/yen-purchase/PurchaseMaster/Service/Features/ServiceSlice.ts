'use client';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '@/redux/store';
import { initialState, Service, ImportResult, PaginatedServiceResponse, PaginatedServiceSummary, ServiceSummary } from '../Models/Service';

const API_BASE_URL = 'http://192.168.29.116:8000/purchasetestapi';

// Async thunk to fetch paginated Service items
export const fetchServiceItems = createAsyncThunk<
  PaginatedServiceResponse,
  { page?: number; limit?: number; status?: 'active' | 'deactivated'; search?: string },
  { rejectValue: string }
>(
  'serviceItems/fetchServiceItems',
  async ({ page = 1, limit = 50, status = 'active', search = '' }, { rejectWithValue }) => {
    try {
      let url = `${API_BASE_URL}/services/?page=${page}&limit=${limit}&status=${status}`;
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      const response = await axios.get<PaginatedServiceResponse>(url);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch service items');
    }
  }
);

// Async thunk to add a new Service item
export const addServiceItem = createAsyncThunk<Service, Omit<Service, 'serviceId'>>(
  'serviceItems/addServiceItem',
  async (serviceData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/services/`, serviceData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add service item');
    }
  }
);

// Async thunk to update an existing Service item
export const updateServiceItem = createAsyncThunk<Service, Service>(
  'serviceItems/updateServiceItem',
  async (serviceData, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/services/${serviceData.mongoId}`,
        serviceData
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update service item');
    }
  }
);

// Async thunk to activate a Service item
export const activateServiceItem = createAsyncThunk<Service, string>(
  'serviceItems/activateServiceItem',
  async (mongoId, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/services/${mongoId}/activate`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to activate service item');
    }
  }
);

// Async thunk to deactivate a Service item
export const deactivateServiceItem = createAsyncThunk<Service, string>(
  'serviceItems/deactivateServiceItem',
  async (mongoId, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/services/${mongoId}/deactivate`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to deactivate service item');
    }
  }
);
// Single thunk for all service summary operations
export const fetchServiceSummaries = createAsyncThunk<
  PaginatedServiceSummary,  // Always returns full paginated response
  {
    page?: number;
    limit?: number;
    status?: 'active' | 'deactivated' | 'all';
    search?: string;
    // Optional flag to indicate if this is for infinite scroll
    forInfiniteScroll?: boolean;
  },
  { rejectValue: string }
>(
  'serviceItems/fetchServiceSummaries',
  async ({
    page = 1,
    limit = 5,
    status = 'active',
    search = '',
    forInfiniteScroll = false
  }, { rejectWithValue }) => {
    try {
      // For infinite scroll, adjust limit if needed
      const actualLimit = forInfiniteScroll ? Math.max(limit, 50) : limit;

      let url = `${API_BASE_URL}/services/summary/paginatedsummary?page=${page}&limit=${actualLimit}&status=${status}`;
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const response = await axios.get<PaginatedServiceSummary>(url);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch service summaries');
    }
  }
);
// Async thunk for importing CSV
export const importCSV = createAsyncThunk<ImportResult, File>(
  'serviceItems/importCSV',
  async (file: File, { rejectWithValue }) => {
    if (!file || file.size === 0) {
      return rejectWithValue({ detail: 'Please select a CSV file to import' });
    }
    if (!file.name.endsWith('.csv')) {
      return rejectWithValue({ detail: 'Invalid file format. Please upload a CSV file' });
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API_BASE_URL}/services/import-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as ImportResult;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { detail: 'Failed to import CSV' });
    }
  }
);

// Async thunk for exporting CSV
export const exportCSV = createAsyncThunk('serviceItems/exportCSV', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/services/export-service/export-csv`, {
      responseType: 'blob',
    });
    console.log('Export CSV response status:', response.status, 'headers:', response.headers);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'services_export.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error: any) {
    console.error('Export CSV error:', error);
    if (error.response?.data) {
      const blob = error.response.data;
      let errorMessage = 'Failed to export CSV';
      try {
        const text = await new Response(blob).text();
        try {
          const parsed = JSON.parse(text);
          errorMessage = parsed.detail || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
      } catch {
        errorMessage = 'Unable to parse error response';
      }
      return rejectWithValue({ detail: errorMessage, status: error.response.status });
    }
    return rejectWithValue({ detail: 'Failed to export CSV', status: error.response?.status || 500 });
  }
});

// Create the Service slice
const serviceSlice = createSlice({
  name: 'serviceItems',
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setDialogOpen(state, action: PayloadAction<'none' | 'edit' | 'deactivated'>) {
      console.log('setDialogOpen dispatched with:', action.payload);
      state.dialogOpen = action.payload;
    },
    setServiceData(state, action: PayloadAction<Service>) {
      state.serviceData = action.payload;
    },
    setSnackbarOpen(state, action: PayloadAction<boolean>) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action: PayloadAction<string>) {
      state.snackbarMessage = action.payload;
    },
    setEditIndex(state, action: PayloadAction<number | null>) {
      state.editIndex = action.payload;
    },
    setShowImportResultDialog(state, action: PayloadAction<boolean>) {
      state.showImportResultDialog = action.payload;
    },
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },
    resetImportState(state) {
      state.importSuccess = false;
      state.importError = null;
      state.importResult = null;
      state.showImportResultDialog = false;
      state.snackbarOpen = false;
      state.snackbarMessage = '';
    },
    resetExportState(state) {
      state.exportSuccess = false;
      state.exportError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Service Items
      .addCase(fetchServiceItems.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchServiceItems.fulfilled, (state, action) => {
        state.loading = false;
        state.displayItems = action.payload.data;
        state.currentViewStatus = action.meta.arg.status || 'active';
        state.currentPage = action.payload.page;
        state.totalPages = action.payload.total_pages;
        state.totalItems = action.payload.total;
        state.pageSize = action.payload.limit;
      })
      .addCase(fetchServiceItems.rejected, (state, action) => {
        state.loading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Add Service Item
      .addCase(addServiceItem.fulfilled, (state) => {
        state.snackbarMessage = 'Service item added successfully';
        state.snackbarOpen = true;
      })
      .addCase(addServiceItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Update Service Item
      .addCase(updateServiceItem.fulfilled, (state) => {
        state.snackbarMessage = 'Service item updated successfully';
        state.snackbarOpen = true;
      })
      .addCase(updateServiceItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Activate Service Item
      .addCase(activateServiceItem.fulfilled, (state) => {
        state.snackbarMessage = 'Service item activated successfully';
        state.snackbarOpen = true;
      })
      .addCase(activateServiceItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      // Deactivate Service Item
      .addCase(deactivateServiceItem.fulfilled, (state) => {
        state.snackbarMessage = 'Service item deactivated successfully';
        state.snackbarOpen = true;
      })
      .addCase(deactivateServiceItem.rejected, (state, action) => {
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      })
      .addCase(importCSV.pending, (state) => {
        state.importing = true;
        state.importSuccess = false;
        state.importError = null;
        state.importResult = null;
      })
      .addCase(importCSV.fulfilled, (state, action) => {
        state.importing = false;
        state.importSuccess = true;
        state.importResult = action.payload;
        state.showImportResultDialog = true;
        state.snackbarMessage = action.payload.message || 'Service items imported successfully';
        state.snackbarOpen = true;
      })
      .addCase(importCSV.rejected, (state, action: any) => {
        state.importing = false;
        const errorDetail = action.payload?.detail || 'Failed to import CSV';
        state.importError =
          typeof errorDetail === 'object'
            ? errorDetail.message
            : errorDetail;
        state.importResult = {
          message: 'Import failed',
          inserted_count: 0,
          updated_count: 0,
          successful: [],
          failed: [],
          errorCount: 1,
          detail: {
            message: state.importError || 'Failed to import CSV',
            missing: errorDetail?.missing || [],
            required: errorDetail?.required || [],
          },
        };
        state.showImportResultDialog = true;
        state.snackbarMessage = `Import failed: ${errorDetail} (Status: ${action.payload?.status || 'Unknown'})`;
        state.snackbarOpen = true;
      })
      // Export CSV
      .addCase(exportCSV.pending, (state) => {
        state.exporting = true;
        state.exportSuccess = false;
        state.exportError = null;
      })
      .addCase(exportCSV.fulfilled, (state) => {
        state.exporting = false;
        state.exportSuccess = true;
        state.snackbarMessage = 'Service items exported successfully';
        state.snackbarOpen = true;
      })
      .addCase(exportCSV.rejected, (state, action: any) => {
        state.exporting = false;
        state.exportError = action.payload?.detail || 'Failed to export CSV';
        state.snackbarMessage = `Export failed: ${action.payload?.detail || 'Unknown error'} (Status: ${action.payload?.status || 'Unknown'})`;
        state.snackbarOpen = true;
      })
      .addCase(fetchServiceSummaries.pending, (state) => {
        state.summaryLoading = true;
      })
      .addCase(fetchServiceSummaries.fulfilled, (state, action) => {
        state.summaryLoading = false;

        const { data, page, total, total_pages, limit } = action.payload;
        const { forInfiniteScroll } = action.meta.arg;

        if (forInfiniteScroll) {
          // For infinite scroll, append to existing items
          if (page === 1) {
            // First page, replace all items
            state.summaryItems = data;
          } else {
            // Subsequent pages, append new items
            const currentIds = new Set(state.summaryItems.map(item => item.mongoId));
            const newItems = data.filter(item => !currentIds.has(item.mongoId));
            state.summaryItems = [...state.summaryItems, ...newItems];
          }
        } else {
          // For regular paginated view, replace items and store metadata
          state.summaryItems = data;
          state.summaryCurrentPage = page || 1;
          state.summaryTotalPages = total_pages || 0;
          state.summaryTotalItems = total || 0;
          state.summaryPageSize = limit || 5;
        }
      })
      .addCase(fetchServiceSummaries.rejected, (state, action) => {
        state.summaryLoading = false;
        state.snackbarMessage = action.payload as string;
        state.snackbarOpen = true;
      });
  },
});
// At the bottom of your ServiceSlice file, add this selector
export const selectServiceSummary = (state: RootState) => ({
  summaryItems: state.serviceItems.summaryItems,
  summaryLoading: state.serviceItems.summaryLoading,
  summaryCurrentPage: state.serviceItems.summaryCurrentPage,
  summaryTotalPages: state.serviceItems.summaryTotalPages,
  summaryTotalItems: state.serviceItems.summaryTotalItems,
  summaryPageSize: state.serviceItems.summaryPageSize,
  summarySearchQuery: state.serviceItems.summarySearchQuery,
  summaryStatusFilter: state.serviceItems.summaryStatusFilter,
})
// Export actions
export const {
  setSearchQuery,
  setDialogOpen,
  setServiceData,
  setSnackbarOpen,
  setSnackbarMessage,
  setEditIndex,
  setShowImportResultDialog,
  resetImportState,
  resetExportState,
  setCurrentPage,
} = serviceSlice.actions;

// Selector to get Service state
export const selectServiceItems = (state: RootState) => state.serviceItems;

// Export reducer
export default serviceSlice.reducer;