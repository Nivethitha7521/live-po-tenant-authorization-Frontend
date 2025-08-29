import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
}

const initialState: LocationState = {
  locations: [],
};

const locationSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {
    addLocation(state, action: PayloadAction<Location>) {
      state.locations.push(action.payload);
    },
    // Additional reducers for updating and deleting locations can be added here
  },
});

export const { addLocation } = locationSlice.actions;

export default locationSlice.reducer;
