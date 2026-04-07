import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface WarehouseInventoryState {
  currentSection: string;
}

const initialState: WarehouseInventoryState = {
  currentSection: '',
};

const warehouseInventorySlice = createSlice({
  name: 'warehouseInventory',
  initialState,
  reducers: {
    setCurrentSection(state, action: PayloadAction<string>) {
      state.currentSection = action.payload;
    },
  },
});

export const { setCurrentSection } = warehouseInventorySlice.actions;
export default warehouseInventorySlice.reducer;
