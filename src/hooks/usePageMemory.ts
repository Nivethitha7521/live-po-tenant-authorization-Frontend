'use client';
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDispatch } from 'react-redux';

export const usePageMemory = () => {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Save current page to sessionStorage (tab-specific)
    if (pathname && pathname !== '/') {
      sessionStorage.setItem('lastVisitedPage', pathname);
    }
  }, [pathname]);

  useEffect(() => {
    // Listen for logout events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authStatus' && e.newValue === 'logged_out' && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        if (window.location.pathname !== '/') {
          router.replace('/');
        }
      }
    };

    // Reset redirect flag on login
    const resetRedirectFlag = (e: StorageEvent) => {
      if (e.key === 'authStatus' && e.newValue === 'logged_in') {
        hasRedirectedRef.current = false;
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storage', resetRedirectFlag);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage', resetRedirectFlag);
    };
  }, [router, dispatch]);

  return {
    saveCurrentPage: (pagePath: string) => {
      sessionStorage.setItem('lastVisitedPage', pagePath);
    },
    getCurrentPage: () => {
      return sessionStorage.getItem('lastVisitedPage') || '/yen-purchase';
    },
  };
};