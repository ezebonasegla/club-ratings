import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { CLUBS } from '../config/clubs';
import { 
  setUserClub, 
  addSecondaryClub, 
  removeSecondaryClub 
} from '../services/cloudUserConfigService';
import { deleteAllUserRatings } from '../services/cloudStorageService';
import { User, Mail, Shield, AlertTriangle, Loader, Plus, X } from 'lucide-react';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { club, changeClub, primaryClubId, secondaryClubIds, allClubs, refreshUserClubs } = useTheme();
  const navigate = useNavigate();
  const [showChangeClub, setShowChangeClub] = useState(false);
  const [showAddSecondary, setShowAddSecondary] = useState(false);
  const [selectedNewClub, setSelectedNewClub] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingClub, setRemovingClub] = useState(null);
  const [addingClub, setAddingClub] = useState(false);

  const handleLogout = async () => {
    const result = await signOut();
    if (result.success) {
      navigate('/login');
    }
  };

  const handleChangeClubClick = () => {
    setShowChangeClub(true);
  };

  const handleClubSelect = (selectedClub) => {
    setSelectedNewClub(selectedClub);
    setShowConfirmModal(true);
  };

  const handleConfirmChange = async () => {
    if (!selectedNewClub || !user) return;

    setSaving(true);

    // Primero eliminar todas las valoraciones del usuario
    const deleteResult = await deleteAllUserRatings(user.uid);
    
    if (deleteResult.success) {
      // Luego cambiar el club
      const result = await setUserClub(user.uid, selectedNewClub.id, {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });

      if (result.success) {
        changeClub(selectedNewClub.id);
        setShowConfirmModal(false);
        setShowChangeClub(false);
        setSelectedNewClub(null);
      } else {
        alert('Error al cambiar el club');
      }
    } else {
      alert('Error al eliminar las valoraciones anteriores');
    }

    setSaving(false);
  };

  const handleCancelChange = () => {
    setShowConfirmModal(false);
    setSelectedNewClub(null);
  };

  const handleAddSecondaryClub = async (clubToAdd) => {
    if (!user) return;
    
    setAddingClub(true);
    const result = await addSecondaryClub(user.uid, clubToAdd.id);
    
    if (result.success) {
      await refreshUserClubs();
      setShowAddSecondary(false);
    } else {
      alert(result.error || 'Error al agregar club secundario');
    }
    
    setAddingClub(false);
  };

  const handleRemoveSecondaryClub = async (clubId) => {
    if (!user) return;
    
    if (!confirm('¿Eliminar este club secundario?')) return;
    
    setRemovingClub(clubId);
    const result = await removeSecondaryClub(user.uid, clubId);
    
    if (result.success) {
      await refreshUserClubs();
    } else {
      alert(result.error || 'Error al eliminar club secundario');
    }
    
    setRemovingClub(null);
  };

  // Clubes disponibles para agregar (que no sean primario ni secundarios)
  const availableClubs = CLUBS.filter(c => 
    c.id !== primaryClubId && !secondaryClubIds.includes(c.id)
  );

  // Verificar si puede agregar más clubes
  const canAddSecondaryClub = secondaryClubIds.length < 2;

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar-large">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName}
                onError={(e) => {
                  console.error('Error loading profile image:', user.photoURL);
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="profile-avatar-fallback">
                <User size={64} />
              </div>
            )}
          </div>
          <h1>{user?.displayName || 'Usuario'}</h1>
          <p className="profile-subtitle">Perfil de usuario</p>
        </div>

        <div className="profile-sections">
          {/* Información Personal */}
          <div className="profile-section">
            <h2>Información Personal</h2>
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <User size={20} />
                <div>
                  <span className="profile-info-label">Nombre</span>
                  <span className="profile-info-value">{user?.displayName || 'No disponible'}</span>
                </div>
              </div>
              <div className="profile-info-item">
                <Mail size={20} />
                <div>
                  <span className="profile-info-label">Email</span>
                  <span className="profile-info-value">{user?.email || 'No disponible'}</span>
                </div>
              </div>
              <div className="profile-info-item">
                <Shield size={20} />
                <div>
                  <span className="profile-info-label">ID de Usuario</span>
                  <span className="profile-info-value user-id">{user?.uid || 'No disponible'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Club Actual */}
          <div className="profile-section">
            <h2>Club Principal</h2>
            {club && primaryClubId === club.id && (
              <div 
                className="current-club-card"
                style={{
                  background: `linear-gradient(135deg, ${club.colors.primary} 0%, ${club.colors.secondary} 100%)`,
                  color: club.colors.text
                }}
              >
                <div className="club-info-large">
                  <h3>{club.name}</h3>
                  <p>{club.shortName}</p>
                  <span className="club-badge-primary">Principal</span>
                </div>
              </div>
            )}
            
            {!showChangeClub ? (
              <button className="btn-change-club" onClick={handleChangeClubClick}>
                Cambiar Club Principal
              </button>
            ) : (
              <>
                <div className="warning-box">
                  <AlertTriangle size={24} />
                  <div>
                    <strong>¡Atención!</strong>
                    <p>Si cambiás tu club principal, se eliminarán TODAS tus valoraciones. Esta acción no se puede deshacer.</p>
                  </div>
                </div>

                <div className="clubs-grid-small">
                  {CLUBS.filter(c => c.id !== primaryClubId).map(clubOption => (
                    <div
                      key={clubOption.id}
                      className="club-card-small"
                      onClick={() => handleClubSelect(clubOption)}
                      style={{
                        '--club-primary': clubOption.colors.primary,
                        '--club-secondary': clubOption.colors.secondary
                      }}
                    >
                      <div 
                        className="club-colors-small"
                        style={{
                          background: `linear-gradient(135deg, ${clubOption.colors.primary} 0%, ${clubOption.colors.secondary} 100%)`
                        }}
                      />
                      <span>{clubOption.shortName}</span>
                    </div>
                  ))}
                </div>

                <button 
                  className="btn-cancel-change" 
                  onClick={() => setShowChangeClub(false)}
                >
                  Cancelar
                </button>
              </>
            )}
          </div>

          {/* Clubes Secundarios */}
          <div className="profile-section">
            <div className="section-header-with-action">
              <h2>Clubes Secundarios</h2>
              {canAddSecondaryClub && !showAddSecondary && (
                <button 
                  className="btn-add-secondary"
                  onClick={() => setShowAddSecondary(true)}
                >
                  <Plus size={16} />
                  Agregar
                </button>
              )}
            </div>

            <p className="section-description">
              Podés agregar hasta 2 clubes adicionales para valorar sus partidos. 
              Cambiar entre clubes no borra tus valoraciones.
            </p>

            {/* Mostrar clubes secundarios */}
            {secondaryClubIds.length > 0 && (
              <div className="secondary-clubs-list">
                {allClubs.filter(c => secondaryClubIds.includes(c.id)).map(secondaryClub => (
                  <div 
                    key={secondaryClub.id}
                    className="secondary-club-item"
                    style={{
                      background: `linear-gradient(135deg, ${secondaryClub.colors.primary}15, ${secondaryClub.colors.secondary}10)`
                    }}
                  >
                    <div 
                      className="secondary-club-badge"
                      style={{
                        background: `linear-gradient(135deg, ${secondaryClub.colors.primary}, ${secondaryClub.colors.secondary})`
                      }}
                    />
                    <div className="secondary-club-info">
                      <span className="secondary-club-name">{secondaryClub.name}</span>
                      <span className="secondary-club-short">{secondaryClub.shortName}</span>
                    </div>
                    <button 
                      className="btn-remove-secondary"
                      onClick={() => handleRemoveSecondaryClub(secondaryClub.id)}
                      title="Eliminar club secundario"
                      disabled={removingClub === secondaryClub.id}
                    >
                      {removingClub === secondaryClub.id ? (
                        <Loader size={18} className="spinner" />
                      ) : (
                        <X size={18} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {secondaryClubIds.length === 0 && !showAddSecondary && (
              <p className="no-secondary-clubs">
                No tenés clubes secundarios. Podés agregar hasta 2.
              </p>
            )}

            {/* Formulario agregar club secundario */}
            {showAddSecondary && (
              <>
                <div className="clubs-grid-small">
                  {availableClubs.map(clubOption => (
                    <div
                      key={clubOption.id}
                      className={`club-card-small ${addingClub ? 'disabled' : ''}`}
                      onClick={() => !addingClub && handleAddSecondaryClub(clubOption)}
                      style={{
                        '--club-primary': clubOption.colors.primary,
                        '--club-secondary': clubOption.colors.secondary,
                        opacity: addingClub ? 0.5 : 1,
                        cursor: addingClub ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <div 
                        className="club-colors-small"
                        style={{
                          background: `linear-gradient(135deg, ${clubOption.colors.primary} 0%, ${clubOption.colors.secondary} 100%)`
                        }}
                      />
                      <span>{clubOption.shortName}</span>
                    </div>
                  ))}
                </div>

                <button 
                  className="btn-cancel-change" 
                  onClick={() => setShowAddSecondary(false)}
                >
                  Cancelar
                </button>
              </>
            )}

            {!canAddSecondaryClub && !showAddSecondary && (
              <p className="max-clubs-message">
                Ya tenés el máximo de clubes secundarios (2).
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="profile-section">
            <h2>Acciones</h2>
            <button className="btn-logout" onClick={handleLogout}>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación */}
      {showConfirmModal && selectedNewClub && (
        <div className="confirm-modal-overlay" onClick={handleCancelChange}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle size={48} color="#ff6b6b" />
            <h2>¿Estás seguro?</h2>
            <p>
              Vas a cambiar de <strong>{club?.shortName}</strong> a <strong>{selectedNewClub.shortName}</strong>.
            </p>
            <p className="warning-text">
              Se eliminarán permanentemente todas tus valoraciones anteriores.
            </p>
            <div className="modal-actions">
              <button 
                className="btn-cancel-modal" 
                onClick={handleCancelChange}
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                className="btn-confirm-modal" 
                onClick={handleConfirmChange}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader size={18} className="spinner" />
                    Cambiando...
                  </>
                ) : (
                  'Sí, cambiar club'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
