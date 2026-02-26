import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BarcodeData {
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
}

interface BarcodeState {
  barcodes: BarcodeData[];
}

const initialState: BarcodeState = {
  barcodes: [],
};

const barcodeSlice = createSlice({
  name: 'barcode',
  initialState,
  reducers: {
    addBarcode: (state, action: PayloadAction<BarcodeData>) => {
      state.barcodes.push(action.payload);
    },
    updateBarcode: (state, action: PayloadAction<{ index: number, barcode: BarcodeData }>) => {
      const { index, barcode } = action.payload;
      state.barcodes[index] = barcode;
    },
    deleteBarcode: (state, action: PayloadAction<number>) => {
      state.barcodes.splice(action.payload, 1);
    },
  },
});

export const { addBarcode, updateBarcode, deleteBarcode } = barcodeSlice.actions;
export default barcodeSlice.reducer;
