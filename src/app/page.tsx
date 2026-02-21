'use client';
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { jwtLoginSuccess, initializeAuth } from '../features/authSlice';
import { useRouter } from 'next/navigation';
import { AppDispatch, RootState } from '@/redux/store';
import { toast } from 'react-toastify';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Image from 'next/image';
import { setSnackbarMessage, setSnackbarOpen } from "../features/authSlice";


const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<any[]>([])
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [imageExists, setImageExists] = useState(true);
  const [checkingImage, setCheckingImage] = useState(false);

  const dispatch = useDispatch<AppDispatch>();
  const { isLoggedIn } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
useEffect(() => {
  const fetchTenants = async () => {
    try {
   const res = await fetch(
  "http://127.0.0.1:8000/purchasetestapi/tenants?status=active"
);

      const data = await res.json();
      setTenants(data);
    } catch (err) {
      console.error("Failed to fetch tenants");
    }
  };

  fetchTenants();
}, []);
  // Check if image exists on component mount
  useEffect(() => {
    const checkImage = async () => {
      setCheckingImage(true);
      try {
        const response = await fetch('/images/purchaseimage.jpg');
        setImageExists(response.ok);
      } catch (error) {
        setImageExists(false);
      } finally {
        setCheckingImage(false);
      }
    };

    checkImage();
  }, []);

useEffect(() => {
  setIsCheckingSession(false);
}, []);


// In your login/page.tsx - SIMPLIFIED
const handleLogin = async () => {
  if (isLoggingIn) return;

  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();
  const trimmedTenant = tenantId.trim();

  if (!trimmedUsername || !trimmedPassword) {
    toast.error('Please enter both username and password');
    return;
  }
if (!trimmedTenant) {
  toast.error("Please select a tenant");
  return;
}
  setIsLoggingIn(true);

  try {
    // ✅ CORRECT URL - Call your FastAPI backend on port 8000
 const response = await fetch('http://127.0.0.1:8000/purchasetestapi/login', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`${trimmedUsername}:${trimmedPassword}`)}`,
    'tenant-id': trimmedTenant,   // 🔥 THIS IS THE IMPORTANT FIX
  },
});



  if (!response.ok) {
  let msg = "Login failed";

  try {
    const errJson = await response.json();
    msg = errJson.detail || msg;
  } catch {
    msg = await response.text();
  }

  toast.error(msg);
  return;
}


const result = await response.json();

// Save token
localStorage.setItem("token", result.access_token);
localStorage.setItem("tenant_id", trimmedTenant);
let slug = "";
// ⭐ Get selected tenant object
const selectedTenant = tenants.find(t => t._id === trimmedTenant);

if (selectedTenant) {
  // ⭐ Create slug (lowercase + remove spaces)
  slug = selectedTenant.tenantName
    .toLowerCase()
    .replace(/\s+/g, '');

  localStorage.setItem("tenant_slug", slug);
  document.cookie = `tenant_slug=${slug}; path=/`;
}
localStorage.setItem("username", result.username);

localStorage.setItem("userPermissions", JSON.stringify(result.permissions));

sessionStorage.setItem("accessToken", result.access_token);
sessionStorage.setItem("username", result.username);
localStorage.setItem("userRole", result.role_name);  
// 🔥 NEW — TELL REDUX LOGIN SUCCESS
dispatch(jwtLoginSuccess({
  username: result.username,
  permissions: result.permissions,
   role: result.role_name
}));




// ⭐ SHOW ROLE-BASED SNACKBAR HERE
dispatch(setSnackbarMessage(`LOGIN_SUCCESS: ${result.role_name || "User"} logged in successfully!`));
dispatch(setSnackbarOpen(true));

// Redirect
toast.success("Login successful!");
router.push(`/${slug}/yen-purchase`);

    
  } catch (error) {
    console.error('Login error:', error);
    toast.error('Network error. Please check if backend is running on port 8000.');
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

  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking existing sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">      {/* Left Side - Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-500 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 w-full">
          {/* Image Container */}
          <div className="flex justify-center items-center mb-8">
            {!checkingImage && imageExists ? (
              <Image
                alt="Purchase Image"
                className="max-w-md w-full h-auto rounded-lg shadow-2xl object-cover"
                style={{ maxHeight: '400px' }}
                width={500}
                height={400}
                src="/images/purchaseimage.jpg"
                priority // This ensures the image loads first
              />
            ) : (
              <div className="max-w-md w-full h-80 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
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
            )}
          </div>
          {/* Text Content */}
          <div className="text-center max-w-md">
            <h2 className="text-3xl font-bold mb-4">Streamline Your Business</h2>
            <p className="text-lg opacity-90">Manage your operations efficiently with our comprehensive ERP solution</p>
          </div>
        </div>
      </div>
      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50 overflow-hidden">

        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">YEN ERP</h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="hidden lg:block text-center mb-5">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h1>
              <p className="text-gray-600">Please sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="username">
                  Username
                </label>
                <input
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  type="text"
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoggingIn}
                />
              </div>
  

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    autoComplete="off"
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              </div>
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Select Tenant
  </label>
  <select
    className="w-full px-4 py-3 border border-gray-300 rounded-lg 
focus:outline-none focus:ring-2 focus:ring-blue-500 
focus:border-blue-500 transition-colors"

    value={tenantId}
    onChange={(e) => setTenantId(e.target.value)}
    disabled={isLoggingIn}
  >
    <option value="">Select Tenant</option>
    {tenants.map((tenant) => (
      <option key={tenant._id} value={tenant._id}>
        {tenant.tenantName}
      </option>
    ))}
  </select>
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
               <div className="text-center mt-4">
    <button
      type="button"
      onClick={() => router.push("/forgot-password")}
      className="text-sm text-blue-600 hover:underline"
    >
      Forgot Password?
    </button>
  </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;