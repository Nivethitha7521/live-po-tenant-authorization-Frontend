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
  lastActivity: number | null;
  sessionInfo: {
    idleMinutes: number;
    sessionMinutes: number;
    willTimeoutIn: number;
  } | null;
}

const initialState: AuthState = {
  isLoggedIn: false,
  username: null,
  error: null,
  isInitialized: false,
  browserSessionId: null,
  tabId: null,
  lastActivity: null,
  sessionInfo: null,
};

// Generate unique IDs for browser session and tab
export const generateBrowserSessionId = (): string => {
  let browserSessionId = localStorage.getItem('browserSessionId');
  if (!browserSessionId) {
    browserSessionId = crypto.randomUUID();
    localStorage.setItem('browserSessionId', browserSessionId);
  }
  return browserSessionId;
};

export const generateTabId = (): string => {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
};

export const getDeviceFingerprint = (): DeviceFingerprint => {
  return {
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
};

// Activity monitoring setup
let activityMonitorInterval: NodeJS.Timeout | null = null;
let activityListenersCleanup: (() => void) | null = null;

const setupActivityMonitoring = (dispatch: any) => {
  // Clear any existing monitoring
  if (activityMonitorInterval) {
    clearInterval(activityMonitorInterval);
  }
  if (activityListenersCleanup) {
    activityListenersCleanup();
  }

  // Function to update activity
  const updateActivity = () => {
    dispatch(updateLastActivity());
  };

  // Update activity on user interactions
  const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
  
  const throttledUpdate = () => {
    updateActivity();
  };

  // Add event listeners with throttling
  let throttleTimer: NodeJS.Timeout | null = null;
  const eventHandler = () => {
    if (!throttleTimer) {
      throttleTimer = setTimeout(() => {
        updateActivity();
        throttleTimer = null;
      }, 10000); // Throttle to 10 seconds
    }
  };

  events.forEach(event => {
    window.addEventListener(event, eventHandler);
  });

  // Cleanup function
  activityListenersCleanup = () => {
    events.forEach(event => {
      window.removeEventListener(event, eventHandler);
    });
    if (throttleTimer) {
      clearTimeout(throttleTimer);
    }
  };

  // Periodic activity check every 5 minutes
  activityMonitorInterval = setInterval(() => {
    updateActivity();
  }, 5 * 60 * 1000);

  // Initial activity update
  updateActivity();
};

const stopActivityMonitoring = () => {
  if (activityMonitorInterval) {
    clearInterval(activityMonitorInterval);
    activityMonitorInterval = null;
  }
  if (activityListenersCleanup) {
    activityListenersCleanup();
    activityListenersCleanup = null;
  }
};

// Async Thunks
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
    { rejectWithValue, dispatch }
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

      // Setup activity monitoring after successful login
      setupActivityMonitoring(dispatch);
      
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
      return rejectWithValue(error.response?.data?.detail || 'Token validation failed');
    }
  }
);

export const addNewTab = createAsyncThunk(
  'auth/addNewTab',
  async (newTabId: string, { rejectWithValue, dispatch }) => {
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

      // Setup activity monitoring for new tab
      setupActivityMonitoring(dispatch);

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

export const updateLastActivity = createAsyncThunk(
  'auth/updateLastActivity',
  async (_, { rejectWithValue }) => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        return null;
      }

      const response = await axios.post(
        `${BASE_URL}/logincheck/ping`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Activity update failed:', error);
      return null;
    }
  }
);

export const checkActivityStatus = createAsyncThunk(
  'auth/checkActivityStatus',
  async (_, { rejectWithValue }) => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await axios.get(
        `${BASE_URL}/logincheck/check-activity`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Activity check failed');
    }
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
        state.lastActivity = Date.now();
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
      state.lastActivity = null;
      state.sessionInfo = null;
      
      sessionStorage.clear();
      localStorage.removeItem('browserSessionId');
      
      // Stop activity monitoring
      stopActivityMonitoring();
    },
    setTabSession(state, action) {
      state.isLoggedIn = true;
      state.username = action.payload.username;
      state.browserSessionId = action.payload.browserSessionId;
      state.tabId = action.payload.tabId;
      state.lastActivity = Date.now();
      state.error = null;
    },
    updateActivity(state) {
      state.lastActivity = Date.now();
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
          state.lastActivity = Date.now();
        }
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.username = action.payload.username;
        state.browserSessionId = action.payload.browser_session_id;
        state.tabId = action.payload.tab_id;
        state.error = null;
        state.lastActivity = Date.now();
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoggedIn = false;
        state.username = null;
        state.browserSessionId = null;
        state.tabId = null;
        state.error = action.payload as string;
        state.lastActivity = null;
      })
      .addCase(validateToken.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.username = action.payload.username;
        state.error = null;
        state.lastActivity = Date.now();
        if (action.payload.session_info) {
          state.sessionInfo = {
            idleMinutes: action.payload.session_info.idle_minutes || 0,
            sessionMinutes: action.payload.session_info.session_minutes || 0,
            willTimeoutIn: action.payload.session_info.will_timeout_in || 60,
          };
        }
      })
      .addCase(validateToken.rejected, (state, action) => {
        state.isLoggedIn = false;
        state.username = null;
        state.browserSessionId = null;
        state.tabId = null;
        state.error = action.payload as string;
        state.lastActivity = null;
        state.sessionInfo = null;
      })
      .addCase(addNewTab.fulfilled, (state, action) => {
        state.isLoggedIn = true;
        state.username = action.payload.username;
        state.browserSessionId = action.payload.browser_session_id;
        state.tabId = action.payload.tab_id;
        state.error = null;
        state.lastActivity = Date.now();
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoggedIn = false;
        state.username = null;
        state.browserSessionId = null;
        state.tabId = null;
        state.error = null;
        state.lastActivity = null;
        state.sessionInfo = null;
        
        // Stop activity monitoring
        stopActivityMonitoring();
      })
      .addCase(updateLastActivity.fulfilled, (state, action) => {
        state.lastActivity = Date.now();
      })
      .addCase(checkActivityStatus.fulfilled, (state, action) => {
        if (action.payload.should_logout) {
          state.isLoggedIn = false;
          state.username = null;
          state.browserSessionId = null;
          state.tabId = null;
          state.lastActivity = null;
          state.sessionInfo = null;
          
          // Stop activity monitoring
          stopActivityMonitoring();
        } else {
          state.lastActivity = Date.now();
          if (action.payload.inactive_minutes_left !== undefined) {
            if (!state.sessionInfo) {
              state.sessionInfo = {
                idleMinutes: 0,
                sessionMinutes: 0,
                willTimeoutIn: 60,
              };
            }
            state.sessionInfo.willTimeoutIn = action.payload.inactive_minutes_left;
          }
        }
      });
  },
});

export const { 
  initializeAuth, 
  clearError, 
  forceLogout, 
  setTabSession,
  updateActivity 
} = authSlice.actions;

export default authSlice.reducer;