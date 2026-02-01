import axios from "axios";

// Create axios instance for purchase API
const purchaseApi = axios.create({
  baseURL: "http://127.0.0.1:8000/purchasetestapi",
});


purchaseApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

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
      console.error("Unauthorized: Invalid or expired token");
      // Optional: auto-logout logic
    }

    return Promise.reject(error);
  }
);

export default purchaseApi;
