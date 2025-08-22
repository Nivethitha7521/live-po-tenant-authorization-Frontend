'use client';
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError, logout } from '../features/authSlice';
import { useRouter } from 'next/navigation';
import { AppDispatch, RootState } from '@/redux/store';
import { toast } from 'react-toastify';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
}

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const dispatch = useDispatch<AppDispatch>();
  const { error, isLoggedIn } = useSelector((state: RootState) => state.auth);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = sessionStorage.getItem('accessToken');
        const browserSessionId = sessionStorage.getItem('browserSessionId');
        if (token && browserSessionId) {
          // If token exists, assume valid session (no validation call)
          router.replace('/yen-purchase');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        handleLogout();
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [dispatch, router]);

  const getDeviceFingerprint = (): DeviceFingerprint => {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    };
  };

  const handleLogout = () => {
    dispatch(logout('manual'));
    sessionStorage.clear();
    dispatch(clearError());
    router.replace('/');
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    let hasError = false;
    if (!trimmedUsername) {
      setUsernameError('Username is required');
      hasError = true;
    } else {
      setUsernameError('');
    }
    if (!trimmedPassword) {
      setPasswordError('Password is required');
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (hasError) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoggingIn(true);
    dispatch(clearError());

    try {
      const browserSessionId = sessionStorage.getItem('browserSessionId') || crypto.randomUUID();
      sessionStorage.setItem('browserSessionId', browserSessionId);

      const result = await dispatch(
        login({
          username: trimmedUsername,
          password: trimmedPassword,
          browserSessionId,
          deviceFingerprint: getDeviceFingerprint(),
        })
      );

      if (login.fulfilled.match(result)) {
        toast.success('Login successful!');
        sessionStorage.setItem('lastActivity', Date.now().toString());
        router.push('/yen-purchase');
      } else {
        toast.error(result.payload as string || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Network or server error. Please check your connection and try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="bg-white p-8 shadow-md rounded-md w-full max-w-sm">
        <h1 className="text-2xl mb-4 text-center">Welcome to YEN ERP</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-left mb-2 text-gray-700" htmlFor="username">
              User Name
            </label>
            <input
              autoComplete="off"
              className={`w-full p-2 border rounded focus:outline-none focus:ring-2 ${usernameError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
              type="text"
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameError('');
              }}
              disabled={isLoggingIn}
            />
            {usernameError && (
              <p className="text-red-500 text-sm mt-1">{usernameError}</p>
            )}
          </div>
          <div className="mb-6 relative">
            <label className="block text-left mb-2 text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="off"
              className={`w-full p-2 border rounded pr-10 focus:outline-none focus:ring-2 ${passwordError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError('');
              }}
              disabled={isLoggingIn}
            />
            <button
              type="button"
              className="absolute right-2 top-10 text-gray-600 hover:text-gray-800"
              onClick={togglePasswordVisibility}
              disabled={isLoggingIn}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
            {passwordError && (
              <p className="text-red-500 text-sm mt-1">{passwordError}</p>
            )}
          </div>
          <button
            type="submit"
            className={`w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Logging In...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;