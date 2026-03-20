import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios, { AxiosError } from 'axios';
import { RootState } from '../../../../../redux/store';
export interface dailyActivities {
    branchId: string;
    aliasName:string;
    branchName:string;
    status: string,
    randomId: string,
}
export interface Branche {

  branchName: string;
 
}

export const initialAsset: dailyActivities = {
  branchId: "",
  branchName:"",
  aliasName:"",
  status: "1",
  randomId: "",
};

export interface ActivitiesState {


  branchId: string;
  Activities: dailyActivities[];
  deactivatedAssets: dailyActivities[];
  branch:Branche[];
  loading: boolean;
  error: string | null;
  ActivitiesData: dailyActivities;
  dialogOpen: 'none' | 'edit' | 'add';
  snackbarOpen: boolean;
  snackbarMessage: string;
  showDeactivated: boolean;
}



export const initialState: ActivitiesState = {
  Activities: [],
  deactivatedAssets: [],
  branch:[],
  loading: false,
  error: null,
  ActivitiesData: initialAsset,
  dialogOpen: 'none',
  snackbarOpen: false,
  snackbarMessage: '',
  showDeactivated: false,
  branchId: '',

};

const branches_API_URL = 'https://yenerp.com/fastapi/storedispatches/';


export const fetchActivities = createAsyncThunk<Branche[]>(
  'dailyActivities/fetchActivities',
  async () => {
    const response = await axios.get(branches_API_URL);
    

    return response.data;
  }
);

export const addActivities = createAsyncThunk<dailyActivities, dailyActivities>('dailyActivities/addActivities', async (dailyActivities, { rejectWithValue }) => {
  try {
    const response = await axios.post(branches_API_URL, dailyActivities);
    return response.data;
 } catch (error) {
  const axiosError = error as AxiosError;

  const message =
    axiosError.response?.data || axiosError.message || 'Failed to add dailyActivities';

  return rejectWithValue(message);
}
});

export const updateActivities = createAsyncThunk<dailyActivities, dailyActivities>('dailyActivities/updateActivities', async (dailyActivities, { rejectWithValue }) => {
  try {
    const response = await axios.put(`${branches_API_URL}${dailyActivities.branchId}`, dailyActivities);
    return response.data;
 } catch (error) {
  const axiosError = error as AxiosError;

  const message =
    axiosError.response?.data || axiosError.message || 'Failed to update dailyActivities';

  return rejectWithValue(message);
}
});

export const deactivateActivities = createAsyncThunk<dailyActivities, string>('dailyActivities/deactivateActivities', async (branchId, { rejectWithValue }) => {
  try {
    const response = await axios.patch(`${branches_API_URL}${branchId}`, { status: '0' });
    return response.data;
} catch (error) {
  const axiosError = error as AxiosError;

  const message =
    axiosError.response?.data || axiosError.message || 'Failed to deactivate dailyActivities';

  return rejectWithValue(message);
}
});

export const activateActivities = createAsyncThunk<dailyActivities, string>('dailyActivities/activateActivities', async (branchId, { rejectWithValue }) => {
  try {
    const response = await axios.patch(`${branches_API_URL}${branchId}`, { status: '1' });
    return response.data;
} catch (error) {
  const axiosError = error as AxiosError;

  const message =
    axiosError.response?.data || axiosError.message || 'Failed to activate dailyActivities';

  return rejectWithValue(message);
}
});

const dailyActivitiesSlice = createSlice({
  name: 'dailyActivities',
  initialState,
  reducers: {
    setActivitiesData: (state, action: PayloadAction<dailyActivities>) => {
      state.ActivitiesData = action.payload;
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
    resetActivitiesData: (state) => {
      state.ActivitiesData = initialAsset;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivities.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        state.loading = false;
        state.branch = action.payload;
        // state.deactivatedAssets = action.payload.filter(item => item.status === '0');
      })
      .addCase(fetchActivities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch Activities';
      })
      
      
  },
});

export const {
  setActivitiesData,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  resetActivitiesData,
} = dailyActivitiesSlice.actions;

export const selectBranch = (state: RootState) => state.dailyActivities;

export default dailyActivitiesSlice.reducer;

