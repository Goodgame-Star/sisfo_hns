import React, { useState, useEffect } from 'react';
import { getUnreadAlerts, markAlertAsRead, getLowStockProducts } from './supabaseClient';

function StockAlertsPanel({ user, onClose }) {
    const [alerts, setAlerts] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('alerts');

    useEffect(() => {
        loadData();
    }, [user.location]);

    const loadData = async () => {
        setLoading(true);
        const [alertsData, lowStockData] = await Promise.all([
            getUnreadAlerts(user.location),
            getLowStockProducts()
        ]);
        
        // Filter low stock by user location if not admin
        let filteredLowStock = lowStockData;
        if (user.location !== 'all') {
            filteredLowStock = lowStockData.filter(item => item.location === user.location);
        }
        
        setAlerts(alertsData);
        setLowStock(filteredLowStock);
        setLoading(false);
    };

    const handleMarkAsRead = async (alertId) => {
        try {
            await markAlertAsRead(alertId, user.id);
            setAlerts(alerts.filter(a => a.id !== alertId));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await Promise.all(alerts.map(alert => markAlertAsRead(alert.id, user.id)));
            setAlerts([]);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getAlertIcon = (level) => {
        switch (level) {
            case 'critical': return '🚨';
            case 'out_of_stock': return '❌';
            default: return '⚠️';
        }
    };

    const getAlertColor = (level) => {
        switch (level) {
            case 'critical': return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' };
            case 'out_of_stock': return { bg: '#fef2f2', border: '#7f1d1d', text: '#7f1d1d' };
            default: return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000,
            overflowY: 'auto', padding: '20px'
        }}>
            <div style={{
                background: 'white', padding: '30px', borderRadius: '16px',
                width: '800px', maxWidth: '95%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: '#2d3748' }}>
                        🔔 Notifikasi Stok
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

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
                    <button
                        onClick={() => setActiveTab('alerts')}
                        style={{
                            padding: '10px 20px', border: 'none',
                            background: 'transparent',
                            borderBottom: activeTab === 'alerts' ? '3px solid #3b82f6' : 'none',
                            color: activeTab === 'alerts' ? '#3b82f6' : '#64748b',
                            fontWeight: 'bold', cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                    >
                        🔔 Alerts ({alerts.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('lowstock')}
                        style={{
                            padding: '10px 20px', border: 'none',
                            background: 'transparent',
                            borderBottom: activeTab === 'lowstock' ? '3px solid #3b82f6' : 'none',
                            color: activeTab === 'lowstock' ? '#3b82f6' : '#64748b',
                            fontWeight: 'bold', cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                    >
                        📊 Low Stock ({lowStock.length})
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        ⏳ Memuat data...
                    </div>
                ) : (
                    <>
                        {/* Alerts Tab */}
                        {activeTab === 'alerts' && (
                            <div>
                                {alerts.length > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            style={{
                                                padding: '8px 16px', background: '#8b5cf6',
                                                color: 'white', border: 'none', borderRadius: '6px',
                                                cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
                                            }}
                                        >
                                            ✓ Tandai Semua Sudah Dibaca
                                        </button>
                                    </div>
                                )}

                                {alerts.length === 0 ? (
                                    <div style={{
                                        textAlign: 'center', padding: '60px 20px',
                                        background: '#f8fafc', borderRadius: '12px'
                                    }}>
                                        <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#64748b' }}>
                                            Tidak Ada Alert Baru
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>
                                            Semua stok dalam kondisi baik
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {alerts.map(alert => {
                                            const colors = getAlertColor(alert.alert_level);
                                            return (
                                                <div
                                                    key={alert.id}
                                                    style={{
                                                        background: colors.bg,
                                                        border: `2px solid ${colors.border}`,
                                                        borderRadius: '12px',
                                                        padding: '15px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'start'
                                                    }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '24px' }}>
                                                                {getAlertIcon(alert.alert_level)}
                                                            </span>
                                                            <div>
                                                                <div style={{ fontWeight: 'bold', fontSize: '15px', color: colors.text }}>
                                                                    {alert.products['NAMA BARANG']}
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: colors.text, opacity: 0.8 }}>
                                                                    {alert.products['Kode Accurate']} | {alert.products.KATEGORI}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: colors.text, marginLeft: '34px' }}>
                                                            <strong>Lokasi:</strong> {alert.location.toUpperCase()} | 
                                                            <strong> Stok:</strong> {alert.current_qty} unit | 
                                                            <strong> Min:</strong> {alert.min_qty} unit
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: colors.text, opacity: 0.7, marginLeft: '34px', marginTop: '5px' }}>
                                                            {new Date(alert.created_at).toLocaleString('id-ID')}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleMarkAsRead(alert.id)}
                                                        style={{
                                                            background: 'white',
                                                            border: `1px solid ${colors.border}`,
                                                            borderRadius: '6px',
                                                            padding: '6px 12px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px',
                                                            fontWeight: 'bold',
                                                            color: colors.text
                                                        }}
                                                    >
                                                        ✓ OK
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Low Stock Tab */}
                        {activeTab === 'lowstock' && (
                            <div>
                                {lowStock.length === 0 ? (
                                    <div style={{
                                        textAlign: 'center', padding: '60px 20px',
                                        background: '#f8fafc', borderRadius: '12px'
                                    }}>
                                        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📦</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#64748b' }}>
                                            Semua Stok Aman
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>
                                            Tidak ada barang dengan stok menipis
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                                <tr>
                                                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                                                        BARANG
                                                    </th>
                                                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>
                                                        LOKASI
                                                    </th>
                                                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>
                                                        STOK
                                                    </th>
                                                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>
                                                        MIN
                                                    </th>
                                                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>
                                                        STATUS
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lowStock.map(item => {
                                                    const percentage = (item.qty / item.products.min_stock) * 100;
                                                    const status = item.qty === 0 ? 'Habis' : 
                                                                   percentage < 50 ? 'Kritis' : 'Rendah';
                                                    const statusColor = item.qty === 0 ? '#dc2626' : 
                                                                       percentage < 50 ? '#f59e0b' : '#3b82f6';
                                                    
                                                    return (
                                                        <tr key={`${item.kode_barang}-${item.location}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <td style={{ padding: '12px' }}>
                                                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>
                                                                    {item.products['NAMA BARANG']}
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                                    {item.products['Kode Accurate']} | {item.products.KATEGORI}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                <span style={{
                                                                    padding: '4px 8px',
                                                                    background: '#f1f5f9',
                                                                    borderRadius: '6px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 'bold'
                                                                }}>
                                                                    {item.location.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                <span style={{
                                                                    fontWeight: 'bold',
                                                                    fontSize: '16px',
                                                                    color: statusColor
                                                                }}>
                                                                    {item.qty}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>
                                                                {item.products.min_stock}
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                <span style={{
                                                                    padding: '4px 12px',
                                                                    background: statusColor + '20',
                                                                    color: statusColor,
                                                                    borderRadius: '12px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 'bold'
                                                                }}>
                                                                    {status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default StockAlertsPanel;