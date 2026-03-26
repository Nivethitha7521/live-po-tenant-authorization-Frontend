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
  '/QlikReport', // ✅ NEW
];

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

const ClientLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();

  const normalizedPath = useMemo(() => {
    if (!pathname) return "";
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length > 1) {
      return "/" + parts.slice(1).join("/");
    }
    return pathname;
  }, [pathname]);

  const dispatch = useDispatch<AppDispatch>();

  const { isLoggedIn, isInitialized, permissionReady, username, snackbarOpen, snackbarMessage } =
    useSelector((state: RootState) => state.auth);

  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [selectedModule, setSelectedModule] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const isLoginRoute = useMemo(() => pathname === '/', [pathname]);

const isProtectedRoute = useMemo(() =>
  PROTECTED_ROUTES.some(route => pathname?.startsWith(route)),
  [pathname]
);

  const isDirectAccess = useMemo(() => {
    if (typeof window === "undefined") return false;
    const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return navEntries.length > 0 && navEntries[0].type === "navigate";
  }, []);

  const rawPermissions = useSelector((state: RootState) => state.auth.permissions);
  const permissions: string[] = Array.isArray(rawPermissions) ? rawPermissions : [];
  const token = useSelector((state: RootState) => state.auth.token);
  const role = useSelector((state: RootState) => state.auth.role);
  const permissionObject = useSelector((state: RootState) => state.auth.permissions);

const hasPurchaseAccess = useMemo(() => {
  if (!permissionObject?.yenerp) return false;
  const yenerp = permissionObject.yenerp as Record<string, { read?: boolean }>;
  const excludeKeys = [
    'purchaseorderreport', 'posreport',
    // inventory keys
    'physicalstockmodification', 'physicalstockvariancemodification', 'stockledger',
    'warehousephysicalstockmodification', 'warehousephysicalstockvariancemodification', 'warehousestockledger',
    // book keys
    'outgoingpayment', 'advancepayment', 'partialpayment', 'paymentdone',
    'paymenthistory', 'ledger', 'purchasereturn', 'expensecategory',
    'expensesubcategory', 'expensename',
  ];
  return Object.keys(yenerp)
    .filter((key) => !excludeKeys.includes(key))
    .some((key) => yenerp[key]?.read === true);
}, [permissionObject]);



 const hasInventoryAccess = useMemo(() => {
  if (!permissionObject?.yenerp) return false;
  const yenerp = permissionObject.yenerp;
  const INVENTORY_KEYS = [
    "physicalstockmodification",
    "physicalstockvariancemodification",
    "stockledger",
    "warehousephysicalstockmodification",
    "warehousephysicalstockvariancemodification",
    "warehousestockledger",
  ];
  return INVENTORY_KEYS.some((key) => yenerp[key]?.read === true);
}, [permissionObject]);



const hasBookAccess = useMemo(() => {
  if (!permissionObject?.yenerp) return false;
  const yenerp = permissionObject.yenerp as Record<string, { read?: boolean }>;
  const BOOK_KEYS = [
    'outgoingpayment', 'advancepayment', 'partialpayment',
    'paymentdone', 'paymenthistory', 'ledger',
    'purchasereturn', 'expensecategory', 'expensesubcategory', 'expensename',
  ];
  return BOOK_KEYS.some((key) => yenerp[key]?.read === true);
}, [permissionObject]);

  // ✅ NEW - Reports access
 const hasPurchaseReportAccess = useMemo(() => {
  if (!permissionObject?.yenerp) return false;
  return permissionObject.yenerp?.purchaseorderreport?.read === true;
}, [permissionObject]);

const hasPosReportAccess = useMemo(() => {
  if (!permissionObject?.yenerp) return false;
  return permissionObject.yenerp?.posreport?.read === true;
}, [permissionObject]);

const hasReportsAccess = hasPurchaseReportAccess || hasPosReportAccess;

  useEffect(() => { setupAxios(); }, []);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const sendPing = async () => {
      try {
        await fetch("https://yenerp.com/purchasetestapi/ping", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) { console.log("ping error", e); }
    };
    const events = ["mousemove", "keydown", "click", "scroll"];
    const handler = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => { sendPing(); throttleTimer = null; }, 10000);
      }
    };
    events.forEach((e) => window.addEventListener(e, handler));
    const fallbackInterval = setInterval(sendPing, 5 * 60 * 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearInterval(fallbackInterval);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [isLoggedIn, token]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "forceLogout" && event.newValue) {
        try {
          const logoutData = JSON.parse(event.newValue);
          const currentUsername = sessionStorage.getItem("username");
          const currentTenant = sessionStorage.getItem("tenant_id");
          if (logoutData.username === currentUsername && logoutData.tenantId === currentTenant) {
            dispatch(forceLogout());
            router.replace("/");
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [dispatch, router]);

  useEffect(() => {
    dispatch(initializeAuth());
    dispatch(validateToken());
    dispatch(fetchBusinesses());
  }, [dispatch]);

  useEffect(() => {
    if (isInitialized && permissionReady) {
      setIsCheckingSession(false);
    }
  }, [isInitialized, permissionReady]);

  useEffect(() => {
    if (!isInitialized || isCheckingSession) return;
    if (isProtectedRoute && !isLoggedIn) {
      router.replace("/");
    }
  }, [isInitialized, isCheckingSession, isProtectedRoute, isLoggedIn, router]);

  useEffect(() => {
    return () => {};
  }, []);

  const handleLogout = async () => {};

  useEffect(() => {
    if (!isInitialized || isCheckingSession) return;
    if (!isLoggedIn && isProtectedRoute) {
      router.replace('/');
    } else if (isLoggedIn && isLoginRoute) {
      router.replace('/yen-purchase');
    }
  }, [isLoggedIn, isInitialized, isProtectedRoute, isLoginRoute, router, isCheckingSession]);

  if (!isInitialized || isCheckingSession || (isLoggedIn && !permissionReady)) {
    return <LoadingSpinner />;
  }

  const handleCloseSnackbar = () => { dispatch(clearSnackbar()); };

  const snackbarElement = (
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={3000}
      onClose={handleCloseSnackbar}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <MuiAlert onClose={handleCloseSnackbar} severity="success" variant="filled" elevation={6}>
        {snackbarMessage}
      </MuiAlert>
    </Snackbar>
  );

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
              showInventoryMenu={hasInventoryAccess}
              showReportsMenu={hasReportsAccess} // ✅ NEW
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
        {snackbarElement}
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      {children}
      {snackbarElement}
    </>
  );
};

export default ClientLayout;