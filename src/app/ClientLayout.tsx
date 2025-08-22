'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { initializeAuth } from '../features/authSlice';
import SideMenu from '@/components/SideMenu';
import Navbar from '@/components/Navbar';
import { useBrowserCloseDetection } from '@/utilities/browserCloseDetection';

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

  // Use the browser close detection hook
  useBrowserCloseDetection({
    isLoggedIn,
    isInitialized,
    minHiddenTime: 3000, // 3 seconds
    maxTimeDiff: 1000, // 1 second
  });

  // Initialize auth and set module
  useEffect(() => {
    dispatch(initializeAuth());
    const modulename = pathname?.split('/')[1] || '';
    setSelectedModule(modulename);
  }, [dispatch, pathname]);

  // Handle redirects for protected routes
  useEffect(() => {
    if (!isInitialized) return;

    // Only redirect to / if trying to access protected route without login
    if (!isLoggedIn && isProtectedRoute) {
      router.replace('/');
    }
  }, [isLoggedIn, isInitialized, isProtectedRoute, router]);

  if (!isInitialized) return <LoadingSpinner />;

  // Always show layout with Navbar and SideMenu for logged-in users
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