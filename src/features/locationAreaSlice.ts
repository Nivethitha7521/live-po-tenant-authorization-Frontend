// src/features/locationAreaSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Country, State, City } from 'country-state-city';

interface Location {
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
}

interface LocationState {
  locations: Location[];
  countries: { value: string; label: string }[];
  states: { value: string; label: string }[];
  cities: { value: string; label: string }[];
  selectedCountry: { value: string; label: string } | null;
  selectedState: { value: string; label: string } | null;
  selectedCity: { value: string; label: string } | null;
  postalCode: string;
}

const initialState: LocationState = {
  locations: [],
  countries: [],
  states: [],
  cities: [],
  selectedCountry: null,
  selectedState: null,
  selectedCity: null,
  postalCode: '',
};

export const fetchCountries = createAsyncThunk('location/fetchCountries', async () => {
  const countries = Country.getAllCountries().map((country) => ({
    value: country.isoCode,
    label: country.name,
  }));
  return countries;
});

export const fetchStates = createAsyncThunk(
  'location/fetchStates',
  async (countryIsoCode: string) => {
    const states = State.getStatesOfCountry(countryIsoCode).map((state) => ({
      value: state.isoCode,
      label: state.name,
    }));
    return states;
  }
);

export const fetchCities = createAsyncThunk(
  'location/fetchCities',
  async ({ countryIsoCode, stateIsoCode }: { countryIsoCode: string; stateIsoCode: string }) => {
    const cities = City.getCitiesOfState(countryIsoCode, stateIsoCode).map((city) => ({
      value: city.name,
      label: city.name,
    }));
    return cities;
  }
);

const locationAreaSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    addLocation: (state, action) => {
      state.locations.push(action.payload);
    },
    setSelectedCountry: (state, action) => {
      state.selectedCountry = action.payload;
      state.states = [];
      state.cities = [];
      state.selectedState = null;
      state.selectedCity = null;
      state.postalCode = '';
    },
    setSelectedState: (state, action) => {
      state.selectedState = action.payload;
      state.cities = [];
      state.selectedCity = null;
      state.postalCode = '';
    },
    setSelectedCity: (state, action) => {
      state.selectedCity = action.payload;
      state.postalCode = '';
    },
    setPostalCode: (state, action) => {
      state.postalCode = action.payload;
    },
    // Add a new action to initialize location from form values
    initializeLocationFromForm: (state, action) => {
      const { countryObj, stateObj, cityObj, postalCode } = action.payload;
      state.selectedCountry = countryObj || null;
      state.selectedState = stateObj || null;
      state.selectedCity = cityObj || null;
      state.postalCode = postalCode || '';
    },
    // Add a reset location state action
    resetLocationState: (state) => {
      state.selectedCountry = null;
      state.selectedState = null;
      state.selectedCity = null;
      state.postalCode = '';
      state.states = [];
      state.cities = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchCountries.fulfilled, (state, action) => {
      state.countries = action.payload;
    });
    builder.addCase(fetchStates.fulfilled, (state, action) => {
      state.states = action.payload;
    });
    builder.addCase(fetchCities.fulfilled, (state, action) => {
      state.cities = action.payload;
    });
  },
});

export const {
  addLocation,
  setSelectedCountry,
  setSelectedState,
  setSelectedCity,
  setPostalCode,
  initializeLocationFromForm,
  resetLocationState
} = locationAreaSlice.actions;
export default locationAreaSlice.reducer;