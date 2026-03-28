'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Image from "next/image";
import { useEffect } from "react";
export default function VerifyOtp() {
  const [otp, setOtp] = useState("");
  const [confirmOtp, setConfirmOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
const [username, setUsername] = useState<string | null>(null);

const verifyOtp = async () => {

  if (!username) {
    toast.error("Session expired. Please start again.");
    router.replace("/forgot-password");
    return;
  }

  if (!otp || !confirmOtp) {
    toast.error("OTP required");
    return;
  }

  if (otp !== confirmOtp) {
    toast.error("OTP mismatch");
    return;
  }

  setLoading(true);

  try {
  const res = await fetch(
  `https://yenerp.com/purchasetestapi/users/verify-otp?username=${encodeURIComponent(username!)}&otp=${otp}`,
  { method: "POST" }
);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.detail);
      return;
    }

    toast.success("OTP verified");
    router.push("/forgot-password/new-password");

  } catch {
    toast.error("Server error");
  } finally {
    setLoading(false);
  }
};


  const resendOtp = async () => {
    try {
     const res = await fetch(
  `https://yenerp.com/purchasetestapi/users/resend-otp?username=${encodeURIComponent(username!)}`,
  { method: "POST" }
);


      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail);
        return;
      }

      toast.success("OTP resent successfully");
    } catch {
      toast.error("Server error");
    }
  };

useEffect(() => {
  const storedUsername = sessionStorage.getItem("fp_username");

  if (!storedUsername) {
    toast.error("Please enter username first");
    router.replace("/forgot-password");
  } else {
    setUsername(storedUsername);
  }
}, [router]);
  return (
    <div className="min-h-screen flex">
      {/* LEFT BLUE PANEL */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-500 to-blue-600 items-center justify-center text-white p-10">
        <div className="text-center max-w-md">
          <Image
            src="/images/purchaseimage.jpg"
            alt="Verify OTP"
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
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">


          {/* STEP INDICATOR – EXACT */}
          <div className="flex items-center justify-center mb-5">
            {/* STEP 1 – completed */}
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium">
              1
            </div>

            <div className="w-12 h-[2px] bg-green-500 mx-2"></div>

            {/* STEP 2 – active */}
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
              2
            </div>

            <div className="w-12 h-[2px] bg-gray-200 mx-2"></div>

            {/* STEP 3 – pending */}
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-medium">
              3
            </div>
          </div>

          {/* ICON */}
         {/* ICON – EXACT LIKE REFERENCE */}
<div className="flex justify-center mb-3">
  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">

    <svg
      className="w-7 h-7 text-blue-600"
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
            <h1 className="text-2xl font-bold text-gray-800">Verify OTP</h1>
            <p className="text-gray-500 mt-1">
              OTP sent to your registered email
            </p>
          </div>

          {/* ENTER OTP */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter OTP
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
             <button
  type="button"
  onClick={resendOtp}
  className="flex items-center gap-2 px-3 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium"
>
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 4v6h6M20 20v-6h-6"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 15a7 7 0 0011 2l3-3M19 9a7 7 0 00-11-2L5 10"
    />
  </svg>
  Resend
</button>

            </div>
          </div>

          {/* CONFIRM OTP */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm OTP
            </label>
            <input
              type="text"
              value={confirmOtp}
              onChange={(e) => setConfirmOtp(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* VERIFY BUTTON */}
          <button
            onClick={verifyOtp}
            disabled={loading || !username}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition"
          >
            {loading ? "Verifying..." : "Verify OTP"}
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