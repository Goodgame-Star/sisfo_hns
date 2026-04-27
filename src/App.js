import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import SalesPage from "./components/SalesPage";
import DealerPage from "./components/DealerPage";

function App() {
  const [user, setUser] = useState(null);

  // Ambil user dari localStorage saat app load
  useEffect(() => {
    const saved = localStorage.getItem("hns_user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("hns_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("hns_user");
  };

  // 1️⃣ Jika belum login
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // 2️⃣ Routing berdasarkan role
  switch (user.role) {
    case "administrator":
    case "admin_gudang":
      return <Dashboard user={user} onLogout={handleLogout} />;

    case "sales_toko":
      return <SalesPage user={user} onLogout={handleLogout} />;

    case "sales_dealer":
      return <DealerPage user={user} onLogout={handleLogout} />;

    default:
      return <Dashboard user={user} onLogout={handleLogout} />;
  }
}

export default App;
