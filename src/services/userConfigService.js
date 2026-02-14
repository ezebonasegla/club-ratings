// Servicio para manejar la configuración del usuario
const USER_CONFIG_KEY = 'user_config';

export const saveUserConfig = (config) => {
  try {
    localStorage.setItem(USER_CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    return false;
  }
};

export const getUserConfig = () => {
  try {
    const config = localStorage.getItem(USER_CONFIG_KEY);
    return config ? JSON.parse(config) : null;
  } catch (error) {
    console.error('Error al cargar configuración:', error);
    return null;
  }
};

export const setUserClub = (clubId) => {
  const config = getUserConfig() || {};
  config.clubId = clubId;
  config.updatedAt = new Date().toISOString();
  return saveUserConfig(config);
};

export const getUserClub = () => {
  const config = getUserConfig();
  return config?.clubId || null;
};

export const clearUserConfig = () => {
  try {
    localStorage.removeItem(USER_CONFIG_KEY);
    return true;
  } catch (error) {
    console.error('Error al limpiar configuración:', error);
    return false;
  }
};

export const hasUserClub = () => {
  return getUserClub() !== null;
};
