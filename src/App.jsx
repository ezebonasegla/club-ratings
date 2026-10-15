import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import RatingPage from './pages/RatingPage';
import { hasUserClub } from './services/cloudUserConfigService';

// Los estilos de todas las páginas se cargan de entrada porque comparten clases
// entre sí (son livianos). Lo pesado es el JS: cada página se descarga recién
// cuando se visita (el Dashboard con gráficos, html2canvas, etc.).
import './styles/legacy-shared.css'; // estilos genéricos (h1, modales) que usan otras páginas
import './pages/DashboardPage.css';
import './pages/ManageRatings.css';
import './pages/ClubSelection.css';
import './pages/LoginPage.css';
import './pages/ProfilePage.css';
import './pages/FriendsPage.css';
import './pages/FriendRatingsPage.css';
import './App.css';
import './styles/dark.css';
import './styles/dark-overrides.css';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ManageRatings = lazy(() => import('./pages/ManageRatings'));
const ClubSelection = lazy(() => import('./pages/ClubSelection'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const FriendRatingsPage = lazy(() => import('./pages/FriendRatingsPage'));

const FullPageLoader = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontSize: '1.5rem'
  }}>
    Cargando...
  </div>
);

const PageLoader = () => (
  <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
    Cargando...
  </div>
);

// Componente para proteger rutas que requieren autenticación
const ProtectedRoute = ({ children, requireClub = true }) => {
  const { user, loading } = useAuth();
  const { club, loading: clubLoading } = useTheme();
  const [hasClub, setHasClub] = useState(null);
  const [checkingClub, setCheckingClub] = useState(true);
  
  useEffect(() => {
    const checkUserClub = async () => {
      if (!loading && !clubLoading) {
        if (user && requireClub) {
          // Primero verificar si el ThemeContext ya tiene el club cargado
          if (club) {
            setHasClub(true);
            setCheckingClub(false);
            return;
          }
          
          const clubExists = await hasUserClub(user.uid);
          setHasClub(clubExists);
        } else {
          setHasClub(false);
        }
        setCheckingClub(false);
      }
    };

    checkUserClub();
  }, [user, loading, requireClub, club, clubLoading]);

  if (loading || checkingClub) {
    return <FullPageLoader />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireClub && hasClub === false) {
    return <Navigate to="/select-club" replace />;
  }

  return children;
};

// Componente para la página de selección de club
// Redirige a home si ya tiene un club seleccionado
const ClubSelectionRoute = () => {
  const { user, loading } = useAuth();
  const { club, loading: clubLoading } = useTheme();

  if (loading || clubLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si ya tiene club, redirigir a home
  if (club) {
    return <Navigate to="/" replace />;
  }

  return <ClubSelection />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Suspense fallback={<FullPageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/select-club" element={<ClubSelectionRoute />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RatingPage />} />
              <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
              <Route path="manage" element={<Suspense fallback={<PageLoader />}><ManageRatings /></Suspense>} />
              <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
              <Route path="friends" element={<Suspense fallback={<PageLoader />}><FriendsPage /></Suspense>} />
              <Route path="friend/:friendId" element={<Suspense fallback={<PageLoader />}><FriendRatingsPage /></Suspense>} />
            </Route>
          </Routes>
          </Suspense>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
