import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const BASE_URL = 'http://192.168.29.117:8000/purchaseapi';

interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
}

interface AuthState {
  isLoggedIn: boolean;
  username: string | null;
  error: string | null;
  isInitialized: boolean;
}

const initialState: AuthState = {
  isLoggedIn: false,
  username: null,
  error: null,
  isInitialized: false,
};

export const login = createAsyncThunk(
  'auth/login',
  async (
    {
      username,
      password,
      browserSessionId,
      deviceFingerprint,
    }: {
      username: string;
      password: string;
      browserSessionId: string;
      deviceFingerprint: DeviceFingerprint;
    },
    { rejectWithValue }
  ) => {
    try {
      const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
      const response = await axios.post(
        `${BASE_URL}/logincheck/login`,
        {
          browser_session_id: browserSessionId,
          device_fingerprint: deviceFingerprint,
        },
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      sessionStorage.setItem('accessToken', response.data.access_token);
      sessionStorage.setItem('username', response.data.username);
      sessionStorage.setItem('browserSessionId', browserSessionId);

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (logoutReason: string = 'manual', { rejectWithValue }) => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        await axios.post(
          `${BASE_URL}/logincheck/logout`,
          { logout_reason: logoutReason },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );
      }
    } catch (error: any) {
      console.error('Logout API call failed:', error);
    } finally {
      sessionStorage.clear();
    }
    return logoutReason;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    initializeAuth(state) {
      const token = sessionStorage.getItem('accessToken');
      const username = sessionStorage.getItem('username');
      
      if (token && username) {
        state.isLoggedIn = true;
        state.username = username;
      }
      state.isInitialized = true;
    },
    clearError(state) {
      state.error = null;
    },
    forceLogout(state) {
      state.isLoggedIn = false;
      state.username = null;
      state.error = null;
      sessionStorage.clear();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.username = action.payload.username;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoggedIn = false;
        state.username = null;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoggedIn = false;
        state.username = null;
        state.error = null;
      });
  },
});

export const { initializeAuth, clearError, forceLogout } = authSlice.actions;
export default authSlice.reducer;