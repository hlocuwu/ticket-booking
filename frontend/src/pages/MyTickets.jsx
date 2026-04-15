import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { inventoryApi } from '../services/apiClient';
import { Ticket, MapPin, Calendar, Clock, Loader2, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyTickets() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchMyTickets = async () => {
      try {
        const res = await inventoryApi.get(`/user/tickets/${user.username}`);
        setTickets(res.data || []);
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
        toast.error('Không thể lấy danh sách vé của bạn.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyTickets();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-500">Đang tải vé của bạn...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 min-h-[70vh]">
      <div className="flex items-center gap-3 mb-8">
        <Ticket className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-800">Vé của tôi</h1>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Ticket className="w-12 h-12 text-gray-300" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Bạn chưa có vé nào</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Hiện tại bạn chưa mua hoặc giữ chỗ nào trong hệ thống. Hãy mua vé để theo dõi tại đây nhé!
          </p>
          <button 
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md"
          >
            Khám phá sự kiện
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-200 flex flex-col">
              {/* Card Header (Image) */}
              <div 
                className="h-32 bg-gray-200 relative bg-cover bg-center"
                style={{ backgroundImage: `url(${ticket.image_url})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="text-white font-bold text-lg line-clamp-1">{ticket.event_name}</h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-grow">
                <div className="space-y-3">
                  <p className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                    <span className="font-semibold mr-1">Ngày:</span> {ticket.date}
                  </p>
                  <p className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2 text-[#2ecc71]" />
                    <span className="font-semibold mr-1">Giờ:</span> 20:00 (Dự kiến)
                  </p>
                  <p className="flex items-center text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 text-red-500" />
                    <span className="font-semibold mr-1">Nơi tổ chức:</span> 
                    <span className="truncate">{ticket.location}</span>
                  </p>
                </div>
                
                <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-end">
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Mã Ghế / Khu vực</p>
                    <p className="text-xl font-black text-gray-800">{ticket.seat_name}</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-50 flex items-center justify-center rounded-lg border border-gray-200">
                    <QrCode className="w-8 h-8 text-gray-700" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
