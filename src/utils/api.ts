import axios from "axios";
import { toast } from "react-hot-toast";
// Create axios instance for purchase API
const purchaseApi = axios.create({
  baseURL: "http://127.0.0.1:8000/purchasetestapi",
});

let isLoggingOut = false;
export const setManualLogoutFlag = () => {
  isLoggingOut = true;
};

purchaseApi.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("accessToken");

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle permission errors
purchaseApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      console.error("Permission denied:", error.response.data.detail);
      // Optional: toast.error('You do not have permission')
    }

if (error.response?.status === 401) {

  // ✅ If user is manually logging out, skip snackbar
  if (!isLoggingOut) {
    toast("⚠️ Session expired. Please login again", {
      duration: 5000,
      style: {
        background: "#f59e0b",
        color: "#000",
        fontWeight: "600",
      },
    });
  }

  sessionStorage.clear();

  setTimeout(() => {
    window.location.href = "/";
  }, 1500);
}




    return Promise.reject(error);
  }
);

export default purchaseApi;