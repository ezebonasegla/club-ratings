import React, { useState, useEffect } from 'react';
import { getAllPlayersStatsFromCloud, getGeneralStatsFromCloud, getAllRatingsFromCloud } from '../services/cloudStorageService';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Trophy, TrendingUp, Users, Calendar } from 'lucide-react';
import './DashboardPage.css';

const COLORS = ['#E30613', '#FFFFFF', '#000000', '#FFD700', '#C0C0C0'];

const DashboardPage = () => {
  const { user } = useAuth();
  const [playersStats, setPlayersStats] = useState([]);
  const [generalStats, setGeneralStats] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [sortBy, setSortBy] = useState('averageRating');
  const [loading, setLoading] = useState(true);
  const [ratingDistributionData, setRatingDistributionData] = useState([]);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    
    setLoading(true);
    const playersResult = await getAllPlayersStatsFromCloud(user.uid);
    const generalResult = await getGeneralStatsFromCloud(user.uid);
    const distributionData = await loadRatingDistribution();
    
    if (playersResult.success) {
      setPlayersStats(playersResult.data);
    }
    
    if (generalResult.success) {
      setGeneralStats(generalResult.data);
    }
    
    setRatingDistributionData(distributionData);
    setLoading(false);
  };

  const sortPlayers = (players, criteria) => {
    const sorted = [...players];
    switch (criteria) {
      case 'averageRating':
        return sorted.sort((a, b) => b.averageRating - a.averageRating);
      case 'appearances':
        return sorted.sort((a, b) => b.appearances - a.appearances);
      case 'goals':
        return sorted.sort((a, b) => b.totalGoals - a.totalGoals);
      case 'assists':
        return sorted.sort((a, b) => b.totalAssists - a.totalAssists);
      default:
        return sorted;
    }
  };

  const sortedPlayers = sortPlayers(playersStats, sortBy);
  const topPlayers = sortedPlayers.slice(0, 10);

  // Datos para gráfico de barras - Top 10 mejores promedios
  const topRatingsData = topPlayers.map(p => ({
    name: p.name.split(' ').slice(-1)[0], // Solo apellido para el gráfico
    promedio: p.averageRating,
    partidos: p.appearances
  }));

  // Datos para gráfico de evolución del jugador seleccionado
  const playerEvolutionData = selectedPlayer && selectedPlayer.lastRatings
    ? selectedPlayer.lastRatings.map((r, index) => ({
        partido: `vs ${r.rival.split(' ').slice(0, 2).join(' ')}`,
        nota: r.rating,
        fecha: r.date
      })).reverse()
    : [];

  // Datos para gráfico de distribución de notas
  const loadRatingDistribution = async () => {
    if (!user) return [];
    
    const distribution = { '0-4': 0, '4-5': 0, '5-6': 0, '6-7': 0, '7-8': 0, '8-10': 0 };
    
    const ratingsResult = await getAllRatingsFromCloud(user.uid);
    if (ratingsResult.success) {
      ratingsResult.data.forEach(match => {
        match.players.forEach(player => {
          if (player.rating !== null && player.rating !== undefined && player.rating !== 'N/A') {
            const rating = parseFloat(player.rating);
            if (!isNaN(rating)) {
              if (rating >= 0 && rating < 4) distribution['0-4']++;
              else if (rating >= 4 && rating < 5) distribution['4-5']++;
              else if (rating >= 5 && rating < 6) distribution['5-6']++;
              else if (rating >= 6 && rating < 7) distribution['6-7']++;
              else if (rating >= 7 && rating < 8) distribution['7-8']++;
              else if (rating >= 8 && rating <= 10) distribution['8-10']++;
            }
          }
        });
      });
    }

    return Object.entries(distribution).map(([range, count]) => ({
      rango: range,
      cantidad: count
    }));
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
            Cargando estadísticas...
          </div>
        </div>
      </div>
    );
  }

  if (!generalStats || playersStats.length === 0) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <div className="empty-state">
            <Calendar size={64} />
            <h2>No hay datos disponibles</h2>
            <p>Comienza valorando partidos para ver las estadísticas</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <h1>Dashboard de Estadísticas</h1>

        {/* Stats Cards */}
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">
              <Calendar />
            </div>
            <div className="stat-content">
              <span className="stat-value">{generalStats.totalMatches}</span>
              <span className="stat-label">Partidos Valorados</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Users />
            </div>
            <div className="stat-content">
              <span className="stat-value">{generalStats.totalPlayers}</span>
              <span className="stat-label">Jugadores</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <TrendingUp />
            </div>
            <div className="stat-content">
              <span className="stat-value">{generalStats.averageTeamRating.toFixed(2)}</span>
              <span className="stat-label">Promedio Equipo</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Trophy />
            </div>
            <div className="stat-content">
              <span className="stat-value">{topPlayers[0]?.name.split(' ').slice(-1)[0]}</span>
              <span className="stat-label">Mejor Jugador</span>
            </div>
          </div>
        </div>

        {/* Top Players Chart */}
        <div className="chart-section">
          <div className="chart-header">
            <h2>Top 10 Jugadores por Promedio</h2>
            <div className="sort-controls">
              <label>Ordenar por:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="averageRating">Promedio de Nota</option>
                <option value="appearances">Partidos Jugados</option>
                <option value="goals">Goles</option>
                <option value="assists">Asistencias</option>
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topRatingsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="promedio" fill="#E30613" name="Promedio" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Players Table */}
        <div className="table-section">
          <h2>Estadísticas Detalladas</h2>
          <div className="table-container">
            <table className="players-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Partidos</th>
                  <th>Promedio</th>
                  <th>Goles</th>
                  <th>Asistencias</th>
                  <th>Minutos</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player, index) => (
                  <tr key={player.name} className={index < 3 ? 'top-player' : ''}>
                    <td>{index + 1}</td>
                    <td className="player-name-cell">{player.name}</td>
                    <td>{player.appearances}</td>
                    <td className="rating-cell">
                      <span className={`rating-badge ${player.averageRating >= 7 ? 'high' : player.averageRating >= 6 ? 'medium' : 'low'}`}>
                        {player.averageRating.toFixed(2)}
                      </span>
                    </td>
                    <td>{player.totalGoals}</td>
                    <td>{player.totalAssists}</td>
                    <td>{player.totalMinutes}</td>
                    <td>
                      <button
                        className="view-button"
                        onClick={() => setSelectedPlayer(player)}
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="chart-section">
          <h2>Distribución de Notas</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ratingDistributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rango" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cantidad" fill="#E30613" name="Cantidad de Notas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Matches */}
        <div className="recent-matches">
          <h2>Últimos Partidos Valorados</h2>
          <div className="matches-list">
            {generalStats.recentMatches && generalStats.recentMatches.length > 0 ? (
              generalStats.recentMatches.map(match => (
                <div key={match.id} className="match-item">
                  <div className="match-date">{match.date}</div>
                  <div className="match-details">
                    <span className="match-rival">{match.rival}</span>
                    <span className="match-score">{match.score}</span>
                  </div>
                  <div className="match-competition">{match.competition}</div>
                </div>
              ))
            ) : (
              <p>No hay partidos valorados aún.</p>
            )}
          </div>
        </div>

        {/* Player Detail Modal */}
        {selectedPlayer && (
          <div className="modal-overlay" onClick={() => setSelectedPlayer(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedPlayer.name}</h2>
                <button className="close-button" onClick={() => setSelectedPlayer(null)}>
                  ✕
                </button>
              </div>
              
              <div className="modal-body">
                <div className="player-summary">
                  <div className="summary-item">
                    <span className="summary-label">Partidos:</span>
                    <span className="summary-value">{selectedPlayer.appearances}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Promedio:</span>
                    <span className="summary-value highlight">{selectedPlayer.averageRating.toFixed(2)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Goles:</span>
                    <span className="summary-value">{selectedPlayer.totalGoals}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Asistencias:</span>
                    <span className="summary-value">{selectedPlayer.totalAssists}</span>
                  </div>
                </div>

                {playerEvolutionData.length > 0 && (
                  <div className="player-chart">
                    <h3>Evolución de Notas (Últimos 5 partidos)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={playerEvolutionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="partido" angle={-45} textAnchor="end" height={80} />
                        <YAxis domain={[0, 10]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="nota" stroke="#E30613" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="recent-performances">
                  <h3>Últimas Actuaciones</h3>
                  {selectedPlayer.lastRatings.map((rating, index) => (
                    <div key={index} className="performance-item">
                      <div className="performance-info">
                        <span className="performance-rival">vs {rating.rival}</span>
                        <span className="performance-date">{rating.date}</span>
                      </div>
                      <span className={`performance-rating ${rating.rating >= 7 ? 'high' : rating.rating >= 6 ? 'medium' : 'low'}`}>
                        {rating.rating.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
