// utils/apiInterceptor.ts
import axios from 'axios';
import { toast } from 'react-toastify';
import store from '@/redux/store';

let isLogoutInProgress = false;

// Create axios interceptor to handle force logout globally
export const setupApiInterceptors = () => {
  // Response interceptor to catch 401/403 errors
  axios.interceptors.response.use(
    (response) => {
      // If response is successful, reset logout flag
      isLogoutInProgress = false;
      return response;
    },
    async (error) => {
      const { response } = error;
      
      // Check if it's a 401 or 403 error that indicates force logout
      if ((response?.status === 401 || response?.status === 403) && !isLogoutInProgress) {
        const errorDetail = response?.data?.detail || '';
        
        // Check if this is specifically a session termination (not just regular auth failure)
        if (errorDetail.includes('session') || 
            errorDetail.includes('terminated') || 
            errorDetail.includes('invalid') ||
            errorDetail.includes('expired')) {
          
          console.log('Force logout detected via API interceptor:', errorDetail);
          isLogoutInProgress = true;
          
         
          
          // Show toast notification
          toast.info('Your session was terminated due to login from another device');
          
          // Redirect to login page
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
      }
      
      return Promise.reject(error);
    }
  );

  // Request interceptor to add auth token
  axios.interceptors.request.use(
    (config) => {
      // Add auth token to requests if available
      const token = localStorage.getItem('accessToken');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

// Call this function once in your app initialization
export default setupApiInterceptors;