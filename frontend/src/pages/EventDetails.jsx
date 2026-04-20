import { useEffect, useState, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventApi, queueApi, inventoryApi, bookingApi } from '../services/apiClient';
import { AuthContext } from '../context/AuthContext';
import { Calendar, MapPin, Ticket, CheckCircle, RefreshCcw, ChevronDown, ChevronUp, X, ZoomIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  
  const [queueStatus, setQueueStatus] = useState('NOT_JOINED'); // NOT_JOINED, IN_QUEUE, TURN_ARRIVED
  const [queuePosition, setQueuePosition] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState(300);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [availableCounts, setAvailableCounts] = useState({ vip: 0, ga: 0, standard: 0 });

  const pollInterval = useRef(null);
  const inventoryPollInterval = useRef(null);

  useEffect(() => {
    // Fetch Event Details
    eventApi.get(`/events/${id}`)
      .then(res => {
        setEvent(res.data);
        return eventApi.get(`/events/${id}/zones`);
      })
      .then(res => {
        const colors = ['bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
        const mappedZ = res.data.map((z, idx) => ({
           id: z.id.toString(),
           name: z.name,
           price: z.price,
           color: colors[idx % colors.length]
        }));
        setTicketTypes(mappedZ);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load event details');
      })
      .finally(() => setLoading(false));

    return () => clearInterval(pollInterval.current);
  }, [id]);

  useEffect(() => {
    let timer;
    if (queueStatus === 'TURN_ARRIVED' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && queueStatus === 'TURN_ARRIVED') {
      toast.error('Đã hết thời gian thao tác!');
      setQueueStatus('NOT_JOINED');
      setTimeLeft(300);
      setSelectedTickets({});
    }
    return () => clearInterval(timer);
  }, [queueStatus, timeLeft]);
    const fetchInventory = useCallback(async () => {
      try {
        const res = await inventoryApi.get('/tickets');
        const ticketsForEvent = res.data.filter(t => t.event_id === Number(id) && !t.is_reserved);
        
        const counts = {};
        ticketsForEvent.forEach(t => {
          const zoneId = t.zone_id ? t.zone_id.toString() : null;
          if(zoneId) counts[zoneId] = (counts[zoneId] || 0) + 1;
        });
        setAvailableCounts(counts);
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
      }
    }, [id]);

    useEffect(() => {
      if (queueStatus === 'TURN_ARRIVED') {
        fetchInventory();
        inventoryPollInterval.current = setInterval(fetchInventory, 3000); // Poll every 3s
      }
      return () => {
        if (inventoryPollInterval.current) clearInterval(inventoryPollInterval.current);
      }
    }, [queueStatus, fetchInventory]);


  const handleQuantityChange = (typeId, delta) => {
    setSelectedTickets(prev => {
      const current = prev[typeId] || 0;
      let next = Math.max(0, current + delta);
      // Validate with realtime inventory
      if (availableCounts[typeId] !== undefined) {
        next = Math.min(next, availableCounts[typeId]);
      }
      return { ...prev, [typeId]: next };
    });
  };

  const calculateTotal = () => {
    return Object.entries(selectedTickets).reduce((total, [typeId, qty]) => {
      const type = ticketTypes.find(t => t.id === typeId);
      return total + (type ? type.price * qty : 0);
    }, 0);
  };

  const handleCheckout = () => {
    if (calculateTotal() > 0) {
      navigate('/payment', { state: { selectedTickets, event, total: calculateTotal(), ticketTypes } });
    } else {
      toast.error('Vui lòng chọn ít nhất 1 vé');
    }
  };

  const joinQueue = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để mua vé');
      navigate('/login');
      return;
    }
    
    try {
      await queueApi.post('/queue/join', { user_id: user.username });
      setQueueStatus('IN_QUEUE');
      toast.success('Đã tham gia phòng chờ!');
      startPolling();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi khi tham gia hàng chờ');
    }
  };

  const startPolling = () => {
    pollInterval.current = setInterval(async () => {
      try {
        const res = await queueApi.get('/queue/status', { params: { user_id: user.username } });
        setQueuePosition(res.data.position);
        
        if (res.data.position <= 5) {
          setQueueStatus('TURN_ARRIVED');
          clearInterval(pollInterval.current);
          toast.success('Đã đến lượt của bạn! Xin mời chọn ghế.');
        }
      } catch (err) {
        console.error(err);
        clearInterval(pollInterval.current);
      }
    }, 5000);
  };

  if (loading) {
    return (
      <div className="bg-[#1b1c21] min-h-screen pt-8 pb-16 text-white font-sans w-full absolute left-0 top-16 right-0">
        <div className="w-[95%] max-w-[120rem] mx-auto space-y-8 px-4 mt-8 animate-pulse">
          <div className="bg-[#31333e] rounded-xl flex flex-col md:flex-row h-[500px]">
            <div className="p-6 w-full md:w-[40%] shrink-0 flex flex-col justify-between">
              <div>
                <div className="h-8 bg-[#454756] rounded w-3/4 mb-8"></div>
                <div className="space-y-6">
                  <div className="h-6 bg-[#454756] rounded w-5/6"></div>
                  <div className="h-6 bg-[#454756] rounded w-4/6"></div>
                </div>
              </div>
              <div className="h-12 bg-[#454756] rounded w-full mt-12"></div>
            </div>
            <div className="flex-1 bg-[#2a2c36]"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) return (
    <div className="bg-[#1b1c21] min-h-screen pt-20 flex flex-col items-center text-white w-full absolute left-0 top-16 right-0">
      <h2 className="text-2xl font-bold mb-4 text-[#e74c3c]">Không tìm thấy sự kiện</h2>
      <button onClick={() => navigate('/')} className="text-[#2ecc71] hover:underline">Quay về trang chủ</button>
    </div>
  );

  return (
    <div className="bg-[#1b1c21] min-h-screen pt-8 pb-16 text-white font-sans w-full absolute left-0 top-16 right-0 overflow-x-hidden">
      <div className="w-[95%] max-w-[120rem] mx-auto space-y-8 px-4 mt-8">
        
        {/* Header Section */}
        <div className="bg-[#31333e] rounded-xl flex flex-col md:flex-row shadow-2xl md:h-[500px] border border-[#454756] overflow-hidden">
          <div className="p-6 w-full md:w-[40%] shrink-0 flex flex-col justify-between z-10 relative md:border-r-[2px] border-dashed border-[#1b1c21]">
            <div>
              <h1 className="text-xl font-bold uppercase mb-4 line-clamp-2 text-white">{event.name}</h1>
              <div className="space-y-3 text-[#d2d4dc]">
                <div className="flex items-start">
                  <Calendar className="mr-3 w-5 h-5 mt-1 shrink-0" />
                  <div className="text-[#2ecc71] font-semibold text-lg">
                    {`20:00 - 22:00, ${event.date}`}
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="mr-3 w-5 h-5 mt-1 shrink-0" />
                  <div>
                    <div className="text-[#2ecc71] font-semibold text-lg">{event.location}</div>
                    <div className="text-[#d2d4dc] text-sm mt-1">Đang cập nhật địa chỉ chi tiết...</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-[#464855]">
               <div className="flex items-baseline mb-6">
                 <span className="text-xl font-bold mr-2 text-white">Giá từ</span>
                 <span className="text-[#2ecc71] text-2xl font-bold">700.000 đ {'>'}</span>
               </div>
               
               {queueStatus === 'NOT_JOINED' ? (
                 <button 
                   onClick={joinQueue}
                   className="w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-3 rounded-lg text-lg transition-colors shadow-lg"
                 >
                   Mua vé ngay
                 </button>
               ) : (
                 <div className="text-center text-gray-400">
                    Xem phòng chờ bên dưới
                 </div>
               )}
            </div>
            
            {/* Cutouts */}
            <div className="hidden md:block absolute top-0 right-0 w-[56px] h-[56px] bg-[#1b1c21] rounded-full translate-x-1/2 -translate-y-1/2 z-20 border border-[#454756]"></div>
            <div className="hidden md:block absolute bottom-0 right-0 w-[56px] h-[56px] bg-[#1b1c21] rounded-full translate-x-1/2 translate-y-1/2 z-20 border border-[#454756]"></div>
          </div>

          <div className="flex-1 relative flex w-full h-[300px] md:h-auto overflow-hidden rounded-b-xl md:rounded-b-none md:rounded-r-xl">
             <img src={event.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80'} alt={event.name} className="w-full h-full object-cover rounded-xl md:rounded-l-none" onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&h=800&q=80"; }} />
          </div>
        </div>

        {/* Description Section */}
        <div className="bg-[#31333e] rounded-xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 bg-[#2a2c36] border-b border-[#454756]">
            <h3 className="text-[#2ecc71] font-bold text-lg">Giới thiệu</h3>
          </div>
          <div className="px-8 py-10 text-center space-y-3 text-[#d2d4dc]">
            <h2 className="text-lg uppercase font-medium tracking-wide mb-4">{event.name}</h2>
            
            <div className={`text-lg md:text-xl max-w-2xl mx-auto leading-loose whitespace-pre-line text-left md:text-center font-light overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px]' : 'max-h-[8rem]'}`}>
              {event.description ? event.description : (
                <>
                  Tôi ổn.<br/>
                  Nghe quen không?<br/><br/>
                  90% mọi người nói câu này... đều đang nói dối.<br/><br/>
                  {event.name.toUpperCase()}<br/>
                  {event.date}<br/>
                  {event.location}<br/><br/>
                  Đến đây cùng tôi, nghe sự thật một lần.<br/>
                  Rồi để gió cuốn đi.
                </>
              )}
            </div>

            <div className="mt-4 flex justify-center pt-2">
               <button 
                 onClick={() => setIsExpanded(!isExpanded)} 
                 className="flex flex-col items-center text-gray-400 hover:text-[#2ecc71] transition-colors focus:outline-none"
               >
                 <span className="text-sm font-semibold mb-1 uppercase tracking-wider">{isExpanded ? 'Thu gọn' : 'Xem thêm'}</span>
                 {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6 animate-bounce" />}
               </button>
            </div>
          </div>
        </div>

        {/* Queue and Booking Logic UI - Below */}
        <div className="bg-[#31333e] rounded-xl p-8 mt-8 shadow-2xl border border-[#454756] min-h-[300px]">
          {queueStatus === 'NOT_JOINED' && (
            <div className="text-center text-gray-400 py-12 flex flex-col items-center justify-center h-full">
               <Ticket size={48} className="mb-4 text-[#454756]" />
               <p className="text-xl">Vui lòng click "Mua vé ngay" ở trên để xếp hàng chờ mua vé.</p>
            </div>
          )}

          {queueStatus === 'IN_QUEUE' && (
            <div className="text-center space-y-4 py-8">
              <RefreshCcw size={48} className="mx-auto text-[#2ecc71] animate-spin mb-4" />
              <h2 className="text-2xl font-bold text-white">Bạn đang ở phòng chờ</h2>
              <p className="text-[#d2d4dc]">Vui lòng đợi. Không tải lại trang.</p>
              <div className="inline-block bg-[#1b1c21] px-8 py-6 rounded-xl shadow-inner mt-6 border border-[#454756]">
                <span className="block text-sm text-[#d2d4dc] uppercase tracking-wide">Số thứ tự của bạn</span>
                <span className="block text-6xl font-black text-[#2ecc71] mt-2">{queuePosition ?? '--'}</span>
              </div>
            </div>
          )}

          {queueStatus === 'TURN_ARRIVED' && (
            <div className="py-4">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#454756]">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <CheckCircle className="text-[#2ecc71] mr-3" size={32} /> Đến lượt bạn mua vé!
                </h2>
                <div className="flex items-center space-x-2 bg-[#e74c3c]/10 px-4 py-2 rounded-lg border border-[#e74c3c]/20">
                  <span className="text-[#e74c3c] font-bold">Thời gian còn lại:</span>
                  <span className="text-[#e74c3c] font-mono font-bold text-xl tracking-wider">
                    {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Sơ đồ sân khấu */}
                <div className="lg:w-2/3 bg-[#2a2c36] p-4 rounded-xl border border-[#454756] flex flex-col items-center justify-center min-h-[400px] relative group cursor-pointer" onClick={() => setShowImageModal(true)}>
                   <div className="absolute top-4 right-4 bg-black/60 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:block">
                     <ZoomIn className="text-white w-6 h-6" />
                   </div>
                   <img 
                     src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80" 
                     alt="Sơ đồ sân khấu" 
                     className="w-full h-auto rounded-lg object-contain max-h-[600px] hover:scale-[1.02] transition-transform duration-300"
                   />
                   <p className="mt-4 text-sm text-gray-400 italic text-center">Bấm vào hình để phóng to</p>
                </div>

                {/* Danh sách các loại vé */}
                <div className="lg:w-1/3 flex flex-col space-y-4">
                  <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {ticketTypes.map(type => (
                      <div key={type.id} className="flex items-center justify-between bg-[#2a2c36] p-4 rounded-xl border border-[#454756] hover:border-[#2ecc71] transition-colors">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                             <div className={`w-4 h-4 rounded-full shadow-sm ${type.color}`}></div>
                             <h3 className="text-xl font-bold text-white">{type.name}</h3>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[#2ecc71] font-bold text-lg">
                              {type.price.toLocaleString('vi-VN')} đ
                            </p>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#1b1c21] text-gray-300 border border-[#454756]">
                              Còn: {availableCounts[type.id] !== undefined ? availableCounts[type.id] : 0} vé
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3 bg-[#1b1c21] p-1 rounded-full border border-[#454756]">
                          <button 
                            onClick={() => handleQuantityChange(type.id, -1)}
                            disabled={(selectedTickets[type.id] || 0) === 0}
                            className="w-7 h-7 rounded-full bg-[#454756] flex items-center justify-center hover:bg-[#e74c3c] transition-colors text-white font-bold disabled:opacity-50 disabled:hover:bg-[#454756]"
                          >-</button>
                          <span className="text-lg font-bold w-5 text-center text-white">
                            {selectedTickets[type.id] || 0}
                          </span>
                          <button 
                            onClick={() => handleQuantityChange(type.id, 1)}
                            disabled={(selectedTickets[type.id] || 0) >= (availableCounts[type.id] || 0)}
                            className="w-7 h-7 rounded-full bg-[#454756] flex items-center justify-center hover:bg-[#2ecc71] transition-colors text-white font-bold disabled:opacity-50 disabled:hover:bg-[#454756]"
                          >+</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-[#454756]">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-xl text-gray-400">Tổng tiền:</span>
                      <span className="text-3xl font-bold text-[#2ecc71]">
                        {calculateTotal().toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    
                    <button 
                      onClick={handleCheckout}
                      disabled={calculateTotal() === 0}
                      className="w-full bg-[#2ecc71] hover:bg-[#27ae60] active:bg-[#1e8449] disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-xl transition-all shadow-lg transform disabled:transform-none active:scale-[0.98]"
                    >
                      Thanh toán ngay
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Image Zoom Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
          onClick={() => setShowImageModal(false)}
        >
          <button 
            className="absolute top-6 right-6 text-white hover:text-[#e74c3c] transition-colors p-2 bg-black/50 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setShowImageModal(false);
            }}
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=2000&q=80" 
            alt="Sơ đồ sân khấu phóng to" 
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking the image itself
          />
        </div>
      )}

    </div>
  );
}
