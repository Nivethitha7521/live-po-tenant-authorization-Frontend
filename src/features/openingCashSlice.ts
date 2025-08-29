import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OpeningCashData {
  location: string;
  amount: string;
  created: string;
  updated: string;
}

interface OpeningCashState {
  openingCashDetails: OpeningCashData[];
}

const initialState: OpeningCashState = {
  openingCashDetails: [],
};

const openingCashSlice = createSlice({
  name: 'openingCash',
  initialState,
  reducers: {
    addOpeningCash(state, action: PayloadAction<Omit<OpeningCashData, 'created' | 'updated'>>) {
      const currentDate = new Date().toISOString();
      state.openingCashDetails.push({
        ...action.payload,
        created: currentDate,
        updated: currentDate,
      });
    },
    updateOpeningCash(state, action: PayloadAction<{ index: number; openingCash: Omit<OpeningCashData, 'created' | 'updated'> }>) {
      const currentDate = new Date().toISOString();
      state.openingCashDetails[action.payload.index] = {
        ...state.openingCashDetails[action.payload.index],
        ...action.payload.openingCash,
        updated: currentDate,
      };
    },
    deleteOpeningCash(state, action: PayloadAction<number>) {
      state.openingCashDetails.splice(action.payload, 1);
    },
  },
});

export const { addOpeningCash, updateOpeningCash, deleteOpeningCash } = openingCashSlice.actions;

export default openingCashSlice.reducer;
