import React, { createContext, useContext, useEffect, useState } from 'react';
import { getClubById } from '../config/clubs';
import { getUserClubs, setActiveClub as setActiveClubService } from '../services/cloudUserConfigService';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

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

  useEffect(() => {
    const loadUserClub = async () => {
      // Si auth está cargando, esperar
      if (authLoading) {
        return;
      }

      if (user) {
        setLoading(true);
        const result = await getUserClubs(user.uid);
        
        if (result.success && result.activeClubId) {
          // Guardar datos de clubes
          setPrimaryClubId(result.primaryClubId);
          setSecondaryClubIds(result.secondaryClubIds);
          
          // Cargar todos los objetos de clubes
          const clubObjects = result.allClubIds.map(id => getClubById(id)).filter(Boolean);
          setAllClubs(clubObjects);
          
          // Configurar club activo
          setClubId(result.activeClubId);
          const clubData = getClubById(result.activeClubId);
          setClub(clubData);
          applyTheme(clubData);
        }
        setLoading(false);
      } else {
        // Si no hay usuario, no hay club que cargar
        setClubId(null);
        setClub(null);
        setPrimaryClubId(null);
        setSecondaryClubIds([]);
        setAllClubs([]);
        setLoading(false);
      }
    };

    loadUserClub();
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
      setPrimaryClubId(result.primaryClubId);
      setSecondaryClubIds(result.secondaryClubIds);
      
      const clubObjects = result.allClubIds.map(id => getClubById(id)).filter(Boolean);
      setAllClubs(clubObjects);
      
      setClubId(result.activeClubId);
      const clubData = getClubById(result.activeClubId);
      setClub(clubData);
      applyTheme(clubData);
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
