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

INSERT INTO events (name, date, location, total_spaces, image_url, description) VALUES
('Hài kịch: Đảo Hoa Hậu', '2026-11-20', 'Nhà hát Bến Thành', 1000, 'https://cdn.tienphong.vn/images/9cdd1123343e89ccd66818037b692298c784abb547c4696f70edd89fbdf07bc28a95ab6a95af6ecc1370b5b790cab0219bd0bce37b89e4f5191445172449cae6e1ea4bd39c695733b513a3985dfeb63f/62bad85461b0a7d60fbd7e365a2cf6e9.jpg', 'Vở kịch "Đảo Hoa Hậu" là vở kịch quy tụ nhiều nghệ sĩ hài nổi tiếng mang lại tiếng cười cho gia đình bạn trong dịp cuối tuần. Với các tình tiết bất ngờ và sâu sắc, vở kịch hứa hẹn sẽ mang đến một trải nghiệm đáng nhớ.'),
('VCT Pacific Stage 1 Finals: Ho Chi Minh', '2026-12-25', 'ThiskyHall', 2000, 'https://vpesports.com/wp-content/uploads/2026/01/VCT-Pacific-Stage-1-Finals-2026-in-Ho-Chi-Minh-City.png', 'Lần đầu tiên giải đấu eSports quốc tế Valorant Champions Tour cấp khu vực Pacific đặt chân tới Việt Nam. Các đội tuyển hàng đầu sẽ tranh tài để giành tấm vé tới Master Mới. Bạn sẽ được chứng kiến những pha highlight đỉnh cao nhất trực tiếp tại nhà thi đấu!');

-- Zones cho Hài kịch: Đảo Hoa Hậu
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
(1, 'VIP', 200, 1000000, 'Khu vực hạng A, ghế giữa gần sân khấu'),
(1, 'Standard 1', 400, 500000, 'Khu vực tầng trệt'),
(1, 'Standard 2', 400, 350000, 'Khu vực tầng lầu');

-- Zones cho VCT Pacific
INSERT INTO event_zones (event_id, name, capacity, price, description) VALUES
(2, 'VVIP (Premium)', 300, 2000000, 'Ghế siêu gần, kèm merchandise độc quyền của VCT'),
(2, 'VIP', 500, 1200000, 'Khu vực góc giữa'),
(2, 'GA', 1200, 700000, 'Khu vực phổ thông 2 cánh');

-- Seed vé cụ thể cho từng khu dựa trên capacity (Dynamic Ticket Generation)
INSERT INTO tickets (event_id, zone_id, seat_name, is_reserved)
SELECT 
    ez.event_id,
    ez.id as zone_id,
    ez.name || '-' || gs.num AS seat_name,
    FALSE
FROM event_zones ez
CROSS JOIN generate_series(1, ez.capacity) AS gs(num);

