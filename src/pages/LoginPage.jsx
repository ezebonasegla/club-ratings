import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader, AlertCircle, Shield, BarChart3, Cloud, Users } from 'lucide-react';
import './LoginPage.css';

const LoginPage = () => {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    const result = await signInWithGoogle();
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Error al iniciar sesión con Google');
    }
    
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="background-decoration">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>

      <div className="login-container">
        <div className="login-content">
          <div className="login-left">
            <div className="brand-section">
              <div className="brand-logo">
                <Shield size={48} strokeWidth={2} />
              </div>
              <h1 className="brand-title">Football Ratings</h1>
              <p className="brand-subtitle">Sistema profesional de valoración de jugadores</p>
            </div>

            <div className="features-list">
              <div className="feature-item">
                <div className="feature-icon-wrapper">
                  <BarChart3 size={24} />
                </div>
                <div className="feature-text">
                  <h3>Análisis Detallado</h3>
                  <p>Estadísticas completas y gráficos de rendimiento</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-wrapper">
                  <Cloud size={24} />
                </div>
                <div className="feature-text">
                  <h3>Sincronización en la Nube</h3>
                  <p>Accede a tus datos desde cualquier dispositivo</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-wrapper">
                  <Users size={24} />
                </div>
                <div className="feature-text">
                  <h3>Multi-Club</h3>
                  <p>Soporte para 28 equipos argentinos</p>
                </div>
              </div>
            </div>
          </div>

          <div className="login-right">
            <div className="login-card">
              <div className="card-header">
                <h2>Bienvenido</h2>
                <p>Inicia sesión para comenzar</p>
              </div>

              {error && (
                <div className="error-message">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="google-button"
              >
                {loading ? (
                  <>
                    <Loader className="spin" size={20} />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="20" height="20" className="google-icon">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continuar con Google</span>
                  </>
                )}
              </button>

              <div className="divider">
                <span>Acceso seguro y rápido</span>
              </div>

              <div className="trust-indicators">
                <div className="trust-item">
                  <Shield size={16} />
                  <span>Seguro</span>
                </div>
                <div className="trust-item">
                  <Cloud size={16} />
                  <span>Firebase</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
