import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import AddProductModal from './AddProductModal';
import ImportModal from './ImportModal';
import { styles, MultiSelect } from './DashboardHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabaseClient'; 

function Dashboard({ user, onLogout }) {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    const [filterCats, setFilterCats] = useState([]);
    const [filterBrands, setFilterBrands] = useState([]);
    const [status, setStatus] = useState("Semua");
    const [sortConfig, setSortConfig] = useState({ key: 'TANGGAL UPDATE', direction: 'desc' });
    const [checked, setChecked] = useState({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ modal: '', srp: '', jual: '', stok: 0 });

    // 1. LOAD DATA LOOPING (TOTAL 5120 BARANG)
    const loadProducts = async () => {
        let allData = [];
        let from = 0; let to = 999; let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase.from('products').select('*').range(from, to);
            if (error) { hasMore = false; } 
            else if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < 1000) hasMore = false;
                else { from += 1000; to += 1000; }
            } else { hasMore = false; }
        }
        setProducts(allData);
    };

    useEffect(() => { loadProducts(); }, []);

    // 2. FORMAT RUPIAH
    const formatRp = (n) => {
        const num = typeof n === 'string' ? parseInt(n.replace(/[^0-9]/g, '')) : n;
        if (!num || isNaN(num)) return "Rp 0";
        return new Intl.NumberFormat('id-ID', { 
            style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 
        }).format(num);
    };

    const uniqueCats = useMemo(() => [...new Set(products.map(i => i.KATEGORI).filter(Boolean))].sort(), [products]);
    const uniqueBrands = useMemo(() => [...new Set(products.map(i => i['NAMA BRAND']).filter(Boolean))].sort(), [products]);

    // 3. FILTER LOGIC
    const processedProducts = useMemo(() => {
        let result = [...products];
        if (search) {
            const terms = search.toLowerCase().split(" ").filter(t => t.trim());
            result = result.filter(p => {
                const text = `${p['Kode Accurate']} ${p['NAMA BARANG']}`.toLowerCase();
                return terms.every(t => text.includes(t));
            });
        }
        if (filterCats.length > 0) result = result.filter(p => filterCats.includes(p.KATEGORI));
        if (filterBrands.length > 0) result = result.filter(p => filterBrands.includes(p['NAMA BRAND']));
        if (status === "Ready") result = result.filter(p => parseFloat(p['Stok Sistem']) > 0);
        else if (status === "Kosong") result = result.filter(p => parseFloat(p['Stok Sistem']) <= 0);

        if (sortConfig.key) {
            result.sort((a, b) => {
                let vA = a[sortConfig.key] || ''; let vB = b[sortConfig.key] || '';
                return sortConfig.direction === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
            });
        }
        return result;
    }, [products, search, filterCats, filterBrands, status, sortConfig]);

    // 4. PDF EXPORT
    const handleExportPDF = () => {
        const doc = new jsPDF();
        const dataToPrint = Object.keys(checked).length > 0 ? processedProducts.filter(p => checked[p['Kode Accurate']]) : processedProducts;
        if (dataToPrint.length === 0) return Swal.fire('Info', 'Tidak ada data', 'info');
        
        doc.text("HNS IT CENTER - KATALOG GUDANG", 14, 15);
        const rows = dataToPrint.map(item => [
            item['Kode Accurate'], item['NAMA BARANG'], formatRp(item.SP), formatRp(item.PRICE), 
            parseFloat(item['Stok Sistem'] || 0) > 0 ? "READY" : "KOSONG"
        ]);
        autoTable(doc, { head: [["Kode", "Nama Barang", "SRP", "Dealer", "Status"]], body: rows, startY: 25 });
        doc.save(`Katalog_HNS_${new Date().toLocaleDateString()}.pdf`);
    };

    // 5. ACTIONS
    const handleSaveEdit = async (id) => {
        const { error } = await supabase.from('products').update({
            "Stok Sistem": editForm.stok, "PRICE": editForm.jual, "CP": editForm.modal, "SP": editForm.srp, "TANGGAL UPDATE": new Date().toLocaleString()
        }).eq('Kode Accurate', id);
        if (!error) { loadProducts(); setEditingId(null); Swal.fire('Sukses', 'Data Update!', 'success'); }
    };

    const handleDelete = async (id) => {
        const res = await Swal.fire({ title: 'Hapus?', text: 'Data tidak bisa balik!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e53e3e' });
        if (res.isConfirmed) {
            const { error } = await supabase.from('products').delete().eq('Kode Accurate', id);
            if (!error) { loadProducts(); Swal.fire('Terhapus', '', 'success'); }
        }
    };

    const handleCheckAll = (e) => {
        const isChecked = e.target.checked;
        const newCheck = {};
        if (isChecked) processedProducts.forEach(p => newCheck[p['Kode Accurate']] = true);
        setChecked(newCheck);
    };

    const requestSort = (key) => {
        let dir = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
        setSortConfig({ key, direction: dir });
    };

    const getSortIcon = (colName) => {
        if (sortConfig.key !== colName) return "";
        return sortConfig.direction === 'asc' ? " ⬆️" : " ⬇️";
    };

    return (
        <div className="dashboard-wrapper">
            <style>{styles}</style>
            
            <div className="header-card no-print">
                <h1 className="header-title">📦 HNS GUDANG</h1>
                <div className="header-actions">
                    <button onClick={() => setIsImportModalOpen(true)} className="btn-import">📂 Import CSV</button>
                    <button onClick={onLogout} className="btn-logout">Keluar</button>
                </div>
            </div>

            <div className="filter-card no-print">
                <div className="filter-row">
                    <div className="filter-group">
                        <label className="filter-label">PENCARIAN</label>
                        <input className="input-field" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <MultiSelect label="Kategori" options={uniqueCats} selected={filterCats} onChange={setFilterCats} />
                    <MultiSelect label="Brand" options={uniqueBrands} selected={filterBrands} onChange={setFilterBrands} />
                    <div className="filter-group">
                        <label className="filter-label">STATUS</label>
                        <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="Semua">Semua</option><option value="Ready">Ready</option><option value="Kosong">Kosong</option>
                        </select>
                    </div>
                    <button onClick={handleExportPDF} className="btn-print" style={{background:'#e53e3e', color:'white', marginTop:'24px'}}>📄 PDF</button>
                </div>
                <p style={{marginTop:'10px'}}>Total: <strong>{processedProducts.length}</strong> barang.</p>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr style={{background:'#667eea', color:'white'}}>
                            <th style={{width:'40px'}}><input type="checkbox" onChange={handleCheckAll} /></th>
                            <th style={{textAlign:'left', paddingLeft:'10px'}} onClick={() => requestSort('Kode Accurate')}>KODE {getSortIcon('Kode Accurate')}</th>
                            <th onClick={() => requestSort('NAMA BARANG')}>NAMA BARANG</th>
                            <th className="no-print">MODAL (CP)</th>
                            <th>SRP (SP)</th>
                            <th>JUAL (PRICE)</th>
                            <th style={{textAlign:'center'}}>STOK</th>
                            <th className="no-print" onClick={() => requestSort('TANGGAL UPDATE')}>UPDATE</th>
                            <th className="no-print">AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedProducts.slice(0, 300).map((item) => {
                            const isEdit = editingId === item['Kode Accurate'];
                            const isChecked = !!checked[item['Kode Accurate']];
                            return (
                                <tr key={item['Kode Accurate']} className={isChecked ? "selected-row" : ""}>
                                    <td data-label="PILIH"><input type="checkbox" checked={isChecked} onChange={() => setChecked({...checked, [item['Kode Accurate']]: !isChecked})} /></td>
                                    
                                    <td data-label="KODE" style={{fontWeight:'bold', color:'#667eea', textAlign:'left', paddingLeft:'10px'}}>
                                        {item['Kode Accurate']}
                                    </td>

                                    <td data-label="IDENTITAS">
                                        <div style={{fontWeight:'800', fontSize:'15px', color:'#1a202c'}}>{item['NAMA BARANG']}</div>
                                        <div style={{fontSize:'11px', color:'#718096'}}>{item['NAMA BRAND']} | {item.KATEGORI}</div>
                                    </td>

                                    <td data-label="MODAL (CP)" className="no-print" style={{color:'#e53e3e', fontWeight:'bold'}}>
                                        {isEdit ? <input value={editForm.modal} onChange={e=>setEditForm({...editForm, modal:e.target.value})} style={{width:'80px'}}/> : formatRp(item.CP)}
                                    </td>
                                    
                                    <td data-label="SRP (SP)" style={{color:'#e67e22', fontWeight:'bold'}}>
                                        {isEdit ? <input value={editForm.srp} onChange={e=>setEditForm({...editForm, srp:e.target.value})} style={{width:'80px'}}/> : formatRp(item.SP)}
                                    </td>
                                    
                                    <td data-label="JUAL (PRICE)" style={{color:'#38a169', fontWeight:'bold'}}>
                                        {isEdit ? <input value={editForm.jual} onChange={e=>setEditForm({...editForm, jual:e.target.value})} style={{width:'80px'}}/> : formatRp(item.PRICE)}
                                    </td>

                                    <td data-label="STOK" style={{textAlign:'center'}}>
                                        <span className={`status-badge ${parseFloat(item['Stok Sistem']) > 0 ? 'status-ready' : 'status-empty'}`}>
                                            {item['Stok Sistem']} UNIT
                                        </span>
                                    </td>

                                    <td data-label="UPDATE" className="no-print" style={{fontSize:'11px', color:'#718096'}}>
                                        {item['TANGGAL UPDATE'] || '-'}
                                    </td>

                                    <td data-label="AKSI" className="no-print">
                                        <div style={{display:'flex', gap:'5px'}}>
                                            {isEdit ? (
                                                <button onClick={() => handleSaveEdit(item['Kode Accurate'])}>💾</button>
                                            ) : (
                                                <>
                                                    <button onClick={() => {setEditingId(item['Kode Accurate']); setEditForm({modal:item.CP, srp:item.SP, jual:item.PRICE, stok:item['Stok Sistem']})}}>✏️</button>
                                                    <button onClick={() => handleDelete(item['Kode Accurate'])} style={{color:'#e53e3e'}}>🗑️</button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onSuccess={loadProducts} />
        </div>
    );
}

export default Dashboard;