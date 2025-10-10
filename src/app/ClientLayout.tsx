'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { initializeAuth, logout, validateToken, checkExistingSession, addNewTab, setTabSession } from '../features/authSlice';
import SideMenu from '@/components/SideMenu';
import Navbar from '@/components/Navbar';

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

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

const ClientLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const { isLoggedIn, isInitialized, username } = useSelector((state: RootState) => state.auth);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [selectedModule, setSelectedModule] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

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
      
      // Set reload flag for this page load
      sessionStorage.setItem('isReloading', 'true');
      
      if (existingToken && storedUsername) {
        try {
          await dispatch(validateToken()).unwrap();
          dispatch(initializeAuth());
          setIsCheckingSession(false);
          return;
        } catch (error) {
          console.error('Token validation failed:', error);
          // Only clear if it's a real validation failure, not reload
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

  // Handle tab/browser close events (NOT reloads)
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      // Check if this is a reload or actual close
      const isReloading = sessionStorage.getItem('isReloading') === 'true';
      
      if (!isReloading && isLoggedIn) {
        // This is an actual tab/browser close, not reload
        const browserSessionId = localStorage.getItem('browserSessionId');
        const tabId = sessionStorage.getItem('tabId');
        
        if (browserSessionId && tabId) {
          // Remove this tab from active tabs
          let activeTabs = JSON.parse(localStorage.getItem(`activeTabs_${browserSessionId}`) || '[]');
          activeTabs = activeTabs.filter((id: string) => id !== tabId);
          localStorage.setItem(`activeTabs_${browserSessionId}`, JSON.stringify(activeTabs));

          // If this is the last tab, logout the browser session
          if (activeTabs.length === 0) {
            try {
              await dispatch(logout('browser_closed')).unwrap();
              localStorage.removeItem(`activeTabs_${browserSessionId}`);
            } catch (error) {
              console.error('Logout on browser close failed:', error);
            }
          } else {
            // Just logout this tab
            try {
              await dispatch(logout('tab_closed')).unwrap();
            } catch (error) {
              console.error('Logout on tab close failed:', error);
            }
          }
        }
      }
      
      // Clear the reload flag for next navigation
      sessionStorage.removeItem('isReloading');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dispatch, isLoggedIn]);

  // Handle redirects for protected routes
  useEffect(() => {
    if (!isInitialized || isCheckingSession) return;

    if (!isLoggedIn && isProtectedRoute) {
      router.replace('/');
    } else if (isLoggedIn && isLoginRoute) {
      router.replace('/yen-purchase');
    }
  }, [isLoggedIn, isInitialized, isProtectedRoute, isLoginRoute, router, isCheckingSession]);

  if (!isInitialized || isCheckingSession) {
    return <LoadingSpinner />;
  }

  // Show layout with Navbar and SideMenu for logged-in users
  if (isLoggedIn) {
    return (
      <div className="flex h-screen overflow-hidden">
        {isMenuOpen && (
          <SideMenu
            onMenuClick={(menuItem) => {
              setSelectedModule(menuItem.text);
              router.push(menuItem.path);
            }}
            activePath={pathname || '/yen-purchase'}
          />
        )}
        <div className={`flex flex-col flex-1 overflow-hidden ${isMenuOpen ? 'pl-12' : 'pl-0'}`}>
          <Navbar
            moduleName={selectedModule}
            username={username || 'User'}
            onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
          />
          <main className="flex-1 overflow-hidden px-2 py-0.5">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Show login page for non-logged-in users
  return <>{children}</>;
};

export default ClientLayout;