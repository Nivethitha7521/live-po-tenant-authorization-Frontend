

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios, { AxiosError } from 'axios';
import { RootState } from '../../../../../redux/store';

interface ApiErrorResponse {
  message?: string;
  detail?: string;
}
// Dispatch interface
export interface Dispatch {
  dispatchId: string;
  varianceName: string[];
  uom: string[];
  itemName: string[];
  price: number[];
  itemCode?: string[];
  weight: number[];
  qty: number[];
  amount: number[];
  totalAmount: number;
  warehouseName: string | null;
  date: string | null;
  sentDate: string | null;
  reason: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  branchName: string;
  createdBy: string;
  type: string;
  status: string;
  dispatchNumber: number;
  from: string;
  hsnCode: string;
  towarehouseCode: string;
  location: string;
  section: string;
  category: string[];
  subCategory: string[];
}

// Add SelectionRange interface and export it
export interface SelectionRange {
  startDate: string; // ISO string YYYY-MM-DD
  endDate: string;   // ISO string YYYY-MM-DD
  key: string;
}

export interface BranchOption {
  label: string;
  id: string;
  branchName: string;
  aliasName?: string;
}

export interface DispatchState {
  items: Dispatch[];
  deactivatedItems: Dispatch[];
  loading: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  dispatchData: Dispatch;
  dialogOpen: 'none' | 'edit' | 'add';
  snackbarOpen: boolean;
  snackbarMessage: string;
  showDeactivated: boolean;
  filter: {
    date?: string;
    startDate?: string;
    endDate?: string;
    branchNames?: string[];
  };

  selectionRange: SelectionRange;
  submitError: string | null;
  submitSuccess: boolean;
  selectedBranches: BranchOption[];
  isTableVisible: boolean;
  isInitialLoad: boolean;
  isLoading: boolean;
  popupRowId: string | null;
  isFullScreen: boolean;
}

// Initial dispatch object
export const initialDispatch: Dispatch = {
  dispatchId: '',
  varianceName: [''],
  uom: [''],
  itemName: [''],
  price: [0],
  itemCode: [''],
  weight: [0],
  qty: [0],
  amount: [0],
  totalAmount: 0,
  warehouseName: null,
  date: new Date().toISOString(),
  reason: null,
  vehicleNumber: null,
  driverName: null,
  branchName: '',
  createdBy: '',
  type: '',
  status: '',
  dispatchNumber: 0,
  from: '',
  hsnCode: '',
  towarehouseCode: '',
  location: '',
  section: '',
  category: [],
  subCategory: [],
  sentDate: null
};

// Initial state
export const initialState: DispatchState = {
  items: [],
  deactivatedItems: [],
  loading: false,
  error: null,
  dispatchData: initialDispatch,
  dialogOpen: 'none',
  snackbarOpen: false,
  snackbarMessage: '',
  showDeactivated: false,
  filter: {
    startDate: undefined,
    endDate: undefined,
    date: undefined,
    branchNames: [],
  },

  status: 'idle',
  selectionRange: {
    startDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    endDate: new Date().toISOString().split('T')[0],
    key: 'selection',
  },
  submitError: null,
  submitSuccess: false,
  selectedBranches: [],
  isTableVisible: true,
  isInitialLoad: true,
  isLoading: false,
  popupRowId: null,
  isFullScreen: false,

};
const DISPATCH_API_URL = 'http://127.0.0.1:8000/fastapi/storedispatches/';

// Async thunk for fetching
interface FetchDispatchParams {
  startDate?: string;
  endDate?: string;
  branchNames?: string[];
}

export const fetchDispatches = createAsyncThunk<Dispatch[], FetchDispatchParams, { rejectValue: string }>(
  'dispatches/fetch',
  async ({ startDate, endDate, branchNames }, { rejectWithValue }) => {
    try {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (branchNames?.length) params.branchNames = branchNames.join(',');

      const response = await axios.get<Dispatch[]>(DISPATCH_API_URL, { params });

      const data = response.data;


      // Normalize date field to string | null

      const normalizedData = data
        .filter((item: Dispatch) => item.status?.toLowerCase() !== 'cancelled')
        .map((item: Dispatch): Dispatch => ({
          ...item,
          date: item.date
            ? typeof item.date === 'string'
              ? item.date.split('T')[0] // keep YYYY-MM-DD
              : new Date(item.date).toISOString().split('T')[0]
            : null,
          sentDate: item.sentDate
            ? typeof item.sentDate === 'string'
              ? item.sentDate.split('T')[0]
              : new Date(item.sentDate).toISOString().split('T')[0]
            : null,
        }));




      return normalizedData;
    } catch (error: unknown) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      return rejectWithValue(axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Error fetching dispatches');
    }
  }
);

// Other async thunks
export const addDispatch = createAsyncThunk<Dispatch, Dispatch>(
  'dispatches/add',
  async (dispatch, { rejectWithValue }) => {
    try {
      const response = await axios.post(DISPATCH_API_URL, dispatch);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      return rejectWithValue(axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Error activating dispatch');
    }
  }
);

export const updateDispatch = createAsyncThunk<Dispatch, Dispatch>(
  'dispatches/update',
  async (dispatch, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${DISPATCH_API_URL}${dispatch.dispatchId}`, dispatch);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      return rejectWithValue(axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Error activating dispatch');
    }
  }
);

export const deactivateDispatch = createAsyncThunk<Dispatch, string>(
  'dispatches/deactivate',
  async (dispatchId, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${DISPATCH_API_URL}${dispatchId}`, { status: 'deactivated' });
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      return rejectWithValue(axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Error activating dispatch');
    }
  }
);

export const activateDispatch = createAsyncThunk<Dispatch, string>(
  'dispatches/activate',
  async (dispatchId, { rejectWithValue }) => {
    try {
      const response = await axios.patch<Dispatch>(`${DISPATCH_API_URL}${dispatchId}`, { status: 'dispatched' });
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError<ApiErrorResponse>;
      return rejectWithValue(axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Error activating dispatch');
    }
  }
);

// Slice
const dispatchSlice = createSlice({
  name: 'dispatch',
  initialState,
  reducers: {
    setDispatchData: (state, action: PayloadAction<Dispatch>) => {
      state.dispatchData = action.payload;
    },
    setDialogOpen: (state, action: PayloadAction<'none' | 'edit' | 'add'>) => {
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
    resetDispatchData: (state) => {
      state.dispatchData = initialDispatch;
    },
    setFilter: (state, action: PayloadAction<Partial<DispatchState['filter']>>) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    setSelectionRange: (state, action: PayloadAction<SelectionRange>) => {
      state.selectionRange = action.payload;
    },
    setSubmitError: (state, action: PayloadAction<string | null>) => {
      state.submitError = action.payload;
    },
    setSubmitSuccess: (state, action: PayloadAction<boolean>) => {
      state.submitSuccess = action.payload;
    },
    setSelectedBranches: (state, action: PayloadAction<BranchOption[]>) => {
      state.selectedBranches = action.payload;
    },
    setIsTableVisible: (state, action: PayloadAction<boolean>) => {
      state.isTableVisible = action.payload;
    },
    setIsInitialLoad: (state, action: PayloadAction<boolean>) => {
      state.isInitialLoad = action.payload;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setPopupRowId: (state, action: PayloadAction<string | null>) => {
      state.popupRowId = action.payload;
    },
    setIsFullScreen: (state, action: PayloadAction<boolean>) => {
      state.isFullScreen = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDispatches.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.isLoading = true;
      })
      .addCase(fetchDispatches.fulfilled, (state, action) => {
        const newBranches = action.payload || [];

        // Create a Map to efficiently merge data by unique identifier
        const branchMap = new Map();

        // Then, add or update with new branches
        newBranches.forEach((branch) => {
          if (branch.dispatchId) {
            branchMap.set(branch.dispatchId, branch);
          }
        });

        // Convert map back to array
        state.items = Array.from(branchMap.values());
        state.loading = false;
        state.isLoading = false;
        state.status = 'succeeded';
        state.isTableVisible = newBranches.length > 0;
        state.submitSuccess = true;
      })
      .addCase(fetchDispatches.rejected, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        state.error = action.payload as string;
        state.isTableVisible = false;
        state.submitSuccess = false;
      })
      .addCase(addDispatch.pending, (state) => {
        state.loading = true;
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addDispatch.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        if (action.payload.status === 'dispatched') {
          state.items.push(action.payload);
        } else {
          state.deactivatedItems.push(action.payload);
        }
        state.snackbarMessage = 'Dispatch added successfully';
        state.snackbarOpen = true;
        state.dialogOpen = 'none';
      })
      .addCase(addDispatch.rejected, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        state.error = action.payload as string;
        state.snackbarMessage = 'Failed to add dispatch';
        state.snackbarOpen = true;
      })
      .addCase(updateDispatch.pending, (state) => {
        state.loading = true;
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateDispatch.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        const index = state.items.findIndex((p) => p.dispatchId === action.payload.dispatchId);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.snackbarMessage = 'Dispatch updated successfully';
        state.snackbarOpen = true;
        state.dialogOpen = 'none';
      })
      .addCase(updateDispatch.rejected, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        state.error = action.payload as string;
        state.snackbarMessage = 'Failed to update dispatch';
        state.snackbarOpen = true;
      })
      .addCase(deactivateDispatch.pending, (state) => {
        state.loading = true;
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deactivateDispatch.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        const index = state.items.findIndex((p) => p.dispatchId === action.payload.dispatchId);
        if (index !== -1) {
          const [deactivated] = state.items.splice(index, 1);
          state.deactivatedItems.push(deactivated);
        }
        state.snackbarMessage = 'Dispatch deactivated successfully';
        state.snackbarOpen = true;
      })
      .addCase(deactivateDispatch.rejected, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        state.error = action.payload as string;
        state.snackbarMessage = 'Failed to deactivate dispatch';
        state.snackbarOpen = true;
      })
      .addCase(activateDispatch.pending, (state) => {
        state.loading = true;
        state.isLoading = true;
        state.error = null;
      })
      .addCase(activateDispatch.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        const index = state.deactivatedItems.findIndex((p) => p.dispatchId === action.payload.dispatchId);
        if (index !== -1) {
          const [activated] = state.deactivatedItems.splice(index, 1);
          state.items.push(activated);
        }
        state.snackbarMessage = 'Dispatch activated successfully';
        state.snackbarOpen = true;
      })
      .addCase(activateDispatch.rejected, (state, action) => {
        state.loading = false;
        state.isLoading = false;
        state.error = action.payload as string;
        state.snackbarMessage = 'Failed to activate dispatch';
        state.snackbarOpen = true;
      });
  },
});

// Export actions and selectors
export const {
  setDispatchData,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  resetDispatchData,
  setFilter,
  setSelectionRange,
  setSubmitError,
  setSubmitSuccess,
  setSelectedBranches,
  setIsTableVisible,
  setIsInitialLoad,
  setIsLoading,
  setPopupRowId,
  setIsFullScreen,
} = dispatchSlice.actions;

export const selectDispatches = (state: RootState) => state.dispatches;

export default dispatchSlice.reducer;