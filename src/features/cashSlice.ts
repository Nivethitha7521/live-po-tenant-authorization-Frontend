import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CashState {
  currentSection: string;
}

const initialState: CashState = {
  currentSection: '',
};

const cashSlice = createSlice({
  name: 'cash',
  initialState,
  reducers: {
    setCurrentSection(state, action: PayloadAction<string>) {
      state.currentSection = action.payload;
    },
  },
});

export const { setCurrentSection } = cashSlice.actions;
export default cashSlice.reducer;
