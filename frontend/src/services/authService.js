import axios from 'axios';

// Dùng URL rỗng tương đối để Axios gọi qua Nginx Proxy trên cùng port 3000
const API_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor để tự động gắn JWT Token vào header Authorization cho mọi request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor xử lý lỗi 401 Unauthorized (token hết hạn)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Có thể emit event hoặc reload trang tùy ý
    }
    return Promise.reject(error);
  }
);

export const authService = {
  // POST /api/auth/register nhận username, email, password
  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  // POST /api/auth/login nhận email/username, password
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  // GET /api/user/profile với JWT
  getProfile: async () => {
    // Chuyển thành /auth/profile để Proxy (của vite & nginx) chuyển tới backend Auth service
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },

  updateProfile: async (data) => {
    // Gọi API PUT Update Profile
    const response = await apiClient.put('/auth/profile', data);
    return response.data;
  },

  changePassword: async (data) => {
    // Nhận { currentPassword, newPassword } 
    const response = await apiClient.put('/auth/password', data);
    return response.data;
  },
};

export default apiClient;