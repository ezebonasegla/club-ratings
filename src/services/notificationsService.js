import { db } from '../config/firebase';
import { 
  collection, 
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Crear una notificación
 * @param {string} userId - ID del usuario que recibirá la notificación
 * @param {string} type - Tipo de notificación ('comment', 'reaction', 'friend_request', 'friend_accepted')
 * @param {Object} data - Datos adicionales de la notificación
 */
export const createNotification = async (userId, type, data) => {
  try {
    const notification = {
      userId,
      type,
      ...data,
      read: false,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'notifications'), notification);
    return { success: true };
  } catch (error) {
    console.error('Error al crear notificación:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener notificaciones de un usuario
 * @param {string} userId - ID del usuario
 * @param {number} limitCount - Límite de notificaciones a obtener (opcional)
 */
export const getNotifications = async (userId, limitCount = 50) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const notifications = [];

    querySnapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return { success: true, notifications };
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    return { success: false, error: error.message, notifications: [] };
  }
};

/**
 * Contar notificaciones no leídas
 * @param {string} userId - ID del usuario
 */
export const getUnreadCount = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    return { success: true, count: querySnapshot.size };
  } catch (error) {
    console.error('Error al contar notificaciones:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

/**
 * Marcar una notificación como leída
 * @param {string} notificationId - ID de la notificación
 */
export const markAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error al marcar como leída:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Marcar todas las notificaciones como leídas
 * @param {string} userId - ID del usuario
 */
export const markAllAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    const updatePromises = [];

    querySnapshot.forEach((docSnap) => {
      updatePromises.push(
        updateDoc(doc(db, 'notifications', docSnap.id), {
          read: true,
          readAt: serverTimestamp()
        })
      );
    });

    await Promise.all(updatePromises);
    return { success: true };
  } catch (error) {
    console.error('Error al marcar todas como leídas:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Eliminar una notificación
 * @param {string} notificationId - ID de la notificación
 */
export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Eliminar todas las notificaciones de un usuario
 * @param {string} userId - ID del usuario
 */
export const deleteAllNotifications = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const deletePromises = [];

    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, 'notifications', docSnap.id)));
    });

    await Promise.all(deletePromises);
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar todas las notificaciones:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Crear notificación cuando alguien comenta en tu valoración
 * @param {string} ratingOwnerId - ID del dueño de la valoración
 * @param {string} commenterId - ID del usuario que comentó
 * @param {string} commenterName - Nombre del usuario que comentó
 * @param {string} ratingId - ID de la valoración
 * @param {string} matchInfo - Información del partido (ej: "vs Boca")
 * @param {string} clubId - ID del club del partido
 */
export const notifyNewComment = async (ratingOwnerId, commenterId, commenterName, ratingId, matchInfo, clubId) => {
  // No notificar si el que comenta es el dueño
  if (ratingOwnerId === commenterId) {
    return { success: true };
  }

  return await createNotification(ratingOwnerId, 'comment', {
    commenterId,
    commenterName,
    ratingId,
    matchInfo,
    clubId,
    message: `${commenterName} comentó en tu valoración${matchInfo ? ' ' + matchInfo : ''}`
  });
};

/**
 * Crear notificación cuando alguien reacciona a tu valoración
 * @param {string} ratingOwnerId - ID del dueño de la valoración
 * @param {string} reactorId - ID del usuario que reaccionó
 * @param {string} reactorName - Nombre del usuario que reaccionó
 * @param {string} ratingId - ID de la valoración
 * @param {string} reactionType - Tipo de reacción
 * @param {string} matchInfo - Información del partido
 * @param {string} clubId - ID del club del partido
 */
export const notifyNewReaction = async (ratingOwnerId, reactorId, reactorName, ratingId, reactionType, matchInfo, clubId) => {
  // No notificar si el que reacciona es el dueño
  if (ratingOwnerId === reactorId) {
    return { success: true };
  }

  const reactionEmoji = {
    like: '👍',
    fire: '🔥',
    star: '⭐',
    clap: '👋'
  }[reactionType] || '';

  return await createNotification(ratingOwnerId, 'reaction', {
    reactorId,
    reactorName,
    ratingId,
    reactionType,
    matchInfo,
    clubId,
    message: `${reactorName} reaccionó ${reactionEmoji} a tu valoración${matchInfo ? ' ' + matchInfo : ''}`
  });
};

/**
 * Crear notificación cuando recibes una solicitud de amistad
 * @param {string} receiverId - ID del usuario que recibe la solicitud
 * @param {string} senderId - ID del usuario que envía la solicitud
 * @param {string} senderName - Nombre del usuario que envía
 * @param {string} requestId - ID de la solicitud
 */
export const notifyFriendRequest = async (receiverId, senderId, senderName, requestId) => {
  return await createNotification(receiverId, 'friend_request', {
    senderId,
    senderName,
    requestId,
    message: `${senderName} te envió una solicitud de amistad`
  });
};

/**
 * Crear notificación cuando aceptan tu solicitud de amistad
 * @param {string} senderId - ID del usuario que envió la solicitud original
 * @param {string} accepterId - ID del usuario que aceptó
 * @param {string} accepterName - Nombre del usuario que aceptó
 */
export const notifyFriendAccepted = async (senderId, accepterId, accepterName) => {
  return await createNotification(senderId, 'friend_accepted', {
    accepterId,
    accepterName,
    message: `${accepterName} aceptó tu solicitud de amistad`
  });
};
