// src/features/monthlyAttendanceSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface MonthlyAttendance {
  empId: string;
  empName: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  department: string;
  designation: string;
  location: string;
  totalWorkingHours: string;
  totalPresentDays: number;
  totalAbsentDays: number;
  ot: string;
  totalPayableDays: number;
  modified: boolean;
}

interface MonthlyAttendanceState {
  data: MonthlyAttendance[];
  filters: {
    month: string;
    empIdOrName: string;
    location: string;
    department: string;
    designation: string;
  };
  loading: boolean;
  error: string | null;
}

const initialState: MonthlyAttendanceState = {
  data: [],
  filters: {
    month: '',
    empIdOrName: '',
    location: '',
    department: '',
    designation: ''
  },
  loading: false,
  error: null
};

export const fetchMonthlyAttendance = createAsyncThunk(
  'monthlyAttendance/fetchMonthlyAttendance',
  async () => {
    const response = await axios.get('http://localhost:8000/api/attendance/monthly');
    return response.data;
  }
);

export const submitMonthlyAttendance = createAsyncThunk(
  'monthlyAttendance/submitMonthlyAttendance',
  async (modifiedData: MonthlyAttendance[]) => {
    const response = await axios.post('http://localhost:8000/api/attendance/monthly/submit', modifiedData);
    return response.data;
  }
);

const monthlyAttendanceSlice = createSlice({
  name: 'monthlyAttendance',
  initialState,
  reducers: {
    updateAttendance: (state, action: PayloadAction<{ index: number, field: string, value: string }>) => {
      const { index, field, value } = action.payload;
      (state.data[index] as any)[field] = value;
      state.data[index].modified = true;
    },
    setFilter: (state, action: PayloadAction<{ field: string, value: string }>) => {
      const { field, value } = action.payload;
      // state.filters[field] = value;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMonthlyAttendance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMonthlyAttendance.fulfilled, (state, action: PayloadAction<MonthlyAttendance[]>) => {
        state.data = action.payload;
        state.loading = false;
      })
      .addCase(fetchMonthlyAttendance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch monthly attendance data';
      })
      .addCase(submitMonthlyAttendance.fulfilled, (state, action: PayloadAction<MonthlyAttendance[]>) => {
        state.data = action.payload;
      });
  }
});

export const { updateAttendance, setFilter } = monthlyAttendanceSlice.actions;
export default monthlyAttendanceSlice.reducer;
