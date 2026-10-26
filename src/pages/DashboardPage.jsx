import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAllRatingsFromCloud } from '../services/cloudStorageService';
import { getAttendance } from '../services/attendanceService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts';
import {
  Calendar, Search, Share2, ArrowDownWideNarrow, ArrowUpNarrowWide, Minus, Plus, X, Trophy, Flame, Target, Activity, Star, ChevronRight, SlidersHorizontal,
} from 'lucide-react';
import {
  POSITIONS, RESULT_LABELS, RESULT_SHORT, SORT_OPTIONS, buildMatches, filterMatches, teamSummary, buildPlayers,
  sortPlayers, ratingTier, fmt, fmtSigned, chartColor,
} from './dashboard/stats';
import PlayerDetail from './dashboard/PlayerDetail';
import SharePlayersModal from './dashboard/SharePlayersModal';
import './DashboardPage.css';

const RESULT_COLORS = { win: '#1e9e5a', draw: '#d9a400', loss: '#d64545' };
const DEFAULT_FILTERS = { period: 'all', competition: 'all', venue: 'all', result: 'all', attendance: 'all' };
const isoOf = time => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const Segmented = ({ value, onChange, options, label }) => (
  <div className="dash-segmented" role="group" aria-label={label}>
    {options.map(o => (
      <button
        key={o.value}
        className={value === o.value ? 'active' : ''}
        onClick={() => onChange(o.value)}
        aria-pressed={value === o.value}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const TeamTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="dash-tooltip">
      <strong>vs {d.rival}</strong>
      <span>{d.date} · {d.score} ({RESULT_LABELS[d.result]})</span>
      <span>Promedio del equipo: <b>{fmt(d.promedio, 2)}</b></span>
      {d.figura && <span>Figura: {d.figura}</span>}
    </div>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const { club, clubId, primaryClubId } = useTheme();
  const [ratings, setRatings] = useState([]);
  const [attendedDates, setAttendedDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('all');
  const [minApps, setMinApps] = useState(1);
  const [sortBy, setSortBy] = useState('avg');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedId, setSelectedId] = useState(null);
  const [showShare, setShowShare] = useState(false);

  const color = chartColor(club);

  useEffect(() => {
    if (!user || !clubId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [result, attendance] = await Promise.all([
        getAllRatingsFromCloud(user.uid, clubId, primaryClubId),
        getAttendance(user.uid, clubId),
      ]);
      if (cancelled) return;
      setAttendedDates(new Set(attendance.data.map(a => a.fecha)));
      if (result.success) {
        setRatings(result.data);
        // Con muchos partidos, por defecto exigir un mínimo para que el ranking sea representativo
        setMinApps(result.data.length >= 10 ? 3 : 1);
        setError('');
      } else {
        setError('No se pudieron cargar tus valoraciones');
      }
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user, clubId, primaryClubId]);

  const allMatches = useMemo(
    () => buildMatches(ratings).map(m => ({ ...m, attended: attendedDates.has(isoOf(m.time)) })),
    [ratings, attendedDates]
  );
  const competitions = useMemo(
    () => [...new Set(allMatches.map(m => m.competition))].sort(),
    [allMatches]
  );
  const years = useMemo(
    () => [...new Set(allMatches.map(m => m.year))].sort((a, b) => b - a),
    [allMatches]
  );

  const matches = useMemo(() => filterMatches(allMatches, filters), [allMatches, filters]);
  const summary = useMemo(() => teamSummary(matches), [matches]);
  const players = useMemo(() => buildPlayers(matches), [matches]);

  const eligible = useMemo(() => players.filter(p => p.apps >= minApps), [players, minApps]);
  const avgRanking = useMemo(() => sortPlayers(eligible, 'avg', 'desc'), [eligible]);

  const visiblePlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = eligible.filter(p =>
      (position === 'all' || p.position === position) &&
      (!q || p.name.toLowerCase().includes(q))
    );
    return sortPlayers(list, sortBy, sortDir);
  }, [eligible, search, position, sortBy, sortDir]);

  const leaders = useMemo(() => {
    if (eligible.length === 0) return [];
    const top = (key, dir = 'desc', filter = () => true) => sortPlayers(eligible.filter(filter), key, dir)[0];
    const items = [
      { key: 'avg', icon: Trophy, title: 'Mejor promedio', player: top('avg'), value: p => fmt(p.avg, 2) },
      { key: 'form', icon: Flame, title: 'En racha', player: top('trend', 'desc', p => p.apps >= 3), value: p => `${fmt(p.form, 2)} (${fmtSigned(p.trend, 1)})` },
      { key: 'consistency', icon: Activity, title: 'Más regular', player: top('consistency', 'asc', p => p.apps >= 3), value: p => `±${fmt(p.std, 2)}` },
      { key: 'mvp', icon: Star, title: 'Más veces figura', player: top('mvp'), value: p => `${p.mvp} ${p.mvp === 1 ? 'vez' : 'veces'}` },
      { key: 'ga', icon: Target, title: 'Goles + asistencias', player: top('ga'), value: p => `${p.goals}G · ${p.assists}A` },
    ];
    return items.filter(i => i.player && !(i.key === 'mvp' && i.player.mvp === 0) && !(i.key === 'ga' && i.player.goals + i.player.assists === 0));
  }, [eligible]);

  const trendData = useMemo(
    () => [...matches].reverse().filter(m => m.teamAvg !== null).map((m, i) => ({
      x: i, // clave única por partido (ver PlayerDetail)
      label: m.rival.split(' ').slice(0, 2).join(' '),
      rival: m.rival,
      date: m.date,
      score: m.score,
      result: m.result,
      promedio: Number(m.teamAvg.toFixed(2)),
      figura: m.best?.name,
    })),
    [matches]
  );

  const selectedPlayer = players.find(p => p.id === selectedId) || null;
  const selectedRank = selectedPlayer ? avgRanking.findIndex(p => p.id === selectedPlayer.id) + 1 : 0;
  const closeDetail = useCallback(() => setSelectedId(null), []);
  const closeShare = useCallback(() => setShowShare(false), []);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const activeFilterCount = Object.keys(DEFAULT_FILTERS).filter(k => filters[k] !== DEFAULT_FILTERS[k]).length;

  const handleSortChange = (value) => {
    setSortBy(value);
    setSortDir(SORT_OPTIONS.find(o => o.value === value)?.dir || 'desc');
  };

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-container">
          <div className="dash-skeleton dash-skeleton-title" />
          <div className="dash-kpis">
            {[0, 1, 2, 3].map(i => <div key={i} className="dash-skeleton dash-skeleton-card" />)}
          </div>
          <div className="dash-skeleton dash-skeleton-chart" />
        </div>
      </div>
    );
  }

  if (error || allMatches.length === 0) {
    return (
      <div className="dash">
        <div className="dash-container">
          <div className="dash-empty">
            <Calendar size={56} />
            <h2>{error || 'Todavía no hay estadísticas'}</h2>
            <p>{error ? 'Probá recargar la página.' : 'Valorá tu primer partido para empezar a ver el rendimiento del plantel.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const periodOptions = [
    { value: 'all', label: 'Todo' },
    { value: 'last5', label: 'Últimos 5' },
    { value: 'last10', label: 'Últimos 10' },
    { value: 'last20', label: 'Últimos 20' },
    ...years.map(y => ({ value: String(y), label: String(y) })),
  ];

  // Resumen de filtros para la imagen compartida
  const filtersLabel = [
    periodOptions.find(o => o.value === filters.period)?.label,
    filters.competition !== 'all' ? filters.competition : null,
    filters.venue === 'home' ? 'Local' : filters.venue === 'away' ? 'Visitante' : null,
    filters.result !== 'all' ? { win: 'Ganados', draw: 'Empates', loss: 'Perdidos' }[filters.result] : null,
    filters.attendance === 'yes' ? 'En la cancha' : filters.attendance === 'no' ? 'Sin ir a la cancha' : null,
    position !== 'all' ? POSITIONS[position]?.label + 's' : null,
    minApps > 1 ? `mín. ${minApps} partidos` : null,
    `${summary.matches} ${summary.matches === 1 ? 'partido' : 'partidos'}`,
  ].filter(Boolean).join(' · ');

  const kpiDelta = summary.recentAvg !== null && summary.teamAvg !== null && summary.matches > 5
    ? summary.recentAvg - summary.teamAvg
    : null;

  return (
    <div className="dash">
      <div className="dash-container">
        {/* Encabezado */}
        <header className="dash-header">
          <div>
            <h1 className="dash-title">Estadísticas</h1>
            <p className="dash-subtitle">
              {club?.name} · {summary.matches} {summary.matches === 1 ? 'partido' : 'partidos'}
              {matches.length !== allMatches.length && ` de ${allMatches.length}`}
            </p>
          </div>
          <button
            className={`dash-filter-toggle ${activeFilterCount ? 'has-active' : ''}`}
            onClick={() => setShowFilters(s => !s)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={18} />
            Filtros
            {activeFilterCount > 0 && <span className="dash-badge">{activeFilterCount}</span>}
          </button>
        </header>

        {/* Filtros globales */}
        <section className={`dash-filters ${showFilters ? 'open' : ''}`} aria-label="Filtros de partidos">
          <label className="dash-field">
            <span>Período</span>
            <select value={filters.period} onChange={e => setFilter('period', e.target.value)}>
              {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="dash-field">
            <span>Competición</span>
            <select value={filters.competition} onChange={e => setFilter('competition', e.target.value)}>
              <option value="all">Todas</option>
              {competitions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="dash-field">
            <span>Condición</span>
            <Segmented
              label="Condición"
              value={filters.venue}
              onChange={v => setFilter('venue', v)}
              options={[{ value: 'all', label: 'Todos' }, { value: 'home', label: 'Local' }, { value: 'away', label: 'Visitante' }]}
            />
          </div>
          <div className="dash-field">
            <span>Resultado</span>
            <Segmented
              label="Resultado"
              value={filters.result}
              onChange={v => setFilter('result', v)}
              options={[{ value: 'all', label: 'Todos' }, { value: 'win', label: 'Ganados' }, { value: 'draw', label: 'Empates' }, { value: 'loss', label: 'Perdidos' }]}
            />
          </div>
          {attendedDates.size > 0 && (
            <div className="dash-field">
              <span>Cancha</span>
              <Segmented
                label="Cancha"
                value={filters.attendance}
                onChange={v => setFilter('attendance', v)}
                options={[{ value: 'all', label: 'Todos' }, { value: 'yes', label: '🏟️ Fui' }, { value: 'no', label: 'No fui' }]}
              />
            </div>
          )}
          {activeFilterCount > 0 && (
            <button className="dash-clear" onClick={() => setFilters(DEFAULT_FILTERS)}>
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </section>

        {matches.length === 0 ? (
          <div className="dash-empty">
            <SlidersHorizontal size={48} />
            <h2>Ningún partido coincide con los filtros</h2>
            <button className="dash-clear" onClick={() => setFilters(DEFAULT_FILTERS)}>Limpiar filtros</button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <section className="dash-kpis">
              <div className="dash-kpi">
                <small>Récord</small>
                <strong>{summary.record.win}-{summary.record.draw}-{summary.record.loss}</strong>
                <div className="dash-record-bar" aria-hidden="true">
                  {['win', 'draw', 'loss'].map(r => summary.record[r] > 0 && (
                    <span key={r} style={{ flex: summary.record[r], background: RESULT_COLORS[r] }} />
                  ))}
                </div>
                <span>G · E · P</span>
              </div>
              <div className="dash-kpi">
                <small>Promedio del equipo</small>
                <strong className={`tier-text-${ratingTier(summary.teamAvg)}`}>{fmt(summary.teamAvg, 2)}</strong>
                {kpiDelta !== null ? (
                  <span className={kpiDelta >= 0 ? 'up' : 'down'}>
                    Últimos 5: {fmt(summary.recentAvg, 2)} ({fmtSigned(kpiDelta, 2)})
                  </span>
                ) : (
                  <span>{summary.ratingsCount} notas</span>
                )}
              </div>
              <div className="dash-kpi">
                <small>Efectividad</small>
                <strong>{Math.round(summary.effectiveness * 100)}%</strong>
                <span>{summary.points} de {summary.matches * 3} puntos</span>
              </div>
              <div className="dash-kpi">
                <small>Goles</small>
                <strong>{summary.goalsFor}<em>:</em>{summary.goalsAgainst}</strong>
                <span>
                  A favor : en contra ({fmtSigned(summary.goalsFor - summary.goalsAgainst, 0)})
                </span>
              </div>
            </section>

            {/* Evolución del equipo */}
            {trendData.length > 1 && (
              <section className="dash-card">
                <div className="dash-card-head">
                  <h2>Rendimiento del equipo</h2>
                  <span className="dash-muted">Promedio de tus notas por partido</span>
                </div>
                <div className="dash-chart">
                  <ResponsiveContainer width="100%" height={230}>
                    <ComposedChart data={trendData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8ec" />
                      <XAxis dataKey="x" tickFormatter={i => trendData[i]?.label ?? ''} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
                      <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<TeamTooltip />} />
                      {summary.teamAvg !== null && (
                        <ReferenceLine y={Number(summary.teamAvg.toFixed(2))} stroke={color} strokeOpacity={0.35} strokeDasharray="4 4" />
                      )}
                      <Line
                        type="monotone"
                        dataKey="promedio"
                        stroke={color}
                        strokeWidth={2.5}
                        dot={({ cx, cy, payload, index }) => (
                          <circle key={index} cx={cx} cy={cy} r={4.5} fill={RESULT_COLORS[payload.result]} stroke="#fff" strokeWidth={1.5} />
                        )}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="dash-legend">
                  {['win', 'draw', 'loss'].map(r => (
                    <span key={r}><i className="round" style={{ background: RESULT_COLORS[r] }} /> {RESULT_LABELS[r]}</span>
                  ))}
                </div>
              </section>
            )}

            {/* Destacados */}
            {leaders.length > 0 && (
              <section className="dash-leaders" aria-label="Destacados">
                {leaders.map(leader => {
                  const LeaderIcon = leader.icon;
                  return (
                    <button key={leader.key} className="dash-leader" onClick={() => setSelectedId(leader.player.id)}>
                      <span className="dash-leader-icon" style={{ color }}><LeaderIcon size={18} /></span>
                      <small>{leader.title}</small>
                      <strong>{leader.player.name}</strong>
                      <span>{leader.value(leader.player)}</span>
                    </button>
                  );
                })}
              </section>
            )}

            {/* Ranking de jugadores */}
            <section className="dash-card">
              <div className="dash-card-head">
                <div>
                  <h2>Jugadores</h2>
                  <span className="dash-muted">
                    {visiblePlayers.length} de {players.length} · tocá uno para ver su detalle
                  </span>
                </div>
                <button
                  className="dash-share-open"
                  onClick={() => setShowShare(true)}
                  disabled={visiblePlayers.length === 0}
                >
                  <Share2 size={16} /> Compartir
                </button>
              </div>

              <div className="dash-controls">
                <label className="dash-search">
                  <Search size={16} />
                  <input
                    type="search"
                    placeholder="Buscar jugador"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </label>

                <div className="dash-chips" role="group" aria-label="Posición">
                  {[['all', 'Todos'], ...Object.entries(POSITIONS).map(([k, v]) => [k, v.short])].map(([k, label]) => (
                    <button
                      key={k}
                      className={`dash-chip ${position === k ? 'active' : ''}`}
                      onClick={() => setPosition(k)}
                      aria-pressed={position === k}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="dash-controls-row">
                  <div className="dash-stepper" aria-label="Mínimo de partidos">
                    <span>Mín. partidos</span>
                    <button onClick={() => setMinApps(n => Math.max(1, n - 1))} aria-label="Menos" disabled={minApps <= 1}>
                      <Minus size={14} />
                    </button>
                    <b>{minApps}</b>
                    <button onClick={() => setMinApps(n => Math.min(Math.max(summary.matches, 1), n + 1))} aria-label="Más" disabled={minApps >= summary.matches}>
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="dash-sort">
                    <select value={sortBy} onChange={e => handleSortChange(e.target.value)} aria-label="Ordenar por">
                      {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      className="dash-icon-btn"
                      onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
                      aria-label={sortDir === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
                      title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
                    >
                      {sortDir === 'asc' ? <ArrowUpNarrowWide size={18} /> : <ArrowDownWideNarrow size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {visiblePlayers.length === 0 ? (
                <p className="dash-muted dash-pad">
                  Ningún jugador cumple los filtros{minApps > 1 ? ` (mínimo ${minApps} partidos)` : ''}.
                </p>
              ) : (
                <>
                  {/* Tabla (pantallas grandes) */}
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th className="left">Jugador</th>
                          <th title="Partidos valorados">PJ</th>
                          <th>Prom.</th>
                          <th title="Promedio de los últimos 5">Forma</th>
                          <th>Máx</th>
                          <th>Mín</th>
                          <th title="Desvío: menor = más regular">Reg.</th>
                          <th>G</th>
                          <th>A</th>
                          <th>Min</th>
                          <th title="Veces que fue el mejor del partido">Fig.</th>
                          <th title="Tu promedio menos el de SofaScore">vs Sofa</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePlayers.map((p, i) => (
                          <tr key={p.id} onClick={() => setSelectedId(p.id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelectedId(p.id)}>
                            <td className="dash-rank">{i + 1}</td>
                            <td className="left">
                              <span className="dash-player-name">{p.name}</span>
                              <span className="dash-pos">{POSITIONS[p.position]?.short || '–'}</span>
                            </td>
                            <td>{p.apps}</td>
                            <td><b className={`dash-pill tier-bg-${ratingTier(p.avg)}`}>{fmt(p.avg, 2)}</b></td>
                            <td className={`tier-text-${ratingTier(p.form)}`}>{fmt(p.form, 2)}</td>
                            <td>{fmt(p.max, 1)}</td>
                            <td>{fmt(p.min, 1)}</td>
                            <td>{fmt(p.std, 2)}</td>
                            <td>{p.goals}</td>
                            <td>{p.assists}</td>
                            <td>{p.minutes}</td>
                            <td>{p.mvp}</td>
                            <td className={p.sofaDiff === null ? '' : p.sofaDiff >= 0 ? 'up' : 'down'}>{fmtSigned(p.sofaDiff, 2)}</td>
                            <td><ChevronRight size={16} className="dash-chevron" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Tarjetas (mobile) */}
                  <div className="dash-player-list">
                    {visiblePlayers.map((p, i) => (
                      <button key={p.id} className="dash-player-card" onClick={() => setSelectedId(p.id)}>
                        <span className="dash-rank">{i + 1}</span>
                        <div className="dash-player-main">
                          <span className="dash-player-name">{p.name}</span>
                          <span className="dash-player-meta">
                            <span className="dash-pos">{POSITIONS[p.position]?.short || '–'}</span>
                            {p.apps} PJ · Forma <b className={`tier-text-${ratingTier(p.form)}`}>{fmt(p.form, 1)}</b>
                            {(p.goals > 0 || p.assists > 0) && ` · ${p.goals}G ${p.assists}A`}
                            {p.mvp > 0 && ` · ⭐${p.mvp}`}
                          </span>
                        </div>
                        <b className={`dash-pill dash-pill-lg tier-bg-${ratingTier(p.avg)}`}>{fmt(p.avg, 2)}</b>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            <div className="dash-two-col">
              {/* Distribución de notas */}
              <section className="dash-card">
                <div className="dash-card-head">
                  <h2>Distribución de notas</h2>
                  <span className="dash-muted">{summary.ratingsCount} notas</span>
                </div>
                <div className="dash-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={summary.distribution} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8ec" />
                      <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={v => [v, 'Notas']} />
                      <Bar animationDuration={500} dataKey="cantidad" radius={[6, 6, 0, 0]}>
                        {summary.distribution.map(d => (
                          <Cell key={d.rango} className={`tier-fill-${ratingTier(d.min === 0 ? 3 : d.min)}`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Últimos partidos */}
              <section className="dash-card">
                <div className="dash-card-head">
                  <h2>Últimos partidos</h2>
                </div>
                <div className="dash-matches">
                  {matches.slice(0, 8).map(m => (
                    <div key={m.id} className="dash-match">
                      <span className={`dash-result result-${m.result}`} title={RESULT_LABELS[m.result]}>{RESULT_SHORT[m.result]}</span>
                      <div className="dash-match-main">
                        <span className="dash-match-rival">vs {m.rival} <b>{m.score}</b></span>
                        <span className="dash-match-meta">
                          {m.date} · {m.competition}
                          {m.best && <> · ⭐ <button className="dash-link" onClick={() => setSelectedId(m.best.id)}>{m.best.name}</button></>}
                        </span>
                      </div>
                      <b className={`dash-pill tier-bg-${ratingTier(m.teamAvg)}`} title="Promedio del equipo">{fmt(m.teamAvg, 1)}</b>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {showShare && (
          <SharePlayersModal
            players={visiblePlayers}
            sortBy={sortBy}
            sortDir={sortDir}
            club={club}
            filtersLabel={filtersLabel}
            onClose={closeShare}
          />
        )}

        {selectedPlayer && (
          <PlayerDetail
            player={selectedPlayer}
            rank={selectedRank || null}
            totalRanked={avgRanking.length}
            color={color}
            onClose={closeDetail}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
