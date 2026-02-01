// axiosInstance.ts
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://127.0.0.1:8000/purchasetestapi',
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Instead of directly using hooks, throw a custom error or trigger a global event
      return Promise.reject({ ...error, isUnauthorized: true });
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;