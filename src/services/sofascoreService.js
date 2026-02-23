import axios from 'axios';

/**
 * Servicio para extraer información de partidos desde Sofascore
 * En desarrollo: peticiones directas a Sofascore (sin proxy)
 * En producción: usa Vercel Serverless Function con ScraperAPI
 */

// Detectar si estamos en desarrollo o producción
const IS_DEV = import.meta.env.DEV;

// Proxy URL - Solo usado en producción
const PROXY_URL = '/api/sofascore';

/**
 * Función helper para hacer peticiones
 * En desarrollo: petición directa a Sofascore
 * En producción: a través del proxy con ScraperAPI
 */
const fetchFromSofascore = async (url) => {
  if (IS_DEV) {
    // En desarrollo: petición directa sin proxy
    console.log('🔵 DEV: Petición directa a Sofascore (sin ScraperAPI):', url);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': 'https://www.sofascore.com/',
        'Origin': 'https://www.sofascore.com'
      }
    });
    return response;
  } else {
    // En producción: a través del proxy con ScraperAPI
    console.log('🟢 PROD: Petición a través de proxy con ScraperAPI');
    const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const response = await axios.get(proxyUrl);
    return response;
  }
};

/**
 * Extrae el ID del partido de la URL de Sofascore
 */
export const extractMatchId = (url) => {
  const match = url.match(/id[:\-](\d+)/);
  return match ? match[1] : null;
};

/**
 * Verifica si el partido pertenece al club seleccionado
 * @param {string} clubName - Nombre o nombre corto del club
 * @param {string} homeTeam - Nombre del equipo local
 * @param {string} awayTeam - Nombre del equipo visitante
 * @param {number} clubSofascoreId - ID de Sofascore del club (opcional)
 * @param {number} homeTeamId - ID del equipo local (opcional)
 * @param {number} awayTeamId - ID del equipo visitante (opcional)
 */
export const isMatchFromClub = (clubName, homeTeam, awayTeam, clubSofascoreId = null, homeTeamId = null, awayTeamId = null) => {
  // Si tenemos IDs de Sofascore, usarlos para comparación exacta (método más confiable)
  if (clubSofascoreId && (homeTeamId || awayTeamId)) {
    return clubSofascoreId === homeTeamId || clubSofascoreId === awayTeamId;
  }
  
  const normalizedClubName = clubName.toLowerCase().trim();
  const normalizedHome = homeTeam.toLowerCase().trim();
  const normalizedAway = awayTeam.toLowerCase().trim();
  
  // Primero intentar comparación exacta
  if (normalizedHome === normalizedClubName || normalizedAway === normalizedClubName) {
    return true;
  }
  
  // Si no hay match exacto, verificar que el nombre del club esté presente
  // pero asegurándonos de que no es parte de otro nombre más largo
  const homeMatch = normalizedHome.includes(normalizedClubName);
  const awayMatch = normalizedAway.includes(normalizedClubName);
  
  // Verificar que si hay match, no sea un falso positivo
  // (ej: "independiente" no debe matchear con "independiente rivadavia")
  if (homeMatch) {
    // Si el nombre del equipo es más largo que el del club, verificar que no sea otro equipo
    if (normalizedHome.length > normalizedClubName.length) {
      // Si hay palabras adicionales después del nombre del club, es probablemente otro equipo
      const words = normalizedHome.split(/\s+/);
      const clubWords = normalizedClubName.split(/\s+/);
      // Verificar que todas las palabras del club estén presentes en el mismo orden
      return words.join(' ').startsWith(clubWords.join(' '));
    }
    return true;
  }
  
  if (awayMatch) {
    if (normalizedAway.length > normalizedClubName.length) {
      const words = normalizedAway.split(/\s+/);
      const clubWords = normalizedClubName.split(/\s+/);
      return words.join(' ').startsWith(clubWords.join(' '));
    }
    return true;
  }
  
  return false;
};

/**
 * Obtiene datos del partido desde la API de Sofascore
 * La API pública de Sofascore: https://api.sofascore.com/api/v1/event/{matchId}
 * @param {string} matchUrl - URL del partido en Sofascore
 * @param {Object} userClub - Objeto con datos del club del usuario (opcional)
 */
export const fetchMatchData = async (matchUrl, userClub = null) => {
  try {
    const matchId = extractMatchId(matchUrl);
    if (!matchId) {
      throw new Error('URL inválida de Sofascore');
    }

    // Endpoints de la API de Sofascore
    const eventUrl = `https://api.sofascore.com/api/v1/event/${matchId}`;
    const lineupsUrl = `https://api.sofascore.com/api/v1/event/${matchId}/lineups`;
    const incidentsUrl = `https://api.sofascore.com/api/v1/event/${matchId}/incidents`;

    // Hacer peticiones en paralelo (directas en DEV, proxy en PROD)
    const [eventResponse, lineupsResponse, incidentsResponse] = await Promise.all([
      fetchFromSofascore(eventUrl),
      fetchFromSofascore(lineupsUrl),
      fetchFromSofascore(incidentsUrl)
    ]);

    const eventData = eventResponse.data.event;
    const lineupsData = lineupsResponse.data;
    const incidentsData = incidentsResponse.data.incidents;

    // Calcular tiempo total del partido incluyendo tiempo de adición
    const injuryTime1 = eventData.time?.injuryTime1 || 0;
    const injuryTime2 = eventData.time?.injuryTime2 || 0;
    const totalMatchMinutes = 90 + injuryTime1 + injuryTime2;

    // Procesar datos del partido
    const homeScore = eventData.homeScore?.display || 0;
    const awayScore = eventData.awayScore?.display || 0;
    
    const matchInfo = {
      date: new Date(eventData.startTimestamp * 1000).toLocaleDateString('es-AR'),
      homeTeam: eventData.homeTeam.name,
      awayTeam: eventData.awayTeam.name,
      competition: eventData.tournament.name,
      round: eventData.roundInfo?.round || '',
      score: `${homeScore} - ${awayScore}`,
      homeScore: homeScore,
      awayScore: awayScore
    };

    // Si se proporcionó un club de usuario, verificar que el partido sea de ese club
    if (userClub) {
      const homeTeamId = eventData.homeTeam.id;
      const awayTeamId = eventData.awayTeam.id;
      const clubSofascoreId = userClub.sofascoreId;
      
      const isFromUserClub = isMatchFromClub(
        userClub.shortName, 
        eventData.homeTeam.name, 
        eventData.awayTeam.name,
        clubSofascoreId,
        homeTeamId,
        awayTeamId
      ) || isMatchFromClub(
        userClub.name, 
        eventData.homeTeam.name, 
        eventData.awayTeam.name,
        clubSofascoreId,
        homeTeamId,
        awayTeamId
      );
      
      if (!isFromUserClub) {
        throw new Error(`Este partido no es de ${userClub.name}. Por favor, ingresa un partido de tu club.`);
      }
    }

    // Determinar si el club del usuario jugó como local o visitante
    let isUserTeamHome, userTeam, rival;
    
    if (userClub) {
      const homeTeamId = eventData.homeTeam.id;
      const awayTeamId = eventData.awayTeam.id;
      const clubSofascoreId = userClub.sofascoreId;
      
      // Verificar si es el equipo local usando IDs (más confiable)
      if (clubSofascoreId) {
        isUserTeamHome = homeTeamId === clubSofascoreId;
      } else {
        // Fallback a comparación por nombre
        isUserTeamHome = isMatchFromClub(userClub.shortName, eventData.homeTeam.name, '', clubSofascoreId, homeTeamId, null) ||
                         isMatchFromClub(userClub.name, eventData.homeTeam.name, '', clubSofascoreId, homeTeamId, null);
      }
    } else {
      // Fallback para compatibilidad con código existente (busca River)
      isUserTeamHome = eventData.homeTeam.name.includes('River');
    }
    
    userTeam = isUserTeamHome ? 'home' : 'away';
    rival = isUserTeamHome ? eventData.awayTeam.name : eventData.homeTeam.name;

    // Determinar resultado del partido para el equipo del usuario
    const userScore = isUserTeamHome ? matchInfo.homeScore : matchInfo.awayScore;
    const rivalScore = isUserTeamHome ? matchInfo.awayScore : matchInfo.homeScore;
    
    let result;
    if (userScore > rivalScore) {
      result = 'win';
    } else if (userScore < rivalScore) {
      result = 'loss';
    } else {
      result = 'draw';
    }
    
    // Agregar información del resultado al matchInfo
    matchInfo.userTeam = userTeam;
    matchInfo.result = result;
    matchInfo.userScore = userScore;
    matchInfo.rivalScore = rivalScore;
    matchInfo.rival = rival;

    // Procesar alineaciones del club del usuario
    const userLineup = lineupsData[userTeam];
    const players = [];

    // Sofascore incluye TODOS los jugadores en "players" (titulares + suplentes)
    // Necesitamos diferenciarlos usando la propiedad "substitute"
    if (userLineup.players) {
      userLineup.players.forEach(player => {
        const isSubstitute = player.substitute === true;
        
        const playerData = {
          id: player.player.id,
          name: player.player.name,
          position: player.position || 'N/A',
          shirtNumber: player.shirtNumber || '',
          starter: !isSubstitute,
          substitute: isSubstitute,
          goals: 0,
          assists: 0,
          minutesPlayed: isSubstitute ? 0 : totalMatchMinutes, // Titulares juegan tiempo total con adición
          yellowCard: false,
          redCard: false,
          played: !isSubstitute, // Titulares siempre jugaron, suplentes por defecto no
          sofascoreRating: player.statistics?.rating || null // Valoración de Sofascore (1-10)
        };
        players.push(playerData);
      });
    }

    // Ordenar incidentes por tiempo para procesar las sustituciones en orden correcto
    const sortedIncidents = [...incidentsData].sort((a, b) => (a.time || 0) - (b.time || 0));
    
    // Procesar incidentes (goles, asistencias, tarjetas, sustituciones)
    sortedIncidents.forEach(incident => {
      const isUserTeamIncident = incident.isHome === isUserTeamHome;
      if (!isUserTeamIncident) return;

      const playerId = incident.player?.id;
      const player = players.find(p => p.id === playerId);

      if (player) {
        switch (incident.incidentType) {
          case 'goal':
            player.goals += 1;
            break;
          case 'card':
            if (incident.incidentClass === 'yellow') {
              player.yellowCard = true;
            } else if (incident.incidentClass === 'red') {
              player.redCard = true;
            }
            break;
        }
      }

      // Procesar asistencias
      if (incident.incidentType === 'goal' && incident.assist1) {
        const assistPlayer = players.find(p => p.id === incident.assist1.id);
        if (assistPlayer) {
          assistPlayer.assists += 1;
        }
      }

      // Procesar sustituciones para calcular minutos jugados
      if (incident.incidentType === 'substitution') {
        const minute = incident.time || 0;
        
        // Jugador que sale
        if (incident.playerOut) {
          const playerOut = players.find(p => p.id === incident.playerOut.id);
          if (playerOut) {
            // Si tiene lastEntryMinute válido, significa que volvió a salir después de entrar
            if (typeof playerOut.lastEntryMinute === 'number') {
              playerOut.minutesPlayed += (minute - playerOut.lastEntryMinute);
              delete playerOut.lastEntryMinute;
            } else if (playerOut.starter) {
              // Es titular saliendo por primera vez
              playerOut.minutesPlayed = minute;
            }
          }
        }
        
        // Jugador que entra
        if (incident.playerIn) {
          const playerIn = players.find(p => p.id === incident.playerIn.id);
          if (playerIn) {
            playerIn.lastEntryMinute = minute;
            playerIn.played = true;
          }
        }
      }
    });
    
    // Al final, calcular minutos para jugadores que siguieron en cancha
    players.forEach(player => {
      if (typeof player.lastEntryMinute === 'number') {
        player.minutesPlayed += (totalMatchMinutes - player.lastEntryMinute);
      }
      delete player.lastEntryMinute;
    });

    return {
      matchInfo: {
        ...matchInfo,
        rival
      },
      players
    };

  } catch (error) {
    console.error('Error fetching match data:', error);
    
    // Si es error de validación del club, lanzar ese mensaje específico
    if (error.message && error.message.includes('no es de')) {
      throw error;
    }
    
    throw new Error('URL de partido inválida o no se pudo obtener los datos. Verifica que la URL sea correcta.');
  }
};

/**
 * Obtiene el último partido del club desde su página de equipo
 * @param {number} teamId - ID del equipo en Sofascore
 * @returns {string|null} URL del último partido o null si no encuentra
 */
export const getLastMatchUrl = async (teamId) => {
  try {
    // Obtener los últimos eventos del equipo
    const eventsUrl = `https://api.sofascore.com/api/v1/team/${teamId}/events/last/0`;
    const response = await fetchFromSofascore(eventsUrl);
    
    const now = Math.floor(Date.now() / 1000); // Timestamp actual en segundos
    
    if (response.data && response.data.events && response.data.events.length > 0) {
      // Buscar el partido terminado más reciente (mayor timestamp que ya ocurrió)
      const finishedMatches = response.data.events.filter(
        event => event.status?.type === 'finished' && event.startTimestamp < now
      );
      
      // Ordenar por timestamp descendente (más reciente primero)
      finishedMatches.sort((a, b) => b.startTimestamp - a.startTimestamp);
      
      const finishedMatch = finishedMatches[0];
      
      if (finishedMatch) {
        // Construir la URL del partido en el formato que espera extractMatchId
        const slug = finishedMatch.slug || '';
        const matchId = finishedMatch.id;
        return `https://www.sofascore.com/football/match/${slug}#id:${matchId}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error obteniendo último partido:', error);
    return null;
  }
};
