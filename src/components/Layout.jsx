import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, BarChart3, Settings, LogOut, Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = () => {
  const { club } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-badge">
              <Shield size={28} strokeWidth={2.5} />
            </div>
            <div className="logo-text">
              <h1>{club?.shortName || 'Valoraciones'}</h1>
              <span className="logo-subtitle">Sistema de Valoraciones</span>
            </div>
          </div>
          <nav className="main-nav">
            <NavLink 
              to="/" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <ClipboardList size={20} />
              <span>Valorar Partido</span>
            </NavLink>
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <BarChart3 size={20} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink 
              to="/manage" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              <Settings size={20} />
              <span>Gestionar</span>
            </NavLink>
          </nav>
          <div className="user-menu">
            {user && (
              <>
                <NavLink 
                  to="/profile" 
                  className="user-info"
                  title="Ver perfil"
                >
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName} 
                      className="user-avatar"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  {!user.photoURL || user.photoURL === '' ? (
                    <div className="user-avatar-placeholder">
                      {user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  ) : (
                    <div className="user-avatar-placeholder" style={{ display: 'none' }}>
                      {user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="user-name">{user.displayName}</span>
                </NavLink>
                <button onClick={handleSignOut} className="logout-button" title="Cerrar sesión">
                  <LogOut size={20} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>© 2026 Club Ratings | Valoraciones de Fútbol Argentino ⚽</p>
      </footer>
    </div>
  );
};

export default Layout;
