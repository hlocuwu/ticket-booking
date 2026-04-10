import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Ticket } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2 text-xl font-bold">
          <Ticket size={24} />
          <span>TicketMaster Pro</span>
        </Link>
        <div className="space-x-4">
          {user ? (
            <div className="flex items-center space-x-4">
              <span>Hello, {user.username}</span>
              <button onClick={logout} className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded">
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="hover:underline">Login</Link>
              <Link to="/register" className="bg-white text-blue-600 px-3 py-1 rounded font-semibold hover:bg-gray-100">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
