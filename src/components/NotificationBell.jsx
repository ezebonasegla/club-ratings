import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, UserPlus, MessageCircle, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead 
} from '../services/notificationsService';
import './NotificationBell.css';

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { switchActiveClub, clubId: currentClubId } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    loadNotifications();
    loadUnreadCount();

    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      loadNotifications();
      loadUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const result = await getNotifications(user.uid, 20);
      if (result.success && result.notifications) {
        setNotifications(Array.isArray(result.notifications) ? result.notifications : []);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
    }
  };

  const loadUnreadCount = async () => {
    if (!user) return;
    try {
      const result = await getUnreadCount(user.uid);
      if (result.success) {
        setUnreadCount(result.count || 0);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      loadNotifications();
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markAsRead(notificationId);
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await markAllAsRead(user.uid);
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Marcar como leída
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    // Navegar según el tipo
    setIsOpen(false);
    
    switch (notification.type) {
      case 'friend_request':
        navigate('/friends');
        break;
      case 'friend_accepted':
        navigate('/friends');
        break;
      case 'comment':
      case 'reaction':
        // Si la notificación tiene clubId y es diferente al actual, cambiar de club
        if (notification.clubId && notification.clubId !== currentClubId) {
          await switchActiveClub(notification.clubId);
        }
        // Navegar a ManageRatings con el ratingId como parámetro
        navigate('/manage', { 
          state: { 
            highlightRatingId: notification.ratingId,
            expandComments: true
          } 
        });
        break;
      default:
        break;
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'friend_request':
      case 'friend_accepted':
        return <UserPlus size={18} className="notification-icon friend-icon" />;
      case 'new_comment':
        return <MessageCircle size={18} className="notification-icon comment-icon" />;
      case 'new_reaction':
        return <Heart size={18} className="notification-icon reaction-icon" />;
      default:
        return <Bell size={18} className="notification-icon" />;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button 
        className="notification-bell-button"
        onClick={handleToggle}
        aria-label="Notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notificaciones</h3>
            {Array.isArray(notifications) && notifications.some(n => !n.read) && (
              <button 
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                disabled={loading}
              >
                <CheckCheck size={16} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="notification-list">
            {!Array.isArray(notifications) || notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={32} className="empty-icon" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-wrapper">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="notification-content">
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">{formatTime(notification.createdAt)}</span>
                  </div>

                  {!notification.read && (
                    <button
                      className="mark-read-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notification.id);
                      }}
                      aria-label="Marcar como leída"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {Array.isArray(notifications) && notifications.length > 0 && (
            <div className="notification-footer">
              <button 
                className="view-all-btn"
                onClick={() => setIsOpen(false)}
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
