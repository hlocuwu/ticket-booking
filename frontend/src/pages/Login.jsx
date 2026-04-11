import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login({ username, password });
      navigate('/');
    } catch (err) {
      // Lỗi đã được xử lý bằng toast ở trong AuthContext
      console.error('Login failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-xl shadow-md border border-gray-100">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-green-100 text-[#00b14f] rounded-full mb-4">
          <LogIn size={24} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Đăng Nhập</h2>
        <p className="text-gray-500 mt-2">Đăng nhập tài khoản FlashTicket</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tên đăng nhập / Email</label>
          <input
            type="text"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00b14f]/20 focus:border-[#00b14f] outline-none transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập tên đăng nhập hoặc email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mật khẩu</label>
          <input
            type="password"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00b14f]/20 focus:border-[#00b14f] outline-none transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#00b14f] hover:bg-[#009944] text-white font-semibold py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-green-200"
        >
          {isSubmitting ? 'Đang xác thực...' : 'Đăng Nhập'}
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-gray-600">
        Bạn chưa có tài khoản? <Link to="/register" className="text-[#00b14f] hover:underline font-semibold">Tạo tài khoản mới</Link>
      </div>
    </div>
  );
}
