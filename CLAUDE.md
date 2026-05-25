# CLAUDE.md — sisfo_hns Project Context

> **Status**: 🟡 In Development — Sync Sheets ✅, Sync to Woo ⏳ (mapping coverage ~22%)
> **Last Updated**: 22 Mei 2026
> **Owner**: Kelvin (HNS IT Center, Batam)

---

## 📌 Quick Context (BACA INI DULU!)

Sistem Informasi Inventory HNS IT Center — **React + Supabase** dengan fitur auto-sync harga ke WooCommerce (WordPress staging: `https://dev.hnsitcenter.id`, production: `hnsitcenter.id`).

**Masalah utama yang sedang dipecahkan**: PIC update harga di app internal → masih harus **manual copy-paste** ke WordPress. Tujuan akhir: **auto-sync**.

---

## 🏗️ Stack

| Layer             | Tech                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| **Frontend**      | React 19, Supabase JS v2, jsPDF, recharts, sweetalert2, html5-qrcode |
| **Backend**       | Supabase (PostgreSQL + Edge Functions Deno)                          |
| **Sync Target**   | WooCommerce REST API (credentials di `.env.local`)                   |
| **Dev server**    | proxy: `http://localhost:5000` (lihat `package.json`)                |
| **WP Staging**    | `https://dev.hnsitcenter.id`                                         |
| **WP Production** | `https://hnsitcenter.id`                                             |

---

## 👥 Role System

### Routing Saat Ini (App.js:32)

| Role                             | Komponen        | Status                 |
| -------------------------------- | --------------- | ---------------------- |
| `administrator` / `admin_gudang` | `Dashboard.js`  | ✅ Routed              |
| `sales_toko`                     | `SalesPage.js`  | ✅ Routed              |
| `sales_dealer`                   | `DealerPage.js` | ✅ Routed              |
| `pic`                            | `PicPage.js`    | ❌ **BELUM di-route!** |

> ⚠️ **Gap**: `PicPage.js` sudah dibuat tapi belum ada case `"pic"` di `switch(user.role)` di `src/App.js:42`. Ini blocker utama.

### Struktur Tim PIC (3 Orang, 3 Kategori)

PIC dibagi berdasarkan kategori produk:

| PIC                      | Kategori yang Di-Handle                                               | Catatan                      |
| ------------------------ | --------------------------------------------------------------------- | ---------------------------- |
| **PIC Komponen**         | VGA, RAM, SSD, HDD, Processor, Motherboard, PSU, Cooling, Casing, dll | Komponen PC                  |
| **PIC Laptop & Printer** | Laptop, Printer, Toner/Laser                                          | 3 kategori digabung ke 1 PIC |
| **PIC Aksesoris**        | Mouse, Keyboard, Headset, Speaker, Kabel, Webcam, Mic, dll            | Item kecil & aksesoris       |

> **Implikasi teknis**: Tabel `users` perlu kolom `kategori_pic` (array of TEXT atau JSONB). PicPage harus filter produk berdasarkan kategori PIC yang login. RLS/permission membatasi edit di luar kategori sendiri.

---

## 🗃️ Database Schema (Supabase)

### Tabel Existing (Production — Jangan Diubah Struktur!)

| Tabel             | Kolom Penting                                                                                                 | Fungsi                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `products`        | `"Kode Accurate"` (PK), `"NAMA BARANG"`, `CP`, `SP`, `PRICE`, `"TANGGAL UPDATE"`, `kategori`, `brand`, `stok` | Master produk + harga                                       |
| `stock_locations` | lokasi gudang, stok per lokasi                                                                                | Stok multi-cabang                                           |
| `users`           | `username`, `password`, `role`, `name`, `location`                                                            | Auth manual (BUKAN Supabase Auth), disimpan di localStorage |

### Tabel WooCommerce Sync (Migration: `20260518111300_add_woo_sync_tables.sql`)

| Tabel/View                      | Fungsi                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `product_woo_mapping`           | Mapping `kode_accurate` ↔ `woo_product_id`. Support multi-kode case (1 Woo product = N kode Accurate, format SKU: `"kode1 / kode2"`) |
| `sync_log`                      | Audit log semua operasi sync ke WooCommerce                                                                                          |
| `woo_config`                    | Toggle & konfigurasi sync (auto_sync_enabled, base_url, batch_size, dll)                                                             |
| View `products_with_woo_status` | Gabungan products + status mapping + last sync info                                                                                  |

### Tabel yang Perlu Ditambah/Diubah (PENDING)

- [ ] `users.kategori_pic` (TEXT[] atau JSONB) — untuk pembatasan kategori PIC
- [ ] Atau: tabel baru `user_categories` (many-to-many: 1 user bisa multi kategori)

---

## 🔑 Credentials & Secrets

### `.env.local` (di root, JANGAN commit!)

```env
# Supabase
REACT_APP_SUPABASE_URL=https://hptfudqtrnyeqcqhhaeh.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_PROJECT_REF=hptfudqtrnyeqcqhhaeh

# WooCommerce
WOO_CONSUMER_KEY=ck_xxx...
WOO_CONSUMER_SECRET=cs_xxx...
WOO_BASE_URL=https://hnsitcenter.id
WP_STAGING_URL=https://dev.hnsitcenter.id
```

### Supabase Secrets (Edge Functions)

Sudah di-set via `supabase secrets set`:

- ✅ `WOO_CONSUMER_KEY`
- ✅ `WOO_CONSUMER_SECRET`
- ✅ `WOO_BASE_URL`
- ✅ `GOOGLE_SERVICE_ACCOUNT_JSON` (service account: sync-acc-web@refined-sum-468008-c3.iam.gserviceaccount.com)
- ✅ `GOOGLE_SHEET_ID` (1Y71apt1eLrXRySexuEnKqdtUDqmtx-kLWTqFDufn7qU)

---

## 📊 Progress Tracker

### ✅ SELESAI

#### Frontend

- [x] `Login.js`, `App.js`, `supabaseClient.js`, `DashboardHelpers.js`
- [x] `Dashboard.js` (administrator, admin_gudang)
- [x] `SalesPage.js` (sales_toko)
- [x] `DealerPage.js` (sales_dealer) — ⚠️ ada pending changes (uncommitted)
- [x] `PicPage.js` (pic) — ⚠️ belum di-route!
- [x] `AdminGudangPage.js`
- [x] Modal: `StockMovementModal`, `DailyStockCheckModal`, `StockAlertsPanel`, `ImportModal`, `AddProductModal`, `EditForm`
- [x] `SalesMonitoringPage`

#### Backend / Tooling

- [x] Supabase CLI terinstall & ter-link ke project `hptfudqtrnyeqcqhhaeh`
- [x] Migration `20260518111300_add_woo_sync_tables.sql` (3 tabel + view + trigger)
- [x] Secrets WOO\_\* di-set di Supabase
- [x] Migration `20260519100000_woo_mapping_v2.sql` — 4 kolom baru + index + view update
- [x] Edge Function `build-woo-mapping` v2 (deployed) — 4-level smart matching + variation detection
- [x] Edge Function `sync-to-woo` (deployed) — sync kolom `SP` (SRP) ke WooCommerce
- [x] Edge Function `sync-from-sheets` (deployed) — sync 6023 produk dari Google Sheets MASTER_DATA ✅ 2026-05-20
- [x] Migration `20260519110000_woo_mapping_public_read.sql` ✅
- [x] Migration `20260519120000_add_sheets_config.sql` ✅
- [x] `woo_config`: `google_sheets_id` + `google_sheets_tab` = MASTER_DATA di-set ✅

#### Test Scripts

- [x] `generate-sql.js` — parse CSV pricelist → SQL INSERT ke `products`
- [x] `test-update-supabase.js` — test baca & update harga di Supabase
- [x] `test-wp-staging.js` — test koneksi & update harga di WP staging (`dev.hnsitcenter.id`)
- [x] `test-smart-match.js` — smart matching SKU Woo ↔ Kode Accurate, simpan ke `product_woo_mapping`

### ❌ BELUM SELESAI (Prioritas Atas → Bawah)

#### 🔴 BLOCKER 1: PIC Routing

- [x] `src/App.js:32` — tambah case `"pic": return <PicPage user={user} onLogout={handleLogout} />`
- [ ] Test login sebagai role `pic` → harus masuk ke `PicPage`

#### 🔴 BLOCKER 2: Pembatasan Kategori PIC

- [x] Tambah kolom `users.kategori_pic` (TEXT[]) — migration `20260518130000_add_kategori_pic_to_users.sql`
- [x] Migration SQL untuk schema change
- [x] Update `PicPage.js`: filter produk berdasarkan kategori PIC login
- [x] **Run migration** di Supabase: `supabase db push` ✅ 2026-05-18
- [ ] **Seed**: buka Supabase SQL Editor → sesuaikan username actual PIC → run query seed
- [ ] Update RLS / permission: PIC cuma bisa UPDATE produk di kategori sendiri (future)

#### 🟡 Edge Functions Logic

- [x] **`build-woo-mapping`** v2 — 4-level smart matching
  - [x] Level 1: SKU exact match (confidence 100)
  - [x] Level 2: SKU multi-kode / slash-separated (confidence 95)
  - [x] Level 3: Keyword match di nama produk (confidence 70-85)
  - [x] Level 4: WooCommerce variation detection by spec (confidence up to 90)
  - [x] `confidence_score`, `match_method`, `woo_variation_id`, `needs_review` columns
  - [x] **Deploy**: `supabase functions deploy build-woo-mapping --no-verify-jwt`
- [x] **`sync-to-woo`** — handler webhook DB
  - [x] Trigger by DB webhook saat UPDATE `products`
  - [x] Cek toggle `woo_config.auto_sync_enabled`
  - [x] Skip kalau SP (SRP) tidak berubah
  - [x] Cari `woo_product_id` dari mapping table
  - [x] Handle multi-kode case (1 Woo = N Supabase)
  - [x] Push harga ke WooCommerce REST API
  - [x] Log ke `sync_log` (success/error/skipped)
  - [x] **Deploy**: `supabase functions deploy sync-to-woo --no-verify-jwt`

#### 🟡 Database Webhook

- [ ] Setup Database Webhook di Supabase Dashboard
- [ ] Webhook trigger: `AFTER UPDATE` di tabel `products`
- [ ] Target URL: Edge Function `sync-to-woo`
- [ ] Conditional: hanya trigger kalau `PRICE`, `SP`, atau `CP` berubah

#### 🟢 UI Improvement (Setelah Sync Jalan)

- [ ] Kolom "Status Sync" di tabel produk Dashboard
- [ ] Tombol "Sync Now" manual per produk
- [ ] Halaman `SyncDashboard.js` untuk monitoring
- [ ] Pop-up warning untuk conflict pricing (kalau 2 kode di-link ke 1 Woo, harga beda)

### 🚧 IN PROGRESS (Git Modified, Uncommitted)

- `src/components/DealerPage.js` — ada perubahan
- `package-lock.json` — ada perubahan

---

## 📁 Key Files

```
sisfo_hns/
├── src/
│   ├── App.js                          # ⚠️ PERLU tambah route "pic"
│   └── components/
│       ├── supabaseClient.js           # Supabase client + helpers
│       ├── DashboardHelpers.js         # Shared styles & MultiSelect
│       ├── Login.js
│       ├── Dashboard.js                # Role: administrator, admin_gudang
│       ├── SalesPage.js                # Role: sales_toko
│       ├── DealerPage.js               # Role: sales_dealer ⚠️ pending changes
│       ├── PicPage.js                  # Role: pic ⚠️ BELUM di-route
│       ├── AdminGudangPage.js
│       ├── SalesMonitoringPage.js
│       ├── StockMovementModal.js
│       ├── DailyStockCheckModal.js
│       ├── StockAlertsPanel.js
│       ├── ImportModal.js
│       ├── AddProductModal.js
│       └── EditForm.js
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20260518111300_add_woo_sync_tables.sql
│   └── functions/
│       ├── build-woo-mapping/
│       │   └── index.ts                # ⚠️ PLACEHOLDER — port dari test-smart-match.js
│       └── sync-to-woo/
│           └── index.ts                # ⚠️ PLACEHOLDER — webhook handler
├── generate-sql.js                     # CSV → SQL converter
├── test-update-supabase.js             # Test Supabase CRUD
├── test-wp-staging.js                  # Test WooCommerce API
├── test-smart-match.js                 # Logic smart matching (reference)
├── .env.local                          # 🔒 JANGAN COMMIT
├── .gitignore
├── package.json
└── CLAUDE.md                           # File ini
```

---

## 🎯 Key Decisions

| Aspek               | Keputusan                                                      | Alasan                                                                                       |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Matching strategy   | **Match by SKU**, BUKAN by nama                                | Sync by nama pernah dicoba & gagal (banyak duplikat karena produk non-aktif punya nama sama) |
| Multi-kode          | Format SKU Woo: `"kode1 / kode2"` (dipisah slash)              | Sesuai praktik existing                                                                      |
| Stok sync           | **DITUNDA** (fokus harga dulu)                                 | Permintaan user, simpler untuk MVP                                                           |
| Auto vs manual sync | Auto trigger by DB webhook saat UPDATE                         | UX terbaik untuk PIC                                                                         |
| Pricing conflict    | Pop-up warning ke PIC                                          | Dalam praktik real, harga selalu sama (jarang konflik)                                       |
| Project Supabase    | 1 project unified (`hptfudqtrnyeqcqhhaeh`)                     | Menggantikan 2 project lama (HNS Gudang + HNS Update Harga)                                  |
| Auth                | Manual (tabel `users`, localStorage)                           | Existing, tidak diubah dulu (future: migrate ke Supabase Auth)                               |
| PIC kategori        | 3 PIC = 3 kategori (Komponen, Laptop+Printer+Laser, Aksesoris) | Sesuai struktur tim existing                                                                 |

---

## 🚀 Cara Run Project

### Prerequisites

- Node.js v16+
- Supabase CLI (`scoop install supabase` di Windows)
- Akses ke Supabase project `hptfudqtrnyeqcqhhaeh`
- File `.env.local` lengkap

### Development

```bash
# Install deps
npm install

# Run dev server (port 3000, proxy ke 5000)
npm start

# Deploy edge function
supabase functions deploy <function-name> --no-verify-jwt

# Push migration
supabase db push

# Test edge function
curl -X POST "https://hptfudqtrnyeqcqhhaeh.supabase.co/functions/v1/<function-name>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

### Test Scripts

```bash
node test-update-supabase.js     # Test CRUD Supabase
node test-wp-staging.js          # Test WP staging API
node test-smart-match.js         # Test smart SKU matching
node generate-sql.js             # Convert CSV → SQL
```

---

## ⚠️ Constraints & Safety Rules

### Untuk Developer / Agent AI

1. **JANGAN ALTER/DROP tabel existing** (`products`, `users`, `stock_locations`)
2. **JANGAN ubah file `src/`** tanpa diskusi (kecuali yang explicit di-task)
3. **JANGAN expose credentials** di output mana pun
4. **JANGAN auto-execute UPDATE/DELETE** tanpa user approval
5. **PASTIKAN `.env.local` di `.gitignore`**
6. **STOP & ASK** kalau:
   - Error tidak jelas
   - Butuh password database
   - Variable env ambigu
   - Migration konflik

### Untuk Sync Operations

1. **Selalu test di WP staging** (`dev.hnsitcenter.id`) dulu, bukan production
2. **Restore harga test** setelah testing
3. **Jangan test di produk best-seller**
4. **Backup data sebelum bulk operation**

---

## 🐛 Known Issues

| Issue                                                        | Severity    | Status                    |
| ------------------------------------------------------------ | ----------- | ------------------------- |
| PIC routing belum ada di App.js                              | 🔴 Critical | TODO                      |
| Pembatasan kategori PIC belum implement                      | 🔴 Critical | TODO                      |
| Mapping coverage rendah (~22%): 1.338/6.023+ produk          | 🔴 Critical | Perlu re-run + investigasi |
| Kode 2512xxxxxx & 2601xxxxxx banyak yang tidak ter-mapping   | 🟡 Medium   | Perlu manual mapping / re-run build-woo-mapping |
| Auth pakai password plaintext di tabel `users`               | 🟡 Medium   | Future improvement        |
| Inline styling di Dashboard banyak                           | 🟢 Low      | Future refactor           |

---

## 📜 Decision Log

### 2026-05-15

- Setup foundation dimulai

### 2026-05-16

- Pilih: 1 project Supabase unified
- Stok sync ditunda, fokus harga dulu
- Pop-up warning untuk pricing conflict

### 2026-05-17

- Phase 1-7 selesai (tabel, secrets, edge functions deployed)
- WP staging confirmed: `dev.hnsitcenter.id`
- Test scripts dibuat (`test-smart-match.js`, `test-wp-staging.js`, dll)

### 2026-05-18

- Struktur PIC clarified: 3 orang, 3 kategori (Komponen, Laptop+Printer+Laser, Aksesoris)
- Gap discovered: PicPage.js belum di-route di App.js
- Migration `20260518111300_add_woo_sync_tables.sql` applied
- App.js: route `"pic"` → PicPage.js ditambahkan ✅
- Migration `20260518130000_add_kategori_pic_to_users.sql` dibuat ✅
- PicPage.js: filter produk by `kategori_pic` + badge kategori di header ✅
- Edge Function `build-woo-mapping`: logic lengkap (port dari test-smart-match.js) ✅
- Edge Function `sync-to-woo`: webhook handler lengkap + sync_log ✅
- Sisa: deploy functions + run migration + seed + setup DB webhook + end-to-end test

### 2026-05-19

- Smart Matching v2 implemented: 4-level algo (SKU exact, SKU multi, keyword name, variation detection)
- Migration `20260519100000_woo_mapping_v2.sql`: tambah `confidence_score`, `match_method`, `woo_variation_id`, `needs_review` ke `product_woo_mapping`
- View `products_with_woo_status` di-update untuk include kolom baru + `mapping_status='mapped_review'`
- Edge Function `build-woo-mapping` v2 siap deploy

### 2026-05-20

- Google Service Account JSON di-set sebagai Supabase secret (`GOOGLE_SERVICE_ACCOUNT_JSON`)
- `GOOGLE_SHEET_ID` di-set (sheet Accurate: tab MASTER_DATA, 6023 produk)
- Migration `20260519110000` + `20260519120000` applied ✅
- Edge Function `sync-from-sheets` deployed & tested: 6023 produk sync OK, 0 error ✅
- Edge Function `sync-to-woo` di-fix: sync kolom **SP** (SRP) bukan PRICE ke WooCommerce
- PicPage.js label diperbaiki: SP = "SRP / HARGA WEB", PRICE = "HARGA JUAL DEALER"
- File credentials (`GOOGLE_SERVICE_ACCOUNT_JSON`) ditambah ke `.gitignore`
- Sisa: setup DB webhook di Supabase Dashboard + seed kategori_pic + end-to-end test

### 2026-05-22

- **Diagnosis sync issue**: Semua sync_log `skipped` — root cause: kode yang di-edit PIC tidak ada di `product_woo_mapping`
- Mapping coverage rendah: hanya 1.338 dari 6.023+ produk (~22%) berhasil di-mapping
- Kode `2512000245` (Canon Cartridge 810) & `2601000080` (Lenovo IdeaPad) = tidak ada di mapping
- **Bug fix** `sync-to-woo`: fallback default URL diubah dari `hnsitcenter.id` (production!) ke `dev.hnsitcenter.id` (staging) — mencegah sync tidak sengaja ke production ✅
- Edge Function `sync-to-woo` di-deploy ulang ✅
- `WOO_BASE_URL` secret perlu diverifikasi manual di Supabase Dashboard
- **Next**: re-run `build-woo-mapping` + investigasi kenapa banyak kode 2512/2601 tidak ter-mapping

---

## 🔮 Next Actions (Priority Order)

### Immediate — Manual Steps (Perlu dijalankan Kelvin)

1. **Deploy Edge Functions** (lihat Deployment Guide di bawah)
2. **Run migration** `kategori_pic` + seed username PIC
3. **Setup Database Webhook** di Supabase Dashboard
4. **End-to-end test**: update harga di app → cek WP staging ter-update otomatis

### Setelah Sync Jalan

5. **UI improvements**: status sync badge, tombol "Sync Now", `SyncDashboard.js`
6. **Production deployment**: ganti `WOO_BASE_URL` ke `hnsitcenter.id`
7. **User training** untuk 3 PIC

---

## 🚀 Deployment Guide (Step-by-Step)

> Jalankan semua perintah dari root folder project (`sisfo_hns/`).
> Pastikan `.env.local` sudah lengkap sebelum mulai.

---

### STEP 1 — Deploy Edge Functions

```bash
# Deploy build-woo-mapping
supabase functions deploy build-woo-mapping --no-verify-jwt

# Deploy sync-to-woo
supabase functions deploy sync-to-woo --no-verify-jwt
```

Verifikasi deploy berhasil:
```bash
# Harusnya return: {"status":"success", "woo_products_fetched": ...}
curl -X POST "https://hptfudqtrnyeqcqhhaeh.supabase.co/functions/v1/build-woo-mapping" \
  -H "Authorization: Bearer <REACT_APP_SUPABASE_ANON_KEY>"
```

---

### STEP 2 — Push Migration & Seed Kategori PIC

```bash
# Push migration tambah kolom kategori_pic ke tabel users
supabase db push
```

Setelah push, buka **Supabase Dashboard → SQL Editor**, jalankan seed berikut
(sesuaikan `username` dengan username actual user PIC di tabel `users`):

```sql
-- Ganti 'pic_komponen' dengan username actual
UPDATE users
SET kategori_pic = ARRAY['VGA','RAM','SSD','HDD','Processor','Motherboard','PSU','Cooling','Casing']
WHERE username = 'pic_komponen';

UPDATE users
SET kategori_pic = ARRAY['Laptop','Printer','Toner','Laser']
WHERE username = 'pic_laptop';

UPDATE users
SET kategori_pic = ARRAY['Mouse','Keyboard','Headset','Speaker','Kabel','Webcam','Mic']
WHERE username = 'pic_aksesoris';

-- Verifikasi
SELECT username, role, kategori_pic FROM users WHERE role = 'pic';
```

---

### STEP 3 — Jalankan build-woo-mapping (Sekali)

Ini akan fetch semua produk WooCommerce dan bangun tabel mapping.
Jalankan **setelah** STEP 1 selesai:

```bash
node test-smart-match.js
```

Atau via curl ke Edge Function yang sudah di-deploy (hasilnya sama):
```bash
curl -X POST "https://hptfudqtrnyeqcqhhaeh.supabase.co/functions/v1/build-woo-mapping" \
  -H "Authorization: Bearer <REACT_APP_SUPABASE_ANON_KEY>"
```

Cek hasilnya di **Supabase Dashboard → Table Editor → `product_woo_mapping`**.
Pastikan ada baris-baris mapping di sana.

---

### STEP 4 — Setup Database Webhook di Supabase Dashboard

Ini yang menghubungkan "PIC update harga" → "otomatis sync ke WooCommerce".

1. Buka **Supabase Dashboard** → `https://supabase.com/dashboard/project/hptfudqtrnyeqcqhhaeh`
2. Di sidebar kiri, klik **Database** → **Webhooks**
3. Klik tombol **"Create a new hook"**
4. Isi form:

   | Field | Value |
   |---|---|
   | **Name** | `sync-price-to-woo` |
   | **Table** | `products` |
   | **Events** | ✅ `UPDATE` saja (jangan centang INSERT/DELETE) |
   | **Type** | `HTTP Request` |
   | **Method** | `POST` |
   | **URL** | `https://hptfudqtrnyeqcqhhaeh.supabase.co/functions/v1/sync-to-woo` |

5. Di bagian **HTTP Headers**, klik "Add a new header":

   | Header | Value |
   |---|---|
   | `Content-Type` | `application/json` |
   | `Authorization` | `Bearer <REACT_APP_SUPABASE_ANON_KEY>` |

6. Klik **Confirm** / **Save**

> ⚠️ **Tidak ada filter kolom** di UI Supabase Webhook — function `sync-to-woo` sudah handle ini secara internal: kalau `PRICE` tidak berubah, function langsung return `skipped` tanpa push ke Woo.

---

### STEP 5 — Aktifkan Auto Sync

Di **Supabase Dashboard → SQL Editor**:

```sql
UPDATE woo_config SET value = 'true' WHERE key = 'auto_sync_enabled';
```

---

### STEP 6 — End-to-End Test

1. Login sebagai PIC di app (`npm start`)
2. Update harga salah satu produk yang sudah ada di `product_woo_mapping`
3. Tunggu ~3-5 detik
4. Cek di WordPress Staging (`dev.hnsitcenter.id`) — harga produk harus sudah berubah
5. Cek log di **Supabase → Table Editor → `sync_log`** — harus ada baris baru `status = 'success'`

---

### STEP 7 — Switch ke Production (Kalau Staging OK)

Di **Supabase Dashboard → Edge Functions → Secrets**:

```
WOO_BASE_URL = https://hnsitcenter.id
```

Ganti nilainya dari `https://dev.hnsitcenter.id` ke production. Tidak perlu deploy ulang.

---

## 💡 Notes untuk Agent AI

Kalau kamu agent AI (Claude Code, Antigravity, dll) baru bantu project ini:

1. **Baca CLAUDE.md ini lengkap dulu** sebelum eksekusi apapun
2. **Cek "Progress Tracker"** — hindari kerjain yang udah done
3. **Hormati "Constraints & Safety Rules"** — terutama jangan ubah tabel existing
4. **Kalau ragu, tanya user** — jangan asumsi
5. **Update CLAUDE.md ini** kalau ada milestone baru:
   - Tambah entry di "Decision Log" dengan tanggal & keputusan
   - Update checkbox di "Progress Tracker" dari `[ ]` jadi `[x]`
   - Pindahin item dari "BELUM SELESAI" ke "SELESAI" kalau udah done

### Saat Kerja di File `src/App.js`

```javascript
// Tambah case "pic" di switch statement App.js:32
case "pic":
  return <PicPage user={user} onLogout={handleLogout} />;
```

### Saat Implementasi Edge Function

Referensi logic ada di:

- `test-smart-match.js` → untuk `build-woo-mapping`
- `test-wp-staging.js` → untuk `sync-to-woo`

Port ke Deno (Edge Functions runtime). Pakai env var dari `Deno.env.get()`.

---

**Selamat bekerja! 🚀**
