import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { styles } from "./DashboardHelpers";
import {
  supabase,
  getPendingMovements,
  approveStockMovement,
} from "./supabaseClient";
import SalesMonitoringPage from "./SalesMonitoringPage";

function AdminGudangPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isImporting, setIsImporting] = useState(false);
  const [pendingMovements, setPendingMovements] = useState([]);

  // loadData gua bungkus useCallback biar aman buat dependency array
  const loadData = useCallback(async () => {
    const pending = await getPendingMovements("all");
    setPendingMovements(pending || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (mId) => {
    const result = await Swal.fire({
      title: "Setujui Mutasi?",
      text: "Stok akan otomatis berpindah antar lokasi.",
      icon: "question",
      showCancelButton: true,
    });

    if (result.isConfirmed) {
      await approveStockMovement(mId, user.id);
      loadData();
      Swal.fire("Selesai!", "Mutasi berhasil di-approve.", "success");
    }
  };

  // FUNGSI IMPORT (Sudah gua tambahin ASYNC biar gak error 'await' lagi)
  const handleImportAccurate = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    // - Ditambah async di sini
    reader.onload = async (evt) => {
      setIsImporting(true);
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      Swal.fire({
        title: "Sinkronisasi...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // Mapping kolom sesuai file "PRICELIST DEALER - master (3).csv"
      const updates = data
        .map((item) => ({
          "Kode Accurate": String(item["Kode Accurate"] || "").trim(),
          "NAMA BARANG": item["NAMA BARANG"],
          KATEGORI: item["KATEGORI"],
          "NAMA BRAND": item["NAMA BRAND"],
          CP: item["CP"] || 0,
          SP: item["SP"] || 0,
          PRICE: item["PRICE"] || 0,
          "TANGGAL UPDATE": new Date().toLocaleString("id-ID"),
        }))
        .filter(
          (item) =>
            item["Kode Accurate"] && item["Kode Accurate"] !== "undefined",
        );

      // - Await di sini sekarang aman karena sudah di dalam fungsi async
      const { error } = await supabase
        .from("products")
        .upsert(updates, { onConflict: "Kode Accurate" });

      setIsImporting(false);
      if (!error) {
        Swal.fire(
          "Berhasil!",
          `Database diperbarui dengan ${updates.length} produk.`,
          "success",
        );
        loadData();
      } else {
        Swal.fire("Gagal", error.message, "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f1f5f9",
        width: "100vw",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <style>{styles}</style>

      {/* SIDEBAR NAVIGATION */}
      <div
        style={{
          width: "260px",
          background: "#1e293b",
          color: "white",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            marginBottom: "30px",
            textAlign: "center",
            borderBottom: "1px solid #334155",
            paddingBottom: "10px",
          }}
        >
          📦 HNS ADMIN
        </h2>

        <button
          onClick={() => setActiveTab("dashboard")}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "dashboard" ? "#3b82f6" : "transparent",
            color: "white",
            cursor: "pointer",
            textAlign: "left",
            fontWeight: "bold",
          }}
        >
          🏠 Approval Mutasi
        </button>

        <button
          onClick={() => setActiveTab("monitoring")}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "monitoring" ? "#3b82f6" : "transparent",
            color: "white",
            cursor: "pointer",
            textAlign: "left",
            fontWeight: "bold",
          }}
        >
          📊 Monitoring Sales
        </button>

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background: "#ef4444",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            🚪 Keluar
          </button>
        </div>
      </div>

      {/* AREA KONTEN UTAMA */}
      <div style={{ flex: 1, padding: "30px", overflowY: "auto" }}>
        {activeTab === "dashboard" ? (
          <div className="dashboard-wrapper">
            <div className="header-card" style={{ marginBottom: "30px" }}>
              <h1 className="header-title">🛡️ DASHBOARD GUDANG</h1>
              <p>
                Admin: <strong>{user?.name}</strong> | Kelola Data & Approval
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 350px",
                gap: "25px",
              }}
            >
              {/* KOLOM KIRI: APPROVAL */}
              <div
                style={{
                  background: "white",
                  padding: "25px",
                  borderRadius: "16px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                }}
              >
                <h2 style={{ marginBottom: "20px", fontSize: "18px" }}>
                  ⏳ Antrean Approval Mutasi ({pendingMovements.length})
                </h2>
                {pendingMovements.length === 0 ? (
                  <p
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: "40px",
                    }}
                  >
                    ☕ Aman Yan, belum ada kiriman barang antar store.
                  </p>
                ) : (
                  pendingMovements.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "15px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <strong>{m.products?.["NAMA BARANG"]}</strong>
                        <br />
                        <small>
                          {m.qty} UNIT | {m.from_location?.toUpperCase()} ➡️{" "}
                          {m.to_location?.toUpperCase()}
                        </small>
                      </div>
                      <button
                        onClick={() => handleApprove(m.id)}
                        style={{
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        APPROVE
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* KOLOM KANAN: MASTER TOOLS */}
              <div
                style={{
                  background: "white",
                  padding: "25px",
                  borderRadius: "16px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                }}
              >
                <h3 style={{ marginBottom: "15px" }}>🛠️ Master Data</h3>
                <input
                  type="file"
                  id="sync-acc"
                  style={{ display: "none" }}
                  onChange={handleImportAccurate}
                />
                <label
                  htmlFor="sync-acc"
                  className="btn-import"
                  style={{
                    cursor: "pointer",
                    background: "#10b981",
                    display: "block",
                    textAlign: "center",
                    marginBottom: "12px",
                  }}
                >
                  {isImporting ? "⏳ Sinkron..." : "📥 Sync Master"}
                </label>
                <button
                  onClick={() => Swal.fire("Fitur Manual Segera Hadir")}
                  style={{
                    width: "100%",
                    background: "#3182ce",
                    color: "white",
                    border: "none",
                    padding: "10px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  ➕ Tambah Barang
                </button>
                <div
                  style={{
                    marginTop: "20px",
                    fontSize: "12px",
                    color: "#64748b",
                    fontStyle: "italic",
                  }}
                >
                  Note: Import Master Data menggunakan format "Pricelist
                  Dealer".
                </div>
              </div>
            </div>
          </div>
        ) : (
          <SalesMonitoringPage />
        )}
      </div>
    </div>
  );
}

export default AdminGudangPage;
