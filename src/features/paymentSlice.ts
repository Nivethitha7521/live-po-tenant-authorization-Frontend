// features/paymentSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../redux/store'; // Import RootState from the store file

interface PaymentDetail {
  id: string;
  vendorName: string;
  paymentType: string;
  amountPaid: number;
  remainingBalance: number;
  paymentDate: string;
  paymentStatus: string;
}

interface PaymentState {
  payments: PaymentDetail[];
  filter: string;
}

const initialState: PaymentState = {
  payments: [],
  filter: '',
};

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    addPayment: (state, action: PayloadAction<PaymentDetail>) => {
      state.payments.push(action.payload);
    },
    updatePayment: (state, action: PayloadAction<PaymentDetail>) => {
      const index = state.payments.findIndex(payment => payment.id === action.payload.id);
      if (index !== -1) {
        state.payments[index] = action.payload;
      }
    },
    deletePayment: (state, action: PayloadAction<string>) => {
      state.payments = state.payments.filter(payment => payment.id !== action.payload);
    },
    fetchPayments: (state, action: PayloadAction<PaymentDetail[]>) => {
      state.payments = action.payload;
    },
    setFilter: (state, action: PayloadAction<string>) => {
      state.filter = action.payload;
    },
  },
});

export const { addPayment, updatePayment, deletePayment, fetchPayments, setFilter } = paymentSlice.actions;

export const selectPayments = (state: RootState) => {
  const { payments, filter } = state.payment;
  return payments.filter(payment => payment.vendorName.includes(filter));
};
export const selectFilter = (state: RootState) => state.payment.filter;

export default paymentSlice.reducer;
