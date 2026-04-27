import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { styles } from "./DashboardHelpers";

function SalesMonitoringPage({ onBack }) {
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadMonitoringData = async () => {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

        // Ambil semua user sales
        const { data: profiles } = await supabase.from('profiles').select('id, name, location').eq('role', 'sales_toko');
        // Ambil data cek stok hari ini
        const { data: checks } = await supabase.from('daily_stock_checks').select('checked_by').eq('check_date', today);

        if (profiles) {
            const merged = profiles.map(s => ({
                ...s,
                status: checks?.some(c => c.checked_by === s.id) ? 'DONE' : 'PENDING'
            }));
            setSalesData(merged);
        }
        setLoading(false);
    };

    useEffect(() => { loadMonitoringData(); }, []);

    return (
        <div className="dashboard-wrapper">
            <style>{styles}</style>
            <div className="header-card">
                <h1 className="header-title">📊 MONITORING SALES</h1>
                <button onClick={onBack} className="btn-logout" style={{ background: '#64748b' }}>⬅️ Kembali</button>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                    {salesData.map(item => (
                        <div key={item.id} style={{ 
                            padding: '20px', borderRadius: '15px', border: '2px solid',
                            borderColor: item.status === 'DONE' ? '#10b981' : '#f87171',
                            background: item.status === 'DONE' ? '#f0fdf4' : '#fff1f1'
                        }}>
                            <div style={{ fontWeight: '800' }}>{item.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>📍 {item.location?.toUpperCase()}</div>
                            <div style={{ marginTop: '10px', fontWeight: 'bold', color: item.status === 'DONE' ? '#059669' : '#b91c1c' }}>
                                {item.status === 'DONE' ? '✅ SUDAH CEK' : '❌ BELUM CEK'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
export default SalesMonitoringPage;