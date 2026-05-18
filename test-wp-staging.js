require("dotenv").config({ path: ".env.local" });

const WP_URL = process.env.WP_STAGING_URL || "https://dev.hnsitcenter.id";
const CK = process.env.WOO_CONSUMER_KEY;
const CS = process.env.WOO_CONSUMER_SECRET;

async function testWP() {
  console.log("🌐 Testing connection to:", WP_URL);

  if (!CK || !CS) {
    console.log(
      "❌ Error: WOO_CONSUMER_KEY atau WOO_CONSUMER_SECRET tidak ditemukan di .env.local",
    );
    return;
  }

  // 1. Coba fetch 1 produk
  console.log("\n📥 Test 1: Fetch produk dari WordPress Staging...");
  const fetchUrl = `${WP_URL}/wp-json/wc/v3/products?per_page=1&consumer_key=${CK}&consumer_secret=${CS}`;

  try {
    const res = await fetch(fetchUrl);

    if (!res.ok) {
      console.log("❌ Fetch gagal:", res.status, res.statusText);
      const errText = await res.text();
      console.log("   Detail:", errText);
      return;
    }

    const products = await res.json();

    if (!products || products.length === 0) {
      console.log("⚠️ Terkoneksi tapi tidak ada produk sama sekali di staging");
      return;
    }

    const target = products[0];
    console.log("✅ Konek berhasil! Sample produk:");
    console.log("  ID:", target.id);
    console.log("  Name:", target.name);
    console.log("  SKU:", target.sku);
    console.log("  Price sekarang:", target.regular_price);

    // 2. Test UPDATE harga produk pertama
    console.log(
      "\n📝 Test 2: Update harga produk ini jadi Rp 88888 sebagai test...",
    );

    const ORIGINAL_PRICE = target.regular_price;
    const TEST_PRICE = "88888";

    const updateUrl = `${WP_URL}/wp-json/wc/v3/products/${target.id}?consumer_key=${CK}&consumer_secret=${CS}`;

    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regular_price: TEST_PRICE }),
    });

    if (!updateRes.ok) {
      console.log("❌ Update gagal:", updateRes.status);
      const errBody = await updateRes.text();
      console.log("   Error:", errBody.substring(0, 200));
      return;
    }

    const updated = await updateRes.json();
    console.log("✅ Update berhasil!");
    console.log("  Harga baru:", updated.regular_price);
    console.log(
      "  Match:",
      updated.regular_price === TEST_PRICE ? "✅ YES" : "❌ NO",
    );

    // 3. RESTORE harga asli
    console.log("\n🔄 Restoring harga asli...");
    await fetch(updateUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regular_price: ORIGINAL_PRICE || "" }), // kembalikan string kosong kalau sebelumnya tidak ada harga
    });
    console.log(`✅ Harga di-restore ke: ${ORIGINAL_PRICE || "[Kosong]"}`);

    console.log("\n💡 KESIMPULAN:");
    console.log("  Read API: ✅ Works");
    console.log("  Write API: ✅ Works");
    console.log("  WordPress staging SIAP untuk auto-sync nanti.");
  } catch (err) {
    console.log("❌ Error:", err.message);
  }
}

testWP().catch(console.error);
