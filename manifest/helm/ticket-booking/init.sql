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
    time VARCHAR(100),
    date DATE NOT NULL,
    location VARCHAR(255) NOT NULL,
    address TEXT,
    total_spaces INT NOT NULL,
    image_url TEXT,
    map_url TEXT,
    description TEXT,
    category VARCHAR(50) DEFAULT 'Khác'
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
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id VARCHAR(50),
    CONSTRAINT fk_event_ticket FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_zone FOREIGN KEY (zone_id) REFERENCES event_zones(id) ON DELETE CASCADE
);

-- Indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_tickets_event_id        ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_owner_id        ON tickets(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_event_reserved  ON tickets(event_id, is_reserved);
CREATE INDEX IF NOT EXISTS idx_tickets_owner_confirmed ON tickets(owner_id, is_confirmed) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_zones_event_id    ON event_zones(event_id);
CREATE INDEX IF NOT EXISTS idx_events_category         ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_date             ON events(date);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM events LIMIT 1) THEN
    RAISE NOTICE 'Seed data already exists, skipping.';
    RETURN;
  END IF;

INSERT INTO events (name, time, date, location, address, total_spaces, image_url, map_url, description, category) VALUES
('Hài kịch: Đảo Hoa Hậu', '20:00 - 22:30', '2026-11-20', 'Nhà hát Bến Thành', 'Số 6 Mạc Đĩnh Chi, Phường Bến Nghé, Quận 1, TP.HCM', 1000, 'https://cdn.tienphong.vn/images/9cdd1123343e89ccd66818037b692298c784abb547c4696f70edd89fbdf07bc28a95ab6a95af6ecc1370b5b790cab0219bd0bce37b89e4f5191445172449cae6e1ea4bd39c695733b513a3985dfeb63f/62bad85461b0a7d60fbd7e365a2cf6e9.jpg', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80', 'Vở kịch "Đảo Hoa Hậu" là vở kịch quy tụ nhiều nghệ sĩ hài nổi tiếng mang lại tiếng cười cho gia đình bạn trong dịp cuối tuần. Với các tình tiết bất ngờ và sâu sắc, vở kịch hứa hẹn sẽ mang đến một trải nghiệm đáng nhớ.', 'Nghệ thuật'),
('CHUNG KẾT ĐẤU TRƯỜNG DANH VỌNG MÙA XUÂN 2026', '14:00 - 21:00', '2026-05-10', 'Nhà Thi Đấu Đa Năng Quảng Ninh', 'Phường Hồng Hải, TP Hạ Long, Tỉnh Quảng Ninh', 1000, 'https://salt.tkbcdn.com/ts/ds/a5/52/2c/ffc572a433c8ca5054c623f32ebd9733.jpg', 'https://salt.tkbcdn.com/ts/ds/36/5b/5f/6113856a4facdf02a1f11d4b6babd456.jpg', 'Chung Kết Quốc Gia - ĐTDV Mùa Xuân 2026 - nơi chiến địa tái hiện "Bình Nguyên Vô Tận" ngoài đời thực sẽ chính thức diễn ra vào ngày 10/05 tại Nhà thi đấu đa năng Quảng Ninh cùng sân khấu công nghệ 3D Mapping siêu khủng!', 'eSports'),
('Lion Championship 30 - 2026', '18:00 - 22:00', '2026-05-09', 'Nhà thi đấu Tây Hồ', '101 Xuân La, Quận Tây Hồ, Hà Nội', 1000, 'https://salt.tkbcdn.com/ts/ds/81/ef/bb/35cdf7f9ce25b178d5abdcadba2a5bdb.jpg', '/lion_map.jpg', 'Giải Vô địch Sư tử lần thứ 30 năm 2026.', 'Thể thao'),
('Sân Khấu Thế Giới Trẻ: Escape Room - Căn Nhà Ma Quái', '20:00 - 22:30', '2026-05-01', 'Sân Khấu Thế Giới Trẻ', '125 Cống Quỳnh, Phường Nguyễn Cư Trinh, Quận 1, TP.HCM', 1000, 'https://salt.tkbcdn.com/ts/ds/c7/5b/e5/a2f0217df7df81125cd65ba319d89894.jpg', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87', 'ESCAPE ROOM - CĂN NHÀ MA QUÁI với sự tham gia của các nghệ sĩ : Tiểu Bảo Quốc, Gia Bảo, Anh Đức, Thuận Nguyễn, Minh Dự, Hữu Đằng, Lâm Nguyễn, Phạm Yến.', 'Nghệ thuật'),
('VBA STAR X 2025 | PlayOff2 - Home Game of Nha Trang Dolphins', '19:00 - 21:00', '2026-05-09', 'Nhà thi đấu tỉnh Khánh Hoà', '33 Yersin, Phường Vạn Thắng, TP Nha Trang, Tỉnh Khánh Hòa', 1000, 'https://salt.tkbcdn.com/ts/ds/5b/00/3a/7d406d9eaf4ab08649baf826ea7754d0.jpg', 'https://salt.tkbcdn.com/ts/ds/fd/a2/98/efd1759ecd90f1a68ea9c05331d38893.jpg', 'VBA StarX - Nơi quy tụ những ngôi sao. Với thông điệp VƯƠN TẦM KHÔNG GIỚI HẠN, VBA StarX hứa hẹn mang đến một mùa giải đẳng cấp cho cộng đồng người hâm mộ bóng rổ Việt Nam.', 'Thể thao'),
('VIETNAM COLLEGIATE BASKETBALL CHAMPIONSHIP 2025 - 2026', '13:00 - 18:00', '2026-05-17', 'Cung thiếu nhi Hà Nội', 'Phạm Hùng, Phường Cầu Giấy, Hà Nội', 1000, 'https://salt.tkbcdn.com/ts/ds/ca/3a/69/b7f0645cdbfecb2552850fab14c225a6.jpg', '/lion_map.jpg', 'Giải đấu bóng rổ sinh viên Việt Nam - VCBC là sân chơi giữa các trường ĐH, CĐ, Học viện cấp độ sinh viên.', 'Thể thao'),
('V-League: Hà Nội vs SHB Đà Nẵng', '19:15 - 21:15', '2026-05-01', 'Sân vận động Hàng Đẫy', 'Trịnh Hoài Đức, Cát Linh, Quận Đống Đa, Hà Nội', 1000, 'https://images2.thanhnien.vn/528068263637045248/2026/4/30/img2281-17775647883031998521231.jpeg', '/hangday_map.jpg', 'Trận đấu V-League giữa Hà Nội FC và SHB Đà Nẵng tại sân Hàng Đẫy.', 'Thể thao'),
('ĐẤU TRƯỜNG HỖN CHIẾN MÙA 3', '10:00 - 18:00', '2026-05-20', 'Nhà thi đấu Nguyễn Du', '116 Nguyễn Du, Phường Bến Thành, Quận 1, TP.HCM', 1000, 'https://salt.tkbcdn.com/ts/ds/ac/9d/06/2e296e2c69c4b19e077057468546b94b.png', '/lion_map.jpg', 'Giải đấu eSports hỗn chiến mùa 3 với sự tham gia của các đội tuyển hàng đầu.', 'eSports'),
('Hanoi Pro-Am Basketball Championship 2026', '14:00 - 20:00', '2026-03-1', 'Nhà thi đấu Phường Cầu Giấy', 'Số 35 Trần Quý Kiên, Quận Cầu Giấy, Hà Nội', 1000, 'https://salt.tkbcdn.com/ts/ds/7f/66/cc/fb7e3ff3e6c96e8aceed9b4a875222f8.jpg', '/lion_map.jpg', 'Giải bóng rổ Pro-Am Hà Nội 2026.', 'Thể thao'),
('VCT Pacific Stage 1 Finals: Ho Chi Minh', '16:00 - 22:00', '2026-12-25', 'ThiskyHall', 'Khu B, Tầng 5, Trung tâm Thương mại Thiso Mall Sala, Quận 2, TP.HCM', 2000, 'https://salt.tkbcdn.com/ts/ds/f8/6d/54/d75d33d72359ba2f1a6da0fca5be44fa.png', '/vct_map.png', 'Lần đầu tiên giải đấu eSports quốc tế Valorant Champions Tour cấp khu vực Pacific đặt chân tới Việt Nam.', 'eSports');

-- Zones cho Hài kịch: Đảo Hoa Hậu
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
(1, 'VIP', 200, 1000000, 'Khu vực hạng A, ghế giữa gần sân khấu'),
(1, 'Standard 1', 400, 500000, 'Khu vực tầng trệt'),
(1, 'Standard 2', 400, 350000, 'Khu vực tầng lầu');

-- Zones cho CHUNG KẾT ĐẤU TRƯỜNG DANH VỌNG MÙA XUÂN 2026
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
(2, 'Công tước Norman', 100, 5000000, 'Khu vực Công tước Norman'),
(2, 'Tháp Quang Minh', 200, 2500000, 'Khu vực Tháp Quang Minh'),
(2, 'Vực Hỗn Mang', 200, 199000, 'Khu vực Vực Hỗn Mang'),
(2, 'Rừng Nguyên Sinh', 200, 199000, 'Khu vực Rừng Nguyên Sinh'),
(2, 'Đảo Sương Mù', 300, 79000, 'Khu vực Đảo Sương Mù');

-- Zones cho Lion Championship 30-2026
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
(3, 'A2', 120, 350000, 'Khu vực A2'),
(3, 'A3', 120, 350000, 'Khu vực A3'),
(3, 'B2', 120, 350000, 'Khu vực B2'),
(3, 'B3', 120, 350000, 'Khu vực B3'),
(3, 'S1', 110, 600000, 'Khu vực S1'),
(3, 'S2', 110, 600000, 'Khu vực S2'),
(3, 'B1', 100, 800000, 'Khu vực B1'),
(3, 'SV1', 100, 1000000, 'Khu vực SV1'),
(3, 'SV2', 100, 1000000, 'Khu vực SV2');

-- Zones cho VBA STAR X 2025 | PlayOff2 - Home Game of Nha Trang Dolphins
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
(5, 'Courtside', 100, 900000, 'Khu vực Courtside'),
(5, 'Corporate Box', 100, 800000, 'Khu vực Corporate Box'),
(5, 'VIP', 100, 700000, 'Khu vực VIP'),
(5, 'Premium', 200, 350000, 'Khu vực Premium'),
(5, 'Standard', 250, 200000, 'Khu vực Standard'),
(5, 'Student', 250, 120000, 'Khu vực dành cho học sinh - sinh viên');

-- Zones cho VIETNAM COLLEGIATE BASKETBALL CHAMPIONSHIP 2025 - 2026
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
(6, 'Standard', 1000, 0, 'Khu vực Standard');

-- Zones cho VCT Pacific
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
-- TIER S
(10, 'TIER S - ZONE C', 200, 1299000, 'Khu vực hạng S'),
(10, 'TIER S - ZONE K', 200, 1299000, 'Khu vực hạng S'),
(10, 'TIER S - ZONE N', 200, 1299000, 'Khu vực hạng S'),
(10, 'TIER S - ZONE B', 200, 1299000, 'Khu vực hạng S'),
(10, 'TIER S - ZONE G', 200, 1299000, 'Khu vực hạng S'),
(10, 'TIER S - ZONE O', 200, 1299000, 'Khu vực hạng S'),
-- WHEELCHAIR
(10, 'WHEELCHAIR - TIER A - ZONE O', 50, 779000, 'Khu vực dành cho người đi xe lăn'),
(10, 'WHEELCHAIR - TIER A - ZONE N', 50, 779000, 'Khu vực dành cho người đi xe lăn'),
-- TIER A
(10, 'TIER A - ZONE B', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE G', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE J', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE O', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE A', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE H', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE I', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE P', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE C', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE F', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE K', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE N', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE D', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE E', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE L', 300, 779000, 'Khu vực hạng A'),
(10, 'TIER A - ZONE M', 300, 779000, 'Khu vực hạng A'),
-- TIER B
(10, 'TIER B - ZONE B', 400, 399000, 'Khu vực hạng B'),
(10, 'TIER B - ZONE A', 400, 399000, 'Khu vực hạng B'),
(10, 'TIER B - ZONE H', 400, 399000, 'Khu vực hạng B'),
(10, 'TIER B - ZONE I', 400, 399000, 'Khu vực hạng B'),
(10, 'TIER B - ZONE P', 400, 399000, 'Khu vực hạng B'),
(10, 'TIER B - ZONE D', 400, 399000, 'Khu vực hạng B'),
(10, 'TIER B - ZONE E', 400, 399000, 'Khu vực hạng B'),
(10, 'TIER B - ZONE L', 400, 399000, 'Khu vực hạng B'),
(10, 'TIER B - ZONE M', 400, 399000, 'Khu vực hạng B');

-- Seed vé cụ thể cho từng khu dựa trên capacity (Dynamic Ticket Generation)
INSERT INTO tickets (event_id, zone_id, seat_name, is_reserved)
SELECT 
    ez.event_id,
    ez.id as zone_id,
    ez.name || '-' || gs.num AS seat_name,
    FALSE
FROM event_zones ez
CROSS JOIN generate_series(1, ez.capacity) AS gs(num);

END $$;

