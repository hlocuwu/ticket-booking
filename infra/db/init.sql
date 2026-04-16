CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    seat_name VARCHAR(50) NOT NULL,
    is_reserved BOOLEAN DEFAULT FALSE,
    owner_id VARCHAR(50)
);

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
    image_url TEXT
);

INSERT INTO events (name, date, location, total_spaces, image_url) VALUES
-- Hãy thay thế các dòng dưới đây bằng dữ liệu thật của bạn:
('Tên Sự Kiện Thật 1', '2026-11-20', 'Địa Điểm Thật 1', 2000, 'https://example.com/image1.jpg'),
('Tên Sự Kiện Thật 2', '2026-12-25', 'Địa Điểm Thật 2', 5000, 'https://example.com/image2.jpg');
);