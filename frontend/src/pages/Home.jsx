import { useEffect, useState } from 'react';
import { eventApi } from '../services/apiClient';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import toast from 'react-hot-toast';
import Footer from '../components/layout/Footer';

// Mock Banners for aesthetics matching Ticketbox
const MOCK_BANNERS = [
  { id: 1, image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80', title: 'Cẩm nang sự kiện âm nhạc' },
  { id: 2, image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80', title: 'Những thanh âm mùa hè rực rỡ' },
  { id: 3, image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80', title: 'Lễ hội EDM lớn nhất năm' }
];

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');

  useEffect(() => {
    // 1. Fetch real events from Go backend
    const fetchEvents = async () => {
      setLoading(true);
      const endpoint = searchQuery ? `/events?search=${encodeURIComponent(searchQuery)}` : '/events';
      
      try {
        const res = await eventApi.get(endpoint);
        const raw = res.data || [];
        const today = new Date(new Date().toDateString());
        // Sort: upcoming first, past last
        const sorted = [...raw].sort((a, b) => {
          const aPast = new Date(a.date) < today;
          const bPast = new Date(b.date) < today;
          if (aPast === bPast) return new Date(a.date) - new Date(b.date);
          return aPast ? 1 : -1;
        });
        setEvents(sorted);
      } catch (err) {
        console.error(err);
        toast.error('Có lỗi xảy ra khi tải danh sách sự kiện');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [searchQuery]);

  // Banner chỉ dùng upcoming events; fallback to MOCK_BANNERS nếu không có
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date(new Date().toDateString()));
  const banners = upcomingEvents.length > 0
    ? upcomingEvents.map((event) => ({ id: event.id, image: event.image_url, title: event.name }))
    : MOCK_BANNERS;

  useEffect(() => {
    // 2. Auto-slide logic for banner
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const nextBanner = () => setCurrentBanner((prev) => (prev + 1) % banners.length);
  const prevBanner = () => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);

  return (
    <div className="bg-[#1b1c21] min-h-screen text-white">
      {/* ================= BANNER HERO SLIDER ================= */}
      <div className="relative w-full max-w-[1400px] mx-auto mt-6 px-4">
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl aspect-[16/9] lg:aspect-[21/9] bg-[#31333e]">
          
          {banners.map((banner, index) => (
            <div 
              key={banner.id}
              style={{
                opacity: index === currentBanner ? 1 : 0,
                zIndex: index === currentBanner ? 10 : 0
              }}
              className="absolute inset-0 transition-opacity duration-[800ms] ease-in-out"
            >
              <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
              {/* Optional Gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-10 left-10 text-white font-black text-2xl lg:text-4xl shadow-sm drop-shadow-md">
                 {banner.title}
              </div>
            </div>
          ))}
          
          {/* Navigation Arrows */}
          <button onClick={prevBanner} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/25 hover:bg-black/60 text-white p-3 rounded-full backdrop-blur-sm transition-all shadow-md group">
            <ChevronLeft size={28} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          
          <button onClick={nextBanner} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/25 hover:bg-black/60 text-white p-3 rounded-full backdrop-blur-sm transition-all shadow-md group">
            <ChevronRight size={28} className="group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Indicator Dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-3">
            {banners.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentBanner(idx)}
                className={`transition-all duration-300 rounded-full h-2.5 ${idx === currentBanner ? 'w-8 bg-[#00b14f]' : 'w-2.5 bg-white/60 hover:bg-white'}`}
                aria-label={`Đi tới banner ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ================= MAIN EVENT ROW ================= */}
      <div className="max-w-[1200px] mx-auto px-4 py-16">
        
        {/* Section Header */}
        <div className="flex items-center mb-8">
          <h2 className="text-[26px] font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="w-2 h-8 bg-[#00b14f] rounded-lg"></div> {/* Green accent line */}
            {searchQuery ? `KẾT QUẢ TÌM KIẾM: "${searchQuery}"` : 'SỰ KIỆN NỔI BẬT'}
          </h2>
        </div>
        
        {loading ? (
          <div className="flex flex-col justify-center items-center py-32 text-gray-400">
            <div className="w-12 h-12 border-4 border-[#31333e] border-t-[#00b14f] rounded-full animate-spin mb-4"></div>
            <p className="font-medium text-lg">Đang tải sự kiện thú vị...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-32 text-gray-400">
            <SearchX size={64} className="text-[#454756] mb-4" />
            <p className="font-medium text-lg">Không tìm thấy sự kiện nào phù hợp!</p>
            {searchQuery && (
              <Link to="/" className="mt-4 text-[#00b14f] hover:underline font-semibold">
                Quay lại xem tất cả sự kiện
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8">
            {events.map((event) => {
              const isPast = new Date(event.date) < new Date(new Date().toDateString());

              return (
                <Link
                  to={`/event/${event.id}`}
                  key={event.id}
                  className={isPast
                    ? "group bg-[#31333e] rounded-xl overflow-hidden shadow-sm flex flex-col h-full border border-[#454756] opacity-60 transition-all duration-300"
                    : "group bg-[#31333e] rounded-xl overflow-hidden shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col h-full border border-[#454756]"}
                >
                  {/* Event Image */}
                  <div className="aspect-[16/9] w-full bg-[#1b1c21] overflow-hidden relative">
                    <img 
                      src={event.image_url || 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=600&q=80'} 
                      alt={event.name} 
                      className={`w-full h-full object-cover transition-transform duration-700 ${isPast ? 'grayscale' : 'group-hover:scale-110'}`}
                    />
                    {/* Status badge */}
                    {isPast ? (
                      <div className="absolute top-3 left-3 bg-[#454756] text-gray-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded shadow-sm">
                        Đã diễn ra
                      </div>
                    ) : (
                      <div className="absolute top-3 left-3 bg-[#00b14f] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded shadow-sm">
                        Hot
                      </div>
                    )}
                  </div>

                  {/* Event Details Card */}
                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className={`font-bold text-lg line-clamp-2 leading-snug mb-4 transition-colors ${isPast ? 'text-gray-500' : 'text-white group-hover:text-[#00b14f]'}`}>
                      {event.name}
                    </h3>
                    
                    <div className="mt-auto space-y-2.5 text-[15px] text-[#d2d4dc] font-medium">
                      <div className="flex items-start gap-2.5">
                        <Calendar size={18} className="text-[#8c8f9b] mt-0.5 shrink-0" />
                        <span className="truncate">{event.date}</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <MapPin size={18} className="text-[#8c8f9b] mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
