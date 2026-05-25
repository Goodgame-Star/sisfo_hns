require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1/', '') || process.env.REACT_APP_SUPABASE_URL;
// Gunakan service role key supaya tidak diblok RLS
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function checkSynced() {
  const { data: mappings, error } = await supabase
    .from('product_woo_mapping')
    .select('*')
    .limit(5);

  if (error) {
    console.error("Error fetch mapping:", error);
    return;
  }
  
  if (mappings.length === 0) {
    console.log("Belum ada produk yang di-mapping. Apakah script build-woo-mapping sudah dijalankan?");
    return;
  }
  
  console.log("Berikut adalah 5 contoh produk yang sudah terkoneksi ke WooCommerce:\n");
  for (const m of mappings) {
    const { data: prod } = await supabase
      .from('products')
      .select('"NAMA BARANG", PRICE')
      .eq('Kode Accurate', m.kode_accurate)
      .single();
      
    console.log(`- Kode Accurate: ${m.kode_accurate}`);
    console.log(`  Woo Product ID: ${m.woo_product_id}`);
    if (prod) {
      console.log(`  Nama Barang  : ${prod["NAMA BARANG"]}`);
      console.log(`  Harga Saat Ini: Rp ${prod.PRICE}`);
    }
    console.log("");
  }
}
checkSynced().catch(console.error);
