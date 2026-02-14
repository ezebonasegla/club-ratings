import axios from 'axios';

/**
 * Servicio para extraer información de partidos desde Sofascore
 * Usa Vercel Serverless Function como proxy para evitar CORS y 403
 */

// Proxy URL - En producción usa /api/sofascore, en desarrollo localhost
const PROXY_URL = import.meta.env.DEV 
  ? 'http://localhost:5173/api/sofascore'
  : '/api/sofascore';

/**
 * Función helper para hacer peticiones a través del proxy
 */
const fetchThroughProxy = async (url) => {
  const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
  const response = await axios.get(proxyUrl);
  return response;
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
 */
export const isMatchFromClub = (clubName, homeTeam, awayTeam) => {
  const normalizedClubName = clubName.toLowerCase();
  const normalizedHome = homeTeam.toLowerCase();
  const normalizedAway = awayTeam.toLowerCase();
  
  return normalizedHome.includes(normalizedClubName) || 
         normalizedAway.includes(normalizedClubName);
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

    // Hacer peticiones en paralelo a través del proxy
    const [eventResponse, lineupsResponse, incidentsResponse] = await Promise.all([
      fetchThroughProxy(eventUrl),
      fetchThroughProxy(lineupsUrl),
      fetchThroughProxy(incidentsUrl)
    ]);

    const eventData = eventResponse.data.event;
    const lineupsData = lineupsResponse.data;
    const incidentsData = incidentsResponse.data.incidents;

    // Procesar datos del partido
    const matchInfo = {
      date: new Date(eventData.startTimestamp * 1000).toLocaleDateString('es-AR'),
      homeTeam: eventData.homeTeam.name,
      awayTeam: eventData.awayTeam.name,
      competition: eventData.tournament.name,
      round: eventData.roundInfo?.round || '',
      score: `${eventData.homeScore?.display || 0} - ${eventData.awayScore?.display || 0}`
    };

    // Si se proporcionó un club de usuario, verificar que el partido sea de ese club
    if (userClub) {
      const isFromUserClub = isMatchFromClub(userClub.shortName, eventData.homeTeam.name, eventData.awayTeam.name) ||
                             isMatchFromClub(userClub.name, eventData.homeTeam.name, eventData.awayTeam.name);
      
      if (!isFromUserClub) {
        throw new Error(`Este partido no es de ${userClub.name}. Por favor, ingresa un partido de tu club.`);
      }
    }

    // Determinar si el club del usuario jugó como local o visitante
    let isUserTeamHome, userTeam, rival;
    
    if (userClub) {
      isUserTeamHome = isMatchFromClub(userClub.shortName, eventData.homeTeam.name, '') ||
                       isMatchFromClub(userClub.name, eventData.homeTeam.name, '');
    } else {
      // Fallback para compatibilidad con código existente (busca River)
      isUserTeamHome = eventData.homeTeam.name.includes('River');
    }
    
    userTeam = isUserTeamHome ? 'home' : 'away';
    rival = isUserTeamHome ? eventData.awayTeam.name : eventData.homeTeam.name;

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
          minutesPlayed: isSubstitute ? 0 : 90, // Suplentes empiezan con 0
          yellowCard: false,
          redCard: false,
          played: !isSubstitute // Titulares siempre jugaron, suplentes por defecto no
        };
        players.push(playerData);
      });
    }

    // Procesar incidentes (goles, asistencias, tarjetas, sustituciones)
    incidentsData.forEach(incident => {
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
            playerOut.minutesPlayed = minute;
          }
        }
        
        // Jugador que entra
        if (incident.playerIn) {
          const playerIn = players.find(p => p.id === incident.playerIn.id);
          if (playerIn) {
            playerIn.minutesPlayed = 90 - minute;
            playerIn.played = true; // Marca que entró al partido
          }
        }
      }
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
    const response = await fetchThroughProxy(eventsUrl);
    
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
