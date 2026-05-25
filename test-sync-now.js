// test-sync-now.js
// Test: langsung push harga produk 2506000047 ke WooCommerce
// Ini simulasi apa yang dilakukan edge function sync-to-woo
require("dotenv").config({ path: ".env.local" });

const WP_URL = process.env.WP_STAGING_URL || "https://dev.hnsitcenter.id";
const CK = process.env.WOO_CONSUMER_KEY;
const CS = process.env.WOO_CONSUMER_SECRET;
const SUPABASE_URL = "https://hptfudqtrnyeqcqhhaeh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const kode = "2506000047";
  const wooId = 12285; // sudah kita tau dari fix-mapping.js

  console.log(`🔄 Test Sync Harga: ${kode} → WooCommerce ID ${wooId}\n`);

  // 1. Ambil harga SP terkini dari Supabase
  const spRes = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=SP,NAMA BARANG&Kode Accurate=eq.${kode}`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  // Pakai query yang benar dengan nama kolom ter-encode
  const spRes2 = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=%22SP%22%2C%22NAMA+BARANG%22&%22Kode+Accurate%22=eq.${kode}`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  let sp = null;
  if (spRes2.ok) {
    const rows = await spRes2.json();
    if (rows && rows.length > 0) {
      sp = rows[0]["SP"];
      console.log(`📦 Produk   : ${rows[0]["NAMA BARANG"]}`);
      console.log(`💰 SP di DB : Rp ${Number(sp).toLocaleString("id-ID")}`);
    }
  }

  // 2. Ambil harga saat ini di WooCommerce
  const wooRes = await fetch(
    `${WP_URL}/wp-json/wc/v3/products/${wooId}?consumer_key=${CK}&consumer_secret=${CS}`
  );
  const wooProduct = await wooRes.json();
  console.log(`💰 Harga WP saat ini : Rp ${Number(wooProduct.regular_price || 0).toLocaleString("id-ID")}`);

  if (!sp) {
    console.log("❌ Tidak bisa ambil SP dari Supabase, skip.");
    return;
  }

  const spNum = Number(sp);
  const wpNum = Number(wooProduct.regular_price || 0);

  if (spNum === wpNum) {
    console.log("\n✅ Harga sudah sama! Tidak perlu sync.");
    console.log("   Kalau mau test, ubah harga SP di PicPage lalu cek sync_log.");
    return;
  }

  // 3. Push harga ke WooCommerce
  console.log(`\n🚀 Push harga Rp ${spNum.toLocaleString("id-ID")} ke WooCommerce...`);
  const updateRes = await fetch(
    `${WP_URL}/wp-json/wc/v3/products/${wooId}?consumer_key=${CK}&consumer_secret=${CS}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regular_price: String(spNum) }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    console.log(`❌ WooCommerce error ${updateRes.status}:`, err.substring(0, 300));
    return;
  }

  const updated = await updateRes.json();
  console.log(`✅ Berhasil! Harga WooCommerce sekarang: Rp ${Number(updated.regular_price).toLocaleString("id-ID")}`);
  console.log(`\n🎉 Sync BERHASIL! Cek di https://dev.hnsitcenter.id (refresh halaman)`);
}

main().catch(console.error);
