import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
    supabase, 
    createDailyStockCheck,
    getStockSummaryByLocation,
    getDailyStockChecks
} from './supabaseClient';

function DailyStockCheckModal({ isOpen, onClose, user }) {
    const [stockItems, setStockItems] = useState([]);
    const [checks, setChecks] = useState({});
    const [loading, setLoading] = useState(false);
    const [todayChecks, setTodayChecks] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (isOpen && user.location !== 'all' && user.location !== 'gudang') {
            loadStockData();
            loadTodayChecks();
        }
    }, [isOpen, user.location]);

    const loadStockData = async () => {
        const data = await getStockSummaryByLocation(user.location);
        setStockItems(data);
        
        // Initialize checks object
        const initialChecks = {};
        data.forEach(item => {
            initialChecks[item.kode_barang] = {
                expected_qty: item.qty,
                actual_qty: item.qty,
                notes: ''
            };
        });
        setChecks(initialChecks);
    };

    const loadTodayChecks = async () => {
        const today = new Date().toISOString().split('T')[0];
        const data = await getDailyStockChecks(user.location, today, today);
        setTodayChecks(data);
    };

    const handleCheckChange = (kodeBarang, field, value) => {
        setChecks({
            ...checks,
            [kodeBarang]: {
                ...checks[kodeBarang],
                [field]: value
            }
        });
    };

    const handleSubmitAll = async () => {
        const hasChanges = Object.values(checks).some(
            check => check.actual_qty !== check.expected_qty
        );

        if (!hasChanges) {
            const result = await Swal.fire({
                title: 'Konfirmasi',
                text: 'Semua stok sudah sesuai. Lanjutkan submit?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Submit',
                cancelButtonText: 'Batal'
            });

            if (!result.isConfirmed) return;
        }

        setLoading(true);

        try {
            const checkPromises = Object.entries(checks).map(([kodeBarang, check]) => 
                createDailyStockCheck({
                    kode_barang: kodeBarang,
                    location: user.location,
                    expected_qty: check.expected_qty,
                    actual_qty: check.actual_qty,
                    notes: check.notes
                }, user.id)
            );

            await Promise.all(checkPromises);

            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: `${Object.keys(checks).length} item telah dicek dan disimpan`,
                timer: 2000
            });

            loadTodayChecks();
        } catch (error) {
            // Check if error is due to duplicate
            if (error.code === '23505') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sudah Dicek',
                    text: 'Stock check hari ini sudah pernah dilakukan!',
                });
            } else {
                Swal.fire('Gagal', error.message, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleQuickMatch = () => {
        const newChecks = { ...checks };
        Object.keys(newChecks).forEach(kodeBarang => {
            newChecks[kodeBarang].actual_qty = newChecks[kodeBarang].expected_qty;
        });
        setChecks(newChecks);
        Swal.fire({
            icon: 'info',
            title: 'Semua Qty Disesuaikan',
            text: 'Semua stok aktual telah disamakan dengan stok sistem',
            timer: 1500
        });
    };

    if (!isOpen) return null;

    if (user.location === 'all' || user.location === 'gudang') {
        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', display: 'flex',
                justifyContent: 'center', alignItems: 'center', zIndex: 1000
            }}>
                <div style={{
                    background: 'white', padding: '30px', borderRadius: '16px',
                    width: '400px', maxWidth: '90%', textAlign: 'center'
                }}>
                    <h3 style={{ color: '#e53e3e' }}>⚠️ Akses Ditolak</h3>
                    <p>Daily stock check hanya untuk Sales Toko (Nagoya/Gateway)</p>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px', background: '#3182ce', color: 'white',
                            border: 'none', borderRadius: '8px', cursor: 'pointer',
                            fontWeight: 'bold', marginTop: '15px'
                        }}
                    >
                        OK
                    </button>
                </div>
            </div>
        );
    }

    const totalItems = stockItems.length;
    const checkedToday = todayChecks.length;
    const hasCheckedToday = checkedToday > 0;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000,
            overflowY: 'auto', padding: '20px'
        }}>
            <div style={{
                background: 'white', padding: '30px', borderRadius: '16px',
                width: '900px', maxWidth: '95%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: '#2d3748' }}>
                        📋 Pengecekan Stok Harian - {user.location.toUpperCase()}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent', border: 'none',
                            fontSize: '24px', cursor: 'pointer', color: '#718096'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Info Banner */}
                <div style={{
                    background: hasCheckedToday ? '#fef3c7' : '#dbeafe',
                    border: `2px solid ${hasCheckedToday ? '#fbbf24' : '#3b82f6'}`,
                    padding: '15px', borderRadius: '8px', marginBottom: '20px'
                }}>
                    <div style={{ fontSize: '14px', color: '#1e293b', marginBottom: '8px' }}>
                        <strong>Status Hari Ini:</strong> {hasCheckedToday ? '✅ Sudah Dicek' : '⏳ Belum Dicek'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                        Total Item: <strong>{totalItems}</strong> | 
                        Sudah Dicek: <strong>{checkedToday}</strong> | 
                        Perlu Dicek: <strong>{totalItems - checkedToday}</strong>
                    </div>
                </div>

                {hasCheckedToday && (
                    <div style={{
                        background: '#f0fdf4', border: '2px solid #86efac',
                        padding: '15px', borderRadius: '8px', marginBottom: '20px'
                    }}>
                        <div style={{ fontSize: '14px', color: '#166534', fontWeight: 'bold', marginBottom: '8px' }}>
                            ✅ Pengecekan Hari Ini Sudah Selesai!
                        </div>
                        <div style={{ fontSize: '12px', color: '#166534' }}>
                            Kamu bisa melihat riwayat pengecekan atau melakukan pengecekan ulang jika ada perubahan stok.
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                        onClick={handleQuickMatch}
                        style={{
                            padding: '10px 20px', background: '#8b5cf6', color: 'white',
                            border: 'none', borderRadius: '8px', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '13px'
                        }}
                    >
                        ⚡ Samakan Semua Qty
                    </button>
                </div>

                {/* Stock Check Table */}
                <div style={{
                    maxHeight: '400px', overflowY: 'auto',
                    border: '1px solid #e2e8f0', borderRadius: '8px'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#667eea', color: 'white', position: 'sticky', top: 0 }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left', width: '120px' }}>KODE</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>NAMA BARANG</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>SISTEM</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>AKTUAL</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '80px' }}>SELISIH</th>
                                <th style={{ padding: '12px', textAlign: 'left', width: '150px' }}>CATATAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stockItems.map(item => {
                                const kode = item.kode_barang;
                                const check = checks[kode] || { expected_qty: item.qty, actual_qty: item.qty, notes: '' };
                                const diff = check.actual_qty - check.expected_qty;
                                
                                return (
                                    <tr key={kode} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#667eea' }}>
                                            {kode}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                                                {item.products['NAMA BARANG']}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#718096' }}>
                                                {item.products.KATEGORI}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px', background: '#e0e7ff',
                                                borderRadius: '6px', fontWeight: 'bold',
                                                fontSize: '13px'
                                            }}>
                                                {check.expected_qty}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                value={check.actual_qty}
                                                onChange={(e) => handleCheckChange(
                                                    kode, 
                                                    'actual_qty', 
                                                    parseFloat(e.target.value) || 0
                                                )}
                                                style={{
                                                    width: '70px', padding: '6px', textAlign: 'center',
                                                    border: '2px solid #3b82f6', borderRadius: '6px',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            {diff !== 0 && (
                                                <span style={{
                                                    padding: '4px 8px',
                                                    background: diff > 0 ? '#dcfce7' : '#fee2e2',
                                                    color: diff > 0 ? '#166534' : '#991b1b',
                                                    borderRadius: '6px', fontWeight: 'bold',
                                                    fontSize: '12px'
                                                }}>
                                                    {diff > 0 ? '+' : ''}{diff}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <input
                                                type="text"
                                                placeholder="Catatan..."
                                                value={check.notes}
                                                onChange={(e) => handleCheckChange(kode, 'notes', e.target.value)}
                                                style={{
                                                    width: '100%', padding: '6px',
                                                    border: '1px solid #e2e8f0', borderRadius: '6px',
                                                    fontSize: '12px'
                                                }}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Submit Button */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            padding: '12px 24px', border: 'none',
                            background: '#e2e8f0', borderRadius: '8px',
                            cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSubmitAll}
                        disabled={loading}
                        style={{
                            padding: '12px 24px', border: 'none',
                            background: loading ? '#94a3b8' : '#16a34a',
                            color: 'white', borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {loading ? '⏳ Menyimpan...' : '✅ Simpan Pengecekan'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DailyStockCheckModal;