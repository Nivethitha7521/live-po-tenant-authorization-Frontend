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
   snackbarOpen: boolean; // ✅ ADD THIS
  snackbarMessage: string | null; // ✅ ADD THIS
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
   snackbarOpen: false, // ✅ ADD THIS
  snackbarMessage: null, // ✅ ADD THIS
};

// Generate unique IDs for browser session and tab
const generateBrowserSessionId = () => {
  let browserSessionId = localStorage.getItem('browserSessionId');
  if (!browserSessionId) {
    browserSessionId = crypto.randomUUID();
    localStorage.setItem('browserSessionId', browserSessionId);
  }
  return browserSessionId;
};

const generateTabId = () => {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
};

const getDeviceFingerprint = (): DeviceFingerprint => {
  return {
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
};

// Track tab state to distinguish between reload and close
const initializeTabTracking = () => {
  const browserSessionId = generateBrowserSessionId();
  const tabId = generateTabId();
  
  // Mark this tab as active
  let activeTabs = JSON.parse(localStorage.getItem(`activeTabs_${browserSessionId}`) || '[]');
  if (!activeTabs.includes(tabId)) {
    activeTabs.push(tabId);
    localStorage.setItem(`activeTabs_${browserSessionId}`, JSON.stringify(activeTabs));
  }
  
  // Set tab as reloading (not closing)
  sessionStorage.setItem('isReloading', 'true');
  
  const cleanup = () => {
    // Only remove tab if this is NOT a reload
    if (sessionStorage.getItem('isReloading') !== 'true') {
      let currentTabs = JSON.parse(localStorage.getItem(`activeTabs_${browserSessionId}`) || '[]');
      currentTabs = currentTabs.filter((id: string) => id !== tabId);
      localStorage.setItem(`activeTabs_${browserSessionId}`, JSON.stringify(currentTabs));
      
      // If this is the last tab, mark browser session for cleanup
      if (currentTabs.length === 0) {
        localStorage.setItem(`browser_${browserSessionId}_closed`, Date.now().toString());
      }
    }
    
    // Clear reload flag
    sessionStorage.removeItem('isReloading');
  };
  
  window.addEventListener('beforeunload', cleanup);
  
  return cleanup;
};

export const checkExistingSession = createAsyncThunk(
  'auth/checkExistingSession',
  async (username: string, { rejectWithValue }) => {
    try {
      const browserSessionId = generateBrowserSessionId();
      
      const response = await axios.get(
        `${BASE_URL}/logincheck/check-existing-session`,
        {
          params: {
            username: username,
            browser_session_id: browserSessionId
          }
        }
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Session check failed');
    }
  }
);


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

export const addNewTab = createAsyncThunk(
  'auth/addNewTab',
  async (newTabId: string, { rejectWithValue }) => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await axios.post(
        `${BASE_URL}/logincheck/add-tab`,
        {
          tab_id: newTabId
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      sessionStorage.setItem('accessToken', response.data.access_token);
      sessionStorage.setItem('tabId', newTabId);

      // Initialize tab tracking for new tab
      initializeTabTracking();

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add tab');
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
        await axios.post(
          `${BASE_URL}/logout?session_id=${sessionId}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 5000,
          }
        );
      }
    } catch (error: any) {
      console.error("Logout API call failed:", error);
    } finally {
      if (logoutReason !== "page_reload") {
        sessionStorage.clear();
        localStorage.removeItem("browserSessionId");
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
  let browserSessionId = localStorage.getItem("browserSessionId");
  let tabId = sessionStorage.getItem("tabId");

  // ⭐ Auto-create missing browserSessionId
  if (!browserSessionId) {
    browserSessionId = crypto.randomUUID();
    localStorage.setItem("browserSessionId", browserSessionId);
  }

  // ⭐ Auto-create missing tabId
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem("tabId", tabId);
  }

  // 🔥🔥 MAIN FIX — RESTORE PERMISSIONS 🔥🔥
  const storedPermissions = localStorage.getItem("userPermissions");
  if (storedPermissions) {
    state.permissions = JSON.parse(storedPermissions);
  }

  // ⭐ Set redux state only if logged in
  if (token && username) {
    state.isLoggedIn = true;
    state.username = username;
    state.browserSessionId = browserSessionId;
    state.tabId = tabId;
  }

  state.isInitialized = true;

  initializeTabTracking();
},


    clearError(state) {
      state.error = null;
    },
    forceLogout(state) {
      state.isLoggedIn = false;
      state.username = null;
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
      
      // Initialize tab tracking
      initializeTabTracking();
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
  state.error = null;
  state.isInitialized = true;
},


     
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkExistingSession.fulfilled, (state, action) => {
        if (action.payload.has_valid_session) {
          state.isLoggedIn = true;
          state.username = action.payload.username;
          state.browserSessionId = action.payload.browser_session_id;
          state.error = null;
        }
      })
     
     
      .addCase(validateToken.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.username = action.payload.username;
        state.error = null;
      })
      .addCase(validateToken.rejected, (state, action) => {
        state.isLoggedIn = false;
        state.username = null;
        state.browserSessionId = null;
        state.tabId = null;
        state.error = action.payload as string;
      })
      .addCase(addNewTab.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.username = action.payload.username;
        state.browserSessionId = action.payload.browser_session_id;
        state.tabId = action.payload.tab_id;
        state.error = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoggedIn = false;
        state.username = null;
        state.browserSessionId = null;
        state.tabId = null;
        state.error = null;
      });
  },
});

export const { initializeAuth, clearError, forceLogout, setTabSession,setSnackbarOpen, setSnackbarMessage,clearSnackbar,jwtLoginSuccess } = authSlice.actions;
export default authSlice.reducer;
