// src/features/attendanceSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AttendanceState {
  currentSection: string;
}

const initialState: AttendanceState = {
  currentSection: 'daily',
};

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    setCurrentSection: (state, action: PayloadAction<string>) => {
      state.currentSection = action.payload;
    },
  },
});

export const { setCurrentSection } = attendanceSlice.actions;
export default attendanceSlice.reducer;
