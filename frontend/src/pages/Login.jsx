import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await login(username, password);
    setIsSubmitting(false);
    if (success) navigate('/');
  };

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-xl shadow-md border border-gray-100">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-blue-100 text-blue-600 rounded-full mb-4">
          <LogIn size={24} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Welcome Back</h2>
        <p className="text-gray-500 mt-2">Log in to book your tickets</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
          <input
            type="text"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Logging in...' : 'Sign In'}
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-gray-600">
        Don't have an account? <Link to="/register" className="text-blue-600 hover:underline font-medium">Sign up</Link>
      </div>
    </div>
  );
}
