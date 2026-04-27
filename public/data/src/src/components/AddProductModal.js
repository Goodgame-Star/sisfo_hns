import React, { useState } from 'react';
import Swal from 'sweetalert2';
// 1. IMPORT KONEKSI SUPABASE
import { supabase } from './supabaseClient'; 

function AddProductModal({ isOpen, onClose, onSuccess }) {
    const [form, setForm] = useState({
        id: '', nama: '', kategori: '', brand: '',
        harga_beli: 0, harga_dealer: 0, harga_jual: 0, stok: 0
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if(!form.id || !form.nama) return Swal.fire('Gagal', 'Kode dan Nama Barang wajib diisi!', 'warning');

        Swal.showLoading();

        try {
            // 2. GANTI FETCH LAMA DENGAN INSERT SUPABASE
            const { error } = await supabase
                .from('products')
                .insert([
                    { 
                        id: form.id, 
                        nama: form.nama, 
                        kategori: form.kategori, 
                        brand: form.brand, 
                        harga_beli: parseInt(form.harga_beli), 
                        harga_dealer: parseInt(form.harga_dealer || 0), 
                        harga_jual: parseInt(form.harga_jual), 
                        stok: parseInt(form.stok),
                        last_update: new Date().toISOString()
                    }
                ]);
            
            if(error) {
                // Cek kalau kodenya duplikat
                if(error.code === '23505') {
                    Swal.fire('Gagal', 'Kode Barang (ID) sudah terpakai!', 'error');
                } else {
                    Swal.fire('Gagal', error.message, 'error');
                }
            } else {
                Swal.fire('Berhasil', 'Barang baru telah ditambahkan!', 'success');
                setForm({ id: '', nama: '', kategori: '', brand: '', harga_beli: 0, harga_dealer: 0, harga_jual: 0, stok: 0 });
                onSuccess(); 
                onClose(); 
            }
        } catch (error) {
            Swal.fire('Error', 'Gagal koneksi ke database', 'error');
        }
    };

    const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
    const modalStyle = { background: 'white', padding: '25px', borderRadius: '12px', width: '500px', maxWidth: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' };
    const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '12px', color: '#4a5568' };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <h2 style={{ marginTop: 0, color: '#2d3748' }}>➕ Tambah Barang Baru</h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Kode Barang (ID)</label>
                            <input style={inputStyle} value={form.id} onChange={e=>setForm({...form, id: e.target.value})} placeholder="Contoh: BRG001" required />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label style={labelStyle}>Nama Barang</label>
                            <input style={inputStyle} value={form.nama} onChange={e=>setForm({...form, nama: e.target.value})} placeholder="Contoh: Laptop Asus..." required />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Kategori</label>
                            <input style={inputStyle} value={form.kategori} onChange={e=>setForm({...form, kategori: e.target.value})} placeholder="Elektronik" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Brand</label>
                            <input style={inputStyle} value={form.brand} onChange={e=>setForm({...form, brand: e.target.value})} placeholder="Asus" />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Modal (Beli)</label>
                            <input type="number" style={inputStyle} value={form.harga_beli} onChange={e=>setForm({...form, harga_beli: e.target.value})} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Jual (Price)</label>
                            <input type="number" style={inputStyle} value={form.harga_jual} onChange={e=>setForm({...form, harga_jual: e.target.value})} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Stok Awal</label>
                            <input type="number" style={inputStyle} value={form.stok} onChange={e=>setForm({...form, stok: e.target.value})} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                        <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: 'none', background: '#e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight:'bold' }}>Batal</button>
                        <button type="submit" style={{ padding: '10px 20px', border: 'none', background: '#48bb78', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight:'bold' }}>Simpan Barang</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddProductModal;