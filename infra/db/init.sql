CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL,
    seat_name VARCHAR(50) NOT NULL,
    is_reserved BOOLEAN DEFAULT FALSE
);

-- Insert some dummy tickets for two different events
INSERT INTO tickets (event_id, seat_name) VALUES 
(1, 'A1'), (1, 'A2'), (1, 'A3'),
(2, 'VIP-1'), (2, 'VIP-2');