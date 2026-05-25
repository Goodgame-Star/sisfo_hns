-- Migration: Allow frontend (anon key) to read WooCommerce sync tables
-- Tanpa ini, query dari React app tidak bisa baca product_woo_mapping

ALTER TABLE product_woo_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_select" ON product_woo_mapping;
CREATE POLICY "allow_select" ON product_woo_mapping FOR SELECT USING (true);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_select" ON sync_log;
CREATE POLICY "allow_select" ON sync_log FOR SELECT USING (true);

ALTER TABLE woo_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_select" ON woo_config;
CREATE POLICY "allow_select" ON woo_config FOR SELECT USING (true);
