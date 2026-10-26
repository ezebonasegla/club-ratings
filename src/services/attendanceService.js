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

/**
 * Arma el registro de cancha a partir del partido cargado desde Sofascore
 */
export const buildAttendanceFromMatch = (matchData, existing = []) => {
  const info = matchData.matchInfo;
  const names = key => [...new Set(existing.map(a => a[key]).filter(Boolean))];
  const lastDt = existing.find(a => a.dt)?.dt || '';
  return {
    fecha: info.isoDate,
    rival: matchExistingName(info.rival, names('rival')),
    gf: info.userScore ?? 0,
    gc: info.rivalScore ?? 0,
    comp: matchExistingName(info.competition || '', names('comp')),
    ronda: info.round ? `Fecha ${info.round}` : '',
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
