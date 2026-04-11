import { useEffect, useState } from 'react';
import { eventApi } from '../services/apiClient';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Footer from '../components/layout/Footer';

// Mock Banners for aesthetics matching Ticketbox
const MOCK_BANNERS = [
  { id: 1, image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80', title: 'Cẩm nang sự kiện âm nhạc' },
  { id: 2, image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80', title: 'Những thanh âm mùa hè rực rỡ' },
  { id: 3, image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80', title: 'Lễ hội EDM lớn nhất năm' }
];

// Placeholder Mock images for our fetched backend events 
// since our backend currently doesn't store an `image` column
const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1533174000222-3580556eaaff?auto=format&fit=crop&w=600&q=80',
];

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    // 1. Fetch real events from Go backend
    eventApi.get('/events')
      .then(res => setEvents(res.data))
      .catch(err => {
        console.error(err);
        toast.error('Có lỗi xảy ra khi tải danh sách sự kiện');
      })
      .finally(() => setLoading(false));
      
    // 2. Auto-slide logic for banner
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % MOCK_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextBanner = () => setCurrentBanner((prev) => (prev + 1) % MOCK_BANNERS.length);
  const prevBanner = () => setCurrentBanner((prev) => (prev - 1 + MOCK_BANNERS.length) % MOCK_BANNERS.length);

  return (
    <div className="bg-[#f0f2f5] min-h-screen">
      {/* ================= BANNER HERO SLIDER ================= */}
      <div className="relative w-full max-w-[1400px] mx-auto mt-6 px-4">
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl aspect-[21/9] lg:aspect-[25/8] bg-gray-200">
          
          {MOCK_BANNERS.map((banner, index) => (
            <div 
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-[800ms] ease-in-out ${index === currentBanner ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
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
            {MOCK_BANNERS.map((_, idx) => (
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
          <h2 className="text-[26px] font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <div className="w-2 h-8 bg-[#00b14f] rounded-lg"></div> {/* Green accent line */}
            SỰ KIỆN NỔI BẬT
          </h2>
        </div>
        
        {loading ? (
          <div className="flex flex-col justify-center items-center py-32 text-gray-500">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#00b14f] rounded-full animate-spin mb-4"></div>
            <p className="font-medium text-lg">Đang tải sự kiện thú vị...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
            {events.map((event, idx) => (
              <Link 
                to={`/events/${event.id}`} 
                key={event.id}
                className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col h-full border border-gray-100"
              >
                {/* Event Image */}
                <div className="aspect-[4/3] w-full bg-gray-200 overflow-hidden relative">
                  <img 
                    src={EVENT_IMAGES[idx % EVENT_IMAGES.length]} 
                    alt={event.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Status badge: Mới mở bán */}
                  <div className="absolute top-3 left-3 bg-[#00b14f] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded shadow-sm">
                    Hot
                  </div>
                </div>

                {/* Event Details Card */}
                <div className="p-5 flex flex-col flex-grow">
                  <h3 className="font-bold text-gray-900 text-lg line-clamp-2 leading-snug mb-4 group-hover:text-[#00b14f] transition-colors">
                    {event.name}
                  </h3>
                  
                  <div className="mt-auto space-y-2.5 text-[15px] text-gray-600 font-medium">
                    <div className="flex items-start gap-2.5">
                      <Calendar size={18} className="text-gray-400 mt-0.5 shrink-0" />
                      <span className="truncate">{event.date}</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin size={18} className="text-gray-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
