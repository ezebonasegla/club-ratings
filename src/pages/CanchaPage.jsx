import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  getAttendance, updateAttendance, deleteAttendance, exportAttendance, ratingIsoDate, ensureSeedImported,
  repairSeedOverwrites, fillRoundNumbers,
} from '../services/attendanceService';
import { getAllRatingsFromCloud, hasValidRating } from '../services/cloudStorageService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Copy, Check, SlidersHorizontal, X, Search, Pencil, Trash2, StickyNote, Ticket, AlertTriangle } from 'lucide-react';
import {
  res, hasPen, penWon, RES_COLOR, fmtDate, uniq, EMPTY_FILTERS, filterMatches, stats, ranking, streaks, groupBy, byYear, goalList,
} from './cancha/canchaStats';
import { ratingTier, fmt } from './dashboard/stats';
import MatchForm from './cancha/MatchForm';
import './DashboardPage.css';
import './CanchaPage.css';

const TABS = [
  ['resumen', 'Resumen'],
  ['partidos', 'Partidos'],
  ['rivales', 'Rivales'],
  ['goleadores', 'Goleadores'],
  ['encontra', 'Goles en contra'],
];

const ResBadge = ({ p }) => (
  <span className="cancha-res" style={{ background: RES_COLOR[res(p)] }} title={hasPen(p) ? `${penWon(p) ? 'Ganó' : 'Perdió'} por penales` : undefined}>
    {res(p)}
    {hasPen(p) && <i style={{ background: penWon(p) ? RES_COLOR.G : RES_COLOR.P }} />}
  </span>
);

const PenTag = ({ p }) => hasPen(p) ? (
  <span className={`cancha-tag ${penWon(p) ? 'up' : 'down'}`}>
    {penWon(p) ? 'Ganó' : 'Perdió'} {p.penales.club}-{p.penales.rival} pen.
  </span>
) : null;

const RecordBar = ({ s }) => (
  <div className="cancha-bar">
    {['G', 'E', 'P'].map(k => s[k] > 0 && <span key={k} style={{ flex: s[k], background: RES_COLOR[k] }} />)}
  </div>
);

const CanchaPage = () => {
  const { user } = useAuth();
  const { club, clubId, primaryClubId } = useTheme();
  const clubName = club?.shortName || club?.name || 'Mi club';

  const [list, setList] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('resumen');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [editing, setEditing] = useState(null); // partido que se está corrigiendo
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const roundsChecked = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (force = false) => {
    if (!user || !clubId) return;
    if (await ensureSeedImported(user, clubId)) force = true;
    if (await repairSeedOverwrites(user, clubId)) force = true;
    const [att, rat] = await Promise.all([
      getAttendance(user.uid, clubId, { force }),
      getAllRatingsFromCloud(user.uid, clubId, primaryClubId),
    ]);
    setList(att.data);
    setError(att.success ? '' : att.error);
    setRatings(rat.success ? rat.data : []);
    setLoading(false);

    // Una vez: completar los números de fecha desde Sofascore (en segundo plano)
    if (att.success && !roundsChecked.current) {
      roundsChecked.current = true;
      fillRoundNumbers(user, clubId, club?.sofascoreId, att.data)
        .then(n => { if (n > 0) setReloadKey(k => k + 1); })
        .catch(error => console.error('No se pudieron completar los números de fecha:', error));
    }
  }, [user, clubId, primaryClubId, club?.sofascoreId]);

  useEffect(() => {
    // Diferido para no actualizar estado de forma síncrona dentro del efecto
    const timer = setTimeout(() => load(reloadKey > 0), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  // Valoraciones por fecha, con el promedio del equipo
  const ratingByDate = useMemo(() => {
    const m = new Map();
    ratings.forEach(r => {
      const iso = ratingIsoDate(r);
      if (!iso) return;
      const notes = (r.players || []).filter(p => hasValidRating(p.rating)).map(p => parseFloat(p.rating));
      m.set(iso, { id: r.id, avg: notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null, result: r.matchInfo?.result });
    });
    return m;
  }, [ratings]);

  const filtered = useMemo(() => filterMatches(list, filters), [list, filters]);
  const chrono = useMemo(() => [...filtered].sort((a, b) => a.fecha.localeCompare(b.fecha)), [filtered]);
  const s = useMemo(() => stats(filtered), [filtered]);
  const rankClub = useMemo(() => ranking(filtered, 'club'), [filtered]);
  const rankRival = useMemo(() => ranking(filtered, 'rival'), [filtered]);
  const st = useMemo(() => streaks(chrono), [chrono]);

  // Club Ratings: cuando fui vs cuando no fui (sólo partidos valorados)
  const vsTv = useMemo(() => {
    if (!ratings.length) return null;
    const dates = new Set(list.map(a => a.fecha));
    const groups = { cancha: [], tv: [] };
    ratingByDate.forEach((r, iso) => groups[dates.has(iso) ? 'cancha' : 'tv'].push(r));
    const summary = g => {
      const avgs = g.map(r => r.avg).filter(x => x !== null);
      const rec = { win: 0, draw: 0, loss: 0 };
      g.forEach(r => { if (rec[r.result] !== undefined) rec[r.result]++; });
      return {
        n: g.length,
        avg: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null,
        rec,
        ef: g.length ? Math.round(((rec.win * 3 + rec.draw) / (g.length * 3)) * 100) : 0,
      };
    };
    return { cancha: summary(groups.cancha), tv: summary(groups.tv) };
  }, [ratings, list, ratingByDate]);

  const options = useMemo(() => ({
    year: uniq(list, p => p.fecha.slice(0, 4)).reverse(),
    comp: uniq(list, p => p.comp),
    dt: uniq(list, p => p.dt),
    rival: uniq(list, p => p.rival),
    estadio: uniq(list, p => p.estadio),
    scorer: uniq(list, p => (p.goles || []).filter(g => g.tipo !== 'autogol').map(g => g.jugador)),
  }), [list]);

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const activeFilters = Object.keys(EMPTY_FILTERS).filter(k => filters[k]).length;
  const goFilter = (k, v) => { setFilters({ ...EMPTY_FILTERS, [k]: v }); setTab('partidos'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleSave = async (entry) => {
    if (entry.fecha !== editing.fecha && list.some(a => a.fecha === entry.fecha) &&
      !window.confirm(`Ya hay un partido cargado el ${fmtDate(entry.fecha)}. ¿Reemplazarlo?`)) return;
    setSaving(true);
    const r = await updateAttendance(user.uid, clubId, editing.id, entry);
    setSaving(false);
    if (!r.success) { alert(r.error); return; }
    setEditing(null);
    load(true);
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Borrar ${clubName} ${p.gf}-${p.gc} ${p.rival} (${fmtDate(p.fecha)})?`)) return;
    const r = await deleteAttendance(user.uid, p.id);
    if (!r.success) { alert(r.error); return; }
    load(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportAttendance(list));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="dash"><div className="dash-container">
        <div className="dash-skeleton dash-skeleton-title" />
        <div className="dash-kpis">{[0, 1, 2, 3].map(i => <div key={i} className="dash-skeleton dash-skeleton-card" />)}</div>
      </div></div>
    );
  }

  const top = rankClub.list[0];
  const sortedMatches = sortDesc ? [...chrono].reverse() : chrono;

  const scorerList = (items, rival) => {
    const max = Math.max(1, ...items.map(r => r.goles));
    return items.length ? items.map(r => (
      <div key={r.jugador} className="cancha-row">
        <span className="cancha-row-main">
          <b>{r.jugador}</b>
          {rival && <small>{r.rivales.join(', ')}</small>}
        </span>
        <div className="cancha-meter"><span style={{ width: `${(r.goles / max) * 100}%`, background: rival ? RES_COLOR.P : 'var(--primary-color)' }} /></div>
        <b className="cancha-num">{r.goles}</b>
      </div>
    )) : <p className="dash-muted">—</p>;
  };

  const groupList = (groups, filterKey) => groups.map(g => (
    <button key={g.name} className="cancha-row cancha-row-btn" onClick={() => filterKey && goFilter(filterKey, g.name)}>
      <span className="cancha-row-main"><b>{g.name}</b><small>{g.pj} PJ · {g.G}-{g.E}-{g.P} · {g.ef}%</small></span>
      <RecordBar s={g} />
    </button>
  ));

  const miniMatches = ps => ps.length ? ps.map(p => (
    <div key={p.id} className="cancha-row">
      <span className="cancha-row-main"><b>{p.rival}</b><small>{fmtDate(p.fecha)}</small></span>
      <b className="cancha-score">{p.gf}-{p.gc}</b>
    </div>
  )) : <p className="dash-muted">—</p>;

  const scorerTable = (r, rival) => (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2>{rival ? 'Goles en contra' : `Goles de ${clubName} que viste`}</h2>
        <span className="dash-muted">{rival ? 'Quiénes nos hicieron goles' : 'Tocá un jugador para ver sus partidos'}</span>
      </div>
      {r.list.length === 0 ? <p className="dash-muted">Sin goles en los partidos filtrados</p> : (
        <div className="cancha-scorers">
          {r.list.map((g, i) => (
            <button key={g.jugador} className="cancha-scorer" onClick={() => !rival && goFilter('scorer', g.jugador)} disabled={rival}>
              <span className="dash-rank">{i + 1}</span>
              <span className="cancha-row-main">
                <b>{g.jugador}</b>
                <small>
                  {g.pj} {g.pj === 1 ? 'partido' : 'partidos'} con gol{g.pen ? ` · ${g.pen} de penal` : ''}
                  {rival ? ` · ${g.rivales.join(', ')}` : ''} · último {fmtDate(g.ult, { day: '2-digit', month: 'short', year: '2-digit' })}
                </small>
              </span>
              <b className="cancha-num">{g.goles}</b>
            </button>
          ))}
        </div>
      )}
      {r.og.length > 0 && (
        <>
          <h3 className="cancha-sub">{rival ? `Autogoles de ${clubName}` : 'Autogoles a favor'} ({r.og.reduce((a, x) => a + x.goles, 0)})</h3>
          {r.og.map(o => (
            <div key={o.jugador} className="cancha-row">
              <span className="cancha-row-main"><b>{o.jugador}</b><small>{o.rivales.join(', ')}</small></span>
              <b className="cancha-num">{o.goles}</b>
            </div>
          ))}
        </>
      )}
    </section>
  );

  return (
    <div className="dash cancha">
      <div className="dash-container">
        <header className="dash-header">
          <div>
            <h1 className="dash-title">En la cancha</h1>
            <p className="dash-subtitle">
              {club?.name} · {s.pj} {s.pj === 1 ? 'partido' : 'partidos'}{filtered.length !== list.length && ` de ${list.length}`}
            </p>
          </div>
          {list.length > 0 && (
            <button className={`dash-filter-toggle ${activeFilters ? 'has-active' : ''}`} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>
              <SlidersHorizontal size={18} /> Filtros
              {activeFilters > 0 && <span className="dash-badge">{activeFilters}</span>}
            </button>
          )}
        </header>

        {list.length > 0 && (
          <div className="cancha-actions">
            <span className="dash-muted">Se agregan solos cuando valorás un partido y tildás “Fui a la cancha”.</span>
            <button className="dash-chip" onClick={handleCopy}>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar datos</>}
            </button>
          </div>
        )}

        {error && (
          <section className="dash-card cancha-error">
            <AlertTriangle size={22} />
            <div>
              <b>No se pudo acceder a tus partidos en la cancha</b>
              <p>{error}</p>
              <p className="dash-muted">Firebase Console → Firestore Database → Reglas → pegá el contenido de <code>firestore.rules</code> → Publicar.</p>
            </div>
          </section>
        )}

        {!error && list.length === 0 && (
          <div className="dash-empty">
            <Ticket size={52} />
            <h2>Todavía no cargaste partidos en la cancha</h2>
            <p>Cuando valores un partido, tildá “Fui a la cancha” y se agrega solo acá, con resultado, goles y estadio.</p>
          </div>
        )}

        {list.length > 0 && (
          <>
            <section className={`dash-filters cancha-filters ${showFilters ? 'open' : ''}`} aria-label="Filtros">
              <label className="dash-field cancha-search">
                <span>Buscar</span>
                <div className="dash-search">
                  <Search size={16} />
                  <input type="search" placeholder="Rival, jugador, estadio…" value={filters.q} onChange={e => setFilter('q', e.target.value)} />
                </div>
              </label>
              {[['year', 'Año', 'Todos'], ['comp', 'Competencia', 'Todas'], ['dt', 'DT', 'Todos'], ['rival', 'Rival', 'Todos'], ['estadio', 'Estadio', 'Todos'], ['scorer', 'Goleador', 'Todos']].map(([k, label, all]) => (
                <label key={k} className="dash-field">
                  <span>{label}</span>
                  <select value={filters[k]} onChange={e => setFilter(k, e.target.value)}>
                    <option value="">{all}</option>
                    {options[k].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              ))}
              <div className="dash-field">
                <span>Resultado</span>
                <div className="dash-segmented">
                  {[['', 'Todos'], ['G', 'G'], ['E', 'E'], ['P', 'P']].map(([v, l]) => (
                    <button key={l} className={filters.result === v ? 'active' : ''} onClick={() => setFilter('result', v)}>{l}</button>
                  ))}
                </div>
              </div>
              {activeFilters > 0 && <button className="dash-clear" onClick={() => setFilters(EMPTY_FILTERS)}><X size={14} /> Limpiar filtros</button>}
            </section>

            <section className="dash-kpis cancha-kpis">
              <div className="dash-kpi">
                <small>Récord</small>
                <strong>{s.G}-{s.E}-{s.P}</strong>
                <RecordBar s={s} />
                <span>{s.pj} partidos</span>
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
                <small>Goleador</small>
                <strong className="cancha-kpi-name">{top ? top.jugador : '—'}</strong>
                <span>{top ? `${top.goles} goles` : ''}{filtered.some(hasPen) ? ` · Penales ${filtered.filter(penWon).length}-${filtered.filter(p => hasPen(p) && !penWon(p)).length}` : ''}</span>
              </div>
            </section>

            <div className="dash-chips cancha-tabs" role="tablist">
              {TABS.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={`dash-chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="dash-empty">
                <h2>Ningún partido coincide con los filtros</h2>
                <button className="dash-clear" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</button>
              </div>
            )}

            {filtered.length > 0 && tab === 'resumen' && (
              <>
                <div className="dash-two-col">
                  <section className="dash-card">
                    <div className="dash-card-head"><h2>Partidos por año</h2></div>
                    <div className="dash-chart">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={byYear(filtered)} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
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
                        <span key={p.id} title={`${fmtDate(p.fecha)} · ${p.rival} ${p.gf}-${p.gc}`}><ResBadge p={p} /></span>
                      ))}
                    </div>
                    {[
                      ['Racha actual invicto', st.currentUnbeaten],
                      ['Mejor racha de victorias', st.bestWins],
                      ['Mejor racha invicto', st.bestUnbeaten],
                      ['Peor racha sin ganar', st.worstNoWin],
                      ['Último partido', chrono.length ? `${fmtDate(chrono.at(-1).fecha)} · ${chrono.at(-1).rival} ${chrono.at(-1).gf}-${chrono.at(-1).gc}` : '–'],
                    ].map(([a, b]) => (
                      <div key={a} className="cancha-row"><span className="dash-muted">{a}</span><b>{b}</b></div>
                    ))}
                  </section>
                </div>

                {vsTv && (vsTv.cancha.n > 0 || vsTv.tv.n > 0) && (
                  <section className="dash-card">
                    <div className="dash-card-head">
                      <h2>En la cancha vs. por TV</h2>
                      <span className="dash-muted">Partidos que valoraste en Club Ratings</span>
                    </div>
                    <div className="cancha-vs">
                      {[['cancha', '🏟️ Fui a la cancha'], ['tv', '📺 No fui']].map(([k, label]) => {
                        const g = vsTv[k];
                        return (
                          <div key={k} className="cancha-vs-col">
                            <small>{label}</small>
                            <b className={`dash-pill dash-pill-lg tier-bg-${ratingTier(g.avg)}`}>{fmt(g.avg, 2)}</b>
                            <span>Promedio de tus notas</span>
                            <span><b>{g.rec.win}-{g.rec.draw}-{g.rec.loss}</b> · {g.ef}% · {g.n} {g.n === 1 ? 'partido' : 'partidos'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <div className="dash-two-col">
                  <section className="dash-card"><div className="dash-card-head"><h2>Top goleadores</h2></div>{scorerList(rankClub.list.slice(0, 6))}</section>
                  <section className="dash-card"><div className="dash-card-head"><h2>Los que más nos hicieron</h2></div>{scorerList(rankRival.list.slice(0, 6), true)}</section>
                  <section className="dash-card"><div className="dash-card-head"><h2>Por DT</h2></div>{groupList(groupBy(filtered, 'dt'), 'dt')}</section>
                  <section className="dash-card"><div className="dash-card-head"><h2>Por competencia</h2></div>{groupList(groupBy(filtered, 'comp'), 'comp')}</section>
                  <section className="dash-card">
                    <div className="dash-card-head"><h2>Mejores goleadas</h2></div>
                    {miniMatches(filtered.filter(p => p.gf > p.gc).sort((a, b) => (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf).slice(0, 5))}
                  </section>
                  <section className="dash-card">
                    <div className="dash-card-head"><h2>Peores derrotas</h2></div>
                    {miniMatches(filtered.filter(p => p.gf < p.gc).sort((a, b) => (b.gc - b.gf) - (a.gc - a.gf)).slice(0, 5))}
                  </section>
                </div>
              </>
            )}

            {filtered.length > 0 && tab === 'partidos' && (
              <section className="dash-card">
                <div className="dash-card-head">
                  <h2>Partidos</h2>
                  <button className="dash-chip" onClick={() => setSortDesc(v => !v)}>{sortDesc ? 'Más recientes primero' : 'Más antiguos primero'}</button>
                </div>
                <div className="cancha-matches">
                  {sortedMatches.map(p => {
                    const rated = ratingByDate.get(p.fecha);
                    const missing = (p.goles || []).length !== p.gf || (p.golesRival || []).length !== p.gc;
                    return (
                      <article key={p.id} className="cancha-match">
                        <ResBadge p={p} />
                        <div className="cancha-match-main">
                          <div className="cancha-match-top">
                            <b>{p.rival}</b>
                            <span className="cancha-score">{p.gf}-{p.gc}</span>
                            <PenTag p={p} />
                          </div>
                          <span className="cancha-meta">
                            {fmtDate(p.fecha)}{p.comp && ` · ${p.comp}`}{p.ronda && ` · ${p.ronda}`}
                          </span>
                          <span className="cancha-meta">{[p.estadio, p.dt && `DT ${p.dt}`].filter(Boolean).join(' · ')}</span>
                          {(p.goles || []).length > 0 && <span className="cancha-goal-line">⚽ {goalList(p.goles)}</span>}
                          {(p.golesRival || []).length > 0 && <span className="cancha-goal-line rival">{goalList(p.golesRival)}</span>}
                          {missing && <span className="cancha-tag down">faltan goles</span>}
                          {p.notas && <span className="cancha-notes"><StickyNote size={12} /> {p.notas}</span>}
                        </div>
                        <div className="cancha-match-side">
                          {rated && rated.avg !== null && (
                            <b className={`dash-pill tier-bg-${ratingTier(rated.avg)}`} title="Promedio de tus notas en Club Ratings">{fmt(rated.avg, 1)}</b>
                          )}
                          <div className="cancha-match-actions">
                            <button className="dash-icon-btn" onClick={() => setEditing(p)} aria-label="Editar"><Pencil size={15} /></button>
                            <button className="dash-icon-btn" onClick={() => handleDelete(p)} aria-label="Borrar"><Trash2 size={15} /></button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {filtered.length > 0 && tab === 'rivales' && (
              <section className="dash-card">
                <div className="dash-card-head"><h2>Rivales</h2><span className="dash-muted">Tocá uno para ver sus partidos</span></div>
                {groupBy(filtered, 'rival').map(g => (
                  <button key={g.name} className="cancha-row cancha-row-btn" onClick={() => goFilter('rival', g.name)}>
                    <span className="cancha-row-main">
                      <b>{g.name}</b>
                      <small>{g.pj} PJ · {g.G}-{g.E}-{g.P} · goles {g.gf}-{g.gc} · {g.ef}%</small>
                    </span>
                    <RecordBar s={g} />
                  </button>
                ))}
              </section>
            )}

            {filtered.length > 0 && tab === 'goleadores' && scorerTable(rankClub, false)}
            {filtered.length > 0 && tab === 'encontra' && scorerTable(rankRival, true)}
          </>
        )}

        {editing && (
          <MatchForm
            entry={editing}
            all={list}
            clubName={clubName}
            saving={saving}
            onSave={handleSave}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    </div>
  );
};

export default CanchaPage;
