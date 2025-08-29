import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  assignedEmployees: string[];
  // Add other fields as needed
}

interface UpdateShiftPayload {
  index: number;
  shift: Shift;
}

interface AssignEmployeeToShiftPayload {
  index: number;
  employee: string;
}

interface ShiftState {
  shifts: Shift[];
}

const initialState: ShiftState = {
  shifts: [],
};

const shiftSlice = createSlice({
  name: 'shift',
  initialState,
  reducers: {
    addShift: (state, action: PayloadAction<Omit<Shift, 'assignedEmployees'>>) => {
      state.shifts.push({ ...action.payload, assignedEmployees: [] });
    },
    updateShift: (state, action: PayloadAction<UpdateShiftPayload>) => {
      const { index, shift } = action.payload;
      state.shifts[index] = shift;
    },
    deleteShift: (state, action: PayloadAction<number>) => {
      state.shifts.splice(action.payload, 1);
    },
    assignEmployeeToShift: (state, action: PayloadAction<AssignEmployeeToShiftPayload>) => {
      const { index, employee } = action.payload;
      state.shifts[index].assignedEmployees.push(employee);
    },
  },
});

export const { addShift, updateShift, deleteShift, assignEmployeeToShift } = shiftSlice.actions;

export default shiftSlice.reducer;
