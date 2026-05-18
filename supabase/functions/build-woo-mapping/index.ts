// Edge Function: build-woo-mapping
// Purpose: Fetch semua produk WooCommerce, smart-match ke Kode Accurate di Supabase,
//          simpan hasil ke tabel product_woo_mapping.
// Trigger: Manual via HTTP POST (jalankan 1x atau kalau ada produk baru di Woo)
// Deploy:  supabase functions deploy build-woo-mapping --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// FETCH SEMUA PRODUK DARI WOOCOMMERCE (dengan pagination)
// ============================================================
async function fetchAllWooProducts(wooUrl: string, ck: string, cs: string) {
  let page = 1;
  const allProducts: any[] = [];

  while (true) {
    const url = `${wooUrl}/wp-json/wc/v3/products?per_page=100&page=${page}&consumer_key=${ck}&consumer_secret=${cs}&status=publish`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Gagal fetch WooCommerce page ${page}: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    allProducts.push(...data);
    page++;
  }

  return allProducts;
}

// ============================================================
// FETCH SEMUA PRODUK DARI SUPABASE
// ============================================================
async function fetchAllSupabaseProducts(supabase: any) {
  const { data, error } = await supabase
    .from("products")
    .select('"Kode Accurate", "NAMA BARANG"');

  if (error) throw new Error(`Gagal fetch Supabase products: ${error.message}`);
  return data || [];
}

// ============================================================
// SMART MATCHING
// SKU Woo bisa format: "KODE1 / KODE2" atau "KODE1, KODE2" dll
// ============================================================
function buildMappings(wooProducts: any[], sbProducts: any[]) {
  // Buat lookup map: KODE_ACCURATE (uppercase) → data produk
  const sbMap = new Map<string, any>();
  for (const p of sbProducts) {
    if (p["Kode Accurate"]) {
      sbMap.set(p["Kode Accurate"].trim().toUpperCase(), p);
    }
  }

  const mappings: any[] = [];
  let matchedWooCount = 0;

  for (const woo of wooProducts) {
    if (!woo.sku) continue;

    // Pisahkan SKU multi-kode (separator: / , ; | +)
    const skuParts = woo.sku
      .toUpperCase()
      .split(/[/,;|+]/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    let isMatched = false;
    for (const skuCode of skuParts) {
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
    }

    if (isMatched) matchedWooCount++;
  }

  return { mappings, matchedWooCount };
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ambil env vars
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const wooUrl = Deno.env.get("WOO_BASE_URL") || "https://hnsitcenter.id";
    const ck = Deno.env.get("WOO_CONSUMER_KEY");
    const cs = Deno.env.get("WOO_CONSUMER_SECRET");

    if (!ck || !cs) {
      throw new Error("WOO_CONSUMER_KEY atau WOO_CONSUMER_SECRET belum di-set di Supabase secrets.");
    }

    // Gunakan service role key supaya bisa write ke tabel tanpa RLS blocking
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("📦 Fetching WooCommerce products...");
    const wooProducts = await fetchAllWooProducts(wooUrl, ck, cs);
    console.log(`✅ ${wooProducts.length} produk dari WooCommerce`);

    console.log("📦 Fetching Supabase products...");
    const sbProducts = await fetchAllSupabaseProducts(supabase);
    console.log(`✅ ${sbProducts.length} produk dari Supabase`);

    console.log("🔍 Running smart match...");
    const { mappings, matchedWooCount } = buildMappings(wooProducts, sbProducts);
    console.log(`✅ ${matchedWooCount} Woo products matched → ${mappings.length} relasi`);

    let upsertedCount = 0;
    if (mappings.length > 0) {
      const { error } = await supabase
        .from("product_woo_mapping")
        .upsert(mappings, { onConflict: "kode_accurate,woo_product_id" });

      if (error) throw new Error(`Gagal upsert mapping: ${error.message}`);
      upsertedCount = mappings.length;
      console.log(`💾 ${upsertedCount} mapping disimpan ke product_woo_mapping`);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        woo_products_fetched: wooProducts.length,
        supabase_products_fetched: sbProducts.length,
        woo_products_matched: matchedWooCount,
        mappings_upserted: upsertedCount,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    return new Response(
      JSON.stringify({ status: "error", message: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
