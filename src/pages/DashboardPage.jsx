import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getAllRatingsFromCloud } from '../services/cloudStorageService';
import {
  getAttendance, ensureSeedImported, repairSeedOverwrites, fillRoundNumbers, updateAttendance, deleteAttendance, exportAttendance,
} from '../services/attendanceService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts';
import {
  Calendar, Search, Share2, ArrowDownWideNarrow, ArrowUpNarrowWide, Minus, Plus, X, Trophy, Flame, Target, Activity, Star, ChevronRight, SlidersHorizontal, Copy, Check, AlertTriangle,
} from 'lucide-react';
import {
  POSITIONS, RESULT_LABELS, RESULT_SHORT, SORT_OPTIONS, filterMatches, teamSummary, buildPlayers,
  sortPlayers, ratingTier, fmt, fmtSigned, chartColor,
} from './dashboard/stats';
import PlayerDetail from './dashboard/PlayerDetail';
import SharePlayersModal from './dashboard/SharePlayersModal';
import { unifyMatches } from './dashboard/unify';
import { ResBadge, ScorerBars, GroupRows, MiniMatches, ScorerTable, MatchList } from './dashboard/sections';
import { RES_COLOR, fmtDate, stats, ranking, streaks, groupBy, byYear } from './cancha/canchaStats';
import MatchForm from './cancha/MatchForm';
import './DashboardPage.css';
import './CanchaPage.css';

const RESULT_COLORS = { win: '#1e9e5a', draw: '#d9a400', loss: '#d64545' };
const DEFAULT_FILTERS = { period: 'all', competition: 'all', rival: 'all', dt: 'all', scorer: 'all', venue: 'all', result: 'all', attendance: 'all' };
const TABS = [['resumen', 'Resumen'], ['jugadores', 'Jugadores'], ['partidos', 'Partidos'], ['rivales', 'Rivales'], ['goleadores', 'Goleadores']];

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
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('resumen');
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const roundsChecked = useRef(false);

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
      if (reloadKey === 0) setLoading(true);
      // Carga inicial / reparación del registro de cancha (sólo hacen algo una vez)
      let force = reloadKey > 0;
      if (await ensureSeedImported(user, clubId)) force = true;
      if (await repairSeedOverwrites(user, clubId)) force = true;

      const [result, att] = await Promise.all([
        getAllRatingsFromCloud(user.uid, clubId, primaryClubId),
        getAttendance(user.uid, clubId, { force }),
      ]);
      if (cancelled) return;
      setAttendance(att.data);
      setAttendanceError(att.success ? '' : att.error);
      if (result.success) {
        setRatings(result.data);
        // Con muchos partidos valorados, por defecto exigir un mínimo para que el ranking sea representativo
        if (reloadKey === 0) setMinApps(result.data.length >= 10 ? 3 : 1);
        setError('');
      } else {
        setError('No se pudieron cargar tus valoraciones');
      }
      setLoading(false);

      // Una vez: completar los números de fecha desde Sofascore (en segundo plano)
      if (att.success && !roundsChecked.current) {
        roundsChecked.current = true;
        fillRoundNumbers(user, clubId, club?.sofascoreId, att.data)
          .then(n => { if (n > 0 && !cancelled) setReloadKey(k => k + 1); })
          .catch(err => console.error('No se pudieron completar los números de fecha:', err));
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user, clubId, primaryClubId, club?.sofascoreId, reloadKey]);

  // Todos los partidos: valorados + en la cancha (uno por fecha)
  const allMatches = useMemo(() => unifyMatches(ratings, attendance), [ratings, attendance]);
  const rivals = useMemo(() => [...new Set(allMatches.map(m => m.rival))].sort((a, b) => a.localeCompare(b, 'es')), [allMatches]);
  const dts = useMemo(() => [...new Set(allMatches.map(m => m.dt).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [allMatches]);
  const scorers = useMemo(() => [...new Set(allMatches.flatMap(m => (m.goles || []).filter(g => g.tipo !== 'autogol').map(g => g.jugador)))].sort((a, b) => a.localeCompare(b, 'es')), [allMatches]);
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
  const s = useMemo(() => stats(matches), [matches]);
  const chrono = useMemo(() => [...matches].reverse(), [matches]);
  const st = useMemo(() => streaks(chrono), [chrono]);
  const rankClub = useMemo(() => ranking(matches, 'club'), [matches]);
  const rankRival = useMemo(() => ranking(matches, 'rival'), [matches]);
  const ratedCount = useMemo(() => matches.filter(m => m.rated).length, [matches]);

  // En la cancha vs. no fui (sobre los partidos filtrados)
  const vsTv = useMemo(() => {
    const side = list => {
      const r = list.filter(m => m.rated && m.teamAvg !== null);
      return { ...stats(list), avg: r.length ? r.reduce((a, m) => a + m.teamAvg, 0) / r.length : null, rated: r.length };
    };
    return { cancha: side(matches.filter(m => m.attended)), tv: side(matches.filter(m => !m.attended)) };
  }, [matches]);
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
  const goFilter = (key, value) => {
    setFilters({ ...DEFAULT_FILTERS, [key]: value });
    setTab('partidos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditSave = async (entry) => {
    if (entry.fecha !== editing.fecha && attendance.some(a => a.fecha === entry.fecha) &&
      !window.confirm(`Ya hay un partido en la cancha el ${fmtDate(entry.fecha)}. ¿Reemplazarlo?`)) return;
    setSavingEdit(true);
    const r = await updateAttendance(user.uid, clubId, editing.id, entry);
    setSavingEdit(false);
    if (!r.success) { alert(r.error); return; }
    setEditing(null);
    setReloadKey(k => k + 1);
  };

  const handleDeleteAttendance = async (a) => {
    if (!window.confirm(`¿Quitar ${a.rival} ${a.gf}-${a.gc} (${fmtDate(a.fecha)}) de tus partidos en la cancha?`)) return;
    const r = await deleteAttendance(user.uid, a.id);
    if (!r.success) { alert(r.error); return; }
    setReloadKey(k => k + 1);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportAttendance(attendance));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
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
            <p>{error ? 'Probá recargar la página.' : 'Valorá tu primer partido (y tildá “Fui a la cancha” si fuiste) para empezar a ver estadísticas.'}</p>
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
    filters.rival !== 'all' ? `vs ${filters.rival}` : null,
    filters.dt !== 'all' ? `DT ${filters.dt}` : null,
    filters.scorer !== 'all' ? `Goles de ${filters.scorer}` : null,
    filters.venue === 'home' ? 'Local' : filters.venue === 'away' ? 'Visitante' : null,
    filters.result !== 'all' ? { win: 'Ganados', draw: 'Empates', loss: 'Perdidos' }[filters.result] : null,
    filters.attendance === 'yes' ? 'En la cancha' : filters.attendance === 'no' ? 'Sin ir a la cancha' : null,
    position !== 'all' ? POSITIONS[position]?.label + 's' : null,
    minApps > 1 ? `mín. ${minApps} partidos` : null,
    `${ratedCount} ${ratedCount === 1 ? 'partido valorado' : 'partidos valorados'}`,
  ].filter(Boolean).join(' · ');

  const kpiDelta = summary.recentAvg !== null && summary.teamAvg !== null && ratedCount > 5
    ? summary.recentAvg - summary.teamAvg
    : null;

  const selectField = (key, label, options, all) => (
    <label className="dash-field">
      <span>{label}</span>
      <select value={filters[key]} onChange={e => setFilter(key, e.target.value)}>
        <option value="all">{all}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="dash">
      <div className="dash-container">
        {/* Encabezado */}
        <header className="dash-header">
          <div>
            <h1 className="dash-title">Estadísticas</h1>
            <p className="dash-subtitle">
              {club?.name} · {s.pj} {s.pj === 1 ? 'partido' : 'partidos'}
              {matches.length !== allMatches.length && ` de ${allMatches.length}`}
              {` · ${matches.filter(m => m.attended).length} en la cancha`}
            </p>
          </div>
          <button
            className={`dash-filter-toggle ${activeFilterCount ? 'has-active' : ''}`}
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={18} />
            Filtros
            {activeFilterCount > 0 && <span className="dash-badge">{activeFilterCount}</span>}
          </button>
        </header>

        {/* Cancha: Todos / Fui / No fui (siempre a la vista) */}
        {attendance.length > 0 && (
          <Segmented
            label="Cancha"
            value={filters.attendance}
            onChange={v => setFilter('attendance', v)}
            options={[{ value: 'all', label: 'Todos los partidos' }, { value: 'yes', label: '🏟️ Fui' }, { value: 'no', label: '📺 No fui' }]}
          />
        )}

        {attendanceError && (
          <section className="dash-card cancha-error">
            <AlertTriangle size={22} />
            <div>
              <b>No se pudieron cargar tus partidos en la cancha</b>
              <p>{attendanceError}</p>
            </div>
          </section>
        )}

        {/* Filtros globales */}
        <section className={`dash-filters ${showFilters ? 'open' : ''}`} aria-label="Filtros de partidos">
          <label className="dash-field">
            <span>Período</span>
            <select value={filters.period} onChange={e => setFilter('period', e.target.value)}>
              {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {selectField('competition', 'Competición', competitions, 'Todas')}
          {selectField('rival', 'Rival', rivals, 'Todos')}
          {dts.length > 0 && selectField('dt', 'DT', dts, 'Todos')}
          {scorers.length > 0 && selectField('scorer', 'Goleador', scorers, 'Todos')}
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
              options={[{ value: 'all', label: 'Todos' }, { value: 'win', label: 'G' }, { value: 'draw', label: 'E' }, { value: 'loss', label: 'P' }]}
            />
          </div>
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
                <strong>{s.G}-{s.E}-{s.P}</strong>
                <div className="dash-record-bar" aria-hidden="true">
                  {['G', 'E', 'P'].map(k => s[k] > 0 && <span key={k} style={{ flex: s[k], background: RES_COLOR[k] }} />)}
                </div>
                <span>{s.pj} partidos · G · E · P</span>
              </div>
              <div className="dash-kpi">
                <small>Efectividad</small>
                <strong>{s.ef}%</strong>
                <span>Vallas invictas: {s.vi}</span>
              </div>
              <div className="dash-kpi">
                <small>Goles</small>
                <strong>{s.gf}<em>:</em>{s.gc}</strong>
                <span>Dif. {s.gf - s.gc > 0 ? '+' : ''}{s.gf - s.gc} · {s.pj ? (s.gf / s.pj).toFixed(2) : '–'} por partido</span>
              </div>
              <div className="dash-kpi">
                <small>Tus notas (promedio)</small>
                <strong className={`tier-text-${ratingTier(summary.teamAvg)}`}>{fmt(summary.teamAvg, 2)}</strong>
                {kpiDelta !== null ? (
                  <span className={kpiDelta >= 0 ? 'up' : 'down'}>
                    Últimos 5: {fmt(summary.recentAvg, 2)} ({fmtSigned(kpiDelta, 2)})
                  </span>
                ) : (
                  <span>{ratedCount} {ratedCount === 1 ? 'partido valorado' : 'partidos valorados'}</span>
                )}
              </div>
            </section>

            <div className="dash-chips cancha-tabs" role="tablist">
              {TABS.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={`dash-chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === 'resumen' && (
              <>
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


                <div className="dash-two-col">
                  <section className="dash-card">
                    <div className="dash-card-head"><h2>Partidos por año</h2></div>
                    <div className="dash-chart">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={byYear(matches)} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8ec" />
                          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v, n) => [v, { G: 'Ganados', E: 'Empatados', P: 'Perdidos' }[n]]} />
                          <Bar dataKey="G" stackId="r" fill={RES_COLOR.G} animationDuration={500} />
                          <Bar dataKey="E" stackId="r" fill={RES_COLOR.E} animationDuration={500} />
                          <Bar dataKey="P" stackId="r" fill={RES_COLOR.P} radius={[6, 6, 0, 0]} animationDuration={500} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="dash-card">
                    <div className="dash-card-head"><h2>Últimos partidos</h2></div>
                    <div className="cancha-form-dots">
                      {chrono.slice(-15).map(p => (
                        <span key={p.fecha} title={`${fmtDate(p.fecha)} · ${p.rival} ${p.gf}-${p.gc}${p.attended ? ' · 🏟️' : ''}`}><ResBadge p={p} /></span>
                      ))}
                    </div>
                    {[
                      ['Racha actual invicto', st.currentUnbeaten],
                      ['Mejor racha de victorias', st.bestWins],
                      ['Mejor racha invicto', st.bestUnbeaten],
                      ['Peor racha sin ganar', st.worstNoWin],
                      ['Último partido', matches[0] ? `${fmtDate(matches[0].fecha)} · ${matches[0].rival} ${matches[0].gf}-${matches[0].gc}` : '–'],
                    ].map(([a, b]) => (
                      <div key={a} className="cancha-row"><span className="dash-muted">{a}</span><b>{b}</b></div>
                    ))}
                  </section>
                </div>

                {filters.attendance === 'all' && vsTv.cancha.pj > 0 && vsTv.tv.pj > 0 && (
                  <section className="dash-card">
                    <div className="dash-card-head">
                      <h2>En la cancha vs. sin ir</h2>
                      <span className="dash-muted">Con los filtros actuales</span>
                    </div>
                    <div className="cancha-vs">
                      {[['cancha', '🏟️ Fui a la cancha'], ['tv', '📺 No fui']].map(([k, label]) => {
                        const g = vsTv[k];
                        return (
                          <button key={k} className="cancha-vs-col" onClick={() => setFilter('attendance', k === 'cancha' ? 'yes' : 'no')}>
                            <small>{label}</small>
                            <span><b>{g.G}-{g.E}-{g.P}</b> · {g.ef}% · {g.pj} {g.pj === 1 ? 'partido' : 'partidos'}</span>
                            <span>Goles {g.gf}-{g.gc}</span>
                            {g.avg !== null
                              ? <span>Tus notas: <b className={`dash-pill tier-bg-${ratingTier(g.avg)}`}>{fmt(g.avg, 2)}</b></span>
                              : <span>Sin partidos valorados</span>}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                <div className="dash-two-col">
                  <section className="dash-card"><div className="dash-card-head"><h2>Top goleadores</h2></div><ScorerBars items={rankClub.list.slice(0, 6)} /></section>
                  <section className="dash-card"><div className="dash-card-head"><h2>Los que más nos hicieron</h2></div><ScorerBars items={rankRival.list.slice(0, 6)} rival /></section>
                  {dts.length > 0 && (
                    <section className="dash-card"><div className="dash-card-head"><h2>Por DT</h2></div><GroupRows groups={groupBy(matches, 'dt')} onSelect={v => v !== 'Sin dato' && goFilter('dt', v)} /></section>
                  )}
                  <section className="dash-card"><div className="dash-card-head"><h2>Por competencia</h2></div><GroupRows groups={groupBy(matches, 'competition')} onSelect={v => goFilter('competition', v)} /></section>
                  <section className="dash-card">
                    <div className="dash-card-head"><h2>Mejores goleadas</h2></div>
                    <MiniMatches list={matches.filter(p => p.gf > p.gc).sort((a, b) => (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf).slice(0, 5)} />
                  </section>
                  <section className="dash-card">
                    <div className="dash-card-head"><h2>Peores derrotas</h2></div>
                    <MiniMatches list={matches.filter(p => p.gf < p.gc).sort((a, b) => (b.gc - b.gf) - (a.gc - a.gf)).slice(0, 5)} />
                  </section>
                </div>

                {summary.ratingsCount > 0 && (
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


                  </div>
                )}
              </>
            )}

            {tab === 'jugadores' && (
              <>
                {ratedCount === 0 && <div className="dash-empty"><h2>No valoraste partidos con estos filtros</h2></div>}
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

              </>
            )}

            {tab === 'partidos' && (
              <section className="dash-card">
                <div className="dash-card-head">
                  <div>
                    <h2>Partidos</h2>
                    <span className="dash-muted">{matches.length} · los de la cancha se agregan solos al tildar “Fui a la cancha”</span>
                  </div>
                  {attendance.length > 0 && (
                    <button className="dash-chip" onClick={handleCopy}>
                      {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar datos</>}
                    </button>
                  )}
                </div>
                <MatchList list={matches} onEdit={setEditing} onDelete={handleDeleteAttendance} onPlayer={setSelectedId} />
              </section>
            )}

            {tab === 'rivales' && (
              <section className="dash-card">
                <div className="dash-card-head"><h2>Rivales</h2><span className="dash-muted">Tocá uno para ver sus partidos</span></div>
                <GroupRows groups={groupBy(matches, 'rival')} onSelect={v => goFilter('rival', v)} />
              </section>
            )}

            {tab === 'goleadores' && (
              <>
                <ScorerTable ranking={rankClub} clubName={club?.shortName || club?.name} onSelect={v => goFilter('scorer', v)} />
                <ScorerTable ranking={rankRival} rival clubName={club?.shortName || club?.name} />
              </>
            )}
          </>
        )}

        {editing && (
          <MatchForm
            entry={editing}
            all={attendance}
            clubName={club?.shortName || club?.name}
            saving={savingEdit}
            onSave={handleEditSave}
            onClose={() => setEditing(null)}
          />
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
