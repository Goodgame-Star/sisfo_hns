// fix-mapping.js
// Cari woo_product_id berdasarkan SKU, lalu insert ke product_woo_mapping
require("dotenv").config({ path: ".env.local" });

const WP_URL = process.env.WP_STAGING_URL || "https://dev.hnsitcenter.id";
const CK = process.env.WOO_CONSUMER_KEY;
const CS = process.env.WOO_CONSUMER_SECRET;
const SUPABASE_URL = "https://hptfudqtrnyeqcqhhaeh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Kode-kode yang perlu di-fix (dari sync_log yang skipped)
const KODES_TO_FIX = ["2506000047", "2512000245", "2601000080"];

async function searchWooBySKU(sku) {
  // Coba search by SKU exact
  const url = `${WP_URL}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}&consumer_key=${CK}&consumer_secret=${CS}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`  ❌ WooCommerce API error: ${res.status}`);
    return null;
  }
  const products = await res.json();
  if (products && products.length > 0) return products[0];

  // Coba search by SKU yang mungkin mengandung kode ini (multi-kode format "kode1 / kode2")
  const url2 = `${WP_URL}/wp-json/wc/v3/products?search=${encodeURIComponent(sku)}&consumer_key=${CK}&consumer_secret=${CS}&per_page=5`;
  const res2 = await fetch(url2);
  if (!res2.ok) return null;
  const products2 = await res2.json();
  // Filter yang SKU-nya mengandung kode ini
  const matched = products2.filter(p => p.sku && p.sku.includes(sku));
  return matched.length > 0 ? matched[0] : null;
}

async function insertMapping(kode, wooProduct) {
  const payload = {
    kode_accurate: kode,
    woo_product_id: wooProduct.id,
    woo_sku_full: wooProduct.sku || null,
    woo_name: wooProduct.name,
    is_active: true,
    match_method: "manual_fix",
    confidence_score: 100,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_woo_mapping`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });

  if (res.ok || res.status === 201 || res.status === 200) {
    return true;
  }
  const err = await res.text();
  console.log(`  ❌ Supabase insert error: ${res.status} — ${err}`);
  return false;
}

async function main() {
  console.log("🔧 Fix Mapping Tool\n");
  console.log(`📡 WooCommerce: ${WP_URL}`);
  console.log(`📦 Kode yang akan di-fix: ${KODES_TO_FIX.join(", ")}\n`);

  if (!CK || !CS) {
    console.log("❌ WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET tidak ada di .env.local");
    return;
  }
  if (!SUPABASE_KEY) {
    console.log("❌ SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local");
    return;
  }

  for (const kode of KODES_TO_FIX) {
    console.log(`\n🔍 Mencari kode: ${kode}`);
    const wooProduct = await searchWooBySKU(kode);

    if (!wooProduct) {
      console.log(`  ⚠️  TIDAK DITEMUKAN di WooCommerce (SKU: ${kode})`);
      console.log(`  → Produk ini mungkin belum ada di WooCommerce staging`);
      continue;
    }

    console.log(`  ✅ Ditemukan!`);
    console.log(`     WooCommerce ID : ${wooProduct.id}`);
    console.log(`     SKU             : ${wooProduct.sku}`);
    console.log(`     Nama            : ${wooProduct.name}`);
    console.log(`     Harga saat ini  : Rp ${Number(wooProduct.regular_price || 0).toLocaleString("id-ID")}`);

    const ok = await insertMapping(kode, wooProduct);
    if (ok) {
      console.log(`  ✅ Mapping berhasil disimpan ke product_woo_mapping!`);
      console.log(`  → Sync berikutnya akan BERHASIL untuk kode ${kode}`);
    }
  }

  console.log("\n\n📊 Selesai! Sekarang coba edit harga lagi di PicPage.");
  console.log("   Cek sync_log di Supabase untuk melihat hasilnya.\n");
}

main().catch(console.error);
