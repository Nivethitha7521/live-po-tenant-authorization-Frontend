import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Salary {
  basic: string;
  da: string;
  hra: string;
  specialAllowance: string;
  otherAllowances: string;
  medicalAllowance: string;
}

interface UpdateSalaryPayload {
  index: number;
  salary: Salary;
}

const initialState: { salaryDetails: Salary[] } = {
  salaryDetails: [],
};

const salarySlice = createSlice({
  name: 'salary',
  initialState,
  reducers: {
    addSalary(state, action: PayloadAction<Salary>) {
      state.salaryDetails.push(action.payload);
    },
    updateSalary(state, action: PayloadAction<UpdateSalaryPayload>) {
      const { index, salary } = action.payload;
      state.salaryDetails[index] = salary;
    },
    deleteSalary(state, action: PayloadAction<number>) {
      state.salaryDetails.splice(action.payload, 1);
    },
  },
});

export const { addSalary, updateSalary, deleteSalary } = salarySlice.actions;

export default salarySlice.reducer;
