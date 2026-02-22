import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Trophy, Users, MessageCircle, ThumbsUp, Flame, Star, Hand, Send, Trash2, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserById } from '../services/friendsService';
import { getRatingsByUserId } from '../services/cloudStorageService';
import { getComments, addComment, deleteComment, toggleReaction } from '../services/commentsService';
import { notifyNewComment, notifyNewReaction } from '../services/notificationsService';
import { CLUBS } from '../config/clubs';
import './FriendRatingsPage.css';

const FriendRatingsPage = () => {
  const { friendId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [friend, setFriend] = useState(null);
  const [allRatings, setAllRatings] = useState([]); // Todas las valoraciones sin filtrar
  const [ratings, setRatings] = useState([]); // Valoraciones filtradas
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [expandedRatings, setExpandedRatings] = useState({});
  const [friendClubs, setFriendClubs] = useState([]); // Clubes del amigo
  const [selectedClubId, setSelectedClubId] = useState('all'); // Club seleccionado para filtrar

  useEffect(() => {
    loadFriendData();
  }, [friendId]);

  const loadFriendData = async () => {
    try {
      setLoading(true);
      
      // Cargar datos del amigo
      const friendData = await getUserById(friendId);
      if (!friendData) {
        alert('Usuario no encontrado');
        navigate('/friends');
        return;
      }
      setFriend(friendData);

      // Obtener clubes del amigo (primario + secundarios)
      const clubs = [];
      // Usar primaryClubId o clubId (NO activeClubId que cambia con el selector)
      const primaryId = friendData.primaryClubId || friendData.clubId;
      if (primaryId) {
        const primaryClub = CLUBS.find(c => c.id === primaryId);
        if (primaryClub) clubs.push(primaryClub);
      }
      if (friendData.secondaryClubIds && friendData.secondaryClubIds.length > 0) {
        friendData.secondaryClubIds.forEach(clubId => {
          // Evitar duplicados: no agregar si ya está en el array
          if (clubId !== primaryId) {
            const club = CLUBS.find(c => c.id === clubId);
            if (club) clubs.push(club);
          }
        });
      }
      setFriendClubs(clubs);

      // Cargar valoraciones del amigo
      const friendRatings = await getRatingsByUserId(friendId);
      
      // Asignar clubId a valoraciones que no lo tengan (usar primaryClubId o clubId como fallback)
      const fallbackClubId = friendData.primaryClubId || friendData.clubId;
      
      const ratingsWithClubId = friendRatings.map(rating => ({
        ...rating,
        clubId: rating.clubId || fallbackClubId
      }));
      
      // Ordenar por fecha descendente
      const sortedRatings = ratingsWithClubId.sort((a, b) => {
        const dateA = a.matchDate?.toDate ? a.matchDate.toDate() : new Date(a.matchDate);
        const dateB = b.matchDate?.toDate ? b.matchDate.toDate() : new Date(b.matchDate);
        return dateB - dateA;
      });
      
      setAllRatings(sortedRatings);
      setRatings(sortedRatings); // Inicialmente mostrar todas

      // Cargar comentarios para cada valoración
      const commentsData = {};
      for (const rating of sortedRatings) {
        const ratingComments = await getComments(rating.id);
        commentsData[rating.id] = ratingComments;
      }
      setComments(commentsData);
      
    } catch (error) {
      console.error('Error loading friend data:', error);
      alert('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar valoraciones cuando cambie el club seleccionado
  useEffect(() => {
    if (selectedClubId === 'all') {
      setRatings(allRatings);
    } else {
      setRatings(allRatings.filter(r => r.clubId === selectedClubId));
    }
  }, [selectedClubId, allRatings]);

  const handleAddComment = async (ratingId) => {
    if (!newComment.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      
      await addComment(ratingId, user.uid, newComment.trim());
      
      // Notificar al dueño de la valoración
      const rating = ratings.find(r => r.id === ratingId);
      const matchInfo = rating?.matchInfo?.score || '';
      const clubId = rating?.clubId;
      await notifyNewComment(friendId, user.uid, user.displayName || 'Un amigo', ratingId, matchInfo, clubId);
      
      // Recargar comentarios
      const updatedComments = await getComments(ratingId);
      setComments(prev => ({
        ...prev,
        [ratingId]: updatedComments
      }));
      
      setNewComment('');
      
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Error al agregar comentario');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (ratingId, commentId) => {
    if (!window.confirm('¿Eliminar comentario?')) return;

    try {
      const result = await deleteComment(commentId, user.uid);
      
      if (!result.success) {
        alert(result.error || 'Error al eliminar comentario');
        return;
      }
      
      // Recargar comentarios
      const updatedComments = await getComments(ratingId);
      setComments(prev => ({
        ...prev,
        [ratingId]: updatedComments
      }));
      
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Error al eliminar comentario');
    }
  };

  const handleToggleReaction = async (ratingId, reactionType) => {
    try {
      const result = await toggleReaction(ratingId, user.uid, reactionType);
      
      if (!result.success) {
        alert('Error al reaccionar');
        return;
      }
      
      // Si se agregó una reacción nueva, notificar
      if (result.added) {
        const rating = ratings.find(r => r.id === ratingId);
        const matchInfo = rating?.matchInfo?.score || '';
        const clubId = rating?.clubId;
        await notifyNewReaction(friendId, user.uid, user.displayName || 'Un amigo', ratingId, reactionType, matchInfo, clubId);
      }
      
      // Actualizar solo la valoración específica en el estado local
      const updatedRating = await getRatingsByUserId(friendId);
      const targetRating = updatedRating.find(r => r.id === ratingId);
      
      if (targetRating) {
        setRatings(prev => prev.map(r => r.id === ratingId ? targetRating : r));
      }
      
    } catch (error) {
      console.error('Error toggling reaction:', error);
      alert('Error al reaccionar');
    }
  };

  const getClubInfo = (clubId) => {
    return CLUBS.find(c => c.id === clubId) || { name: 'Club', colors: { primary: '#333', secondary: '#666' } };
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const calculateAverageRating = (rating) => {
    // Los ratings están en rating.players[].rating
    const players = rating.players || [];
    const ratingsArray = players
      .map(p => p.rating)
      .filter(r => r !== null && r !== undefined && r > 0);
    
    if (ratingsArray.length === 0) return '0.0';
    const sum = ratingsArray.reduce((acc, r) => acc + r, 0);
    return (sum / ratingsArray.length).toFixed(1);
  };

  const getReactionIcon = (type) => {
    switch (type) {
      case 'like': return <ThumbsUp size={16} />;
      case 'fire': return <Flame size={16} />;
      case 'star': return <Star size={16} />;
      case 'clap': return <Hand size={16} />;
      default: return null;
    }
  };

  const getReactionCount = (rating, type) => {
    return rating.reactions?.[type]?.length || 0;
  };

  const hasUserReacted = (rating, type) => {
    return rating.reactions?.[type]?.includes(user.uid) || false;
  };

  const toggleRatingExpansion = (ratingId) => {
    setExpandedRatings(prev => ({
      ...prev,
      [ratingId]: !prev[ratingId]
    }));
  };

  if (loading) {
    return (
      <div className="friend-ratings-page">
        <div className="loading-container">
          <Loader size={48} className="spinner" />
          <p>Cargando valoraciones...</p>
        </div>
      </div>
    );
  }

  if (!friend) {
    return (
      <div className="friend-ratings-page">
        <div className="error-container">
          <p>Usuario no encontrado</p>
          <button onClick={() => navigate('/friends')} className="btn-back">
            Volver a Amigos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="friend-ratings-page">
      <div className="friend-ratings-container">
        {/* Header */}
        <div className="friend-header">
          <button onClick={() => navigate('/friends')} className="btn-back-header">
            <ArrowLeft size={20} />
          </button>
          
          <div className="friend-info-header">
            <div className="friend-avatar-large">
              {friend.photoURL ? (
                <img src={friend.photoURL} alt={friend.displayName} />
              ) : (
                <div className="avatar-placeholder">
                  {friend.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            
            <div className="friend-details">
              <h1>{friend.displayName}</h1>
              <p className="friend-id-badge">{friend.friendId}</p>
              <div className="friend-stats">
                <div className="stat-item">
                  <Trophy size={16} />
                  <span>{ratings.length} valoraciones</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de clubes - solo si tiene más de un club */}
        {friendClubs.length > 1 && (
          <div className="club-filter-section">
            <label htmlFor="club-filter">Filtrar por equipo:</label>
            <select 
              id="club-filter"
              value={selectedClubId} 
              onChange={(e) => setSelectedClubId(e.target.value)}
              className="club-filter-select"
            >
              <option value="all">Todos los equipos ({allRatings.length})</option>
              {friendClubs.map(club => {
                const count = allRatings.filter(r => r.clubId === club.id).length;
                return (
                  <option key={club.id} value={club.id}>
                    {club.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Ratings List */}
        <div className="ratings-section">
          {ratings.length === 0 ? (
            <div className="empty-ratings">
              <MessageCircle size={48} className="empty-icon" />
              <h3>Sin valoraciones aún</h3>
              <p>{friend.displayName} no ha publicado valoraciones todavía.</p>
            </div>
          ) : (
            <div className="ratings-grid">
              {ratings.map((rating) => {
                const club = getClubInfo(rating.clubId);
                const avgRating = calculateAverageRating(rating);
                const commentsObj = comments[rating.id] || { success: true, comments: [] };
                const ratingComments = commentsObj.comments || [];
                
                // Obtener datos del partido desde matchInfo
                const matchInfo = rating.matchInfo || {};

                return (
                  <div 
                    key={rating.id} 
                    className="rating-card"
                    style={{
                      borderTop: `4px solid ${club.colors.primary}`
                    }}
                  >
                    {/* Match Info */}
                    <div className="rating-match-info">
                      <div className="match-teams">
                        <span className="team-name">{matchInfo.homeTeam || 'N/A'}</span>
                        <span className="match-score">
                          {matchInfo.homeScore !== undefined ? matchInfo.homeScore : '0'} - {matchInfo.awayScore !== undefined ? matchInfo.awayScore : '0'}
                        </span>
                        <span className="team-name">{matchInfo.awayTeam || 'N/A'}</span>
                      </div>
                      
                      <div className="match-metadata">
                        <span className="match-date">
                          <Calendar size={14} />
                          {matchInfo.date || formatDate(rating.matchDate) || 'Fecha desconocida'}
                        </span>
                        <span className="match-competition">{matchInfo.competition || 'N/A'}</span>
                      </div>

                      <div className="rating-average">
                        <Star size={16} fill="currentColor" />
                        <span>{avgRating}</span>
                      </div>
                    </div>

                    {/* Toggle Players Button */}
                    <button 
                      className="btn-toggle-players"
                      onClick={() => toggleRatingExpansion(rating.id)}
                    >
                      {expandedRatings[rating.id] ? 'Ocultar jugadores' : 'Ver jugadores'}
                      <Users size={16} />
                    </button>

                    {/* Players List (Expandible) */}
                    {expandedRatings[rating.id] && (
                      <div className="friend-players-list">
                        {(rating.players || [])
                          .filter(player => player.rating !== null && player.rating !== undefined && player.rating > 0)
                          .map((player, index) => (
                            <div key={index} className="friend-player-item">
                              <span className="friend-player-name">{player.name}</span>
                              <span className="friend-player-rating">
                                {player.rating.toFixed(1)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Reactions */}
                    <div className="reactions-bar">
                      <button
                        className={`reaction-btn ${hasUserReacted(rating, 'like') ? 'active' : ''}`}
                        onClick={() => handleToggleReaction(rating.id, 'like')}
                      >
                        <ThumbsUp size={16} />
                        <span>{getReactionCount(rating, 'like')}</span>
                      </button>
                      
                      <button
                        className={`reaction-btn ${hasUserReacted(rating, 'fire') ? 'active' : ''}`}
                        onClick={() => handleToggleReaction(rating.id, 'fire')}
                      >
                        <Flame size={16} />
                        <span>{getReactionCount(rating, 'fire')}</span>
                      </button>
                      
                      <button
                        className={`reaction-btn ${hasUserReacted(rating, 'star') ? 'active' : ''}`}
                        onClick={() => handleToggleReaction(rating.id, 'star')}
                      >
                        <Star size={16} />
                        <span>{getReactionCount(rating, 'star')}</span>
                      </button>
                      
                      <button
                        className={`reaction-btn ${hasUserReacted(rating, 'clap') ? 'active' : ''}`}
                        onClick={() => handleToggleReaction(rating.id, 'clap')}
                      >
                        <Hand size={16} />
                        <span>{getReactionCount(rating, 'clap')}</span>
                      </button>
                    </div>

                    {/* Comments Section */}
                    <div className="comments-section">
                      <h4 className="comments-title">
                        <MessageCircle size={16} />
                        Comentarios ({ratingComments.length})
                      </h4>

                      {ratingComments.length > 0 && (
                        <div className="comments-list">
                          {ratingComments.map((comment) => (
                            <div key={comment.id} className="comment-item">
                              <div className="comment-header">
                                <span className="comment-author">
                                  {comment.userInfo?.displayName || 'Usuario desconocido'}
                                </span>
                                <span className="comment-date">
                                  {formatDate(comment.createdAt)}
                                </span>
                              </div>
                              <p className="comment-text">{comment.comment}</p>
                              {comment.userId === user.uid && (
                                <button
                                  className="btn-delete-comment"
                                  onClick={() => handleDeleteComment(rating.id, comment.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment Form */}
                      <div className="add-comment-form">
                        <input
                          type="text"
                          placeholder="Escribe un comentario..."
                          value={selectedRating === rating.id ? newComment : ''}
                          onChange={(e) => {
                            setSelectedRating(rating.id);
                            setNewComment(e.target.value);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(rating.id);
                            }
                          }}
                          disabled={submittingComment}
                        />
                        <button
                          className="btn-send-comment"
                          onClick={() => handleAddComment(rating.id)}
                          disabled={submittingComment || !newComment.trim() || selectedRating !== rating.id}
                        >
                          {submittingComment && selectedRating === rating.id ? (
                            <Loader size={16} className="spinner" />
                          ) : (
                            <Send size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendRatingsPage;
