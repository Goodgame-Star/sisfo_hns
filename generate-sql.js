const fs = require('fs');
const path = require('path');

// --- KONFIGURASI ---
const INPUT_FILE = 'PRICELIST DEALER - MASTER.csv'; // Pastikan nama file CSV-mu benar
const OUTPUT_FILE = 'products.sql';

console.log('🚀 Memulai pembuatan SQL...');

try {
    const rawData = fs.readFileSync(path.join(__dirname, INPUT_FILE), 'utf8');
    
    // 1. BERSIHKAN DATA KOTOR (Global Replace)
    let cleanData = rawData
        .replace(/Rp/g, '')      // Hapus Rp
        .replace(/\./g, '')      // Hapus Titik (8.000.000 -> 8000000)
        .replace(/,00/g, '')     // Hapus ,00 di harga
        .replace(/"/g, '')       // Hapus Tanda Kutip
        .replace(/'/g, '');      // Hapus Tanda Petik (biar gak error SQL)

    const lines = cleanData.split('\n');
    let sqlContent = "TRUNCATE TABLE products;\n"; // Kosongkan tabel dulu biar bersih
    let successCount = 0;

    // 2. LOOP SETIAP BARIS
    for (let i = 1; i < lines.length; i++) { // Mulai dari 1 (Skip Header)
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');

        // 3. LOGIKA "RIGHT-ANCHOR" (PENTING!)
        // Karena Nama Barang bisa mengandung koma dan panjangnya tidak pasti,
        // Kita ambil data PASTI dari KANAN dulu.
        // Struktur CSV: NO, Kode, [NAMA...], STATUS, CP, SP, PRICE, UPDATE, KATEGORI, BRAND, Stok, Aktif
        // Total Kolom Standar = 12. 
        
        const len = parts.length;
        if (len < 12) continue; // Skip baris rusak

        // Ambil data dari BELAKANG (Posisi pasti)
        const stokRaw = parts[len - 2];   // Kolom 11 (Stok)
        const brand = parts[len - 3];     // Kolom 10 (Brand)
        const kategori = parts[len - 4];  // Kolom 9 (Kategori)
        const priceRaw = parts[len - 6];  // Kolom 7 (PRICE / Harga Jual)
        const cpRaw = parts[len - 8];     // Kolom 5 (CP / Harga Beli)
        
        // Ambil data dari DEPAN (Posisi pasti)
        const id = parts[1];              // Kolom 2 (Kode Accurate)

        // Sisanya di tengah adalah NAMA BARANG (Gabungkan jika terpecah koma)
        // Ambil dari index 2 sampai (len - 9)
        const namaParts = parts.slice(2, len - 9); 
        const nama = namaParts.join(' ').trim(); 

        // Skip jika tidak ada ID
        if (!id || id === 'nan' || id.length < 3) continue;

        // 4. BERSIHKAN ANGKA
        const harga_beli = parseInt(cpRaw) || 0;
        const harga_jual = parseInt(priceRaw) || 0;
        const stok = parseInt(stokRaw) || 0;

        // 5. BUAT QUERY INSERT
        sqlContent += `INSERT INTO products (id, nama, kategori, brand, harga_beli, harga_jual, stok) VALUES ('${id}', '${nama}', '${kategori}', '${brand}', ${harga_beli}, ${harga_jual}, ${stok});\n`;
        successCount++;
    }

    fs.writeFileSync(path.join(__dirname, OUTPUT_FILE), sqlContent);
    
    console.log(`✅ BERHASIL! File '${OUTPUT_FILE}' telah dibuat.`);
    console.log(`📊 Total Produk Siap Import: ${successCount}`);
    console.log('👉 Sekarang buka HeidiSQL -> File -> Load SQL file -> Pilih products.sql -> Run!');

} catch (err) {
    console.error('❌ Error:', err.message);
}