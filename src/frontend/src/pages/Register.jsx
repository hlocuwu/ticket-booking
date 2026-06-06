import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, Ticket, MailCheck, ArrowLeft } from 'lucide-react';

export default function Register() {
  // Step 1: Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Step 2: OTP State
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, registerSendOtp, registerVerifyOtp } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  // Handle countdown for resending OTP
  useEffect(() => {
    let timer;
    if (countdown > 0 && step === 2) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown, step]);

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    try {
      await registerSendOtp({ username, email, password });
      setStep(2);
      setCountdown(60); // 60s cooldown for resend
    } catch (err) {
      console.error('OTP request failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await registerVerifyOtp({ email, otp });
      navigate('/login');
    } catch (err) {
      console.error('OTP verification failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-84px)] bg-[#1b1c21] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00b14f]/10 border border-[#00b14f]/20 rounded-2xl mb-4">
            {step === 1 ? <Ticket className="w-8 h-8 text-[#00b14f]" /> : <MailCheck className="w-8 h-8 text-[#00b14f]" />}
          </div>
          <h1 className="text-3xl font-bold text-white">
            {step === 1 ? 'Tạo tài khoản' : 'Xác thực Email'}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {step === 1 
              ? 'Tham gia FlashTicket để đặt vé nhanh nhất!' 
              : `Nhập mã 6 số được gửi đến ${email}`}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#31333e] rounded-2xl border border-[#454756] p-8 shadow-2xl relative overflow-hidden">
          
          {step === 2 && (
            <button 
              onClick={() => setStep(1)}
              className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Tên đăng nhập</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: flash_user"
                  className="w-full px-4 py-3 bg-[#2a2c36] border border-[#454756] text-white placeholder-gray-600 rounded-xl outline-none focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/15 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email của bạn"
                  className="w-full px-4 py-3 bg-[#2a2c36] border border-[#454756] text-white placeholder-gray-600 rounded-xl outline-none focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/15 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength="6"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
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
                {password.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          password.length >= i * 3
                            ? i <= 1 ? 'bg-red-500' : i <= 2 ? 'bg-yellow-500' : i <= 3 ? 'bg-blue-500' : 'bg-[#00b14f]'
                            : 'bg-[#454756]'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#00b14f] hover:bg-[#009944] active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#00b14f]/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xử lý...</>
                ) : (
                  <><UserPlus size={18} /> Tiếp tục</>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-center text-sm font-semibold text-gray-300 mb-4">Nhập mã OTP 6 số</label>
                <input
                  type="text"
                  required
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-2xl sm:text-3xl tracking-[0.5em] sm:tracking-[1em] px-4 py-4 bg-[#2a2c36] border border-[#454756] text-white placeholder-gray-600 rounded-xl outline-none focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/15 transition-all font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="w-full bg-[#00b14f] hover:bg-[#009944] active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#00b14f]/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xác thực...</>
                ) : (
                  'Xác thực OTP'
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  disabled={countdown > 0 || isSubmitting}
                  onClick={handleSendOtp}
                  className="text-sm text-[#00b14f] hover:text-[#2ecc71] disabled:text-gray-500 font-medium transition-colors"
                >
                  {countdown > 0 ? `Gửi lại mã sau ${countdown}s` : 'Gửi lại mã OTP'}
                </button>
              </div>
            </form>
          )}

          {/* Divider */}
          <div className="my-6 border-t border-[#454756]" />

          <p className="text-center text-sm text-gray-500">
            Bạn đã có tài khoản?{' '}
            <Link to="/login" className="text-[#00b14f] hover:text-[#2ecc71] font-semibold transition-colors">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
