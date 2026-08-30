-- MySQL-compatible migration for customer vehicle types.
-- This file is kept for compatibility; the enum values match the existing app logic.

ALTER TABLE customers
  MODIFY vehicle_type ENUM('bike', 'car', 'rikshaw', 'suv', 'coaster', 'truck');

UPDATE customers
SET vehicle_type = 'bike'
WHERE vehicle_type = 'motor_bike';
