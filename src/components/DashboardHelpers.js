import React, { useState, useRef, useEffect } from "react";

/* ==================== GLOBAL STYLES ==================== */
export const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

/* ==================== WRAPPER ==================== */
.dashboard-wrapper {
  max-width: 1400px;
  margin: auto;
}

/* ==================== HEADER ==================== */
.header-card {
  background: white;
  border-radius: 16px;
  padding: 20px 28px;
  margin-bottom: 20px;
  box-shadow: 0 12px 25px rgba(0,0,0,.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 26px;
  font-weight: 800;
  color: #1e293b;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-import,
.btn-logout,
.btn-print {
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  transition: .2s;
}

.btn-import { background: #4f46e5; color: white; }
.btn-logout { background: #ef4444; color: white; }
.btn-print  { background: #0f172a; color: white; }

.btn-import:hover,
.btn-logout:hover,
.btn-print:hover {
  transform: translateY(-1px);
  opacity: .9;
}

/* ==================== FILTER ==================== */
.filter-card {
  background: white;
  border-radius: 16px;
  padding: 20px 28px;
  margin-bottom: 20px;
  box-shadow: 0 12px 25px rgba(0,0,0,.08);
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
  letter-spacing: .05em;
}

.input-field {
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid #e2e8f0;
  font-size: 14px;
}

/* ==================== TABLE DESKTOP ==================== */
.table-container {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 25px rgba(0,0,0,.08);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: white;
}

th {
  padding: 14px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .05em;
  text-align: left;
}

td {
  padding: 14px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}

tr:hover {
  background: #f8fafc;
}

/* ==================== STOCK BADGE ==================== */
.status-badge {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.status-ready {
  background: #dcfce7;
  color: #166534;
}

.status-empty {
  background: #fee2e2;
  color: #991b1b;
}

/* ==================== MULTI SELECT ==================== */
.multiselect-wrapper {
  position: relative;
}

.multiselect-display {
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid #e2e8f0;
  background: white;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.multiselect-dropdown {
  position: absolute;
  top: 110%;
  left: 0;
  right: 0;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 25px rgba(0,0,0,.1);
  z-index: 999;
}

.multiselect-option {
  padding: 10px 12px;
  display: flex;
  gap: 8px;
  cursor: pointer;
}

.multiselect-option:hover {
  background: #f1f5f9;
}

/* ==================== MOBILE MODE ==================== */
@media (max-width: 768px) {

  body {
    padding: 10px;
  }

  .header-card {
    flex-direction: column;
    gap: 14px;
    text-align: center;
  }

  .header-actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .filter-row {
    grid-template-columns: 1fr;
  }

  /* TABLE → CARD */
  table, thead, tbody, th, td, tr {
    display: block;
    width: 100%;
  }

  thead {
    display: none;
  }

  tr {
    background: white;
    border-radius: 18px;
    margin-bottom: 18px;
    box-shadow: 0 10px 20px rgba(0,0,0,.08);
    overflow: hidden;
  }

  td {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px dashed #e5e7eb;
    font-size: 13px;
  }

  td::before {
    content: attr(data-label);
    font-size: 10px;
    font-weight: 800;
    color: #94a3b8;
    letter-spacing: .05em;
  }

  /* HEADER CARD */
  td[data-label="IDENTITAS"] {
    background: #f1f5f9;
    font-weight: 800;
    font-size: 14px;
    color: #1e293b;
  }

  td[data-label="IDENTITAS"]::before {
    display: none;
  }

  /* STOK FOCUS */
  td[data-label="STOK"] {
    justify-content: flex-end;
  }

  .status-badge {
    font-size: 13px;
    padding: 6px 16px;
  }
}
`;

/* ==================== MULTI SELECT ==================== */
export function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const close = e => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = opt =>
    selected.includes(opt)
      ? onChange(selected.filter(i => i !== opt))
      : onChange([...selected, opt]);

  return (
    <div className="filter-group" ref={ref}>
      <label className="filter-label">{label}</label>
      <div className="multiselect-wrapper">
        <div className="multiselect-display" onClick={() => setOpen(!open)}>
          <span>{selected.length ? `${selected.length} dipilih` : `Pilih ${label}`}</span>
          <span>{open ? "▲" : "▼"}</span>
        </div>

        {open && (
          <div className="multiselect-dropdown">
            {options.map(opt => (
              <div key={opt} className="multiselect-option" onClick={() => toggle(opt)}>
                <input type="checkbox" checked={selected.includes(opt)} readOnly />
                <span>{opt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default { styles, MultiSelect };
