/**
 * Servicio para manejar el almacenamiento local de valoraciones
 */

const STORAGE_KEY = 'river_player_ratings';

/**
 * Guarda una valoración de partido
 */
export const saveRating = (rating) => {
  try {
    const ratings = getAllRatings();
    const newRating = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...rating
    };
    ratings.push(newRating);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
    return newRating;
  } catch (error) {
    console.error('Error guardando valoración:', error);
    throw error;
  }
};

/**
 * Obtiene todas las valoraciones guardadas
 */
export const getAllRatings = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error obteniendo valoraciones:', error);
    return [];
  }
};

/**
 * Obtiene una valoración por ID
 */
export const getRatingById = (id) => {
  const ratings = getAllRatings();
  return ratings.find(r => r.id === id);
};

/**
 * Actualiza una valoración existente
 */
export const updateRating = (id, updatedRating) => {
  try {
    const ratings = getAllRatings();
    const index = ratings.findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error('Valoración no encontrada');
    }
    ratings[index] = {
      ...ratings[index],
      ...updatedRating,
      id, // Mantener el ID original
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
    return ratings[index];
  } catch (error) {
    console.error('Error actualizando valoración:', error);
    throw error;
  }
};

/**
 * Elimina una valoración
 */
export const deleteRating = (id) => {
  try {
    const ratings = getAllRatings();
    const filtered = ratings.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error eliminando valoración:', error);
    return false;
  }
};

/**
 * Obtiene estadísticas de un jugador específico usando su ID único
 * Esto evita confundir jugadores con nombres similares
 */
export const getPlayerStats = (playerId, playerName) => {
  const ratings = getAllRatings();
  const playerRatings = [];

  ratings.forEach(rating => {
    // Buscar por ID si está disponible, sino por nombre
    const player = rating.players.find(p => 
      playerId ? p.id === playerId : p.name === playerName
    );
    if (player && player.rating !== null && player.rating !== undefined) {
      playerRatings.push({
        rating: player.rating,
        date: rating.matchInfo.date,
        rival: rating.matchInfo.rival,
        goals: player.goals,
        assists: player.assists,
        minutesPlayed: player.minutesPlayed
      });
    }
  });

  if (playerRatings.length === 0) {
    return null;
  }

  const totalRating = playerRatings.reduce((sum, p) => sum + p.rating, 0);
  const avgRating = totalRating / playerRatings.length;

  return {
    name: playerName,
    appearances: playerRatings.length,
    averageRating: parseFloat(avgRating.toFixed(2)),
    ratings: playerRatings.sort((a, b) => new Date(b.date) - new Date(a.date))
  };
};

/**
 * Obtiene todos los jugadores únicos con sus estadísticas
 * Usa ID único para evitar confundir jugadores con nombres similares
 */
export const getAllPlayersStats = () => {
  const ratings = getAllRatings();
  const playersMap = new Map();

  ratings.forEach(rating => {
    rating.players.forEach(player => {
      if (player.rating !== null && player.rating !== undefined) {
        // Usar ID único como clave, con fallback al nombre
        const playerKey = player.id ? `${player.id}` : player.name;
        
        if (!playersMap.has(playerKey)) {
          playersMap.set(playerKey, {
            id: player.id,
            name: player.name,
            ratings: [],
            totalGoals: 0,
            totalAssists: 0,
            totalMinutes: 0
          });
        }

        const playerData = playersMap.get(playerKey);
        playerData.ratings.push({
          rating: player.rating,
          date: rating.matchInfo.date,
          rival: rating.matchInfo.rival
        });
        playerData.totalGoals += player.goals || 0;
        playerData.totalAssists += player.assists || 0;
        playerData.totalMinutes += player.minutesPlayed || 0;
      }
    });
  });

  const playersStats = Array.from(playersMap.values()).map(player => {
    const avgRating = player.ratings.reduce((sum, r) => sum + r.rating, 0) / player.ratings.length;
    return {
      id: player.id,
      name: player.name,
      appearances: player.ratings.length,
      averageRating: parseFloat(avgRating.toFixed(2)),
      totalGoals: player.totalGoals,
      totalAssists: player.totalAssists,
      totalMinutes: player.totalMinutes,
      lastRatings: player.ratings.slice(-5).reverse()
    };
  });

  return playersStats.sort((a, b) => b.averageRating - a.averageRating);
};

/**
 * Obtiene estadísticas generales
 */
export const getGeneralStats = () => {
  const ratings = getAllRatings();
  
  if (ratings.length === 0) {
    return {
      totalMatches: 0,
      totalPlayers: 0,
      averageTeamRating: 0,
      recentMatches: []
    };
  }

  const allPlayers = new Set();
  let totalTeamRating = 0;
  let ratedMatches = 0;

  ratings.forEach(rating => {
    rating.players.forEach(player => {
      allPlayers.add(player.name);
      if (player.rating !== null && player.rating !== undefined) {
        totalTeamRating += player.rating;
        ratedMatches++;
      }
    });
  });

  return {
    totalMatches: ratings.length,
    totalPlayers: allPlayers.size,
    averageTeamRating: ratedMatches > 0 ? parseFloat((totalTeamRating / ratedMatches).toFixed(2)) : 0,
    recentMatches: ratings.slice(-10).reverse().map(r => ({
      id: r.id,
      date: r.matchInfo.date,
      rival: r.matchInfo.rival,
      score: r.matchInfo.score,
      competition: r.matchInfo.competition
    }))
  };
};

/**
 * Exporta todas las valoraciones como JSON
 */
export const exportData = () => {
  const ratings = getAllRatings();
  const dataStr = JSON.stringify(ratings, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `river-ratings-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Importa valoraciones desde un archivo JSON
 */
export const importData = (jsonData) => {
  try {
    const data = JSON.parse(jsonData);
    if (!Array.isArray(data)) {
      throw new Error('Formato de datos inválido');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error importando datos:', error);
    throw error;
  }
};

/**
 * Limpia todas las valoraciones
 */
export const clearAllRatings = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error limpiando valoraciones:', error);
    return false;
  }
};
