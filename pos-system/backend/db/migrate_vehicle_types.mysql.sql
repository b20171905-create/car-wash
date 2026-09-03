-- MySQL-compatible migration for customer vehicle types.
-- Transforms old vehicle type values to standardized enum values.
-- Schema already defines the vehicle_type ENUM with proper values.

UPDATE customers
SET vehicle_type = 'bike'
WHERE vehicle_type = 'motor_bike';

ALTER TABLE services ADD COLUMN vehicle_type ENUM('all', 'bike', 'car', 'truck', 'rikshaw', 'coaster') NOT NULL DEFAULT 'all';
