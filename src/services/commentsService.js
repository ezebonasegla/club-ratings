import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Agregar un comentario a una valoración
 * @param {string} ratingId - ID de la valoración
 * @param {string} userId - ID del usuario que comenta
 * @param {string} comment - Texto del comentario
 */
export const addComment = async (ratingId, userId, comment) => {
  try {
    const commentData = {
      ratingId,
      userId,
      comment: comment.trim(),
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'comments'), commentData);

    return { success: true, commentId: docRef.id };
  } catch (error) {
    console.error('Error al agregar comentario:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener comentarios de una valoración
 * @param {string} ratingId - ID de la valoración
 */
export const getComments = async (ratingId) => {
  try {
    const q = query(
      collection(db, 'comments'),
      where('ratingId', '==', ratingId),
      orderBy('createdAt', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const comments = [];

    for (const docSnap of querySnapshot.docs) {
      const commentData = docSnap.data();
      
      // Obtener info del usuario que comentó
      const userDoc = await getDoc(doc(db, 'users', commentData.userId));
      
      comments.push({
        id: docSnap.id,
        ...commentData,
        userInfo: userDoc.exists() ? {
          displayName: userDoc.data().displayName,
          photoURL: userDoc.data().photoURL,
          friendId: userDoc.data().friendId
        } : null
      });
    }

    return { success: true, comments };
  } catch (error) {
    console.error('Error al obtener comentarios:', error);
    return { success: false, error: error.message, comments: [] };
  }
};

/**
 * Eliminar un comentario
 * @param {string} commentId - ID del comentario
 * @param {string} userId - ID del usuario (para verificar permisos)
 */
export const deleteComment = async (commentId, userId) => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    const commentSnap = await getDoc(commentRef);

    if (!commentSnap.exists()) {
      return { success: false, error: 'Comentario no encontrado' };
    }

    // Verificar que el usuario sea el dueño del comentario
    if (commentSnap.data().userId !== userId) {
      return { success: false, error: 'No tienes permiso para eliminar este comentario' };
    }

    await deleteDoc(commentRef);
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar comentario:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Agregar o quitar una reacción a una valoración
 * @param {string} ratingId - ID de la valoración
 * @param {string} userId - ID del usuario que reacciona
 * @param {string} reactionType - Tipo de reacción ('like', 'fire', 'star', 'clap')
 */
export const toggleReaction = async (ratingId, userId, reactionType) => {
  try {
    const ratingRef = doc(db, 'ratings', ratingId);
    const ratingSnap = await getDoc(ratingRef);

    if (!ratingSnap.exists()) {
      return { success: false, error: 'Valoración no encontrada' };
    }

    const ratingData = ratingSnap.data();
    const reactions = ratingData.reactions || { like: [], fire: [], star: [], clap: [] };
    
    // Verificar si el usuario ya reaccionó con este tipo
    const userReacted = reactions[reactionType]?.includes(userId);
    
    if (userReacted) {
      // Quitar la reacción
      reactions[reactionType] = reactions[reactionType].filter(id => id !== userId);
      await updateDoc(ratingRef, { reactions });
      return { success: true, action: 'removed', added: false };
    } else {
      // Quitar reacción anterior de otros tipos si existe
      Object.keys(reactions).forEach(type => {
        if (type !== reactionType && reactions[type]) {
          reactions[type] = reactions[type].filter(id => id !== userId);
        }
      });
      
      // Agregar nueva reacción
      if (!reactions[reactionType]) {
        reactions[reactionType] = [];
      }
      reactions[reactionType].push(userId);
      
      await updateDoc(ratingRef, { reactions });
      return { success: true, action: 'added', added: true };
    }
  } catch (error) {
    console.error('Error al gestionar reacción:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener reacciones de una valoración
 * @param {string} ratingId - ID de la valoración
 */
export const getReactions = async (ratingId) => {
  try {
    const q = query(
      collection(db, 'reactions'),
      where('ratingId', '==', ratingId)
    );

    const querySnapshot = await getDocs(q);
    const reactions = {
      like: [],
      fire: [],
      star: [],
      clap: []
    };

    for (const docSnap of querySnapshot.docs) {
      const reactionData = docSnap.data();
      const userDoc = await getDoc(doc(db, 'users', reactionData.userId));
      
      const userInfo = userDoc.exists() ? {
        id: reactionData.userId,
        displayName: userDoc.data().displayName,
        friendId: userDoc.data().friendId
      } : null;

      if (reactions[reactionData.type]) {
        reactions[reactionData.type].push(userInfo);
      }
    }

    return { success: true, reactions };
  } catch (error) {
    console.error('Error al obtener reacciones:', error);
    return { success: false, error: error.message, reactions: {} };
  }
};

/**
 * Obtener la reacción de un usuario específico en una valoración
 * @param {string} ratingId - ID de la valoración
 * @param {string} userId - ID del usuario
 */
export const getUserReaction = async (ratingId, userId) => {
  try {
    const q = query(
      collection(db, 'reactions'),
      where('ratingId', '==', ratingId),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: true, reaction: null };
    }

    const reactionData = querySnapshot.docs[0].data();
    return { success: true, reaction: reactionData.type };
  } catch (error) {
    console.error('Error al obtener reacción del usuario:', error);
    return { success: false, error: error.message, reaction: null };
  }
};

/**
 * Contar comentarios de una valoración
 * @param {string} ratingId - ID de la valoración
 */
export const countComments = async (ratingId) => {
  try {
    const q = query(
      collection(db, 'comments'),
      where('ratingId', '==', ratingId)
    );

    const querySnapshot = await getDocs(q);
    return { success: true, count: querySnapshot.size };
  } catch (error) {
    console.error('Error al contar comentarios:', error);
    return { success: false, error: error.message, count: 0 };
  }
};
