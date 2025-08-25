'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { initializeAuth, logout } from '../features/authSlice';
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

  const isLoginRoute = useMemo(() => pathname === '/', [pathname]);
  const isProtectedRoute = useMemo(() =>
    PROTECTED_ROUTES.some(route => pathname?.startsWith(route)),
    [pathname]
  );

  // Initialize auth, set module, and manage tab tracking
  useEffect(() => {
    dispatch(initializeAuth());
    const modulename = pathname?.split('/')[1] || '';
    setSelectedModule(modulename);

    // Generate a unique tab ID and browser session ID
    const tabId = crypto.randomUUID();
    const browserSessionId = sessionStorage.getItem('browserSessionId') || crypto.randomUUID();
    sessionStorage.setItem('browserSessionId', browserSessionId);

    // Initialize or update active tabs list
    let activeTabs = JSON.parse(sessionStorage.getItem('activeTabs') || '[]') as string[];
    if (!activeTabs.includes(tabId)) {
      activeTabs.push(tabId);
      sessionStorage.setItem('activeTabs', JSON.stringify(activeTabs));
    }

    // Handle beforeunload for tab/browser close
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      let currentActiveTabs = JSON.parse(sessionStorage.getItem('activeTabs') || '[]') as string[];
      currentActiveTabs = currentActiveTabs.filter(id => id !== tabId);
      sessionStorage.setItem('activeTabs', JSON.stringify(currentActiveTabs));

      // Only logout if this is the last tab and user is logged in
      if (currentActiveTabs.length === 0 && isLoggedIn) {
        try {
          await dispatch(logout('browser_closed')).unwrap();
          sessionStorage.removeItem('browserSessionId'); // Clean up session ID
        } catch (error) {
          console.error('Logout on browser close failed:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Remove tab ID from active tabs on cleanup
      let currentActiveTabs = JSON.parse(sessionStorage.getItem('activeTabs') || '[]') as string[];
      currentActiveTabs = currentActiveTabs.filter(id => id !== tabId);
      sessionStorage.setItem('activeTabs', JSON.stringify(currentActiveTabs));
    };
  }, [dispatch, pathname, isLoggedIn]);

  // Handle redirects for protected routes
  useEffect(() => {
    if (!isInitialized) return;

    // Redirect to login if trying to access protected route without login
    if (!isLoggedIn && isProtectedRoute) {
      router.replace('/');
    }
  }, [isLoggedIn, isInitialized, isProtectedRoute, router]);

  if (!isInitialized) return <LoadingSpinner />;

  // Show layout with Navbar and SideMenu for logged-in users
  if (isLoggedIn) {
    return (
      <div className="flex h-screen overflow-hidden">
        {isMenuOpen && (
          <SideMenu
            onMenuClick={(menuItem) => {
              setSelectedModule(menuItem.text);
              router.push(menuItem.path); // Client-side navigation
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