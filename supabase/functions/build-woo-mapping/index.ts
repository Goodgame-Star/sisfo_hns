// Edge Function: build-woo-mapping v2
// Smart matching dengan 4 level: SKU exact, SKU multi, keyword name, variations
// Deploy: supabase functions deploy build-woo-mapping --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// EXTRACT UNIQUE CODES FROM PRODUCT NAME
// Cari pattern: KM120, AANBG, RTX4060, etc.
// ============================================================
function extractUniqueCodes(name: string): string[] {
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
  const codes = new Set<string>();

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
// Contoh: "1.5M" → "1.5m", "8GB" → "8gb"
// ============================================================
function extractSpecs(name: string): string[] {
  if (!name) return [];
  const upperName = name.toUpperCase();
  const specs: string[] = [];

  const lengthMatches = upperName.match(/\b\d+(\.\d+)?M\b/g) || [];
  lengthMatches.forEach((m) => specs.push(m.toLowerCase()));

  const storageMatches = upperName.match(/\b\d+(GB|TB|MB)\b/g) || [];
  storageMatches.forEach((m) => specs.push(m.toLowerCase()));

  const inchMatches = upperName.match(/\b\d+(\.\d+)?(INCH|IN)\b/g) || [];
  inchMatches.forEach((m) => specs.push(m.toLowerCase()));

  return specs;
}

// ============================================================
// FETCH ALL WOO PRODUCTS (with pagination)
// ============================================================
async function fetchAllWooProducts(wooUrl: string, ck: string, cs: string) {
  let page = 1;
  const all: any[] = [];

  while (true) {
    const url = `${wooUrl}/wp-json/wc/v3/products?per_page=100&page=${page}&consumer_key=${ck}&consumer_secret=${cs}&status=publish`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed page ${page}: ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    all.push(...data);
    page++;
  }

  return all;
}

// ============================================================
// FETCH VARIATIONS for a variable product
// ============================================================
async function fetchVariations(
  wooUrl: string,
  ck: string,
  cs: string,
  productId: number,
) {
  const url = `${wooUrl}/wp-json/wc/v3/products/${productId}/variations?per_page=100&consumer_key=${ck}&consumer_secret=${cs}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return await res.json();
}

// ============================================================
// FETCH ALL SUPABASE PRODUCTS
// ============================================================
async function fetchAllSupabaseProducts(supabase: any) {
  const { data, error } = await supabase
    .from("products")
    .select('"Kode Accurate", "NAMA BARANG"');
  if (error) throw new Error(`Fetch Supabase failed: ${error.message}`);
  return data || [];
}

// ============================================================
// SMART MATCHING - All 4 Levels
// ============================================================
async function smartMatch(
  wooProducts: any[],
  sbProducts: any[],
  wooUrl: string,
  ck: string,
  cs: string,
) {
  const mappings: any[] = [];
  const stats = {
    level1_sku_exact: 0,
    level2_sku_multi: 0,
    level3_keyword: 0,
    level4_variation: 0,
    unmatched: 0,
  };

  // Build lookup map: KODE_ACCURATE (uppercase) → product
  const sbByKode = new Map<string, any>();
  for (const p of sbProducts) {
    if (p["Kode Accurate"]) {
      sbByKode.set(p["Kode Accurate"].trim().toUpperCase(), p);
    }
  }

  // Track Supabase codes yang udah ke-match
  const matchedSbCodes = new Set<string>();

  // ============================================
  // LEVEL 1 & 2: SKU-based matching
  // ============================================
  for (const woo of wooProducts) {
    if (!woo.sku) continue;

    const skuParts = woo.sku
      .toUpperCase()
      .split(/[/,;|+]/)
      .map((s: string) => s.trim())
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

  // ============================================
  // LEVEL 3 & 4: Keyword & Variation matching
  // Cuma untuk Supabase codes yang belum ke-match
  // ============================================
  const unmatchedSb = sbProducts.filter(
    (p) => !matchedSbCodes.has(p["Kode Accurate"]?.trim().toUpperCase()),
  );

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

    let bestMatch: { woo: any; score: number; matchedCode: string } | null =
      null;

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

    // ============================================
    // LEVEL 4: Variation Detection
    // ============================================
    let variationId: number | null = null;
    let finalScore = bestMatch.score;
    let method = "keyword_name";

    if (bestMatch.woo.type === "variable" && sbSpecs.length > 0) {
      const variations = await fetchVariations(
        wooUrl,
        ck,
        cs,
        bestMatch.woo.id,
      );

      for (const variation of variations) {
        const varAttribs = (variation.attributes || [])
          .map((a: any) => (a.option || "").toLowerCase())
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
      woo_name: bestMatch.woo.name +
        (variationId ? ` (var: ${bestMatch.matchedCode})` : ""),
      confidence_score: finalScore,
      match_method: method,
      needs_review: finalScore < 90,
      is_active: true,
    });

    matchedSbCodes.add(sbKode);
  }

  return { mappings, stats };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const wooUrl = Deno.env.get("WOO_BASE_URL") || "https://hnsitcenter.id";
    const ck = Deno.env.get("WOO_CONSUMER_KEY");
    const cs = Deno.env.get("WOO_CONSUMER_SECRET");

    if (!ck || !cs) throw new Error("WooCommerce credentials missing");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("📦 Fetching WooCommerce products...");
    const wooProducts = await fetchAllWooProducts(wooUrl, ck, cs);
    console.log(`✅ ${wooProducts.length} Woo products`);

    console.log("📦 Fetching Supabase products...");
    const sbProducts = await fetchAllSupabaseProducts(supabase);
    console.log(`✅ ${sbProducts.length} Supabase products`);

    console.log("🔍 Running smart match v2...");
    const { mappings, stats } = await smartMatch(
      wooProducts,
      sbProducts,
      wooUrl,
      ck,
      cs,
    );
    console.log(`✅ Generated ${mappings.length} mappings`);
    console.log("📊 Stats:", JSON.stringify(stats));

    // Cek constraint: kalau unmatched > 50% dari total Supabase, log warning
    const unmatchedPct = (stats.unmatched / sbProducts.length) * 100;
    if (unmatchedPct > 50) {
      console.warn(
        `⚠️ WARNING: ${unmatchedPct.toFixed(1)}% produk Supabase tidak ter-match. Pertimbangkan tuning algo.`,
      );
    }

    let upsertedCount = 0;
    if (mappings.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
        const batch = mappings.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("product_woo_mapping")
          .upsert(batch, { onConflict: "kode_accurate,woo_product_id" });

        if (error) {
          console.error(`Batch ${i} error:`, error.message);
        } else {
          upsertedCount += batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: "success",
        woo_products_fetched: wooProducts.length,
        supabase_products_fetched: sbProducts.length,
        mappings_generated: mappings.length,
        mappings_upserted: upsertedCount,
        stats,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    return new Response(
      JSON.stringify({ status: "error", message: err.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
