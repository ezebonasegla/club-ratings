/**
 * Cálculo de estadísticas del Dashboard (todo en el cliente, a partir de las valoraciones)
 */
import { hasValidRating } from '../../services/cloudStorageService';

export const POSITIONS = {
  G: { label: 'Arquero', short: 'ARQ' },
  D: { label: 'Defensor', short: 'DEF' },
  M: { label: 'Mediocampista', short: 'MED' },
  F: { label: 'Delantero', short: 'DEL' },
};

export const RESULT_LABELS = { win: 'Victoria', draw: 'Empate', loss: 'Derrota' };
export const RESULT_SHORT = { win: 'G', draw: 'E', loss: 'P' };

export const SORT_OPTIONS = [
  { value: 'avg', label: 'Promedio', dir: 'desc' },
  { value: 'form', label: 'Forma (últimos 5)', dir: 'desc' },
  { value: 'trend', label: 'Tendencia', dir: 'desc' },
  { value: 'apps', label: 'Partidos valorados', dir: 'desc' },
  { value: 'minutes', label: 'Minutos jugados', dir: 'desc' },
  { value: 'goals', label: 'Goles', dir: 'desc' },
  { value: 'assists', label: 'Asistencias', dir: 'desc' },
  { value: 'ga', label: 'Goles + Asistencias', dir: 'desc' },
  { value: 'mvp', label: 'Veces figura', dir: 'desc' },
  { value: 'max', label: 'Mejor nota', dir: 'desc' },
  { value: 'min', label: 'Peor nota', dir: 'asc' },
  { value: 'consistency', label: 'Regularidad', dir: 'asc' },
  { value: 'sofaDiff', label: 'Diferencia vs SofaScore', dir: 'desc' },
  { value: 'starts', label: '% como titular', dir: 'desc' },
  { value: 'cards', label: 'Tarjetas', dir: 'desc' },
  { value: 'name', label: 'Nombre', dir: 'asc' },
];

const sortValue = {
  avg: p => p.avg,
  form: p => p.form,
  trend: p => p.trend,
  apps: p => p.apps,
  minutes: p => p.minutes,
  goals: p => p.goals,
  assists: p => p.assists,
  ga: p => p.goals + p.assists,
  mvp: p => p.mvp,
  max: p => p.max,
  min: p => p.min,
  consistency: p => p.std,
  sofaDiff: p => p.sofaDiff ?? -Infinity,
  starts: p => p.startPct,
  cards: p => p.yellow + p.red * 2,
};

export const sortPlayers = (players, sortBy, dir) => {
  const factor = dir === 'asc' ? 1 : -1;
  const sorted = [...players];
  if (sortBy === 'name') {
    return sorted.sort((a, b) => factor * a.name.localeCompare(b.name, 'es'));
  }
  const get = sortValue[sortBy] || sortValue.avg;
  // Desempate por promedio y luego por partidos
  return sorted.sort((a, b) =>
    factor * (get(a) - get(b)) || (b.avg - a.avg) || (b.apps - a.apps)
  );
};

const round = (n, d = 2) => (n === null || n === undefined || isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const mean = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const stdDev = arr => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
};

// matchInfo.date viene como "d/m/aaaa"; si falta, se usa la fecha en que se valoró
const matchTime = (rating) => {
  const parts = rating.matchInfo?.date?.split('/');
  if (parts?.length === 3) {
    const [day, month, year] = parts.map(Number);
    const time = new Date(year, month - 1, day).getTime();
    if (!isNaN(time)) return time;
  }
  return new Date(rating.timestamp).getTime() || 0;
};

const matchResult = (info = {}) => {
  if (info.result) return info.result;
  if (info.userScore !== undefined && info.rivalScore !== undefined) {
    if (info.userScore > info.rivalScore) return 'win';
    if (info.userScore < info.rivalScore) return 'loss';
  }
  return 'draw';
};

/**
 * Normaliza las valoraciones guardadas a una lista de partidos (más reciente primero)
 */
export const buildMatches = (ratings) =>
  ratings
    .map(r => {
      const info = r.matchInfo || {};
      const players = (r.players || [])
        .filter(p => hasValidRating(p.rating))
        .map(p => ({ ...p, rating: parseFloat(p.rating) }));
      const teamAvg = mean(players.map(p => p.rating));
      const best = players.reduce((top, p) => (!top || p.rating > top.rating ? p : top), null);
      const time = matchTime(r);
      return {
        id: r.id,
        time,
        year: new Date(time).getFullYear(),
        date: info.date || '',
        rival: info.rival || 'Rival',
        competition: info.competition || 'Sin competición',
        score: info.score || '',
        goalsFor: info.userScore ?? null,
        goalsAgainst: info.rivalScore ?? null,
        result: matchResult(info),
        venue: info.userTeam === 'home' ? 'home' : info.userTeam === 'away' ? 'away' : null,
        teamAvg,
        best,
        players,
      };
    })
    .sort((a, b) => b.time - a.time);

export const filterMatches = (matches, { competition, period, venue, result, attendance = 'all', rival = 'all', dt = 'all', scorer = 'all' }) => {
  let list = matches;
  if (scorer !== 'all') list = list.filter(m => (m.goles || []).some(g => g.tipo !== 'autogol' && g.jugador === scorer));
  if (rival !== 'all') list = list.filter(m => m.rival === rival);
  if (dt !== 'all') list = list.filter(m => m.dt === dt);
  if (attendance !== 'all') list = list.filter(m => (attendance === 'yes' ? m.attended : !m.attended));
  if (competition !== 'all') list = list.filter(m => m.competition === competition);
  if (venue !== 'all') list = list.filter(m => m.venue === venue);
  if (result !== 'all') list = list.filter(m => m.result === result);
  if (period.startsWith('last')) list = list.slice(0, Number(period.slice(4)));
  else if (period !== 'all') list = list.filter(m => String(m.year) === period);
  return list;
};

/**
 * Resumen del equipo para los partidos filtrados
 */
export const teamSummary = (matches) => {
  const record = { win: 0, draw: 0, loss: 0 };
  let goalsFor = 0;
  let goalsAgainst = 0;
  const allRatings = [];
  matches.forEach(m => {
    record[m.result] += 1;
    goalsFor += m.goalsFor || 0;
    goalsAgainst += m.goalsAgainst || 0;
    m.players.forEach(p => allRatings.push(p.rating));
  });
  const recentAvg = mean(matches.slice(0, 5).map(m => m.teamAvg).filter(x => x !== null));
  const teamAvg = mean(allRatings);
  return {
    matches: matches.length,
    record,
    points: record.win * 3 + record.draw,
    effectiveness: matches.length ? (record.win * 3 + record.draw) / (matches.length * 3) : 0,
    goalsFor,
    goalsAgainst,
    teamAvg,
    recentAvg,
    ratingsCount: allRatings.length,
    distribution: ratingDistribution(allRatings),
  };
};

export const RATING_BUCKETS = [
  { key: '<4', test: r => r < 4 },
  { key: '4–5', test: r => r >= 4 && r < 5 },
  { key: '5–6', test: r => r >= 5 && r < 6 },
  { key: '6–7', test: r => r >= 6 && r < 7 },
  { key: '7–8', test: r => r >= 7 && r < 8 },
  { key: '8–9', test: r => r >= 8 && r < 9 },
  { key: '9+', test: r => r >= 9 },
];

const ratingDistribution = (ratings) =>
  RATING_BUCKETS.map(b => ({ rango: b.key, cantidad: ratings.filter(b.test).length, min: parseFloat(b.key) || 0 }));

/**
 * Estadísticas por jugador para los partidos filtrados
 */
export const buildPlayers = (matches) => {
  const map = new Map();

  // matches viene del más reciente al más antiguo
  matches.forEach(m => {
    const topRating = m.best?.rating;
    m.players.forEach(p => {
      if (!map.has(p.id)) {
        map.set(p.id, {
          id: p.id,
          name: p.name,
          shirtNumber: p.shirtNumber,
          positions: {},
          log: [],
        });
      }
      const s = map.get(p.id);
      if (p.position && p.position !== 'N/A') s.positions[p.position] = (s.positions[p.position] || 0) + 1;
      s.log.push({
        matchId: m.id,
        date: m.date,
        time: m.time,
        rival: m.rival,
        competition: m.competition,
        score: m.score,
        result: m.result,
        venue: m.venue,
        teamAvg: m.teamAvg,
        rating: p.rating,
        sofascore: hasValidRating(p.sofascoreRating) ? parseFloat(p.sofascoreRating) : null,
        minutes: p.minutesPlayed || 0,
        goals: p.goals || 0,
        assists: p.assists || 0,
        yellow: !!p.yellowCard,
        red: !!p.redCard,
        starter: !!p.starter,
        mvp: p.rating === topRating,
      });
    });
  });

  return [...map.values()].map(s => {
    const ratings = s.log.map(l => l.rating);
    const avg = mean(ratings);
    const form = mean(ratings.slice(0, 5));
    const withSofa = s.log.filter(l => l.sofascore !== null);
    const vsTeam = s.log.filter(l => l.teamAvg !== null);
    const position = Object.entries(s.positions).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const sum = key => s.log.reduce((t, l) => t + (typeof l[key] === 'boolean' ? Number(l[key]) : l[key]), 0);

    return {
      ...s,
      position,
      apps: s.log.length,
      avg: round(avg),
      form: round(form),
      trend: round(form - avg),
      max: Math.max(...ratings),
      min: Math.min(...ratings),
      std: round(stdDev(ratings)),
      goals: sum('goals'),
      assists: sum('assists'),
      minutes: sum('minutes'),
      yellow: sum('yellow'),
      red: sum('red'),
      starts: sum('starter'),
      startPct: s.log.length ? sum('starter') / s.log.length : 0,
      mvp: sum('mvp'),
      sofaAvg: withSofa.length ? round(mean(withSofa.map(l => l.sofascore))) : null,
      sofaDiff: withSofa.length ? round(mean(withSofa.map(l => l.rating - l.sofascore))) : null,
      vsTeam: vsTeam.length ? round(mean(vsTeam.map(l => l.rating - l.teamAvg))) : null,
    };
  });
};

/**
 * Promedios de un jugador agrupados por un campo (competición, resultado, condición)
 */
export const splitBy = (log, keyFn, labelFn = k => k) => {
  const groups = new Map();
  log.forEach(l => {
    const key = keyFn(l);
    if (key === null || key === undefined) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l.rating);
  });
  return [...groups.entries()]
    .map(([key, ratings]) => ({ key, label: labelFn(key), apps: ratings.length, avg: round(mean(ratings)) }))
    .sort((a, b) => b.apps - a.apps);
};

// Clase de color según la nota
export const ratingTier = (r) => {
  if (r === null || r === undefined || isNaN(r)) return 'none';
  if (r >= 8) return 'elite';
  if (r >= 7) return 'good';
  if (r >= 6) return 'ok';
  if (r >= 5) return 'meh';
  return 'bad';
};

export const fmt = (n, d = 2) => (n === null || n === undefined || isNaN(n) ? '–' : Number(n).toFixed(d));
export const fmtSigned = (n, d = 2) => (n === null || n === undefined || isNaN(n) ? '–' : `${n > 0 ? '+' : ''}${Number(n).toFixed(d)}`);

// Color de los gráficos: el color del club, salvo que sea casi blanco
export const chartColor = (club) => {
  const pick = [club?.colors?.primary, club?.colors?.secondary].find(c => {
    if (!c || !/^#[0-9a-f]{6}$/i.test(c)) return false;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b < 200;
  });
  return pick || '#E30613';
};
