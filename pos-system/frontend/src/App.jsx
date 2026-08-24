import React, { useEffect, useState } from 'react';
import Login from './components/Login.jsx';
import Checkout from './components/Checkout.jsx';
import Dashboard from './components/Dashboard.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import SalesHistory from './components/SalesHistory.jsx';
import './styles.css';

const NAV_ITEMS = [
  { key: 'admin', icon: '⚙️', label: 'Admin', roles: ['owner'] },
  { key: 'checkout', icon: '🛒', label: 'Checkout', roles: ['branch_manager', 'cashier'] },
  { key: 'dashboard', icon: '📊', label: 'Sales Analysis', roles: ['owner', 'branch_manager'] },
  { key: 'history', icon: '📋', label: 'Sales History', roles: ['owner', 'branch_manager'] },
];

const PAGE_META = {
  checkout: { title: 'Point of Sale', subtitle: 'Select services, process payment, print receipt' },
  dashboard: { title: 'Sales Analysis', subtitle: 'Revenue overview across all branches' },
  history: { title: 'Sales History', subtitle: 'Browse, filter and reprint past receipts' },
  admin: { title: 'Administration', subtitle: 'Manage branches, services and staff accounts' },
};

function getInitials(name = '') {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('checkout');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('pos_user');
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      // Default view based on role
      if (u.role === 'owner') setView('dashboard');
    }
  }, []);

  function handleLogin(u) {
    setUser(u);
    if (u.role === 'owner') setView('dashboard');
    else setView('checkout');
  }

  function handleLogout() {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    setUser(null);
    setView('checkout');
    setAccountMenuOpen(false);
  }

  if (!user) return <Login onLogin={handleLogin} />;

  const allowedNav = NAV_ITEMS.filter((n) => n.roles.includes(user.role));
  const meta = PAGE_META[view] || PAGE_META.checkout;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-label">Menu</div>
          {allowedNav.map((item) => (
            <button
              key={item.key}
              id={`nav-${item.key}`}
              className={`nav-btn${view === item.key ? ' active' : ''}`}
              onClick={() => setView(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <div className="brand-logo">
            <img className="brand-icon" src="/company-logo.jpeg" alt="Tiger Car Wash logo" />
            <div className="brand-text">
              <span className="brand-name">Tiger Car Wash</span>
              <span className="brand-tagline">Multi-Branch POS</span>
            </div>
          </div>
          <div className="top-bar-account">
            <div className="account-menu">
              <button
                id="owner-menu-btn"
                className="user-chip account-menu-trigger"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
              {user.profile_photo ? (
                <img className="user-avatar user-photo" src={user.profile_photo} alt={`${user.name} profile`} />
              ) : (
                <div className="user-avatar">{getInitials(user.name)}</div>
              )}
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role.replace('_', ' ')}</div>
              </div>
                <span className="account-menu-chevron">⌄</span>
              </button>
              {accountMenuOpen && (
                <div className="account-menu-dropdown" role="menu">
                  <button id="logout-btn" className="account-menu-item" onClick={handleLogout} role="menuitem">
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="page-header">
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-subtitle">{meta.subtitle}</p>
        </div>

        <div className="page-body">
          {view === 'checkout' && <Checkout user={user} />}
          {view === 'dashboard' && <Dashboard user={user} />}
          {view === 'history' && <SalesHistory user={user} />}
          {view === 'admin' && user.role === 'owner' && <AdminPanel />}
        </div>
      </main>
    </div>
  );
}
