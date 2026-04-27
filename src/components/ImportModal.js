import React, { useState } from "react";
import Swal from "sweetalert2";
import Papa from "papaparse";
import { supabase } from "./supabaseClient";

function ImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const fileInputRef = React.useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      console.log("File selected:", selectedFile.name);
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      Swal.fire("Gagal", "Pilih file CSV dulu!", "warning");
      return;
    }

    console.log("Starting import...", file.name);
    setLoading(true);
    setProgress("📖 Membaca file CSV...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const dataFromCSV = results.data;
        console.log("CSV parsed, rows:", dataFromCSV.length);
        setProgress(`✅ File terbaca: ${dataFromCSV.length} baris`);

        // 1. FUNGSI MEMBERSIHKAN NAMA DARI SIMBOL ANEH
        const cleanText = (txt) => {
          if (!txt) return "";
          return txt
            .toString()
            .replace(/[\r\n]+/gm, " ") // Hapus Enter/Line Break
            .replace(/"/g, "") // Hapus tanda kutip
            .replace(/\s+/g, " ") // Rapikan spasi ganda
            .trim();
        };

        // 2. FUNGSI MEMBERSIHKAN HARGA (Ambil angka saja)
        const cleanPrice = (val) => {
          if (!val || val === "NULL" || val === "" || val === "0") return null;
          // Hapus "Rp", koma, titik, dan ambil angka saja
          const cleaned = val.toString().replace(/[^0-9]/g, "");
          return cleaned && cleaned !== "0" ? parseInt(cleaned) : null;
        };

        // 3. AMBIL SEMUA KODE BARANG YANG SUDAH ADA DI DATABASE (dengan data lengkap)
        setProgress("🔍 Mengecek data existing...");
        let allExisting = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        // Loop untuk ambil SEMUA data existing (karena bisa 5000+)
        while (hasMore) {
          const { data, error } = await supabase
            .from("products")
            .select("*") // Ambil semua field untuk merge
            .range(from, to);

          if (error) {
            console.error("Error fetching existing:", error);
            hasMore = false;
          } else if (data && data.length > 0) {
            allExisting = [...allExisting, ...data];
            setProgress(`🔍 Mengecek... ${allExisting.length} data ditemukan`);
            if (data.length < 1000) {
              hasMore = false;
            } else {
              from += 1000;
              to += 1000;
            }
          } else {
            hasMore = false;
          }
        }

        console.log("Existing products:", allExisting.length);
        setProgress(`✅ ${allExisting.length} barang sudah ada di database`);

        // Buat Map untuk lookup cepat (key: kode uppercase)
        const existingMap = new Map();
        allExisting.forEach((p) => {
          const normalizedKode = String(p["Kode Accurate"])
            .trim()
            .toUpperCase();
          existingMap.set(normalizedKode, p);
        });

        // 4. PISAHKAN BARANG BARU vs BARANG LAMA (dengan merge)
        setProgress("🔄 Memproses data...");
        const newProducts = [];
        const updateProducts = [];

        dataFromCSV.forEach((item) => {
          const kode = cleanText(item["Kode Accurate"]);
          if (!kode) return; // Skip kalau kode kosong

          // Normalize kode untuk matching (trim + uppercase)
          const normalizedKode = kode.trim().toUpperCase();
          const existingProduct = existingMap.get(normalizedKode);

          if (existingProduct) {
            // === BARANG LAMA: MERGE dengan data existing ===
            // Ambil harga & stok dari database (PROTECT!)
            const mergedData = {
              "Kode Accurate": existingProduct["Kode Accurate"], // Pakai kode original
              "NAMA BARANG": cleanText(item["NAMA BARANG"]),
              KATEGORI: cleanText(item.KATEGORI),
              "NAMA BRAND": cleanText(item["NAMA BRAND"]),
              STATUS: item.STATUS || "KOSONG",
              "NON AKTIF": item["NON AKTIF"] || "TIDAK",
              "Stok Sistem": cleanText(item["Stok Sistem"]),
              // PROTECT: Pakai harga dari database
              CP: existingProduct.CP,
              SP: existingProduct.SP,
              PRICE: existingProduct.PRICE,
              "TANGGAL UPDATE": new Date().toLocaleString(),
            };
            updateProducts.push(mergedData);
          } else {
            // === BARANG BARU: Insert SEMUA DATA termasuk harga ===
            const newData = {
              "Kode Accurate": kode,
              "NAMA BARANG": cleanText(item["NAMA BARANG"]),
              KATEGORI: cleanText(item.KATEGORI),
              "NAMA BRAND": cleanText(item["NAMA BRAND"]),
              STATUS: item.STATUS || "KOSONG",
              "NON AKTIF": item["NON AKTIF"] || "TIDAK",
              CP: cleanPrice(item.CP) || 0,
              SP: cleanPrice(item.SP) || 0,
              PRICE: cleanPrice(item.PRICE) || 0,
              "Stok Sistem": parseFloat(item["Stok Sistem"] || 0),
              "TANGGAL UPDATE": new Date().toLocaleString(),
            };
            newProducts.push(newData);
          }
        });

        console.log("New products:", newProducts.length);
        console.log("Update products:", updateProducts.length);
        setProgress(
          `📊 ${newProducts.length} barang baru, ${updateProducts.length} barang update`
        );

        try {
          let insertCount = 0;
          let updateCount = 0;
          let duplicateCount = 0;

          // 5. INSERT BARANG BARU (Batch 500 records)
          if (newProducts.length > 0) {
            setProgress(`💾 Menambahkan ${newProducts.length} barang baru...`);
            for (let i = 0; i < newProducts.length; i += 500) {
              const batch = newProducts.slice(i, i + 500);
              setProgress(
                `💾 Insert batch ${Math.floor(i / 500) + 1}/${Math.ceil(
                  newProducts.length / 500
                )}...`
              );
              const { data, error } = await supabase
                .from("products")
                .insert(batch);

              if (error) {
                // Jika ada duplicate, coba insert satu-satu
                if (error.code === "23505") {
                  console.warn(
                    "Batch insert failed (duplicate), trying one by one..."
                  );
                  for (const product of batch) {
                    const { error: singleError } = await supabase
                      .from("products")
                      .insert([product]);

                    if (singleError) {
                      if (singleError.code === "23505") {
                        duplicateCount++;
                        console.log(
                          "Duplicate skipped:",
                          product["Kode Accurate"]
                        );
                      } else {
                        throw singleError;
                      }
                    } else {
                      insertCount++;
                    }
                  }
                } else {
                  throw error;
                }
              } else {
                insertCount += batch.length;
              }
            }
          }

          // 6. UPDATE BARANG LAMA (Upsert dengan data lengkap yang sudah di-merge)
          if (updateProducts.length > 0) {
            setProgress(
              `🔄 Mengupdate ${updateProducts.length} barang lama...`
            );

            // Batch upsert 500 records at a time
            for (let i = 0; i < updateProducts.length; i += 500) {
              const batch = updateProducts.slice(i, i + 500);
              setProgress(
                `🔄 Update batch ${Math.floor(i / 500) + 1}/${Math.ceil(
                  updateProducts.length / 500
                )}...`
              );

              const { error } = await supabase.from("products").upsert(batch, {
                onConflict: "Kode Accurate",
                ignoreDuplicates: false,
              });

              if (error) {
                console.error("Batch update error:", error);
                // Fallback: coba satu-satu
                for (const product of batch) {
                  const { error: singleError } = await supabase
                    .from("products")
                    .upsert([product], {
                      onConflict: "Kode Accurate",
                      ignoreDuplicates: false,
                    });

                  if (!singleError) updateCount++;
                  else
                    console.error(
                      "Single update error:",
                      singleError,
                      product["Kode Accurate"]
                    );
                }
              } else {
                updateCount += batch.length;
              }
            }
          }

          Swal.fire({
            icon: "success",
            title: "Import Selesai!",
            html: `
                            <div style="text-align: left; padding: 10px;">
                                <p>✅ <b>${insertCount}</b> barang BARU ditambahkan (dengan harga)</p>
                                <p>🔄 <b>${updateCount}</b> barang LAMA diupdate (metadata saja)</p>
                                ${
                                  duplicateCount > 0
                                    ? `<p>⚠️ <b>${duplicateCount}</b> duplikat dilewati</p>`
                                    : ""
                                }
                                <p style="color: #16a34a; font-size: 12px; margin-top: 10px;">
                                    💰 Harga & Stok barang lama AMAN (tidak berubah)
                                </p>
                            </div>
                        `,
          });

          onSuccess();
          onClose();
          setFile(null);
        } catch (err) {
          console.error("Import error:", err);
          Swal.fire("Gagal", err.message, "error");
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        console.error("CSV Parse error:", err);
        setLoading(false);
        Swal.fire("Error", `Gagal parsing CSV: ${err.message}`, "error");
      },
    });
  };

  const handleClose = () => {
    if (!loading) {
      setFile(null);
      setProgress("");
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "white",
          padding: "35px",
          borderRadius: "16px",
          width: "500px",
          maxWidth: "90%",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#2d3748", fontSize: "24px" }}>
          📂 Import Master Data Accurate
        </h2>

        <div
          style={{
            background: "#f0fdf4",
            border: "2px solid #86efac",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              color: "#166534",
              fontSize: "13px",
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            <b>✅ Barang BARU:</b> Semua data termasuk harga akan diinput
            <br />
            <b>🔄 Barang LAMA:</b> Hanya update nama, kategori, brand
            <br />
            <b>🛡️ PROTEKSI:</b> Harga (CP, SP, PRICE) & Stok TIDAK BERUBAH
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            htmlFor="csv-file-input"
            style={{
              display: "block",
              padding: "15px",
              border: "2px dashed #cbd5e0",
              borderRadius: "8px",
              textAlign: "center",
              cursor: "pointer",
              background: file ? "#f0fdf4" : "#f7fafc",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#edf2f7")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = file ? "#f0fdf4" : "#f7fafc")
            }
          >
            <input
              id="csv-file-input"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            {file ? (
              <div>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#16a34a",
                  }}
                >
                  {file.name}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#166534",
                    marginTop: "4px",
                  }}
                >
                  {(file.size / 1024).toFixed(2)} KB
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>📂</div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#4a5568",
                  }}
                >
                  Klik untuk pilih file CSV
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#718096",
                    marginTop: "4px",
                  }}
                >
                  atau drag & drop file di sini
                </div>
              </div>
            )}
          </label>
        </div>

        {loading && progress && (
          <div
            style={{
              background: "#eff6ff",
              border: "2px solid #3b82f6",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "15px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-block",
                width: "16px",
                height: "16px",
                border: "3px solid #3b82f6",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginRight: "8px",
                verticalAlign: "middle",
              }}
            />
            <span
              style={{
                color: "#1e40af",
                fontSize: "13px",
                fontWeight: "bold",
                verticalAlign: "middle",
              }}
            >
              {progress}
            </span>
          </div>
        )}

        <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: "12px 24px",
              border: "none",
              background: loading ? "#cbd5e0" : "#e2e8f0",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              color: "#1a202c",
            }}
          >
            Batal
          </button>
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            style={{
              padding: "12px 24px",
              border: "none",
              background: loading || !file ? "#94a3b8" : "#3182ce",
              color: "white",
              borderRadius: "8px",
              cursor: loading || !file ? "not-allowed" : "pointer",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            {loading ? "⏳ Memproses Data..." : "🚀 Import Sekarang"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
