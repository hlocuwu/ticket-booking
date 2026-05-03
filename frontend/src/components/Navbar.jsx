import { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Search, Ticket, User, LogOut, Clock, X, LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../assets/images/bg.svg';

const SEARCH_HISTORY_KEY = 'flashticket_search_history';
const MAX_HISTORY = 8;

function getHistory() {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || []; } catch { return []; }
}
function saveHistory(term, prev) {
  const next = [term, ...prev.filter(t => t !== term)].slice(0, MAX_HISTORY);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState(getHistory);
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const formRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (term) {
      setHistory(prev => saveHistory(term, prev));
      navigate(`/?search=${encodeURIComponent(term)}`);
    } else {
      navigate('/');
    }
    setShowHistory(false);
  };

  const applyHistoryItem = (term) => {
    setSearchTerm(term);
    setHistory(prev => saveHistory(term, prev));
    navigate(`/?search=${encodeURIComponent(term)}`);
    setShowHistory(false);
  };

  const removeHistoryItem = (e, term) => {
    e.stopPropagation();
    setHistory(prev => {
      const next = prev.filter(t => t !== term);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearHistory = (e) => {
    e.stopPropagation();
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setHistory([]);
  };

  const filteredHistory = history.filter(t =>
    !searchTerm || t.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <nav className="bg-[#00b14f] sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1280px] mx-auto px-4 h-20 md:h-[84px] flex justify-between items-center gap-6">
        
        {/* Logo */}
        <Link to="/" className="whitespace-nowrap flex items-center -ml-2 md:-ml-4">
          <img src={logo} alt="FlashTicket" className="h-14 md:h-[68px] w-auto object-contain" />
        </Link>

        {/* Search Bar - Center */}
        <div ref={formRef} className="flex-1 max-w-[500px] xl:max-w-[600px] hidden md:block relative">
          <form
            onSubmit={handleSearch}
            className="flex items-center bg-white rounded-full p-1.5 shadow-sm"
          >
            <div className="pl-4 flex items-center">
              <Search size={22} className="text-gray-500 shrink-0" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowHistory(true)}
              placeholder="Bạn tìm gì hôm nay?"
              className="w-full pl-3 pr-2 py-2.5 outline-none text-gray-800 placeholder-gray-500 text-base bg-transparent"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setShowHistory(true); }}
                className="p-1 mr-1 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="submit"
              className="bg-[#0a7c3a] text-white px-8 py-2.5 rounded-full text-base font-semibold hover:bg-[#086731] transition-colors whitespace-nowrap shrink-0"
            >
              Tìm kiếm
            </button>
          </form>

          {/* Search History Dropdown */}
          {showHistory && filteredHistory.length > 0 && (
            <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lịch sử tìm kiếm</span>
                <button
                  onClick={clearHistory}
                  className="text-xs text-[#00b14f] hover:text-[#086731] font-semibold transition-colors"
                >
                  Xóa tất cả
                </button>
              </div>
              <ul>
                {filteredHistory.map((term) => (
                  <li key={term}>
                    <button
                      onClick={() => applyHistoryItem(term)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
                    >
                      <Clock size={15} className="text-gray-400 shrink-0" />
                      <span className="flex-1 text-gray-700 text-sm truncate">{term}</span>
                      <button
                        onClick={(e) => removeHistoryItem(e, term)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-all p-0.5 rounded"
                      >
                        <X size={13} />
                      </button>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Nav Items */}
        <div className="flex items-center space-x-8 text-base font-semibold text-white">
          <button
            onClick={() => {
              if (user) { navigate('/my-tickets'); }
              else { toast.error('Vui lòng đăng nhập để xem vé của bạn!'); navigate('/login'); }
            }}
            className="flex items-center gap-2.5 text-white hover:text-green-100 transition-colors bg-transparent border-none p-0 cursor-pointer"
          >
            <Ticket size={24} />
            <span className="hidden sm:block text-base">Vé của tôi</span>
          </button>

          {user ? (
            <div className="group relative cursor-pointer flex items-center gap-2.5 text-white hover:text-green-100 transition-colors py-2">
              <User size={24} />
              <span className="hidden sm:block text-base truncate max-w-[120px]">{user.username}</span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-white text-gray-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-100 p-2 flex flex-col before:content-[''] before:absolute before:-top-4 before:left-0 before:w-full before:h-4">
                <Link to="/profile" className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-100 rounded-lg transition-colors text-[15px] font-medium text-gray-700">
                  <User size={20} strokeWidth={2.5} className="text-gray-600" />
                  <span>Tài khoản của tôi</span>
                </Link>
                <Link to="/my-tickets" className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-100 rounded-lg transition-colors text-[15px] font-medium text-gray-700">
                  <Ticket size={20} strokeWidth={2.5} className="text-gray-600" />
                  <span>Vé của tôi</span>
                </Link>
                {user?.username === 'admin' && (
                  <Link to="/admin" className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-100 rounded-lg transition-colors text-[15px] font-medium text-gray-700">
                    <LayoutDashboard size={20} strokeWidth={2.5} className="text-gray-600" />
                    <span>Quản trị</span>
                  </Link>
                )}
                <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-100 rounded-lg transition-colors text-[15px] font-medium text-red-500">
                  <LogOut size={20} strokeWidth={2.5} className="text-red-500 opacity-80" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-2.5 text-white hover:text-green-100 transition-colors">
              <User size={24} />
              <span className="hidden sm:block text-base">Tài khoản</span>
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}