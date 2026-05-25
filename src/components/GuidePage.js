import React, { useState } from "react";
import { styles } from "./DashboardHelpers";

function GuidePage({ user, onViewMain, onLogout }) {
  // Tentukan tab aktif default berdasarkan role user
  const getDefaultTab = () => {
    switch (user?.role) {
      case "pic":
        return "pic";
      case "administrator":
        return "admin";
      case "admin_gudang":
        return "gudang";
      case "sales_toko":
        return "sales_toko";
      case "sales_dealer":
        return "sales_dealer";
      default:
        return "pic";
    }
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());

  // Data checklist interaktif
  const [completedSteps, setCompletedSteps] = useState({});

  const toggleStep = (roleKey, stepIndex) => {
    const key = `${roleKey}-${stepIndex}`;
    setCompletedSteps((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const tabs = [
    { id: "pic", label: "👨‍💻 PIC WooCommerce", icon: "🔌" },
    { id: "admin", label: "📦 Administrator", icon: "⚙️" },
    { id: "gudang", label: "🏭 Admin Gudang", icon: "🧱" },
    { id: "sales_toko", label: "🏪 Sales Toko", icon: "🛒" },
    { id: "sales_dealer", label: "💼 Sales Dealer", icon: "🤝" },
  ];

  return (
    <div className="dashboard-wrapper">
      <style>{styles}</style>
      <style>{`
        /* --- STYLING TAMBAHAN PANDUAN --- */
        .guide-container {
          background: white;
          border-radius: 16px;
          padding: 30px;
          box-shadow: 0 12px 25px rgba(0,0,0,.08);
          margin-bottom: 30px;
        }
        
        .tab-menu {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 25px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 15px;
        }

        .tab-btn {
          padding: 12px 20px;
          border-radius: 10px;
          border: none;
          font-weight: 700;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
          background: #f1f5f9;
          color: #475569;
        }

        .tab-btn:hover {
          background: #e2e8f0;
          transform: translateY(-1px);
        }

        .tab-btn.active {
          background: #4f46e5;
          color: white;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }

        .role-badge {
          background: #e0e7ff;
          color: #4f46e5;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: bold;
          margin-left: 10px;
          display: inline-block;
        }

        .guide-section-title {
          font-size: 20px;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-left: 4px solid #4f46e5;
          padding-left: 12px;
        }

        .guide-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 25px;
        }

        .info-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          background: #f8fafc;
          position: relative;
        }

        .info-card-title {
          font-size: 15px;
          font-weight: bold;
          color: #334155;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .step-list {
          list-style: none;
          padding: 0;
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 10px;
          border-bottom: 1px dashed #e2e8f0;
          transition: background 0.2s;
          border-radius: 8px;
        }

        .step-item:hover {
          background: #f1f5f9;
        }

        .step-checkbox {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          cursor: pointer;
        }

        .step-text {
          font-size: 13.5px;
          color: #475569;
          line-height: 1.5;
        }

        .step-text.completed {
          text-decoration: line-through;
          color: #94a3b8;
        }

        .step-badge {
          background: #4f46e5;
          color: white;
          font-size: 11px;
          font-weight: bold;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .alert-box {
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .alert-info {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e3a8a;
        }

        .alert-warning {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #78350f;
        }

        .label-desc {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          color: white;
        }

        .desc-cp { background: #e53e3e; }
        .desc-sp { background: #e67e22; }
        .desc-price { background: #38a169; }

        @media (max-width: 768px) {
          .tab-menu {
            flex-direction: column;
            width: 100%;
          }
          .tab-btn {
            width: 100%;
            text-align: left;
          }
        }
      `}</style>

      {/* HEADER CARD */}
      <div className="header-card">
        <div>
          <h1 className="header-title">📖 PANDUAN PENGGUNAAN SISTEM</h1>
          <p style={{ margin: "5px 0 0 0", fontSize: "14px", color: "#64748b" }}>
            User: <strong>{user?.name}</strong> | Peran Aktif: <span className="role-badge">{user?.role?.toUpperCase()}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onViewMain} className="btn-import">
            ⬅️ Kembali ke Dashboard
          </button>
          <button onClick={onLogout} className="btn-logout">
            Keluar
          </button>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="filter-card">
        <div className="tab-menu">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
              {getDefaultTab() === t.id && " (Role Anda)"}
            </button>
          ))}
        </div>

        {/* ================= TAB 1: PIC WOOCOMMERCE ================= */}
        {activeTab === "pic" && (
          <div>
            <h2 className="guide-section-title">🔌 Panduan PIC - WooCommerce Sync</h2>
            
            <div className="alert-box alert-info">
              <span>💡</span>
              <div>
                <strong>Penting!</strong> Peran PIC dikhususkan untuk memantau harga produk Accurate dan mensinkronisasikannya secara otomatis ke toko online WooCommerce. Anda hanya diperbolehkan mengedit produk sesuai kategori Anda.
              </div>
            </div>

            <div className="guide-card-grid">
              <div className="info-card">
                <h3 className="info-card-title">💵 Struktur Level Harga</h3>
                <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                  Terdapat 3 jenis harga pada data produk:
                  <br /><br />
                  🔴 <span className="label-desc desc-cp">CP (Cost Price)</span>: Harga Modal produk.
                  <br />
                  🟠 <span className="label-desc desc-sp">SP (Selling Price)</span>: SRP / Harga Web (Harga yang disinkronisasi ke WooCommerce).
                  <br />
                  🟢 <span className="label-desc desc-price">PRICE</span>: Harga Jual Dealer.
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">🏷️ Kategori PIC</h3>
                <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                  Sistem membatasi produk berdasarkan PIC yang login:
                  <br /><br />
                  🖥️ <strong>PIC Komponen</strong>: VGA, RAM, SSD, HDD, Processor, Motherboard, PSU, Casing, dll.
                  <br />
                  💻 <strong>PIC Laptop & Printer</strong>: Laptop, Printer, Toner/Laser.
                  <br />
                  🎧 <strong>PIC Aksesoris</strong>: Mouse, Keyboard, Headset, Speaker, Kabel, Webcam, Mic, dll.
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#334155", marginBottom: "12px" }}>
              🛠️ Langkah-Langkah Kerja PIC (Dapat Dicentang):
            </h3>
            <ul className="step-list">
              {[
                "Cari produk yang ingin disesuaikan harganya lewat kolom 'PENCARIAN' atau filter Kategori/Brand.",
                "Perhatikan kolom 'SYNC KE WEB?'. Status '✅ YA' berarti barang ini sudah ter-mapping dengan produk WooCommerce. Status '❌ TIDAK' berarti belum ter-mapping.",
                "Klik tombol '✏️ Edit Harga' pada kolom aksi produk yang ingin diubah.",
                "Input harga baru pada kolom modal popup (CP, SP, atau PRICE). Masukkan angka bersih tanpa spasi/titik.",
                "Klik 'Konfirmasi/OK'. Jika harga SP (Harga Web) berubah, Supabase Edge Function akan langsung mengirimkan perubahan tersebut ke website WooCommerce (WordPress) secara otomatis dalam ~3-5 detik.",
                "Verifikasi perubahan harga berhasil dengan memeriksa status log di database atau mengecek langsung pada WordPress Staging (dev.hnsitcenter.id)."
              ].map((text, idx) => (
                <li key={idx} className="step-item" onClick={() => toggleStep("pic", idx)}>
                  <input
                    type="checkbox"
                    className="step-checkbox"
                    checked={!!completedSteps[`pic-${idx}`]}
                    onChange={() => {}}
                  />
                  <span className={`step-text ${completedSteps[`pic-${idx}`] ? "completed" : ""}`}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ================= TAB 2: ADMINISTRATOR ================= */}
        {activeTab === "admin" && (
          <div>
            <h2 className="guide-section-title">⚙️ Panduan Administrator</h2>
            
            <div className="alert-box alert-warning">
              <span>⚠️</span>
              <div>
                <strong>Perhatian!</strong> Hak akses Administrator memiliki kemampuan melakukan bulk operations (impor & sinkronisasi massal). Pastikan data Excel/Sheets yang digunakan sudah tervalidasi agar tidak merusak database produk.
              </div>
            </div>

            <div className="guide-card-grid">
              <div className="info-card">
                <h3 className="info-card-title">🔄 Sync dari Accurate</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Menarik seluruh data produk terbaru dari Google Sheets Master Data Accurate. Menambah produk baru dan memperbarui data lama.
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">📥 Import Pricelist Dealer</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Mengunggah file Excel Pricelist Dealer untuk memperbarui kuantitas stok serta kode Barcode (EAN) produk yang sudah ada di database.
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">♻️ Fix Harga / Restore Backup</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Mengembalikan harga dan stok dari file cadangan (Backup CSV) jika terjadi kesalahan input atau kegagalan sinkronisasi massal.
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#334155", marginBottom: "12px" }}>
              🛠️ Prosedur Kerja Administrator (Dapat Dicentang):
            </h3>
            <ul className="step-list">
              {[
                "Untuk sinkronisasi berkala dari Accurate: Klik tombol '🔄 Sync dari Accurate' (Tombol Biru), tunggu proses hingga muncul popup status sukses.",
                "Untuk update stok & barcode harian: Siapkan file Excel pricelist dealer terbaru, klik tombol '📥 Import Pricelist' (Tombol Hijau) lalu pilih file Excel tersebut.",
                "Jika terjadi anomali harga bernilai 0: Gunakan tombol '♻️ Fix Harga (Restore)' (Tombol Oranye) untuk memulihkan database dari file cadangan CSV.",
                "Tinjau transaksi mutasi stok yang pending dari staff toko di panel 'Transaksi Menunggu Approval'. Klik 'Approve Sekarang' untuk mengonfirmasi perpindahan fisik stok.",
                "Ekspor data katalog ke format PDF menggunakan tombol '📄 Export PDF' jika diperlukan untuk keperluan administrasi."
              ].map((text, idx) => (
                <li key={idx} className="step-item" onClick={() => toggleStep("admin", idx)}>
                  <input
                    type="checkbox"
                    className="step-checkbox"
                    checked={!!completedSteps[`admin-${idx}`]}
                    onChange={() => {}}
                  />
                  <span className={`step-text ${completedSteps[`admin-${idx}`] ? "completed" : ""}`}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ================= TAB 3: ADMIN GUDANG ================= */}
        {activeTab === "gudang" && (
          <div>
            <h2 className="guide-section-title">🧱 Panduan Admin Gudang</h2>

            <div className="alert-box alert-info">
              <span>📦</span>
              <div>
                <strong>Manajemen Fisik Stok:</strong> Admin Gudang berfokus pada keandalan stok fisik di gudang pusat maupun cabang, pencatatan mutasi barang, serta opname stok harian.
              </div>
            </div>

            <div className="guide-card-grid">
              <div className="info-card">
                <h3 className="info-card-title">📤 Transaksi Stok / Mutasi</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Mencatat perpindahan barang keluar masuk gudang utama ke cabang (Nagoya/Gateway) atau penyesuaian stok rusak/hilang.
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">📋 Cek Stok Harian</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Melakukan audit pencocokan stok fisik dengan sistem (Stock Opname) berkala guna meminimalkan selisih barang.
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">🔔 Alert Stok Tipis</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Notifikasi merah otomatis jika kuantitas barang tertentu berada di bawah batas minimum (segera ajukan restock).
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#334155", marginBottom: "12px" }}>
              🛠️ Panduan Operasional Gudang (Dapat Dicentang):
            </h3>
            <ul className="step-list">
              {[
                "Selalu pantau tombol '🔔 Alerts' berwarna merah. Jika diklik, panel akan menunjukkan produk apa saja yang kehabisan stok.",
                "Untuk memutasikan stok barang: Klik '📦 Transaksi Stok' -> Masukkan Cabang Asal dan Tujuan -> Masukkan Kode Barang & QTY -> Buat Transaksi.",
                "Setiap kali barang datang dari distributor, lakukan penambahan stok masuk menggunakan formulir Transaksi Stok tipe 'IN'.",
                "Jika ada barang rusak, lakukan pengurangan stok keluar menggunakan formulir Transaksi Stok tipe 'OUT' dengan keterangan 'Barang Rusak'.",
                "Gunakan pencarian di tabel untuk memeriksa lokasi persediaan spesifik (nagoya, gudang, gateway)."
              ].map((text, idx) => (
                <li key={idx} className="step-item" onClick={() => toggleStep("gudang", idx)}>
                  <input
                    type="checkbox"
                    className="step-checkbox"
                    checked={!!completedSteps[`gudang-${idx}`]}
                    onChange={() => {}}
                  />
                  <span className={`step-text ${completedSteps[`gudang-${idx}`] ? "completed" : ""}`}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ================= TAB 4: SALES TOKO ================= */}
        {activeTab === "sales_toko" && (
          <div>
            <h2 className="guide-section-title">🛒 Panduan Sales Toko / Cabang</h2>

            <div className="alert-box alert-info">
              <span>🏪</span>
              <div>
                <strong>Aktivitas Kasir Toko:</strong> Membantu mencatat pengurangan stok saat barang terjual secara real-time di kasir toko atau mencatat barang baru masuk ke toko.
              </div>
            </div>

            <div className="guide-card-grid">
              <div className="info-card">
                <h3 className="info-card-title">📸 Scanner Barcode Kamera</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Memanfaatkan kamera smartphone/laptop untuk scan barcode produk secara cepat tanpa perlu mengetik kode barang.
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">➕ Mode BARANG MASUK (IN)</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Digunakan ketika toko Anda menerima pasokan barang baru dari Gudang Utama (menambah stok cabang Anda).
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">➖ Mode BARANG KELUAR (OUT)</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Digunakan ketika barang terjual ke pembeli retail (mengurangi stok cabang Anda secara langsung).
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#334155", marginBottom: "12px" }}>
              🛠️ Langkah Transaksi Sales Toko (Dapat Dicentang):
            </h3>
            <ul className="step-list">
              {[
                "Pilih tipe mode transaksi terlebih dahulu: klik '➕ BARANG MASUK' (Hijau) atau '➖ BARANG KELUAR' (Merah) di bagian atas.",
                "Gunakan scanner: Klik '📸 BUKA SCANNER KAMERA' dan arahkan barcode produk ke kamera. Kamera otomatis mengisi kolom input.",
                "Gunakan input manual: Jika kamera bermasalah, ketik kode produk pada kolom 'INPUT MANUAL' di sebelah kiri.",
                "Tentukan jumlah barang (QTY) pada kolom input angka di sebelah kanan (default: 1).",
                "Klik tombol 'OK' atau tekan Enter untuk memproses transaksi. Tunggu notifikasi popup 'Berhasil'.",
                "Stok pada sistem gudang cabang Anda akan langsung terupdate secara real-time."
              ].map((text, idx) => (
                <li key={idx} className="step-item" onClick={() => toggleStep("sales_toko", idx)}>
                  <input
                    type="checkbox"
                    className="step-checkbox"
                    checked={!!completedSteps[`sales_toko-${idx}`]}
                    onChange={() => {}}
                  />
                  <span className={`step-text ${completedSteps[`sales_toko-${idx}`] ? "completed" : ""}`}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ================= TAB 5: SALES DEALER ================= */}
        {activeTab === "sales_dealer" && (
          <div>
            <h2 className="guide-section-title">🤝 Panduan Sales Dealer / B2B</h2>

            <div className="alert-box alert-info">
              <span>💼</span>
              <div>
                <strong>Penjualan Grosir:</strong> Sales Dealer berfokus untuk menawarkan barang kepada mitra/dealer, memantau level harga dealer (PRICE), dan membuat katalog cetak.
              </div>
            </div>

            <div className="guide-card-grid">
              <div className="info-card">
                <h3 className="info-card-title">🗂️ Memory Selection (Checklist)</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Mencentang produk-produk tertentu secara selektif. Centangan tidak akan hilang meskipun Anda mengganti pencarian barang.
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">📄 Ekspor Katalog PDF</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Menghasilkan file PDF daftar produk yang Anda centang lengkap dengan harga dealer dan status ketersediaannya (Ready/Kosong).
                </p>
              </div>

              <div className="info-card">
                <h3 className="info-card-title">✏️ Penyesuaian Harga Dealer</h3>
                <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                  Mengedit Harga Dealer (PRICE), Harga Modal (CP), dan SRP (SP) langsung dari baris produk jika memiliki wewenang.
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#334155", marginBottom: "12px" }}>
              🛠️ Panduan Operasional Sales Dealer (Dapat Dicentang):
            </h3>
            <ul className="step-list">
              {[
                "Gunakan fitur pencarian untuk menemukan barang-barang yang sering dipesan oleh dealer mitra Anda.",
                "Centang kotak checklist di sebelah kiri kode barang untuk menambahkannya ke antrean ekspor katalog.",
                "Ganti kata pencarian untuk mencari produk lain, lalu centang kembali. Total barang terpilih akan diakumulasikan (terlihat pada header halaman).",
                "Klik tombol merah '📄 Export (N)' untuk mengunduh katalog PDF berisi daftar barang terpilih.",
                "Bagikan katalog PDF tersebut kepada dealer/klien mitra Anda.",
                "Jika ingin mereset seluruh filter pencarian dan multi-select kategori, klik tombol abu-abu '🔄 Reset'."
              ].map((text, idx) => (
                <li key={idx} className="step-item" onClick={() => toggleStep("sales_dealer", idx)}>
                  <input
                    type="checkbox"
                    className="step-checkbox"
                    checked={!!completedSteps[`sales_dealer-${idx}`]}
                    onChange={() => {}}
                  />
                  <span className={`step-text ${completedSteps[`sales_dealer-${idx}`] ? "completed" : ""}`}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default GuidePage;
