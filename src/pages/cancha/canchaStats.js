/**
 * Estadísticas de los partidos en la cancha (misma lógica que "Mi River en la cancha")
 */

// Los penales cuentan como empate en el resultado
export const res = p => (p.gf > p.gc ? 'G' : p.gf < p.gc ? 'P' : 'E');
export const hasPen = p => p.gf === p.gc && p.penales && p.penales.club !== p.penales.rival;
export const penWon = p => hasPen(p) && p.penales.club > p.penales.rival;

export const RES_LABEL = { G: 'Ganado', E: 'Empatado', P: 'Perdido' };
export const RES_COLOR = { G: '#1e9e5a', E: '#d9a400', P: '#d64545' };

export const fmtDate = (iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  new Date(`${iso}T12:00`).toLocaleDateString('es-AR', opts);

export const uniq = (list, fn) =>
  [...new Set(list.flatMap(p => [fn(p)].flat()))].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), 'es'));

// Jugadores propios = goles propios (sin autogol) + autogoles en contra; y al revés
export const ownPlayers = list => uniq(list, p => [
  ...(p.goles || []).filter(g => g.tipo !== 'autogol').map(g => g.jugador),
  ...(p.golesRival || []).filter(g => g.tipo === 'autogol').map(g => g.jugador),
]);
export const rivalPlayers = list => uniq(list, p => [
  ...(p.golesRival || []).filter(g => g.tipo !== 'autogol').map(g => g.jugador),
  ...(p.goles || []).filter(g => g.tipo === 'autogol').map(g => g.jugador),
]);

export const EMPTY_FILTERS = { q: '', year: '', comp: '', dt: '', rival: '', estadio: '', result: '', scorer: '' };

export const filterMatches = (list, f) => {
  const q = f.q.trim().toLowerCase();
  return list.filter(p =>
    (!f.year || p.fecha.startsWith(f.year)) &&
    (!f.comp || p.comp === f.comp) &&
    (!f.dt || p.dt === f.dt) &&
    (!f.rival || p.rival === f.rival) &&
    (!f.estadio || p.estadio === f.estadio) &&
    (!f.result || res(p) === f.result) &&
    (!f.scorer || (p.goles || []).some(g => g.tipo !== 'autogol' && g.jugador === f.scorer)) &&
    (!q || [p.rival, p.comp, p.estadio, p.dt, p.ronda, p.notas, ...(p.goles || []).map(g => g.jugador), ...(p.golesRival || []).map(g => g.jugador)]
      .join(' ').toLowerCase().includes(q))
  );
};

export const stats = (ps) => {
  const s = { pj: ps.length, G: 0, E: 0, P: 0, gf: 0, gc: 0, vi: 0 };
  ps.forEach(p => { s[res(p)]++; s.gf += p.gf; s.gc += p.gc; if (!p.gc) s.vi++; });
  s.ef = s.pj ? Math.round(((s.G * 3 + s.E) / (s.pj * 3)) * 100) : 0;
  return s;
};

/**
 * Ranking de goleadores. side 'club' = goles del club, 'rival' = goles en contra.
 * Los autogoles se listan aparte.
 */
export const ranking = (ps, side) => {
  const m = {};
  const og = {};
  ps.forEach(p => {
    const own = side === 'club' ? p.goles || [] : p.golesRival || [];
    own.forEach(g => {
      if (g.tipo === 'autogol') {
        const o = (og[g.jugador] ??= { jugador: g.jugador, goles: 0, rivales: new Set() });
        o.goles++;
        o.rivales.add(p.rival);
        return;
      }
      const r = (m[g.jugador] ??= { jugador: g.jugador, goles: 0, pen: 0, partidos: new Set(), rivales: new Set(), ult: '' });
      r.goles++;
      if (g.tipo === 'penal') r.pen++;
      r.partidos.add(p.id);
      r.rivales.add(p.rival);
      if (p.fecha > r.ult) r.ult = p.fecha;
    });
  });
  return {
    list: Object.values(m)
      .map(r => ({ ...r, pj: r.partidos.size, rivales: [...r.rivales] }))
      .sort((a, b) => b.goles - a.goles || b.pen - a.pen || a.jugador.localeCompare(b.jugador, 'es')),
    og: Object.values(og).map(r => ({ ...r, rivales: [...r.rivales] })).sort((a, b) => b.goles - a.goles),
  };
};

// Rachas sobre la lista en orden cronológico
export const streaks = (chrono) => {
  let cur = 0, bestW = 0, unbeaten = 0, bestU = 0, noWin = 0, bestNoW = 0;
  chrono.forEach(p => {
    const r = res(p);
    cur = r === 'G' ? cur + 1 : 0; bestW = Math.max(bestW, cur);
    unbeaten = r !== 'P' ? unbeaten + 1 : 0; bestU = Math.max(bestU, unbeaten);
    noWin = r !== 'G' ? noWin + 1 : 0; bestNoW = Math.max(bestNoW, noWin);
  });
  return { currentUnbeaten: unbeaten, bestWins: bestW, bestUnbeaten: bestU, worstNoWin: bestNoW };
};

export const groupBy = (ps, key) => {
  const g = {};
  ps.forEach(p => { const k = p[key] || 'Sin dato'; (g[k] ??= []).push(p); });
  return Object.entries(g).map(([name, list]) => ({ name, ...stats(list) })).sort((a, b) => b.pj - a.pj || b.ef - a.ef);
};

export const byYear = (ps) => {
  const ys = {};
  ps.forEach(p => { const y = p.fecha.slice(0, 4); (ys[y] ??= { year: y, G: 0, E: 0, P: 0 })[res(p)]++; });
  return Object.values(ys).sort((a, b) => a.year.localeCompare(b.year));
};

// "Borja x2, Colidio (P)"
export const goalList = (goals = []) => {
  const m = new Map();
  goals.forEach(g => { const k = `${g.jugador}|${g.tipo}`; m.set(k, { ...g, n: (m.get(k)?.n || 0) + 1 }); });
  return [...m.values()].map(g => `${g.jugador}${g.n > 1 ? ` x${g.n}` : ''}${g.tipo === 'penal' ? ' (P)' : g.tipo === 'autogol' ? ' (AG)' : ''}`).join(', ');
};
