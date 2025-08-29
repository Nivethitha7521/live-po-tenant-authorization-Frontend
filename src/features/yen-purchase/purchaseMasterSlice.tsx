// src/features/activeSectionSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../redux/store';

interface ActiveSectionState {
  activeSection: string;
}

const initialState: ActiveSectionState = {
  activeSection: 'purchase-category', // Initial active section
};

const activeSectionSlice = createSlice({
  name: 'activeSection',
  initialState,
  reducers: {
    setActiveSection: (state, action: PayloadAction<string>) => {
      state.activeSection = action.payload;
    },
  },
});

export const { setActiveSection } = activeSectionSlice.actions;

export const selectActiveSection = (state: RootState) => state.masterPurchase.activeSection;

export default activeSectionSlice.reducer;
