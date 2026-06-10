import axios from 'axios';

const rawBaseURL = import.meta.env.VITE_API_URL ?? '';
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL : `${rawBaseURL}/`;

const api = axios.create({
  baseURL,
});

// Request interceptor to add the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for generic error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Optional: Handle 401 globally (e.g., redirect to login)
    if (error.response?.status === 401) {
      console.warn('Unauthorized request - check token');
    }
    return Promise.reject(error);
  }
);

export const processFrame = async (blob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('file', blob, 'frame.jpg');

  // Use relative path without leading slash to join with baseURL correctly
  const response = await api.post('inference/process-frame', formData, {
    responseType: 'blob',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const imageBlob = response.data;
  return URL.createObjectURL(imageBlob);
};

export default api;