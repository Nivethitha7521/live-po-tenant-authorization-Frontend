import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LeaveMaster {
  id: string;
  name: string;
  type: string;
  days: number;
  department: string;
  status: boolean;
}

interface LeaveManagementState {
  leaveMasters: LeaveMaster[];
}

const initialState: LeaveManagementState = {
  leaveMasters: [],
};

const leaveManagementSlice = createSlice({
  name: 'leaveManagement',
  initialState,
  reducers: {
    addLeaveMaster: (state, action: PayloadAction<LeaveMaster>) => {
      state.leaveMasters.push(action.payload);
    },
    updateLeaveMasterStatus: (state, action: PayloadAction<{ id: string; status: boolean }>) => {
      const leaveMaster = state.leaveMasters.find(leave => leave.id === action.payload.id);
      if (leaveMaster) {
        leaveMaster.status = action.payload.status;
      }
    },
    deleteLeaveMaster: (state, action: PayloadAction<string>) => {
      state.leaveMasters = state.leaveMasters.filter(leave => leave.id !== action.payload);
    },
    editLeaveMaster: (state, action: PayloadAction<LeaveMaster>) => {
      const index = state.leaveMasters.findIndex(leave => leave.id === action.payload.id);
      if (index !== -1) {
        state.leaveMasters[index] = action.payload;
      }
    },
  },
});

export const { addLeaveMaster, updateLeaveMasterStatus, deleteLeaveMaster, editLeaveMaster } = leaveManagementSlice.actions;
export default leaveManagementSlice.reducer;
