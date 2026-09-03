-- Run once in Supabase SQL Editor for an existing database.
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_vehicle_type_check;

UPDATE customers
SET vehicle_type = 'bike'
WHERE vehicle_type = 'motor_bike';

ALTER TABLE customers
  ADD CONSTRAINT customers_vehicle_type_check
  CHECK (vehicle_type IN ('bike', 'car', 'rikshaw', 'suv', 'coaster', 'truck') OR vehicle_type IS NULL);

ALTER TABLE services ADD COLUMN IF NOT EXISTS vehicle_type TEXT NOT NULL DEFAULT 'all';
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_vehicle_type_check;
ALTER TABLE services ADD CONSTRAINT services_vehicle_type_check
  CHECK (vehicle_type IN ('all', 'bike', 'car', 'truck', 'rikshaw', 'coaster'));
