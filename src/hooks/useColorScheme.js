import { useEffect, useState } from 'react';

const STORAGE_KEY = 'clubRatings:colorScheme';
const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null;

const readStored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
};

export const resolveScheme = () => readStored() || (media?.matches ? 'dark' : 'light');

export const applyScheme = (scheme) => {
  document.documentElement.dataset.theme = scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme === 'dark' ? '#0f1115' : '#ffffff');
};

/**
 * Modo claro / oscuro. Si el usuario nunca eligió, sigue la preferencia del sistema.
 */
export const useColorScheme = () => {
  const [scheme, setScheme] = useState(resolveScheme);

  useEffect(() => {
    applyScheme(scheme);
  }, [scheme]);

  // Seguir al sistema mientras el usuario no haya elegido manualmente
  useEffect(() => {
    if (!media) return;
    const onChange = () => { if (!readStored()) setScheme(media.matches ? 'dark' : 'light'); };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const toggle = () => {
    const next = scheme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* sin almacenamiento */ }
    setScheme(next);
  };

  return { scheme, isDark: scheme === 'dark', toggle };
};
