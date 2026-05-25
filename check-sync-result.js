// check-sync-result.js
// Cek sync_log terbaru untuk memastikan webhook auto-sync jalan
require("dotenv").config({ path: ".env.local" });

const SUPABASE_URL = "https://hptfudqtrnyeqcqhhaeh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log("📋 Sync Log Terbaru (5 entry terakhir):\n");

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sync_log?select=kode_accurate,woo_product_id,status,message,error_detail,created_at&order=created_at.desc&limit=5`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  const rows = await res.json();
  if (!rows || rows.length === 0) {
    console.log("Tidak ada entry di sync_log");
    return;
  }

  rows.forEach((row, i) => {
    const icon = row.status === "success" ? "✅" : row.status === "skipped" ? "⏭️" : "❌";
    console.log(`${i + 1}. ${icon} [${row.status.toUpperCase()}] ${row.kode_accurate || "-"}`);
    console.log(`   Woo ID  : ${row.woo_product_id || "null"}`);
    console.log(`   Pesan   : ${row.message}`);
    if (row.error_detail) console.log(`   Error   : ${row.error_detail}`);
    console.log(`   Waktu   : ${new Date(row.created_at).toLocaleString("id-ID")}`);
    console.log();
  });
}

main().catch(console.error);
