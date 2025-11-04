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
      
      // No need for reload flag since we're removing beforeunload logout logic
      
      if (existingToken && storedUsername) {
        try {
          await dispatch(validateToken()).unwrap();
          dispatch(initializeAuth());
          setIsCheckingSession(false);
          return;
        } catch (error) {
          console.error('Token validation failed:', error);
          // Clear invalid session
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

  // Removed handleBeforeUnload useEffect to prevent logout on reload/refresh
  // Sessions will be handled server-side with timeouts instead
  // This fixes automatic logout on navigation (like edit click) and reloads

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