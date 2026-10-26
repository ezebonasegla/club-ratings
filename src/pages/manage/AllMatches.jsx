import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader, Star, AlertTriangle } from 'lucide-react';
import { fetchTeamEventsPage, fetchMatchGoals, eventUrl, extractMatchId } from '../../services/sofascoreService';
import {
  getAttendance, saveAttendance, deleteAttendance, buildAttendanceFromEvent, attendanceId, ratingIsoDate,
} from '../../services/attendanceService';
import { hasValidRating } from '../../services/cloudStorageService';
import { ratingTier, fmt } from '../dashboard/stats';
import './AllMatches.css';

const PAGE_SIZE = 20;
const FILTERS = [
  ['all', 'Todos'],
  ['unrated', 'Sin valorar'],
  ['attended', '🏟️ Fui'],
  ['notattended', 'No fui'],
];

const pad = n => String(n).padStart(2, '0');
const isoOfEvent = e => { const d = new Date(e.startTimestamp * 1000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtDate = iso => new Date(`${iso}T12:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Todos los partidos del club (desde Sofascore), valorados o no, para marcar
 * de forma masiva a cuáles fue a la cancha y ver cuáles falta valorar.
 */
const AllMatches = ({ user, club, clubId, ratings }) => {
  const navigate = useNavigate();
  const teamId = club?.sofascoreId;

  const [events, setEvents] = useState([]);
  const [nextSofaPage, setNextSofaPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [attendanceError, setAttendanceError] = useState('');
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState({}); // fecha -> true mientras se guarda
  const [bulkProgress, setBulkProgress] = useState(null);

  // Valoraciones por id de Sofascore y por fecha
  const ratingIndex = useMemo(() => {
    const byMatch = new Map();
    const byDate = new Map();
    ratings.forEach(r => {
      const notes = (r.players || []).filter(p => hasValidRating(p.rating)).map(p => parseFloat(p.rating));
      const info = { id: r.id, avg: notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null };
      const mid = r.matchId || extractMatchId(r.matchInfo?.matchUrl || '');
      if (mid) byMatch.set(String(mid), info);
      const iso = ratingIsoDate(r);
      if (iso) byDate.set(iso, info);
    });
    return { byMatch, byDate };
  }, [ratings]);

  const attendanceByDate = useMemo(() => new Map(attendance.map(a => [a.fecha, a])), [attendance]);

  const rows = useMemo(() => events.map(e => {
    const fecha = isoOfEvent(e);
    const isHome = e.homeTeam?.id === teamId;
    const us = (isHome ? e.homeScore : e.awayScore)?.display;
    const them = (isHome ? e.awayScore : e.homeScore)?.display;
    return {
      event: e,
      fecha,
      isHome,
      rival: (isHome ? e.awayTeam : e.homeTeam)?.name || 'Rival',
      gf: us,
      gc: them,
      res: us > them ? 'G' : us < them ? 'P' : 'E',
      comp: e.tournament?.uniqueTournament?.name || e.tournament?.name || '',
      round: e.roundInfo?.name || (e.roundInfo?.round ? `Fecha ${e.roundInfo.round}` : ''),
      rating: ratingIndex.byMatch.get(String(e.id)) || ratingIndex.byDate.get(fecha) || null,
      attendance: attendanceByDate.get(fecha) || null,
    };
  }), [events, teamId, ratingIndex, attendanceByDate]);

  const filtered = useMemo(() => rows.filter(r =>
    filter === 'all' ||
    (filter === 'unrated' && !r.rating) ||
    (filter === 'attended' && r.attendance) ||
    (filter === 'notattended' && !r.attendance)
  ), [rows, filter]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPagesLoaded = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Trae páginas de Sofascore hasta tener `needed` partidos (filtrados) o no haber más
  const ensureLoaded = useCallback(async (needed) => {
    if (!teamId) return;
    let sofaPage = nextSofaPage;
    let more = hasMore;
    let all = events;
    let fetched = 0;
    setLoadingEvents(true);
    setError('');
    try {
      while (more && fetched < 4) {
        const countFiltered = all.filter(e => {
          if (filter === 'all') return true;
          const fecha = isoOfEvent(e);
          const rated = ratingIndex.byMatch.has(String(e.id)) || ratingIndex.byDate.has(fecha);
          const att = attendanceByDate.has(fecha);
          return (filter === 'unrated' && !rated) || (filter === 'attended' && att) || (filter === 'notattended' && !att);
        }).length;
        if (countFiltered >= needed) break;
        const result = await fetchTeamEventsPage(teamId, sofaPage);
        const known = new Set(all.map(e => e.id));
        all = [...all, ...result.events.filter(e => !known.has(e.id))];
        more = result.hasNextPage && result.events.length > 0;
        sofaPage += 1;
        fetched += 1;
      }
      setEvents(all);
      setNextSofaPage(sofaPage);
      setHasMore(more);
    } catch (err) {
      console.error('Error cargando partidos:', err);
      setError(err.message || 'No se pudieron cargar los partidos de Sofascore');
    } finally {
      setLoadingEvents(false);
    }
  }, [teamId, nextSofaPage, hasMore, events, filter, ratingIndex, attendanceByDate]);

  const loadAttendance = useCallback(async (force = false) => {
    const result = await getAttendance(user.uid, clubId, { force });
    setAttendance(result.data);
    setAttendanceError(result.success ? '' : result.error);
  }, [user, clubId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAttendance();
      ensureLoaded(PAGE_SIZE);
    }, 0);
    return () => clearTimeout(timer);
    // Sólo al montar / cambiar de club
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const goToPage = async (p) => {
    await ensureLoaded((p + 1) * PAGE_SIZE);
    setPage(p);
    document.querySelector('.allm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const changeFilter = async (f) => {
    setFilter(f);
    setPage(0);
  };

  // Al cambiar el filtro, asegurar que la primera página tenga partidos
  useEffect(() => {
    if (filtered.length < PAGE_SIZE && hasMore && !loadingEvents && events.length > 0) {
      const timer = setTimeout(() => ensureLoaded(PAGE_SIZE), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Marcar / desmarcar "Fui" (devuelve true si se aplicó)
  const setAttended = async (row, value, { confirmImported = true } = {}) => {
    if (!!row.attendance === value) return true;
    setBusy(b => ({ ...b, [row.fecha]: true }));
    try {
      if (value) {
        const goals = await fetchMatchGoals(row.event.id, row.isHome).catch(() => null);
        const entry = buildAttendanceFromEvent(row.event, teamId, attendance, goals);
        if (row.rating) entry.ratingId = row.rating.id;
        const r = await saveAttendance(user.uid, clubId, entry);
        if (!r.success) { alert(r.error); return false; }
        setAttendance(list => [...list.filter(a => a.fecha !== entry.fecha), { ...entry, id: attendanceId(user.uid, clubId, entry.fecha) }]);
      } else {
        const a = row.attendance;
        const hasData = a.source === 'import' || a.notas;
        if (confirmImported && hasData && !window.confirm(`El partido vs ${a.rival} (${fmtDate(a.fecha)}) tiene datos que cargaste. ¿Quitarlo de "Fui a la cancha"?`)) return false;
        const r = await deleteAttendance(user.uid, a.id);
        if (!r.success) { alert(r.error); return false; }
        setAttendance(list => list.filter(x => x.id !== a.id));
      }
      return true;
    } finally {
      setBusy(b => { const n = { ...b }; delete n[row.fecha]; return n; });
    }
  };

  const markPage = async (value) => {
    const targets = pageRows.filter(r => !!r.attendance !== value);
    if (!targets.length) return;
    if (!value && targets.some(r => r.attendance?.source === 'import' || r.attendance?.notas) &&
      !window.confirm(`Vas a quitar ${targets.length} partidos de "Fui a la cancha", algunos con datos que cargaste. ¿Seguir?`)) return;
    setBulkProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      await setAttended(targets[i], value, { confirmImported: false });
      setBulkProgress({ done: i + 1, total: targets.length });
    }
    setBulkProgress(null);
  };

  const pageStats = {
    unrated: pageRows.filter(r => !r.rating).length,
    attended: pageRows.filter(r => r.attendance).length,
  };
  const canNext = (page + 1) * PAGE_SIZE < filtered.length || hasMore;

  if (!teamId) {
    return <p className="allm-empty">Este club no tiene ID de Sofascore configurado.</p>;
  }

  return (
    <section className="allm">
      <div className="allm-head">
        <p className="allm-help">
          Todos los partidos de {club?.name}, los hayas valorado o no. Tildá <b>Fui</b> en los que fuiste a la cancha.
        </p>
        <div className="allm-filters" role="group" aria-label="Filtrar partidos">
          {FILTERS.map(([k, l]) => (
            <button key={k} className={`allm-chip ${filter === k ? 'active' : ''}`} onClick={() => changeFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      {attendanceError && <p className="allm-error"><AlertTriangle size={16} /> {attendanceError}</p>}
      {error && <p className="allm-error"><AlertTriangle size={16} /> {error}</p>}

      <div className="allm-toolbar">
        <span className="allm-summary">
          {pageRows.length > 0
            ? <>En esta página: <b>{pageStats.unrated}</b> sin valorar · <b>{pageStats.attended}</b> en la cancha</>
            : loadingEvents ? 'Cargando partidos…' : 'No hay partidos con este filtro'}
        </span>
        <div className="allm-bulk">
          <button className="allm-btn" onClick={() => markPage(true)} disabled={!!bulkProgress || !pageRows.length}>Marcar página: Fui</button>
          <button className="allm-btn ghost" onClick={() => markPage(false)} disabled={!!bulkProgress || !pageRows.length}>No fui</button>
        </div>
      </div>
      {bulkProgress && (
        <div className="allm-progress">
          <span style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
          <small>Guardando {bulkProgress.done} de {bulkProgress.total}…</small>
        </div>
      )}

      <div className="allm-list">
        {pageRows.map(r => (
          <div key={r.event.id} className={`allm-row ${r.attendance ? 'is-attended' : ''}`}>
            <span className={`allm-res res-${r.res}`}>{r.res}</span>
            <div className="allm-main">
              <span className="allm-title">
                {r.isHome ? '' : '@ '}{r.rival} <b>{r.gf}-{r.gc}</b>
              </span>
              <span className="allm-meta">{fmtDate(r.fecha)} · {r.comp}{r.round && ` · ${r.round}`}</span>
              <span className="allm-status">
                {r.rating ? (
                  <span className="allm-rated">
                    <Star size={12} /> Valorado
                    {r.rating.avg !== null && <b className={`dash-pill tier-bg-${ratingTier(r.rating.avg)}`}>{fmt(r.rating.avg, 1)}</b>}
                  </span>
                ) : (
                  <button className="allm-rate" onClick={() => navigate('/', { state: { matchUrl: eventUrl(r.event) } })}>
                    Sin valorar · Valorar
                  </button>
                )}
              </span>
            </div>
            <label className={`allm-check ${r.attendance ? 'checked' : ''}`} title="Fui a la cancha">
              <input
                type="checkbox"
                checked={!!r.attendance}
                disabled={!!busy[r.fecha] || !!bulkProgress}
                onChange={e => setAttended(r, e.target.checked)}
              />
              <span className="allm-box">{busy[r.fecha] ? <Loader size={14} className="spinner" /> : r.attendance ? '✓' : ''}</span>
              <span className="allm-check-label">Fui</span>
            </label>
          </div>
        ))}
      </div>

      <nav className="allm-pager" aria-label="Páginas">
        <button className="allm-btn ghost" onClick={() => goToPage(page - 1)} disabled={page === 0 || loadingEvents}>
          <ChevronLeft size={16} /> Anterior
        </button>
        <span>Página {page + 1}{!hasMore && ` de ${totalPagesLoaded}`}</span>
        <button className="allm-btn ghost" onClick={() => goToPage(page + 1)} disabled={!canNext || loadingEvents}>
          {loadingEvents ? <Loader size={16} className="spinner" /> : <>Siguiente <ChevronRight size={16} /></>}
        </button>
      </nav>
    </section>
  );
};

export default AllMatches;
