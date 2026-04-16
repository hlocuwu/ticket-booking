import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Search, Ticket, User, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../assets/images/bg.svg';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate(`/`);
    }
  };

  return (
    <nav className="bg-[#00b14f] sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1280px] mx-auto px-4 h-20 md:h-[84px] flex justify-between items-center gap-6">
        
        {/* Branch / Logo */}
        <Link to="/" className="whitespace-nowrap flex items-center -ml-2 md:-ml-4">
          <img 
            src={logo} 
            alt="FlashTicket" 
            className="h-14 md:h-[68px] w-auto object-contain" 
          />
        </Link>

        {/* Search Bar - Center */}
        <form 
          onSubmit={handleSearch}
          className="flex-1 max-w-[500px] xl:max-w-[600px] hidden md:flex items-center bg-white rounded-full p-1.5 shadow-sm"
        >
          <div className="pl-4 flex items-center">
            <Search size={22} className="text-gray-500 shrink-0" />
          </div>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Bạn tìm gì hôm nay?" 
            className="w-full pl-3 pr-2 py-2.5 outline-none text-gray-800 placeholder-gray-500 text-base bg-transparent"
          />
          <button 
            type="submit"
            className="bg-[#0a7c3a] text-white px-8 py-2.5 rounded-full text-base font-semibold hover:bg-[#086731] transition-colors whitespace-nowrap shrink-0"
          >
            Tìm kiếm
          </button>
        </form>

        {/* Right Nav Items */}
        <div className="flex items-center space-x-8 text-base font-semibold text-white">
          <button 
            onClick={() => {
              if (user) {
                navigate('/my-tickets');
              } else {
                toast.error('Vui lòng đăng nhập để xem vé của bạn!');
                navigate('/login');
              }
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
              
              {/* Dropdown Logout */}
              {/* Thêm một lớp phủ h-4 để chống gián đoạn khi di chuột và căn giữa bằng left-1/2 -translate-x-1/2 */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-white text-gray-800 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-100 p-2 flex flex-col before:content-[''] before:absolute before:-top-4 before:left-0 before:w-full before:h-4">
                <Link to="/profile" className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-100 rounded-lg transition-colors text-[15px] font-medium text-gray-700">
                  <User size={20} strokeWidth={2.5} className="text-gray-600" />
                  <span>Tài khoản của tôi</span>
                </Link>

                <Link to="/my-tickets" className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-100 rounded-lg transition-colors text-[15px] font-medium text-gray-700">
                  <Ticket size={20} strokeWidth={2.5} className="text-gray-600" />
                  <span>Vé của tôi</span>
                </Link>
                
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