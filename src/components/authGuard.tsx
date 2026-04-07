// 'use client';
// import React, { useEffect, useState, useRef } from 'react';
// import { useRouter } from 'next/navigation';
// import { useDispatch } from 'react-redux';
// import { AppDispatch } from '@/redux/store';
// import { usePageMemory } from '../hooks/usePageMemory';

// interface AuthGuardProps {
//   children: React.ReactNode;
// }

// const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [isLoading, setIsLoading] = useState(true);
//   const router = useRouter();
//   const dispatch = useDispatch<AppDispatch>();
//   const hasCheckedRef = useRef(false);

//   usePageMemory(); // Initialize page memory and logout listener

//   useEffect(() => {
//     const checkAuthentication = async () => {
//       if (hasCheckedRef.current) return;
//       hasCheckedRef.current = true;

//       try {
//         const token = sessionStorage.getItem('accessToken');
//         const tokenExpiresAt = Number(sessionStorage.getItem('tokenExpiresAt'));
//         const lastActivity = Number(sessionStorage.getItem('lastActivity'));
//         const loginTime = Number(sessionStorage.getItem('loginTime'));

//         if (!token) {
//           sessionStorage.setItem('authStatus', 'logged_out');
//           router.replace('/');
//           return;
//         }

//         if (tokenExpiresAt && tokenExpiresAt <= Date.now()) {
//           sessionStorage.clear();
//           sessionStorage.setItem('authStatus', 'logged_out');
//           router.replace('/');
//           return;
//         }

//         const currentTime = Date.now();
//         const timeSinceActivity = lastActivity ? currentTime - lastActivity : Infinity;
//         const timeSinceLogin = loginTime ? currentTime - loginTime : Infinity;
//         const isActivityValid = timeSinceLogin <= 5000 || timeSinceActivity < 10 * 60 * 1000;

//         if (!isActivityValid) {
//           sessionStorage.clear();
//           sessionStorage.setItem('authStatus', 'logged_out');
//           router.replace('/');
//           return;
//         }

//         await dispatch(
//           validateToken()
//         ).unwrap();

//         sessionStorage.setItem('lastActivity', currentTime.toString());
//         setIsAuthenticated(true);
//       } catch (error) {
//         console.error('Authentication check failed:', error);
//         sessionStorage.clear();
//         sessionStorage.setItem('authStatus', 'logged_out');
//         router.replace('/');
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     checkAuthentication();
//   }, [dispatch, router]);

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen bg-white">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
//           <p className="mt-4 text-gray-600">Verifying authentication...</p>
//         </div>
//       </div>
//     );
//   }

//   if (isAuthenticated) {
//     return <>{children}</>;
//   }

//   return null;
// };

// export default AuthGuard;