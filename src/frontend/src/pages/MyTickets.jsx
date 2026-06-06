import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { inventoryApi } from '../services/apiClient';
import { Ticket, MapPin, Calendar, Clock, Loader2, QrCode, X, ZoomIn } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function MyTickets() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
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

  // QR data: email + ticket ID
  const getQRData = (ticket) =>
    `EMAIL:${user?.email || user?.username}\nTICKET:#${ticket.id}\nEVENT:${ticket.event_name}\nSEAT:${ticket.seat_name}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b1c21] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#2ecc71] mb-4" />
        <p className="text-gray-400">Đang tải vé của bạn...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1b1c21] text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-[#2ecc71]/10 border border-[#2ecc71]/20 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-[#2ecc71]" />
            </div>
            <h1 className="text-2xl font-bold text-white">Vé của tôi</h1>
          </div>
          <p className="text-gray-500 text-sm ml-[52px]">
            {tickets.length > 0 ? `Bạn có ${tickets.length} vé trong tài khoản` : 'Chưa có vé nào'}
          </p>
        </div>

        {tickets.length === 0 ? (
          <div className="bg-[#31333e] rounded-2xl border border-[#454756] p-14 text-center max-w-lg mx-auto">
            <div className="w-20 h-20 bg-[#2a2c36] rounded-full flex items-center justify-center mx-auto mb-5">
              <Ticket className="w-10 h-10 text-[#454756]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Bạn chưa có vé nào</h2>
            <p className="text-gray-500 mb-6 text-sm">Hãy mua vé để theo dõi tại đây nhé!</p>
            <button onClick={() => navigate('/')} className="bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg">
              Khám phá sự kiện
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => { setSelectedTicket(ticket); setShowQR(false); }}
                className="bg-[#31333e] rounded-2xl border border-[#454756] hover:border-[#2ecc71]/50 overflow-hidden flex flex-col cursor-pointer transition-all duration-200 hover:shadow-[0_4px_24px_rgba(46,204,113,0.08)] hover:-translate-y-0.5 group"
              >
                {/* Image */}
                <div className="relative h-40 overflow-hidden bg-[#2a2c36]">
                  {ticket.image_url ? (
                    <img src={ticket.image_url} alt={ticket.event_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Ticket className="w-12 h-12 text-[#454756]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#31333e] via-black/20 to-transparent" />
                  {/* Zone badge */}
                  <div className="absolute top-3 right-3 bg-[#2ecc71] text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                    {ticket.seat_name}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col flex-grow gap-3">
                  <h3 className="font-bold text-white text-base leading-snug line-clamp-2 group-hover:text-[#2ecc71] transition-colors">
                    {ticket.event_name}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-400 mt-auto">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#2ecc71] shrink-0" />
                      <span>{ticket.date}</span>
                      {ticket.time && <span className="text-gray-500">· {ticket.time}</span>}
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5" />
                      <span className="truncate">{ticket.location}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-4 pt-3 border-t border-[#454756] flex justify-between items-center">
                  <div className="flex items-center gap-2 text-gray-500">
                    <QrCode className="w-4 h-4 group-hover:text-[#2ecc71] transition-colors" />
                    <span className="text-xs font-mono">#{String(ticket.id).toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-[#2ecc71] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Xem chi tiết →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== TICKET DETAIL MODAL ===== */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="bg-[#31333e] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#454756] shadow-2xl overflow-hidden relative flex flex-col"
            style={{ maxHeight: '95vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setSelectedTicket(null)}
              className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 z-10 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Scrollable content */}
            <div className="overflow-y-auto">
              {/* Header image */}
              {selectedTicket.image_url ? (
                <div className="h-48 relative bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${selectedTicket.image_url})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#31333e] via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 pr-12">
                    <h2 className="text-xl font-bold text-white leading-tight line-clamp-2">{selectedTicket.event_name}</h2>
                    <p className="text-gray-300 flex items-center text-sm mt-1">
                      <MapPin className="w-4 h-4 mr-1 text-[#2ecc71] shrink-0" />
                      <span className="line-clamp-1">{selectedTicket.location}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="px-6 pt-8 pb-2 pr-12">
                  <h2 className="text-xl font-bold text-white leading-tight">{selectedTicket.event_name}</h2>
                </div>
              )}

              {/* Main content */}
              <div className="p-6 space-y-5">

                {/* QR + Seat highlight row */}
                <div className="flex gap-4">
                  {/* Seat info */}
                  <div className="flex-1 bg-[#2ecc71]/10 border border-[#2ecc71]/20 rounded-2xl p-4 flex flex-col justify-center">
                    <p className="text-[10px] text-[#2ecc71] font-bold uppercase tracking-widest mb-1">Khu / Ghế</p>
                    <p className="text-3xl font-black text-[#2ecc71] leading-none">{selectedTicket.seat_name || 'N/A'}</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-2">#{selectedTicket.id}</p>
                  </div>

                  {/* QR Code Box - clickable */}
                  <button
                    onClick={() => setShowQR(true)}
                    className="relative bg-[#2a2c36] border-2 border-dashed border-[#454756] hover:border-[#2ecc71] rounded-2xl px-5 py-4 flex flex-col items-center justify-center gap-2 transition-all group/qr shrink-0"
                    title="Bấm để xem mã QR"
                  >
                    <QrCode className="w-12 h-12 text-gray-400 group-hover/qr:text-[#2ecc71] transition-colors" />
                    <span className="text-[10px] text-gray-500 font-semibold group-hover/qr:text-[#2ecc71] transition-colors">Xem QR</span>
                    <div className="absolute -top-1.5 -right-1.5 bg-[#2ecc71] rounded-full p-0.5">
                      <ZoomIn className="w-3 h-3 text-white" />
                    </div>
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-[#454756]" />

                {/* Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-[#2a2c36] rounded-xl flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-[#2ecc71]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Ngày diễn ra</p>
                      <p className="text-base text-white font-bold">{selectedTicket.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-[#2a2c36] rounded-xl flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-[#2ecc71]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Thời gian</p>
                      <p className="text-base text-white font-bold">{selectedTicket.time || 'Xem chi tiết sự kiện'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-[#2a2c36] rounded-xl flex items-center justify-center shrink-0">
                      <Ticket className="w-4 h-4 text-[#2ecc71]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Mã vé</p>
                      <p className="text-base text-white font-bold font-mono">#{selectedTicket.id}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#454756] bg-[#2a2c36] px-6 py-3 text-center shrink-0">
              <p className="text-xs text-gray-500">Xuất trình mã QR khi check-in tại sự kiện</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== QR CODE FULL SCREEN MODAL ===== */}
      {showQR && selectedTicket && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* QR Code */}
            <QRCodeSVG
              value={getQRData(selectedTicket)}
              size={220}
              level="H"
              includeMargin={false}
              style={{ borderRadius: '8px' }}
            />

            <div className="mt-5 space-y-1">
              <p className="text-gray-800 font-black text-lg">{selectedTicket.seat_name}</p>
              <p className="text-gray-500 text-sm font-mono">#{selectedTicket.id}</p>
              <p className="text-gray-400 text-xs mt-2 font-medium line-clamp-1">{selectedTicket.event_name}</p>
            </div>

            <button
              onClick={() => setShowQR(false)}
              className="mt-5 w-full bg-[#1b1c21] hover:bg-[#31333e] text-white font-bold py-3 rounded-xl transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
