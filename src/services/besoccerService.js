import axios from 'axios';

/**
 * Servicio para extraer información de partidos desde BeSoccer
 */

// Detectar entorno
const isDevelopment = import.meta.env.MODE === 'development';
const PROXY_URL = '/api/sofascore'; // Reutilizamos el mismo endpoint serverless

/**
 * Hacer petición con proxy (siempre, ya que BeSoccer tiene CORS)
 */
const fetchHTML = async (url) => {
  const response = await axios.get(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
  return response.data;
};

/**
 * Parsear HTML de BeSoccer para extraer información
 */
const parseHTML = (html) => {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
};

/**
 * Obtener URL del último partido terminado del equipo
 * @param {string} teamSlug - Slug del equipo en BeSoccer (ej: 'ca-river-plate')
 */
export const getLastMatchUrl = async (teamSlug) => {
  try {
    const url = `https://es.besoccer.com/equipo/partidos/${teamSlug}`;
    const response = await axios.get(`${PROXY_URL}?url=${encodeURIComponent(url)}&action=findLastMatch`);
    
    if (response.data.matches && response.data.matches.length > 0) {
      const lastMatch = response.data.matches[0];
      console.log('Partido finalizado encontrado:', lastMatch);
      return lastMatch.url;
    }
    
    throw new Error('No se encontró ningún partido finalizado');
  } catch (error) {
    console.error('Error obteniendo último partido:', error);
    throw error;
  }
};

/**
 * Extraer datos del partido desde BeSoccer
 * @param {string} matchUrl - URL del partido
 * @param {Object} userClub - Club del usuario
 */
export const fetchMatchData = async (matchUrl, userClub) => {
  try {
    // Asegurar que la URL apunta a la página de alineaciones
    let alineacionesUrl = matchUrl;
    if (!matchUrl.includes('/alineaciones')) {
      alineacionesUrl = matchUrl.replace(/\/$/, '') + '/alineaciones';
    }
    
    const html = await fetchHTML(alineacionesUrl);
    const doc = parseHTML(html);
    
    // Extraer nombres de equipos
    const teamNames = doc.querySelectorAll('.team-name, .name-team');
    const homeTeam = teamNames[0]?.textContent?.trim() || '';
    const awayTeam = teamNames[1]?.textContent?.trim() || '';
    
    // Extraer resultado
    const scoreElements = doc.querySelectorAll('.score, .result-score');
    const homeScore = parseInt(scoreElements[0]?.textContent?.trim() || '0');
    const awayScore = parseInt(scoreElements[1]?.textContent?.trim() || '0');
    
    // Determinar si el usuario es local o visitante
    const isHome = homeTeam.toLowerCase().includes(userClub.name.toLowerCase()) ||
                   homeTeam.toLowerCase().includes(userClub.shortName.toLowerCase());
    
    const userTeamName = isHome ? homeTeam : awayTeam;
    const opponentName = isHome ? awayTeam : homeTeam;
    const userScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;
    
    // Extraer jugadores de la alineación del equipo del usuario
    const lineupContainer = isHome 
      ? doc.querySelector('.team-home, .local-lineup')
      : doc.querySelector('.team-away, .visitor-lineup');
    
    const playerElements = lineupContainer?.querySelectorAll('.player, .player-name') || [];
    
    const players = Array.from(playerElements).map((el, index) => {
      const name = el.textContent?.trim() || `Jugador ${index + 1}`;
      const number = el.querySelector('.number')?.textContent?.trim() || (index + 1).toString();
      
      // Detectar si fue titular o suplente
      const isStarter = !el.closest('.substitutes, .bench');
      
      return {
        id: `player-${index}`,
        name: name,
        number: number,
        position: '', // BeSoccer no siempre muestra posición clara
        yellowCard: false,
        redCard: false,
        played: isStarter,
        wasSubstituted: false
      };
    });
    
    return {
      matchInfo: {
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        homeScore: homeScore,
        awayScore: awayScore,
        date: new Date().toISOString().split('T')[0], // BeSoccer requiere más parsing para fecha exacta
        competition: 'Liga Profesional',
        matchUrl: matchUrl
      },
      players: players,
      userTeam: {
        name: userTeamName,
        score: userScore,
        isHome: isHome
      },
      opponent: {
        name: opponentName,
        score: opponentScore
      }
    };
  } catch (error) {
    console.error('Error extrayendo datos del partido:', error);
    throw new Error('Error al obtener datos del partido desde BeSoccer');
  }
};

/**
 * Extraer ID del partido desde la URL de BeSoccer
 */
export const extractMatchId = (url) => {
  const match = url.match(/\/partido\/[^/]+\/[^/]+\/(\d+)/);
  return match ? match[1] : null;
};
