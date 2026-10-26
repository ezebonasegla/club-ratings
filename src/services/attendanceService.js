/**
 * Partidos a los que el usuario fue a la cancha.
 *
 * Colección `attendance`: un documento por usuario + club + fecha
 * (id determinístico, así importar dos veces o valorar después no duplica).
 * Requiere la regla de `attendance` de firestore.rules publicada en Firebase.
 */
import { collection, doc, getDocs, query, where, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'attendance';
const CACHE_TTL = 2 * 60 * 1000;
const cache = new Map(); // userId -> { promise, time }

export const attendanceId = (userId, clubId, fecha) => `${userId}_${clubId || 'club'}_${fecha}`;

export const friendlyError = (error) =>
  error?.code === 'permission-denied'
    ? 'Firebase rechazó el acceso a "attendance". Falta publicar las reglas nuevas de firestore.rules en la consola de Firebase.'
    : error?.message || 'Error inesperado';

const fetchAll = (userId, force = false) => {
  const cached = cache.get(userId);
  if (!force && cached && Date.now() - cached.time < CACHE_TTL) return cached.promise;
  const promise = getDocs(query(collection(db, COLLECTION), where('userId', '==', userId)))
    .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
  cache.set(userId, { promise, time: Date.now() });
  promise.catch(() => cache.delete(userId));
  return promise;
};

const invalidate = userId => cache.delete(userId);

/**
 * Partidos en la cancha del usuario (opcionalmente de un club), del más reciente al más antiguo
 */
export const getAttendance = async (userId, clubId = null, { force = false } = {}) => {
  try {
    let list = [...await fetchAll(userId, force)];
    if (clubId) list = list.filter(a => a.clubId === clubId);
    list.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { success: true, data: list };
  } catch (error) {
    console.error('Error al obtener partidos en la cancha:', error);
    return { success: false, error: friendlyError(error), data: [] };
  }
};

const clean = (entry) => {
  const out = {};
  Object.entries(entry).forEach(([k, v]) => { if (v !== undefined) out[k] = v; });
  return out;
};

/**
 * Crear o actualizar (merge) un partido en la cancha
 */
export const saveAttendance = async (userId, clubId, entry) => {
  try {
    const id = attendanceId(userId, clubId, entry.fecha);
    await setDoc(doc(db, COLLECTION, id), clean({
      ...entry,
      id: undefined,
      userId,
      clubId,
      updatedAt: serverTimestamp(),
    }), { merge: true });
    invalidate(userId);
    return { success: true, id };
  } catch (error) {
    console.error('Error al guardar partido en la cancha:', error);
    return { success: false, error: friendlyError(error) };
  }
};

/**
 * Cambiar la fecha de un partido implica cambiar su id: se borra el anterior
 */
export const updateAttendance = async (userId, clubId, previousId, entry) => {
  const result = await saveAttendance(userId, clubId, entry);
  if (result.success && previousId && previousId !== result.id) {
    await deleteAttendance(userId, previousId);
  }
  return result;
};

export const deleteAttendance = async (userId, id) => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    invalidate(userId);
    return { success: true };
  } catch (error) {
    console.error('Error al borrar partido en la cancha:', error);
    return { success: false, error: friendlyError(error) };
  }
};

// ---------- Importación desde "Mi River en la cancha" ----------

const normalizeGoals = (goals) =>
  (Array.isArray(goals) ? goals : [])
    .filter(g => g && g.jugador)
    .map(g => ({ jugador: String(g.jugador).trim(), tipo: ['gol', 'penal', 'autogol'].includes(g.tipo) ? g.tipo : 'gol' }));

/**
 * Valida y convierte el JSON exportado por la página "Mi River en la cancha"
 * ({ partidos: [...] }) al formato de Club Ratings.
 */
export const parseImport = (text) => {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El texto no es un JSON válido. Usá el botón "Copiar datos" de tu página y pegá todo.');
  }
  const partidos = Array.isArray(data) ? data : data?.partidos;
  if (!Array.isArray(partidos)) throw new Error('No encontré la lista "partidos" en los datos.');

  const valid = [];
  const skipped = [];
  partidos.forEach((p, i) => {
    if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '') || !p.rival || p.gf === undefined || p.gc === undefined) {
      skipped.push(i + 1);
      return;
    }
    const pen = p.penales && (p.penales.river !== undefined || p.penales.club !== undefined)
      ? { club: Number(p.penales.club ?? p.penales.river), rival: Number(p.penales.rival) }
      : null;
    valid.push({
      fecha: p.fecha,
      rival: String(p.rival).trim(),
      gf: Number(p.gf) || 0,
      gc: Number(p.gc) || 0,
      comp: p.comp || '',
      ronda: p.ronda || '',
      dt: p.dt || '',
      estadio: p.estadio || '',
      notas: p.notas || '',
      goles: normalizeGoals(p.goles),
      golesRival: normalizeGoals(p.golesRival),
      penales: pen,
    });
  });

  // Si hay dos partidos el mismo día, queda el último (mismo id)
  const byDate = new Map(valid.map(p => [p.fecha, p]));
  return { partidos: [...byDate.values()], skipped, duplicates: valid.length - byDate.size };
};

/**
 * Guarda los partidos importados (merge: no pisa ratingId/matchId de los que ya existían)
 */
export const importAttendance = async (userId, clubId, partidos, existing = []) => {
  try {
    const existingIds = new Set(existing.map(a => a.id));
    let created = 0;
    let updated = 0;

    for (let i = 0; i < partidos.length; i += 400) {
      const batch = writeBatch(db);
      partidos.slice(i, i + 400).forEach(p => {
        const id = attendanceId(userId, clubId, p.fecha);
        if (existingIds.has(id)) updated++; else created++;
        batch.set(doc(db, COLLECTION, id), clean({
          ...p,
          userId,
          clubId,
          source: existingIds.has(id) ? undefined : 'import',
          updatedAt: serverTimestamp(),
        }), { merge: true });
      });
      await batch.commit();
    }

    invalidate(userId);
    return { success: true, created, updated };
  } catch (error) {
    console.error('Error al importar partidos en la cancha:', error);
    return { success: false, error: friendlyError(error) };
  }
};

/**
 * Exporta en el mismo formato que "Mi River en la cancha"
 */
export const exportAttendance = (list) => JSON.stringify({
  partidos: list.map(a => ({
    id: a.id,
    fecha: a.fecha,
    rival: a.rival,
    gf: a.gf,
    gc: a.gc,
    comp: a.comp || '',
    ronda: a.ronda || '',
    dt: a.dt || '',
    estadio: a.estadio || '',
    notas: a.notas || '',
    goles: a.goles || [],
    golesRival: a.golesRival || [],
    ...(a.penales ? { penales: { river: a.penales.club, rival: a.penales.rival } } : {}),
  })),
}, null, 1);

// ---------- Utilidades ----------

const norm = s => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Reusa un nombre ya cargado si el nuevo empieza o termina con él
 * ("Boca Juniors" → "Boca", "Estadio Mâs Monumental" → "Monumental",
 * "CONMEBOL Libertadores" → "Libertadores"), para no partir estadísticas.
 */
export const matchExistingName = (name, existingNames) => {
  const n = norm(name);
  if (!n) return name;
  const exact = existingNames.find(e => norm(e) === n);
  if (exact) return exact;
  const candidates = existingNames
    .filter(e => {
      const en = norm(e);
      return en.length >= 4 && (n.startsWith(en + ' ') || n.endsWith(' ' + en));
    })
    .sort((a, b) => norm(b).length - norm(a).length);
  return candidates[0] || name;
};

// Palabras que se pueden omitir del nombre de un club sin cambiar de equipo
// ("Boca Juniors" = "Boca", "Club Atlético Tigre" = "Tigre", "Vélez Sarsfield" = "Vélez")
const GENERIC_TEAM_WORDS = new Set([
  'club', 'atletico', 'ca', 'cd', 'fc', 'cf', 'sc', 'ac', 'afc', 'juniors', 'sarsfield', 'de', 'la', 'del', 'y',
  'plata', 'old', 'boys', 'esgrima', 'sporting', 'asociacion', 'social', 'deportivo', 'deportiva', 'football', 'futbol',
]);

// Abreviaturas habituales en nombres de clubes
const TEAM_ABBREVIATIONS = {
  ind: 'independiente', atl: 'atletico', jr: 'juniors', jrs: 'juniors', lp: 'la plata', est: 'estudiantes',
  univ: 'universidad', dep: 'deportivo', gral: 'general', sp: 'sporting', sta: 'santa', sto: 'santo',
};

// "Ind. Santa Fe (C)" → ["independiente", "santa", "fe"]; "Newell's" → ["newells"]
const teamWords = s => norm(String(s || '').replace(/\([^)]*\)/g, ' ').replace(/['’`]/g, ''))
  .split(' ')
  .filter(Boolean)
  .flatMap(w => (TEAM_ABBREVIATIONS[w] || w).split(' '));

/**
 * Nombre de rival como ya lo usa el usuario. Coincide si todas las palabras del
 * nombre del usuario aparecen en orden (con abreviaturas expandidas) y lo que
 * sobra son palabras genéricas de club. Así "Independiente Santa Fe" = "Ind. Santa Fe (C)"
 * y NO "Independiente"; "Gimnasia y Esgrima La Plata" = "Gimnasia LP".
 */
export const matchExistingTeam = (name, existingNames) => {
  const words = teamWords(name);
  if (!words.length) return name;
  const candidates = existingNames
    .map(e => ({ e, w: teamWords(e) }))
    .filter(({ w }) => {
      if (!w.length || w.join(' ').length < 4) return false;
      // Subsecuencia: las palabras del nombre corto, en orden, dentro del largo
      let k = 0;
      const rest = [];
      words.forEach(x => { if (k < w.length && x === w[k]) k++; else rest.push(x); });
      return k === w.length && rest.every(x => GENERIC_TEAM_WORDS.has(x));
    })
    .sort((a, b) => b.w.length - a.w.length);
  return candidates[0]?.e || name;
};

/**
 * Fecha ISO (aaaa-mm-dd) de una valoración guardada
 */
export const ratingIsoDate = (rating) => {
  if (rating?.matchInfo?.isoDate) return rating.matchInfo.isoDate;
  const parts = rating?.matchInfo?.date?.split('/');
  if (parts?.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (d && m && y) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
};

// Palabras que identifican una competencia (el resto, como "Liga" o "Copa", son genéricas)
const GENERIC_WORDS = new Set(['liga', 'profesional', 'futbol', 'copa', 'torneo', 'conmebol', 'argentina', 'primera', 'division', 'de', 'la', 'del', 'lpf', 'season', 'temporada']);
const keyWords = s => norm(s).split(' ').filter(w => w.length >= 4 && !GENERIC_WORDS.has(w) && !/^\d+$/.test(w));

/**
 * Competencia con el nombre que ya usa el usuario. Primero por palabra clave
 * ("…Clausura" → "Clausura Argentina", "CONMEBOL Libertadores" → "Libertadores"),
 * después por prefijo/sufijo.
 */
export const competitionFor = (info, existingComps) => {
  const detail = info.competitionDetail || info.competition || '';
  const words = new Set(keyWords(detail));
  const byKeyword = existingComps.filter(c => keyWords(c).some(w => words.has(w)));
  if (byKeyword.length === 1) return byKeyword[0];
  return matchExistingName(info.competition || '', existingComps);
};

const ROUND_NAMES = {
  'round of 64': '32avos de final',
  'round of 32': '16avos de final',
  'round of 16': 'Octavos',
  'quarterfinals': 'Cuartos',
  'quarter-finals': 'Cuartos',
  'semifinals': 'Semifinal',
  'semi-finals': 'Semifinal',
  'final': 'Final',
  'preliminary round': 'Fase previa',
  'qualification': 'Fase previa',
};

/**
 * Texto de la ronda: "Fecha 14", "Octavos", "Grupos · Fecha 3"…
 * currentRonda permite completar lo que el usuario ya tenía ("Fecha" → "Fecha 14")
 */
export const roundLabel = (round, roundName, currentRonda = '') => {
  const current = String(currentRonda || '').trim();
  const named = roundName ? ROUND_NAMES[roundName.toLowerCase()] || roundName : '';
  if (/^grupos?$/i.test(current)) return round ? `Grupos · Fecha ${round}` : current;
  if (current && current !== '-' && !/^fecha$/i.test(current)) return current; // ya completo
  if (named) return named;
  return round ? `Fecha ${round}` : current;
};

/**
 * Arma el registro de cancha a partir del partido cargado desde Sofascore
 */
export const buildAttendanceFromMatch = (matchData, existing = []) => {
  const info = matchData.matchInfo;
  const names = key => [...new Set(existing.map(a => a[key]).filter(Boolean))];
  const lastDt = existing.find(a => a.dt)?.dt || '';
  return {
    fecha: info.isoDate,
    rival: matchExistingTeam(info.rival, names('rival')),
    rivalSofascore: info.rival || '',
    gf: info.userScore ?? 0,
    gc: info.rivalScore ?? 0,
    comp: competitionFor(info, names('comp')),
    ronda: roundLabel(info.round, info.roundName),
    dt: lastDt,
    estadio: matchExistingName(info.stadium || '', names('estadio')),
    goles: (matchData.goals?.user || []).map(({ jugador, tipo }) => ({ jugador, tipo })),
    golesRival: (matchData.goals?.rival || []).map(({ jugador, tipo }) => ({ jugador, tipo })),
    penales: matchData.penalties && info.userScore === info.rivalScore ? matchData.penalties : null,
  };
};

// ---------- Carga inicial desde "Mi River en la cancha" ----------

// Huella SHA-256 del email de la cuenta dueña de esos datos (el email no queda en el código)
const SEED_OWNER_HASH = '1e7b7a50c222b9a3896e74b2f80adc372b2e1be4b10d8bbca5285b3140ef2727';
const SEED_CLUB_ID = 'river';
const seedChecked = new Set();

const sha256 = async (text) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Importa una sola vez los partidos que el dueño tenía cargados en
 * "Mi River en la cancha". No hace nada para cualquier otra cuenta o club.
 * Devuelve true si importó.
 */
export const ensureSeedImported = async (user, clubId) => {
  if (!user?.email || clubId !== SEED_CLUB_ID || seedChecked.has(user.uid) || !crypto?.subtle) return false;
  seedChecked.add(user.uid);
  try {
    if (await sha256(user.email.trim().toLowerCase()) !== SEED_OWNER_HASH) return false;

    const { getUserConfig, saveUserConfig } = await import('./cloudUserConfigService');
    const config = await getUserConfig(user.uid);
    if (!config.success || config.data?.canchaSeedImported) return false;

    const existing = await getAttendance(user.uid, clubId, { force: true });
    if (!existing.success) { seedChecked.delete(user.uid); return false; }

    const { default: seed } = await import('../data/canchaSeed.json');
    const { partidos } = parseImport(JSON.stringify(seed));
    const result = await importAttendance(user.uid, clubId, partidos, existing.data);
    if (!result.success) { seedChecked.delete(user.uid); return false; }

    await saveUserConfig(user.uid, { canchaSeedImported: true });
    return true;
  } catch (error) {
    console.error('Error en la carga inicial de partidos en la cancha:', error);
    seedChecked.delete(user.uid);
    return false;
  }
};

// ---------- Completar números de fecha y reparar datos pisados ----------

/**
 * Completa "Fecha" → "Fecha N" (y "Grupos" → "Grupos · Fecha N") buscando cada
 * partido en el historial del club en Sofascore. Se hace una sola vez por usuario.
 * Devuelve la cantidad de partidos actualizados.
 */
export const fillRoundNumbers = async (user, clubId, teamId, list) => {
  if (!user || !teamId) return 0;
  // Sin número: vacío, "-", "Fecha" o "Grupos"
  const pending = list.filter(a => !a.ronda || /^(fecha|grupos?|-)$/i.test(a.ronda.trim()));
  if (!pending.length) return 0;

  const { getUserConfig, saveUserConfig } = await import('./cloudUserConfigService');
  const flag = `canchaRoundsFilled_${clubId}`;
  const config = await getUserConfig(user.uid);
  if (!config.success || config.data?.[flag]) return 0;

  const { fetchTeamHistory } = await import('./sofascoreService');
  const since = pending.map(a => a.fecha).sort()[0];
  const history = await fetchTeamHistory(teamId, since);

  const updates = pending
    .map(a => {
      const ev = history.get(a.fecha);
      if (!ev) return null;
      const ronda = roundLabel(ev.roundInfo?.round, ev.roundInfo?.name, a.ronda);
      return ronda && ronda !== a.ronda ? { id: a.id, ronda, matchId: a.matchId || String(ev.id) } : null;
    })
    .filter(Boolean);

  for (let i = 0; i < updates.length; i += 400) {
    const batch = writeBatch(db);
    updates.slice(i, i + 400).forEach(u => batch.set(doc(db, COLLECTION, u.id), { ronda: u.ronda, matchId: u.matchId, userId: user.uid, clubId }, { merge: true }));
    await batch.commit();
  }
  invalidate(user.uid);
  await saveUserConfig(user.uid, { [flag]: true });
  return updates.length;
};

/**
 * Reparación (una vez): al valorar un partido mientras se importaban los datos,
 * el registro importado se sobrescribía con los datos de Sofascore. Se restauran
 * los datos originales de esos partidos (manteniendo el vínculo con la valoración).
 */
export const repairSeedOverwrites = async (user, clubId) => {
  if (!user?.email || clubId !== SEED_CLUB_ID || !crypto?.subtle) return 0;
  if (await sha256(user.email.trim().toLowerCase()) !== SEED_OWNER_HASH) return 0;

  const { getUserConfig, saveUserConfig } = await import('./cloudUserConfigService');
  const config = await getUserConfig(user.uid);
  if (!config.success || !config.data?.canchaSeedImported || config.data?.canchaSeedRepair1) return 0;

  const existing = await getAttendance(user.uid, clubId, { force: true });
  if (!existing.success) return 0;
  const { default: seed } = await import('../data/canchaSeed.json');
  const { partidos } = parseImport(JSON.stringify(seed));
  const seedByDate = new Map(partidos.map(p => [p.fecha, p]));

  const broken = existing.data.filter(a => a.source === 'rating' && seedByDate.has(a.fecha));
  if (broken.length) {
    const batch = writeBatch(db);
    broken.forEach(a => {
      const p = seedByDate.get(a.fecha);
      batch.set(doc(db, COLLECTION, a.id), { ...clean(p), source: 'import', userId: user.uid, clubId }, { merge: true });
    });
    await batch.commit();
    invalidate(user.uid);
  }
  await saveUserConfig(user.uid, { canchaSeedRepair1: true });
  return broken.length;
};

/**
 * Arma el registro de cancha desde un partido del historial de Sofascore
 * (listado de eventos), para marcar "Fui" sin haberlo valorado.
 */
export const buildAttendanceFromEvent = (event, teamId, existing = [], goals = null) => {
  const pad = n => String(n).padStart(2, '0');
  const d = new Date(event.startTimestamp * 1000);
  const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isHome = event.homeTeam?.id === teamId;
  const us = isHome ? event.homeScore : event.awayScore;
  const them = isHome ? event.awayScore : event.homeScore;
  const names = key => [...new Set(existing.map(a => a[key]).filter(Boolean))];

  // Estadio de local = el más frecuente del registro
  const count = {};
  existing.forEach(a => { if (a.estadio) count[a.estadio] = (count[a.estadio] || 0) + 1; });
  const homeStadium = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  // DT: el del partido registrado más cercano en el tiempo
  const nearest = [...existing].filter(a => a.dt).sort((a, b) =>
    Math.abs(new Date(a.fecha) - d) - Math.abs(new Date(b.fecha) - d))[0];

  const gf = us?.display ?? us?.current ?? 0;
  const gc = them?.display ?? them?.current ?? 0;
  const penales = us?.penalties !== undefined && them?.penalties !== undefined && gf === gc
    ? { club: us.penalties, rival: them.penalties }
    : null;

  return {
    fecha,
    rival: matchExistingTeam((isHome ? event.awayTeam : event.homeTeam)?.name || 'Rival', names('rival')),
    rivalSofascore: (isHome ? event.awayTeam : event.homeTeam)?.name || '',
    gf,
    gc,
    comp: competitionFor({
      competition: event.tournament?.name || '',
      competitionDetail: [event.tournament?.name, event.season?.name, event.tournament?.uniqueTournament?.name].filter(Boolean).join(' · '),
    }, names('comp')),
    ronda: roundLabel(event.roundInfo?.round, event.roundInfo?.name),
    dt: nearest?.dt || '',
    estadio: isHome ? homeStadium : '',
    goles: goals?.user || [],
    golesRival: goals?.rival || [],
    penales,
    matchId: String(event.id),
    source: 'bulk',
  };
};
