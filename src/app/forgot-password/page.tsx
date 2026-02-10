'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Image from "next/image";

export default function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const sendOtp = async () => {
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/purchasetestapi/users/forgot-password?username=${username}`,
        { method: "POST" }
      );

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail);
        return;
      }

      toast.success("OTP sent to registered email");
      sessionStorage.setItem("fp_username", username);
      router.push("/forgot-password/verify-otp");
    } catch {
      toast.error("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT BLUE PANEL */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-500 to-blue-600 items-center justify-center text-white p-10">
        <div className="text-center max-w-md">
          <Image
            src="/images/purchaseimage.jpg"
            alt="Reset"
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
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">

          {/* STEP INDICATOR */}
      {/* STEP INDICATOR – EXACT LIKE IMAGE */}
<div className="flex items-center justify-center mb-8">
  {/* STEP 1 */}
  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
    1
  </div>

  {/* LINE */}
  <div className="w-12 h-[2px] bg-gray-200 mx-2"></div>

  {/* STEP 2 */}
  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
    2
  </div>

  {/* LINE */}
  <div className="w-12 h-[2px] bg-gray-200 mx-2"></div>

  {/* STEP 3 */}
  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
    3
  </div>
</div>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Reset Password</h1>
            <p className="text-gray-500 mt-1">
              Enter your username to receive an OTP
            </p>
          </div>

          {/* USERNAME */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* SEND OTP */}
          <button
            onClick={sendOtp}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>

          {/* FOOTER */}
          <div className="text-center mt-6">
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
