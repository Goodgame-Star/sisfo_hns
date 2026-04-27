import React, { useState, useEffect } from 'react';
import Login from './components/Login.js';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);

  // Cek apakah user pernah login sebelumnya (disimpan di browser)
  useEffect(() => {
    const saved = localStorage.getItem('hns_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  // Fungsi Login
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('hns_user', JSON.stringify(userData));
  };

  // Fungsi Logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('hns_user');
  };

  // LOGIC TAMPILAN (ROUTING SEDERHANA)
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;