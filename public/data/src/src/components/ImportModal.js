import React, { useState } from 'react';
import Swal from 'sweetalert2';
import Papa from 'papaparse';
import { supabase } from './supabaseClient';

function ImportModal({ isOpen, onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleUpload = async () => {
        if (!file) return Swal.fire('Gagal', 'Pilih file CSV dulu!', 'warning');

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const dataFromCSV = results.data;

                // 1. FUNGSI MEMBERSIHKAN NAMA DARI SIMBOL GAK JELAS
                const cleanText = (txt) => {
                    if (!txt) return "";
                    return txt.toString()
                        .replace(/[\r\n]+/gm, " ") // Hapus Enter/Line Break
                        .replace(/"/g, "")         // Hapus tanda kutip dua bikin simbol kotak
                        .replace(/\s+/g, " ")      // Rapikan spasi ganda
                        .trim();
                };

                // 2. FUNGSI MEMBERSIHKAN HARGA (CEK NOL KELEBIHAN)
                const cleanPrice = (val) => {
                    if (!val || val === "NULL" || val === "" || val === "0") return null;
                    // Ambil angka sebelum titik desimal saja
                    let baseVal = val.toString().split('.')[0];
                    const cleaned = baseVal.replace(/[^0-9]/g, '');
                    return (cleaned && cleaned !== "0") ? cleaned : null;
                };

                const formattedData = dataFromCSV.map(item => {
                    // Data yang WAJIB ada dan BOLEH di-timpa (Metadata & Stok)
                    const entry = {
                        "Kode Accurate": cleanText(item["Kode Accurate"]),
                        "NAMA BARANG": cleanText(item["NAMA BARANG"]),
                        "KATEGORI": cleanText(item.KATEGORI),
                        "NAMA BRAND": cleanText(item["NAMA BRAND"]),
                        "STATUS": item.STATUS,
                        "Stok Sistem": parseFloat(item["Stok Sistem"] || 0),
                        "TANGGAL UPDATE": new Date().toLocaleString()
                    };

                    // 3. LOGIKA PROTEKSI HARGA
                    // Hanya masukkan harga ke database kalau di CSV angkanya ada (bukan 0/kosong)
                    const cp = cleanPrice(item.CP);
                    const sp = cleanPrice(item.SP);
                    const price = cleanPrice(item.PRICE);

                    if (cp) entry.CP = cp;
                    if (sp) entry.SP = sp;
                    if (price) entry.PRICE = price;

                    return entry;
                });

                try {
                    // Upsert hanya akan merubah kolom yang kita kirimkan saja
                    const { error } = await supabase
                        .from('products')
                        .upsert(formattedData, { onConflict: 'Kode Accurate' });

                    if (error) throw error;

                    Swal.fire('Sukses', `Berhasil memproses ${formattedData.length} barang. Nama sudah bersih & harga aman!`, 'success');
                    onSuccess();
                    onClose();
                } catch (err) {
                    Swal.fire('Gagal', err.message, 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '400px', textAlign: 'center', boxShadow:'0 10px 25px rgba(0,0,0,0.2)' }}>
                <h2 style={{marginTop:0, color:'#2d3748'}}>📂 Import Paten</h2>
                <p style={{color:'#666', fontSize:'12px', marginBottom:'20px'}}>
                    Nama barang akan dibersihkan dari simbol aneh.<br/>
                    <b>Harga tidak berubah jika di CSV kosong atau 0.</b>
                </p>
                
                <input 
                    type="file" 
                    accept=".csv" 
                    onChange={e => setFile(e.target.files[0])} 
                    style={{ display:'block', margin: '0 auto 20px auto', padding: '10px', border: '1px solid #ddd', width: '90%', borderRadius:'6px' }} 
                />

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', border: 'none', background: '#e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight:'bold' }}>
                        Batal
                    </button>
                    <button onClick={handleUpload} disabled={loading} style={{ padding: '10px 20px', border: 'none', background: '#3182ce', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight:'bold' }}>
                        {loading ? 'Membersihkan Data...' : '🚀 Import Sekarang'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ImportModal;