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
('The Eras Tour - Local Edition', '2026-05-15', 'Stadium A', 5000, 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=600&q=80'),
('Tech Conference 2026', '2026-06-20', 'Convention Center', 1000, 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'),
('Indie Rock Night', '2026-07-05', 'Underground Club', 200, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80'),
('Sơn Tùng M-TP - Sky Tour', '2026-08-10', 'SVĐ Mỹ Đình', 40000, 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=600&q=80'),
('Rap Việt All-Star Concert', '2026-09-12', 'SECC TP.HCM', 15000, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80'),
('Tân Cổ Giao Duyên', '2026-10-20', 'Nhà Hát Bến Thành', 800, 'https://images.unsplash.com/photo-1533174000222-3580556eaaff?auto=format&fit=crop&w=600&q=80')
ON CONFLICT DO NOTHING;
);