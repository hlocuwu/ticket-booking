import { useState, useContext, useEffect } from 'react';
import { User, Lock, Camera, Eye, EyeOff } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, setUser } = useContext(AuthContext);

  const [profileData, setProfileData] = useState({
    fullName: '',
    phone: '',
    email: '',
    dob: '',
    gender: '',
    avatar: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        fullName: user.fullName && user.fullName !== 'Người dùng' ? user.fullName : '',
        phone: user.phone || '',
        email: user.email || '',
        dob: user.dob || '',
        gender: user.gender || '',
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${user.username || 'User'}&background=2ecc71&color=fff`
      }));
    }
  }, [user]);

  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const menuItems = [
    { id: 'profile', label: 'Thông tin tài khoản', icon: User },
    { id: 'password', label: 'Đổi mật khẩu', icon: Lock },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenderChange = (gender) => {
    setProfileData((prev) => ({ ...prev, gender }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast.error('Dung lượng hình ảnh không được vượt quá 1MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData((prev) => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('Mật khẩu mới không khớp!');
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }
    setIsSaving(true);
    try {
      await authService.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      toast.success('Đổi mật khẩu thành công!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Đổi mật khẩu thất bại!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await authService.updateProfile(profileData);
      const updatedUser = await authService.getProfile();
      setUser(updatedUser);
      toast.success('Lưu thông tin thành công!');
    } catch (err) {
      console.error(err);
      toast.error('Lưu thất bại! Bạn thử lại xem sao.');
    } finally {
      setIsSaving(false);
    }
  };

  // Shared input classes
  const inputClass = "w-full px-4 py-3 rounded-xl border border-[#454756] bg-[#1b1c21] focus:border-[#2ecc71] focus:ring-2 focus:ring-[#2ecc71]/20 outline-none transition-all text-white placeholder-gray-500";
  const labelClass = "block text-sm font-semibold text-gray-400 mb-2";

  return (
    <div className="min-h-screen bg-[#1b1c21] py-8 md:py-12 text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">

          {/* SIDEBAR */}
          <div className="w-full md:w-1/4">
            <div className="bg-[#31333e] rounded-2xl border border-[#454756] overflow-hidden sticky top-28">
              {/* Avatar Header */}
              <div className="p-6 text-center border-b border-[#454756] hidden md:block">
                <img
                  src={profileData.avatar}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-[#2ecc71]/30 shadow-md mb-3"
                />
                <h3 className="font-bold text-white">{profileData.fullName || user?.username || 'Chưa cập nhật tên'}</h3>
                <p className="text-gray-500 text-xs mt-1">Thành viên FlashTicket</p>
              </div>

              <div className="flex flex-row md:flex-col py-2 overflow-x-auto md:overflow-visible">
                {menuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-3 px-6 py-4 text-left font-semibold transition-all relative whitespace-nowrap md:whitespace-normal ${
                        isActive
                          ? 'text-[#2ecc71] bg-[#2ecc71]/10'
                          : 'text-gray-400 hover:bg-[#2a2c36] hover:text-[#2ecc71]'
                      }`}
                    >
                      {isActive && <div className="hidden md:block absolute left-0 top-0 bottom-0 w-1 bg-[#2ecc71] rounded-r-md" />}
                      {isActive && <div className="md:hidden absolute left-4 right-4 bottom-0 h-1 bg-[#2ecc71] rounded-t-md" />}
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[#2ecc71]' : 'text-gray-500'} />
                      <span className="text-[15px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="w-full md:w-3/4">
            <div className="bg-[#31333e] rounded-2xl border border-[#454756] p-6 md:p-8">

              {/* ===== TAB: PROFILE ===== */}
              {activeTab === 'profile' && (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Hồ sơ của tôi</h2>
                    <p className="text-gray-400 text-[15px]">Quản lý thông tin hồ sơ để bảo mật tài khoản</p>
                  </div>
                  <hr className="border-[#454756] mb-8" />

                  <div className="flex flex-col md:flex-row gap-10 items-start">
                    {/* Form Fields */}
                    <div className="w-full md:w-2/3 order-2 md:order-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        <div className="col-span-1 md:col-span-2">
                          <label className={labelClass}>Họ và tên</label>
                          <input
                            type="text"
                            name="fullName"
                            value={profileData.fullName}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="Nhập họ và tên"
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Số điện thoại</label>
                          <input
                            type="tel"
                            name="phone"
                            value={profileData.phone}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="Nhập số điện thoại"
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Email</label>
                          <input
                            type="email"
                            name="email"
                            value={profileData.email}
                            readOnly
                            className="w-full px-4 py-3 rounded-xl border border-[#454756] bg-[#2a2c36] text-gray-500 font-medium outline-none cursor-not-allowed"
                          />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                          <label className={labelClass}>Ngày sinh</label>
                          <input
                            type="date"
                            name="dob"
                            value={profileData.dob}
                            onChange={handleChange}
                            className={`${inputClass} w-full md:w-1/2`}
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                          <label className={labelClass}>Giới tính</label>
                          <div className="flex items-center gap-3">
                            {['Nam', 'Nữ', 'Khác'].map(g => (
                              <button
                                key={g}
                                onClick={() => handleGenderChange(g)}
                                className={`px-8 py-2.5 rounded-full text-[15px] font-semibold transition-all ${
                                  profileData.gender === g
                                    ? 'bg-[#2ecc71] text-white shadow-md shadow-[#2ecc71]/20 border-transparent'
                                    : 'bg-[#2a2c36] border border-[#454756] text-gray-400 hover:border-[#2ecc71] hover:text-[#2ecc71]'
                                }`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>

                      <div className="mt-8 pt-6">
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="bg-[#2ecc71] text-white px-10 py-3.5 rounded-xl font-bold text-[15px] hover:bg-[#27ae60] hover:shadow-lg hover:shadow-[#2ecc71]/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                        >
                          {isSaving ? 'Đang xử lý...' : 'Lưu thay đổi'}
                        </button>
                      </div>
                    </div>

                    {/* Avatar Side */}
                    <div className="w-full md:w-1/3 order-1 md:order-2 flex flex-col items-center justify-start border-b md:border-b-0 md:border-l border-[#454756] pb-8 md:pb-0 md:h-full">
                      <div className="relative group cursor-pointer mt-4">
                        <div className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-[#454756] shadow-lg">
                          <img
                            src={profileData.avatar}
                            alt="Profile Avatar"
                            className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                          />
                        </div>
                        <label htmlFor="avatarUpload" className="absolute bottom-1 right-1 w-10 h-10 bg-[#31333e] rounded-full flex items-center justify-center shadow-lg border border-[#454756] text-gray-400 hover:text-[#2ecc71] hover:border-[#2ecc71] transition-all z-10 cursor-pointer">
                          <Camera size={18} />
                          <input
                            type="file"
                            id="avatarUpload"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={handleAvatarChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <div className="mt-5 text-center">
                        <p className="text-sm font-semibold text-gray-400">Dung lượng file tối đa 1 MB</p>
                        <p className="text-xs text-gray-500 mt-1">Định dạng: .JPEG, .PNG</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ===== TAB: PASSWORD ===== */}
              {activeTab === 'password' && (
                <div className="w-full md:w-2/3">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Đổi mật khẩu</h2>
                    <p className="text-gray-400 text-[15px]">Vui lòng không chia sẻ mật khẩu cho người khác</p>
                  </div>
                  <hr className="border-[#454756] mb-8" />

                  <form onSubmit={handlePasswordChange} className="space-y-6">
                    <div>
                      <label className={labelClass}>Mật khẩu hiện tại</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwords.currentPassword}
                          onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                          className={`${inputClass} pr-12`}
                          placeholder="Nhập mật khẩu hiện tại"
                          required
                        />
                        <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#2ecc71] transition-colors">
                          {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Mật khẩu mới</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwords.newPassword}
                          onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                          className={`${inputClass} pr-12`}
                          placeholder="Nhập mật khẩu mới"
                          required
                          minLength="6"
                        />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#2ecc71] transition-colors">
                          {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Xác nhận mật khẩu mới</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwords.confirmPassword}
                          onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                          className={`${inputClass} pr-12`}
                          placeholder="Nhập lại mật khẩu mới"
                          required
                          minLength="6"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#2ecc71] transition-colors">
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-[#2ecc71] text-white px-10 py-3.5 rounded-xl font-bold text-[15px] hover:bg-[#27ae60] hover:shadow-lg hover:shadow-[#2ecc71]/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                      >
                        {isSaving ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
