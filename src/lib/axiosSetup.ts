import axios from "axios";
import store from "@/redux/store";
import {
  forceLogout,
  setSnackbarMessage,
  setSnackbarOpen,
} from "@/features/authSlice";

let isInterceptorAdded = false;

export const setupAxios = () => {
  if (isInterceptorAdded) return;
  isInterceptorAdded = true;

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // ⭐ GET CURRENT SESSION INFO
        const username = sessionStorage.getItem("username");
        const tenantId = sessionStorage.getItem("tenant_id");

        // ⭐ SHOW MESSAGE
        store.dispatch(
          setSnackbarMessage("Session expired. Please login again.")
        );
        store.dispatch(setSnackbarOpen(true));
        store.dispatch(forceLogout());

        // ⭐ BROADCAST ONLY THIS SESSION LOGOUT
        localStorage.setItem(
          "forceLogout",
          JSON.stringify({
            username,
            tenantId,
            time: Date.now(),
          })
        );

        window.location.href = "/";
      }

      return Promise.reject(error);
    }
  );
};