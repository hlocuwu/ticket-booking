import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import EventDetails from './pages/EventDetails';
import Payment from './pages/Payment';
import PaymentCallback from './pages/PaymentCallback';
import Profile from './pages/Profile';
import MyTickets from './pages/MyTickets';
import Admin from './pages/Admin';
import ProtectedRoute from './components/common/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <div className="min-h-screen bg-[#1b1c21] flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<div className="max-w-7xl mx-auto px-4 py-8"><Login /></div>} />
          <Route path="/register" element={<div className="max-w-7xl mx-auto px-4 py-8"><Register /></div>} />
          <Route 
            path="/event/:id" 
            element={<div className="max-w-7xl mx-auto px-4 py-8"><EventDetails /></div>} 
          />
          
          <Route 
            path="/payment" 
            element={
              <ProtectedRoute>
                <div className="max-w-7xl mx-auto px-4 py-8"><Payment /></div>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/payment/callback" 
            element={
              <ProtectedRoute>
                <PaymentCallback />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/my-tickets" 
            element={
              <ProtectedRoute>
                <MyTickets />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected Routes (Chỉ cho phép truy cập khi đã Login) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <div className="max-w-7xl mx-auto px-4 py-8"><Profile /></div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
export default App;
//
