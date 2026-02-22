import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  addDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

/**
 * Genera un friendId aleatorio de 5 caracteres (letras mayúsculas y números)
 */
const generateFriendId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let friendId = '';
  for (let i = 0; i < 5; i++) {
    friendId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return friendId;
};

/**
 * Verificar si un friendId está disponible
 * @param {string} friendId - ID a verificar
 */
export const isFriendIdAvailable = async (friendId) => {
  try {
    const q = query(collection(db, 'users'), where('friendId', '==', friendId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    console.error('Error al verificar friendId:', error);
    return false;
  }
};

/**
 * Generar y asignar un friendId único a un usuario
 * @param {string} userId - ID del usuario
 */
export const generateUniqueFriendId = async (userId) => {
  try {
    let friendId = generateFriendId();
    let attempts = 0;
    const maxAttempts = 10;

    // Intentar hasta encontrar un ID disponible
    while (!(await isFriendIdAvailable(friendId)) && attempts < maxAttempts) {
      friendId = generateFriendId();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('No se pudo generar un friendId único');
    }

    // Actualizar el usuario con el nuevo friendId
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, { friendId }, { merge: true });

    return { success: true, friendId };
  } catch (error) {
    console.error('Error al generar friendId:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Actualizar el friendId de un usuario
 * @param {string} userId - ID del usuario
 * @param {string} newFriendId - Nuevo friendId deseado
 */
export const updateFriendId = async (userId, newFriendId) => {
  try {
    // Validar formato (5 caracteres alfanuméricos mayúsculas)
    if (!/^[A-Z0-9]{5}$/.test(newFriendId)) {
      return { 
        success: false, 
        error: 'El ID debe tener 5 caracteres (letras mayúsculas y números)' 
      };
    }

    // Verificar disponibilidad
    const available = await isFriendIdAvailable(newFriendId);
    if (!available) {
      return { success: false, error: 'Este ID ya está en uso' };
    }

    // Actualizar
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, { friendId: newFriendId });

    return { success: true, friendId: newFriendId };
  } catch (error) {
    console.error('Error al actualizar friendId:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Buscar un usuario por friendId
 * @param {string} friendId - ID del amigo a buscar
 */
export const findUserByFriendId = async (friendId) => {
  try {
    const q = query(
      collection(db, 'users'), 
      where('friendId', '==', friendId.toUpperCase())
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    const userDoc = querySnapshot.docs[0];
    return {
      success: true,
      user: {
        id: userDoc.id,
        ...userDoc.data()
      }
    };
  } catch (error) {
    console.error('Error al buscar usuario:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Enviar solicitud de amistad
 * @param {string} senderId - ID del usuario que envía la solicitud
 * @param {string} receiverId - ID del usuario que recibe la solicitud
 */
export const sendFriendRequest = async (senderId, receiverId) => {
  try {
    // Verificar que no se envíe a sí mismo
    if (senderId === receiverId) {
      return { success: false, error: 'No puedes enviarte una solicitud a ti mismo' };
    }

    // Verificar si ya son amigos
    const friendshipCheck = await checkFriendship(senderId, receiverId);
    if (friendshipCheck.areFriends) {
      return { success: false, error: 'Ya son amigos' };
    }

    // Verificar si ya hay una solicitud pendiente
    const q = query(
      collection(db, 'friendRequests'),
      where('senderId', '==', senderId),
      where('receiverId', '==', receiverId),
      where('status', '==', 'pending')
    );
    const existingRequest = await getDocs(q);

    if (!existingRequest.empty) {
      return { success: false, error: 'Ya enviaste una solicitud a este usuario' };
    }

    // Crear la solicitud
    await addDoc(collection(db, 'friendRequests'), {
      senderId,
      receiverId,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error al enviar solicitud:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener solicitudes de amistad pendientes
 * @param {string} userId - ID del usuario
 */
export const getPendingFriendRequests = async (userId) => {
  try {
    const q = query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', userId),
      where('status', '==', 'pending')
    );
    const querySnapshot = await getDocs(q);

    const requests = [];
    for (const docSnap of querySnapshot.docs) {
      const requestData = docSnap.data();
      
      // Obtener info del remitente
      const senderDoc = await getDoc(doc(db, 'users', requestData.senderId));
      
      requests.push({
        id: docSnap.id,
        ...requestData,
        senderInfo: senderDoc.exists() ? senderDoc.data() : null
      });
    }

    return { success: true, requests };
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    return { success: false, error: error.message, requests: [] };
  }
};

/**
 * Aceptar solicitud de amistad
 * @param {string} requestId - ID de la solicitud
 * @param {string} userId - ID del usuario que acepta
 */
export const acceptFriendRequest = async (requestId, userId) => {
  try {
    const requestRef = doc(db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return { success: false, error: 'Solicitud no encontrada' };
    }

    const requestData = requestSnap.data();

    // Agregar a las listas de amigos de ambos usuarios
    const user1Ref = doc(db, 'users', requestData.senderId);
    const user2Ref = doc(db, 'users', userId);

    // Obtener los documentos actuales para verificar el estado del campo friends
    const [user1Snap, user2Snap] = await Promise.all([
      getDoc(user1Ref),
      getDoc(user2Ref)
    ]);

    // Actualizar el array de amigos de user1 (senderId)
    const user1Friends = user1Snap.exists() && user1Snap.data().friends 
      ? [...user1Snap.data().friends, userId] 
      : [userId];
    
    await setDoc(user1Ref, {
      friends: user1Friends
    }, { merge: true });

    // Actualizar el array de amigos de user2 (quien acepta)
    const user2Friends = user2Snap.exists() && user2Snap.data().friends 
      ? [...user2Snap.data().friends, requestData.senderId] 
      : [requestData.senderId];
    
    await setDoc(user2Ref, {
      friends: user2Friends
    }, { merge: true });

    // Actualizar estado de la solicitud
    await updateDoc(requestRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error al aceptar solicitud:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Rechazar solicitud de amistad
 * @param {string} requestId - ID de la solicitud
 */
export const rejectFriendRequest = async (requestId) => {
  try {
    const requestRef = doc(db, 'friendRequests', requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      rejectedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verificar si dos usuarios son amigos
 * @param {string} userId1 - ID del primer usuario
 * @param {string} userId2 - ID del segundo usuario
 */
export const checkFriendship = async (userId1, userId2) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId1));
    if (!userDoc.exists()) {
      return { areFriends: false };
    }

    const friends = userDoc.data().friends || [];
    return { areFriends: friends.includes(userId2) };
  } catch (error) {
    console.error('Error al verificar amistad:', error);
    return { areFriends: false };
  }
};

/**
 * Obtener lista de amigos de un usuario
 * @param {string} userId - ID del usuario
 */
export const getFriendsList = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return { success: true, friends: [] };
    }

    const friendIds = userDoc.data().friends || [];
    const friends = [];

    for (const friendId of friendIds) {
      const friendDoc = await getDoc(doc(db, 'users', friendId));
      if (friendDoc.exists()) {
        friends.push({
          id: friendId,
          ...friendDoc.data()
        });
      }
    }

    return { success: true, friends };
  } catch (error) {
    console.error('Error al obtener lista de amigos:', error);
    return { success: false, error: error.message, friends: [] };
  }
};

/**
 * Eliminar un amigo
 * @param {string} userId - ID del usuario
 * @param {string} friendId - ID del amigo a eliminar
 */
export const removeFriend = async (userId, friendId) => {
  try {
    const user1Ref = doc(db, 'users', userId);
    const user2Ref = doc(db, 'users', friendId);

    // Obtener los documentos actuales
    const [user1Snap, user2Snap] = await Promise.all([
      getDoc(user1Ref),
      getDoc(user2Ref)
    ]);

    // Remover del array de amigos de user1
    if (user1Snap.exists() && user1Snap.data().friends) {
      const user1Friends = user1Snap.data().friends.filter(id => id !== friendId);
      await setDoc(user1Ref, {
        friends: user1Friends
      }, { merge: true });
    }

    // Remover del array de amigos de user2
    if (user2Snap.exists() && user2Snap.data().friends) {
      const user2Friends = user2Snap.data().friends.filter(id => id !== userId);
      await setDoc(user2Ref, {
        friends: user2Friends
      }, { merge: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error al eliminar amigo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener información de un usuario por su ID
 * @param {string} userId - ID del usuario
 */
export const getUserById = async (userId) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return null;
    }

    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return null;
  }
};
