-- Migration: Add kategori_pic to users
-- Purpose: Membatasi PIC hanya bisa edit produk di kategori yang dia handle
-- Safety: ADD COLUMN only, tidak mengubah struktur existing

ALTER TABLE users
ADD COLUMN IF NOT EXISTS kategori_pic TEXT[] DEFAULT '{}';

-- ============================================
-- SEED: Assign kategori ke masing-masing PIC
-- Ganti username sesuai username actual di database!
-- ============================================

-- Contoh seed (uncomment & sesuaikan username):
-- UPDATE users SET kategori_pic = ARRAY['VGA','RAM','SSD','HDD','Processor','Motherboard','PSU','Cooling','Casing']
--   WHERE username = 'pic_komponen';

-- UPDATE users SET kategori_pic = ARRAY['Laptop','Printer','Toner','Laser']
--   WHERE username = 'pic_laptop';

-- UPDATE users SET kategori_pic = ARRAY['Mouse','Keyboard','Headset','Speaker','Kabel','Webcam','Mic']
--   WHERE username = 'pic_aksesoris';
