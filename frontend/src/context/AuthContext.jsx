import { createContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Phục hồi state đăng nhập khi load trang F5 bằng cách fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const userData = await authService.getProfile();
        // Cập nhật nguyên dữ liệu profile (chứa id, email, username) vào user state
        setUser(userData?.data || userData);
      } catch (err) {
        console.error('Failed to get profile:', err);
        // Reset nếu token lỗi / hết hạn
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // 2. Logic hàm login
  const login = async (credentials) => {
    try {
      const res = await authService.login(credentials);
      
      // Golang Backend thường trả jwt token vào trường res.token hoặc res.data.token
      const token = res.token || res.data?.token;
      if (token) {
        localStorage.setItem('token', token);
      }

      // Login xong gọi ngay hàm getProfile để Navbar có đủ thông tin
      const userData = await authService.getProfile();
      setUser(userData?.data || userData);
      
      toast.success('Đăng nhập thành công!');
      return true;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Đăng nhập thất bại';
      toast.error(errorMsg);
      throw err; // Quăng lỗi để View bắt loading State
    }
  };

  // 3. Logic hàm register
  const register = async (userData) => {
    try {
      await authService.register(userData);
      toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      return true;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Đăng ký thất bại';
      toast.error(errorMsg);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
    toast.success('Thoát tài khoản thành công');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
