import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Search, Ticket, User } from 'lucide-react';
import logo from '../assets/images/bg.svg';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);

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
        <div className="flex-1 max-w-[500px] xl:max-w-[600px] hidden md:flex items-center bg-white rounded-full p-1.5 shadow-sm">
          <div className="pl-4 flex items-center">
            <Search size={22} className="text-gray-500 shrink-0" />
          </div>
          <input 
            type="text" 
            placeholder="Bạn tìm gì hôm nay?" 
            className="w-full pl-3 pr-2 py-2.5 outline-none text-gray-800 placeholder-gray-500 text-base bg-transparent"
          />
          <button className="bg-[#0a7c3a] text-white px-8 py-2.5 rounded-full text-base font-semibold hover:bg-[#086731] transition-colors whitespace-nowrap shrink-0">
            Tìm kiếm
          </button>
        </div>

        {/* Right Nav Items */}
        <div className="flex items-center space-x-8 text-base font-semibold text-white">
          <Link to="/my-tickets" className="flex items-center gap-2.5 text-white hover:text-green-100 transition-colors">
            <Ticket size={24} />
            <span className="hidden sm:block text-base">Vé của tôi</span>
          </Link>

          {user ? (
            <div className="group relative cursor-pointer flex items-center gap-2.5 text-white hover:text-green-100 transition-colors py-2">
              <User size={24} />
              <span className="hidden sm:block text-base truncate max-w-[120px]">{user.username}</span>
              
              {/* Dropdown Logout */}
              <div className="absolute top-12 right-0 mt-2 w-40 bg-white text-gray-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-100 overflow-hidden">
                <button onClick={logout} className="block w-full text-left px-5 py-3 hover:bg-gray-50 text-red-600 font-semibold transition-colors">
                  Đăng xuất
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