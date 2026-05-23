import { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookingApi, queueApi } from '../services/apiClient';
import { AuthContext } from '../context/AuthContext';
import { CheckCircle, XCircle, Loader2, Calendar, MapPin, Ticket } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

export default function PaymentCallback() {
  const [status, setStatus] = useState('processing'); // processing, success, error
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const hasProcessed = useRef(false);

  const triggerConfetti = () => {
    const fire = (particleRatio, opts) => {
      confetti({ origin: { y: 0.6 }, ...opts, particleCount: Math.floor(200 * particleRatio) });
    };
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.20, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.10, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.10, { spread: 120, startVelocity: 45 });
  };

  useEffect(() => {
    if (!user || hasProcessed.current) return;

    hasProcessed.current = true;

    const processPayment = async () => {
      const searchParams = new URLSearchParams(location.search);
      const resultCode = searchParams.get('resultCode');
      const orderId = searchParams.get('orderId');

      const pendingStr = sessionStorage.getItem('pendingPayment');
      const pending = pendingStr ? JSON.parse(pendingStr) : {};

      const eventName = pending.eventName || 'Sự kiện';
      const eventId = pending.eventId || null;
      const amount = pending.amount || 0;
      const ticketIds = pending.ticketIds || [];

      if (!resultCode || !orderId) {
        setStatus('error');
        toast.error("Thiếu thông tin phản hồi từ cổng thanh toán.");
        return;
      }

      if (resultCode !== '0') {
        // Rollback reserved tickets immediately
        const rollbackOrderId = orderId || pending.orderId;
        const rollbackUserId = pending.userId || user?.username;
        if (rollbackOrderId && ticketIds.length > 0) {
          bookingApi.post('/rollback', {
            order_id: rollbackOrderId,
            user_id: rollbackUserId,
            ticket_ids: ticketIds,
          }).catch(e => console.error('Rollback error:', e));
        }
        sessionStorage.removeItem('pendingPayment');
        setStatus('error');
        toast.error("Thanh toán thất bại hoặc đã bị hủy. Vé đã được hoàn lại.");
        return;
      }

      try {
        await bookingApi.post('/confirm', {
          order_id: orderId,
          user_id: user?.username || 'Guest',
          user_email: user?.email || '',
          ticket_ids: ticketIds,
          event_name: eventName,
          amount: Number(amount)
        });

        // Xoá session vé + rời hàng đợi để lần mua tiếp theo bắt đầu lại từ đầu
        sessionStorage.removeItem('pendingPayment');
        if (eventId) sessionStorage.removeItem(`queueSession_${eventId}`);
        queueApi.post('/queue/leave', { user_id: user?.username }).catch(() => {});

        setStatus('success');
        triggerConfetti();
      } catch (err) {
        console.error("Error confirming payment:", err);
        setStatus('error');
        toast.error("Lỗi xác nhận thanh toán với hệ thống.");
      }
    };

    processPayment();
  }, [location, user, navigate]);

  if (status === 'processing') {
    return (
      <div className="min-h-[80vh] bg-[#1b1c21] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin text-[#2ecc71] mb-4" />
        <h2 className="text-xl font-bold">Đang xử lý kết quả thanh toán...</h2>
        <p className="text-gray-400 mt-2">Vui lòng không đóng trình duyệt.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-[80vh] bg-[#1b1c21] flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-[#31333e] border border-[#454756] rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <XCircle className="text-[#e74c3c] w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Thanh toán thất bại</h1>
          <p className="text-gray-400 mb-6">Đã có lỗi xảy ra hoặc bạn đã hủy giao dịch.</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold py-3 px-6 rounded-xl transition-all"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  // Success
  const amountStr = new URLSearchParams(location.search).get('amount'); // MoMo returns amount too!
  const amountToDisplay = amountStr || 0;
  
  return (
    <div className="min-h-[80vh] bg-[#1b1c21] flex flex-col items-center justify-center p-6 text-white">
      <div className="bg-[#31333e] border border-[#454756] rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-[#2ecc71]/10 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-[#2ecc71]/10 border border-[#2ecc71]/30 flex items-center justify-center">
            <CheckCircle className="text-[#2ecc71] w-12 h-12" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Thanh toán thành công!</h1>
        <p className="text-gray-400 text-base mb-2">
          Cảm ơn bạn đã đặt <span className="text-white font-semibold">vé thành công</span>
        </p>

        <div className="bg-[#2a2c36] rounded-xl p-4 mb-8 text-left space-y-2.5 border border-[#454756]">
          <div className="flex items-center gap-2.5 text-sm text-gray-400">
            <Ticket className="w-4 h-4 text-[#2ecc71] shrink-0" />
            <span>Tổng thanh toán: <span className="text-white font-bold">{Number(amountToDisplay).toLocaleString('vi-VN')} đ</span></span>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">Vé đã được gửi vào email của bạn.</p>
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
