/**
 * Secciones de resultados, rivales y goleadores del Dashboard (antes "Cancha")
 */
import React from 'react';
import { Pencil, Trash2, StickyNote } from 'lucide-react';
import { res, hasPen, penWon, RES_COLOR, fmtDate, goalList } from '../cancha/canchaStats';
import { ratingTier, fmt } from './stats';

export const ResBadge = ({ p }) => (
  <span className="cancha-res" style={{ background: RES_COLOR[res(p)] }} title={hasPen(p) ? `${penWon(p) ? 'Ganó' : 'Perdió'} por penales` : undefined}>
    {res(p)}
    {hasPen(p) && <i style={{ background: penWon(p) ? RES_COLOR.G : RES_COLOR.P }} />}
  </span>
);

export const PenTag = ({ p }) => (hasPen(p) ? (
  <span className={`cancha-tag ${penWon(p) ? 'up' : 'down'}`}>
    {penWon(p) ? 'Ganó' : 'Perdió'} {p.penales.club}-{p.penales.rival} pen.
  </span>
) : null);

export const RecordBar = ({ s }) => (
  <div className="cancha-bar">
    {['G', 'E', 'P'].map(k => s[k] > 0 && <span key={k} style={{ flex: s[k], background: RES_COLOR[k] }} />)}
  </div>
);

export const ScorerBars = ({ items, rival }) => {
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

export const GroupRows = ({ groups, onSelect }) => groups.map(g => (
  <button key={g.name} className="cancha-row cancha-row-btn" onClick={() => onSelect?.(g.name)}>
    <span className="cancha-row-main">
      <b>{g.name}</b>
      <small>{g.pj} PJ · {g.G}-{g.E}-{g.P} · goles {g.gf}-{g.gc} · {g.ef}%</small>
    </span>
    <RecordBar s={g} />
  </button>
));

export const MiniMatches = ({ list }) => (list.length ? list.map(p => (
  <div key={p.id} className="cancha-row">
    <span className="cancha-row-main"><b>{p.rival}</b><small>{fmtDate(p.fecha)}</small></span>
    <b className="cancha-score">{p.gf}-{p.gc}</b>
  </div>
)) : <p className="dash-muted">—</p>);

export const ScorerTable = ({ ranking, rival, clubName, onSelect }) => (
  <section className="dash-card">
    <div className="dash-card-head">
      <h2>{rival ? 'Goles en contra' : `Goles de ${clubName}`}</h2>
      <span className="dash-muted">{rival ? 'Quiénes nos hicieron goles' : 'Tocá un jugador para ver sus partidos'}</span>
    </div>
    {ranking.list.length === 0 ? <p className="dash-muted">Sin goles cargados en los partidos filtrados</p> : (
      <div className="cancha-scorers">
        {ranking.list.map((g, i) => (
          <button key={g.jugador} className="cancha-scorer" onClick={() => !rival && onSelect?.(g.jugador)} disabled={rival}>
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
    {ranking.og.length > 0 && (
      <>
        <h3 className="cancha-sub">{rival ? `Autogoles de ${clubName}` : 'Autogoles a favor'} ({ranking.og.reduce((a, x) => a + x.goles, 0)})</h3>
        {ranking.og.map(o => (
          <div key={o.jugador} className="cancha-row">
            <span className="cancha-row-main"><b>{o.jugador}</b><small>{o.rivales.join(', ')}</small></span>
            <b className="cancha-num">{o.goles}</b>
          </div>
        ))}
      </>
    )}
  </section>
);

/**
 * Lista de partidos unificada: valorados y/o en la cancha
 */
export const MatchList = ({ list, onEdit, onDelete, onPlayer }) => (
  <div className="cancha-matches">
    {list.map(p => {
      const missing = p.attended && ((p.goles || []).length !== p.gf || (p.golesRival || []).length !== p.gc);
      return (
        <article key={p.fecha} className="cancha-match">
          <ResBadge p={p} />
          <div className="cancha-match-main">
            <div className="cancha-match-top">
              <b>{p.rival}</b>
              <span className="cancha-score">{p.gf ?? '?'}-{p.gc ?? '?'}</span>
              <PenTag p={p} />
              {p.attended && <span className="cancha-tag cancha-tag-attended" title="Fuiste a la cancha">🏟️ Fui</span>}
            </div>
            <span className="cancha-meta">
              {fmtDate(p.fecha)}{p.comp && ` · ${p.comp}`}{p.ronda && ` · ${p.ronda}`}
            </span>
            {(p.estadio || p.dt) && <span className="cancha-meta">{[p.estadio, p.dt && `DT ${p.dt}`].filter(Boolean).join(' · ')}</span>}
            {(p.goles || []).length > 0 && <span className="cancha-goal-line">⚽ {goalList(p.goles)}</span>}
            {(p.golesRival || []).length > 0 && <span className="cancha-goal-line rival">{goalList(p.golesRival)}</span>}
            {p.best && (
              <span className="cancha-meta">⭐ Figura: <button className="dash-link" onClick={() => onPlayer?.(p.best.id)}>{p.best.name}</button></span>
            )}
            {missing && <span className="cancha-tag down">faltan goles</span>}
            {p.notas && <span className="cancha-notes"><StickyNote size={12} /> {p.notas}</span>}
          </div>
          <div className="cancha-match-side">
            {p.rated ? (
              <b className={`dash-pill tier-bg-${ratingTier(p.teamAvg)}`} title="Promedio de tus notas">{fmt(p.teamAvg, 1)}</b>
            ) : (
              <span className="cancha-tag cancha-tag-muted">Sin valorar</span>
            )}
            {p.attended && (
              <div className="cancha-match-actions">
                <button className="dash-icon-btn" onClick={() => onEdit?.(p.attendance)} aria-label="Corregir datos del partido"><Pencil size={15} /></button>
                <button className="dash-icon-btn" onClick={() => onDelete?.(p.attendance)} aria-label="Quitar de la cancha"><Trash2 size={15} /></button>
              </div>
            )}
          </div>
        </article>
      );
    })}
  </div>
);
