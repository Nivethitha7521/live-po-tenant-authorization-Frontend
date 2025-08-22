// src/features/payrollSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface Payroll {
  empId: string;
  empName: string;
  department: string;
  designation: string;
  location: string;
  totalWorkingDays: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalPaidDays: number;
  grossSalary: number;
  grossBasic: number;
  grossDA: number;
  grossHRA: number;
  earnedBasic: number;
  earnedDA: number;
  earnedHRA: number;
  OT: number;
  employeePF: number;
  employerPF: number;
  employeeESI: number;
  employerESI: number;
  salaryAdvance: number;
  fine: number;
  otherDeduction: number;
  totalDeduction: number;
  finalSalary: number;
  month: string;  // e.g., '2023-05' for May 2023
  modified?: boolean;
}

interface PayrollState {
  data: Payroll[];
  filters: {
    month: string;
    empIdOrName: string;
    department: string;
    designation: string;
    location: string;
  };
  loading: boolean;
  error: string | null;
}

const initialState: PayrollState = {
  data: [],  // Ensure initial state is an empty array
  filters: {
    month: '',
    empIdOrName: '',
    department: '',
    designation: '',
    location: '',
  },
  loading: false,
  error: null,
};

export const fetchPayrollData = createAsyncThunk('payroll/fetchPayrollData', async () => {
  const response = await axios.get('/api/payroll'); // Replace with your API endpoint
  return response.data;
});

const payrollSlice = createSlice({
  name: 'payroll',
  initialState,
  reducers: {
    updatePayroll: (state, action: PayloadAction<{ index: number; field: string; value: any }>) => {
      const { index, field, value } = action.payload;
      state.data[index] = { ...state.data[index], [field]: value, modified: true };
    },
    setPayrollFilter: (state, action: PayloadAction<{ field: string; value: string }>) => {
      state.filters = { ...state.filters, [action.payload.field]: action.payload.value };
    },
    submitPayrollData: (state, action: PayloadAction<Payroll[]>) => {
      // Handle submission logic
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayrollData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayrollData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchPayrollData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch payroll data';
      });
  },
});

export const { updatePayroll, setPayrollFilter, submitPayrollData } = payrollSlice.actions;
export default payrollSlice.reducer;
