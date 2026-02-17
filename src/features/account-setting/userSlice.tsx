
// features/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Define proper types
interface User {
  id: string;
  username: string;
  password?: string;
  confirmPassword?: string;
  role: string;
  active: boolean;
  email?: string;
  full_name?: string;
  employeeId?: string;
}

interface UserState {
  items: User[];
  currentUser: User | null;
  loading: boolean;
}

interface CreateUserPayload {
  username: string;
  password: string;
  role: string;
  email?: string;
  full_name?: string;
}

interface LoginPayload {
  username: string;
  password: string;
}

interface UpdateUserStatusPayload {
  id: string;
  active: boolean;
}

// API calls with proper typing
export const createUser = createAsyncThunk(
  'users/createUser',
  async (userData: CreateUserPayload): Promise<User> => {
    const response = await fetch('https://yenerp.com/purchasetestapi/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return await response.json();
  }
);

export const loginUser = createAsyncThunk(
  'users/loginUser',
  async (loginData: LoginPayload): Promise<User> => {
    const response = await fetch('https://yenerp.com/purchasetestapi/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });
    return await response.json();
  }
);

const initialState: UserState = {
  items: [],
  currentUser: null,
  loading: false
};

const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // Local user management (for immediate UI updates)
    addUserLocally: (state, action: PayloadAction<User>) => {
      state.items.push(action.payload);
    },
    updateUserStatusLocally: (state, action: PayloadAction<UpdateUserStatusPayload>) => {
      const user = state.items.find(u => u.id === action.payload.id);
      if (user) {
        user.active = action.payload.active;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(createUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(createUser.rejected, (state) => {
        state.loading = false;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.currentUser = action.payload;
      });
  }
});

export const { addUserLocally, updateUserStatusLocally } = userSlice.actions;
export default userSlice.reducer;