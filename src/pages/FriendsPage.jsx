import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  findUserByFriendId, 
  sendFriendRequest, 
  getPendingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendsList,
  removeFriend 
} from '../services/friendsService';
import { getUserConfig } from '../services/cloudUserConfigService';
import { notifyFriendRequest, notifyFriendAccepted } from '../services/notificationsService';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  UserPlus, 
  Users, 
  Check, 
  X, 
  Loader, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import './FriendsPage.css';

const FriendsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [removingFriend, setRemovingFriend] = useState(null);
  const [myFriendId, setMyFriendId] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadPendingRequests(),
      loadFriends(),
      loadMyFriendId()
    ]);
    setLoading(false);
  };

  const loadMyFriendId = async () => {
    const result = await getUserConfig(user.uid);
    if (result.success && result.data) {
      if (result.data.friendId) {
        setMyFriendId(result.data.friendId);
      } else {
        // Si no tiene friendId, generar uno automáticamente
        const { generateUniqueFriendId } = await import('../services/friendsService');
        const friendIdResult = await generateUniqueFriendId(user.uid);
        if (friendIdResult.success) {
          setMyFriendId(friendIdResult.friendId);
        }
      }
    }
  };

  const loadPendingRequests = async () => {
    const result = await getPendingFriendRequests(user.uid);
    if (result.success) {
      setPendingRequests(result.requests);
    }
  };

  const loadFriends = async () => {
    const result = await getFriendsList(user.uid);
    if (result.success) {
      setFriends(result.friends);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length !== 5) {
      setSearchError('El ID debe tener 5 caracteres');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResult(null);

    const result = await findUserByFriendId(searchQuery.trim());
    
    if (result.success) {
      // Verificar que no sea el mismo usuario
      if (result.user.id === user.uid) {
        setSearchError('No puedes agregarte a ti mismo');
      } else {
        setSearchResult(result.user);
      }
    } else {
      setSearchError(result.error || 'Usuario no encontrado');
    }
    
    setSearching(false);
  };

  const handleSendRequest = async (receiverId, receiverName) => {
    setSendingRequest(true);
    
    const result = await sendFriendRequest(user.uid, receiverId);
    
    if (result.success) {
      // Crear notificación para el receptor
      await notifyFriendRequest(
        receiverId, 
        user.uid, 
        user.displayName || 'Un usuario',
        null // El ID de la request se puede obtener si es necesario
      );
      
      setSearchResult(null);
      setSearchQuery('');
      alert('¡Solicitud enviada!');
    } else {
      alert(result.error || 'Error al enviar solicitud');
    }
    
    setSendingRequest(false);
  };

  const handleAcceptRequest = async (request) => {
    setProcessingRequest(request.id);
    
    const result = await acceptFriendRequest(request.id, user.uid);
    
    if (result.success) {
      // Notificar al que envió la solicitud
      await notifyFriendAccepted(
        request.senderId,
        user.uid,
        user.displayName || 'Un usuario'
      );
      
      await loadData();
    } else {
      alert(result.error || 'Error al aceptar solicitud');
    }
    
    setProcessingRequest(null);
  };

  const handleRejectRequest = async (requestId) => {
    setProcessingRequest(requestId);
    
    const result = await rejectFriendRequest(requestId);
    
    if (result.success) {
      await loadPendingRequests();
    } else {
      alert(result.error || 'Error al rechazar solicitud');
    }
    
    setProcessingRequest(null);
  };

  const handleRemoveFriend = async (friendId, friendName) => {
    if (!confirm(`¿Eliminar a ${friendName} de tus amigos?`)) return;
    
    setRemovingFriend(friendId);
    
    const result = await removeFriend(user.uid, friendId);
    
    if (result.success) {
      await loadFriends();
    } else {
      alert(result.error || 'Error al eliminar amigo');
    }
    
    setRemovingFriend(null);
  };

  const handleViewFriendRatings = (friendId) => {
    navigate(`/friend/${friendId}`);
  };

  if (loading) {
    return (
      <div className="friends-page">
        <div className="friends-container">
          <div className="loading-state">
            <Loader size={48} className="spinner" />
            <p>Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-page">
      <div className="friends-container">
        <div className="friends-header">
          <h1>👥 Amigos</h1>
          <p>Conecta con otros usuarios y comparte valoraciones</p>
          {myFriendId && (
            <div className="my-friend-id-display">
              <span className="friend-id-label">Tu ID:</span>
              <span className="friend-id-value">{myFriendId}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="friends-tabs">
          <button
            className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            <Users size={20} />
            Mis Amigos
            {friends.length > 0 && <span className="tab-badge">{friends.length}</span>}
          </button>
          <button
            className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <UserPlus size={20} />
            Solicitudes
            {pendingRequests.length > 0 && <span className="tab-badge">{pendingRequests.length}</span>}
          </button>
          <button
            className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={20} />
            Buscar
          </button>
        </div>

        {/* Content */}
        <div className="friends-content">
          {/* Tab: Mis Amigos */}
          {activeTab === 'friends' && (
            <div className="friends-list-section">
              {friends.length === 0 ? (
                <div className="empty-state">
                  <Users size={64} />
                  <h3>No tienes amigos aún</h3>
                  <p>Busca amigos por su ID único y envíales solicitudes</p>
                  <button 
                    className="btn-primary"
                    onClick={() => setActiveTab('search')}
                  >
                    <Search size={20} />
                    Buscar Amigos
                  </button>
                </div>
              ) : (
                <div className="friends-grid">
                  {friends.map(friend => (
                    <div key={friend.id} className="friend-card">
                      <div className="friend-avatar">
                        {friend.photoURL ? (
                          <img src={friend.photoURL} alt={friend.displayName} />
                        ) : (
                          <Users size={32} />
                        )}
                      </div>
                      <div className="friend-info">
                        <h3>{friend.displayName || 'Usuario'}</h3>
                        <span className="friend-id">{friend.friendId}</span>
                      </div>
                      <div className="friend-actions">
                        <button
                          className="btn-view-ratings"
                          onClick={() => handleViewFriendRatings(friend.id)}
                        >
                          Ver Valoraciones
                        </button>
                        <button
                          className="btn-remove-friend"
                          onClick={() => handleRemoveFriend(friend.id, friend.displayName)}
                          disabled={removingFriend === friend.id}
                        >
                          {removingFriend === friend.id ? (
                            <Loader size={16} className="spinner" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Solicitudes */}
          {activeTab === 'requests' && (
            <div className="requests-section">
              {pendingRequests.length === 0 ? (
                <div className="empty-state">
                  <UserPlus size={64} />
                  <h3>No tienes solicitudes pendientes</h3>
                  <p>Aquí aparecerán las solicitudes de amistad que recibas</p>
                </div>
              ) : (
                <div className="requests-list">
                  {pendingRequests.map(request => (
                    <div key={request.id} className="request-card">
                      <div className="request-avatar">
                        {request.senderInfo?.photoURL ? (
                          <img src={request.senderInfo.photoURL} alt={request.senderInfo.displayName} />
                        ) : (
                          <Users size={32} />
                        )}
                      </div>
                      <div className="request-info">
                        <h3>{request.senderInfo?.displayName || 'Usuario'}</h3>
                        <span className="request-id">{request.senderInfo?.friendId}</span>
                        <span className="request-date">
                          {request.createdAt?.toDate?.()?.toLocaleDateString('es-AR') || 'Hace poco'}
                        </span>
                      </div>
                      <div className="request-actions">
                        <button
                          className="btn-accept"
                          onClick={() => handleAcceptRequest(request)}
                          disabled={processingRequest === request.id}
                        >
                          {processingRequest === request.id ? (
                            <Loader size={18} className="spinner" />
                          ) : (
                            <>
                              <Check size={18} />
                              Aceptar
                            </>
                          )}
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={processingRequest === request.id}
                        >
                          <X size={18} />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Buscar */}
          {activeTab === 'search' && (
            <div className="search-section">
              <div className="search-instructions">
                <AlertCircle size={20} />
                <p>Ingresa el ID único de 5 caracteres de tu amigo para enviarte una solicitud</p>
              </div>

              <form onSubmit={handleSearch} className="search-form">
                <div className="search-input-wrapper">
                  <Search size={20} className="search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                    placeholder="Ej: HD8UO"
                    maxLength={5}
                    className="search-input"
                  />
                  <button 
                    type="submit" 
                    className="btn-search"
                    disabled={searching || searchQuery.length !== 5}
                  >
                    {searching ? (
                      <Loader size={20} className="spinner" />
                    ) : (
                      'Buscar'
                    )}
                  </button>
                </div>
                {searchError && (
                  <div className="search-error">
                    <AlertCircle size={16} />
                    {searchError}
                  </div>
                )}
              </form>

              {searchResult && (
                <div className="search-result">
                  <div className="result-card">
                    <div className="result-avatar">
                      {searchResult.photoURL ? (
                        <img src={searchResult.photoURL} alt={searchResult.displayName} />
                      ) : (
                        <Users size={48} />
                      )}
                    </div>
                    <div className="result-info">
                      <h3>{searchResult.displayName || 'Usuario'}</h3>
                      <span className="result-id">{searchResult.friendId}</span>
                    </div>
                    <button
                      className="btn-send-request"
                      onClick={() => handleSendRequest(searchResult.id, searchResult.displayName)}
                      disabled={sendingRequest}
                    >
                      {sendingRequest ? (
                        <>
                          <Loader size={18} className="spinner" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <UserPlus size={18} />
                          Enviar Solicitud
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
