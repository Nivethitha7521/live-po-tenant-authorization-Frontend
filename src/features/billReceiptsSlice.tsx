// src/features/billReceiptsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BillReceiptsState {
  logo: string | null;
  customText: string;
}

const initialState: BillReceiptsState = {
  logo: null,
  customText: '',
};

const billReceiptsSlice = createSlice({
  name: 'billReceipts',
  initialState,
  reducers: {
    setLogo: (state, action: PayloadAction<string | null>) => {
      state.logo = action.payload;
    },
    setCustomText: (state, action: PayloadAction<string>) => {
      state.customText = action.payload;
    },
  },
});

export const { setLogo, setCustomText } = billReceiptsSlice.actions;
export default billReceiptsSlice.reducer;
