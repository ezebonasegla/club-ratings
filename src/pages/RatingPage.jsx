import React, { useState } from 'react';
import { fetchMatchData, getLastMatchUrl, extractMatchId } from '../services/sofascoreService';
import { saveRatingToCloud, checkMatchAlreadyRated } from '../services/cloudStorageService';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Loader, AlertCircle, Check, Calendar, X, HelpCircle } from 'lucide-react';
import './RatingPage.css';

const RatingPage = () => {
  const { club } = useTheme();
  const { user } = useAuth();
  const [matchUrl, setMatchUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLastMatch, setLoadingLastMatch] = useState(false);
  const [error, setError] = useState('');
  const [matchData, setMatchData] = useState(null);
  const [playerRatings, setPlayerRatings] = useState({});
  const [skipPlayers, setSkipPlayers] = useState({}); // Jugadores que el usuario decide no valorar
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showOldMatchModal, setShowOldMatchModal] = useState(false);

  const handleLoadLastMatch = async () => {
    if (!club || !club.besoccerSlug) {
      setError('No se pudo obtener el slug de BeSoccer para este club');
      return;
    }

    setLoadingLastMatch(true);
    setError('');
    setSaved(false);

    try {
      const lastMatchUrl = await getLastMatchUrl(club.besoccerSlug);
      
      if (!lastMatchUrl) {
        setError('No se encontró un partido finalizado reciente para este club');
        setLoadingLastMatch(false);
        return;
      }

      // Verificar si el partido ya fue valorado ANTES de cargar datos
      const matchId = extractMatchId(lastMatchUrl);
      if (matchId && user) {
        const check = await checkMatchAlreadyRated(user.uid, matchId);
        if (check.isRated) {
          setError('Este partido ya fue valorado. Puedes editarlo desde "Gestionar Valoraciones".');
          setLoadingLastMatch(false);
          return;
        }
      }

      // Cargar el partido automáticamente
      setMatchUrl(lastMatchUrl);
      const data = await fetchMatchData(lastMatchUrl, club);
      setMatchData(data);
      
      // Inicializar ratings vacíos
      const initialRatings = {};
      const initialSkip = {};
      data.players.forEach(player => {
        initialRatings[player.id] = '';
        initialSkip[player.id] = false;
      });
      setPlayerRatings(initialRatings);
      setSkipPlayers(initialSkip);
    } catch (err) {
      setError(err.message || 'Error al cargar el último partido');
      setMatchData(null);
    } finally {
      setLoadingLastMatch(false);
    }
  };

  const handleLoadMatch = async () => {
    if (!matchUrl.trim()) {
      setError('Por favor ingresa una URL de BeSoccer');
      return;
    }

    if (!club) {
      setError('Error: No se ha seleccionado un club');
      return;
    }

    setLoading(true);
    setError('');
    setSaved(false);

    try {
      // Verificar si el partido ya fue valorado ANTES de cargar datos
      const matchId = extractMatchId(matchUrl);
      if (matchId && user) {
        const check = await checkMatchAlreadyRated(user.uid, matchId);
        if (check.isRated) {
          setError('Este partido ya fue valorado. Puedes editarlo desde "Gestionar Valoraciones".');
          setLoading(false);
          return;
        }
      }

      // Pasar el club del usuario para validar que el partido sea de ese club
      const data = await fetchMatchData(matchUrl, club);
      setMatchData(data);
      
      // Inicializar ratings vacíos
      const initialRatings = {};
      const initialSkip = {};
      data.players.forEach(player => {
        initialRatings[player.id] = '';
        initialSkip[player.id] = false;
      });
      setPlayerRatings(initialRatings);
      setSkipPlayers(initialSkip);
      setShowOldMatchModal(false); // Cerrar modal al cargar
    } catch (err) {
      setError(err.message || 'Error al obtener datos del partido');
      setMatchData(null);
    } finally {
      setLoading(false);
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

  const handleSkipToggle = (playerId) => {
    setSkipPlayers(prev => ({
      ...prev,
      [playerId]: !prev[playerId]
    }));
    // Si se marca como "no valorar", limpiar la nota
    if (!skipPlayers[playerId]) {
      setPlayerRatings(prev => ({
        ...prev,
        [playerId]: ''
      }));
    }
  };

  const handleSaveRatings = async () => {
    if (!matchData || !user) return;

    // Validar que al menos un jugador tenga nota (sin contar los que se marcaron para no valorar)
    const hasRatings = Object.entries(playerRatings).some(([id, rating]) => 
      rating !== '' && !skipPlayers[id]
    );
    if (!hasRatings) {
      setError('Debes calificar al menos un jugador');
      return;
    }

    // Preparar datos para guardar
    const ratingData = {
      matchInfo: {
        ...matchData.matchInfo,
        matchUrl: matchUrl // Guardar la URL para futuras verificaciones
      },
      players: matchData.players.map(player => ({
        ...player,
        rating: skipPlayers[player.id] 
          ? 'N/A' 
          : (playerRatings[player.id] !== '' ? parseFloat(playerRatings[player.id]) : null),
        skipped: skipPlayers[player.id] || false
      })),
      timestamp: new Date().toISOString()
    };

    try {
      setSaving(true);
      const result = await saveRatingToCloud(ratingData, user.uid);
      
      if (result.success) {
        setSaved(true);
        setError('');
        
        // Limpiar formulario después de 2 segundos
        setTimeout(() => {
          setMatchData(null);
          setMatchUrl('');
          setPlayerRatings({});
          setSkipPlayers({});
          setSaved(false);
        }, 2000);
      } else {
        setError(result.error || 'Error al guardar las valoraciones');
      }
    } catch (err) {
      setError('Error al guardar las valoraciones en la nube');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rating-page">
      <div className="rating-container">
        <h1>Valorar Partido</h1>
        
        {club && (
          <div className="club-info-banner">
            <span>Valorando partido de: <strong>{club.name}</strong></span>
          </div>
        )}
        
        {/* Botón principal: Último partido */}
        <div className="main-action">
          <button
            onClick={handleLoadLastMatch}
            disabled={loading || loadingLastMatch || !club?.besoccerSlug}
            className="primary-action-button"
            title={!club?.besoccerSlug ? 'Slug de BeSoccer no disponible para este club' : 'Cargar último partido del club'}
          >
            {loadingLastMatch ? (
              <>
                <Loader className="spin" size={24} />
                <div>
                  <span className="button-title">Cargando último partido...</span>
                  <span className="button-subtitle">Por favor espera</span>
                </div>
              </>
            ) : (
              <>
                <Calendar size={24} />
                <div>
                  <span className="button-title">Valorar Último Partido</span>
                  <span className="button-subtitle">Cargar último partido de {club?.shortName}</span>
                </div>
              </>
            )}
          </button>

          {/* Botón secundario: Partido antiguo */}
          <button
            onClick={() => setShowOldMatchModal(true)}
            disabled={loading || loadingLastMatch}
            className="secondary-action-button"
          >
            <HelpCircle size={16} />
            <span>Valorar Partido Antiguo</span>
          </button>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        
        {saved && (
          <div className="success-message">
            <Check size={16} />
            <span>¡Valoraciones guardadas exitosamente!</span>
          </div>
        )}

        {/* Modal para partido antiguo */}
        {showOldMatchModal && (
          <div className="modal-overlay" onClick={() => setShowOldMatchModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Valorar Partido Antiguo</h2>
                <button 
                  className="modal-close"
                  onClick={() => setShowOldMatchModal(false)}
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="modal-body">
                <div className="instructions">
                  <h3>¿Cómo obtener la URL del partido?</h3>
                  <ol>
                    <li>Ve a <a href={`https://es.besoccer.com/equipo/partidos/${club?.besoccerSlug || 'ca-river-plate'}`} target="_blank" rel="noopener noreferrer">BeSoccer</a></li>
                    <li>Busca el partido de <strong>{club?.shortName}</strong> que quieres valorar</li>
                    <li>Haz clic en el partido para abrir sus detalles</li>
                    <li>Ve a la pestaña "Alineaciones"</li>
                    <li>Copia la URL completa del navegador</li>
                  </ol>
                  
                  <div className="url-example">
                    <strong>Ejemplo de URL válida:</strong>
                    <code>https://es.besoccer.com/partido/argentinos-juniors/ca-river-plate/2026238340/alineaciones</code>
                  </div>
                </div>

                <div className="url-input-section">
                  <label htmlFor="match-url">URL del Partido</label>
                  <input
                    id="match-url"
                    type="text"
                    value={matchUrl}
                    onChange={(e) => setMatchUrl(e.target.value)}
                    placeholder="Pega aquí la URL de BeSoccer"
                    className="url-input"
                  />
                  
                  <button
                    onClick={handleLoadMatch}
                    disabled={loading || !matchUrl.trim()}
                    className="load-match-button"
                  >
                    {loading ? <Loader className="spin" size={20} /> : 'Cargar Partido'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {matchData && (
          <>
            <div className="match-info">
              <h2>Información del Partido</h2>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Fecha:</span>
                  <span className="info-value">{matchData.matchInfo.date}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Rival:</span>
                  <span className="info-value">{matchData.matchInfo.rival}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Resultado:</span>
                  <span className="info-value">{matchData.matchInfo.score}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Competición:</span>
                  <span className="info-value">{matchData.matchInfo.competition}</span>
                </div>
                {matchData.matchInfo.round && (
                  <div className="info-item">
                    <span className="info-label">Fecha:</span>
                    <span className="info-value">{matchData.matchInfo.round}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="players-section">
              <h2>Jugadores Titulares</h2>
              <div className="players-list">
                {matchData.players.filter(p => p.starter).map(player => (
                  <div key={player.id} className="player-card">
                    <div className="player-info">
                      <div className="player-header">
                        <span className="player-number">{player.shirtNumber}</span>
                        <span className="player-name">{player.name}</span>
                      </div>
                      <div className="player-stats">
                        <span className="stat-badge">{player.position}</span>
                        <span className="stat-badge">{player.minutesPlayed}'</span>
                        {player.goals > 0 && (
                          <span className="stat-badge goals">⚽ {player.goals}</span>
                        )}
                        {player.assists > 0 && (
                          <span className="stat-badge assists">🅰️ {player.assists}</span>
                        )}
                        {player.yellowCard && (
                          <span className="stat-badge yellow-card">🟨</span>
                        )}
                        {player.redCard && (
                          <span className="stat-badge red-card">🟥</span>
                        )}
                      </div>
                    </div>
                    <div className="player-rating-input">
                      <label htmlFor={`rating-${player.id}`}>Nota:</label>
                      <input
                        id={`rating-${player.id}`}
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={playerRatings[player.id] || ''}
                        onChange={(e) => handleRatingChange(player.id, e.target.value)}
                        placeholder="0-10"
                        disabled={skipPlayers[player.id]}
                      />
                      <label className="skip-player-label">
                        <input
                          type="checkbox"
                          checked={skipPlayers[player.id] || false}
                          onChange={() => handleSkipToggle(player.id)}
                        />
                        <span>No valorar</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {matchData.players.some(p => p.substitute && p.minutesPlayed > 0) && (
                <>
                  <h2>Suplentes que Ingresaron</h2>
                  <div className="players-list">
                    {matchData.players
                      .filter(p => p.substitute && p.minutesPlayed > 0)
                      .map(player => (
                        <div key={player.id} className="player-card">
                          <div className="player-info">
                            <div className="player-header">
                              <span className="player-number">{player.shirtNumber}</span>
                              <span className="player-name">{player.name}</span>
                            </div>
                            <div className="player-stats">
                              <span className="stat-badge">{player.position}</span>
                              <span className="stat-badge">{player.minutesPlayed}'</span>
                              {player.goals > 0 && (
                                <span className="stat-badge goals">⚽ {player.goals}</span>
                              )}
                              {player.assists > 0 && (
                                <span className="stat-badge assists">🅰️ {player.assists}</span>
                              )}
                              {player.yellowCard && (
                                <span className="stat-badge yellow-card">🟨</span>
                              )}
                              {player.redCard && (
                                <span className="stat-badge red-card">🟥</span>
                              )}
                            </div>
                          </div>
                          <div className="player-rating-input">
                            <label htmlFor={`rating-${player.id}`}>Nota:</label>
                            <input
                              id={`rating-${player.id}`}
                              type="number"
                              min="0"
                              max="10"
                              step="0.5"
                              value={playerRatings[player.id] || ''}
                              onChange={(e) => handleRatingChange(player.id, e.target.value)}
                              placeholder="0-10"
                              disabled={skipPlayers[player.id]}
                            />
                            <label className="skip-player-label">
                              <input
                                type="checkbox"
                                checked={skipPlayers[player.id] || false}
                                onChange={() => handleSkipToggle(player.id)}
                              />
                              <span>No valorar</span>
                            </label>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}

              <button 
                className="save-button"
                onClick={handleSaveRatings}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader className="spin" size={20} />
                    Guardando...
                  </>
                ) : (
                  'Guardar Valoraciones'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RatingPage;
