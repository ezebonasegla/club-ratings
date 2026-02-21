import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLUBS, getClubsByCategory } from '../config/clubs';
import { setUserClub } from '../services/cloudUserConfigService';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Loader } from 'lucide-react';
import './ClubSelection.css';

const ClubSelection = () => {
  const [selectedClub, setSelectedClub] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { changeClub } = useTheme();
  const { user } = useAuth();
  const clubsByCategory = getClubsByCategory();

  const handleClubClick = (club) => {
    setSelectedClub(club);
  };

  const handleConfirm = async () => {
    if (selectedClub && user) {
      setSaving(true);
      
      // Primero actualizar el tema localmente
      changeClub(selectedClub.id);
      
      // Luego guardar en Firestore
      const result = await setUserClub(user.uid, selectedClub.id, {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
      
      if (result.success) {
        // Navegar después de que se haya guardado
        navigate('/');
      } else {
        alert('Error al guardar el club. Por favor intenta de nuevo.');
        setSaving(false);
      }
    }
  };

  return (
    <div className="club-selection-page">
      <div className="club-selection-container">
        <div className="selection-header">
          <h1>⚽ Selecciona tu Club</h1>
          <p>Elige el equipo del que sos hincha para personalizar la aplicación</p>
        </div>

        {/* Clubes Argentinos */}
        <div className="category-section">
          <h2 className="category-title">🇦🇷 Liga Argentina</h2>
          <div className="clubs-grid">
            {clubsByCategory.argentina.map(club => (
              <div
                key={club.id}
                className={`club-card ${selectedClub?.id === club.id ? 'selected' : ''}`}
                onClick={() => handleClubClick(club)}
                style={{
                  '--club-primary': club.colors.primary,
                  '--club-secondary': club.colors.secondary
                }}
              >
                <div 
                  className="club-colors"
                  style={{
                    background: `linear-gradient(135deg, ${club.colors.primary} 0%, ${club.colors.primary} 50%, ${club.colors.secondary} 50%, ${club.colors.secondary} 100%)`
                  }}
                />
                <div className="club-info">
                  <h3>{club.shortName}</h3>
                  <p>{club.name}</p>
                </div>
                {selectedClub?.id === club.id && (
                  <div className="selected-badge">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Clubes Internacionales */}
        {clubsByCategory.internacional.length > 0 && (
          <div className="category-section">
            <h2 className="category-title">🌍 Resto del Mundo</h2>
            <div className="clubs-grid">
              {clubsByCategory.internacional.map(club => (
                <div
                  key={club.id}
                  className={`club-card ${selectedClub?.id === club.id ? 'selected' : ''}`}
                  onClick={() => handleClubClick(club)}
                  style={{
                    '--club-primary': club.colors.primary,
                    '--club-secondary': club.colors.secondary
                  }}
                >
                  <div 
                    className="club-colors"
                    style={{
                      background: `linear-gradient(135deg, ${club.colors.primary} 0%, ${club.colors.primary} 50%, ${club.colors.secondary} 50%, ${club.colors.secondary} 100%)`
                    }}
                  />
                  <div className="club-info">
                    <h3>{club.shortName}</h3>
                    <p>{club.name}</p>
                  </div>
                  {selectedClub?.id === club.id && (
                    <div className="selected-badge">✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedClub && (
          <div className="confirmation-section">
            <div 
              className="selected-preview"
              style={{
                background: selectedClub.colors.primary,
                color: selectedClub.colors.text
              }}
            >
              <span>Has seleccionado:</span>
              <strong>{selectedClub.name}</strong>
            </div>
            <button 
              className="confirm-button"
              onClick={handleConfirm}
              disabled={saving}
              style={{
                background: selectedClub?.colors.primary,
                color: selectedClub?.colors.text,
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? (
                <>
                  <Loader className="spin" size={20} />
                  Guardando...
                </>
              ) : (
                'Confirmar y Continuar'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubSelection;
