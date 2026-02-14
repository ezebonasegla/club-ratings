import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Servicio para manejar la configuración del usuario en Firestore
 */

/**
 * Guardar o actualizar la configuración del usuario
 * @param {string} userId - ID del usuario autenticado
 * @param {Object} config - Configuración a guardar
 */
export const saveUserConfig = async (userId, config) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, {
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener la configuración del usuario
 * @param {string} userId - ID del usuario autenticado
 */
export const getUserConfig = async (userId) => {
  try {
    console.log('getUserConfig - userId:', userId);
    const userDocRef = doc(db, 'users', userId);
    console.log('getUserConfig - fetching doc...');
    
    // Agregar timeout de 5 segundos
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: Firestore no responde. Verifica las reglas de seguridad.')), 5000)
    );
    
    const docSnap = await Promise.race([
      getDoc(userDocRef),
      timeoutPromise
    ]);
    
    console.log('getUserConfig - doc exists:', docSnap.exists());

    if (docSnap.exists()) {
      console.log('getUserConfig - data:', docSnap.data());
      return { success: true, data: docSnap.data() };
    } else {
      return { success: true, data: null };
    }
  } catch (error) {
    console.error('Error al cargar configuración:', error);
    return { success: false, error: error.message, data: null };
  }
};

/**
 * Guardar el club seleccionado por el usuario
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - ID del club seleccionado
 * @param {Object} userInfo - Información adicional del usuario (email, nombre, foto)
 */
export const setUserClub = async (userId, clubId, userInfo = {}) => {
  const config = {
    clubId,
    ...(userInfo.email && { email: userInfo.email }),
    ...(userInfo.displayName && { displayName: userInfo.displayName }),
    ...(userInfo.photoURL && { photoURL: userInfo.photoURL })
  };
  return await saveUserConfig(userId, config);
};

/**
 * Obtener el club del usuario
 * @param {string} userId - ID del usuario autenticado
 */
export const getUserClub = async (userId) => {
  const result = await getUserConfig(userId);
  if (result.success && result.data) {
    return { success: true, clubId: result.data.clubId };
  }
  return { success: result.success, clubId: null, error: result.error };
};

/**
 *try {
    console.log('hasUserClub - checking for userId:', userId);
    const result = await getUserClub(userId);
    console.log('hasUserClub - result:', result);
    return result.success && result.clubId !== null && result.clubId !== undefined;
  } catch (error) {
    console.error('hasUserClub - error:', error);
    return false;
  }cado
 */
export const hasUserClub = async (userId) => {
  const result = await getUserClub(userId);
  return result.success && result.clubId !== null;
};
