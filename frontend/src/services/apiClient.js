import axios from 'axios';

const authApi = axios.create({ baseURL: '/api/auth' });
const eventApi = axios.create({ baseURL: '/api/events' });
const queueApi = axios.create({ baseURL: '/api/queue' });
const bookingApi = axios.create({ baseURL: '/api/booking' });
const inventoryApi = axios.create({ baseURL: '/api/inventory' });
const notificationApi = axios.create({ baseURL: '/api/notification' });

const requestInterceptor = (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

authApi.interceptors.request.use(requestInterceptor);
eventApi.interceptors.request.use(requestInterceptor);
queueApi.interceptors.request.use(requestInterceptor);
bookingApi.interceptors.request.use(requestInterceptor);
inventoryApi.interceptors.request.use(requestInterceptor);
notificationApi.interceptors.request.use(requestInterceptor);

export { authApi, eventApi, queueApi, bookingApi, inventoryApi, notificationApi };
