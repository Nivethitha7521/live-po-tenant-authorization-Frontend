'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { 
  initializeAuth, 
  logout, 
  validateToken, 
  checkExistingSession, 
  addNewTab, 
  setTabSession,
  checkActivityStatus,
  updateLastActivity 
} from '../features/authSlice';
import SideMenu from '@/components/SideMenu';
import Navbar from '@/components/Navbar';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PROTECTED_ROUTES = [
  '/yen-purchase',
  '/yen-pos',
  '/yen-hrm',
  '/yen-crm',
  '/yen-book',
  '/yen-store',
  '/yen-inventory',
  '/master-admin',
  '/account-settings',
];

// Map routes to module names
const MODULE_NAMES: Record<string, string> = {
  '/yen-purchase': 'YEN-PURCHASE',
  '/yen-pos': 'YEN-POS',
  '/yen-hrm': 'YEN-HRM',
  '/yen-crm': 'YEN-CRM',
  '/yen-book': 'YEN-BOOK',
  '/yen-store': 'YEN-STORE',
  '/yen-inventory': 'YEN-INVENTORY',
  '/master-admin': 'YEN-MASTER ADMIN',
  '/account-settings': 'YEN-ACCOUNT SETTINGS',
};

// Helper function to get module name from path
const getModuleNameFromPath = (path: string | null): string => {
  if (!path) return 'DASHBOARD';
  
  // Find the matching route
  for (const [route, moduleName] of Object.entries(MODULE_NAMES)) {
    if (path.startsWith(route)) {
      return moduleName;
    }
  }
  
  // Check for sub-routes
  if (path.includes('purchase')) return 'YEN-PURCHASE';
  if (path.includes('pos')) return 'YEN-POS';
  if (path.includes('hrm')) return 'YEN-HRM';
  if (path.includes('crm')) return 'YEN-CRM';
  if (path.includes('book')) return 'YEN-BOOK';
  if (path.includes('store')) return 'YEN-STORE';
  if (path.includes('inventory')) return 'YEN-INVENTORY';
  if (path.includes('admin')) return 'YEN-MASTER ADMIN';
  if (path.includes('settings')) return 'YEN-ACCOUNT SETTINGS';
  
  return 'DASHBOARD';
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

const ClientLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const { isLoggedIn, isInitialized, username, sessionInfo } = useSelector((state: RootState) => state.auth);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutMinutesLeft, setTimeoutMinutesLeft] = useState(60);

  // Get module name from current path
  const currentModule = useMemo(() => getModuleNameFromPath(pathname), [pathname]);

  const isLoginRoute = useMemo(() => pathname === '/', [pathname]);
  const isProtectedRoute = useMemo(() =>
    PROTECTED_ROUTES.some(route => pathname?.startsWith(route)),
    [pathname]
  );

  // Check for existing session and handle tab management
  useEffect(() => {
    const initializeSession = async () => {
      const storedUsername = sessionStorage.getItem('username');
      const existingToken = sessionStorage.getItem('accessToken');
      
      if (existingToken && storedUsername) {
        try {
          await dispatch(validateToken()).unwrap();
          dispatch(initializeAuth());
          setIsCheckingSession(false);
          return;
        } catch (error) {
          console.error('Token validation failed:', error);
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('username');
          sessionStorage.removeItem('tabId');
        }
      }

      // Check if there's an existing session for this browser
      if (storedUsername) {
        try {
          const sessionResult = await dispatch(checkExistingSession(storedUsername)).unwrap();
          
          if (sessionResult.has_valid_session) {
            const tabId = crypto.randomUUID();
            const addTabResult = await dispatch(addNewTab(tabId)).unwrap();
            
            if (addTabResult) {
              sessionStorage.setItem('accessToken', addTabResult.access_token);
              sessionStorage.setItem('username', storedUsername);
              sessionStorage.setItem('tabId', tabId);
              
              dispatch(setTabSession({
                username: storedUsername,
                browserSessionId: addTabResult.browser_session_id,
                tabId: tabId
              }));
              
              setIsCheckingSession(false);
              return;
            }
          }
        } catch (error) {
          console.error('Session check failed:', error);
        }
      }

      dispatch(initializeAuth());
      setIsCheckingSession(false);
    };

    initializeSession();
  }, [dispatch]);

  // Periodic activity check for logged-in users
  useEffect(() => {
    if (!isLoggedIn) return;

    const activityCheckInterval = setInterval(async () => {
      try {
        await dispatch(checkActivityStatus()).unwrap();
      } catch (error) {
        console.error('Activity check failed:', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(activityCheckInterval);
  }, [isLoggedIn, dispatch]);

  // Update session info display
  useEffect(() => {
    if (sessionInfo) {
      const minutesLeft = Math.floor(sessionInfo.willTimeoutIn);
      setTimeoutMinutesLeft(minutesLeft);
      
      // Show warning when less than 10 minutes left
      setShowTimeoutWarning(minutesLeft < 10 && minutesLeft > 0);
    }
  }, [sessionInfo]);

  // Handle redirects for protected routes
  useEffect(() => {
    if (!isInitialized || isCheckingSession) return;

    if (!isLoggedIn && isProtectedRoute) {
      router.replace('/');
    } else if (isLoggedIn && isLoginRoute) {
      router.replace('/yen-purchase');
    }
  }, [isLoggedIn, isInitialized, isProtectedRoute, isLoginRoute, router, isCheckingSession]);

  const handleExtendSession = async () => {
    try {
      await dispatch(updateLastActivity()).unwrap();
      setShowTimeoutWarning(false);
      toast.success('Session extended!');
    } catch (error) {
      console.error('Failed to extend session:', error);
      toast.error('Failed to extend session');
    }
  };

  const handleMenuClick = (menuItem: { text: string; path: string }) => {
    router.push(menuItem.path);
  };

  if (!isInitialized || isCheckingSession) {
    return <LoadingSpinner />;
  }

  // Show layout with Navbar and SideMenu for logged-in users
  if (isLoggedIn) {
    return (
      <>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
        
        {showTimeoutWarning && (
          <div className="fixed top-4 right-4 z-50 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Session about to expire!</p>
                <p>Your session will expire in {timeoutMinutesLeft} minutes due to inactivity.</p>
              </div>
              <button
                onClick={handleExtendSession}
                className="ml-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        )}
        
        <div className="flex h-screen overflow-hidden">
          {isMenuOpen && (
            <SideMenu
              onMenuClick={handleMenuClick}
              activePath={pathname || '/yen-purchase'}
            />
          )}
          <div className={`flex flex-col flex-1 overflow-hidden ${isMenuOpen ? 'pl-12' : 'pl-0'}`}>
            <Navbar
              moduleName={currentModule}
              username={username || 'User'}
              onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
            />
            <main className="flex-1 overflow-hidden px-2 py-0.5">
              {children}
            </main>
          </div>
        </div>
      </>
    );
  }

  // Show login page for non-logged-in users
  return (
    <>
        <ToastContainer
        position="top-right"
        autoClose={3000} // Set to 3000ms (3 seconds)
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false} // Changed to false
        pauseOnHover={false} // Changed to false
        draggable
        theme="light"
      />
      {children}
    </>
  );
};

export default ClientLayout;