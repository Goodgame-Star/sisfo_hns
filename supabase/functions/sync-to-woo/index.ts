// Edge Function: sync-to-woo
// Purpose: Terima DB webhook dari Supabase saat ada UPDATE di tabel products,
//          push perubahan PRICE ke WooCommerce REST API, catat ke sync_log.
// Trigger: Supabase Database Webhook → AFTER UPDATE on products
// Deploy:  supabase functions deploy sync-to-woo --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Payload yang dikirim Supabase DB Webhook
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, any>;
  old_record: Record<string, any> | null;
}

// ============================================================
// PUSH HARGA KE WOOCOMMERCE
// ============================================================
async function pushPriceToWoo(
  wooUrl: string,
  ck: string,
  cs: string,
  wooProductId: number,
  price: number,
): Promise<{ ok: boolean; status: number; body: any }> {
  const url = `${wooUrl}/wp-json/wc/v3/products/${wooProductId}?consumer_key=${ck}&consumer_secret=${cs}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    // WooCommerce minta string, bukan number
    body: JSON.stringify({ regular_price: String(price) }),
  });

  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// ============================================================
// CATAT KE sync_log
// ============================================================
async function writeLog(
  supabase: any,
  entry: {
    kode_accurate: string;
    woo_product_id: number | null;
    action: string;
    status: "success" | "error" | "skipped";
    message: string;
    old_value?: any;
    new_value?: any;
    error_detail?: string;
    duration_ms?: number;
  },
) {
  await supabase.from("sync_log").insert([entry]);
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ── Env vars ──────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const wooUrl = Deno.env.get("WOO_BASE_URL") || "https://dev.hnsitcenter.id"; // fallback ke staging, bukan production
    const ck = Deno.env.get("WOO_CONSUMER_KEY");
    const cs = Deno.env.get("WOO_CONSUMER_SECRET");

    if (!ck || !cs) throw new Error("WOO credentials belum di-set di Supabase secrets.");

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Cek toggle auto_sync ──────────────────────────────
    const { data: configRow } = await supabase
      .from("woo_config")
      .select("value")
      .eq("key", "auto_sync_enabled")
      .single();

    if (configRow?.value === "false") {
      return new Response(
        JSON.stringify({ status: "skipped", message: "auto_sync_enabled = false" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // ── Parse webhook payload ─────────────────────────────
    const payload: WebhookPayload = await req.json();

    if (payload.type !== "UPDATE" || payload.table !== "products") {
      return new Response(
        JSON.stringify({ status: "skipped", message: `Event tidak relevan: ${payload.type} on ${payload.table}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const newRecord = payload.record;
    const oldRecord = payload.old_record || {};
    const kodeAccurate: string = newRecord["Kode Accurate"];

    // ── Skip kode lama (kepala 1, bukan 25xxx/26xxx) ─────
    const isOldCode = kodeAccurate?.startsWith("1") &&
      !kodeAccurate.startsWith("25") &&
      !kodeAccurate.startsWith("26");

    if (isOldCode) {
      return new Response(
        JSON.stringify({ status: "skipped", message: `Kode ${kodeAccurate} adalah kode lama (kepala 1), sync dilewati.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // ── Cek apakah SP (SRP / harga web) benar-benar berubah ─
    const newPrice = Number(newRecord["SP"]);
    const oldPrice = Number(oldRecord["SP"]);

    if (newPrice === oldPrice || !newPrice) {
      return new Response(
        JSON.stringify({ status: "skipped", message: "SP (SRP) tidak berubah, sync dilewati." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // ── Ambil semua mapping untuk kode ini ───────────────
    const { data: mappings, error: mapErr } = await supabase
      .from("product_woo_mapping")
      .select("woo_product_id, woo_name, woo_sku_full")
      .eq("kode_accurate", kodeAccurate)
      .eq("is_active", true);

    if (mapErr) throw new Error(`Gagal query mapping: ${mapErr.message}`);

    if (!mappings || mappings.length === 0) {
      await writeLog(supabase, {
        kode_accurate: kodeAccurate,
        woo_product_id: null,
        action: "sync_price",
        status: "skipped",
        message: `Tidak ada mapping aktif untuk kode ${kodeAccurate}`,
        old_value: { PRICE: oldPrice },
        new_value: { PRICE: newPrice },
      });

      return new Response(
        JSON.stringify({ status: "skipped", message: `Kode ${kodeAccurate} tidak ada di product_woo_mapping.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // ── Push harga ke setiap Woo product yang ter-mapping ─
    const results: any[] = [];

    for (const mapping of mappings) {
      const wooProductId: number = mapping.woo_product_id;
      const opStart = Date.now();

      try {
        const { ok, status, body } = await pushPriceToWoo(wooUrl, ck, cs, wooProductId, newPrice);
        const duration = Date.now() - opStart;

        if (ok) {
          await writeLog(supabase, {
            kode_accurate: kodeAccurate,
            woo_product_id: wooProductId,
            action: "sync_price",
            status: "success",
            message: `SRP berhasil diupdate: Rp ${oldPrice.toLocaleString()} → Rp ${newPrice.toLocaleString()}`,
            old_value: { SP: oldPrice },
            new_value: { SP: newPrice, regular_price: body.regular_price },
            duration_ms: duration,
          });
          results.push({ woo_product_id: wooProductId, status: "success" });
        } else {
          await writeLog(supabase, {
            kode_accurate: kodeAccurate,
            woo_product_id: wooProductId,
            action: "sync_price",
            status: "error",
            message: `WooCommerce API error: HTTP ${status}`,
            old_value: { SP: oldPrice },
            new_value: { SP: newPrice },
            error_detail: JSON.stringify(body).substring(0, 500),
            duration_ms: duration,
          });
          results.push({ woo_product_id: wooProductId, status: "error", http_status: status });
        }
      } catch (pushErr: any) {
        await writeLog(supabase, {
          kode_accurate: kodeAccurate,
          woo_product_id: wooProductId,
          action: "sync_price",
          status: "error",
          message: "Exception saat push ke WooCommerce",
          error_detail: pushErr.message,
          duration_ms: Date.now() - opStart,
        });
        results.push({ woo_product_id: wooProductId, status: "error", error: pushErr.message });
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter((r) => r.status === "success").length;

    return new Response(
      JSON.stringify({
        status: "done",
        kode_accurate: kodeAccurate,
        srp_changed: { from: oldPrice, to: newPrice },
        mappings_processed: mappings.length,
        success: successCount,
        failed: mappings.length - successCount,
        duration_ms: totalDuration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("❌ sync-to-woo error:", err.message);
    return new Response(
      JSON.stringify({ status: "error", message: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
