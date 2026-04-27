import React, { useState } from 'react'; // Gak perlu useEffect lagi buat narik semua user di awal
import Swal from 'sweetalert2'; 
import { supabase } from './supabaseClient'; // Pastikan lu udah buat file koneksi ini

function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");

 const handleLogin = async () => {
    Swal.showLoading();
    
    // Kita hilangkan variabel 'error' yang bikin warning tadi
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('username', u.trim()) // .trim() buat jaga-jaga kalau ada spasi gak sengaja
      .single();

    Swal.close();

    // Pastikan password dicek dengan teliti
    if (user && String(user.password) === String(p)) {
        const displayName = user.name || user.username.toUpperCase();
        onLogin({ ...user, name: displayName }); 
    } else {
        Swal.fire('Gagal', 'Username atau Password Salah!', 'error');
    }
  };

  return (
    <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f0f2f5'}}>
      <div style={{background:'white', padding:'30px', borderRadius:'10px', width:'300px', boxShadow:'0 5px 15px rgba(0,0,0,0.1)'}}>
        <h3 style={{textAlign:'center', marginBottom:'20px', color:'#333'}}>LOGIN GUDANG</h3>
        <input style={{width:'100%', padding:'10px', marginBottom:'10px', boxSizing:'border-box'}} placeholder="Username" onChange={e=>setU(e.target.value)} />
        <input style={{width:'100%', padding:'10px', marginBottom:'15px', boxSizing:'border-box'}} type="password" placeholder="Password" onChange={e=>setP(e.target.value)} />
        <button style={{width:'100%', padding:'10px', background:'#007bff', color:'white', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}} onClick={handleLogin}>MASUK</button>
      </div>
    </div>
  );
}

export default Login;