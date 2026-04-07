import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  position: string;
  department: string;
  dateOfHire: string;
  employmentType: 'Full-time' | 'Part-time' | 'Contract';
  salary: string;
  reportingManager: string;
  employeeStatus: 'Active' | 'Inactive';
  emergencyContact: string;
}

interface EmployeeState {
  employees: Employee[];
}

const initialState: EmployeeState = {
  employees: [],
};

const employeeSlice = createSlice({
  name: 'employee',
  initialState,
  reducers: {
    addEmployee: (state, action: PayloadAction<Employee>) => {
      state.employees.push(action.payload);
    },
    updateEmployee: (state, action: PayloadAction<{ index: number; employee: Employee }>) => {
      const { index, employee } = action.payload;
      state.employees[index] = employee;
    },
    deleteEmployee: (state, action: PayloadAction<number>) => {
      state.employees.splice(action.payload, 1);
    },
  },
});

export const { addEmployee, updateEmployee, deleteEmployee } = employeeSlice.actions;

export default employeeSlice.reducer;
