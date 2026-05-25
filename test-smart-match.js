// test-smart-match.js — Smart Matching v2 (local version)
// Logic sama persis dengan Edge Function build-woo-mapping/index.ts
// Jalankan: node test-smart-match.js

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("/rest/v1/", "") ||
  process.env.REACT_APP_SUPABASE_URL ||
  "https://hptfudqtrnyeqcqhhaeh.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const WP_URL = process.env.WP_STAGING_URL || "https://dev.hnsitcenter.id";
const CK = process.env.WOO_CONSUMER_KEY;
const CS = process.env.WOO_CONSUMER_SECRET;

// ============================================================
// EXTRACT UNIQUE CODES FROM PRODUCT NAME
// Cari pattern: KM120, AANBG, RTX4060, etc.
// ============================================================
function extractUniqueCodes(name) {
  if (!name) return [];

  const stopwords = new Set([
    "NEW", "PCS", "BLACK", "WHITE", "BLUE", "RED", "GREEN",
    "RAM", "DDR4", "DDR5", "PRO", "MAX", "PLUS", "GAMING", "SERIES",
    "WIRELESS", "BLUETOOTH", "USB", "HDMI", "TYPE", "TYPEC",
    "INTEL", "AMD", "NVIDIA", "CORE", "GEN", "INCH",
    "GB", "TB", "MB", "MHZ", "GHZ", "WATT", "OEM",
    "WITH", "FOR", "AND", "THE",
  ]);

  // Pattern 1: Mixed alphanumeric (e.g., KM120, RTX4060, AANBG12)
  const pattern1 = /\b[A-Z]{1,4}[0-9]{2,}[A-Z0-9]*\b/g;

  // Pattern 2: All-uppercase letter codes (e.g., AANBG, AANBI) — min 4 chars
  const pattern2 = /\b[A-Z]{4,8}\b/g;

  const upperName = name.toUpperCase();
  const codes = new Set();

  [pattern1, pattern2].forEach((pattern) => {
    const matches = upperName.match(pattern) || [];
    matches.forEach((code) => {
      if (code.length >= 4 && code.length <= 12 && !stopwords.has(code)) {
        codes.add(code);
      }
    });
  });

  return Array.from(codes);
}

// ============================================================
// EXTRACT SIZE/SPEC dari nama (untuk variation matching)
// ============================================================
function extractSpecs(name) {
  if (!name) return [];
  const upperName = name.toUpperCase();
  const specs = [];

  const lengthMatches = upperName.match(/\b\d+(\.\d+)?M\b/g) || [];
  lengthMatches.forEach((m) => specs.push(m.toLowerCase()));

  const storageMatches = upperName.match(/\b\d+(GB|TB|MB)\b/g) || [];
  storageMatches.forEach((m) => specs.push(m.toLowerCase()));

  const inchMatches = upperName.match(/\b\d+(\.\d+)?(INCH|IN)\b/g) || [];
  inchMatches.forEach((m) => specs.push(m.toLowerCase()));

  return specs;
}

// ============================================================
// FETCH ALL WOO PRODUCTS (dengan pagination)
// ============================================================
async function fetchAllWooProducts() {
  let page = 1;
  const all = [];

  console.log("📦 Mengambil data produk dari WooCommerce...");
  while (true) {
    const url = `${WP_URL}/wp-json/wc/v3/products?per_page=100&page=${page}&consumer_key=${CK}&consumer_secret=${CS}&status=publish`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal fetch Woo API page ${page}: ${res.statusText}`);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    all.push(...data);
    process.stdout.write(`   ... ${all.length} produk diambil\r`);
    page++;
  }
  console.log(`\n✅ Selesai ambil ${all.length} produk dari WooCommerce.`);
  return all;
}

// ============================================================
// FETCH VARIATIONS for a variable product
// ============================================================
async function fetchVariations(productId) {
  const url = `${WP_URL}/wp-json/wc/v3/products/${productId}/variations?per_page=100&consumer_key=${CK}&consumer_secret=${CS}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return await res.json();
}

// ============================================================
// FETCH ALL SUPABASE PRODUCTS
// ============================================================
async function fetchAllSupabaseProducts() {
  console.log("📦 Mengambil data produk dari Supabase...");
  const { data, error } = await supabase
    .from("products")
    .select('"Kode Accurate", "NAMA BARANG"');
  if (error) throw error;
  console.log(`✅ Selesai ambil ${data.length} produk dari Supabase.`);
  return data;
}

// ============================================================
// SMART MATCHING v2 — 4 Level
// ============================================================
async function smartMatch(wooProducts, sbProducts) {
  const stats = {
    level1_sku_exact: 0,
    level2_sku_multi: 0,
    level3_keyword: 0,
    level4_variation: 0,
    unmatched: 0,
  };
  const mappings = [];

  // Build lookup map: KODE_ACCURATE (uppercase) → product
  const sbByKode = new Map();
  for (const p of sbProducts) {
    if (p["Kode Accurate"]) {
      sbByKode.set(p["Kode Accurate"].trim().toUpperCase(), p);
    }
  }

  const matchedSbCodes = new Set();

  // ---- LEVEL 1 & 2: SKU-based matching ----
  for (const woo of wooProducts) {
    if (!woo.sku) continue;

    const skuParts = woo.sku
      .toUpperCase()
      .split(/[/,;|+]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const isMulti = skuParts.length > 1;

    for (const skuCode of skuParts) {
      if (sbByKode.has(skuCode)) {
        const confidence = isMulti ? 95 : 100;
        const method = isMulti ? "sku_multi" : "sku_exact";

        mappings.push({
          kode_accurate: skuCode,
          woo_product_id: woo.id,
          woo_variation_id: null,
          woo_sku_full: woo.sku,
          woo_name: woo.name,
          confidence_score: confidence,
          match_method: method,
          needs_review: false,
          is_active: true,
        });

        matchedSbCodes.add(skuCode);
        if (isMulti) stats.level2_sku_multi++;
        else stats.level1_sku_exact++;
      }
    }
  }

  // ---- LEVEL 3 & 4: Keyword & Variation matching ----
  const unmatchedSb = sbProducts.filter(
    (p) => !matchedSbCodes.has(p["Kode Accurate"]?.trim().toUpperCase()),
  );

  let processed = 0;
  for (const sb of unmatchedSb) {
    const sbName = sb["NAMA BARANG"] || "";
    const sbKode = sb["Kode Accurate"]?.trim().toUpperCase();
    if (!sbKode || !sbName) continue;

    const sbCodes = extractUniqueCodes(sbName);
    const sbSpecs = extractSpecs(sbName);

    if (sbCodes.length === 0) {
      stats.unmatched++;
      continue;
    }

    let bestMatch = null;

    for (const woo of wooProducts) {
      const wooName = (woo.name || "").toUpperCase();
      for (const code of sbCodes) {
        if (wooName.includes(code)) {
          let score = 70;
          if (code.length >= 5) score += 10;
          if (/[0-9]/.test(code)) score += 5;

          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { woo, score, matchedCode: code };
          }
        }
      }
    }

    if (!bestMatch) {
      stats.unmatched++;
      continue;
    }

    // Level 4: Variation Detection
    let variationId = null;
    let finalScore = bestMatch.score;
    let method = "keyword_name";

    if (bestMatch.woo.type === "variable" && sbSpecs.length > 0) {
      const variations = await fetchVariations(bestMatch.woo.id);
      for (const variation of variations) {
        const varAttribs = (variation.attributes || [])
          .map((a) => (a.option || "").toLowerCase())
          .join(" ");

        for (const spec of sbSpecs) {
          if (varAttribs.includes(spec)) {
            variationId = variation.id;
            finalScore = Math.min(finalScore + 15, 90);
            method = "variation";
            stats.level4_variation++;
            break;
          }
        }
        if (variationId) break;
      }
    }

    if (method === "keyword_name") stats.level3_keyword++;

    mappings.push({
      kode_accurate: sbKode,
      woo_product_id: bestMatch.woo.id,
      woo_variation_id: variationId,
      woo_sku_full: bestMatch.woo.sku || null,
      woo_name: bestMatch.woo.name + (variationId ? ` (var: ${bestMatch.matchedCode})` : ""),
      confidence_score: finalScore,
      match_method: method,
      needs_review: finalScore < 90,
      is_active: true,
    });

    matchedSbCodes.add(sbKode);

    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(`   ... level 3/4: ${processed}/${unmatchedSb.length} diproses\r`);
    }
  }
  if (unmatchedSb.length > 0) process.stdout.write("\n");

  return { mappings, stats };
}

// ============================================================
// MAIN
// ============================================================
async function run() {
  try {
    const wooProducts = await fetchAllWooProducts();
    const sbProducts = await fetchAllSupabaseProducts();

    console.log("\n🔍 Memulai Smart Matching v2...");
    const { mappings, stats } = await smartMatch(wooProducts, sbProducts);

    const unmatchedPct = ((stats.unmatched / sbProducts.length) * 100).toFixed(1);

    console.log(`\n✅ Total mapping yang akan disimpan: ${mappings.length}`);
    console.log("\n📊 Breakdown per Level:");
    console.log(`   Level 1 (SKU exact):    ${stats.level1_sku_exact}`);
    console.log(`   Level 2 (SKU multi):    ${stats.level2_sku_multi}`);
    console.log(`   Level 3 (Keyword nama): ${stats.level3_keyword}`);
    console.log(`   Level 4 (Variation):    ${stats.level4_variation}`);
    console.log(`   Unmatched:              ${stats.unmatched} (${unmatchedPct}%)`);

    if (parseFloat(unmatchedPct) > 50) {
      console.warn(`\n⚠️  WARNING: ${unmatchedPct}% produk tidak ter-match. Pertimbangkan tuning algo.`);
    }

    if (mappings.length > 0) {
      console.log("\n💾 Menyimpan mapping ke database...");
      const BATCH_SIZE = 100;
      let upserted = 0;
      for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
        const batch = mappings.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("product_woo_mapping")
          .upsert(batch, { onConflict: "kode_accurate,woo_product_id" });
        if (error) {
          console.error(`  Batch ${i} error:`, error.message);
        } else {
          upserted += batch.length;
        }
      }
      console.log(`✅ ${upserted} mapping berhasil disimpan!`);
    }
  } catch (err) {
    console.error("\n❌ Error:", err.message);
  }
}

run();
