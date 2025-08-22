import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Deposit {
  depositId: string;
  outletName: string;
  outletLocation: string;
  bankBranchName: string;
  bankName: string;
  depositDate: string;
  amount: string;
  currency: string;
  depositorName: string;
  depositorContact: string;
  salesDate: string;
  remarks: string;
  status: 'Pending' | 'Completed' | 'Failed';
  attachment?: File;
}

interface DepositState {
  deposits: Deposit[];
}

const initialState: DepositState = {
  deposits: [],
};

const depositSlice = createSlice({
  name: 'deposit',
  initialState,
  reducers: {
    addDeposit: (state, action: PayloadAction<Deposit>) => {
      state.deposits.push(action.payload);
    },
    updateDeposit: (state, action: PayloadAction<{ index: number; deposit: Deposit }>) => {
      const { index, deposit } = action.payload;
      state.deposits[index] = deposit;
    },
    deleteDeposit: (state, action: PayloadAction<number>) => {
      state.deposits.splice(action.payload, 1);
    },
  },
});

export const { addDeposit, updateDeposit, deleteDeposit } = depositSlice.actions;

export default depositSlice.reducer;