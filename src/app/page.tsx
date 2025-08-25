'use client';
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError, logout } from '../features/authSlice';
import { useRouter } from 'next/navigation';
import { AppDispatch, RootState } from '@/redux/store';
import { toast } from 'react-toastify';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Image from 'next/image'; // Correct import for next/image

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
    <div className="min-h-screen flex">
      {/* Left Side - Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-500 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 w-full">
          {/* Image Container */}
          <div className="flex justify-center items-center mb-8">
            <Image
              alt="Purchase Image"
              className="max-w-md w-full h-auto rounded-lg shadow-2xl object-cover"
              style={{ maxHeight: '400px' }}
              width={500}
              height={400}
              src="/images/purchaseimage.jpg" // Empty src to trigger onError
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            {/* Fallback content if image fails to load */}
            <div className="hidden max-w-md w-full h-80 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium">Welcome to YEN ERP</p>
                <p className="text-sm opacity-90">Your business management solution</p>
              </div>
            </div>
          </div>
          {/* Text Content */}
          <div className="text-center max-w-md">
            <h2 className="text-3xl font-bold mb-4">Streamline Your Business</h2>
            <p className="text-lg opacity-90">Manage your operations efficiently with our comprehensive ERP solution</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo/Header */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">YEN ERP</h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="hidden lg:block text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h1>
              <p className="text-gray-600">Please sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="username">
                  Username
                </label>
                <input
                  autoComplete="off"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    usernameError
                      ? 'border-red-500 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  type="text"
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError('');
                  }}
                  disabled={isLoggingIn}
                />
                {usernameError && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {usernameError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    autoComplete="off"
                    className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      passwordError
                        ? 'border-red-500 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError('');
                    }}
                    disabled={isLoggingIn}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    onClick={togglePasswordVisibility}
                    disabled={isLoggingIn}
                  >
                    {showPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {passwordError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className={`w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  isLoggingIn
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:from-blue-600 hover:to-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
                }`}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing In...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;