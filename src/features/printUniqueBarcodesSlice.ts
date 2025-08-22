import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ItemData {
  productId: string;
  itemId: string;
  batchNo: string;
  itemName: string;
  varianceName: string;
  location: string;
  price: string;
  shelfLife: string;
  uom: string;
  qty: number;
  noOfPrintCopies: number;
  expDate: string;
  mfgDate: string;
}

interface PrintUniqueBarcodesState {
  items: ItemData[];
}

const initialState: PrintUniqueBarcodesState = {
  items: [],
};

const printUniqueBarcodesSlice = createSlice({
  name: 'barcodeItems',
  initialState,
  reducers: {
    setItems: (state, action: PayloadAction<ItemData[]>) => {
      state.items = action.payload;
    },
    addItem: (state, action: PayloadAction<ItemData>) => {
      state.items.push(action.payload);
    },
    updateItem: (state, action: PayloadAction<ItemData>) => {
      const index = state.items.findIndex(item => item.productId === action.payload.productId);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.productId !== action.payload);
    },
  },
});

export const { setItems, addItem, updateItem, removeItem } = printUniqueBarcodesSlice.actions;
export default printUniqueBarcodesSlice.reducer;
