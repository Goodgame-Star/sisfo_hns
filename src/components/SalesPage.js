import React, { useState, useEffect, useMemo, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import Swal from "sweetalert2";
import { supabase } from "./supabaseClient";
import { styles } from "./DashboardHelpers";

function SalesPage({ user, onLogout, onShowGuide }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [scanMode, setScanMode] = useState("OUT");
  const [manualInput, setManualInput] = useState("");
  const [qty, setQty] = useState(1);
  const [showScanner, setShowScanner] = useState(false);

  const scannerRef = useRef(null);
  const barcodeRef = useRef(null);

  // ================= LOAD DATA =================
  const loadStock = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("LOKASI", user.lokasi_akses || user.location);

    setProducts(data || []);
  };

  useEffect(() => {
    loadStock();
    barcodeRef.current?.focus();
  }, []);

  // ================= CAMERA =================
  useEffect(() => {
    if (!showScanner) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 120 } },
      false
    );

    scanner.render(
      (decodedText) => {
        setManualInput(decodedText);
        setShowScanner(false);
        scanner.clear();
        Swal.fire({
          icon: "success",
          title: "Barcode terbaca",
          timer: 900,
          showConfirmButton: false,
        });
        barcodeRef.current?.focus();
      },
      () => {}
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [showScanner]);

  // ================= TRANSACTION =================
  const processTransaction = async (kode) => {
    if (!kode) return;

    const item = products.find(p => p["Kode Accurate"] === kode);
    if (!item) {
      setManualInput("");
      return Swal.fire("Gagal", "Barang tidak ditemukan", "error");
    }

    const stok = parseInt(item["Stok Sistem"] || 0);
    if (scanMode === "OUT" && stok < qty) {
      return Swal.fire("Stok Kurang", `Sisa ${stok}`, "warning");
    }

    const newStock = scanMode === "IN" ? stok + qty : stok - qty;

    await supabase.from("products")
      .update({ "Stok Sistem": newStock })
      .eq("Kode Accurate", kode);

    await supabase.from("rekap_sales").insert([{
      sales_name: user.nama || user.name,
      lokasi: user.lokasi_akses || user.location,
      kode_barang: kode,
      jumlah: qty,
      tanggal: new Date().toISOString()
    }]);

    Swal.fire({ icon: "success", title: "Berhasil", timer: 800, showConfirmButton: false });
    setManualInput("");
    setQty(1);
    loadStock();
    barcodeRef.current?.focus();
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p["NAMA BARANG"].toLowerCase().includes(search.toLowerCase()) ||
      p["Kode Accurate"].toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  // ================= UI =================
  return (
    <div className="dashboard-wrapper" style={{ background: "#f4f6f8" }}>
      <style>{styles}</style>

      {/* HEADER */}
      <div className="header-card" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <h1 className="header-title">📦 {user.lokasi_akses || user.location}</h1>
          <small>{user.nama || user.name}</small>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onShowGuide} className="btn-print" style={{ background: "#3182ce" }}>
            📖 Panduan
          </button>
          <button onClick={onLogout} className="btn-logout">Keluar</button>
        </div>
      </div>

      {/* MODE */}
      <div className="filter-card">
        <div style={{ display: "flex", gap: 8 }}>
          {["IN", "OUT"].map(m => (
            <button
              key={m}
              onClick={() => setScanMode(m)}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 12,
                fontWeight: "bold",
                border: "none",
                background: scanMode === m ? (m === "IN" ? "#16a34a" : "#dc2626") : "#e5e7eb",
                color: scanMode === m ? "white" : "#111"
              }}
            >
              {m === "IN" ? "➕ BARANG MASUK" : "➖ BARANG KELUAR"}
            </button>
          ))}
        </div>
      </div>

      {/* CAMERA */}
      <div className="filter-card">
        <button
          onClick={() => setShowScanner(!showScanner)}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 12,
            border: "none",
            background: showScanner ? "#ef4444" : "#0ea5e9",
            color: "white",
            fontWeight: "bold"
          }}
        >
          {showScanner ? "❌ TUTUP KAMERA" : "📸 BUKA SCANNER KAMERA"}
        </button>

        {showScanner && (
          <div
            id="qr-reader"
            style={{
              marginTop: 12,
              borderRadius: 12,
              overflow: "hidden",
              background: "white",
              padding: 8
            }}
          />
        )}
      </div>

      {/* INPUT */}
      <div className="filter-card">
        <label style={{ fontSize: 12, fontWeight: "bold" }}>INPUT MANUAL</label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            ref={barcodeRef}
            className="input-field"
            placeholder="Kode Barang"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && processTransaction(manualInput)}
          />
          <input
            type="number"
            className="input-field"
            style={{ width: 70, textAlign: "center" }}
            value={qty}
            onChange={e => setQty(parseInt(e.target.value) || 1)}
          />
          <button
            onClick={() => processTransaction(manualInput)}
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "0 18px",
              fontWeight: "bold"
            }}
          >
            OK
          </button>
        </div>
      </div>

      {/* LIST */}
      <div style={{ padding: "0 10px 80px" }}>
        <input
          className="input-field"
          placeholder="Cari barang..."
          onChange={e => setSearch(e.target.value)}
        />

        {filteredProducts.map(item => (
          <div
            key={item["Kode Accurate"]}
            onClick={() => setManualInput(item["Kode Accurate"])}
            style={{
              background: "white",
              borderRadius: 14,
              padding: 14,
              marginTop: 10,
              boxShadow: "0 2px 6px rgba(0,0,0,.06)",
              cursor: "pointer"
            }}
          >
            <strong>{item["Kode Accurate"]}</strong>
            <div style={{ fontSize: 12, color: "#555" }}>{item["NAMA BARANG"]}</div>
            <div style={{ marginTop: 6, fontWeight: "bold" }}>
              Stok: {item["Stok Sistem"]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SalesPage;
