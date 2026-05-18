import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import { styles, MultiSelect } from "./DashboardHelpers";
import { supabase } from "./supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function DealerPage({ user, onLogout }) {
  const [products, setProducts] = useState([]);
  const [stockLocations, setStockLocations] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCats, setFilterCats] = useState([]);
  const [filterBrands, setFilterBrands] = useState([]);
  
  // State untuk menyimpan ID barang yang dicentang (Memory Select)
  const [selectedIds, setSelectedIds] = useState([]);

  const loadData = async () => {
    const { data: pData } = await supabase.from('products').select('*').order('NAMA BARANG');
    const { data: sData } = await supabase.from('stock_locations').select('*');
    setProducts(pData || []);
    setStockLocations(sData || []);
  };

  useEffect(() => { loadData(); }, []);

  const formatRp = (n) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
  };

  // ================= RESET FILTER =================
  const handleResetFilter = () => {
    setSearch("");
    setFilterCats([]);
    setFilterBrands([]);
    // selectedIds tidak direset agar centangan tidak hilang saat filter dibersihkan
  };

  // ================= SELECT LOGIC =================
  const handleSelectRow = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = (visibleItems) => {
    const visibleIds = visibleItems.map(i => i["Kode Accurate"]);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

 // ================= EXPORT PDF KHUSUS DEALER (SIMPEL) =================
 const handleExportPDF = () => {
    // Hanya export barang yang sudah dicentang (Selected)
    const dataToExport = productsMemoryMerged.filter(p => selectedIds.includes(p["Kode Accurate"]));

    if (dataToExport.length === 0) {
      return Swal.fire("Info", "Pilih barang dulu yang mau di-export", "warning");
    }

    const doc = new jsPDF('p', 'mm', 'a4'); // Gunakan Portrait (P) karena kolomnya sedikit
    
    // Header Sesuai Lampiran
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`HNS IT CENTER - KATALOG GUDANG`, 14, 20);

    // Siapkan baris data dengan logika Status
    const rows = dataToExport.map((item) => [
      item["Kode Accurate"],
      item["NAMA BARANG"],
      formatRp(item.PRICE),
      item.total_qty > 0 ? "READY" : "KOSONG" // Logika: > 0 Ready, else Kosong
    ]);

    // Render Tabel
    autoTable(doc, {
      head: [["Kode", "Nama Barang", "Dealer", "Status"]],
      body: rows,
      startY: 30,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { 
        fillColor: [41, 128, 185], // Warna biru sesuai gambar
        textColor: 255, 
        fontStyle: 'bold' 
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Kode
        1: { cellWidth: 'auto' }, // Nama Barang
        2: { cellWidth: 40 }, // Harga Dealer
        3: { cellWidth: 25, halign: 'center' } // Status
      }
    });

    doc.save(`Katalog_Dealer_HNS_${new Date().toLocaleDateString()}.pdf`);
  };

  // ================= MODAL EDIT HARGA =================
  const openEditModal = async (product) => {
    const { value: formValues } = await Swal.fire({
      title: 'Update Level Harga',
      html: `
        <div style="text-align: left; margin-bottom: 10px; font-size: 14px;"><strong>${product["NAMA BARANG"]}</strong></div>
        <div style="text-align: left;"><label>MODAL (CP)</label><input id="swal-cp" type="number" class="swal2-input" value="${product.CP || 0}"></div>
        <div style="text-align: left;"><label>SRP (SP)</label><input id="swal-sp" type="number" class="swal2-input" value="${product.SP || 0}" oninput="document.getElementById('swal-price').value = this.value"></div>
        <div style="text-align: left;"><label>JUAL / HARGA WEB (PRICE)</label><input id="swal-price" type="number" class="swal2-input" value="${product.PRICE || 0}"></div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => ({
        CP: document.getElementById('swal-cp').value,
        SP: document.getElementById('swal-sp').value,
        PRICE: document.getElementById('swal-price').value
      })
    });

    if (formValues) {
      const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
      await supabase.from('products').update({ 
        CP: parseInt(formValues.CP), SP: parseInt(formValues.SP), PRICE: parseInt(formValues.PRICE), "TANGGAL UPDATE": now 
      }).eq('Kode Accurate', product['Kode Accurate']);
      loadData();
    }
  };

  // ================= DATA PROCESSING =================
  const productsMemoryMerged = useMemo(() => {
    return products.map(product => {
      const totalQty = stockLocations
        .filter(s => s.kode_barang === product['Kode Accurate'])
        .reduce((sum, item) => sum + (item.qty || 0), 0);
      return { ...product, total_qty: totalQty };
    });
  }, [products, stockLocations]);

  const filteredProducts = useMemo(() => {
    let result = [...productsMemoryMerged];

    if (search) {
      // Pecah input pencarian menjadi kata-kata (misal: "i5 512gb" jadi ["i5", "512gb"])
      const searchWords = search.toLowerCase().split(" ").filter(word => word !== "");

      result = result.filter(p => {
        const itemText = `${p["Kode Accurate"]} ${p["NAMA BARANG"]} ${p["NAMA BRAND"]} ${p.KATEGORI}`.toLowerCase();
        
        // Cek apakah SETIAP kata kunci ada di dalam data barang (Logic AND)
        return searchWords.every(word => itemText.includes(word));
      });
    }

    if (filterCats.length > 0) result = result.filter(p => filterCats.includes(p.KATEGORI));
    if (filterBrands.length > 0) result = result.filter(p => filterBrands.includes(p["NAMA BRAND"]));
    
    return result;
  }, [productsMemoryMerged, search, filterCats, filterBrands]);
  const uniqueCats = useMemo(() => [...new Set(products.map(i => i.KATEGORI).filter(Boolean))].sort(), [products]);
  const uniqueBrands = useMemo(() => [...new Set(products.map(i => i["NAMA BRAND"]).filter(Boolean))].sort(), [products]);

  return (
    <div className="dashboard-wrapper">
      <style>{styles}</style>

      <div className="header-card">
        <div>
          <h1 className="header-title">💼 DEALER CATALOG</h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            <strong>{user?.name}</strong> | <span style={{color: '#3182ce'}}>{selectedIds.length} barang dipilih</span>
          </p>
        </div>
        <button onClick={onLogout} className="btn-logout">Keluar</button>
      </div>

      <div className="filter-card">
        <div className="filter-row" style={{alignItems: 'flex-end'}}>
          <div className="filter-group">
            <label className="filter-label">PENCARIAN</label>
            <input className="input-field" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <MultiSelect label="Kategori" options={uniqueCats} selected={filterCats} onChange={setFilterCats} />
          <MultiSelect label="Brand" options={uniqueBrands} selected={filterBrands} onChange={setFilterBrands} />
          
          <div style={{display:'flex', gap:'8px'}}>
            <button onClick={handleResetFilter} className="btn-import" style={{background: '#718096', color: 'white'}}>🔄 Reset</button>
            <button onClick={handleExportPDF} className="btn-print" style={{ background: "#e53e3e", color: "white" }}>
              📄 Export ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{width: '40px'}}>
                <input 
                  type="checkbox" 
                  onChange={() => handleSelectAllVisible(filteredProducts)}
                  checked={filteredProducts.length > 0 && filteredProducts.every(i => selectedIds.includes(i["Kode Accurate"]))}
                />
              </th>
              <th>KODE</th>
              <th>NAMA BARANG</th>
              <th>MODAL</th>
              <th>SRP</th>
              <th>JUAL</th>
              <th style={{ textAlign: "center" }}>STOK</th>
              <th style={{ textAlign: "center" }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((item) => (
              <tr key={item["Kode Accurate"]} style={{background: selectedIds.includes(item["Kode Accurate"]) ? '#ebf8ff' : 'transparent'}}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item["Kode Accurate"])} 
                    onChange={() => handleSelectRow(item["Kode Accurate"])} 
                  />
                </td>
                <td style={{ fontWeight: "bold", color: "#667eea" }}>{item["Kode Accurate"]}</td>
                <td style={{fontSize: '12px'}}><strong>{item["NAMA BARANG"]}</strong></td>
                <td style={{ color: "#e53e3e" }}>{formatRp(item.CP)}</td>
                <td style={{ color: "#e67e22" }}>{formatRp(item.SP)}</td>
                <td style={{ color: "#38a169", fontWeight: "bold" }}>{formatRp(item.PRICE)}</td>
                <td style={{ textAlign: "center" }}>
                   <span className={`status-badge ${item.total_qty > 0 ? "status-ready" : "status-empty"}`}>{item.total_qty}</span>
                </td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => openEditModal(item)} className="btn-edit" style={{padding: '5px 10px', fontSize: '12px'}}>✏️ Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DealerPage;