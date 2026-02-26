// src/features/employeemasterSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface EmployeeMasterState {
  currentSection: string;
}

const initialState: EmployeeMasterState = {
  currentSection: '',
};

const employeemasterSlice = createSlice({
  name: 'employeemaster',
  initialState,
  reducers: {
    setCurrentSection(state, action: PayloadAction<string>) {
      state.currentSection = action.payload;
    },
  },
});

export const { setCurrentSection } = employeemasterSlice.actions;
export default employeemasterSlice.reducer;
