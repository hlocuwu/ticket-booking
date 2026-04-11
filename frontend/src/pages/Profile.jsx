import { useState, useContext, useEffect } from 'react';
import { User, History, Lock, Bell, Camera, Eye, EyeOff } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, setUser } = useContext(AuthContext);

  // Sử dụng state trống chờ dữ liệu từ user
  const [profileData, setProfileData] = useState({
    fullName: '',
    phone: '',
    email: '',
    dob: '',
    gender: '',
    avatar: ''
  });

  // Khi có dữ liệu user từ AuthContext, tự động đắp vào form
  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        fullName: user.fullName && user.fullName !== 'Người dùng' ? user.fullName : '',
        phone: user.phone || '',
        email: user.email || '',
        dob: user.dob || '',
        gender: user.gender || '',
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${user.username || 'User'}&background=random`
      }));
    }
  }, [user]);

  const [activeTab, setActiveTab] = useState('profile');

  // States for Password Change
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Danh sách menu Sidebar
  const menuItems = [
    { id: 'profile', label: 'Thông tin tài khoản', icon: User },
    { id: 'history', label: 'Lịch sử mua vé', icon: History },
    { id: 'password', label: 'Đổi mật khẩu', icon: Lock },
    { id: 'notifications', label: 'Cài đặt thông báo', icon: Bell },
  ];

  // Hàm xử lý nhập liệu text input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  // Hàm xử lý khi chọn giới tính (Pill Button)
  const handleGenderChange = (gender) => {
    setProfileData((prev) => ({ ...prev, gender }));
  };

  // Upload hình Avatar (Dạng Base64 cho đơn giản)
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

  // Hàm xử lý việc nhấn nút LƯU THAY ĐỔI
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

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Gửi cấu trúc data xuống Database (Golang)
      await authService.updateProfile(profileData);
      
      // 2. Refresh Context bằng cách getProfile lần nữa để Navbar tự up tên mới
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          
          {/* CỘT TRÁI: Sidebar Menu */}
          <div className="w-full md:w-1/4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-28">
              {/* Summary Profile Header inside Sidebar (tùy chọn) */}
              <div className="p-6 text-center border-b border-gray-50 hidden md:block">
                <img 
                  src={profileData.avatar} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-green-100 shadow-sm mb-3"
                />
                <h3 className="font-bold text-gray-800">{profileData.fullName || user?.username || 'Chưa cập nhật tên'}</h3>
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
                          ? 'text-[#00b14f] bg-green-50/50' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-[#00b14f]'
                      }`}
                    >
                      {/* Đường line xanh báo hiệu active (chỉ hiện trên Desktop dọc) */}
                      {isActive && (
                        <div className="hidden md:block absolute left-0 top-0 bottom-0 w-1 bg-[#00b14f] rounded-r-md"></div>
                      )}
                      {/* Đường line ngang active (trên Mobile ngang) */}
                      {isActive && (
                        <div className="md:hidden absolute left-4 right-4 bottom-0 h-1 bg-[#00b14f] rounded-t-md"></div>
                      )}
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[#00b14f]' : 'text-gray-400'} />
                      <span className="text-[15px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: Form Nội dung chính */}
          <div className="w-full md:w-3/4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              
              {activeTab === 'profile' && (
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Hồ sơ của tôi</h2>
                    <p className="text-gray-500 text-[15px]">Quản lý thông tin hồ sơ để bảo mật tài khoản</p>
                  </div>
                  <hr className="border-gray-100 mb-8" />

                  {/* Layout chia 2 phần: Form(Trái/Dưới) - Avatar(Phải/Trên) */}
                  <div className="flex flex-col md:flex-row gap-10 items-start">
                    
                    {/* Form Fields - flex order 2 in mobile, 1 in desktop */}
                    <div className="w-full md:w-2/3 order-2 md:order-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Họ và tên */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Họ và tên</label>
                          <input 
                            type="text" 
                            name="fullName"
                            value={profileData.fullName}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/20 outline-none transition-all text-gray-800"
                            placeholder="Nhập họ và tên"
                          />
                        </div>

                        {/* Số điện thoại */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Số điện thoại</label>
                          <input 
                            type="tel" 
                            name="phone"
                            value={profileData.phone}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/20 outline-none transition-all text-gray-800"
                            placeholder="Nhập số điện thoại"
                          />
                        </div>

                        {/* Email */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                          <input 
                            type="email" 
                            name="email"
                            value={profileData.email}
                            readOnly
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 font-medium outline-none cursor-not-allowed"
                          />
                        </div>

                        {/* Ngày sinh */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày sinh</label>
                          <input 
                            type="date" 
                            name="dob"
                            value={profileData.dob}
                            onChange={handleChange}
                            className="w-full md:w-1/2 px-4 py-3 rounded-xl border border-gray-300 focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/20 outline-none transition-all text-gray-800"
                          />
                        </div>

                        {/* Giới tính (Pill Buttons) */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-3">Giới tính</label>
                          <div className="flex items-center gap-3">
                            {['Nam', 'Nữ', 'Khác'].map(g => (
                              <button
                                key={g}
                                onClick={() => handleGenderChange(g)}
                                className={`px-8 py-2.5 rounded-full text-[15px] font-semibold transition-all ${
                                  profileData.gender === g
                                    ? 'bg-[#00b14f] text-white shadow-md shadow-green-200 border-transparent'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:border-[#00b14f] hover:text-[#00b14f]'
                                }`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>

                      {/* Nút lưu thay đổi */}
                      <div className="mt-8 pt-6">
                        <button 
                          onClick={handleSave} 
                          disabled={isSaving}
                          className="bg-[#00b14f] text-white px-10 py-3.5 rounded-xl font-bold text-[15px] hover:bg-[#009944] hover:shadow-lg hover:shadow-green-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                        >
                          {isSaving ? "Đang xử lý..." : "Lưu thay đổi"}
                        </button>
                      </div>
                    </div>

                    {/* Avatar Side - flex order 1 in mobile, 2 in desktop */}
                    <div className="w-full md:w-1/3 order-1 md:order-2 flex flex-col items-center justify-start border-b md:border-b-0 md:border-l border-gray-100 pb-8 md:pb-0 md:h-full">
                      <div className="relative group cursor-pointer mt-4">
                        <div className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-gray-50 shadow-md">
                          <img 
                            src={profileData.avatar} 
                            alt="Profile Avatar" 
                            className="w-full h-full object-cover group-hover:opacity-85 transition-opacity"
                          />
                        </div>
                        {/* Nút Camera thiết kế dạng label gắn kèm thẻ input */}
                        <label htmlFor="avatarUpload" className="absolute bottom-1 right-1 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 text-gray-600 hover:text-[#00b14f] hover:border-[#00b14f] transition-all z-10 cursor-pointer">
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
                        <p className="text-sm font-semibold text-gray-700">Dung lượng file tối đa 1 MB</p>
                        <p className="text-xs text-gray-500 mt-1">Định dạng: .JPEG, .PNG</p>
                      </div>
                    </div>

                  </div>
                </>
              )}

              {activeTab === 'password' && (
                <div className="w-full md:w-2/3">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Đổi mật khẩu</h2>
                    <p className="text-gray-500 text-[15px]">Vui lòng không chia sẻ mật khẩu cho người khác</p>
                  </div>
                  <hr className="border-gray-100 mb-8" />
                  
                  <form onSubmit={handlePasswordChange} className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu hiện tại</label>
                      <div className="relative">
                        <input 
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwords.currentPassword}
                          onChange={(e) => setPasswords({...passwords, currentPassword: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/20 outline-none transition-all text-gray-800 pr-12"
                          placeholder="Nhập mật khẩu hiện tại"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00b14f] transition-colors"
                        >
                          {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu mới</label>
                      <div className="relative">
                        <input 
                          type={showNewPassword ? "text" : "password"}
                          value={passwords.newPassword}
                          onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/20 outline-none transition-all text-gray-800 pr-12"
                          placeholder="Nhập mật khẩu mới"
                          required
                          minLength="6"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00b14f] transition-colors"
                        >
                          {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Xác nhận mật khẩu mới</label>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          value={passwords.confirmPassword}
                          onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/20 outline-none transition-all text-gray-800 pr-12"
                          placeholder="Nhập lại mật khẩu mới"
                          required
                          minLength="6"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00b14f] transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        type="submit"
                        disabled={isSaving}
                        className="bg-[#00b14f] text-white px-10 py-3.5 rounded-xl font-bold text-[15px] hover:bg-[#009944] hover:shadow-lg hover:shadow-green-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                      >
                        {isSaving ? "Đang xử lý..." : "Cập nhật mật khẩu"}
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
