import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface InventoryState {
  currentSection: string;
}

const initialState: InventoryState = {
  currentSection: '',
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setCurrentSection(state, action: PayloadAction<string>) {
      state.currentSection = action.payload;
    },
  },
});

export const { setCurrentSection } = inventorySlice.actions;
export default inventorySlice.reducer;
