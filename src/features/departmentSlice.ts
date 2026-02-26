// src/features/departmentSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Department {
  id: string;
  name: string;
}

interface DepartmentState {
  departments: Department[];
}

const initialState: DepartmentState = {
  departments: [],
};

const departmentSlice = createSlice({
  name: 'department',
  initialState,
  reducers: {
    addDepartment(state, action: PayloadAction<Department>) {
      state.departments.push(action.payload);
    },
  },
});

export const { addDepartment } = departmentSlice.actions;
export default departmentSlice.reducer;
