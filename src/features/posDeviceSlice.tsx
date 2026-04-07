import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Device {
  name: string;
  location: string;
  code: string;
}

interface DeviceState {
  devices: Device[];
  deviceName: string;
  location: string;
  deviceCode: string;
  openDialog: boolean;
}

const initialState: DeviceState = {
  devices: [],
  deviceName: '',
  location: '',
  deviceCode: '',
  openDialog: false,
};

const posDeviceSlice = createSlice({
  name: 'posDevice',
  initialState,
  reducers: {
    setDeviceName: (state, action: PayloadAction<string>) => {
      state.deviceName = action.payload;
    },
    setLocation: (state, action: PayloadAction<string>) => {
      state.location = action.payload;
    },
    setDeviceCode: (state, action: PayloadAction<string>) => {
      state.deviceCode = action.payload;
    },
    openDialog: (state) => {
      state.openDialog = true;
    },
    closeDialog: (state) => {
      state.openDialog = false;
    },
    addDevice: (state, action: PayloadAction<Device>) => {
      state.devices.push(action.payload);
    },
    clearForm: (state) => {
      state.deviceName = '';
      state.location = '';
      state.deviceCode = '';
    },
  },
});

export const {
  setDeviceName,
  setLocation,
  setDeviceCode,
  openDialog,
  closeDialog,
  addDevice,
  clearForm,
} = posDeviceSlice.actions;

export default posDeviceSlice.reducer;
