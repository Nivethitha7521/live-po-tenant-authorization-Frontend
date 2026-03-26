import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';

// Define the Attendance interface
interface Attendance {
  empId: string;
  empName: string;
  date: string;
  department: string;
  location: string;
  checkIn: string[];
  checkOut: string[];
  totalWorkingHours: string;
  status: string;
  modified: boolean;
}

interface DailyAttendanceState {
  data: Attendance[];
  filters: {
    empIdOrName: string;
    location: string;
    department: string;
    status: string;
    date: string;
  };
  loading: boolean;
  error: string | null;
}

const initialState: DailyAttendanceState = {
  data: [],
  filters: {
    empIdOrName: '',
    location: '',
    department: '',
    status: '',
    date: dayjs().format('YYYY-MM-DD'), // Default to current date
  },
  loading: false,
  error: null,
};

export const fetchDailyAttendance = createAsyncThunk(
  'dailyAttendance/fetchDailyAttendance',
  async (date: string) => {
    const response = await axios.get(`https://yenerp.com/purchasetestapi/attendances`);
    return response.data;
  }
);

export const submitDailyAttendance = createAsyncThunk(
  'dailyAttendance/submitDailyAttendance',
  async (modifiedData: Attendance[]) => {
    const response = await axios.post('/api/attendance/daily/submit', modifiedData);
    return response.data;
  }
);

const dailyAttendanceSlice = createSlice({
  name: 'dailyAttendance',
  initialState,
  reducers: {
    updateAttendance: (state, action: PayloadAction<{ index: number, field: string, value: string, subIndex: number | null }>) => {
      const { index, field, value, subIndex } = action.payload;
      if (subIndex !== null) {
        // state.data[index][field][subIndex] = value;
      } else {
        // state.data[index][field] = value;
      }
      state.data[index].modified = true;
    },
    setFilter: (state, action: PayloadAction<{ field: string, value: string }>) => {
      const { field, value } = action.payload;
      // state.filters[field] = value;
    },
    setDateFilter: (state, action: PayloadAction<string>) => {
      state.filters.date = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyAttendance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // .addCase(fetchDailyAttendance.fulfilled, (state, action: PayloadAction<any[]>) => {
      //   const transformedData = action.payload.reduce((acc, attendance) => {
      //     let existingRecord = acc.find(record => record.empId === attendance.empId && record.date === attendance.reportingDate);
      //     if (!existingRecord) {
      //       existingRecord = {
      //         empId: attendance.empId,
      //         empName: attendance.empName,
      //         date: attendance.reportingDate,
      //         department: '', // Add department if available
      //         location: attendance.reportingLocation,
      //         checkIn: attendance.reportingTime,
      //         checkOut: attendance.reportingTime,
      //         totalWorkingHours: '', // Calculate if needed
      //         status: '', // Determine status if needed
      //         modified: false,
      //       };
      //       acc.push(existingRecord);
      //     }
      //     if (attendance.reportingType === 'IN') {
      //       existingRecord.checkIn.push(attendance.reportingTime);
      //     } else if (attendance.reportingType === 'OUT') {
      //       existingRecord.checkOut.push(attendance.reportingTime);
      //     }
      //     return acc;
      //   }, [] as Attendance[]);

      //   state.data = transformedData;
      //   state.loading = false;
      // })
      .addCase(fetchDailyAttendance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch attendance data';
      })
      .addCase(submitDailyAttendance.fulfilled, (state, action: PayloadAction<Attendance[]>) => {
        state.data = action.payload;
      });
  }
});

export const { updateAttendance, setFilter, setDateFilter } = dailyAttendanceSlice.actions;
export default dailyAttendanceSlice.reducer;
