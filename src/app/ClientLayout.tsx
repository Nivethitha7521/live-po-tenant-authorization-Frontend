'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { setupAxios } from "@/lib/axiosSetup";
import { forceLogout } from "../features/authSlice";
import { initializeAuth, validateToken, clearSnackbar } from '../features/authSlice';
import SideMenu from '@/components/SideMenu';
import Navbar from '@/components/Navbar';
import { Toaster } from "react-hot-toast";
import { fetchBusinesses } from '@/features/account-setting/businessSlice';
// ⭐ ADD SNACKBAR IMPORTS
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

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
  // ⭐ REMOVE TENANT SLUG FROM PATH
const normalizedPath = useMemo(() => {
  if (!pathname) return "";

  const parts = pathname.split("/").filter(Boolean);

  // if first part is tenant slug, remove it
  if (parts.length > 1) {
    return "/" + parts.slice(1).join("/");
  }

  return pathname;
}, [pathname]);
  const dispatch = useDispatch<AppDispatch>();

  const { isLoggedIn, isInitialized,permissionReady, username, snackbarOpen, snackbarMessage } =
    useSelector((state: RootState) => state.auth);

  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [selectedModule, setSelectedModule] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const isLoginRoute = useMemo(() => pathname === '/', [pathname]);
  
const isProtectedRoute = useMemo(() =>
  PROTECTED_ROUTES.some(route => normalizedPath.startsWith(route)),
  [normalizedPath]
);
  // ⭐ Detect if page opened via direct URL (paste / refresh / new window)
const isDirectAccess = useMemo(() => {
  if (typeof window === "undefined") return false;
  const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  return navEntries.length > 0 && navEntries[0].type === "navigate";
}, []);
const rawPermissions = useSelector(
  (state: RootState) => state.auth.permissions
);

// ✅ normalize to array
const permissions: string[] = Array.isArray(rawPermissions)
  ? rawPermissions
  : [];

const role = useSelector((state: RootState) => state.auth.role);
const permissionObject = useSelector((state: RootState) => state.auth.permissions);

const hasPurchaseAccess = useMemo(() => {
  if (!permissionObject || !permissionObject.yenerp) return false;

  const yenerp = permissionObject.yenerp as Record<
    string,
    { read?: boolean }
  >;

  return Object.keys(yenerp).some((key) => {
    const perm = yenerp[key];
    return perm?.read === true;
  });
}, [permissionObject]);


const hasBookAccess = useMemo(() => {
  if (!permissionObject || !permissionObject.yenerp) return false;

  const yenerp = permissionObject.yenerp as Record<
    string,
    { read?: boolean }
  >;

  return Object.keys(yenerp).some((key) => {
    const perm = yenerp[key];

    return (
      perm?.read === true &&
      (key.includes("outgoing") ||
        key.includes("payment") ||
        key.includes("ledger"))
    );
  });
}, [permissionObject]);



useEffect(() => {
  setupAxios();
}, []);
useEffect(() => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === "forceLogout" && event.newValue) {
      try {
        const logoutData = JSON.parse(event.newValue);

        const currentUsername = sessionStorage.getItem("username");
        const currentTenant = sessionStorage.getItem("tenant_id");

        // ⭐ logout ONLY if same session
        if (
          logoutData.username === currentUsername &&
          logoutData.tenantId === currentTenant
        ) {
          dispatch(forceLogout());
          router.replace("/");
        }
      } catch {}
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}, [dispatch, router]);
  // Session validation
// Session validation (FIX 3)
useEffect(() => {
  dispatch(initializeAuth());// restore localStorage (permissions, role)
  dispatch(validateToken());  
   dispatch(fetchBusinesses());   // backend token + permissions validation
}, [dispatch]);


 useEffect(() => {
  if (isInitialized && permissionReady) {
    setIsCheckingSession(false);
  }
}, [isInitialized, permissionReady]);

// ⭐ FORCE LOGIN when URL is accessed directly
// ⭐ CHECK TOKEN VALIDITY on direct access (not force logout)
useEffect(() => {
  if (!isInitialized || isCheckingSession) return;

  if (isProtectedRoute && !isLoggedIn) {
    // Only redirect if actually not logged in
    router.replace("/");
  }
}, [isInitialized, isCheckingSession, isProtectedRoute, isLoggedIn, router]);
// Add this in your login page component
useEffect(() => {
  // Cleanup function when component unmounts or user navigates away
  return () => {
    // Don't cleanup on normal navigation
  };
}, []);

// Add this to your logout function (wherever it is)
const handleLogout = async () => {
  // ... existing logout code ...
  

};
  useEffect(() => {
    if (!isInitialized || isCheckingSession) return;

    if (!isLoggedIn && isProtectedRoute) {
      router.replace('/');
    } else if (isLoggedIn && isLoginRoute) {
      router.replace('/yen-purchase');
    }
  }, [isLoggedIn, isInitialized, isProtectedRoute, isLoginRoute, router, isCheckingSession]);

  if (!isInitialized || isCheckingSession||
  (isLoggedIn && !permissionReady)
) {
    return <LoadingSpinner />;
  }

  // ⭐⭐⭐ ADD SNACKBAR UI HERE (WORKS FOR ALL ROUTES)
  const handleCloseSnackbar = () => {
    dispatch(clearSnackbar());
  };

  const snackbarElement = (
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={3000}
      onClose={handleCloseSnackbar}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <MuiAlert
        onClose={handleCloseSnackbar}
        severity="success"
        variant="filled"
        elevation={6}
      >
        {snackbarMessage}
      </MuiAlert>
    </Snackbar>
  );

  // LOGGED-IN LAYOUT
  if (isLoggedIn) {
    return (
      <>
       <Toaster position="top-right" />
        <div className="flex h-screen overflow-hidden">
          {isMenuOpen && (
          <SideMenu
  onMenuClick={(menuItem) => {
    setSelectedModule(menuItem.text);
    router.push(menuItem.path);
  }}
  activePath={pathname || '/yen-purchase'}
  showPurchaseMenu={hasPurchaseAccess}
  showBookMenu={hasBookAccess}
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

        {/* ⭐ SHOW SNACKBAR */}
        {snackbarElement}
      </>
    );
  }

  // LOGIN PAGE
  return (
    <>
    <Toaster position="top-right" />
      {children}
      {snackbarElement}
    </>
  );
};

export default ClientLayout;
