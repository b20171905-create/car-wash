-- Run once in Supabase SQL Editor for an existing database.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_vehicle_type_check;

UPDATE customers
SET vehicle_type = 'bike'
WHERE vehicle_type = 'motor_bike';

ALTER TABLE customers
  ADD CONSTRAINT customers_vehicle_type_check
  CHECK (vehicle_type IN ('bike', 'car', 'rikshaw', 'suv', 'coaster', 'truck') OR vehicle_type IS NULL);
