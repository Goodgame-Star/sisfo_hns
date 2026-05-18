-- Migration: WooCommerce Sync Foundation
-- Purpose: Tabel untuk mapping & log sync ke WooCommerce
-- Safety: Cuma CREATE IF NOT EXISTS, tidak ALTER/DROP tabel existing

-- ============================================
-- TABLE 1: product_woo_mapping
-- Mapping Kode Accurate (Supabase) ↔ WooCommerce Product ID
-- Support multi-kode case (1 Woo product = N Kode Accurate)
-- ============================================
CREATE TABLE IF NOT EXISTS product_woo_mapping (
  id SERIAL PRIMARY KEY,
  kode_accurate TEXT NOT NULL,
  woo_product_id INTEGER NOT NULL,
  woo_sku_full TEXT,
  woo_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kode_accurate, woo_product_id)
);

CREATE INDEX IF NOT EXISTS idx_woo_mapping_kode 
  ON product_woo_mapping(kode_accurate);
CREATE INDEX IF NOT EXISTS idx_woo_mapping_woo_id 
  ON product_woo_mapping(woo_product_id);

COMMENT ON TABLE product_woo_mapping IS 
  'Mapping Kode Accurate (Supabase) ke WooCommerce Product ID. Support multi-kode (1 Woo = N kode).';

-- ============================================
-- TABLE 2: sync_log
-- Audit log untuk semua operasi sync
-- ============================================
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  kode_accurate TEXT,
  woo_product_id INTEGER,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  old_value JSONB,
  new_value JSONB,
  error_detail TEXT,
  triggered_by UUID,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_kode ON sync_log(kode_accurate);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at DESC);

COMMENT ON TABLE sync_log IS 'Audit log untuk semua operasi sync ke WooCommerce.';

-- ============================================
-- TABLE 3: woo_config
-- Konfigurasi sync (toggle, base URL, dll)
-- ============================================
CREATE TABLE IF NOT EXISTS woo_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO woo_config (key, value, description) VALUES
  ('auto_sync_enabled', 'false', 'Toggle auto-sync on/off'),
  ('woo_base_url', 'https://dev.hnsitcenter.id', 'Base URL WooCommerce (staging)'),
  ('last_full_sync_at', '', 'Timestamp full sync terakhir'),
  ('sync_batch_size', '50', 'Jumlah produk per batch saat bulk sync')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- TRIGGER: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_woo_mapping_updated_at ON product_woo_mapping;
CREATE TRIGGER update_woo_mapping_updated_at
  BEFORE UPDATE ON product_woo_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEW: products_with_woo_status
-- Gabungan products + status mapping & sync
-- ============================================
CREATE OR REPLACE VIEW products_with_woo_status AS
SELECT 
  p.*,
  pwm.woo_product_id,
  pwm.woo_sku_full,
  pwm.woo_name,
  CASE 
    WHEN pwm.woo_product_id IS NULL THEN 'not_mapped'
    ELSE 'mapped'
  END AS mapping_status,
  (SELECT created_at FROM sync_log 
   WHERE kode_accurate = p."Kode Accurate" AND status = 'success'
   ORDER BY created_at DESC LIMIT 1) AS last_synced_at,
  (SELECT status FROM sync_log 
   WHERE kode_accurate = p."Kode Accurate"
   ORDER BY created_at DESC LIMIT 1) AS last_sync_status
FROM products p
LEFT JOIN product_woo_mapping pwm 
  ON p."Kode Accurate" = pwm.kode_accurate AND pwm.is_active = TRUE;
