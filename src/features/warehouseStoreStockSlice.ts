import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface ItemData {
  id: number;
  itemName: string;
  variance: string;
  category: string;
  subcategory: string;
  currentSystemStock: number;
  modifiedStoreStock: number;
  stockVariation: number;
}

interface WarehouseStoreStockState {
  items: ItemData[];
  loading: boolean;
  error: string | null;
}

const initialState: WarehouseStoreStockState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchStoreItems = createAsyncThunk('warehouseStoreStock/fetchItems', async () => {
  const response = await axios.get<ItemData[]>('/api/storeitems'); // Adjust the URL based on your FastAPI endpoint
  return response.data.map(item => ({
    ...item,
    modifiedStoreStock: item.currentSystemStock,
    stockVariation: 0,
  }));
});

const warehouseStoreStockSlice = createSlice({
  name: 'warehouseStoreStock',
  initialState,
  reducers: {
    updateModifiedStoreStock(state, action: PayloadAction<{ id: number; value: number }>) {
      const { id, value } = action.payload;
      const item = state.items.find(item => item.id === id);
      if (item) {
        item.modifiedStoreStock = value;
        item.stockVariation = value - item.currentSystemStock;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchStoreItems.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStoreItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchStoreItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch items';
      });
  },
});

export const { updateModifiedStoreStock } = warehouseStoreStockSlice.actions;
export default warehouseStoreStockSlice.reducer;
