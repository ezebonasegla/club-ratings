import React, { useState, useEffect, useRef } from 'react';
import { getAllRatingsFromCloud, deleteRatingFromCloud, getRatingByIdFromCloud, updateRatingInCloud } from '../services/cloudStorageService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Trash2, Edit2, X, Save, Calendar, Trophy, Loader, Share2, Download, Copy, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import './ManageRatings.css';

const ManageRatings = () => {
  const { user } = useAuth();
  const { club } = useTheme();
  const [ratings, setRatings] = useState([]);
  const [editingRating, setEditingRating] = useState(null);
  const [playerRatings, setPlayerRatings] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharingRating, setSharingRating] = useState(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareCardRef = useRef(null);

  // Helper para determinar el resultado del partido
  const getMatchResult = (matchInfo) => {
    if (!matchInfo) return 'draw';
    
    // Si ya está guardado el resultado, usarlo
    if (matchInfo.result) {
      return matchInfo.result;
    }
    
    // Fallback: calcular desde scores (para partidos antiguos)
    const userScore = matchInfo.userScore;
    const rivalScore = matchInfo.rivalScore;
    
    if (userScore !== undefined && rivalScore !== undefined) {
      if (userScore > rivalScore) return 'win';
      if (userScore < rivalScore) return 'loss';
      return 'draw';
    }
    
    return 'draw';
  };

  useEffect(() => {
    if (user) {
      loadRatings();
    }
  }, [user]);

  const loadRatings = async () => {
    if (!user) return;
    
    setLoading(true);
    const result = await getAllRatingsFromCloud(user.uid);
    
    if (result.success) {
      setRatings(result.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    }
    setLoading(false);
  };

  const handleEdit = async (ratingId) => {
    const result = await getRatingByIdFromCloud(ratingId, user.uid);
    
    if (result.success) {
      setEditingRating(result.data);
      
      // Inicializar ratings de jugadores
      const ratings = {};
      result.data.players.forEach(player => {
        if (player.rating !== null && player.rating !== undefined && player.rating !== 'N/A') {
          ratings[player.id] = player.rating;
        }
      });
      setPlayerRatings(ratings);
    }
  };

  const handleDelete = async (ratingId) => {
    const result = await deleteRatingFromCloud(ratingId, user.uid);
    
    if (result.success) {
      loadRatings();
      setShowDeleteConfirm(null);
    } else {
      alert('Error al eliminar la valoración');
    }
  };

  const handleRatingChange = (playerId, value) => {
    const numValue = parseFloat(value);
    if (value === '' || (numValue >= 0 && numValue <= 10)) {
      setPlayerRatings(prev => ({
        ...prev,
        [playerId]: value
      }));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRating || !user) return;

    setSaving(true);

    // Actualizar ratings de jugadores
    const updatedPlayers = editingRating.players.map(player => ({
      ...player,
      rating: playerRatings[player.id] !== '' && playerRatings[player.id] !== undefined
        ? parseFloat(playerRatings[player.id])
        : null
    }));

    const updatedRating = {
      ...editingRating,
      players: updatedPlayers
    };

    const result = await updateRatingInCloud(editingRating.id, updatedRating, user.uid);
    
    if (result.success) {
      loadRatings();
      setEditingRating(null);
      setPlayerRatings({});
    } else {
      alert('Error al actualizar la valoración');
    }
    
    setSaving(false);
  };

  const handleCancelEdit = () => {
    setEditingRating(null);
    setPlayerRatings({});
  };

  const handleShare = (rating) => {
    setSharingRating(rating);
    setCopied(false);
  };

  const handleShareAsText = () => {
    if (!sharingRating) return;

    const ratedPlayers = sharingRating.players.filter(p => 
      p.rating !== null && 
      p.rating !== undefined && 
      !isNaN(p.rating) && 
      p.rating !== 'N/A'
    );
    const avgRating = ratedPlayers.length > 0
      ? (ratedPlayers.reduce((sum, p) => sum + p.rating, 0) / ratedPlayers.length).toFixed(1)
      : 'N/A';

    let text = `⚽ ${club?.name || 'Mi Equipo'} - Valoraciones\n`;
    text += `🆚 ${sharingRating.matchInfo.rival}\n`;
    text += `📊 ${sharingRating.matchInfo.score} | ${sharingRating.matchInfo.competition}\n`;
    text += `📅 ${sharingRating.matchInfo.date}\n\n`;
    text += `📈 Promedio del equipo: ${avgRating}\n\n`;
    text += `👥 Valoraciones:\n`;
    
    ratedPlayers
      .sort((a, b) => b.rating - a.rating)
      .forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⭐';
        text += `${medal} ${player.name}: ${player.rating}/10`;
        if (player.goals > 0) text += ` ⚽${player.goals}`;
        if (player.assists > 0) text += ` 🅰️${player.assists}`;
        text += `\n`;
      });

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShareAsImage = async () => {
    if (!shareCardRef.current) return;

    setGeneratingImage(true);

    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false,
        useCORS: true
      });

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `valoracion-${sharingRating.matchInfo.rival.replace(/\s+/g, '-')}-${sharingRating.matchInfo.date}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        setGeneratingImage(false);
      });
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Error al generar la imagen');
      setGeneratingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="manage-ratings-page">
        <div className="manage-container">
          <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
            Cargando valoraciones...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-ratings-page">
      <div className="manage-container">
        <h1>Gestionar Valoraciones</h1>
        <p className="subtitle">Edita o elimina partidos valorados anteriormente</p>

        {ratings.length === 0 ? (
          <div className="empty-state">
            <Calendar size={64} />
            <h2>No hay valoraciones guardadas</h2>
            <p>Comienza valorando tu primer partido</p>
          </div>
        ) : (
          <div className="ratings-list">
            {ratings.map(rating => (
              <div key={rating.id} className="rating-card">
                <div className="rating-header">
                  <div className="match-info-mini">
                    <h3>{rating.matchInfo.rival}</h3>
                    <div className="match-details-mini">
                      <span className="date">{rating.matchInfo.date}</span>
                      <span className={`score score-${getMatchResult(rating.matchInfo)}`}>
                        {rating.matchInfo.score}
                      </span>
                      <span className="competition">{rating.matchInfo.competition}</span>
                    </div>
                  </div>
                  <div className="rating-actions">
                    <button
                      className="btn-share"
                      onClick={() => handleShare(rating)}
                      title="Compartir valoración"
                    >
                      <Share2 size={18} />
                      Compartir
                    </button>
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(rating.id)}
                      title="Editar valoraciones"
                    >
                      <Edit2 size={18} />
                      Editar
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => setShowDeleteConfirm(rating.id)}
                      title="Eliminar partido"
                    >
                      <Trash2 size={18} />
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="players-summary">
                  {rating.players
                    .filter(p => p.rating !== null && p.rating !== undefined)
                    .slice(0, 5)
                    .map(player => (
                      <span key={player.id} className="player-chip">
                        {player.name.split(' ').slice(-1)[0]}: {player.rating}
                      </span>
                    ))}
                  {rating.players.filter(p => p.rating !== null).length > 5 && (
                    <span className="more-players">
                      +{rating.players.filter(p => p.rating !== null).length - 5} más
                    </span>
                  )}
                </div>

                {/* Confirm Delete Modal */}
                {showDeleteConfirm === rating.id && (
                  <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                      <h3>¿Eliminar este partido?</h3>
                      <p>Esta acción no se puede deshacer</p>
                      <div className="modal-actions">
                        <button
                          className="btn-cancel"
                          onClick={() => setShowDeleteConfirm(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          className="btn-confirm-delete"
                          onClick={() => handleDelete(rating.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {editingRating && (
          <div className="edit-modal-overlay" onClick={handleCancelEdit}>
            <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2>Editar Valoraciones</h2>
                  <p className="modal-subtitle">
                    {editingRating.matchInfo.rival} - {editingRating.matchInfo.date}
                  </p>
                </div>
                <button className="btn-close" onClick={handleCancelEdit}>
                  <X size={24} />
                </button>
              </div>

              <div className="modal-body">
                <h3>Jugadores Titulares</h3>
                <div className="edit-players-list">
                  {editingRating.players
                    .filter(p => p.starter)
                    .map(player => (
                      <div key={player.id} className="edit-player-row">
                        <div className="player-info-edit">
                          <span className="player-number">{player.shirtNumber}</span>
                          <span className="player-name">{player.name}</span>
                          <div className="player-stats-mini">
                            <span>{player.minutesPlayed}'</span>
                            {player.goals > 0 && <span>⚽ {player.goals}</span>}
                            {player.assists > 0 && <span>🅰️ {player.assists}</span>}
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={(() => {
                            const value = playerRatings[player.id] ?? player.rating;
                            if (value === 'N/A' || value === null || value === undefined || isNaN(value)) return '';
                            return value;
                          })()}
                          onChange={(e) => handleRatingChange(player.id, e.target.value)}
                          placeholder="0-10"
                          className="rating-input"
                        />
                      </div>
                    ))}
                </div>

                {editingRating.players.some(p => p.substitute && p.minutesPlayed > 0) && (
                  <>
                    <h3>Suplentes que Ingresaron</h3>
                    <div className="edit-players-list">
                      {editingRating.players
                        .filter(p => p.substitute && p.minutesPlayed > 0)
                        .map(player => (
                          <div key={player.id} className="edit-player-row">
                            <div className="player-info-edit">
                              <span className="player-number">{player.shirtNumber}</span>
                              <span className="player-name">{player.name}</span>
                              <div className="player-stats-mini">
                                <span>{player.minutesPlayed}'</span>
                                {player.goals > 0 && <span>⚽ {player.goals}</span>}
                                {player.assists > 0 && <span>🅰️ {player.assists}</span>}
                              </div>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.5"
                              value={(() => {
                                const value = playerRatings[player.id] ?? player.rating;
                                if (value === 'N/A' || value === null || value === undefined || isNaN(value)) return '';
                                return value;
                              })()}
                              onChange={(e) => handleRatingChange(player.id, e.target.value)}
                              placeholder="0-10"
                              className="rating-input"
                            />
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button 
                  className="btn-cancel-edit" 
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button 
                  className="btn-save" 
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader size={18} className="spinner" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {sharingRating && (
          <div className="share-modal-overlay" onClick={() => setSharingRating(null)}>
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Compartir Valoración</h2>
                <button className="btn-close" onClick={() => setSharingRating(null)}>
                  <X size={24} />
                </button>
              </div>

              {/* Preview Card */}
              <div className="share-preview" ref={shareCardRef}>
                <div className="share-card">
                  <div className="share-card-header"
                    style={{
                      background: `linear-gradient(135deg, ${club?.colors.primary} 0%, ${club?.colors.secondary} 100%)`,
                      color: club?.colors.text
                    }}
                  >
                    <h3>{club?.name || 'Mi Equipo'}</h3>
                    <p className="share-subtitle">Valoraciones</p>
                  </div>
                  
                  <div className="share-card-body">
                    <div className="share-match-info">
                      <div className="share-rival">{sharingRating.matchInfo.rival}</div>
                      <div className="share-score">{sharingRating.matchInfo.score}</div>
                      <div className="share-details">
                        <span>{sharingRating.matchInfo.date}</span>
                        <span>{sharingRating.matchInfo.competition}</span>
                      </div>
                    </div>

                    <div className="share-stats">
                      <div className="share-stat">
                        <span className="stat-label">Promedio</span>
                        <span className="stat-value">
                          {(() => {
                            const validPlayers = sharingRating.players.filter(p => 
                              p.rating !== null && 
                              p.rating !== undefined && 
                              !isNaN(p.rating) && 
                              p.rating !== 'N/A'
                            );
                            return validPlayers.length > 0
                              ? (validPlayers.reduce((sum, p) => sum + p.rating, 0) / validPlayers.length).toFixed(1)
                              : 'N/A';
                          })()}
                        </span>
                      </div>
                      <div className="share-stat">
                        <span className="stat-label">Jugadores</span>
                        <span className="stat-value">
                          {sharingRating.players.filter(p => 
                            p.rating !== null && 
                            p.rating !== undefined && 
                            !isNaN(p.rating) && 
                            p.rating !== 'N/A'
                          ).length}
                        </span>
                      </div>
                    </div>

                    <div className="share-top-players">
                      <h4>Valoraciones</h4>
                      {sharingRating.players
                        .filter(p => 
                          p.rating !== null && 
                          p.rating !== undefined && 
                          !isNaN(p.rating) && 
                          p.rating !== 'N/A'
                        )
                        .sort((a, b) => b.rating - a.rating)
                        .map((player, index) => (
                          <div key={player.id} className="share-player-row">
                            <span className="player-rank">{index + 1}</span>
                            <span className="player-name-share">{player.name}</span>
                            <span className="player-rating-share">{player.rating}</span>
                          </div>
                        ))}
                    </div>

                    <div className="share-footer">
                      <span>Club Ratings App</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="share-actions">
                <button 
                  className="btn-share-option"
                  onClick={handleShareAsText}
                  disabled={generatingImage}
                >
                  {copied ? (
                    <>
                      <Check size={20} />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={20} />
                      Copiar como Texto
                    </>
                  )}
                </button>
                <button 
                  className="btn-share-option"
                  onClick={handleShareAsImage}
                  disabled={generatingImage}
                >
                  {generatingImage ? (
                    <>
                      <Loader size={20} className="spinner" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      Descargar Imagen
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageRatings;
