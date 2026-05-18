require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://hptfudqtrnyeqcqhhaeh.supabase.co";
const SUPABASE_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdGZ1ZHF0cm55ZXFjcWhoYWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMDEwODAsImV4cCI6MjA4Mzc3NzA4MH0.z6_4osc9GZfpZcUUyj51t4dGP3MUjq8No-hH8p9mB9U";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const WP_URL = process.env.WP_STAGING_URL || "https://dev.hnsitcenter.id";
const CK = process.env.WOO_CONSUMER_KEY;
const CS = process.env.WOO_CONSUMER_SECRET;

async function fetchAllWooProducts() {
  let page = 1;
  let allProducts = [];
  let hasMore = true;

  console.log("📦 Mengambil data produk dari WooCommerce...");
  while (hasMore) {
    const url = `${WP_URL}/wp-json/wc/v3/products?per_page=100&page=${page}&consumer_key=${CK}&consumer_secret=${CS}`;
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`Gagal fetch Woo API page ${page}: ${res.statusText}`);
    const data = await res.json();

    if (data.length === 0) {
      hasMore = false;
    } else {
      allProducts.push(...data);
      process.stdout.write(`   ... ${allProducts.length} produk diambil\r`);
      page++;
    }
  }
  console.log(
    `\n✅ Selesai ambil ${allProducts.length} produk dari WooCommerce.`,
  );
  return allProducts;
}

async function fetchAllSupabaseProducts() {
  console.log("📦 Mengambil data produk dari Supabase...");
  const { data, error } = await supabase
    .from("products")
    .select('"Kode Accurate", "NAMA BARANG"');
  if (error) throw error;
  console.log(`✅ Selesai ambil ${data.length} produk dari Supabase.`);
  return data;
}

async function runSmartMatch() {
  try {
    const wooProducts = await fetchAllWooProducts();
    const sbProducts = await fetchAllSupabaseProducts();

    // 1. Buat Map untuk mempercepat pencarian berdasarkan Kode Accurate
    const sbMap = new Map();
    sbProducts.forEach((p) => {
      if (p["Kode Accurate"]) {
        sbMap.set(p["Kode Accurate"].trim().toUpperCase(), p);
      }
    });

    const mappings = [];
    let matchedWooCount = 0;

    console.log("\n🔍 Memulai Smart Matching...");

    wooProducts.forEach((woo) => {
      if (!woo.sku) return; // Skip barang tanpa SKU

      // Smart matching: pisahkan jika SKU pakai format "KODE1 / KODE2" atau "KODE1, KODE2"
      const skuParts = woo.sku
        .toUpperCase()
        .split(/[/,;|+]/)
        .map((s) => s.trim())
        .filter(Boolean);

      let isMatched = false;
      skuParts.forEach((skuCode) => {
        if (sbMap.has(skuCode)) {
          isMatched = true;
          mappings.push({
            kode_accurate: skuCode,
            woo_product_id: woo.id,
            woo_sku_full: woo.sku,
            woo_name: woo.name,
            is_active: true,
          });
        }
      });

      if (isMatched) matchedWooCount++;
    });

    console.log(
      `✅ Berhasil mencocokkan ${matchedWooCount} produk Woo dengan database Supabase.`,
    );
    console.log(
      `📝 Total relasi/mapping yang akan disimpan: ${mappings.length}`,
    );

    if (mappings.length > 0) {
      console.log(
        "\n💾 Menyimpan hasil mapping ke tabel product_woo_mapping...",
      );
      const { error } = await supabase
        .from("product_woo_mapping")
        .upsert(mappings, { onConflict: "kode_accurate,woo_product_id" });
      if (error) throw error;
      console.log(
        "✅ Mapping sukses disimpan ke database! Sistem siap melakukan sync otomatis.",
      );
    }
  } catch (err) {
    console.error("\n❌ Error:", err.message);
  }
}

runSmartMatch();
