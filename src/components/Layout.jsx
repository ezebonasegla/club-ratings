import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, BarChart3, Settings, LogOut, Shield, Menu, X, ChevronDown, Plus, Loader, Users } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { addSecondaryClub } from '../services/cloudUserConfigService';
import { CLUBS } from '../config/clubs';
import NotificationBell from './NotificationBell';
import './Layout.css';

const Layout = () => {
  const { club, allClubs, switchActiveClub, primaryClubId, secondaryClubIds, refreshUserClubs } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clubSelectorOpen, setClubSelectorOpen] = useState(false);
  const [showAddClubMenu, setShowAddClubMenu] = useState(false);
  const [switchingClub, setSwitchingClub] = useState(false);
  const [addingClub, setAddingClub] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleClubChange = async (clubId) => {
    setSwitchingClub(true);
    try {
      const result = await switchActiveClub(clubId);
      if (result.success) {
        setClubSelectorOpen(false);
        setShowAddClubMenu(false);
      }
    } finally {
      setSwitchingClub(false);
    }
  };

  const handleAddSecondaryClub = async (clubId) => {
    setAddingClub(true);
    try {
      await addSecondaryClub(user.uid, clubId);
      await refreshUserClubs();
      setShowAddClubMenu(false);
      setClubSelectorOpen(false);
    } catch (error) {
      console.error('Error al agregar club secundario:', error);
      alert('Error al agregar el club');
    } finally {
      setAddingClub(false);
    }
  };

  // Calcular clubes disponibles para agregar
  const allClubIds = [primaryClubId, ...(secondaryClubIds || [])];
  const availableClubs = CLUBS.filter(c => !allClubIds.includes(c.id));
  const canAddSecondaryClub = secondaryClubIds && secondaryClubIds.length < 2;

  // Mostrar selector si hay más de un club O si se pueden agregar clubes secundarios
  const showClubSelector = (allClubs && allClubs.length > 1) || (canAddSecondaryClub && availableClubs.length > 0);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-content">
          {/* Selector de clubes - solo si hay más de uno */}
          {showClubSelector && (
            <div className="club-selector-container">
              <button 
                className="club-selector-button"
                onClick={() => setClubSelectorOpen(!clubSelectorOpen)}
                title="Cambiar club"
              >
                <span className="club-selector-text">{club?.shortName || 'Club'}</span>
                <ChevronDown size={16} className={`club-selector-icon ${clubSelectorOpen ? 'open' : ''}`} />
              </button>
              
              {clubSelectorOpen && (
                <>
                  <div 
                    className="club-selector-overlay" 
                    onClick={() => {
                      setClubSelectorOpen(false);
                      setShowAddClubMenu(false);
                    }}
                  />
                  <div className="club-selector-dropdown">
                    {!showAddClubMenu ? (
                      <>
                        {allClubs.map((c) => (
                          <button
                            key={c.id}
                            className={`club-option ${c.id === club?.id ? 'active' : ''}`}
                            onClick={() => handleClubChange(c.id)}
                            disabled={switchingClub || addingClub}
                          >
                            <div 
                              className="club-option-badge"
                              style={{
                                background: `linear-gradient(135deg, ${c.colors.primary}, ${c.colors.secondary})`
                              }}
                            />
                            <div className="club-option-info">
                              <span className="club-option-name">
                                {switchingClub && c.id === club?.id ? (
                                  <>
                                    <Loader size={14} className="spinner inline-spinner" />
                                    Cambiando...
                                  </>
                                ) : (
                                  c.name
                                )}
                              </span>
                              {c.id === primaryClubId && (
                                <span className="club-option-badge-text">Principal</span>
                              )}
                            </div>
                          </button>
                        ))}
                        
                        {/* Botón para agregar club secundario */}
                        {canAddSecondaryClub && availableClubs.length > 0 && (
                          <button
                            className="club-option add-club-option"
                            onClick={() => setShowAddClubMenu(true)}
                            disabled={switchingClub || addingClub}
                          >
                            <div className="club-option-badge add-club-badge">
                              <Plus size={18} />
                            </div>
                            <div className="club-option-info">
                              <span className="club-option-name">Agregar Club</span>
                            </div>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="club-dropdown-header">
                          <button 
                            className="club-dropdown-back"
                            onClick={() => setShowAddClubMenu(false)}
                          >
                            ← Volver
                          </button>
                          <span className="club-dropdown-title">Seleccionar Club</span>
                        </div>
                        {availableClubs.map((c) => (
                          <button
                            key={c.id}
                            className="club-option"
                            onClick={() => handleAddSecondaryClub(c.id)}
                            disabled={addingClub}
                          >
                            <div 
                              className="club-option-badge"
                              style={{
                                background: `linear-gradient(135deg, ${c.colors.primary}, ${c.colors.secondary})`
                              }}
                            />
                            <div className="club-option-info">
                              <span className="club-option-name">
                                {addingClub ? (
                                  <>
                                    <Loader size={14} className="spinner inline-spinner" />
                                    Agregando...
                                  </>
                                ) : (
                                  c.name
                                )}
                              </span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Campanita de notificaciones - siempre visible */}
          {user && <NotificationBell />}
          
          <button 
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <nav className={`main-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <NavLink 
              to="/" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              onClick={closeMobileMenu}
            >
              <ClipboardList size={20} />
              <span>Valorar Partido</span>
            </NavLink>
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              onClick={closeMobileMenu}
            >
              <BarChart3 size={20} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink 
              to="/friends" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              onClick={closeMobileMenu}
            >
              <Users size={20} />
              <span>Amigos</span>
            </NavLink>
            <NavLink 
              to="/manage" 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              onClick={closeMobileMenu}
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
                  onClick={closeMobileMenu}
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
