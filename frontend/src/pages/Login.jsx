import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Ticket } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      console.error('Login failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-84px)] bg-[#1b1c21] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00b14f]/10 border border-[#00b14f]/20 rounded-2xl mb-4">
            <Ticket className="w-8 h-8 text-[#00b14f]" />
          </div>
          <h1 className="text-3xl font-bold text-white">Đăng nhập</h1>
          <p className="text-gray-500 mt-2 text-sm">Chào mừng trở lại FlashTicket!</p>
        </div>

        {/* Card */}
        <div className="bg-[#31333e] rounded-2xl border border-[#454756] p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Tên đăng nhập / Email
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập hoặc email"
                className="w-full px-4 py-3 bg-[#2a2c36] border border-[#454756] text-white placeholder-gray-600 rounded-xl outline-none focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/15 transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full px-4 py-3 pr-12 bg-[#2a2c36] border border-[#454756] text-white placeholder-gray-600 rounded-xl outline-none focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/15 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-[#00b14f] hover:bg-[#009944] active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#00b14f]/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Đăng Nhập
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 border-t border-[#454756]" />

          <p className="text-center text-sm text-gray-500">
            Bạn chưa có tài khoản?{' '}
            <Link to="/register" className="text-[#00b14f] hover:text-[#2ecc71] font-semibold transition-colors">
              Tạo tài khoản mới
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
