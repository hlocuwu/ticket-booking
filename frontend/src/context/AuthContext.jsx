import { createContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.post('/verify')
        .then(res => {
          if (res.data.valid) {
            setUser({ username: res.data.username });
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    try {
      const res = await authApi.post('/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', username);
      setUser({ username });
      toast.success('Logged in successfully!');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
