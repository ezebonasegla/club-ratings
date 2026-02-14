import React, { createContext, useContext, useEffect, useState } from 'react';
import { getClubById } from '../config/clubs';
import { getUserClub } from '../services/cloudUserConfigService';
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

  useEffect(() => {
    const loadUserClub = async () => {
      // Si auth está cargando, esperar
      if (authLoading) {
        return;
      }

      if (user) {
        setLoading(true);
        const result = await getUserClub(user.uid);
        
        if (result.success && result.clubId) {
          setClubId(result.clubId);
          const clubData = getClubById(result.clubId);
          setClub(clubData);
          applyTheme(clubData);
        }
        setLoading(false);
      } else {
        // Si no hay usuario, no hay club que cargar
        setClubId(null);
        setClub(null);
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

  return (
    <ThemeContext.Provider value={{ clubId, club, changeClub, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};
