// src/features/userAccountSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserAccount {
  id: number;
  username: string;
  password: string;
  role: string;
  active: boolean;
}

interface UserAccountState {
  userAccounts: UserAccount[];
  deactivatedUserAccounts: UserAccount[];
  showModal: boolean;
  editMode: boolean;
  currentUser: UserAccount | null;
}

const initialState: UserAccountState = {
  userAccounts: [],
  deactivatedUserAccounts: [],
  showModal: false,
  editMode: false,
  currentUser: null,
};

const userAccountSlice = createSlice({
  name: 'userAccount',
  initialState,
  reducers: {
    addUserAccount: (state, action: PayloadAction<UserAccount>) => {
      state.userAccounts.push({ ...action.payload, id: state.userAccounts.length + 1, active: true });
    },
    updateUserAccount: (state, action: PayloadAction<UserAccount>) => {
      const index = state.userAccounts.findIndex(user => user.id === action.payload.id);
      if (index !== -1) {
        state.userAccounts[index] = action.payload;
      }
    },
    deactivateUserAccount: (state, action: PayloadAction<number>) => {
      const user = state.userAccounts.find(user => user.id === action.payload);
      if (user) {
        user.active = false;
        state.deactivatedUserAccounts.push(user);
        state.userAccounts = state.userAccounts.filter(user => user.id !== action.payload);
      }
    },
    activateUserAccount: (state, action: PayloadAction<number>) => {
      const user = state.deactivatedUserAccounts.find(user => user.id === action.payload);
      if (user) {
        user.active = true;
        state.userAccounts.push(user);
        state.deactivatedUserAccounts = state.deactivatedUserAccounts.filter(user => user.id !== action.payload);
      }
    },
    openModal: (state) => {
      state.showModal = true;
    },
    closeModal: (state) => {
      state.showModal = false;
      state.editMode = false;
      state.currentUser = null;
    },
    setEditMode: (state, action: PayloadAction<UserAccount>) => {
      state.editMode = true;
      state.currentUser = action.payload;
      state.showModal = true;
    },
  },
});

export const {
  addUserAccount,
  updateUserAccount,
  deactivateUserAccount,
  activateUserAccount,
  openModal,
  closeModal,
  setEditMode,
} = userAccountSlice.actions;

export default userAccountSlice.reducer;
