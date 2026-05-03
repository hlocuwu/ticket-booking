import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { eventApi } from '../services/apiClient';
import toast from 'react-hot-toast';
import {
  Plus, Edit2, Trash2, BarChart2, Calendar, MapPin, Tag,
  Ticket, TrendingUp, Search, X, ChevronRight, RefreshCw,
  LayoutDashboard, List, DollarSign, Users, Award
} from 'lucide-react';

const CATEGORIES = ['Thể thao', 'eSports', 'Nghệ thuật', 'Âm nhạc', 'Khác'];

const CATEGORY_COLORS = {
  'Thể thao': '#3b82f6',
  'eSports': '#8b5cf6',
  'Nghệ thuật': '#f59e0b',
  'Âm nhạc': '#ec4899',
  'Khác': '#6b7280',
};

function fmtMoney(n) {
  if (!n) return '0 đ';
  return n.toLocaleString('vi-VN') + ' đ';
}

function fmtShortName(name, max = 18) {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

// ── Simple bar chart (CSS/SVG, no deps) ──────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color = '#00b14f', formatVal }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="flex items-end gap-2 h-44 pt-4">
      {data.map((d, i) => {
        const pct = Math.max((d[valueKey] / max) * 100, 2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{ height: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {formatVal ? formatVal(d[valueKey]) : d[valueKey]}
            </div>
            <span className="text-[10px] text-gray-400 truncate w-full text-center leading-tight">
              {fmtShortName(d[labelKey], 12)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-[#23242a] rounded-2xl p-5 flex items-center gap-4 border border-white/5">
      <div className="p-3 rounded-xl" style={{ backgroundColor: color + '20' }}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Zone row in create form ───────────────────────────────────────────────────
function ZoneRow({ zone, idx, onChange, onRemove, canRemove }) {
  return (
    <div className="bg-[#1b1c21] rounded-xl p-4 border border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-300">Khu vực {idx + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-300 p-1">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Tên khu vực *</label>
          <input
            className="w-full bg-[#2d2e35] text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-[#00b14f] outline-none"
            placeholder="VIP, Standard..."
            value={zone.name}
            onChange={e => onChange({ ...zone, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Sức chứa *</label>
          <input
            type="number" min={1}
            className="w-full bg-[#2d2e35] text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-[#00b14f] outline-none"
            placeholder="100"
            value={zone.capacity}
            onChange={e => onChange({ ...zone, capacity: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Giá vé (đ) *</label>
          <input
            type="number" min={0}
            className="w-full bg-[#2d2e35] text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-[#00b14f] outline-none"
            placeholder="500000"
            value={zone.price}
            onChange={e => onChange({ ...zone, price: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Mô tả khu vực</label>
          <input
            className="w-full bg-[#2d2e35] text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-[#00b14f] outline-none"
            placeholder="Gần sân khấu..."
            value={zone.description}
            onChange={e => onChange({ ...zone, description: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Event form modal (add + edit) ─────────────────────────────────────────────
function EventModal({ event, onClose, onSave }) {
  const isEdit = Boolean(event?.id);
  const emptyZone = { name: '', capacity: 100, price: 0, description: '' };

  const [form, setForm] = useState({
    name: event?.name || '',
    time: event?.time || '',
    date: event?.date || '',
    location: event?.location || '',
    address: event?.address || '',
    image_url: event?.image_url || '',
    map_url: event?.map_url || '',
    description: event?.description || '',
    category: event?.category || 'Khác',
  });
  const [zones, setZones] = useState([{ ...emptyZone }]);
  const [saving, setSaving] = useState(false);

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.date || !form.location) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc (*)');
      return;
    }
    if (!isEdit && zones.some(z => !z.name || z.capacity < 1)) {
      toast.error('Mỗi khu vực phải có tên và sức chứa > 0');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await eventApi.put(`/events/${event.id}`, form);
        toast.success('Cập nhật sự kiện thành công!');
      } else {
        await eventApi.post('/events', { ...form, zones });
        toast.success('Tạo sự kiện thành công!');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#23242a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        <div className="sticky top-0 bg-[#23242a] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? '✏️ Chỉnh sửa sự kiện' : '➕ Thêm sự kiện mới'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Tên sự kiện *</label>
              <input {...field('name')} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none" placeholder="VCT Pacific Finals..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-300 mb-1 block">Ngày *</label>
                <input type="date" {...field('date')} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none" />
              </div>
              <div>
                <label className="text-sm text-gray-300 mb-1 block">Giờ</label>
                <input {...field('time')} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none" placeholder="19:00 - 22:00" />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-1 block">Địa điểm *</label>
              <input {...field('location')} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none" placeholder="Nhà thi đấu Quảng Ninh" />
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-1 block">Địa chỉ đầy đủ</label>
              <input {...field('address')} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none" placeholder="123 Đường ABC, Quận 1, TP.HCM" />
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-1 block">Thể loại</label>
              <select {...field('category')} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none">
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-1 block">URL ảnh bìa</label>
              <input {...field('image_url')} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none" placeholder="https://..." />
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-1 block">URL bản đồ sơ đồ</label>
              <input {...field('map_url')} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none" placeholder="https://..." />
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-1 block">Mô tả</label>
              <textarea {...field('description')} rows={3} className="w-full bg-[#1b1c21] text-white rounded-xl px-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none resize-none" placeholder="Mô tả chi tiết sự kiện..." />
            </div>
          </div>

          {/* Zones (create only) */}
          {!isEdit && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <MapPin size={16} className="text-[#00b14f]" />
                  Khu vực & Vé
                </h3>
                <button
                  type="button"
                  onClick={() => setZones(z => [...z, { ...emptyZone }])}
                  className="text-xs text-[#00b14f] hover:text-green-300 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#00b14f]/30 hover:bg-[#00b14f]/10 transition-colors"
                >
                  <Plus size={14} /> Thêm khu vực
                </button>
              </div>
              {zones.map((z, i) => (
                <ZoneRow
                  key={i} zone={z} idx={i}
                  onChange={updated => setZones(prev => prev.map((z2, j) => j === i ? updated : z2))}
                  onRemove={() => setZones(prev => prev.filter((_, j) => j !== i))}
                  canRemove={zones.length > 1}
                />
              ))}
              <p className="text-xs text-gray-500">
                Tổng sức chứa: <span className="text-white font-semibold">{zones.reduce((s, z) => s + (z.capacity || 0), 0).toLocaleString()}</span> vé
              </p>
            </div>
          )}

          {isEdit && (
            <p className="text-xs text-yellow-400/70 bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2">
              ⚠️ Chỉnh sửa sự kiện không thay đổi khu vực và vé đã tạo.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#00b14f] hover:bg-[#009940] text-white font-semibold transition-colors disabled:opacity-50">
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo sự kiện'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────
function DeleteDialog({ event, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const handle = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#23242a] rounded-2xl w-full max-w-sm p-6 border border-white/10 shadow-2xl text-center">
        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={28} className="text-red-400" />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">Xóa sự kiện?</h3>
        <p className="text-gray-400 text-sm mb-1">
          Bạn sắp xóa sự kiện:
        </p>
        <p className="text-white font-semibold mb-4">"{event.name}"</p>
        <p className="text-red-400/80 text-xs mb-6">
          ⚠️ Tất cả khu vực và vé liên quan sẽ bị xóa vĩnh viễn.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 transition-colors">
            Hủy
          </button>
          <button onClick={handle} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50">
            {deleting ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin page ───────────────────────────────────────────────────────────
export default function Admin() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Access guard
  useEffect(() => {
    if (user && user.username !== 'admin') {
      toast.error('Bạn không có quyền truy cập trang này');
      navigate('/');
    }
  }, [user, navigate]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventApi.get('/events');
      setEvents(res.data || []);
    } catch {
      toast.error('Không thể tải danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await eventApi.get('/admin/stats');
      setStats(res.data);
    } catch {
      toast.error('Không thể tải thống kê');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => {
    if (activeTab === 'stats') loadStats();
  }, [activeTab, loadStats]);

  const handleDelete = async () => {
    try {
      await eventApi.delete(`/events/${deleting.id}`);
      toast.success('Đã xóa sự kiện');
      setDeleting(null);
      loadEvents();
    } catch {
      toast.error('Xóa thất bại');
    }
  };

  const filtered = events.filter(ev =>
    ev.name.toLowerCase().includes(search.toLowerCase()) ||
    ev.location.toLowerCase().includes(search.toLowerCase())
  );

  // Stats helpers
  const top5Revenue = stats?.events?.slice(0, 5) || [];
  const top5Sold = [...(stats?.events || [])].sort((a, b) => b.sold_tickets - a.sold_tickets).slice(0, 5);

  if (user && user.username !== 'admin') return null;

  return (
    <div className="min-h-screen bg-[#1b1c21]">
      {/* Header */}
      <div className="bg-[#23242a] border-b border-white/10 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard size={26} className="text-[#00b14f]" />
              Trang quản trị
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">FlashTicket Admin Dashboard</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'events' && (
              <button
                onClick={() => { setShowAdd(true); }}
                className="flex items-center gap-2 bg-[#00b14f] hover:bg-[#009940] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                <Plus size={18} /> Thêm sự kiện
              </button>
            )}
            <button
              onClick={() => activeTab === 'events' ? loadEvents() : loadStats()}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Làm mới"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#23242a] border-b border-white/10 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { key: 'events', label: 'Quản lý sự kiện', icon: List },
            { key: 'stats', label: 'Thống kê', icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-[#00b14f] text-[#00b14f]'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── EVENTS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm kiếm sự kiện..."
                className="w-full bg-[#23242a] text-white rounded-xl pl-9 pr-4 py-2.5 border border-white/10 focus:border-[#00b14f] outline-none text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-20 text-gray-400">Đang tải...</div>
            ) : (
              <div className="bg-[#23242a] rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="text-left px-5 py-3.5 w-10">#</th>
                        <th className="text-left px-5 py-3.5">Tên sự kiện</th>
                        <th className="text-left px-5 py-3.5">Ngày</th>
                        <th className="text-left px-5 py-3.5">Địa điểm</th>
                        <th className="text-left px-5 py-3.5">Thể loại</th>
                        <th className="text-right px-5 py-3.5">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-16 text-gray-500">
                            {search ? 'Không tìm thấy sự kiện phù hợp' : 'Chưa có sự kiện nào'}
                          </td>
                        </tr>
                      ) : filtered.map(ev => (
                        <tr key={ev.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-5 py-4 text-gray-500">{ev.id}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {ev.image_url && (
                                <img src={ev.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-700" onError={e => { e.target.style.display = 'none'; }} />
                              )}
                              <div>
                                <p className="text-white font-medium leading-tight">{ev.name}</p>
                                <p className="text-gray-500 text-xs">{ev.time}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-300 whitespace-nowrap">
                            {ev.date ? new Date(ev.date).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td className="px-5 py-4 text-gray-300 max-w-[160px] truncate">{ev.location}</td>
                          <td className="px-5 py-4">
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={{
                                backgroundColor: (CATEGORY_COLORS[ev.category] || '#6b7280') + '20',
                                color: CATEGORY_COLORS[ev.category] || '#6b7280',
                              }}>
                              {ev.category}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditing(ev)}
                                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeleting(ev)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length > 0 && (
                  <div className="px-5 py-3 border-t border-white/5 text-xs text-gray-500">
                    {filtered.length} sự kiện{search ? ` (lọc từ ${events.length})` : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STATS TAB ──────────────────────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {statsLoading && !stats ? (
              <div className="text-center py-20 text-gray-400">Đang tải thống kê...</div>
            ) : stats ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={Calendar} label="Tổng sự kiện" value={stats.total_events} color="#00b14f" />
                  <StatCard icon={Ticket} label="Tổng vé" value={stats.total_tickets?.toLocaleString()} color="#3b82f6" />
                  <StatCard
                    icon={Users} label="Đã bán"
                    value={stats.total_sold?.toLocaleString()}
                    sub={`${stats.total_tickets > 0 ? Math.round((stats.total_sold / stats.total_tickets) * 100) : 0}% đã bán`}
                    color="#f59e0b"
                  />
                  <StatCard
                    icon={DollarSign} label="Doanh thu"
                    value={fmtMoney(stats.total_revenue)}
                    color="#ec4899"
                  />
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Revenue by event */}
                  <div className="bg-[#23242a] rounded-2xl p-6 border border-white/5">
                    <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                      <TrendingUp size={18} className="text-[#00b14f]" />
                      Doanh thu theo sự kiện (Top 5)
                    </h3>
                    <p className="text-gray-500 text-xs mb-4">Xếp hạng theo doanh thu từ vé đã thanh toán</p>
                    {top5Revenue.length > 0 ? (
                      <BarChart
                        data={top5Revenue}
                        valueKey="revenue"
                        labelKey="name"
                        color="#00b14f"
                        formatVal={fmtMoney}
                      />
                    ) : (
                      <div className="h-44 flex items-center justify-center text-gray-600 text-sm">Chưa có dữ liệu</div>
                    )}
                  </div>

                  {/* Sold tickets by event */}
                  <div className="bg-[#23242a] rounded-2xl p-6 border border-white/5">
                    <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                      <Ticket size={18} className="text-[#3b82f6]" />
                      Vé đã bán theo sự kiện (Top 5)
                    </h3>
                    <p className="text-gray-500 text-xs mb-4">Số lượng vé được xác nhận thanh toán</p>
                    {top5Sold.length > 0 ? (
                      <BarChart
                        data={top5Sold}
                        valueKey="sold_tickets"
                        labelKey="name"
                        color="#3b82f6"
                        formatVal={v => `${v} vé`}
                      />
                    ) : (
                      <div className="h-44 flex items-center justify-center text-gray-600 text-sm">Chưa có dữ liệu</div>
                    )}
                  </div>
                </div>

                {/* Category breakdown */}
                <div className="bg-[#23242a] rounded-2xl p-6 border border-white/5">
                  <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                    <Tag size={18} className="text-[#f59e0b]" />
                    Thống kê theo thể loại
                  </h3>
                  <p className="text-gray-500 text-xs mb-5">Số vé đã bán và tổng vé theo từng thể loại</p>

                  <div className="space-y-4">
                    {stats.categories?.map(cat => {
                      const pct = cat.total > 0 ? Math.round((cat.sold / cat.total) * 100) : 0;
                      const color = CATEGORY_COLORS[cat.category] || '#6b7280';
                      return (
                        <div key={cat.category}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-gray-300 text-sm font-medium">{cat.category}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-white text-sm font-semibold">{cat.sold.toLocaleString()}</span>
                              <span className="text-gray-500 text-xs"> / {cat.total.toLocaleString()} vé</span>
                              <span className="text-gray-500 text-xs ml-2">({pct}%)</span>
                            </div>
                          </div>
                          <div className="h-2 bg-[#1b1c21] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed event table */}
                <div className="bg-[#23242a] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                    <Award size={18} className="text-[#f59e0b]" />
                    <h3 className="text-white font-semibold">Chi tiết từng sự kiện</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                          <th className="text-left px-5 py-3.5">Sự kiện</th>
                          <th className="text-left px-5 py-3.5">Thể loại</th>
                          <th className="text-right px-5 py-3.5">Tổng vé</th>
                          <th className="text-right px-5 py-3.5">Đã bán</th>
                          <th className="text-right px-5 py-3.5">Doanh thu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.events?.map(ev => (
                            <tr key={ev.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="px-5 py-3.5 text-white font-medium max-w-[220px] truncate">{ev.name}</td>
                              <td className="px-5 py-3.5">
                                <span className="text-xs px-2.5 py-1 rounded-full"
                                  style={{
                                    backgroundColor: (CATEGORY_COLORS[ev.category] || '#6b7280') + '20',
                                    color: CATEGORY_COLORS[ev.category] || '#6b7280',
                                  }}>
                                  {ev.category}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right text-gray-300">{ev.total_tickets.toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-right text-green-400 font-medium">{ev.sold_tickets.toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-right text-white font-semibold">{fmtMoney(ev.revenue)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-gray-500">
                <button onClick={loadStats} className="text-[#00b14f] hover:underline">Tải thống kê</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <EventModal
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); loadEvents(); }}
        />
      )}
      {editing && (
        <EventModal
          event={editing}
          onClose={() => setEditing(null)}
          onSave={() => { setEditing(null); loadEvents(); }}
        />
      )}
      {deleting && (
        <DeleteDialog
          event={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
