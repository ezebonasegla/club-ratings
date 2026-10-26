import React, { useState, useEffect, useRef } from 'react';
import { fetchMatchData, getLastMatchUrl, extractMatchId, prefetchLastMatches } from '../services/sofascoreService';
import { saveRatingToCloud, checkMatchAlreadyRated, prefetchUserRatings } from '../services/cloudStorageService';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Loader, AlertCircle, Check, Calendar, X, HelpCircle, Share2, Plus } from 'lucide-react';
import { getAttendance, saveAttendance, attendanceId, buildAttendanceFromMatch, ensureSeedImported } from '../services/attendanceService';
import ShareRatingModal from '../components/ShareRatingModal';
import './RatingPage.css';

const RatingPage = () => {
  const { club, clubId } = useTheme();
  const { user } = useAuth();
  const [matchUrl, setMatchUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLastMatch, setLoadingLastMatch] = useState(false);
  const [error, setError] = useState('');
  const [matchData, setMatchData] = useState(null);
  const [playerRatings, setPlayerRatings] = useState({});
  const [skipPlayers, setSkipPlayers] = useState({}); // Jugadores que el usuario decide no valorar
  const [savedRating, setSavedRating] = useState(null); // Última valoración guardada (para compartir)
  const [showShareModal, setShowShareModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showOldMatchModal, setShowOldMatchModal] = useState(false);
  // ¿Fue a la cancha? (tilde, por defecto no)
  const [attended, setAttended] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState(null);

  // Precargar en segundo plano lo que necesita "Valorar Último Partido":
  // la lista de partidos del club y las valoraciones del usuario (para saber si ya lo valoró)
  useEffect(() => {
    if (club?.sofascoreId) prefetchLastMatches(club.sofascoreId);
  }, [club?.sofascoreId]);

  useEffect(() => {
    if (user) prefetchUserRatings(user.uid);
  }, [user]);

  // Primera vez: traer los partidos de "Mi River en la cancha" (sólo la cuenta dueña).
  // Se guarda la promesa para que nada consulte el registro antes de que termine.
  const seedPromise = useRef(Promise.resolve());
  useEffect(() => {
    if (user && clubId) seedPromise.current = ensureSeedImported(user, clubId);
  }, [user, clubId]);

  // Carga el partido mientras en paralelo verifica si ya fue valorado
  const loadMatchIfNotRated = async (url) => {
    const matchId = extractMatchId(url);
    const matchPromise = fetchMatchData(url, club);
    // Evitar "unhandled rejection" si se descarta por estar ya valorado
    matchPromise.catch(() => {});

    if (matchId && user) {
      const check = await checkMatchAlreadyRated(user.uid, matchId);
      if (check.isRated) {
        setError('Este partido ya fue valorado. Puedes editarlo o compartirlo desde "Gestionar Valoraciones".');
        return null;
      }
    }

    return await matchPromise;
  };

  const initializeMatch = (data) => {
    setMatchData(data);
    setAttended(false);
    setExistingAttendance(null);

    // Si el partido ya está en "Mi cancha" (p. ej. importado), viene marcado que fue
    if (user && data.matchInfo?.isoDate) {
      seedPromise.current.then(() => getAttendance(user.uid, clubId)).then(result => {
        const id = attendanceId(user.uid, clubId, data.matchInfo.isoDate);
        const found = result.data.find(a => a.id === id);
        if (found) {
          setExistingAttendance(found);
          setAttended(true);
        }
      });
    }

    // Inicializar ratings vacíos
    const initialRatings = {};
    const initialSkip = {};
    data.players.forEach(player => {
      initialRatings[player.id] = '';
      initialSkip[player.id] = false;
    });
    setPlayerRatings(initialRatings);
    setSkipPlayers(initialSkip);
  };

  const handleLoadLastMatch = async () => {
    if (!club || !club.sofascoreId) {
      setError('No se pudo obtener el ID del club para cargar el último partido');
      return;
    }

    setLoadingLastMatch(true);
    setError('');
    setSavedRating(null);

    try {
      const lastMatchUrl = await getLastMatchUrl(club.sofascoreId);
      
      if (!lastMatchUrl) {
        setError('No se encontró un partido finalizado reciente para este club');
        return;
      }

      const data = await loadMatchIfNotRated(lastMatchUrl);
      if (!data) return;

      setMatchUrl(lastMatchUrl);
      initializeMatch(data);
    } catch (err) {
      setError(err.message || 'Error al cargar el último partido');
      setMatchData(null);
    } finally {
      setLoadingLastMatch(false);
    }
  };

  const handleLoadMatch = async () => {
    if (!matchUrl.trim()) {
      setError('Por favor ingresa una URL de Sofascore');
      return;
    }

    if (!club) {
      setError('Error: No se ha seleccionado un club');
      return;
    }

    setLoading(true);
    setError('');
    setSavedRating(null);

    try {
      // Pasar el club del usuario para validar que el partido sea de ese club
      const data = await loadMatchIfNotRated(matchUrl);
      if (!data) return;

      initializeMatch(data);
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
      matchId: extractMatchId(matchUrl), // Permite verificar rápido si ya fue valorado
      players: matchData.players.map(player => ({
        ...player,
        rating: skipPlayers[player.id] 
          ? 'N/A' 
          : (playerRatings[player.id] !== '' ? parseFloat(playerRatings[player.id]) : null),
        skipped: skipPlayers[player.id] || false
      })),
      attended,
      timestamp: new Date().toISOString()
    };

    try {
      setSaving(true);
      const result = await saveRatingToCloud(ratingData, user.uid, clubId);
      
      if (result.success) {
        setError('');

        // Registrar (o vincular) el partido en "Mi cancha"
        let attendanceStatus = null;
        if (attended && matchData.matchInfo?.isoDate) {
          // Releer siempre al guardar: si el partido ya estaba registrado (p. ej. recién
          // importado) sólo se vincula, sin pisar los datos que cargó el usuario
          await seedPromise.current;
          const existing = await getAttendance(user.uid, clubId, { force: true });
          const found = existing.data.find(a => a.id === attendanceId(user.uid, clubId, matchData.matchInfo.isoDate));
          const link = { ratingId: result.id, matchId: ratingData.matchId };
          const entry = found
            ? { fecha: found.fecha, ...link }
            : { ...buildAttendanceFromMatch(matchData, existing.data), ...link, source: 'rating' };
          const saved = existing.success ? await saveAttendance(user.uid, clubId, entry) : existing;
          attendanceStatus = saved.success
            ? (found ? 'linked' : 'added')
            : saved.error;
        }

        setSavedRating({ id: result.id, ...ratingData, clubId, attendanceStatus });

        // Limpiar formulario: queda la tarjeta de éxito con el botón de compartir
        setMatchData(null);
        setMatchUrl('');
        setPlayerRatings({});
        setSkipPlayers({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            disabled={loading || loadingLastMatch || !club?.sofascoreId}
            className="primary-action-button"
            title={!club?.sofascoreId ? 'ID de Sofascore no disponible para este club' : 'Cargar último partido del club'}
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
        
        {savedRating && (
          <div className="saved-rating-card">
            <div className="saved-rating-header">
              <Check size={20} />
              <span>¡Valoraciones guardadas exitosamente!</span>
            </div>
            <p className="saved-rating-match">
              {club?.shortName || club?.name} vs {savedRating.matchInfo.rival} · {savedRating.matchInfo.score}
            </p>
            {savedRating.attendanceStatus && (
              <p className={`saved-rating-attendance ${['added', 'linked'].includes(savedRating.attendanceStatus) ? '' : 'error'}`}>
                {savedRating.attendanceStatus === 'added' && '🏟️ Agregado a tus partidos en la cancha'}
                {savedRating.attendanceStatus === 'linked' && '🏟️ Vinculado con tu registro de la cancha'}
                {!['added', 'linked'].includes(savedRating.attendanceStatus) && `No se pudo agregar a "Cancha": ${savedRating.attendanceStatus}`}
              </p>
            )}
            <div className="saved-rating-actions">
              <button
                className="saved-rating-share"
                onClick={() => setShowShareModal(true)}
              >
                <Share2 size={18} />
                Compartir
              </button>
              <button
                className="saved-rating-dismiss"
                onClick={() => setSavedRating(null)}
              >
                <Plus size={18} />
                Valorar otro
              </button>
            </div>
          </div>
        )}

        {showShareModal && savedRating && (
          <ShareRatingModal
            rating={savedRating}
            club={club}
            onClose={() => setShowShareModal(false)}
          />
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
                    <li>Ve a <a href={`https://www.sofascore.com/football/team/${club?.name?.toLowerCase().replace(/\s+/g, '-')}/${club?.sofascoreId}`} target="_blank" rel="noopener noreferrer">Sofascore</a></li>
                    <li>Busca el partido de <strong>{club?.shortName}</strong> que quieres valorar</li>
                    <li>Haz clic en el partido para abrir sus detalles</li>
                    <li>Copia la URL completa del navegador</li>
                  </ol>
                  
                  <div className="url-example">
                    <strong>Ejemplo de URL válida:</strong>
                    <code>https://www.sofascore.com/football/match/ca-lanus-ca-independiente#id:15270107</code>
                  </div>
                </div>

                <div className="url-input-section">
                  <label htmlFor="match-url">URL del Partido</label>
                  <input
                    id="match-url"
                    type="text"
                    value={matchUrl}
                    onChange={(e) => setMatchUrl(e.target.value)}
                    placeholder="Pega aquí la URL de Sofascore"
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
                  <span className="match-info-label">Fecha:</span>
                  <span className="match-info-value">{matchData.matchInfo.date}</span>
                </div>
                <div className="info-item">
                  <span className="match-info-label">Rival:</span>
                  <span className="match-info-value">{matchData.matchInfo.rival}</span>
                </div>
                <div className="info-item">
                  <span className="match-info-label">Resultado:</span>
                  <span className="match-info-value">{matchData.matchInfo.score}</span>
                </div>
                <div className="info-item">
                  <span className="match-info-label">Competición:</span>
                  <span className="match-info-value">{matchData.matchInfo.competition}</span>
                </div>
                {matchData.matchInfo.round && (
                  <div className="info-item">
                    <span className="match-info-label">Fecha:</span>
                    <span className="match-info-value">{matchData.matchInfo.round}</span>
                  </div>
                )}
              </div>
            </div>

            <label className={`attendance-check ${attended ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={attended}
                onChange={e => setAttended(e.target.checked)}
              />
              <span className="attendance-check-box" aria-hidden="true">{attended ? '✓' : ''}</span>
              <span className="attendance-check-text">
                <strong>🏟️ Fui a la cancha</strong>
                <small>
                  {existingAttendance
                    ? 'Ya está en tus partidos en la cancha'
                    : 'Se agrega solo a tu registro de la cancha'}
                </small>
              </span>
            </label>

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
                      <div className="rating-input-wrapper">
                        <label htmlFor={`rating-${player.id}`}>Tu Valoración:</label>
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
                      </div>
                      {player.sofascoreRating && (
                        <span className="sofascore-rating-badge" title="Valoración sugerida por Sofascore">
                          Sofascore sugiere: {player.sofascoreRating}
                        </span>
                      )}
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
                            <div className="rating-input-wrapper">
                              <label htmlFor={`rating-${player.id}`}>Tu Valoración:</label>
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
                            </div>
                            {player.sofascoreRating && (
                              <span className="sofascore-rating-badge" title="Valoración sugerida por Sofascore">
                                Sofascore sugiere: {player.sofascoreRating}
                              </span>
                            )}
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
