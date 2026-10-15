import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Nombre de la colección en Firestore
const RATINGS_COLLECTION = 'ratings';

/**
 * ¿El jugador tiene una nota válida? (0 es una nota válida; null, '' y 'N/A' no)
 */
export const hasValidRating = (rating) =>
  rating !== null && rating !== undefined && rating !== '' && rating !== 'N/A' && !isNaN(parseFloat(rating));

// Caché en memoria de las valoraciones de cada usuario.
// Evita releer toda la colección en cada pantalla (Dashboard la pedía 3 veces,
// y verificar si un partido ya fue valorado también la leía completa).
const RATINGS_CACHE_TTL = 2 * 60 * 1000;
const ratingsCache = new Map(); // userId -> { promise, time }

const fetchUserRatings = (userId, force = false) => {
  const cached = ratingsCache.get(userId);
  if (!force && cached && Date.now() - cached.time < RATINGS_CACHE_TTL) {
    return cached.promise;
  }

  const q = query(
    collection(db, RATINGS_COLLECTION),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc')
  );
  const promise = getDocs(q).then(snapshot =>
    snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
  );
  ratingsCache.set(userId, { promise, time: Date.now() });
  // No cachear errores
  promise.catch(() => ratingsCache.delete(userId));
  return promise;
};

export const invalidateRatingsCache = (userId) => {
  if (userId) ratingsCache.delete(userId);
  else ratingsCache.clear();
};

/**
 * Precargar las valoraciones del usuario (no bloqueante)
 */
export const prefetchUserRatings = (userId) => {
  if (!userId) return;
  fetchUserRatings(userId).catch(() => {});
};

/**
 * Guardar una valoración en Firestore
 * @param {Object} rating - Objeto con la valoración del partido
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - ID del club (opcional, para compatibilidad)
 */
export const saveRatingToCloud = async (rating, userId, clubId = null) => {
  try {
    const ratingWithUser = {
      ...rating,
      userId,
      clubId: clubId || rating.clubId || null, // Prioridad: parámetro > rating.clubId > null
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, RATINGS_COLLECTION), ratingWithUser);
    invalidateRatingsCache(userId);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error al guardar en Firestore:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener todas las valoraciones del usuario
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - (Opcional) ID del club para filtrar
 * @param {string} primaryClubId - (Opcional) ID del club principal para compatibilidad con datos antiguos
 * @param {Object} options - { force: true } para ignorar la caché
 */
export const getAllRatingsFromCloud = async (userId, clubId = null, primaryClubId = null, options = {}) => {
  try {
    // Copia para que quien llame pueda ordenar sin alterar la caché
    let ratings = [...await fetchUserRatings(userId, options.force)];

    // Si se especifica clubId, filtrar en cliente
    if (clubId) {
      ratings = ratings.filter(rating => {
        // Si la valoración tiene clubId, debe coincidir exactamente
        if (rating.clubId) {
          return rating.clubId === clubId;
        }
        // Si la valoración NO tiene clubId (datos antiguos), solo mostrarla en el club principal
        return clubId === primaryClubId;
      });
    }

    return { success: true, data: ratings };
  } catch (error) {
    console.error('Error al obtener valoraciones:', error);
    
    // Si el error es por índice faltante, dar instrucciones claras
    if (error.message.includes('index')) {
      console.error('SOLUCIÓN: Abrí el link que aparece en el error de consola para crear el índice automáticamente en Firebase');
    }
    
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Verificar si un partido ya fue valorado
 * @param {string} userId - ID del usuario autenticado
 * @param {string} matchId - ID del partido en Sofascore
 */
export const checkMatchAlreadyRated = async (userId, matchId) => {
  try {
    // Si Firestore no responde en 8s, seguir sin bloquear la carga del partido
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout verificando valoraciones')), 8000)
    );
    const ratingsResult = await Promise.race([getAllRatingsFromCloud(userId), timeout]);
    
    if (ratingsResult.success) {
      // Buscar si existe una valoración con este matchInfo que contenga el matchId
      const existingRating = ratingsResult.data.find(rating => {
        // El matchId puede estar en diferentes formatos en la URL guardada
        if (rating.matchId && String(rating.matchId) === String(matchId)) return true;
        const savedMatchUrl = rating.matchInfo?.matchUrl || '';
        return savedMatchUrl.includes(`id:${matchId}`) || savedMatchUrl.includes(`id-${matchId}`);
      });
      
      return {
        isRated: !!existingRating,
        ratingId: existingRating?.id || null
      };
    }
    
    return { isRated: false, ratingId: null };
  } catch (error) {
    console.error('Error al verificar partido:', error);
    // Descartar una consulta colgada para que el próximo intento la rehaga
    invalidateRatingsCache(userId);
    return { isRated: false, ratingId: null };
  }
};

/**
 * Obtener una valoración específica por ID
 * @param {string} ratingId - ID de la valoración
 * @param {string} userId - ID del usuario autenticado
 */
export const getRatingByIdFromCloud = async (ratingId, userId) => {
  try {
    const docRef = doc(db, RATINGS_COLLECTION, ratingId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Verificar que la valoración pertenece al usuario
      if (data.userId === userId) {
        return { success: true, data: { id: docSnap.id, ...data } };
      } else {
        return { success: false, error: 'No autorizado' };
      }
    } else {
      return { success: false, error: 'Valoración no encontrada' };
    }
  } catch (error) {
    console.error('Error al obtener valoración:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Actualizar una valoración existente
 * @param {string} ratingId - ID de la valoración
 * @param {Object} updatedData - Datos actualizados
 * @param {string} userId - ID del usuario autenticado
 */
export const updateRatingInCloud = async (ratingId, updatedData, userId) => {
  try {
    const docRef = doc(db, RATINGS_COLLECTION, ratingId);
    
    // Verificar que existe y pertenece al usuario
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      return { success: false, error: 'No autorizado' };
    }

    await updateDoc(docRef, {
      ...updatedData,
      updatedAt: serverTimestamp()
    });
    invalidateRatingsCache(userId);

    return { success: true };
  } catch (error) {
    console.error('Error al actualizar valoración:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Eliminar una valoración
 * @param {string} ratingId - ID de la valoración
 * @param {string} userId - ID del usuario autenticado
 */
export const deleteRatingFromCloud = async (ratingId, userId) => {
  try {
    const docRef = doc(db, RATINGS_COLLECTION, ratingId);
    
    // Verificar que existe y pertenece al usuario
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      return { success: false, error: 'No autorizado' };
    }

    await deleteDoc(docRef);
    invalidateRatingsCache(userId);
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar valoración:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Eliminar todas las valoraciones de un usuario
 * @param {string} userId - ID del usuario autenticado
 */
export const deleteAllUserRatings = async (userId) => {
  try {
    const ratingsResult = await getAllRatingsFromCloud(userId, null, null, { force: true });
    if (!ratingsResult.success) {
      return { success: false, error: ratingsResult.error };
    }

    const ratings = ratingsResult.data;
    const deletePromises = ratings.map(rating => 
      deleteDoc(doc(db, RATINGS_COLLECTION, rating.id))
    );

    await Promise.all(deletePromises);
    invalidateRatingsCache(userId);
    return { success: true, deletedCount: ratings.length };
  } catch (error) {
    console.error('Error al eliminar todas las valoraciones:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener estadísticas de un jugador específico
 * @param {string} playerId - ID del jugador
 * @param {string} userId - ID del usuario autenticado
 */
export const getPlayerStatsFromCloud = async (playerId, userId) => {
  try {
    const ratingsResult = await getAllRatingsFromCloud(userId);
    if (!ratingsResult.success) {
      return { success: false, error: ratingsResult.error };
    }

    const ratings = ratingsResult.data;
    const playerRatings = [];

    ratings.forEach(rating => {
      const player = rating.players.find(p => p.id === playerId);
      if (player && hasValidRating(player.rating)) {
        playerRatings.push({
          rating: parseFloat(player.rating),
          date: rating.matchInfo.date,
          rival: rating.matchInfo.rival,
          competition: rating.matchInfo.competition
        });
      }
    });

    if (playerRatings.length === 0) {
      return { success: true, data: null };
    }

    const totalRating = playerRatings.reduce((sum, p) => sum + p.rating, 0);
    const avgRating = totalRating / playerRatings.length;

    return {
      success: true,
      data: {
        appearances: playerRatings.length,
        averageRating: avgRating,
        ratings: playerRatings
      }
    };
  } catch (error) {
    console.error('Error al obtener estadísticas del jugador:', error);
    return { success: false, error: error.message };
  }
};

// Fecha del partido en ms (matchInfo.date viene como "dd/mm/aaaa"); si falta, la fecha en que se valoró
const getMatchTime = (rating) => {
  const parts = rating.matchInfo?.date?.split('/');
  if (parts?.length === 3) {
    const [day, month, year] = parts.map(Number);
    const time = new Date(year, month - 1, day).getTime();
    if (!isNaN(time)) return time;
  }
  return new Date(rating.timestamp).getTime() || 0;
};

/**
 * Obtener estadísticas de todos los jugadores
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - (Opcional) ID del club para filtrar
 * @param {string} primaryClubId - (Opcional) ID del club principal para compatibilidad
 */
export const getAllPlayersStatsFromCloud = async (userId, clubId = null, primaryClubId = null) => {
  try {
    const ratingsResult = await getAllRatingsFromCloud(userId, clubId, primaryClubId);
    if (!ratingsResult.success) {
      return { success: false, error: ratingsResult.error };
    }

    // Del partido más reciente al más antiguo
    const ratings = ratingsResult.data.sort((a, b) => getMatchTime(b) - getMatchTime(a));
    const playersMap = new Map();

    ratings.forEach(rating => {
      rating.players.forEach(player => {
        if (hasValidRating(player.rating)) {
          const key = `${player.id}`;
          
          if (!playersMap.has(key)) {
            playersMap.set(key, {
              id: player.id,
              name: player.name,
              position: player.position,
              totalRating: 0,
              appearances: 0,
              totalGoals: 0,
              totalAssists: 0,
              totalMinutes: 0,
              ratings: [],
              lastRatings: []
            });
          }

          const playerStats = playersMap.get(key);
          const ratingValue = parseFloat(player.rating);
          playerStats.totalRating += ratingValue;
          playerStats.appearances += 1;
          playerStats.totalGoals += player.goals || 0;
          playerStats.totalAssists += player.assists || 0;
          playerStats.totalMinutes += player.minutesPlayed || 0;
          playerStats.ratings.push(ratingValue);
          playerStats.lastRatings.push({
            rating: ratingValue,
            rival: rating.matchInfo.rival,
            date: rating.matchInfo.date
          });
        }
      });
    });

    const playersArray = Array.from(playersMap.values()).map(player => ({
      ...player,
      averageRating: player.totalRating / player.appearances,
      lastRatings: player.lastRatings.slice(0, 10) // Últimos 10 partidos (más reciente primero)
    }));

    return { success: true, data: playersArray };
  } catch (error) {
    console.error('Error al obtener estadísticas de jugadores:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Obtener estadísticas generales
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - (Opcional) ID del club para filtrar
 * @param {string} primaryClubId - (Opcional) ID del club principal para compatibilidad
 */
export const getGeneralStatsFromCloud = async (userId, clubId = null, primaryClubId = null) => {
  try {
    const ratingsResult = await getAllRatingsFromCloud(userId, clubId, primaryClubId);
    if (!ratingsResult.success) {
      return { success: false, error: ratingsResult.error };
    }

    const ratings = ratingsResult.data;

    if (ratings.length === 0) {
      return {
        success: true,
        data: {
          totalMatches: 0,
          totalPlayers: 0,
          averageTeamRating: 0,
          totalGoals: 0,
          totalAssists: 0,
          recentMatches: []
        }
      };
    }

    let totalRating = 0;
    let totalRatingsCount = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    const uniquePlayers = new Set();

    ratings.forEach(rating => {
      rating.players.forEach(player => {
        if (hasValidRating(player.rating)) {
          totalRating += parseFloat(player.rating);
          totalRatingsCount += 1;
          totalGoals += player.goals || 0;
          totalAssists += player.assists || 0;
          uniquePlayers.add(player.id);
        }
      });
    });

    // Obtener los últimos 5 partidos
    const recentMatches = ratings
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map(rating => ({
        id: rating.id,
        date: rating.matchInfo.date,
        rival: rating.matchInfo.rival,
        score: rating.matchInfo.score,
        competition: rating.matchInfo.competition
      }));

    return {
      success: true,
      data: {
        totalMatches: ratings.length,
        totalPlayers: uniquePlayers.size,
        averageTeamRating: totalRatingsCount > 0 ? totalRating / totalRatingsCount : 0,
        totalGoals,
        totalAssists,
        recentMatches
      }
    };
  } catch (error) {
    console.error('Error al obtener estadísticas generales:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener todas las valoraciones de un usuario específico
 * @param {string} userId - ID del usuario
 */
export const getRatingsByUserId = async (userId) => {
  try {
    const q = query(
      collection(db, RATINGS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const ratings = [];

    querySnapshot.forEach((doc) => {
      ratings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return ratings;
  } catch (error) {
    console.error('Error al obtener valoraciones del usuario:', error);
    throw error;
  }
};
