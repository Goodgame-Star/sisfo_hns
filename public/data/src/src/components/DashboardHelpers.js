import React, { useState, useRef, useEffect } from 'react';

// ==================== STYLES PATEN (LAPTOP & MOBILE) ====================
export const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body { 
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
  }

  .dashboard-wrapper { max-width: 1400px; margin: 0 auto; }

  /* HEADER & FILTER CARD */
  .header-card, .filter-card {
    background: white;
    border-radius: 12px;
    padding: 20px 30px;
    margin-bottom: 20px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }

  .header-card { display: flex; justify-content: space-between; align-items: center; }
  .header-title { font-size: 28px; color: #2d3748; display: flex; align-items: center; gap: 10px; }

  .header-actions { display: flex; gap: 10px; }
  .btn-add { background: #48bb78; color: white; }
  .btn-import { background: #4299e1; color: white; }
  .btn-logout { background: #f56565; color: white; }
  .btn-add, .btn-import, .btn-logout, .btn-print { padding: 10px 20px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.3s; font-size: 14px; }

  .filter-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
  .filter-group { display: flex; flex-direction: column; gap: 8px; }
  .filter-label { font-size: 12px; font-weight: 600; color: #4a5568; text-transform: uppercase; letter-spacing: 0.5px; }
  .input-field { padding: 10px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; }

  /* TABLE DESKTOP (LAPTOP) */
  .table-container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  table { width: 100%; border-collapse: collapse; }
  thead { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
  th { padding: 15px; text-align: left; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; }
  td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; vertical-align: middle; }

  /* GESER KODE KE KIRI (DESKTOP) */
  th:nth-child(2), td:nth-child(2) { padding-left: 10px !important; width: 120px; }

  .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .status-ready { background: #c6f6d5; color: #22543d; }
  .status-empty { background: #fed7d7; color: #742a2a; }

  /* MOBILE RESPONSIVE (MAX 768px) */
  @media (max-width: 768px) {
    body { padding: 10px; }
    .header-card { flex-direction: column; gap: 15px; text-align: center; }
    .header-actions { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .filter-row { grid-template-columns: 1fr; }

    /* TRANSFORM TABLE KE KARTU */
    table, thead, tbody, th, td, tr { display: block; width: 100%; }
    thead { display: none; } /* Sembunyikan Header di HP */

    tr {
      background: white;
      margin-bottom: 25px;
      border-radius: 16px;
      border: 1px solid #edf2f7;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    /* 1. Header Kartu (Identitas) */
    td[data-label="IDENTITAS"] {
      background: #f8fafc;
      padding: 15px !important;
      text-align: left !important;
      border-bottom: 1px solid #e2e8f0;
    }
    td[data-label="IDENTITAS"]::before { display: none; }

    /* 2. Isi Kartu (Data Harga & Stok) */
    td:not([data-label="IDENTITAS"]):not([data-label="AKSI"]):not([data-label="PILIH"]) {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 15px !important;
      border-bottom: 1px dashed #edf2f7;
      text-align: right !important;
    }

    /* Label di Sebelah Kiri (Hanya HP) */
    td::before {
      content: attr(data-label);
      font-weight: 700;
      color: #a0aec0;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* 3. Footer Kartu (Aksi) */
    td[data-label="AKSI"] {
      background: #f8fafc;
      padding: 12px 15px !important;
      display: flex;
      gap: 10px;
      border-bottom: none;
    }
    td[data-label="AKSI"]::before { display: none; }
  }

  /* MultiSelect Styling */
  .multiselect-wrapper { position: relative; }
  .multiselect-display { padding: 10px 12px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; background: white; display: flex; justify-content: space-between; align-items: center; min-height: 42px; }
  .multiselect-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #e2e8f0; border-radius: 8px; margin-top: 5px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .multiselect-option { padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .multiselect-option:hover { background: #f7fafc; }
`;

// ==================== MULTI SELECT COMPONENT ====================
export function MultiSelect({ label, options, selected, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const wrapperRef = useRef(null);

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm("");
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option) => {
        if (selected.includes(option)) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    return (
        <div className="filter-group" ref={wrapperRef}>
            <label className="filter-label">{label}</label>
            <div className="multiselect-wrapper">
                <div className="multiselect-display" onClick={() => setIsOpen(!isOpen)}>
                    <span style={{ color: selected.length === 0 ? '#a0aec0' : '#000' }}>
                        {selected.length === 0 ? `Pilih ${label}...` : `${selected.length} dipilih`}
                    </span>
                    <span>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                    <div className="multiselect-dropdown">
                        <div style={{ padding: '8px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: 'white' }}>
                            <input 
                                type="text" 
                                placeholder={`Cari ${label}...`} 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                            {filteredOptions.length > 0 ? filteredOptions.map(option => (
                                <div key={option} className="multiselect-option" onClick={() => toggleOption(option)}>
                                    <input type="checkbox" checked={selected.includes(option)} readOnly />
                                    <span>{option}</span>
                                </div>
                            )) : <div style={{padding:'10px', fontSize:'12px', color:'#999'}}>Tidak ditemukan</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default { styles, MultiSelect };