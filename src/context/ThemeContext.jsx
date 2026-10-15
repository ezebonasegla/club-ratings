import React, { createContext, useContext, useEffect, useState } from 'react';
import { getClubById } from '../config/clubs';
import { getUserClubs, setActiveClub as setActiveClubService } from '../services/cloudUserConfigService';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

// Copia local de la configuración de clubes del usuario: permite mostrar la app
// al instante al abrirla, mientras se actualiza desde Firestore en segundo plano.
const clubsCacheKey = (userId) => `clubRatings:clubs:${userId}`;

const readCachedClubs = (userId) => {
  try {
    const cached = JSON.parse(localStorage.getItem(clubsCacheKey(userId)));
    return cached?.activeClubId && getClubById(cached.activeClubId) ? cached : null;
  } catch {
    return null;
  }
};

const writeCachedClubs = (userId, clubsData) => {
  try {
    if (clubsData) {
      const { primaryClubId, secondaryClubIds, activeClubId, allClubIds } = clubsData;
      localStorage.setItem(clubsCacheKey(userId), JSON.stringify({ primaryClubId, secondaryClubIds, activeClubId, allClubIds }));
    } else {
      localStorage.removeItem(clubsCacheKey(userId));
    }
  } catch {
    // localStorage no disponible: no pasa nada, sólo se pierde la caché
  }
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [clubId, setClubId] = useState(null);
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Nuevos estados para múltiples clubes
  const [primaryClubId, setPrimaryClubId] = useState(null);
  const [secondaryClubIds, setSecondaryClubIds] = useState([]);
  const [allClubs, setAllClubs] = useState([]);

  const applyClubsData = (clubsData) => {
    setPrimaryClubId(clubsData.primaryClubId);
    setSecondaryClubIds(clubsData.secondaryClubIds);

    // Cargar todos los objetos de clubes
    const clubObjects = clubsData.allClubIds.map(id => getClubById(id)).filter(Boolean);
    setAllClubs(clubObjects);

    // Configurar club activo
    setClubId(clubsData.activeClubId);
    const clubData = getClubById(clubsData.activeClubId);
    setClub(clubData);
    applyTheme(clubData);
  };

  const clearClubsData = () => {
    setClubId(null);
    setClub(null);
    setPrimaryClubId(null);
    setSecondaryClubIds([]);
    setAllClubs([]);
  };

  useEffect(() => {
    let cancelled = false;

    const loadUserClub = async () => {
      // Si auth está cargando, esperar
      if (authLoading) {
        return;
      }

      if (user) {
        // Mostrar enseguida la última configuración conocida
        const cached = readCachedClubs(user.uid);
        if (cached) {
          applyClubsData(cached);
          setLoading(false);
        } else {
          setLoading(true);
        }

        const result = await getUserClubs(user.uid);
        if (cancelled) return;

        if (result.success && result.activeClubId) {
          applyClubsData(result);
          writeCachedClubs(user.uid, result);
        } else if (result.success) {
          // El usuario todavía no eligió club
          clearClubsData();
          writeCachedClubs(user.uid, null);
        }
        setLoading(false);
      } else {
        // Si no hay usuario, no hay club que cargar
        clearClubsData();
        setLoading(false);
      }
    };

    loadUserClub();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const applyTheme = (clubData) => {
    if (!clubData) return;

    const root = document.documentElement;
    root.style.setProperty('--primary-color', clubData.colors.primary);
    root.style.setProperty('--secondary-color', clubData.colors.secondary);
    root.style.setProperty('--text-color', clubData.colors.text);
    root.style.setProperty('--text-secondary-color', clubData.colors.textSecondary);
  };

  const changeClub = (newClubId) => {
    const clubData = getClubById(newClubId);
    if (clubData) {
      // La configuración cambió por fuera de este contexto: invalidar la copia local
      if (user) writeCachedClubs(user.uid, null);
      setClubId(newClubId);
      setClub(clubData);
      applyTheme(clubData);
    }
  };

  // Nueva función para cambiar club activo (con persistencia en Firestore)
  const switchActiveClub = async (newClubId) => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };
    
    const result = await setActiveClubService(user.uid, newClubId);
    if (result.success) {
      const clubData = getClubById(newClubId);
      if (clubData) {
        const cached = readCachedClubs(user.uid);
        if (cached) writeCachedClubs(user.uid, { ...cached, activeClubId: newClubId });
        setClubId(newClubId);
        setClub(clubData);
        applyTheme(clubData);
      }
    }
    return result;
  };

  // Función para recargar los clubes del usuario (útil después de agregar/eliminar)
  const refreshUserClubs = async () => {
    if (!user) return;
    
    setLoading(true);
    const result = await getUserClubs(user.uid);
    
    if (result.success && result.activeClubId) {
      applyClubsData(result);
      writeCachedClubs(user.uid, result);
    }
    setLoading(false);
  };

  return (
    <ThemeContext.Provider value={{ 
      clubId, 
      club, 
      changeClub, 
      loading,
      // Nuevas propiedades para múltiples clubes
      primaryClubId,
      secondaryClubIds,
      allClubs,
      switchActiveClub,
      refreshUserClubs
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
