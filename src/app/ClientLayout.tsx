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

  // Initialize auth and set module
  useEffect(() => {
    dispatch(initializeAuth());
    const modulename = pathname?.split('/')[1] || '';
    setSelectedModule(modulename);

    // Initialize tab count in localStorage
    const tabCount = parseInt(localStorage.getItem('tabCount') || '0');
    localStorage.setItem('tabCount', (tabCount + 1).toString());

    // Handle beforeunload for last tab or browser close
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      const currentTabCount = parseInt(localStorage.getItem('tabCount') || '0');
      if (currentTabCount <= 1 && isLoggedIn) {
        // Last tab or browser close - trigger logout
        try {
          await dispatch(logout('browser_closed')).unwrap();
        } catch (error) {
          console.error('Logout on browser close failed:', error);
        }
      }
      // Update tab count
      localStorage.setItem('tabCount', (currentTabCount - 1).toString());
    };

    // Handle page show to reset tab count if necessary
    const handlePageShow = () => {
      const tabCount = parseInt(localStorage.getItem('tabCount') || '0');
      if (tabCount <= 0) {
        localStorage.setItem('tabCount', '1');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pageshow', handlePageShow);
      // Decrease tab count on cleanup
      const currentTabCount = parseInt(localStorage.getItem('tabCount') || '0');
      if (currentTabCount > 0) {
        localStorage.setItem('tabCount', (currentTabCount - 1).toString());
      }
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