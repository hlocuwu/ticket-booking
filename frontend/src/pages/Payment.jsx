import { useState, useContext, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { inventoryApi, bookingApi, notificationApi } from '../services/apiClient';
import { AuthContext } from '../context/AuthContext';
import { CheckCircle, CreditCard, ChevronLeft, Loader2, Calendar, MapPin, Ticket, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Payment() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // --- Shared countdown timer from EventDetails session ---
  const TOTAL_SECONDS = 300;
  const SESSION_KEY = state?.event ? `queueSession_${state.event.id}` : null;

  const calcTimeLeft = () => {
    const ts = state?.startTimestamp;
    if (!ts) return TOTAL_SECONDS;
    const elapsed = Math.floor((Date.now() - ts) / 1000);
    return Math.max(0, TOTAL_SECONDS - elapsed);
  };

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);

  useEffect(() => {
    if (!state || !state.selectedTickets || !state.event) {
      navigate('/');
    }
  }, [state, navigate]);

  // Countdown timer — shared with EventDetails via startTimestamp
  useEffect(() => {
    if (success) return;
    if (timeLeft <= 0) {
      if (SESSION_KEY) sessionStorage.removeItem(SESSION_KEY);
      toast.error('Đã hết thời gian thao tác! Vui lòng đăng ký lại.');
      navigate(-1);
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, success]);

  if (!state) return null;

  const { selectedTickets, event, total, ticketTypes } = state;
  const totalCount = Object.values(selectedTickets).reduce((a, b) => a + b, 0);

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập lại!');
      return navigate('/login');
    }

    setLoading(true);

    try {
      const res = await inventoryApi.get('/tickets');
      const availableTickets = res.data.filter(t => t.event_id === Number(event.id) && !t.is_reserved);

      if (availableTickets.length < totalCount) {
        setLoading(false);
        toast.error(`Rất tiếc! Chỉ còn ${availableTickets.length} ghế trống trong hệ thống.`);
        return;
      }

      const ticketsToBook = [];
      for (const [typeId, qty] of Object.entries(selectedTickets)) {
        if (qty > 0) {
          const zoneTickets = availableTickets.filter(t => t.zone_id === Number(typeId));
          if (zoneTickets.length < qty) {
            toast.error(`Rất tiếc! Không đủ vé trong khu vực bạn chọn.`);
            setLoading(false);
            return;
          }
          ticketsToBook.push(...zoneTickets.slice(0, qty));
        }
      }

      for (const ticket of ticketsToBook) {
        await bookingApi.post('/book', {
          user_id: user.username,
          ticket_id: ticket.id
        });
      }

      if (user.email) {
        try {
          const emailBody = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #2ecc71;">Thanh toán thành công!</h2>
              <p>${user.fullName ? `Ch\u00e0o <strong>${user.fullName}</strong>` : `Ch\u00e0o <strong>${user.username}</strong>`},</p>
              <p>Bạn đã mua thành công <strong>${totalCount} vé</strong> cho sự kiện <strong>${event.name}</strong>.</p>
              <p><strong>Thông tin sự kiện:</strong></p>
              <ul style="line-height: 1.5;">
                <li><strong>Thời gian:</strong> ${event.date}${event.time ? ' | ' + event.time : ''}</li>
                <li><strong>Địa điểm:</strong> ${event.location}</li>
                <li><strong>Tổng tiền:</strong> ${total.toLocaleString('vi-VN')} đ</li>
              </ul>
              <p>Vui lòng đăng nhập vào ứng dụng để xem chi tiết vé và nhận mã QR tại mục <em>Vé của tôi</em>.</p>
              <p>Trân trọng,<br>Ticket Booking Team</p>
            </div>
          `;
          await notificationApi.post('/send-email', {
            to_email: user.email,
            subject: `Xác nhận đặt vé thành công: ${event.name}`,
            body: emailBody
          });
        } catch (emailErr) {
          console.error('Failed to send email notification', emailErr);
        }
      }

      setTimeout(() => {
        if (SESSION_KEY) sessionStorage.removeItem(SESSION_KEY);
        setLoading(false);
        setSuccess(true);
        toast.success('Thanh toán và giữ chỗ thành công!');
      }, 2000);

    } catch (err) {
      console.error(err);
      setLoading(false);
      toast.error('Có lỗi xảy ra khi xử lý vé trong hệ thống.');
    }
  };

  // ===== SUCCESS SCREEN =====
  if (success) {
    return (
      <div className="min-h-[80vh] bg-[#1b1c21] flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-[#31333e] border border-[#454756] rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          {/* Icon with animated ring */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-[#2ecc71]/10 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-[#2ecc71]/10 border border-[#2ecc71]/30 flex items-center justify-center">
              <CheckCircle className="text-[#2ecc71] w-12 h-12" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Thanh toán thành công!</h1>
          <p className="text-gray-400 text-base mb-2">
            Cảm ơn bạn đã đặt <span className="text-white font-semibold">{totalCount} vé</span>
          </p>
          <p className="text-[#2ecc71] font-semibold text-lg mb-8 line-clamp-2">{event.name}</p>

          {/* Event info summary */}
          <div className="bg-[#2a2c36] rounded-xl p-4 mb-8 text-left space-y-2.5 border border-[#454756]">
            <div className="flex items-center gap-2.5 text-sm text-gray-400">
              <Calendar className="w-4 h-4 text-[#2ecc71] shrink-0" />
              <span>{event.date}{event.time ? ` | ${event.time}` : ''}</span>
            </div>
            <div className="flex items-start gap-2.5 text-sm text-gray-400">
              <MapPin className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-400">
              <Ticket className="w-4 h-4 text-[#2ecc71] shrink-0" />
              <span>Tổng: <span className="text-white font-bold">{total.toLocaleString('vi-VN')} đ</span></span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/my-tickets')}
              className="flex-1 bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-[#2ecc71]/10"
            >
              Xem vé của tôi
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-[#2a2c36] hover:bg-[#454756] text-gray-300 font-bold py-3 px-6 rounded-xl border border-[#454756] transition-all"
            >
              Trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== PAYMENT FORM =====
  return (
    <div className="min-h-[80vh] bg-[#1b1c21] py-8 text-white">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header row: Back button + Countdown timer */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-400 hover:text-white font-semibold transition-colors"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Quay lại chọn vé
          </button>

          {/* Shared countdown */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            timeLeft <= 60
              ? 'bg-[#e74c3c]/10 border-[#e74c3c]/30 text-[#e74c3c]'
              : 'bg-[#2a2c36] border-[#454756] text-gray-300'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="text-sm font-semibold">Thời gian còn lại:</span>
            <span className="font-mono font-bold text-lg">
              {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="bg-[#31333e] rounded-2xl border border-[#454756] overflow-hidden flex flex-col md:flex-row shadow-2xl">
          
          {/* LEFT: Order Summary */}
          <div className="md:w-1/2 p-8 border-b md:border-b-0 md:border-r border-[#454756]">
            <h2 className="text-2xl font-bold text-white mb-6">Tóm tắt đơn hàng</h2>

            {/* Event Info */}
            <div className="bg-[#2a2c36] rounded-xl border border-[#454756] p-4 mb-6 space-y-2">
              <h3 className="font-bold text-lg text-white leading-snug">{event.name}</h3>
              <p className="text-gray-400 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2ecc71] shrink-0" />
                {event.date}{event.time ? ` | ${event.time}` : ''}
              </p>
              <p className="text-gray-400 text-sm flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5" />
                {event.location}
              </p>
            </div>

            {/* Ticket Details */}
            <div className="space-y-3 mb-8">
              <h3 className="font-bold text-gray-400 uppercase text-xs tracking-wider mb-3">Chi tiết vé</h3>
              {Object.entries(selectedTickets).map(([typeId, qty]) => {
                if (qty === 0) return null;
                let name = `Khu vực #${typeId}`;
                let price = 0;
                if (ticketTypes) {
                  const typeInfo = ticketTypes.find(t => t.id === typeId);
                  if (typeInfo) { name = typeInfo.name; price = typeInfo.price; }
                }
                return (
                  <div key={typeId} className="flex justify-between items-center text-gray-300">
                    <span>{qty} x {name}</span>
                    <span className="font-semibold text-white">{(price * qty).toLocaleString('vi-VN')} đ</span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="pt-4 border-t border-[#454756] flex justify-between items-center">
              <span className="text-lg font-bold text-gray-300">Tổng cộng:</span>
              <span className="text-3xl font-black text-[#2ecc71]">{total.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          {/* RIGHT: Payment Action */}
          <div className="md:w-1/2 p-8 flex flex-col justify-center items-center text-center bg-[#2a2c36]">
            <div className="w-20 h-20 bg-[#2ecc71]/10 border border-[#2ecc71]/20 text-[#2ecc71] rounded-full flex items-center justify-center mb-6">
              <CreditCard className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">Xác nhận & Thanh toán</h2>
            <p className="text-gray-400 mb-8 max-w-sm text-sm leading-relaxed">
              Bạn đang chuẩn bị thanh toán số tiền{' '}
              <strong className="text-[#2ecc71]">{total.toLocaleString('vi-VN')} đ</strong>{' '}
              cho hệ thống. Vé sẽ được gửi vào email sau khi hoàn tất.
            </p>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-[#2ecc71] hover:bg-[#27ae60] disabled:bg-[#454756] disabled:text-gray-500 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg shadow-[#2ecc71]/10 flex items-center justify-center"
            >
              {loading ? (
                <><Loader2 className="animate-spin w-5 h-5 mr-2" /> Đang xử lý...</>
              ) : (
                'Thanh toán ngay'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}