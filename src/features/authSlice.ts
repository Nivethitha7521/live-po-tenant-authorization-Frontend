import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8000/purchasetestapi';

interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
}

interface AuthState {
  isLoggedIn: boolean;
  username: string | null;
   role: string | null; 
  error: string | null;
  isInitialized: boolean;
  browserSessionId: string | null;
  tabId: string | null;
   permissions: any;
    permissionReady: boolean;
   snackbarOpen: boolean; // ✅ ADD THIS
  snackbarMessage: string | null; // ✅ ADD THIS
  token: string | null;
}

const initialState: AuthState = {
  isLoggedIn: false,
  username: null,
   role: null,
  error: null,
  isInitialized: false,
  browserSessionId: null,
  tabId: null,
   permissions: {},
   permissionReady: false,
   snackbarOpen: false, // ✅ ADD THIS
  snackbarMessage: null, // ✅ ADD THIS
  token: null 
};








export const validateToken = createAsyncThunk(
  "auth/validateToken",
  async (_, { rejectWithValue }) => {
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!token) return rejectWithValue("No token");

      const response = await axios.get(
        `${BASE_URL}/validate-token?token=${token}`
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Token invalid");
    }
  }
);



export const logout = createAsyncThunk(
  "auth/logout",
  async (logoutReason: string = "manual", { rejectWithValue }) => {
    try {
      const token = sessionStorage.getItem("accessToken");
      const sessionId = sessionStorage.getItem("session_id");

      // Mark this as NOT reload
      sessionStorage.setItem("isReloading", "false");

      if (token && logoutReason !== "page_reload") {
        const browserSessionId = localStorage.getItem("browserSessionId");
        await axios.post(
          `${BASE_URL}/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "x-browser-session-id": browserSessionId,
            },
            timeout: 5000,
          }
        );
      }
    } catch (error: any) {
      console.error("Logout API call failed:", error);
    } finally {
  if (logoutReason !== "page_reload") {
    const username = sessionStorage.getItem("username");
    const tenantId = sessionStorage.getItem("tenant_id");

    sessionStorage.clear();

    localStorage.setItem(
      "forceLogout",
      JSON.stringify({
        username,
        tenantId,
        time: Date.now(),
      })
    );
  }
}
    return logoutReason;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
initializeAuth(state) {
  let token = sessionStorage.getItem("accessToken");
  let username = sessionStorage.getItem("username");
  // ✅ RESTORE ROLE
  const storedRole = localStorage.getItem("userRole");
  if (storedRole) {
    state.role = storedRole;
  }
  let tabId = sessionStorage.getItem("tabId");

 

  // ⭐ Auto-create missing tabId
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem("tabId", tabId);
  }

  // 🔥🔥 MAIN FIX — RESTORE PERMISSIONS 🔥🔥
  const storedPermissions = localStorage.getItem("userPermissions");
  if (storedPermissions) {
    state.permissions = JSON.parse(storedPermissions);
     state.permissionReady = true;
  }else {
  state.permissionReady = false; // ⭐ IMPORTANT
}

  // ⭐ Set redux state only if logged in
  if (token && username) {
    state.isLoggedIn = true;
    state.username = username;
  
    state.tabId = tabId;
  }

  state.isInitialized = true;

 
},


    clearError(state) {
      state.error = null;
    },
    forceLogout(state) {
      state.isLoggedIn = false;
      state.username = null;
       state.permissions = {};
  state.permissionReady = false; 
      state.error = null;
      state.browserSessionId = null;
      state.tabId = null;
      
      sessionStorage.clear();
      localStorage.removeItem('browserSessionId');
    },
    setTabSession(state, action) {
      state.isLoggedIn = true;
      state.username = action.payload.username;
      state.browserSessionId = action.payload.browserSessionId;
      state.tabId = action.payload.tabId;
      state.error = null;
      
    
    },
      // ✅ ADD THESE NEW REDUCERS
    setSnackbarOpen(state, action) {
      state.snackbarOpen = action.payload;
    },
    setSnackbarMessage(state, action) {
      state.snackbarMessage = action.payload;
    },
    clearSnackbar(state) {
      state.snackbarOpen = false;
      state.snackbarMessage = null;
    },
  jwtLoginSuccess(state, action) {
  state.isLoggedIn = true;
  state.username = action.payload.username;
  state.permissions = action.payload.permissions;
   state.role = action.payload.role; 
   state.token = action.payload.token; 
    state.permissionReady = true;
    
  state.error = null;
  state.isInitialized = true;
},


     
  },
  extraReducers: (builder) => {
    builder
     
     
     
      .addCase(validateToken.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.username = action.payload.username;
        state.error = null;

          if (action.payload.permissions) {
    state.permissions = action.payload.permissions;
    localStorage.setItem(
      "userPermissions",
      JSON.stringify(action.payload.permissions)
    );
    state.permissionReady = true;
  }
      })
      .addCase(validateToken.rejected, (state, action) => {
        state.isLoggedIn = false;
        state.username = null;
        state.browserSessionId = null;
        state.tabId = null;
        state.error = action.payload as string;
         state.permissionReady = true;  
      })
    
      .addCase(logout.fulfilled, (state) => {
        state.isLoggedIn = false;
        state.username = null;
         state.permissions = {};
  state.permissionReady = false;
        state.browserSessionId = null;
        state.tabId = null;
        state.error = null;
      });
  },
});

export const { initializeAuth, clearError, forceLogout, setTabSession,setSnackbarOpen, setSnackbarMessage,clearSnackbar,jwtLoginSuccess } = authSlice.actions;
export default authSlice.reducer;