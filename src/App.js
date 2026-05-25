import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import SalesPage from "./components/SalesPage";
import DealerPage from "./components/DealerPage";
import PicPage from "./components/PicPage";
import GuidePage from "./components/GuidePage";

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("main"); // "main" atau "guide"

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
    setView("main");
    localStorage.removeItem("hns_user");
  };

  // 1️⃣ Jika belum login
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // 2️⃣ Jika sedang melihat halaman panduan
  if (view === "guide") {
    return <GuidePage user={user} onViewMain={() => setView("main")} onLogout={handleLogout} />;
  }

  // 3️⃣ Routing berdasarkan role
  switch (user.role) {
    case "administrator":
    case "admin_gudang":
      return <Dashboard user={user} onLogout={handleLogout} onShowGuide={() => setView("guide")} />;

    case "sales_toko":
      return <SalesPage user={user} onLogout={handleLogout} onShowGuide={() => setView("guide")} />;

    case "sales_dealer":
      return <DealerPage user={user} onLogout={handleLogout} onShowGuide={() => setView("guide")} />;

    case "pic":
      return <PicPage user={user} onLogout={handleLogout} onShowGuide={() => setView("guide")} />;

    default:
      return <Dashboard user={user} onLogout={handleLogout} onShowGuide={() => setView("guide")} />;
  }
}

export default App;
