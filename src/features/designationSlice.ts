// src/features/designationSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Designation {
  id: string;
  name: string;
}

interface DesignationState {
  designations: Designation[];
}

const initialState: DesignationState = {
  designations: [],
};

const designationSlice = createSlice({
  name: 'designation',
  initialState,
  reducers: {
    addDesignation(state, action: PayloadAction<Designation>) {
      state.designations.push(action.payload);
    },
  },
});

export const { addDesignation } = designationSlice.actions;
export default designationSlice.reducer;
