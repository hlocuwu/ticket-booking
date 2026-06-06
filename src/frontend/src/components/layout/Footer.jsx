export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 text-gray-300 py-12 mt-16 text-sm">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 leading-loose">
        
        {/* Brand Info */}
        <div className="md:col-span-1">
          <h3 className="text-white text-2xl font-extrabold tracking-tight mb-4">FlashTicket</h3>
          <p className="mb-4 text-gray-400 pr-4">Hệ thống phân phối và đặt vé sự kiện, ca nhạc, hội thảo hàng đầu với công nghệ xếp hàng Queue tốc độ cao.</p>
          <p className="text-xs text-gray-500">© 2026 FlashTicket. All rights reserved.</p>
        </div>

        {/* Về chúng tôi */}
        <div>
          <h3 className="text-white font-bold mb-5 text-[15px] uppercase tracking-wide">Về Chùng Tôi</h3>
          <ul className="space-y-3">
            <li><a href="#" className="hover:text-[#00b14f] transition-colors">Giới thiệu FlashTicket</a></li>
            <li><a href="#" className="hover:text-[#00b14f] transition-colors">Tuyển dụng</a></li>
            <li><a href="#" className="hover:text-[#00b14f] transition-colors">Quy chế hoạt động</a></li>
            <li><a href="#" className="hover:text-[#00b14f] transition-colors">Điều khoản sử dụng</a></li>
          </ul>
        </div>

        {/* Dành cho khách hàng */}
        <div>
          <h3 className="text-white font-bold mb-5 text-[15px] uppercase tracking-wide">Khách Hàng</h3>
          <ul className="space-y-3">
            <li><a href="#" className="hover:text-[#00b14f] transition-colors">Hướng dẫn đặt vé</a></li>
            <li><a href="#" className="hover:text-[#00b14f] transition-colors">Câu hỏi thường gặp</a></li>
            <li><a href="#" className="hover:text-[#00b14f] transition-colors">Chính sách bảo mật</a></li>
            <li><a href="#" className="hover:text-[#00b14f] transition-colors">Gửi yêu cầu hỗ trợ</a></li>
          </ul>
        </div>

        {/* Liên hệ */}
        <div>
          <h3 className="text-white font-bold mb-5 text-[15px] uppercase tracking-wide">Liên Hệ</h3>
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="font-semibold text-gray-200 mr-2 min-w-[70px]">Hotline:</span>
              <a href="tel:19001234" className="text-[#00b14f] font-bold text-base hover:text-green-400">1900 1234</a>
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-gray-200 mr-2 min-w-[70px]">Email:</span>
              <a href="mailto:support@flashticket.vn" className="hover:text-[#00b14f] transition-colors">support@flashticket.vn</a>
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-gray-200 mr-2 min-w-[70px]">Địa chỉ:</span>
              <span>123 Đường Công Nghệ, Quận 1, TP. HCM</span>
            </li>
          </ul>
        </div>

      </div>
    </footer>
  );
}
