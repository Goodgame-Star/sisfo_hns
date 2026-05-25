import * as XLSX from "xlsx";
import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import { styles, MultiSelect } from "./DashboardHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  supabase,
  canSeePrices,
  getStockSummaryByLocation,
  getUnreadAlerts,
  getPendingMovements,
  approveStockMovement,
} from "./supabaseClient";
import StockMovementModal from "./StockMovementModal";
import DailyStockCheckModal from "./DailyStockCheckModal";
import StockAlertsPanel from "./StockAlertsPanel";

function Dashboard({ user, onLogout, onShowGuide }) {
  const [products, setProducts] = useState([]);
  const [stockLocations, setStockLocations] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCats, setFilterCats] = useState([]);
  const [filterBrands, setFilterBrands] = useState([]);
  const [status, setStatus] = useState("Semua");
  const [sortConfig, setSortConfig] = useState({
    key: "TANGGAL UPDATE",
    direction: "desc",
  });
  const [checked, setChecked] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  const [filterLocation, setFilterLocation] = useState(
    user?.location !== "all" ? user?.location : "gudang",
  );

  const [isStockMovementOpen, setIsStockMovementOpen] = useState(false);
  const [isDailyCheckOpen, setIsDailyCheckOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  const [unreadAlerts, setUnreadAlerts] = useState([]);
  const [pendingMovements, setPendingMovements] = useState([]);

  const showPrices = canSeePrices(user?.role);

  useEffect(() => {
    loadData();
    loadAlerts();
    loadPendingMovements();

    const interval = setInterval(() => {
      loadAlerts();
      loadPendingMovements();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLocation]);

  // --- FUNGSI: SYNC DARI GOOGLE SHEETS (ACCURATE) ---
  const handleSyncFromSheets = async () => {
    setIsSyncingSheets(true);
    try {
      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://hptfudqtrnyeqcqhhaeh.supabase.co";
      const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-from-sheets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
      });

      const result = await res.json();

      if (result.status === "success") {
        Swal.fire({
          icon: "success",
          title: "Sync Berhasil!",
          html: `
            <div style="text-align:left; font-size:14px;">
              <p>📥 <b>${result.inserted}</b> produk baru ditambahkan</p>
              <p>🔄 <b>${result.updated}</b> produk diupdate</p>
              ${result.errors > 0 ? `<p style="color:red">❌ <b>${result.errors}</b> error</p>` : ""}
              <p style="color:#718096; font-size:12px; margin-top:8px;">
                ${result.rows_fetched} baris dari Google Sheets • ${result.duration_ms}ms
              </p>
            </div>
          `,
        });
        loadData();
      } else {
        Swal.fire("Gagal", result.message || "Terjadi kesalahan", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Tidak bisa menghubungi server: " + err.message, "error");
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // --- FUNGSI 1: IMPORT CERDAS (UPDATE DATA BARU + BARCODE) ---
  // Tombol HIJAU. Gunakan dengan file "PRICELIST DEALER.xlsx" atau CSV-nya.
  // Fitur Baru: Membaca kolom 'Barcode_ean' jika ada.
  const handleImportAccurate = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (evt) => {
      setIsImporting(true);
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        Swal.fire({
          title: "Import Data Dealer...",
          text: "Memproses Barang Baru & Update Barcode...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        const { data: existingData } = await supabase
          .from("products")
          .select('"Kode Accurate"');

        const existingCodes = new Set(
          existingData?.map((p) => p["Kode Accurate"]) || [],
        );

        let newCount = 0;
        let updateCount = 0;

        const updates = data
          .map((item) => {
            let code = String(
              item["Kode Accurate"] || item["KODE"] || "",
            ).trim();
            // Bersihkan format kode dari Excel (misal 1001.0 jadi 1001)
            if (code.endsWith(".0")) code = code.slice(0, -2);
            if (!code || code === "undefined") return null;

            const stock =
              item["QUANTITY"] ||
              item["STOK"] ||
              item["SALDO"] ||
              item["Stok Sistem"] ||
              0;
            const barcode =
              item["Barcode_ean"] ||
              item["barcode_ean"] ||
              item["BARCODE"] ||
              "";
            const timestamp = new Date().toLocaleString("id-ID");

            if (existingCodes.has(code)) {
              // BARANG LAMA: Update Stok, Barcode & Tanggal.
              // Harga TIDAK diubah agar aman.
              updateCount++;
              return {
                "Kode Accurate": code,
                "Stok Sistem": stock,
                barcode_ean: String(barcode).trim(), // Update Barcode juga
                "TANGGAL UPDATE": timestamp,
              };
            } else {
              // BARANG BARU: Insert Lengkap
              newCount++;
              return {
                "Kode Accurate": code,
                "NAMA BARANG": item["NAMA BARANG"] || item["NAMA"],
                KATEGORI: item["KATEGORI"],
                "NAMA BRAND": item["NAMA BRAND"] || item["BRAND"],
                barcode_ean: String(barcode).trim(),
                CP: item["CP"] || 0,
                SP: item["SP"] || 0,
                PRICE: item["PRICE"] || 0,
                "Stok Sistem": stock,
                STATUS: item["STATUS"] || "KOSONG",
                "TANGGAL UPDATE": timestamp,
              };
            }
          })
          .filter(Boolean);

        const { error } = await supabase
          .from("products")
          .upsert(updates, { onConflict: "Kode Accurate" });

        if (!error) {
          Swal.fire({
            title: "Selesai!",
            html: `
              <div style="text-align: left;">
                ✅ <b>${newCount}</b> Barang Baru Masuk.<br/>
                🔄 <b>${updateCount}</b> Barang Lama Diupdate (Stok & Barcode).<br/>
                <i>Harga barang lama tidak berubah.</i>
              </div>
            `,
            icon: "success",
          });
          loadData();
        } else {
          throw error;
        }
      } catch (error) {
        Swal.fire("Gagal", error.message, "error");
      } finally {
        setIsImporting(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- FUNGSI 2: RESTORE BACKUP (PEMULIHAN HARGA) ---
  // Tombol ORANYE. Gunakan file "products_rows (2).csv" untuk fix harga 0.
  const handleRestoreData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setIsImporting(true);
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        Swal.fire({
          title: "Memulihkan Data...",
          text: `Mengembalikan ${data.length} data (Harga & Stok akan ditimpa dari file backup)`,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        const cleanPrice = (val) => {
          if (!val) return 0;
          if (typeof val === "number") return val;
          const clean = String(val).replace(/[^0-9]/g, "");
          return parseInt(clean) || 0;
        };

        const updates = data
          .map((item) => {
            let code = String(
              item["Kode Accurate"] || item["KODE"] || "",
            ).trim();
            if (code.endsWith(".0")) code = code.slice(0, -2);
            if (!code) return null;

            return {
              "Kode Accurate": code,
              "NAMA BARANG": item["NAMA BARANG"],
              KATEGORI: item["KATEGORI"],
              "NAMA BRAND": item["NAMA BRAND"],
              barcode_ean: String(
                item["barcode_ean"] ||
                  item["Barcode_ean"] ||
                  item["barcode"] ||
                  "",
              ).trim(),

              // PAKSA RESTORE HARGA
              CP: cleanPrice(item["CP"] || item["MODAL"]),
              SP: cleanPrice(item["SP"] || item["SRP"]),
              PRICE: cleanPrice(item["PRICE"] || item["HARGA"] || item["JUAL"]),

              "Stok Sistem": parseInt(
                item["Stok Sistem"] || item["QUANTITY"] || item["STOK"] || 0,
              ),
              STATUS: item["STATUS"] || "KOSONG",
              "TANGGAL UPDATE": new Date().toLocaleString("id-ID"),
            };
          })
          .filter(Boolean);

        const { error } = await supabase
          .from("products")
          .upsert(updates, { onConflict: "Kode Accurate" });

        if (!error) {
          Swal.fire(
            "Restore Sukses!",
            "Harga dan Stok sudah dikembalikan sesuai file backup.",
            "success",
          );
          loadData();
        } else {
          throw error;
        }
      } catch (error) {
        Swal.fire("Gagal Restore", error.message, "error");
      } finally {
        setIsImporting(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  const loadData = async () => {
    const { data: productsData, error } = await supabase
      .from("products")
      .select("*")
      .order("NAMA BARANG")
      .range(0, 9999);

    if (error) console.error("Error loading products:", error);
    setProducts(productsData || []);

    const stockData = await getStockSummaryByLocation(filterLocation);
    setStockLocations(stockData || []);
  };

  const loadAlerts = async () => {
    if (!user?.location) return;
    const alerts = await getUnreadAlerts(user.location);
    setUnreadAlerts(alerts || []);
  };

  const loadPendingMovements = async () => {
    if (["administrator", "admin_gudang"].includes(user?.role)) {
      const pending = await getPendingMovements(user?.location || "all");
      setPendingMovements(pending || []);
    }
  };

  const formatRp = (n) => {
    const num = typeof n === "string" ? parseInt(n.replace(/[^0-9]/g, "")) : n;
    if (!num || isNaN(num)) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const uniqueCats = useMemo(() => {
    return [...new Set(products.map((i) => i.KATEGORI).filter(Boolean))].sort();
  }, [products]);

  const uniqueBrands = useMemo(() => {
    return [
      ...new Set(products.map((i) => i["NAMA BRAND"]).filter(Boolean)),
    ].sort();
  }, [products]);

  const processedProducts = useMemo(() => {
    const merged = products.map((product) => {
      const stock = stockLocations.find(
        (s) => s.kode_barang === product["Kode Accurate"],
      );
      const rawStock = stock ? stock.qty : product["Stok Sistem"] || 0;

      return {
        ...product,
        stock_qty: rawStock,
        stock_location: stock?.location || filterLocation,
      };
    });

    let result = [...merged];

    if (search) {
      const terms = search
        .toLowerCase()
        .split(" ")
        .filter((t) => t.trim());
      result = result.filter((p) => {
        const text =
          `${p["Kode Accurate"]} ${p["NAMA BARANG"]} ${p.barcode_ean || ""}`.toLowerCase();
        return terms.every((t) => text.includes(t));
      });
    }

    if (filterCats.length > 0)
      result = result.filter((p) => filterCats.includes(p.KATEGORI));
    if (filterBrands.length > 0)
      result = result.filter((p) => filterBrands.includes(p["NAMA BRAND"]));

    if (status === "Ready") {
      result = result.filter((p) => p.stock_qty > 0);
    } else if (status === "Kosong") {
      result = result.filter((p) => p.stock_qty <= 0);
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let vA = a[sortConfig.key] || "";
        let vB = b[sortConfig.key] || "";
        return sortConfig.direction === "asc"
          ? vA > vB
            ? 1
            : -1
          : vA < vB
            ? 1
            : -1;
      });
    }

    return result;
  }, [
    products,
    stockLocations,
    search,
    filterCats,
    filterBrands,
    status,
    sortConfig,
    filterLocation,
  ]);

  const handleExportPDF = () => {
    const dataToPrint =
      Object.keys(checked).length > 0
        ? processedProducts.filter((p) => checked[p["Kode Accurate"]])
        : processedProducts;

    if (dataToPrint.length === 0)
      return Swal.fire("Info", "Tidak ada data untuk di-export", "info");

    const doc = new jsPDF();
    doc.text(
      `HNS IT CENTER - KATALOG ${(filterLocation || "").toUpperCase()}`,
      14,
      15,
    );

    const rows = dataToPrint.map((item) => [
      item["Kode Accurate"],
      item["NAMA BARANG"],
      showPrices ? formatRp(item.PRICE) : "-",
      item.stock_qty,
    ]);

    autoTable(doc, {
      head: [["Kode", "Nama Barang", "Harga", "Stok"]],
      body: rows,
      startY: 25,
    });

    doc.save(
      `Katalog_${filterLocation}_${new Date().toLocaleDateString()}.pdf`,
    );
  };

  const handleApproveMovement = async (movementId) => {
    const result = await Swal.fire({
      title: "Approve Transaksi?",
      text: "Stok akan otomatis terupdate setelah approve",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Approve",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      try {
        await approveStockMovement(movementId, user.id);
        Swal.fire("Berhasil!", "Transaksi telah di-approve", "success");
        loadData();
        loadPendingMovements();
      } catch (error) {
        Swal.fire("Gagal", error.message, "error");
      }
    }
  };

  const requestSort = (key) => {
    let dir =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: dir });
  };

  const getSortIcon = (colName) => {
    if (sortConfig.key !== colName) return "";
    return sortConfig.direction === "asc" ? " ⬆️" : " ⬇️";
  };

  return (
    <div className="dashboard-wrapper">
      <style>{styles}</style>

      <div className="header-card no-print">
        <div>
          <h1 className="header-title">📦 HNS INVENTORY</h1>
          <p
            style={{ margin: "5px 0 0 0", fontSize: "14px", color: "#64748b" }}
          >
            <strong>{user?.name || "User"}</strong> |{" "}
            {user?.role?.replace("_", " ").toUpperCase() || "GUEST"} |
            {user?.location !== "all"
              ? ` Lokasi: ${(user?.location || "").toUpperCase()}`
              : " All Locations"}
          </p>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setIsAlertsOpen(true)}
            style={{
              padding: "10px 20px",
              background: unreadAlerts.length > 0 ? "#dc2626" : "#64748b",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              position: "relative",
            }}
          >
            🔔 Alerts
            {unreadAlerts.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "#fbbf24",
                  color: "#1e293b",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                {unreadAlerts.length}
              </span>
            )}
          </button>

          {[
            "administrator",
            "admin_gudang",
            "staff_gudang",
            "sales_toko",
          ].includes(user?.role) && (
            <button
              onClick={() => setIsStockMovementOpen(true)}
              className="btn-import"
            >
              📦 Transaksi Stok
            </button>
          )}

          {user?.role === "sales_toko" && user?.location !== "all" && (
            <button
              onClick={() => setIsDailyCheckOpen(true)}
              style={{
                padding: "10px 20px",
                background: "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              📋 Cek Stok Harian
            </button>
          )}

          <button onClick={onShowGuide} className="btn-print" style={{ background: "#3182ce" }}>
            📖 Panduan
          </button>
          <button onClick={onLogout} className="btn-logout">
            Keluar
          </button>
        </div>
      </div>

      {pendingMovements.length > 0 && (
        <div
          style={{
            background: "#fef3c7",
            border: "2px solid #fbbf24",
            padding: "15px 20px",
            borderRadius: "12px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong style={{ color: "#92400e" }}>
              ⏳ {pendingMovements.length} Transaksi Menunggu Approval
            </strong>
            <div style={{ fontSize: "13px", color: "#92400e" }}>
              Segera tinjau transaksi dari staff/sales.
            </div>
          </div>
          <button
            onClick={() => {
              Swal.fire({
                title: "Pending Approval",
                html: `<div style="max-height: 300px; overflow-y: auto;">
                                    ${pendingMovements
                                      .map(
                                        (m) => `
                                    <div style="border-bottom: 1px solid #eee; padding: 10px; text-align: left;">
                                        <strong>${
                                          m.products?.["NAMA BARANG"]
                                        }</strong><br/>
                                        <small>${m.type.toUpperCase()} | ${
                                          m.qty
                                        } unit | ${m.from_location || "-"} -> ${
                                          m.to_location || "-"
                                        }</small><br/>
                                        <button onclick="window.approveMovement('${
                                          m.id
                                        }')" style="margin-top:5px; background:#16a34a; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;">Approve Sekarang</button>
                                    </div>
                                    `,
                                      )
                                      .join("")}
                                </div>`,
                showConfirmButton: false,
                showCloseButton: true,
              });
              window.approveMovement = (id) => {
                Swal.close();
                handleApproveMovement(id);
              };
            }}
            style={{
              padding: "8px 16px",
              background: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Lihat Semua
          </button>
        </div>
      )}

      <div className="filter-card no-print">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">PENCARIAN</label>
            <input
              className="input-field"
              placeholder="Cari barang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {user?.location === "all" && (
            <div className="filter-group">
              <label className="filter-label">LOKASI</label>
              <select
                className="input-field"
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
              >
                <option value="gudang">🏭 Gudang</option>
                <option value="nagoya">🏪 Toko Nagoya</option>
                <option value="gateway">🏬 Toko Gateway</option>
              </select>
            </div>
          )}

          <MultiSelect
            label="Kategori"
            options={uniqueCats}
            selected={filterCats}
            onChange={setFilterCats}
          />
          <MultiSelect
            label="Brand"
            options={uniqueBrands}
            selected={filterBrands}
            onChange={setFilterBrands}
          />

          <div className="filter-group">
            <label className="filter-label">STATUS</label>
            <select
              className="input-field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Semua">Semua</option>
              <option value="Ready">Ready</option>
              <option value="Kosong">Kosong</option>
            </select>
          </div>

          {/* IMPORT DEALER (HIJAU) - Gunakan File PRICELIST TERBARU */}
          <div className="filter-group">
            <label className="filter-label">IMPORT DEALER</label>
            <input
              type="file"
              id="file-accurate"
              style={{ display: "none" }}
              accept=".xlsx, .xls, .csv"
              onChange={handleImportAccurate}
            />
            <label
              htmlFor="file-accurate"
              className="btn-import"
              style={{
                cursor: "pointer",
                background: isImporting ? "#94a3b8" : "#10b981", // Hijau
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {isImporting ? "⏳ Processing..." : "📥 Import Pricelist"}
            </label>
          </div>

          {/* SYNC DARI ACCURATE (BIRU) - Fetch dari Google Sheets */}
          <div className="filter-group">
            <label className="filter-label">SYNC ACCURATE</label>
            <button
              onClick={handleSyncFromSheets}
              disabled={isSyncingSheets}
              className="btn-import"
              style={{
                background: isSyncingSheets ? "#94a3b8" : "#3b82f6",
                cursor: isSyncingSheets ? "not-allowed" : "pointer",
              }}
            >
              {isSyncingSheets ? "⏳ Syncing..." : "🔄 Sync dari Accurate"}
            </button>
          </div>

          {/* RESTORE BACKUP (ORANYE) - Gunakan File products_rows (2).csv */}
          <div className="filter-group">
            <label className="filter-label">RESTORE BACKUP</label>
            <input
              type="file"
              id="file-restore"
              style={{ display: "none" }}
              accept=".csv, .xlsx, .xls"
              onChange={handleRestoreData}
            />
            <label
              htmlFor="file-restore"
              className="btn-print"
              style={{
                cursor: "pointer",
                background: isImporting ? "#94a3b8" : "#d97706", // Oranye
                color: "white",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: "bold",
                marginTop: "0px",
              }}
            >
              {isImporting ? "⏳ Processing..." : "♻️ Fix Harga (Restore)"}
            </label>
          </div>

          <button
            onClick={handleExportPDF}
            className="btn-print"
            style={{ background: "#e53e3e", color: "white", marginTop: "24px" }}
          >
            📄 Export PDF
          </button>
        </div>

        <p style={{ marginTop: "10px", fontSize: "14px" }}>
          <strong>{(filterLocation || "").toUpperCase()}</strong> | Total:{" "}
          <strong>{processedProducts.length}</strong> barang
        </p>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  onChange={(e) => {
                    const newCheck = {};
                    if (e.target.checked)
                      processedProducts.forEach(
                        (p) => (newCheck[p["Kode Accurate"]] = true),
                      );
                    setChecked(newCheck);
                  }}
                />
              </th>
              <th
                onClick={() => requestSort("Kode Accurate")}
                style={{ cursor: "pointer" }}
              >
                KODE {getSortIcon("Kode Accurate")}
              </th>
              <th
                onClick={() => requestSort("NAMA BARANG")}
                style={{ cursor: "pointer" }}
              >
                NAMA BARANG {getSortIcon("NAMA BARANG")}
              </th>
              {showPrices && <th>MODAL</th>}
              {showPrices && <th>SRP</th>}
              {showPrices && <th>JUAL</th>}
              <th style={{ textAlign: "center" }}>STOK</th>
              <th>UPDATE</th>
            </tr>
          </thead>
          <tbody>
            {processedProducts.slice(0, 300).map((item) => {
              const isLowStock = item.stock_qty < (item.min_stock || 5);
              return (
                <tr
                  key={item["Kode Accurate"]}
                  style={{ background: isLowStock ? "#fffbeb" : "white" }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={!!checked[item["Kode Accurate"]]}
                      onChange={() =>
                        setChecked({
                          ...checked,
                          [item["Kode Accurate"]]:
                            !checked[item["Kode Accurate"]],
                        })
                      }
                    />
                  </td>
                  <td style={{ fontWeight: "bold", color: "#667eea" }}>
                    {item["Kode Accurate"]}
                  </td>
                  <td>
                    <div style={{ fontWeight: "800" }}>
                      {item["NAMA BARANG"]}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      {item["NAMA BRAND"]} | {item.KATEGORI}
                    </div>
                  </td>
                  {showPrices && (
                    <td style={{ color: "#e53e3e" }}>{formatRp(item.CP)}</td>
                  )}
                  {showPrices && (
                    <td style={{ color: "#e67e22" }}>{formatRp(item.SP)}</td>
                  )}
                  {showPrices && (
                    <td style={{ color: "#38a169", fontWeight: "bold" }}>
                      {formatRp(item.PRICE)}
                    </td>
                  )}
                  <td style={{ textAlign: "center" }}>
                    <span
                      className={`status-badge ${
                        item.stock_qty > 0 ? "status-ready" : "status-empty"
                      }`}
                    >
                      {item.stock_qty} UNIT
                    </span>
                  </td>
                  <td style={{ fontSize: "11px", color: "#64748b" }}>
                    {item["TANGGAL UPDATE"] || "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isStockMovementOpen && (
        <StockMovementModal
          isOpen={isStockMovementOpen}
          onClose={() => setIsStockMovementOpen(false)}
          onSuccess={loadData}
          user={user}
        />
      )}
      {isDailyCheckOpen && (
        <DailyStockCheckModal
          isOpen={isDailyCheckOpen}
          onClose={() => setIsDailyCheckOpen(false)}
          user={user}
        />
      )}
      {isAlertsOpen && (
        <StockAlertsPanel
          user={user}
          onClose={() => {
            setIsAlertsOpen(false);
            loadAlerts();
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
