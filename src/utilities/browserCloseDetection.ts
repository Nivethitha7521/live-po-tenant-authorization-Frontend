import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../redux/store';
import { logout } from '../features/authSlice';

interface BrowserCloseDetectionOptions {
  isLoggedIn: boolean;
  isInitialized: boolean;
  minHiddenTime?: number; // Minimum time page must be hidden (ms)
  maxTimeDiff?: number; // Max time difference between events (ms)
}
export const useBrowserCloseDetection = ({
  isLoggedIn,
  isInitialized,
  minHiddenTime = 3000, // 3 seconds
  maxTimeDiff = 1000, // 1 second
}: BrowserCloseDetectionOptions) => {
  const dispatch = useDispatch<AppDispatch>();
  const isUnloadingRef = useRef(false);

  useEffect(() => {
    if (!isInitialized || !isLoggedIn) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page became hidden
        sessionStorage.setItem('pageHiddenAt', Date.now().toString());
        sessionStorage.setItem('wasPageHidden', 'true');
      } else {
        // Page became visible again - clear the flags
        sessionStorage.removeItem('pageHiddenAt');
        sessionStorage.removeItem('wasPageHidden');
        sessionStorage.removeItem('beforeUnloadAt');
        isUnloadingRef.current = false;
      }
    };

    const handleBeforeUnload = () => {
      const now = Date.now();
      sessionStorage.setItem('beforeUnloadAt', now.toString());
      isUnloadingRef.current = true;
      
      // Set a flag to detect if the page is actually unloading
      // This will be cleared if the page doesn't actually unload (like on refresh cancel)
      setTimeout(() => {
        if (isUnloadingRef.current) {
          sessionStorage.setItem('actuallyUnloaded', 'true');
        }
      }, 100);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      // Page is shown (could be from cache or fresh load)
      isUnloadingRef.current = false;
      
      if (!event.persisted) {
        // Fresh page load - check if browser was closed
        checkForBrowserClose();
      }
      
      // Clear all flags when page is shown
      sessionStorage.removeItem('pageHiddenAt');
      sessionStorage.removeItem('wasPageHidden');
      sessionStorage.removeItem('beforeUnloadAt');
      sessionStorage.removeItem('actuallyUnloaded');
    };

    const handlePageHide = () => {
      // Page is being hidden/unloaded
      if (document.hidden) {
        sessionStorage.setItem('pageHideAt', Date.now().toString());
      }
    };

    const checkForBrowserClose = () => {
      const wasPageHidden = sessionStorage.getItem('wasPageHidden');
      const pageHiddenAt = sessionStorage.getItem('pageHiddenAt');
      const beforeUnloadAt = sessionStorage.getItem('beforeUnloadAt');
      const actuallyUnloaded = sessionStorage.getItem('actuallyUnloaded');

      if (wasPageHidden && pageHiddenAt && beforeUnloadAt && actuallyUnloaded) {
        const hiddenTime = parseInt(pageHiddenAt);
        const unloadTime = parseInt(beforeUnloadAt);
        const currentTime = Date.now();
        
        // Calculate how long the page was hidden
        const hiddenDuration = currentTime - hiddenTime;
        
        // Calculate time difference between visibility change and beforeunload
        const timeDiff = Math.abs(unloadTime - hiddenTime);
        
        // Conditions for browser close:
        // 1. Page was hidden for a reasonable amount of time
        // 2. beforeUnload happened close to visibility change
        // 3. Page actually unloaded (not cancelled)
        if (hiddenDuration >= minHiddenTime && timeDiff <= maxTimeDiff) {
          console.log('Browser close detected - logging out');
          dispatch(logout('browser_closed'));
        }
      }
      
      // Clean up all flags
      sessionStorage.removeItem('pageHiddenAt');
      sessionStorage.removeItem('wasPageHidden');
      sessionStorage.removeItem('beforeUnloadAt');
      sessionStorage.removeItem('actuallyUnloaded');
      sessionStorage.removeItem('pageHideAt');
    };

    // Check on mount in case we're recovering from a browser close
    checkForBrowserClose();

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isLoggedIn, isInitialized, dispatch, minHiddenTime, maxTimeDiff]);
};