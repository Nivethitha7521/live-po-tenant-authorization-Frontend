import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Tax {
  id: number;
  taxName: string;
  taxPercentage: string;
  // Add other fields as needed
}

interface TaxState {
  taxes: Tax[];
}

const initialState: TaxState = {
  taxes: [],
};

const taxSlice = createSlice({
  name: 'taxes',
  initialState,
  reducers: {
    addTax: (state, action: PayloadAction<Omit<Tax, 'id'>>) => {
      state.taxes.push({ ...action.payload, id: state.taxes.length + 1 });
    },
    updateTax: (state, action: PayloadAction<Tax>) => {
      const index = state.taxes.findIndex(tax => tax.id === action.payload.id);
      if (index !== -1) {
        state.taxes[index] = action.payload;
      }
    },
    setTaxes: (state, action: PayloadAction<Tax[]>) => {
      state.taxes = action.payload;
    },
  },
});

export const { addTax, updateTax, setTaxes } = taxSlice.actions;

export default taxSlice.reducer;
