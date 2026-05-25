// Edge Function: sync-from-sheets
// Purpose: Fetch data produk dari Google Sheets (Accurate export) → upsert ke tabel products
// Trigger: Manual via tombol di Dashboard
// Deploy:  supabase functions deploy sync-from-sheets --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// GOOGLE SERVICE ACCOUNT JWT AUTH
// ============================================================
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64url(input: ArrayBuffer | string): string {
  let str: string;
  if (typeof input === "string") {
    str = btoa(input);
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(input)));
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getGoogleAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const keyData = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${base64url(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Gagal dapat access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// ============================================================
// FETCH DATA DARI GOOGLE SHEETS
// ============================================================
async function fetchSheetData(
  sheetId: string,
  tabName: string,
  accessToken: string,
): Promise<string[][]> {
  const range = encodeURIComponent(`${tabName}!A:F`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.values || [];
}

// ============================================================
// PARSE ROWS: map kolom Accurate → format products Supabase
// Header yang diexpect: Kode Accurate, NAMA BARANG, UPC/BARCODE, NAMA KATEGORI, NAMA BRAND, STATUS
// ============================================================
function parseRows(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toUpperCase());

  // Cari index tiap kolom by nama (fleksibel)
  const idx = {
    kode: headers.findIndex((h) => h.includes("KODE ACCURATE") || h === "KODE"),
    nama: headers.findIndex((h) => h === "NAMA BARANG"),
    kategori: headers.findIndex((h) => h.includes("KATEGORI")),
    brand: headers.findIndex((h) => h.includes("BRAND")),
    status: headers.findIndex((h) => h === "STATUS"),
  };

  if (idx.kode === -1 || idx.nama === -1) {
    throw new Error(
      `Header tidak ditemukan. Kolom wajib: "Kode Accurate", "NAMA BARANG". Header aktual: ${rows[0].join(", ")}`,
    );
  }

  const products: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const kode = (row[idx.kode] || "").trim();
    if (!kode) continue;

    const product: Record<string, string> = {
      "Kode Accurate": kode,
      "NAMA BARANG": idx.nama >= 0 ? (row[idx.nama] || "").trim() : "",
    };

    if (idx.kategori >= 0) product["KATEGORI"] = (row[idx.kategori] || "").trim();
    if (idx.brand >= 0) product["NAMA BRAND"] = (row[idx.brand] || "").trim();
    if (idx.status >= 0) product["STATUS"] = (row[idx.status] || "").trim();

    products.push(product);
  }

  return products;
}

// ============================================================
// UPSERT KE SUPABASE
// Upsert semua produk dari sheet:
//   - Produk baru → INSERT (CP/SP/PRICE tetap null, diisi PIC)
//   - Produk existing → UPDATE nama/kategori/brand/status SAJA
//                       (CP/SP/PRICE tidak disentuh karena tidak ada di payload)
// ============================================================
async function upsertProducts(
  supabase: any,
  sheetProducts: Record<string, string>[],
): Promise<{ inserted: number; updated: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  const BATCH = 200;

  for (let i = 0; i < sheetProducts.length; i += BATCH) {
    const batch = sheetProducts.slice(i, i + BATCH).map((p) => ({
      "Kode Accurate": p["Kode Accurate"],
      "NAMA BARANG": p["NAMA BARANG"] || "",
      "KATEGORI": p["KATEGORI"] || "",
      "NAMA BRAND": p["NAMA BRAND"] || "",
      "STATUS": p["STATUS"] || "",
    }));

    const { error } = await supabase
      .from("products")
      .upsert(batch, { onConflict: "Kode Accurate", ignoreDuplicates: false });

    if (error) {
      console.error(`Upsert batch ${i} error:`, error.message);
      errors += batch.length;
    } else {
      processed += batch.length;
    }
  }

  return { inserted: 0, updated: processed, errors };
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    const sheetIdFromEnv = Deno.env.get("GOOGLE_SHEET_ID");

    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON belum di-set di Supabase secrets.");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Ambil config dari woo_config
    const { data: configs } = await supabase
      .from("woo_config")
      .select("key, value")
      .in("key", ["google_sheets_id", "google_sheets_tab"]);

    const configMap: Record<string, string> = {};
    (configs || []).forEach((c: any) => { configMap[c.key] = c.value; });

    const sheetId = sheetIdFromEnv || configMap["google_sheets_id"];
    const tabName = configMap["google_sheets_tab"] || "Sheet1";

    if (!sheetId) throw new Error("Google Sheet ID belum di-set. Isi di woo_config atau GOOGLE_SHEET_ID secret.");

    // Auth ke Google
    console.log("🔑 Autentikasi ke Google...");
    const serviceAccount = JSON.parse(saJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);

    // Fetch data
    console.log(`📊 Fetching data dari sheet "${tabName}"...`);
    const rows = await fetchSheetData(sheetId, tabName, accessToken);
    console.log(`✅ ${rows.length - 1} baris data ditemukan`);

    // Parse
    const products = parseRows(rows);
    console.log(`✅ ${products.length} produk valid setelah parsing`);

    // Upsert
    console.log("💾 Upsert ke Supabase...");
    const { inserted, updated, errors } = await upsertProducts(supabase, products);
    console.log(`✅ Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`);

    // Update last sync timestamp
    await supabase
      .from("woo_config")
      .update({ value: new Date().toISOString() })
      .eq("key", "last_sheets_sync_at");

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        status: "success",
        rows_fetched: rows.length - 1,
        products_parsed: products.length,
        inserted,
        updated,
        errors,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err: any) {
    console.error("❌ sync-from-sheets error:", err.message);
    return new Response(
      JSON.stringify({ status: "error", message: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
