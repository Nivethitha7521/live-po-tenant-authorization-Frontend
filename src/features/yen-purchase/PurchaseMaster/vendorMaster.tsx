import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type VendorSection = 'vendor' | 'vendorType';

interface VendorMasterState {
  activeSection: VendorSection;
}

// Ensure proper initial state
const initialState: VendorMasterState = {
  activeSection: 'vendor', // Default to vendor
};

const vendorMasterSlice = createSlice({
  name: 'vendorMaster',
  initialState,
  reducers: {
    setActiveVendorSection: (state, action: PayloadAction<VendorSection>) => {
      state.activeSection = action.payload;
    },
  },
});

export const { setActiveVendorSection } = vendorMasterSlice.actions;

// Enhanced selector with safety checks
export const selectActiveVendorSection = (state: { vendorMaster?: VendorMasterState }) => {
  return state.vendorMaster?.activeSection || 'vendor'; // Fallback to 'vendor'
};

export default vendorMasterSlice.reducer;