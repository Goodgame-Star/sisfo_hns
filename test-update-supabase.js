require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function testUpdate() {
  // 1. Ambil 1 produk pertama
  const { data: products } = await supabase
    .from("products")
    .select('"Kode Accurate", "NAMA BARANG", PRICE')
    .limit(1);

  if (!products || products.length === 0) {
    console.log("❌ Tidak ada produk di tabel");
    return;
  }

  const target = products[0];
  const ORIGINAL_PRICE = target.PRICE;
  console.log("🎯 Test target:");
  console.log("  Kode:", target["Kode Accurate"]);
  console.log("  Nama:", target["NAMA BARANG"]);
  console.log("  Harga sekarang: Rp", ORIGINAL_PRICE);

  // 2. Update harga jadi 99999 sebagai test
  const TEST_PRICE = 99999;
  console.log(`\n📝 Updating PRICE jadi ${TEST_PRICE}...`);

  const { error } = await supabase
    .from("products")
    .update({
      PRICE: TEST_PRICE,
      "TANGGAL UPDATE": new Date().toLocaleString("id-ID"),
    })
    .eq("Kode Accurate", target["Kode Accurate"]);

  if (error) {
    console.log("❌ Update gagal:", error.message);
    return;
  }

  // 3. Verify
  const { data: updated } = await supabase
    .from("products")
    .select('"Kode Accurate", PRICE, "TANGGAL UPDATE"')
    .eq("Kode Accurate", target["Kode Accurate"])
    .single();

  console.log("\n✅ Hasil setelah update:");
  console.log("  PRICE:", updated.PRICE);
  console.log("  Tanggal:", updated["TANGGAL UPDATE"]);
  console.log("  Match:", updated.PRICE === TEST_PRICE ? "✅ YES" : "❌ NO");

  // 4. RESTORE HARGA ASLI (Sesuai constraint)
  console.log("\n🔄 Restoring harga asli...");
  await supabase
    .from("products")
    .update({ PRICE: ORIGINAL_PRICE })
    .eq("Kode Accurate", target["Kode Accurate"]);
  console.log(`✅ Harga berhasil di-restore kembali ke: Rp ${ORIGINAL_PRICE}`);
}

testUpdate().catch(console.error);
