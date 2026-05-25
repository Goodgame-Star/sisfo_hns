import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { MultiSelect, styles } from "./DashboardHelpers";
import { supabase } from "./supabaseClient";

function PicPage({ user, onLogout, onShowGuide }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCats, setFilterCats] = useState([]);
  const [filterBrands, setFilterBrands] = useState([]);

  const picKategori = user?.kategori_pic || [];

  const loadData = async () => {
    let query = supabase.from("products").select("*").order("NAMA BARANG");

    // Filter by kategori PIC — kalau kosong tampilkan semua (fallback admin)
    if (picKategori.length > 0) {
      query = query.in("KATEGORI", picKategori);
    }

    const [{ data: pData }, { data: mappings }] = await Promise.all([
      query,
      supabase.from("product_woo_mapping").select("kode_accurate").eq("is_active", true),
    ]);

    const mappedKodes = new Set((mappings || []).map((m) => (m.kode_accurate || "").trim().toUpperCase()));
    setProducts(
      (pData || []).map((p) => ({
        ...p,
        hasMapped: mappedKodes.has((p["Kode Accurate"] || "").trim().toUpperCase()),
      })),
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatRp = (n) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n || 0);
  };

  // ================= RESET FILTER =================
  const handleResetFilter = () => {
    setSearch("");
    setFilterCats([]);
    setFilterBrands([]);
  };

  // ================= MODAL EDIT HARGA =================
  const openEditModal = async (product) => {
    const { value: formValues } = await Swal.fire({
      title: "Update Harga Produk",
      html: `
        <div style="text-align: left; margin-bottom: 10px; font-size: 14px;"><strong>${product["NAMA BARANG"]}</strong></div>
        <div style="text-align: left;"><label>MODAL (CP)</label><input id="swal-cp" type="number" class="swal2-input" value="${product.CP || 0}"></div>
        <div style="text-align: left;"><label>SRP / HARGA WEB (SP) — Ini yang sync ke WooCommerce</label><input id="swal-sp" type="number" class="swal2-input" value="${product.SP || 0}"></div>
        <div style="text-align: left;"><label>HARGA JUAL DEALER (PRICE)</label><input id="swal-price" type="number" class="swal2-input" value="${product.PRICE || 0}"></div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => ({
        CP: document.getElementById("swal-cp").value,
        SP: document.getElementById("swal-sp").value,
        PRICE: document.getElementById("swal-price").value,
      }),
    });

    if (formValues) {
      const now = new Date().toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const { error } = await supabase
        .from("products")
        .update({
          CP: parseInt(formValues.CP),
          SP: parseInt(formValues.SP),
          PRICE: parseInt(formValues.PRICE),
          "TANGGAL UPDATE": now,
        })
        .eq("Kode Accurate", product["Kode Accurate"]);

      if (error) {
        Swal.fire("Gagal!", error.message, "error");
      } else {
        Swal.fire("Berhasil!", "Harga berhasil diupdate", "success");
        loadData();
      }
    }
  };


  // ================= DATA PROCESSING =================
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (search) {
      const searchWords = search
        .toLowerCase()
        .split(" ")
        .filter((word) => word !== "");
      result = result.filter((p) => {
        const itemText =
          `${p["Kode Accurate"]} ${p["NAMA BARANG"]} ${p["NAMA BRAND"]} ${p.KATEGORI}`.toLowerCase();
        return searchWords.every((word) => itemText.includes(word));
      });
    }

    if (filterCats.length > 0)
      result = result.filter((p) => filterCats.includes(p.KATEGORI));
    if (filterBrands.length > 0)
      result = result.filter((p) => filterBrands.includes(p["NAMA BRAND"]));

    return result;
  }, [products, search, filterCats, filterBrands]);

  const uniqueCats = useMemo(
    () => [...new Set(products.map((i) => i.KATEGORI).filter(Boolean))].sort(),
    [products],
  );
  const uniqueBrands = useMemo(
    () =>
      [...new Set(products.map((i) => i["NAMA BRAND"]).filter(Boolean))].sort(),
    [products],
  );

  return (
    <div className="dashboard-wrapper">
      <style>{styles}</style>

      <div className="header-card">
        <div>
          <h1 className="header-title">👨‍💻 PIC - WOOCOMMERCE SYNC MANAGER</h1>
          <p
            style={{ margin: "5px 0 0 0", fontSize: "14px", color: "#64748b" }}
          >
            <strong>{user?.name}</strong> |{" "}
            <span style={{ color: "#38a169" }}>Atur Harga & Status Sync Web</span>
          </p>
          {picKategori.length > 0 && (
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#718096" }}>
              Kategori:{" "}
              {picKategori.map((k) => (
                <span
                  key={k}
                  style={{
                    background: "#ebf8ff",
                    color: "#2b6cb0",
                    borderRadius: "4px",
                    padding: "1px 7px",
                    marginRight: "4px",
                    fontWeight: "bold",
                  }}
                >
                  {k}
                </span>
              ))}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onShowGuide} className="btn-print" style={{ background: "#3182ce" }}>
            📖 Panduan
          </button>
          <button onClick={onLogout} className="btn-logout">
            Keluar
          </button>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-row" style={{ alignItems: "flex-end" }}>
          <div className="filter-group">
            <label className="filter-label">PENCARIAN</label>
            <input
              className="input-field"
              placeholder="Cari Kode/Nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleResetFilter}
              className="btn-import"
              style={{ background: "#718096", color: "white" }}
            >
              🔄 Reset
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>KODE</th>
              <th>NAMA BARANG</th>
              <th>MODAL</th>
              <th>SRP / HARGA WEB</th>
              <th>HARGA DEALER</th>
              <th style={{ textAlign: "center" }}>STOK</th>
              <th style={{ textAlign: "center" }}>SYNC KE WEB?</th>
              <th style={{ textAlign: "center" }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((item) => (
              <tr
                key={item["Kode Accurate"]}
                style={{ background: item.hasMapped ? "#ebf8ff" : "transparent" }}
              >
                <td style={{ fontWeight: "bold", color: "#667eea" }}>
                  {item["Kode Accurate"]}
                </td>
                <td style={{ fontSize: "12px" }}>
                  <strong>{item["NAMA BARANG"]}</strong>
                </td>
                <td style={{ color: "#e53e3e" }}>{formatRp(item.CP)}</td>
                <td style={{ color: "#e67e22" }}>{formatRp(item.SP)}</td>
                <td style={{ color: "#38a169", fontWeight: "bold" }}>
                  {formatRp(item.PRICE)}
                </td>

                <td
                  style={{
                    textAlign: "center",
                    fontStyle: "italic",
                    color: "#a0aec0",
                    fontSize: "11px",
                  }}
                >
                  Menyusul
                </td>

                <td style={{ textAlign: "center" }}>
                  <span
                    style={{
                      background: item.hasMapped ? "#c6f6d5" : "#fed7d7",
                      color: item.hasMapped ? "#276749" : "#9b2c2c",
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                  >
                    {item.hasMapped ? "✅ YA" : "❌ TIDAK"}
                  </span>
                </td>

                <td style={{ textAlign: "center" }}>
                  <button
                    onClick={() => openEditModal(item)}
                    className="btn-edit"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                  >
                    ✏️ Edit Harga
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PicPage;
