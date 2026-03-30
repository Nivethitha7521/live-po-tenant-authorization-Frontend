'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Image from "next/image";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useEffect } from "react";

export default function NewPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

 const [username, setUsername] = useState<string | null>(null);
const [isCheckingSession, setIsCheckingSession] = useState(true);
useEffect(() => {
  const storedUsername = sessionStorage.getItem("fp_username");

  if (!storedUsername) {
    toast.error("Please verify OTP first");
    router.replace("/forgot-password");
  } else {
    setUsername(storedUsername);
  }

  setIsCheckingSession(false);
}, [router]);


 
const [passwordTouched, setPasswordTouched] = useState(false);
const [confirmTouched, setConfirmTouched] = useState(false);
const isPasswordInvalid =
  passwordTouched &&
  password.length > 0 &&
  !PASSWORD_REGEX.test(password);
  const isConfirmInvalid =
  confirmTouched &&
  confirm.length > 0 &&
  password !== confirm;
const resetPassword = async () => {
     if (!username) {
   
    router.replace("/forgot-password");
    return;
  }
  if (!password || !confirm) {
    toast.error("Password required");
    return;
  }


  // ✅ PASSWORD STRENGTH CHECK
  if (!PASSWORD_REGEX.test(password)) {
    toast.error(
      "Password must be at least 8 characters and include uppercase, lowercase, number and special character"
    );
    return;
  }

  // ✅ MATCH CHECK
  if (password !== confirm) {
    toast.error("Password mismatch");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(
  `http://127.0.0.1:8000/purchasetestapi/users/reset-password?username=${encodeURIComponent(username!)}&new_password=${encodeURIComponent(password)}`,
  { method: "POST" }
);


    if (!res.ok) {
      const err = await res.json();
      toast.error(err.detail);
      return;
    }

    toast.success("Password reset successful");
    sessionStorage.removeItem("fp_username");
    router.push("/");
  } catch {
    toast.error("Server error");
  } finally {
    setLoading(false);
  }
};

if (isCheckingSession) return null;
  return (
    <div className="min-h-screen flex">
      {/* LEFT BLUE PANEL */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-500 to-blue-600 items-center justify-center text-white p-10">
        <div className="text-center max-w-md">
          <Image
            src="/images/purchaseimage.jpg"
            alt="New Password"
            width={400}
            height={300}
            className="rounded-xl shadow-xl mx-auto mb-8"
          />
          <h2 className="text-3xl font-bold mb-3">Streamline Your Business</h2>
          <p className="opacity-90">
            Manage your operations efficiently with our comprehensive ERP solution
          </p>
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 p-6">
        {/* 🔽 p-6 to keep height compact */}
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">

          {/* STEP INDICATOR – STEP 3 ACTIVE */}
          <div className="flex items-center justify-center mb-5">
            {/* STEP 1 */}
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium">
              1
            </div>

            <div className="w-12 h-[2px] bg-green-500 mx-2"></div>

            {/* STEP 2 */}
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium">
              2
            </div>

            <div className="w-12 h-[2px] bg-green-500 mx-2"></div>

            {/* STEP 3 */}
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
              3
            </div>
          </div>

          {/* LOCK ICON – SAME AS VERIFY OTP */}
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 11h14v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8z"
                />
              </svg>
            </div>
          </div>

          {/* TITLE */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">New Password</h1>
            <p className="text-gray-500 mt-1">
              Create a strong new password
            </p>
          </div>

         {/* NEW PASSWORD */}
<div className="mb-3">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    New Password
  </label>

  <div className="relative">
    <input
      type={showPassword ? "text" : "password"}
      value={password}
      onChange={(e) => {
        setPassword(e.target.value);
        if (!passwordTouched) setPasswordTouched(true);
      }}
      className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:outline-none
        ${
          isPasswordInvalid
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
    />

    {/* 👁 Eye Icon */}
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
      tabIndex={-1}
    >
      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
    </button>
  </div>

  {isPasswordInvalid && (
    <p className="text-xs text-red-500 mt-1">
      Password must contain at least 8 characters with uppercase, lowercase,
      number & special character
    </p>
  )}
</div>



          {/* CONFIRM PASSWORD */}
         {/* CONFIRM PASSWORD */}
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Confirm Password
  </label>

  <div className="relative">
    <input
      type={showConfirmPassword ? "text" : "password"}
      value={confirm}
      onChange={(e) => {
        setConfirm(e.target.value);
        if (!confirmTouched) setConfirmTouched(true);
      }}
      className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:outline-none
        ${
          isConfirmInvalid
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
    />

    {/* 👁 Eye Icon */}
    <button
      type="button"
      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
      tabIndex={-1}
    >
      {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
    </button>
  </div>

  {isConfirmInvalid && (
    <p className="text-xs text-red-500 mt-1">
      Passwords do not match
    </p>
  )}
</div>


          {/* RESET BUTTON */}
          <button
            onClick={resetPassword}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>

          {/* FOOTER */}
          <div className="text-center mt-4">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-500 hover:underline"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
