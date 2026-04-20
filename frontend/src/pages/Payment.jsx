import { useState, useContext, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { inventoryApi, bookingApi, notificationApi } from '../services/apiClient';
import { AuthContext } from '../context/AuthContext';
import { CheckCircle, CreditCard, ChevronLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Payment() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // If accessed directly without state, redirect to home
  useEffect(() => {
    if (!state || !state.selectedTickets || !state.event) {
      navigate('/');
    }
  }, [state, navigate]);

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
      // 1. Fetch available tickets for the event from DB
      const res = await inventoryApi.get('/tickets');
      const availableTickets = res.data.filter(t => t.event_id === Number(event.id) && !t.is_reserved);

      if (availableTickets.length < totalCount) {
        setLoading(false);
        toast.error(`Rất tiếc! Chỉ còn ${availableTickets.length} ghế trống trong hệ thống.`);
        return;
      }

      // 2. Pick `n` available tickets to fulfill the order based on selected types
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

      // 3. Call book API for each ticket
      for (const ticket of ticketsToBook) {
        await bookingApi.post('/book', {
          user_id: user.username,
          ticket_id: ticket.id
        });
      }

      // 4. Send Email Notification
      if (user.email) {
        try {
          const emailBody = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #2ecc71;">Thanh toán thành công!</h2>
              <p>Chào <strong>${user.full_name || user.username}</strong>,</p>
              <p>Bạn đã mua thành công <strong>${totalCount} vé</strong> cho sự kiện <strong>${event.name}</strong>.</p>
              <p><strong>Thông tin sự kiện:</strong></p>
              <ul style="line-height: 1.5;">
                <li><strong>Thời gian:</strong> ${event.date} | 20:00</li>
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
          // Không chặn quá trình đặt vé nếu lỗi gửi mail
        }
      }

      // Giả lập thanh toán thành công mất 2s
      setTimeout(() => {
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

  if (success) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <CheckCircle className="text-[#2ecc71] w-24 h-24 mb-6" />
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Thanh toán thành công!</h1>
        <p className="text-gray-600 text-lg mb-8">Cảm ơn bạn đã đặt {totalCount} vé cho sự kiện {event.name}.</p>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/my-tickets')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg"
          >
            Xem vé của tôi
          </button>
          <button 
            onClick={() => navigate('/')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-xl transition-all shadow-lg"
          >
            Trở về Trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto min-h-[70vh] py-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6 font-semibold"
      >
        <ChevronLeft className="w-5 h-5 mr-1" />
        Quay lại
      </button>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
        {/* Left: Order Summary */}
        <div className="md:w-1/2 p-8 bg-gray-50 border-r border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Tóm tắt đơn hàng</h2>
          
          <div className="space-y-4 mb-6 bg-white p-4 rounded-xl border border-gray-200">
            <h3 className="font-bold text-lg text-gray-800">{event.name}</h3>
            <p className="text-gray-600 flex items-center"><span className="w-24 font-semibold inline-block">Thời gian:</span> {event.date} | 20:00</p>
            <p className="text-gray-600 flex items-center"><span className="w-24 font-semibold inline-block">Địa điểm:</span> {event.location}</p>
          </div>

          <div className="space-y-3 mb-8">
            <h3 className="font-bold text-gray-700 uppercase text-sm tracking-wider">Chi tiết vé</h3>
            {Object.entries(selectedTickets).map(([typeId, qty]) => {
              if (qty === 0) return null;
              let name = `Khu vực #${typeId}`;
              let price = 0;
              
              if (ticketTypes) {
                const typeInfo = ticketTypes.find(t => t.id === typeId);
                if (typeInfo) {
                  name = typeInfo.name;
                  price = typeInfo.price;
                }
              }
              
              return (
                <div key={typeId} className="flex justify-between items-center text-gray-700">
                  <span>{qty} x {name}</span>
                  <span className="font-semibold">{(price * qty).toLocaleString('vi-VN')} đ</span>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
            <span className="text-xl font-bold text-gray-800">Tổng cộng:</span>
            <span className="text-3xl font-black text-[#2ecc71]">{total.toLocaleString('vi-VN')} đ</span>
          </div>
        </div>

        {/* Right: Payment Action */}
        <div className="md:w-1/2 p-8 flex flex-col justify-center items-center text-center bg-white">
          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6">
            <CreditCard className="w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Xác nhận & Thanh toán</h2>
          <p className="text-gray-500 mb-8 max-w-sm">
            Bạn đang chuẩn bị thanh toán số tiền <strong className="text-gray-700">{total.toLocaleString('vi-VN')} đ</strong> cho hệ thống. Số vé mua sẽ được chuyển thẳng mã QR vào email.
          </p>

          <button 
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl text-xl transition-all shadow-lg flex items-center justify-center"
          >
            {loading ? (
              <><Loader2 className="animate-spin w-6 h-6 mr-2" /> Đang xử lý...</>
            ) : (
              'Thanh toán giả lập ngay'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}