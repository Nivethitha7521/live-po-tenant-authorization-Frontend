import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Uom {
  id: number;
  unitName: string;
  precision: string;
}

interface UomState {
  uoms: Uom[];
}

const initialState: UomState = {
  uoms: [],
};

const uomSlice = createSlice({
  name: 'uoms',
  initialState,
  reducers: {
    addUom: (state, action: PayloadAction<Omit<Uom, 'id'>>) => {
      state.uoms.push({ ...action.payload, id: state.uoms.length + 1 });
    },
    updateUom: (state, action: PayloadAction<Uom>) => {
      const index = state.uoms.findIndex(uom => uom.id === action.payload.id);
      if (index !== -1) {
        state.uoms[index] = action.payload;
      }
    },
    setUoms: (state, action: PayloadAction<Uom[]>) => {
      state.uoms = action.payload;
    },
  },
});

export const { addUom, updateUom, setUoms } = uomSlice.actions;

export default uomSlice.reducer;
