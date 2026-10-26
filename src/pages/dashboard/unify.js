/**
 * Une las valoraciones y los partidos en la cancha en una sola lista de partidos
 * (uno por fecha), con los campos que usan las estadísticas del Dashboard y del
 * registro de cancha.
 */
import { buildMatches } from './stats';
import { matchExistingName, competitionFor } from '../../services/attendanceService';

const pad = n => String(n).padStart(2, '0');
export const isoOf = time => { const d = new Date(time); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const displayDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d}/${m}/${y}`; };
const resultOf = (gf, gc, fallback) => (gf == null || gc == null ? fallback || 'draw' : gf > gc ? 'win' : gf < gc ? 'loss' : 'draw');

// Goles de la valoración (sólo propios: Sofascore no trae goleadores rivales en la valoración vieja)
const goalsFromRating = raw => (raw?.players || []).flatMap(p => Array.from({ length: p.goals || 0 }, () => ({ jugador: p.name, tipo: 'gol' })));

export const unifyMatches = (ratings, attendance) => {
  const rawById = new Map(ratings.map(r => [r.id, r]));
  const attByDate = new Map(attendance.map(a => [a.fecha, a]));
  const rivalNames = [...new Set(attendance.map(a => a.rival).filter(Boolean))];
  const compNames = [...new Set(attendance.map(a => a.comp).filter(Boolean))];

  // Estadio de local = el más frecuente en el registro (para inferir local/visitante)
  const stadiumCount = {};
  attendance.forEach(a => { if (a.estadio) stadiumCount[a.estadio] = (stadiumCount[a.estadio] || 0) + 1; });
  const homeStadium = Object.entries(stadiumCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const byDate = new Map();

  buildMatches(ratings).forEach(m => {
    const iso = isoOf(m.time);
    const a = attByDate.get(iso);
    const raw = rawById.get(m.id);
    const gf = a ? a.gf : m.goalsFor;
    const gc = a ? a.gc : m.goalsAgainst;
    byDate.set(iso, {
      ...m,
      fecha: iso,
      date: m.date || displayDate(iso),
      rival: a?.rival || matchExistingName(m.rival, rivalNames),
      comp: a?.comp || competitionFor({ competition: m.competition, competitionDetail: raw?.matchInfo?.competitionDetail }, compNames),
      ronda: a?.ronda || (raw?.matchInfo?.round ? `Fecha ${raw.matchInfo.round}` : ''),
      dt: a?.dt || '',
      estadio: a?.estadio || raw?.matchInfo?.stadium || '',
      gf, gc,
      goles: a ? a.goles || [] : goalsFromRating(raw),
      golesRival: a ? a.golesRival || [] : [],
      penales: a?.penales || null,
      notas: a?.notas || '',
      result: resultOf(gf, gc, m.result),
      venue: m.venue,
      rated: true,
      attended: !!a,
      attendance: a || null,
      // Liga sin especificar (las valoraciones viejas no dicen si era Apertura o Clausura)
      genericLeague: !a && /liga profesional/i.test(m.competition || '') && !/(apertura|clausura|copa)/i.test(raw?.matchInfo?.competitionDetail || ''),
    });
  });

  attendance.forEach(a => {
    if (byDate.has(a.fecha)) return;
    const time = new Date(`${a.fecha}T12:00`).getTime();
    byDate.set(a.fecha, {
      id: a.id,
      time,
      year: Number(a.fecha.slice(0, 4)),
      date: displayDate(a.fecha),
      fecha: a.fecha,
      rival: a.rival,
      comp: a.comp || '',
      ronda: a.ronda || '',
      dt: a.dt || '',
      estadio: a.estadio || '',
      gf: a.gf, gc: a.gc,
      goles: a.goles || [],
      golesRival: a.golesRival || [],
      penales: a.penales || null,
      notas: a.notas || '',
      result: resultOf(a.gf, a.gc),
      venue: a.estadio && a.estadio === homeStadium ? 'home' : null,
      players: [],
      teamAvg: null,
      best: null,
      rated: false,
      attended: true,
      attendance: a,
    });
  });

  const list = [...byDate.values()].sort((x, y) => y.time - x.time);

  // Datos de los partidos sólo valorados que se deducen de los de la cancha:
  // si el partido anterior y el siguiente coinciden, es ese valor
  const bracket = (m, candidates, key) => {
    const before = candidates.filter(x => x.time < m.time).at(-1);
    const after = candidates.find(x => x.time > m.time);
    return before && after && before[key] === after[key] ? before[key] : null;
  };
  const chrono = [...list].reverse();
  const withDt = chrono.filter(m => m.attended && m.dt);
  const CUP = /(copa argentina|libertadores|sudamericana|amistoso|supercopa|trofeo|recopa|mundial)/i;
  const leagueMatches = chrono.filter(m => m.attended && m.comp && !CUP.test(m.comp));
  list.forEach(m => {
    if (!m.dt) m.dt = bracket(m, withDt, 'dt') || '';
    if (m.genericLeague) m.comp = bracket(m, leagueMatches, 'comp') || m.comp;
  });

  return list.map(m => ({
    ...m,
    competition: m.comp || 'Sin competición',
    goalsFor: m.gf,
    goalsAgainst: m.gc,
    score: m.gf != null && m.gc != null ? `${m.gf} - ${m.gc}` : m.score || '',
  }));
};
