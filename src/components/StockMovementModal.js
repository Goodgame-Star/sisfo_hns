import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
    supabase, 
    createStockMovement, 
    getAllStockLocations,
    hasPermission 
} from './supabaseClient';

function StockMovementModal({ isOpen, onClose, onSuccess, user }) {
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState({
        kode_barang: '',
        type: 'masuk',
        from_location: '',
        to_location: user.location !== 'all' ? user.location : 'gudang',
        qty: 0,
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [stockInfo, setStockInfo] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadProducts();
        }
    }, [isOpen]);

    const loadProducts = async () => {
        const { data } = await supabase
            .from('products')
            .select('*')
            .order('NAMA BARANG');
        setProducts(data || []);
    };

    const handleProductSelect = async (product) => {
        setSelectedProduct(product);
        setForm({ ...form, kode_barang: product['Kode Accurate'] });
        
        // Load stock info untuk product ini
        const stockData = await getAllStockLocations(product['Kode Accurate']);
        setStockInfo(stockData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validasi
        if (!form.kode_barang || form.qty <= 0) {
            return Swal.fire('Gagal', 'Pilih barang dan isi jumlah yang valid!', 'warning');
        }

        // Validasi lokasi sesuai type
        if (form.type === 'masuk' && !form.to_location) {
            return Swal.fire('Gagal', 'Pilih lokasi tujuan!', 'warning');
        }
        if (form.type === 'keluar' && !form.from_location) {
            return Swal.fire('Gagal', 'Pilih lokasi asal!', 'warning');
        }
        if (form.type === 'transfer' && (!form.from_location || !form.to_location)) {
            return Swal.fire('Gagal', 'Pilih lokasi asal dan tujuan!', 'warning');
        }
        if (form.type === 'transfer' && form.from_location === form.to_location) {
            return Swal.fire('Gagal', 'Lokasi asal dan tujuan tidak boleh sama!', 'warning');
        }

        setLoading(true);

        try {
            // Set from/to sesuai type
            let movementData = { ...form };
            
            if (form.type === 'masuk') {
                movementData.from_location = 'supplier';
            } else if (form.type === 'keluar') {
                movementData.to_location = 'customer';
            }

            await createStockMovement(movementData, user);

            const isAutoApproved = ['administrator', 'admin_gudang'].includes(user.role);
            
            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: isAutoApproved 
                    ? 'Transaksi berhasil dan langsung diproses!'
                    : 'Transaksi berhasil dibuat, menunggu approval dari Admin Gudang',
                timer: 3000
            });

            resetForm();
            onSuccess();
            onClose();
        } catch (error) {
            Swal.fire('Gagal', error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({
            kode_barang: '',
            type: 'masuk',
            from_location: '',
            to_location: user.location !== 'all' ? user.location : 'gudang',
            qty: 0,
            notes: ''
        });
        setSelectedProduct(null);
        setStockInfo([]);
        setSearchTerm('');
    };

    if (!isOpen) return null;

    const filteredProducts = products.filter(p => {
        const search = searchTerm.toLowerCase();
        return (
            p['Kode Accurate'].toLowerCase().includes(search) ||
            p['NAMA BARANG'].toLowerCase().includes(search)
        );
    });

    const typeOptions = [
        { value: 'masuk', label: '📦 Barang Masuk (dari Supplier)' },
        { value: 'keluar', label: '📤 Barang Keluar (ke Customer)' },
        { value: 'transfer', label: '🔄 Transfer Antar Lokasi' }
    ];

    const locationOptions = [
        { value: 'gudang', label: '🏭 Gudang' },
        { value: 'nagoya', label: '🏪 Toko Nagoya Hill' },
        { value: 'gateway', label: '🏬 Toko Gateway' }
    ];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000,
            overflowY: 'auto', padding: '20px'
        }}>
            <div style={{
                background: 'white', padding: '30px', borderRadius: '16px',
                width: '700px', maxWidth: '95%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                maxHeight: '90vh', overflowY: 'auto'
            }}>
                <h2 style={{ marginTop: 0, color: '#2d3748', fontSize: '24px' }}>
                    📋 Transaksi Stok Barang
                </h2>

                <form onSubmit={handleSubmit}>
                    {/* Type Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4a5568' }}>
                            Jenis Transaksi
                        </label>
                        <select
                            value={form.type}
                            onChange={(e) => setForm({ ...form, type: e.target.value })}
                            style={{
                                width: '100%', padding: '12px', border: '2px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '14px'
                            }}
                        >
                            {typeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Product Search */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4a5568' }}>
                            Cari Barang
                        </label>
                        <input
                            type="text"
                            placeholder="Ketik kode atau nama barang..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '12px', border: '2px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '14px'
                            }}
                        />
                        
                        {searchTerm && filteredProducts.length > 0 && (
                            <div style={{
                                maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0',
                                borderRadius: '8px', marginTop: '8px', background: 'white'
                            }}>
                                {filteredProducts.slice(0, 10).map(product => (
                                    <div
                                        key={product['Kode Accurate']}
                                        onClick={() => {
                                            handleProductSelect(product);
                                            setSearchTerm('');
                                        }}
                                        style={{
                                            padding: '12px', cursor: 'pointer',
                                            borderBottom: '1px solid #f7fafc',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                    >
                                        <div style={{ fontWeight: 'bold', color: '#667eea' }}>
                                            {product['Kode Accurate']}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#4a5568' }}>
                                            {product['NAMA BARANG']}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Product Info */}
                    {selectedProduct && (
                        <div style={{
                            background: '#f0fdf4', padding: '15px', borderRadius: '8px',
                            marginBottom: '20px', border: '2px solid #86efac'
                        }}>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#166534', marginBottom: '8px' }}>
                                {selectedProduct['NAMA BARANG']}
                            </div>
                            <div style={{ fontSize: '12px', color: '#166534', marginBottom: '10px' }}>
                                {selectedProduct.KATEGORI} | {selectedProduct['NAMA BRAND']}
                            </div>
                            
                            {stockInfo.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    {stockInfo.map(stock => (
                                        <div key={stock.location} style={{
                                            background: 'white', padding: '8px', borderRadius: '6px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                                {stock.location.toUpperCase()}
                                            </div>
                                            <div style={{ fontWeight: 'bold', fontSize: '18px', color: stock.qty > 0 ? '#16a34a' : '#dc2626' }}>
                                                {stock.qty}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Location Fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: form.type === 'transfer' ? '1fr 1fr' : '1fr', gap: '15px', marginBottom: '20px' }}>
                        {(form.type === 'keluar' || form.type === 'transfer') && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4a5568' }}>
                                    Dari Lokasi
                                </label>
                                <select
                                    value={form.from_location}
                                    onChange={(e) => setForm({ ...form, from_location: e.target.value })}
                                    style={{
                                        width: '100%', padding: '12px', border: '2px solid #e2e8f0',
                                        borderRadius: '8px', fontSize: '14px'
                                    }}
                                    required
                                >
                                    <option value="">Pilih Lokasi...</option>
                                    {locationOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(form.type === 'masuk' || form.type === 'transfer') && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4a5568' }}>
                                    Ke Lokasi
                                </label>
                                <select
                                    value={form.to_location}
                                    onChange={(e) => setForm({ ...form, to_location: e.target.value })}
                                    style={{
                                        width: '100%', padding: '12px', border: '2px solid #e2e8f0',
                                        borderRadius: '8px', fontSize: '14px'
                                    }}
                                    required
                                >
                                    <option value="">Pilih Lokasi...</option>
                                    {locationOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Quantity */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4a5568' }}>
                            Jumlah ({selectedProduct?.unit || 'pcs'})
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={form.qty}
                            onChange={(e) => setForm({ ...form, qty: parseFloat(e.target.value) || 0 })}
                            style={{
                                width: '100%', padding: '12px', border: '2px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '14px'
                            }}
                            required
                        />
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4a5568' }}>
                            Catatan (Opsional)
                        </label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Contoh: Dari supplier XXX, Invoice #12345"
                            style={{
                                width: '100%', padding: '12px', border: '2px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '14px', minHeight: '80px'
                            }}
                        />
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={() => {
                                resetForm();
                                onClose();
                            }}
                            disabled={loading}
                            style={{
                                padding: '12px 24px', border: 'none',
                                background: loading ? '#cbd5e0' : '#e2e8f0',
                                borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold', fontSize: '14px', color: '#1a202c'
                            }}
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedProduct}
                            style={{
                                padding: '12px 24px', border: 'none',
                                background: loading || !selectedProduct ? '#94a3b8' : '#3182ce',
                                color: 'white', borderRadius: '8px',
                                cursor: loading || !selectedProduct ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold', fontSize: '14px'
                            }}
                        >
                            {loading ? '⏳ Memproses...' : '✅ Simpan Transaksi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default StockMovementModal;