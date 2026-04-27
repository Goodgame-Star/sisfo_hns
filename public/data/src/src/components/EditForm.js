import React from 'react';

function EditForm({ form, setForm, onSave, onCancel }) {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
      {/* Input Harga */}
      <div>
        <small style={{fontSize:'10px', color:'#666'}}>Harga:</small>
        <input 
            type="number" 
            value={form.harga} 
            onChange={e => setForm({ ...form, harga: e.target.value })} 
            style={{ width: '90px', padding: '5px', border: '1px solid #007bff', borderRadius: '4px' }}
        />
      </div>

      {/* Input Stok */}
      <div>
        <small style={{fontSize:'10px', color:'#666'}}>Stok:</small>
        <input 
            type="number" 
            value={form.stok} 
            onChange={e => setForm({ ...form, stok: e.target.value })} 
            style={{ width: '60px', padding: '5px', border: '1px solid #007bff', borderRadius: '4px' }}
        />
      </div>

      {/* Tombol Aksi */}
      <div style={{ display:'flex', gap:'3px', marginTop:'15px' }}>
          <button onClick={onSave} style={{ background: '#28a745', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' }}>💾</button>
          <button onClick={onCancel} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' }}>❌</button>
      </div>
    </div>
  );
}

export default EditForm;