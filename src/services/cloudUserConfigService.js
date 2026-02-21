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
 * Guardar el club seleccionado por el usuario (mantiene compatibilidad con código antiguo)
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - ID del club seleccionado
 * @param {Object} userInfo - Información adicional del usuario (email, nombre, foto)
 */
export const setUserClub = async (userId, clubId, userInfo = {}) => {
  const config = {
    primaryClubId: clubId,
    activeClubId: clubId,
    secondaryClubIds: [],
    ...(userInfo.email && { email: userInfo.email }),
    ...(userInfo.displayName && { displayName: userInfo.displayName }),
    ...(userInfo.photoURL && { photoURL: userInfo.photoURL })
  };
  return await saveUserConfig(userId, config);
};

/**
 * Obtener el club del usuario (mantiene compatibilidad)
 * @param {string} userId - ID del usuario autenticado
 */
export const getUserClub = async (userId) => {
  const result = await getUserConfig(userId);
  if (result.success && result.data) {
    // Compatibilidad con datos antiguos
    const clubId = result.data.activeClubId || result.data.primaryClubId || result.data.clubId;
    return { success: true, clubId };
  }
  return { success: result.success, clubId: null, error: result.error };
};

/**
 * Verificar si el usuario tiene un club configurado
 */
export const hasUserClub = async (userId) => {
  const result = await getUserClub(userId);
  return result.success && result.clubId !== null;
};

/**
 * Obtener todos los clubes del usuario (primario + secundarios)
 * @param {string} userId - ID del usuario autenticado
 */
export const getUserClubs = async (userId) => {
  const result = await getUserConfig(userId);
  if (result.success && result.data) {
    // Compatibilidad con datos antiguos
    const primaryClubId = result.data.primaryClubId || result.data.clubId;
    const secondaryClubIds = result.data.secondaryClubIds || [];
    const activeClubId = result.data.activeClubId || primaryClubId;
    
    return {
      success: true,
      primaryClubId,
      secondaryClubIds,
      activeClubId,
      allClubIds: [primaryClubId, ...secondaryClubIds].filter(Boolean)
    };
  }
  return {
    success: result.success,
    primaryClubId: null,
    secondaryClubIds: [],
    activeClubId: null,
    allClubIds: [],
    error: result.error
  };
};

/**
 * Cambiar el club activo del usuario
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - ID del nuevo club activo
 */
export const setActiveClub = async (userId, clubId) => {
  try {
    const clubsData = await getUserClubs(userId);
    
    // Verificar que el club esté en la lista de clubes del usuario
    if (!clubsData.allClubIds.includes(clubId)) {
      return { success: false, error: 'Club no encontrado en tu lista de clubes' };
    }
    
    return await saveUserConfig(userId, { activeClubId: clubId });
  } catch (error) {
    console.error('Error al cambiar club activo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Agregar un club secundario
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - ID del club a agregar
 */
export const addSecondaryClub = async (userId, clubId) => {
  try {
    const clubsData = await getUserClubs(userId);
    
    // Verificar que no sea el club primario
    if (clubId === clubsData.primaryClubId) {
      return { success: false, error: 'Este ya es tu club principal' };
    }
    
    // Verificar que no exista en secundarios
    if (clubsData.secondaryClubIds.includes(clubId)) {
      return { success: false, error: 'Este club ya está en tu lista' };
    }
    
    // Verificar límite de 2 clubes secundarios
    if (clubsData.secondaryClubIds.length >= 2) {
      return { success: false, error: 'Ya tienes el máximo de clubes secundarios (2)' };
    }
    
    const newSecondaryClubs = [...clubsData.secondaryClubIds, clubId];
    return await saveUserConfig(userId, { secondaryClubIds: newSecondaryClubs });
  } catch (error) {
    console.error('Error al agregar club secundario:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Eliminar un club secundario
 * @param {string} userId - ID del usuario autenticado
 * @param {string} clubId - ID del club a eliminar
 */
export const removeSecondaryClub = async (userId, clubId) => {
  try {
    const clubsData = await getUserClubs(userId);
    
    if (!clubsData.secondaryClubIds.includes(clubId)) {
      return { success: false, error: 'Club no encontrado en secundarios' };
    }
    
    const newSecondaryClubs = clubsData.secondaryClubIds.filter(id => id !== clubId);
    
    // Si el club eliminado era el activo, cambiar al primario
    const updates = { secondaryClubIds: newSecondaryClubs };
    if (clubsData.activeClubId === clubId) {
      updates.activeClubId = clubsData.primaryClubId;
    }
    
    return await saveUserConfig(userId, updates);
  } catch (error) {
    console.error('Error al eliminar club secundario:', error);
    return { success: false, error: error.message };
  }
};
