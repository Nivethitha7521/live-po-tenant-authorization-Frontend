// features/yen-purchase/ServiceOrder/serviceIdSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = `http://192.168.29.116:8000/purchaseapi`;
export const LIMIT = 20; // Add this export

export interface ServiceIdItem {
  mongoId: string;
  serviceId: string;
}

interface ServiceIdState {
  serviceIds: ServiceIdItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  searchQuery: string;
  page: number;
  isInitialLoad: boolean;
}

const initialState: ServiceIdState = {
  serviceIds: [],
  loading: false,
  error: null,
  hasMore: false,
  searchQuery: '',
  page: 0,
  isInitialLoad: true,
};

interface FetchServiceIdsResponse {
  data: ServiceIdItem[];
  skip: number;
  query: string;
}

// Async thunk for fetching service IDs
export const fetchServiceIds = createAsyncThunk<FetchServiceIdsResponse, { 
  query: string; 
  skip: number;
  isInitialLoad?: boolean;
}>(
  'serviceId/fetchServiceIds',
  async ({ query, skip, isInitialLoad = true }, { rejectWithValue }) => {
    try {
      const response = await axios.get<ServiceIdItem[]>(
        `${API_BASE_URL}/servicepo/getServiceIds/`,
        {
          params: {
            query: query || undefined,
            skip,
            limit: LIMIT
          }
        }
      );

      return {
        data: response.data,
        skip,
        query,
        isInitialLoad
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch service IDs');
    }
  }
);

const serviceIdSlice = createSlice({
  name: 'serviceId',
  initialState,
  reducers: {
    clearServiceIds: (state) => {
      state.serviceIds = [];
      state.hasMore = false;
      state.page = 0;
      state.searchQuery = '';
      state.isInitialLoad = true;
    },
    resetServiceIdState: () => initialState,
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setInitialLoad: (state, action: PayloadAction<boolean>) => {
      state.isInitialLoad = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServiceIds.pending, (state, action) => {
        const { isInitialLoad } = action.meta.arg;
        
        state.loading = true;
        state.error = null;
        
        // If it's initial load, clear the array
        if (isInitialLoad) {
          state.serviceIds = [];
          state.page = 0;
          state.isInitialLoad = true;
        }
      })
      .addCase(fetchServiceIds.fulfilled, (state, action: PayloadAction<FetchServiceIdsResponse & { isInitialLoad?: boolean }>) => {
        const { data, skip, query, isInitialLoad = true } = action.payload;
        
        state.loading = false;
        state.error = null;
        
        // If it's a new search query, replace the results
        if (query !== state.searchQuery) {
          state.serviceIds = data;
          state.searchQuery = query;
          state.page = 1;
        } else {
          // If same query, append new data (for infinite scroll)
          // Skip duplicates
          const existingIds = new Set(state.serviceIds.map(item => item.serviceId));
          const newItems = data.filter(item => !existingIds.has(item.serviceId));
          state.serviceIds = [...state.serviceIds, ...newItems];
          
          // Update page count
          if (isInitialLoad) {
            state.page = 1;
          } else {
            state.page += 1;
          }
        }
        
        // Check if more data is available
        state.hasMore = data.length === LIMIT;
        state.isInitialLoad = false;
      })
      .addCase(fetchServiceIds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isInitialLoad = false;
      });
  },
});

export const { 
  clearServiceIds, 
  resetServiceIdState, 
  setLoading, 
  setInitialLoad 
} = serviceIdSlice.actions;
export const selectServiceIdState = (state: any) => state.serviceId;
export default serviceIdSlice.reducer;