import { useEffect, useState } from 'react';
import { eventApi } from '../api/client';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventApi.get('/events')
      .then(res => setEvents(res.data))
      .catch(err => {
        console.error(err);
        toast.error('Failed to load events');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center mt-10 text-gray-500">Loading events...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Upcoming Events</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map(event => (
          <div key={event.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-2 text-blue-900">{event.name}</h2>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex items-center"><Calendar size={16} className="mr-2"/> {event.date}</div>
                <div className="flex items-center"><MapPin size={16} className="mr-2"/> {event.location}</div>
                <div className="flex items-center"><Users size={16} className="mr-2"/> {event.total_spaces} spaces total</div>
              </div>
              <Link 
                to={`/events/${event.id}`}
                className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Book Tickets
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
