import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const BASE_URL = 'https://yenerp.com/purchaseapi';

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
  browserSessionId: string | null;
  tabId: string | null;
}

const initialState: AuthState = {
  isLoggedIn: false,
  username: null,
  error: null,
  isInitialized: false,
  browserSessionId: null,
  tabId: null,
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

export const login = createAsyncThunk(
  'auth/login',
  async (
    {
      username,
      password,
    }: {
      username: string;
      password: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const browserSessionId = generateBrowserSessionId();
      const tabId = generateTabId();
      
      // Clear any previous closed marks
      localStorage.removeItem(`browser_${browserSessionId}_closed`);
      
      const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
      const response = await axios.post(
        `${BASE_URL}/logincheck/login`,
        {
          browser_session_id: browserSessionId,
          device_fingerprint: getDeviceFingerprint(),
          tab_id: tabId,
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
      sessionStorage.setItem('tabId', tabId);

      // Initialize tab tracking
      initializeTabTracking();
      
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Login failed');
    }
  }
);

export const validateToken = createAsyncThunk(
  'auth/validateToken',
  async (_, { rejectWithValue }) => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await axios.get(
        `${BASE_URL}/logincheck/validate-token`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      // Don't clear session data immediately - let ClientLayout handle it
      return rejectWithValue(error.response?.data?.detail || 'Token validation failed');
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
  'auth/logout',
  async (logoutReason: string = 'manual', { rejectWithValue }) => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const browserSessionId = localStorage.getItem('browserSessionId');
      const tabId = sessionStorage.getItem('tabId');
      
      // Mark this as NOT a reload (actual logout)
      sessionStorage.setItem('isReloading', 'false');
      
      if (token && logoutReason !== 'page_reload') {
        await axios.post(
          `${BASE_URL}/logincheck/logout`,
          { 
            logout_reason: logoutReason,
            browser_session_id: browserSessionId,
            tab_id: tabId
          },
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
      // Only clear data for actual logout, not page reload
      if (logoutReason !== 'page_reload') {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('tabId');
        
        // Only remove browser session if it's browser closed or last tab
        if (logoutReason === 'browser_closed') {
          localStorage.removeItem('browserSessionId');
        }
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
      const token = sessionStorage.getItem('accessToken');
      const username = sessionStorage.getItem('username');
      const browserSessionId = localStorage.getItem('browserSessionId');
      const tabId = sessionStorage.getItem('tabId');
      
      if (token && username && browserSessionId && tabId) {
        state.isLoggedIn = true;
        state.username = username;
        state.browserSessionId = browserSessionId;
        state.tabId = tabId;
        
        // Initialize tab tracking on page load
        initializeTabTracking();
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
    }
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
      .addCase(login.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.username = action.payload.username;
        state.browserSessionId = action.payload.browser_session_id;
        state.tabId = action.payload.tab_id;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoggedIn = false;
        state.username = null;
        state.browserSessionId = null;
        state.tabId = null;
        state.error = action.payload as string;
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

export const { initializeAuth, clearError, forceLogout, setTabSession } = authSlice.actions;
export default authSlice.reducer;