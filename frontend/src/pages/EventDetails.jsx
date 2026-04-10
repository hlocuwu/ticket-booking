import { useEffect, useState, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventApi, queueApi, inventoryApi, bookingApi } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { Clock, Calendar, MapPin, Users, Ticket, CheckCircle, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  
  const [queueStatus, setQueueStatus] = useState('NOT_JOINED'); // NOT_JOINED, IN_QUEUE, TURN_ARRIVED
  const [queuePosition, setQueuePosition] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [bookingTicketId, setBookingTicketId] = useState(null);
  
  const pollInterval = useRef(null);

  useEffect(() => {
    // Fetch Event Details
    eventApi.get(`/events/${id}`)
      .then(res => setEvent(res.data))
      .catch(err => toast.error('Failed to load event details'))
      .finally(() => setLoading(false));

    return () => clearInterval(pollInterval.current);
  }, [id]);

  useEffect(() => {
    if (queueStatus === 'TURN_ARRIVED') {
      fetchTickets();
    }
  }, [queueStatus]);

  const fetchTickets = () => {
    inventoryApi.get('/tickets')
      .then(res => {
        // Filter tickets for this event and not reserved
        const availableTickets = res.data.filter(t => t.event_id === Number(id) && !t.is_reserved);
        setTickets(availableTickets);
      })
      .catch(err => toast.error('Failed to fetch tickets'));
  };

  const joinQueue = async () => {
    if (!user) {
      toast.error('You must be logged in to book a ticket');
      navigate('/login');
      return;
    }
    
    try {
      await queueApi.post('/queue/join', { user_id: user.username });
      setQueueStatus('IN_QUEUE');
      toast.success('Joined the waiting room!');
      startPolling();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join queue');
    }
  };

  const startPolling = () => {
    pollInterval.current = setInterval(async () => {
      try {
        const res = await queueApi.get('/queue/status', { params: { user_id: user.username } });
        setQueuePosition(res.data.position);
        
        // Assuming position 1 2 3 corresponds to the front
        // As a simplified logic, if position <= 10 or specifically 1, they can buy
        // Let's assume ANY position can see tickets if they are in queue for now, or just position <= 5.
        // Waiting room logic often lets the first N people go.
        // Let's just say Position 1 is your turn.
        if (res.data.position === 1) {
          setQueueStatus('TURN_ARRIVED');
          clearInterval(pollInterval.current);
          toast.success('It is your turn! Select a ticket now.');
        }
      } catch (err) {
        clearInterval(pollInterval.current);
        if (err.response?.status === 404) {
             // User bumped or processed
        }
      }
    }, 5000);
  };

  const handleBook = async (ticketId) => {
    setBookingTicketId(ticketId);
    try {
      await bookingApi.post('/book', {
        user_id: user.username,
        ticket_id: ticketId
      });
      toast.success('Ticket successfully booked!');
      setTickets(prev => prev.filter(t => t.id !== ticketId)); // remove from list
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to book ticket');
      fetchTickets(); // Refresh list to see if it was taken by someone else
    } finally {
      setBookingTicketId(null);
    }
  };

  if (loading) return <div className="text-center mt-10">Loading...</div>;
  if (!event) return <div className="text-center mt-10 text-red-500">Event not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Event Header */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{event.name}</h1>
        <div className="flex flex-wrap gap-6 text-gray-600 font-medium">
          <div className="flex items-center"><Calendar className="mr-2 text-blue-600" /> {event.date}</div>
          <div className="flex items-center"><MapPin className="mr-2 text-red-500" /> {event.location}</div>
          <div className="flex items-center"><Users className="mr-2 text-green-500" /> Capacity: {event.total_spaces}</div>
        </div>
      </div>

      {/* Queue / Booking Area */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-8">
        {queueStatus === 'NOT_JOINED' && (
          <div className="text-center space-y-4">
            <Clock size={48} className="mx-auto text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">Tickets are on High Demand</h2>
            <p className="text-gray-600">Join the waiting room to secure your chance to buy tickets.</p>
            <button 
              onClick={joinQueue}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold text-lg transition-colors shadow-md hover:shadow-lg"
            >
              Join the Waiting Room
            </button>
          </div>
        )}

        {queueStatus === 'IN_QUEUE' && (
          <div className="text-center space-y-4">
            <RefreshCcw size={48} className="mx-auto text-blue-600 animate-spin mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">You are in the queue</h2>
            <p className="text-gray-600">Please wait. Don't refresh the page.</p>
            <div className="inline-block bg-white px-6 py-4 rounded-xl shadow mt-4">
              <span className="block text-sm text-gray-500 uppercase tracking-wide">Your Position</span>
              <span className="block text-5xl font-black text-blue-600 mt-1">{queuePosition ?? '--'}</span>
            </div>
          </div>
        )}

        {queueStatus === 'TURN_ARRIVED' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <CheckCircle className="text-green-500 mr-2" /> It's your turn!
              </h2>
              <button onClick={fetchTickets} className="text-sm font-semibold text-blue-600 hover:underline">
                Refresh Tickets
              </button>
            </div>
            
            {tickets.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-lg">
                <p className="text-gray-500">Sorry, no tickets available at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-blue-500 transition-colors group">
                    <Ticket className="mx-auto text-gray-400 group-hover:text-blue-500 mb-2" size={32} />
                    <div className="font-bold text-lg mb-4">{ticket.seat_name}</div>
                    <button
                      onClick={() => handleBook(ticket.id)}
                      disabled={bookingTicketId === ticket.id}
                      className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-2 rounded transition-colors disabled:opacity-50"
                    >
                      {bookingTicketId === ticket.id ? 'Booking...' : 'Book'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
