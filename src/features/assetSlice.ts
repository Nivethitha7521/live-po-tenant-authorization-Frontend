import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Asset {
  id: string;
  assetName: string;
  assetType: string;
  description: string;
  acquisitionDate: string;
  purchasePrice: string;
  supplier: string;
  location: string;
  department: string;
  condition: string;
  warrantyPeriod: string;
  depreciationMethod: string;
  depreciationRate: string;
  usefulLife: string;
  salvageValue: string;
  serialNumber: string;
}

interface AssetState {
  assets: Asset[];
  filters: {
    assetName: string;
    assetType: string;
    department: string;
    location: string;
  };
}

const initialState: AssetState = {
  assets: [],
  filters: {
    assetName: '',
    assetType: '',
    department: '',
    location: '',
  },
};

const assetSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {
    addAsset: (state, action: PayloadAction<Asset>) => {
      state.assets.push(action.payload);
    },
    updateAsset: (state, action: PayloadAction<Asset>) => {
      const index = state.assets.findIndex(asset => asset.id === action.payload.id);
      if (index !== -1) {
        state.assets[index] = action.payload;
      }
    },
    deleteAsset: (state, action: PayloadAction<string>) => {
      state.assets = state.assets.filter(asset => asset.id !== action.payload);
    },
    fetchAssets: (state, action: PayloadAction<Asset[]>) => {
      state.assets = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<AssetState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
});

export const { addAsset, updateAsset, deleteAsset, fetchAssets, setFilters } = assetSlice.actions;

export default assetSlice.reducer;
