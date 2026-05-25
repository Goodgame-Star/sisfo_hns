-- Migration: Upgrade product_woo_mapping for v2 smart matching
-- Purpose: Add confidence_score, match_method, woo_variation_id, needs_review
-- Safety: ADD COLUMN IF NOT EXISTS only, tidak DROP atau ALTER tipe existing

ALTER TABLE product_woo_mapping
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS match_method TEXT DEFAULT 'sku_exact',
  ADD COLUMN IF NOT EXISTS woo_variation_id INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN product_woo_mapping.confidence_score IS
  '0-100. 100=SKU exact, 95=multi-kode, 75=keyword, 50=fuzzy, 0=manual';
COMMENT ON COLUMN product_woo_mapping.match_method IS
  'Cara matching: sku_exact, sku_multi, keyword_name, variation, manual';
COMMENT ON COLUMN product_woo_mapping.woo_variation_id IS
  'NULL untuk simple product. Filled untuk variable product variation.';
COMMENT ON COLUMN product_woo_mapping.needs_review IS
  'TRUE kalau confidence < 90, perlu manual review oleh PIC';

CREATE INDEX IF NOT EXISTS idx_woo_mapping_confidence
  ON product_woo_mapping(confidence_score);
CREATE INDEX IF NOT EXISTS idx_woo_mapping_needs_review
  ON product_woo_mapping(needs_review) WHERE needs_review = TRUE;

-- Update view to include new columns
-- DROP + CREATE karena PostgreSQL tidak izinkan sisipkan kolom baru di tengah via CREATE OR REPLACE
DROP VIEW IF EXISTS products_with_woo_status;
CREATE VIEW products_with_woo_status AS
SELECT
  p.*,
  pwm.woo_product_id,
  pwm.woo_sku_full,
  pwm.woo_name,
  pwm.woo_variation_id,
  pwm.confidence_score,
  pwm.match_method,
  pwm.needs_review,
  CASE
    WHEN pwm.woo_product_id IS NULL THEN 'not_mapped'
    WHEN pwm.needs_review = TRUE THEN 'mapped_review'
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
