import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Customer {
  customerId: string;
  customerName: string;
  email: string;
  phoneNumber: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  loyaltyPoints: string;
  registrationDate: string;
}

interface CustomerState {
  customers: Customer[];
}

const initialState: CustomerState = {
  customers: [],
};

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    addCustomer: (state, action: PayloadAction<Customer>) => {
      state.customers.push(action.payload);
    },
    updateCustomer: (state, action: PayloadAction<{ index: number; customer: Customer }>) => {
      const { index, customer } = action.payload;
      state.customers[index] = customer;
    },
    deleteCustomer: (state, action: PayloadAction<number>) => {
      state.customers.splice(action.payload, 1);
    },
  },
});

export const { addCustomer, updateCustomer, deleteCustomer } = customerSlice.actions;

export default customerSlice.reducer;
