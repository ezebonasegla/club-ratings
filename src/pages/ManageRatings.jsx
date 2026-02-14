import React, { useState, useEffect } from 'react';
import { getAllRatingsFromCloud, deleteRatingFromCloud, getRatingByIdFromCloud, updateRatingInCloud } from '../services/cloudStorageService';
import { useAuth } from '../context/AuthContext';
import { Trash2, Edit2, X, Save, Calendar, Trophy, Loader } from 'lucide-react';
import './ManageRatings.css';

const ManageRatings = () => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState([]);
  const [editingRating, setEditingRating] = useState(null);
  const [playerRatings, setPlayerRatings] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      </div>
    </div>
  );
};

export default ManageRatings;
