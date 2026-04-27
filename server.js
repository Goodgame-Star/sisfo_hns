const express = require('express');
const mysql = require('mysql2/promise'); // Library MySQL modern
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// --- 1. KONEKSI DATABASE ---
// Sesuaikan user/password dengan settingan XAMPP kamu
const dbConfig = {
    host: 'localhost',
    user: 'root',      // Default XAMPP usually 'root'
    password: '',      // Default XAMPP usually kosong
    database: 'inventory_hns'
};

// Fungsi bantuan untuk koneksi
async function query(sql, params) {
    const connection = await mysql.createConnection(dbConfig);
    const [results, ] = await connection.execute(sql, params);
    connection.end(); // Tutup koneksi biar hemat resource
    return results;
}

// --- 2. API ENDPOINTS ---

// AMBIL SEMUA PRODUK (Cepat!)
app.get('/api/products', async (req, res) => {
    try {
        // Ambil data langsung dari database
        const rows = await query('SELECT * FROM products ORDER BY nama ASC');
        
        // Format biar sama kayak frontend kamu sebelumnya
        // Di SQL nama kolomnya 'harga_jual', di frontend mungkin butuh penyesuaian dikit
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal ambil data database' });
    }
});

// --- UPDATE PRODUK (REVISI: BISA EDIT SEMUA HARGA) ---
app.post('/api/update-product', async (req, res) => {
    try {
        // Terima data lengkap dari frontend
        const { kodeBarang, stokBaru, hargaJualBaru, hargaBeliBaru, hargaDealerBaru } = req.body;
        
        // Update semua kolom harga dan stok
        await query(
            'UPDATE products SET stok = ?, harga_jual = ?, harga_beli = ?, harga_dealer = ? WHERE id = ?',
            [stokBaru, hargaJualBaru, hargaBeliBaru, hargaDealerBaru, kodeBarang]
        );

        res.json({ success: true, message: 'Data produk berhasil diupdate!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// AMBIL DATA USER (LOGIN)
app.get('/api/users', async (req, res) => {
    try {
        const users = await query('SELECT username, password, role FROM users');
        // Tambahkan properti 'name' biar frontend gak error
        const formattedUsers = users.map(u => ({ ...u, name: u.username.toUpperCase() }));
        res.json(formattedUsers);
    } catch (error) {
        res.status(500).json([]);
    }
});

// SYNC (OPSIONAL)
// Karena pakai database, sync sebenernya gak perlu. 
// Tapi biar frontend gak error pas klik tombol sync, kita kasih respon dummy sukses.
app.get('/api/sync', (req, res) => {
    res.json({ success: true, message: 'Database sudah realtime! Tidak perlu sync manual.', total: 0 });
});

// --- JALANKAN SERVER ---
app.listen(PORT, () => {
    console.log(`🚀 Server Database MySQL berjalan di http://localhost:${PORT}`);
});

// --- TAMBAHAN FITUR CRUD (CREATE & DELETE) ---

// 1. TAMBAH BARANG BARU (CREATE)
app.post('/api/add-product', async (req, res) => {
    try {
        // Ambil data dari frontend
        const { id, nama, kategori, brand, harga_beli, harga_dealer, harga_jual, stok } = req.body;
        
        // Cek dulu, kode barang sudah ada belum?
        const check = await query('SELECT id FROM products WHERE id = ?', [id]);
        if(check.length > 0) {
            return res.status(400).json({ success: false, message: 'Kode Barang sudah terpakai!' });
        }

        // Masukkan ke database
        await query(
            'INSERT INTO products (id, nama, kategori, brand, harga_beli, harga_dealer, harga_jual, stok) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, nama, kategori, brand, harga_beli, harga_dealer, harga_jual, stok]
        );
        res.json({ success: true, message: 'Barang berhasil ditambah!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal menambah barang: ' + error.message });
    }
});

// 2. HAPUS BARANG (DELETE)
app.delete('/api/delete-product/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM products WHERE id = ?', [id]);
        res.json({ success: true, message: 'Barang berhasil dihapus!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- API IMPORT CSV ---
app.post('/api/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File wajib diupload!' });

        const results = [];
        
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => {
                // FUNGSI BERSIH-BERSIH HARGA (Hapus Rp, Titik, Koma)
                const cleanPrice = (val) => {
                    if(!val) return 0;
                    // Hapus Rp, hapus titik, hapus ,00
                    return parseInt(val.toString().replace(/Rp/g, '').replace(/\./g, '').replace(/,00/g, '').replace(/,/g, '')) || 0;
                };

                // MAPPING SESUAI HEADER CSV KAMU
                const id = data['Kode Accurate'] || data['Kode'] || ''; 
                const nama = data['NAMA BARANG'] || data['Nama'] || '';

                // Hanya ambil data yang punya Kode Barang
                if (id && id !== 'nan') {
                    results.push([
                        id,
                        nama,
                        data['KATEGORI'] || '',
                        data['NAMA BRAND'] || '',
                        cleanPrice(data['CP']),         // Harga Beli
                        cleanPrice(data['SP']),         // Harga Dealer
                        cleanPrice(data['PRICE']),      // Harga Jual
                        cleanPrice(data['Stok Sistem']) // Stok
                    ]);
                }
            })
            .on('end', async () => {
                fs.unlinkSync(req.file.path); // Hapus file temporary

                if (results.length > 0) {
                    try {
                        // INSERT BULK (Banyak sekaligus) + UPDATE kalau sudah ada
                        const sql = `INSERT INTO products (id, nama, kategori, brand, harga_beli, harga_dealer, harga_jual, stok) VALUES ? 
                                     ON DUPLICATE KEY UPDATE 
                                     nama=VALUES(nama), kategori=VALUES(kategori), brand=VALUES(brand), 
                                     harga_beli=VALUES(harga_beli), harga_dealer=VALUES(harga_dealer), 
                                     harga_jual=VALUES(harga_jual), stok=VALUES(stok)`;
                        
                        const connection = await mysql.createConnection(dbConfig);
                        await connection.query(sql, [results]);
                        connection.end();

                        res.json({ success: true, message: `Sukses import ${results.length} barang!` });
                    } catch (err) {
                        res.status(500).json({ success: false, message: 'Gagal insert database: ' + err.message });
                    }
                } else {
                    res.json({ success: false, message: 'File CSV kosong atau format salah.' });
                }
            });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});