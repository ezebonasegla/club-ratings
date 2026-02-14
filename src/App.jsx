import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import RatingPage from './pages/RatingPage';
import DashboardPage from './pages/DashboardPage';
import ManageRatings from './pages/ManageRatings';
import ClubSelection from './pages/ClubSelection';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import { hasUserClub } from './services/cloudUserConfigService';
import './App.css';

// Componente para proteger rutas que requieren autenticación
const ProtectedRoute = ({ children, requireClub = true }) => {
  const { user, loading } = useAuth();
  const { club, loading: clubLoading } = useTheme();
  const [hasClub, setHasClub] = useState(null);
  const [checkingClub, setCheckingClub] = useState(true);
  
  useEffect(() => {
    const checkUserClub = async () => {
      console.log('ProtectedRoute - loading:', loading, 'user:', user, 'clubLoading:', clubLoading, 'club:', club);
      
      if (!loading && !clubLoading) {
        if (user && requireClub) {
          // Primero verificar si el ThemeContext ya tiene el club cargado
          if (club) {
            console.log('Club already loaded in ThemeContext:', club.id);
            setHasClub(true);
            setCheckingClub(false);
            return;
          }
          
          console.log('Checking if user has club in Firestore...');
          const clubExists = await hasUserClub(user.uid);
          console.log('User has club:', clubExists);
          setHasClub(clubExists);
        } else {
          setHasClub(false);
        }
        setCheckingClub(false);
      }
    };

    checkUserClub();
  }, [user, loading, requireClub, club, clubLoading]);

  console.log('ProtectedRoute render - loading:', loading, 'checkingClub:', checkingClub, 'user:', !!user, 'hasClub:', hasClub);

  if (loading || checkingClub) {
    return (
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
  }
  
  if (!user) {
    console.log('No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (requireClub && hasClub === false) {
    console.log('No club, redirecting to select-club');
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
    return (
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
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si ya tiene club, redirigir a home
  if (club) {
    console.log('User already has club, redirecting to home');
    return <Navigate to="/" replace />;
  }

  return <ClubSelection />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
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
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="manage" element={<ManageRatings />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
