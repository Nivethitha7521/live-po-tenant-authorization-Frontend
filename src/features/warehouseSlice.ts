import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Warehouse {
  id: string;
  name: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  phoneNumber: string;
  email: string;
  latitude: string;
  longitude: string;
  status: string;
  description: string;
  openingHours: string;
  managerName: string;
  managerContact: string;
  createdDate: string;
  lastUpdatedDate: string;
  categories: string[];
}

interface Category {
  value: string;
  label: string;
}

interface WarehouseState {
  warehouses: Warehouse[];
  countries: Category[];
  states: Category[];
  cities: Category[];
  categories: Category[];
  selectedCountry: Category | null;
  selectedState: Category | null;
  selectedCity: Category | null;
  postalCode: string;
}

const initialState: WarehouseState = {
  warehouses: [],
  countries: [],
  states: [],
  cities: [],
  categories: [],
  selectedCountry: null,
  selectedState: null,
  selectedCity: null,
  postalCode: '',
};

const warehouseSlice = createSlice({
  name: 'warehouseData',
  initialState,
  reducers: {
    addWarehouse: (state, action: PayloadAction<Warehouse>) => {
      state.warehouses.push(action.payload);
    },
    fetchCountries: (state) => {
      // Mock data
      state.countries = [
        { value: 'US', label: 'United States' },
        { value: 'CA', label: 'Canada' },
      ];
    },
    fetchStates: (state, action: PayloadAction<string>) => {
      // Mock data
      state.states = [
        { value: 'CA', label: 'California' },
        { value: 'NY', label: 'New York' },
      ];
    },
    fetchCities: (state, action: PayloadAction<{ countryIsoCode: string; stateIsoCode: string }>) => {
      // Mock data
      state.cities = [
        { value: 'LA', label: 'Los Angeles' },
        { value: 'NYC', label: 'New York City' },
      ];
    },
    fetchCategories: (state) => {
      // Mock data
      state.categories = [
        { value: '1', label: 'Category 1' },
        { value: '2', label: 'Category 2' },
        { value: '3', label: 'Category 3' },
      ];
    },
    setSelectedCountry: (state, action: PayloadAction<Category>) => {
      state.selectedCountry = action.payload;
    },
    setSelectedState: (state, action: PayloadAction<Category>) => {
      state.selectedState = action.payload;
    },
    setSelectedCity: (state, action: PayloadAction<Category>) => {
      state.selectedCity = action.payload;
    },
    setPostalCode: (state, action: PayloadAction<string>) => {
      state.postalCode = action.payload;
    },
    setCategoryAssigned: (state, action: PayloadAction<string[]>) => {
      const assignedCategories = action.payload;
      state.warehouses.forEach(warehouse => {
        warehouse.categories = warehouse.categories.filter(category => !assignedCategories.includes(category));
      });
    }
  },
});

export const {
  addWarehouse, fetchCountries, fetchStates, fetchCities,
  fetchCategories, setSelectedCountry, setSelectedState, setSelectedCity,
  setPostalCode, setCategoryAssigned
} = warehouseSlice.actions;

export default warehouseSlice.reducer;
