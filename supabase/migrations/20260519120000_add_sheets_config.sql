-- Migration: Tambah config untuk sync dari Google Sheets (Accurate)

INSERT INTO woo_config (key, value, description) VALUES
  ('google_sheets_id',     '', 'Google Spreadsheet ID untuk sync produk dari Accurate'),
  ('google_sheets_tab',    'Sheet1', 'Nama tab/sheet di spreadsheet'),
  ('last_sheets_sync_at',  '', 'Timestamp sync terakhir dari Google Sheets')
ON CONFLICT (key) DO NOTHING;
