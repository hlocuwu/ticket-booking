-- Drop everything existing to ensure clean state on init
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS event_zones CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    dob DATE,
    gender VARCHAR(10),
    avatar TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    location VARCHAR(255) NOT NULL,
    total_spaces INT NOT NULL,
    image_url TEXT,
    map_url TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS event_zones (
    id SERIAL PRIMARY KEY,
    event_id INT,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    price INT NOT NULL,
    description TEXT,
    CONSTRAINT fk_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    zone_id INT,
    seat_name VARCHAR(50) NOT NULL,
    is_reserved BOOLEAN DEFAULT FALSE,
    owner_id VARCHAR(50),
    CONSTRAINT fk_event_ticket FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_zone FOREIGN KEY (zone_id) REFERENCES event_zones(id) ON DELETE CASCADE
);

INSERT INTO events (name, date, location, total_spaces, image_url, map_url, description) VALUES
('Hài kịch: Đảo Hoa Hậu', '2026-11-20', 'Nhà hát Bến Thành', 1000, 'https://cdn.tienphong.vn/images/9cdd1123343e89ccd66818037b692298c784abb547c4696f70edd89fbdf07bc28a95ab6a95af6ecc1370b5b790cab0219bd0bce37b89e4f5191445172449cae6e1ea4bd39c695733b513a3985dfeb63f/62bad85461b0a7d60fbd7e365a2cf6e9.jpg', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80', 'Vở kịch "Đảo Hoa Hậu" là vở kịch quy tụ nhiều nghệ sĩ hài nổi tiếng mang lại tiếng cười cho gia đình bạn trong dịp cuối tuần. Với các tình tiết bất ngờ và sâu sắc, vở kịch hứa hẹn sẽ mang đến một trải nghiệm đáng nhớ.'),
('CHUNG KẾT ĐẤU TRƯỜNG DANH VỌNG MÙA XUÂN 2026', '2026-05-10', 'Nhà Thi Đấu Đa Năng Quảng Ninh', 1000, 'https://salt.tkbcdn.com/ts/ds/a5/52/2c/ffc572a433c8ca5054c623f32ebd9733.jpg', '/vct_map.png', 'Chung Kết Quốc Gia - ĐTDV Mùa Xuân 2026 - nơi chiến địa tái hiện "Bình Nguyên Vô Tận" ngoài đời thực sẽ chính thức diễn ra vào ngày 10/05 tại Nhà thi đấu đa năng Quảng Ninh cùng sân khấu công nghệ 3D Mapping siêu khủng! Hứa hẹn sẽ mang tới những trải nghiệm thị giác mãn nhãn, đỉnh cao!! Không chỉ dừng lại ở trận Chung Kết đỉnh cao giữa 2 đội tuyển mạnh nhất Đấu Trường Danh Vọng hiện tại, chúng ta còn được chứng kiến một trận Chung Kết lịch sử khác - màn đại chiến đi tìm Vương miện danh giá của những bóng hồng Queens of Glory! Ngoài ra, khán giả tham dự sẽ được chiêu đãi bởi hàng loạt quyền lợi & quà tặng hấp dẫn đến từ “Bình Nguyên Vô Tận”!'),
('Lion Championship 30-2026', '2026-04-18', 'Nhà thi đấu Tây Hồ', 1000, 'https://salt.tkbcdn.com/ts/ds/81/ef/bb/35cdf7f9ce25b178d5abdcadba2a5bdb.jpg', '/lion_map.jpg', 'Giải Vô địch Sư tử lần thứ 30 năm 2026.'),
('Sân Khấu Thế Giới Trẻ: Escape Room - Căn Nhà Ma Quái', '2026-05-01', 'Sân Khấu Thế Giới Trẻ', 1000, 'https://salt.tkbcdn.com/ts/ds/c7/5b/e5/a2f0217df7df81125cd65ba319d89894.jpg', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87', 'ESCAPE ROOM - CĂN NHÀ MA QUÁI Tác Giả - Đạo Diễn : Gia Bảo Giám Đốc Sản Xuất : Trần Đại - An Thi Với sự tham gia của các nghệ sĩ : Tiểu Bảo Quốc, Gia Bảo, Anh Đức, Thuận Nguyễn, Minh Dự, Hữu Đằng, Lâm Nguyễn, Phạm Yến, ... và các bạn diễn viên trẻ.'),
('VBA STAR X 2025 | PlayOff2 - Home Game of Nha Trang Dolphins', '2026-05-09', 'Nhà thi đấu tỉnh Khánh Hoà', 1000, 'https://salt.tkbcdn.com/ts/ds/5b/00/3a/7d406d9eaf4ab08649baf826ea7754d0.jpg', '/lion_map.jpg', 'VBA StarX - Nơi quy tụ những ngôi sao đã chính thức khởi động. Với thông điệp “VƯƠN TẦM KHÔNG GIỚI HẠN”, VBA StarX hứa hẹn mang đến một mùa giải đẳng cấp, bùng nổ và ngập tràn trải nghiệm độc quyền cho cộng đồng người hâm mộ bóng rổ Việt Nam. Welcome to VBA StarX!'),
('VIETNAM COLLEGIATE BASKETBALL CHAMPIONSHIP 2025 - 2026', '2026-05-17', 'Cung thiếu nhi Hà Nội', 1000, 'https://salt.tkbcdn.com/ts/ds/ca/3a/69/b7f0645cdbfecb2552850fab14c225a6.jpg', '/lion_map.jpg', 'Giải đấu bóng rổ sinh viên Việt Nam - VCBC là một sân chơi với quy mô giữa các trường ĐH, CĐ, Học viện cấp độ sinh viên. Tới vòng Play-off miền Bắc, chỉ còn 2 đội nam và và 2 đội nữ thi đấu để chọn ra nhà vô địch, liệu đội tuyển nào sẽ vinh quang nâng cao chiếc cúp VCBC miền Bắc? Chi tiết sự kiện: Thể thức thi đấu: B.O.3 (Best of 3) Thời gian diễn ra vòng play-off: 15/4 - 17/4 - 19/4/2026 Địa điểm: Cung thiếu nhi Hà Nội, Phạm Hùng, Phường Cầu Giấy, Hà Nội'),
('V-League: Hà Nội vs Đà Nẵng', '2026-05-01', 'Sân vận động Hàng Đẫy', 1000, 'https://cdn.tienphong.vn/images/2c4e6cf200f5266a7d1c860b03a9e003b88f15e49754a482147326d9180bdb05c51867ba1500239942f8acb0fa0cfda2f55f4d4cf291e10c38303c5c973ba32b/ha-noi-vs-da-nang.jpg.avif', '/lion_map.jpg', 'Giải đấu bóng rổ sinh viên Việt Nam - VCBC là một sân chơi với quy mô giữa các trường ĐH, CĐ, Học viện cấp độ sinh viên. Tới vòng Play-off miền Bắc, chỉ còn 2 đội nam và và 2 đội nữ thi đấu để chọn ra nhà vô địch, liệu đội tuyển nào sẽ vinh quang nâng cao chiếc cúp VCBC miền Bắc? Chi tiết sự kiện: Thể thức thi đấu: B.O.3 (Best of 3) Thời gian diễn ra vòng play-off: 15/4 - 17/4 - 19/4/2026 Địa điểm: Cung thiếu nhi Hà Nội, Phạm Hùng, Phường Cầu Giấy, Hà Nội'),
('ĐẤU TRƯỜNG HỖN CHIẾN MÙA 3', '2026-05-20', 'Nhà thi đấu Nguyễn Du', 1000, 'https://salt.tkbcdn.com/ts/ds/ac/9d/06/2e296e2c69c4b19e077057468546b94b.png', '/lion_map.jpg', 'Giải đấu bóng rổ sinh viên Việt Nam - VCBC là một sân chơi với quy mô giữa các trường ĐH, CĐ, Học viện cấp độ sinh viên. Tới vòng Play-off miền Bắc, chỉ còn 2 đội nam và và 2 đội nữ thi đấu để chọn ra nhà vô địch, liệu đội tuyển nào sẽ vinh quang nâng cao chiếc cúp VCBC miền Bắc? Chi tiết sự kiện: Thể thức thi đấu: B.O.3 (Best of 3) Thời gian diễn ra vòng play-off: 15/4 - 17/4 - 19/4/2026 Địa điểm: Cung thiếu nhi Hà Nội, Phạm Hùng, Phường Cầu Giấy, Hà Nội'),
('Hanoi Pro-Am Basketball Championship 2026', '2026-03-1', 'Nhà thi đấu Phường Cầu Giấy', 1000, 'https://salt.tkbcdn.com/ts/ds/7f/66/cc/fb7e3ff3e6c96e8aceed9b4a875222f8.jpg', '/lion_map.jpg', 'Giải đấu bóng rổ sinh viên Việt Nam - VCBC là một sân chơi với quy mô giữa các trường ĐH, CĐ, Học viện cấp độ sinh viên. Tới vòng Play-off miền Bắc, chỉ còn 2 đội nam và và 2 đội nữ thi đấu để chọn ra nhà vô địch, liệu đội tuyển nào sẽ vinh quang nâng cao chiếc cúp VCBC miền Bắc? Chi tiết sự kiện: Thể thức thi đấu: B.O.3 (Best of 3) Thời gian diễn ra vòng play-off: 15/4 - 17/4 - 19/4/2026 Địa điểm: Cung thiếu nhi Hà Nội, Phạm Hùng, Phường Cầu Giấy, Hà Nội'),
('VCT Pacific Stage 1 Finals: Ho Chi Minh', '2026-12-25', 'ThiskyHall', 2000, 'https://salt.tkbcdn.com/ts/ds/f8/6d/54/d75d33d72359ba2f1a6da0fca5be44fa.png', '/vct_map.png', 'Lần đầu tiên giải đấu eSports quốc tế Valorant Champions Tour cấp khu vực Pacific đặt chân tới Việt Nam. Các đội tuyển hàng đầu sẽ tranh tài để giành tấm vé tới Master Mới. Bạn sẽ được chứng kiến những pha highlight đỉnh cao nhất trực tiếp tại nhà thi đấu!');


-- Zones cho Hài kịch: Đảo Hoa Hậu
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
(1, 'VIP', 200, 1000000, 'Khu vực hạng A, ghế giữa gần sân khấu'),
(1, 'Standard 1', 400, 500000, 'Khu vực tầng trệt'),
(1, 'Standard 2', 400, 350000, 'Khu vực tầng lầu');

-- Zones cho VCT Pacific
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
-- TIER S
(2, 'TIER S - ZONE C', 200, 1299000, 'Khu vực hạng S'),
(2, 'TIER S - ZONE K', 200, 1299000, 'Khu vực hạng S'),
(2, 'TIER S - ZONE N', 200, 1299000, 'Khu vực hạng S'),
(2, 'TIER S - ZONE B', 200, 1299000, 'Khu vực hạng S'),
(2, 'TIER S - ZONE G', 200, 1299000, 'Khu vực hạng S'),
(2, 'TIER S - ZONE O', 200, 1299000, 'Khu vực hạng S'),
-- WHEELCHAIR
(2, 'WHEELCHAIR - TIER A - ZONE O', 50, 779000, 'Khu vực dành cho người đi xe lăn'),
(2, 'WHEELCHAIR - TIER A - ZONE N', 50, 779000, 'Khu vực dành cho người đi xe lăn'),
-- TIER A
(2, 'TIER A - ZONE B', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE G', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE J', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE O', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE A', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE H', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE I', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE P', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE C', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE F', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE K', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE N', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE D', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE E', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE L', 300, 779000, 'Khu vực hạng A'),
(2, 'TIER A - ZONE M', 300, 779000, 'Khu vực hạng A'),
-- TIER B
(2, 'TIER B - ZONE B', 400, 399000, 'Khu vực hạng B'),
(2, 'TIER B - ZONE A', 400, 399000, 'Khu vực hạng B'),
(2, 'TIER B - ZONE H', 400, 399000, 'Khu vực hạng B'),
(2, 'TIER B - ZONE I', 400, 399000, 'Khu vực hạng B'),
(2, 'TIER B - ZONE P', 400, 399000, 'Khu vực hạng B'),
(2, 'TIER B - ZONE D', 400, 399000, 'Khu vực hạng B'),
(2, 'TIER B - ZONE E', 400, 399000, 'Khu vực hạng B'),
(2, 'TIER B - ZONE L', 400, 399000, 'Khu vực hạng B'),
(2, 'TIER B - ZONE M', 400, 399000, 'Khu vực hạng B');

-- Seed vé cụ thể cho từng khu dựa trên capacity (Dynamic Ticket Generation)
INSERT INTO tickets (event_id, zone_id, seat_name, is_reserved)
SELECT 
    ez.event_id,
    ez.id as zone_id,
    ez.name || '-' || gs.num AS seat_name,
    FALSE
FROM event_zones ez
CROSS JOIN generate_series(1, ez.capacity) AS gs(num);

