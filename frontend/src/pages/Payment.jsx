import { useState, useContext, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { inventoryApi, bookingApi, queueApi } from '../services/apiClient';
import { AuthContext } from '../context/AuthContext';
import { CheckCircle, CreditCard, ChevronLeft, Loader2, Calendar, MapPin, Ticket, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function Payment() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState(null); // 'momo' | 'mock'
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
      // Rời hàng đợi để người tiếp theo không bị treo
      queueApi.post('/queue/leave', { user_id: user?.username, event_id: String(state?.event?.id) }).catch(() => {});
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

  const handleCheckout = async (paymentMethod = 'momo') => {
    if (!user) {
      toast.error('Vui lòng đăng nhập lại!');
      return navigate('/login');
    }

    setLoading(true);
    setLoadingMethod(paymentMethod);

    try {
      const res = await inventoryApi.get(`/tickets?event_id=${event.id}`);
      const availableTickets = res.data.filter(t => !t.is_reserved);

      if (availableTickets.length < totalCount) {
        setLoading(false);
        setLoadingMethod(null);
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
            setLoadingMethod(null);
            return;
          }
          ticketsToBook.push(...zoneTickets.slice(0, qty));
        }
      }

      const ticketIds = ticketsToBook.map(t => t.id);

      const response = await bookingApi.post('/book', {
        user_id: user.username,
        event_id: String(event.id),
        ticket_ids: ticketIds,
        amount: total,
        return_url: `${window.location.origin}/payment/callback`,
        payment_method: paymentMethod,
      });

      if (response.data && response.data.payUrl) {
        // Lưu đầy đủ thông tin để có thể rollback nếu user bỏ giữa chừng
        sessionStorage.setItem('pendingPayment', JSON.stringify({
          eventName: event.name,
          eventId: event.id,
          amount: total,
          ticketIds: ticketIds,
          orderId: response.data.order_id,
          userId: user.username,
        }));
        window.location.href = response.data.payUrl;
      } else {
        toast.error("Không nhận được link thanh toán từ hệ thống.");
        setLoading(false);
        setLoadingMethod(null);
      }

    } catch (err) {
      console.error(err);
      setLoading(false);
      setLoadingMethod(null);
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra khi xử lý hệ thống.');
    }
  };

  // (Success screen moved to PaymentCallback)

  // ===== PAYMENT FORM =====
  return (
    <div className="min-h-[80vh] bg-[#1b1c21] py-8 text-white">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header row: Back button + Countdown timer */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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
                  const typeInfo = ticketTypes.find(t => String(t.id) === typeId);
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

            <div className="w-full space-y-3">
              {/* MoMo */}
              <button
                onClick={() => handleCheckout('momo')}
                disabled={loading}
                className="w-full bg-[#ae2070] hover:bg-[#8b1a5a] disabled:bg-[#454756] disabled:text-gray-500 text-white font-bold py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ae2070]/20"
              >
                {loading && loadingMethod === 'momo' ? (
                  <><Loader2 className="animate-spin w-5 h-5" /> Đang xử lý...</>
                ) : (
                  <><img src="https://img.mservice.com.vn/app/img/portal_documents/mini-app_design-guideline_branding-guide-2-2.png" alt="MoMo" className="w-6 h-6 rounded-full object-cover" /> Thanh toán qua MoMo</>
                )}
              </button>

              {/* Mock / Demo */}
              <button
                onClick={() => handleCheckout('mock')}
                disabled={loading}
                className="w-full bg-[#2ecc71] hover:bg-[#27ae60] disabled:bg-[#454756] disabled:text-gray-500 text-white font-bold py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2ecc71]/10"
              >
                {loading && loadingMethod === 'mock' ? (
                  <><Loader2 className="animate-spin w-5 h-5" /> Đang xử lý...</>
                ) : (
                  <>Thanh toán thử (Demo)</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}