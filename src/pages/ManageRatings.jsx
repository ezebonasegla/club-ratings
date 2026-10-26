import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getAllRatingsFromCloud, deleteRatingFromCloud, updateRatingInCloud, hasValidRating } from '../services/cloudStorageService';
import { getCommentsForRatings } from '../services/commentsService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Trash2, Edit2, X, Save, Calendar, Loader, Share2, MessageCircle, ThumbsUp, Flame, Star, Hand } from 'lucide-react';
import ShareRatingModal from '../components/ShareRatingModal';
import AllMatches from './manage/AllMatches';
import './ManageRatings.css';

const ManageRatings = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { club, clubId, primaryClubId } = useTheme();
  const [ratings, setRatings] = useState([]);
  const [editingRating, setEditingRating] = useState(null);
  const [playerRatings, setPlayerRatings] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharingRating, setSharingRating] = useState(null);
  const [comments, setComments] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [view, setView] = useState('ratings'); // 'ratings' | 'all'
  const highlightedRatingRef = useRef(null);

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
    if (user && clubId) {
      loadRatings();
    }
  }, [user, clubId]);

  // Efecto para manejar navegación desde notificaciones
  useEffect(() => {
    if (location.state?.highlightRatingId && ratings.length > 0) {
      const ratingId = location.state.highlightRatingId;
      const shouldExpandComments = location.state.expandComments;
      
      // Expandir comentarios si se requiere
      if (shouldExpandComments) {
        setExpandedComments(prev => ({
          ...prev,
          [ratingId]: true
        }));
      }
      
      // Hacer scroll al rating después de un pequeño delay para que se renderice
      setTimeout(() => {
        if (highlightedRatingRef.current) {
          highlightedRatingRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Agregar efecto visual temporal
          highlightedRatingRef.current.classList.add('highlight-flash');
          setTimeout(() => {
            highlightedRatingRef.current?.classList.remove('highlight-flash');
          }, 2000);
        }
      }, 100);
      
      // Limpiar el state después de usarlo
      window.history.replaceState({}, document.title);
    }
  }, [location.state, ratings]);

  const loadRatings = async () => {
    if (!user || !clubId) return;
    
    setLoading(true);
    const result = await getAllRatingsFromCloud(user.uid, clubId, primaryClubId, { force: true });
    
    if (result.success) {
      const sortedRatings = result.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRatings(sortedRatings);
      setLoading(false);

      // Los comentarios se cargan en segundo plano, todos juntos,
      // sin bloquear la lista de partidos
      const commentsData = await getCommentsForRatings(sortedRatings.map(r => r.id));
      setComments(commentsData);
    } else {
      setLoading(false);
    }
  };

  const toggleComments = (ratingId) => {
    setExpandedComments(prev => ({
      ...prev,
      [ratingId]: !prev[ratingId]
    }));
  };

  const getReactionCount = (rating, type) => {
    return rating.reactions?.[type]?.length || 0;
  };

  const getTotalReactions = (rating) => {
    if (!rating.reactions) return 0;
    return Object.values(rating.reactions).reduce((total, arr) => total + (arr?.length || 0), 0);
  };

  const handleEdit = (rating) => {
    setEditingRating(rating);

    // Inicializar ratings de jugadores
    const initialRatings = {};
    rating.players.forEach(player => {
      if (player.rating !== null && player.rating !== undefined && player.rating !== 'N/A') {
        initialRatings[player.id] = player.rating;
      }
    });
    setPlayerRatings(initialRatings);
  };

  const handleDelete = async (ratingId) => {
    setDeleting(true);
    try {
      const result = await deleteRatingFromCloud(ratingId, user.uid);
      
      if (result.success) {
        setRatings(prev => prev.filter(r => r.id !== ratingId));
        setShowDeleteConfirm(null);
      } else {
        alert('Error al eliminar la valoración');
      }
    } finally {
      setDeleting(false);
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

    const { id: ratingId, ...ratingFields } = editingRating;
    const updatedRating = {
      ...ratingFields,
      players: updatedPlayers
    };

    const result = await updateRatingInCloud(ratingId, updatedRating, user.uid);
    
    if (result.success) {
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, players: updatedPlayers } : r));
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

        <div className="manage-tabs" role="tablist">
          <button role="tab" aria-selected={view === 'ratings'} className={view === 'ratings' ? 'active' : ''} onClick={() => setView('ratings')}>
            Mis valoraciones
          </button>
          <button role="tab" aria-selected={view === 'all'} className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>
            Todos los partidos
          </button>
        </div>

        {view === 'all' && <AllMatches user={user} club={club} clubId={clubId} ratings={ratings} />}

        {view === 'ratings' && (
          <>
            {ratings.length === 0 ? (
              <div className="empty-state">
                <Calendar size={64} />
                <h2>No hay valoraciones guardadas</h2>
                <p>Comienza valorando tu primer partido</p>
              </div>
            ) : (
              <div className="ratings-list">
                {ratings.map(rating => (
                  <div 
                    key={rating.id} 
                    className="rating-card"
                    ref={location.state?.highlightRatingId === rating.id ? highlightedRatingRef : null}
                  >
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
                          onClick={() => setSharingRating(rating)}
                          title="Compartir valoración"
                        >
                          <Share2 size={18} />
                          Compartir
                        </button>
                        <button
                          className="btn-edit"
                          onClick={() => handleEdit(rating)}
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
                        .filter(p => hasValidRating(p.rating))
                        .slice(0, 5)
                        .map(player => (
                          <span key={player.id} className="player-chip">
                            {player.name.split(' ').slice(-1)[0]}: {player.rating}
                          </span>
                        ))}
                      {rating.players.filter(p => hasValidRating(p.rating)).length > 5 && (
                        <span className="more-players">
                          +{rating.players.filter(p => hasValidRating(p.rating)).length - 5} más
                        </span>
                      )}
                    </div>

                    {/* Reacciones y Comentarios */}
                    <div className="rating-interactions">
                      <div className="reactions-summary">
                        {getTotalReactions(rating) > 0 && (
                          <>
                            {getReactionCount(rating, 'like') > 0 && (
                              <span className="reaction-count">
                                <ThumbsUp size={14} /> {getReactionCount(rating, 'like')}
                              </span>
                            )}
                            {getReactionCount(rating, 'fire') > 0 && (
                              <span className="reaction-count">
                                <Flame size={14} /> {getReactionCount(rating, 'fire')}
                              </span>
                            )}
                            {getReactionCount(rating, 'star') > 0 && (
                              <span className="reaction-count">
                                <Star size={14} /> {getReactionCount(rating, 'star')}
                              </span>
                            )}
                            {getReactionCount(rating, 'clap') > 0 && (
                              <span className="reaction-count">
                                <Hand size={14} /> {getReactionCount(rating, 'clap')}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {comments[rating.id]?.comments?.length > 0 && (
                        <button 
                          className="btn-toggle-comments"
                          onClick={() => toggleComments(rating.id)}
                        >
                          <MessageCircle size={16} />
                          {comments[rating.id].comments.length} comentario{comments[rating.id].comments.length !== 1 ? 's' : ''}
                        </button>
                      )}
                    </div>

                    {/* Lista de Comentarios Expandible */}
                    {expandedComments[rating.id] && comments[rating.id]?.comments?.length > 0 && (
                      <div className="comments-section-manage">
                        {comments[rating.id].comments.map((comment) => (
                          <div key={comment.id} className="comment-item-manage">
                            <div className="comment-author-manage">
                              {comment.userInfo?.displayName || 'Usuario'}
                            </div>
                            <div className="comment-text-manage">{comment.comment}</div>
                          </div>
                        ))}
                      </div>
                    )}

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
                              disabled={deleting}
                            >
                              Cancelar
                            </button>
                            <button
                              className="btn-confirm-delete"
                              onClick={() => handleDelete(rating.id)}
                              disabled={deleting}
                            >
                              {deleting ? (
                                <>
                                  <Loader size={18} className="spinner" />
                                  Eliminando...
                                </>
                              ) : (
                                'Eliminar'
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
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
          <ShareRatingModal
            rating={sharingRating}
            club={club}
            onClose={() => setSharingRating(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ManageRatings;
