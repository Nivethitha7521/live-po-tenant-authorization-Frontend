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
}

interface BarcodeItemsState {
  items: ItemData[];
}

const initialState: BarcodeItemsState = {
  items: [
    {
      productId: '1',
      itemId: 'A1',
      batchNo: 'B001',
      itemName: 'Item 1',
      varianceName: 'V1',
      location: 'L1',
      price: '10.00',
      shelfLife: '1 year',
      uom: 'pcs',
      qty: 100,
      noOfPrintCopies: 1,
    },
    {
      productId: '2',
      itemId: 'A2',
      batchNo: 'B002',
      itemName: 'Item 2',
      varianceName: 'V2',
      location: 'L2',
      price: '20.00',
      shelfLife: '2 years',
      uom: 'pcs',
      qty: 200,
      noOfPrintCopies: 2,
    },
    // Add more example items as needed
  ],
};

const barcodeItemsSlice = createSlice({
  name: 'barcodeItems',
  initialState,
  reducers: {},
});

export default barcodeItemsSlice.reducer;
