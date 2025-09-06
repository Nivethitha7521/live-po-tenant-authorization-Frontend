import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface ItemData {
  id: number;
  itemName: string;
  variance: string;
  category: string;
  subcategory: string;
  currentSystemStock: number;
  modifiedPhysicalStock: number;
  stockVariation: number;
}

interface OutletPhysicalStockState {
  items: ItemData[];
  loading: boolean;
  error: string | null;
}

const initialState: OutletPhysicalStockState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchItems = createAsyncThunk('outletPhysicalStock/fetchItems', async () => {
  const response = await axios.get<ItemData[]>('http://192.168.29.117:8000/fastapi/items'); // Adjust the URL based on your FastAPI endpoint
  return response.data.map(item => ({
    ...item,
    modifiedPhysicalStock: item.currentSystemStock,
    stockVariation: 0,
  }));
});

const outletPhysicalStockSlice = createSlice({
  name: 'outletPhysicalStock',
  initialState,
  reducers: {
    updateModifiedPhysicalStock(state, action: PayloadAction<{ id: number; value: number }>) {
      const { id, value } = action.payload;
      const item = state.items.find(item => item.id === id);
      if (item) {
        item.modifiedPhysicalStock = value;
        item.stockVariation = value - item.currentSystemStock;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchItems.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch items';
      });
  },
});

export const { updateModifiedPhysicalStock } = outletPhysicalStockSlice.actions;
export default outletPhysicalStockSlice.reducer;
