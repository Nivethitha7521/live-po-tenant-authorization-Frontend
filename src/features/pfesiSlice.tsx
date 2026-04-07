import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PFESIDetail {
  id: string;
  employeeId: string;
  contribution: number;
  date: string;
  // Add other fields as needed
}

interface UpdatePfesiPayload {
  index: number;
  pfesi: PFESIDetail;
}

interface PfesiState {
  pfesiDetails: PFESIDetail[];
}

const initialState: PfesiState = {
  pfesiDetails: [],
};

const pfesiSlice = createSlice({
  name: 'pfesi',
  initialState,
  reducers: {
    addPfesi: (state, action: PayloadAction<PFESIDetail>) => {
      state.pfesiDetails.push(action.payload);
    },
    updatePfesi: (state, action: PayloadAction<UpdatePfesiPayload>) => {
      const { index, pfesi } = action.payload;
      state.pfesiDetails[index] = pfesi;
    },
    deletePfesi: (state, action: PayloadAction<number>) => {
      state.pfesiDetails.splice(action.payload, 1);
    },
  },
});

export const { addPfesi, updatePfesi, deletePfesi } = pfesiSlice.actions;

export default pfesiSlice.reducer;
