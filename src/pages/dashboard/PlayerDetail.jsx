import React, { useEffect, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import {
  POSITIONS, RESULT_LABELS, RESULT_SHORT, splitBy, ratingTier, fmt, fmtSigned,
} from './stats';

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="dash-tooltip">
      <strong>vs {d.rival}</strong>
      <span>{d.date} · {d.score}</span>
      <span>Tu nota: <b>{fmt(d.nota, 1)}</b></span>
      {d.equipo !== null && <span>Prom. equipo: {fmt(d.equipo, 2)}</span>}
      {d.sofascore !== null && <span>SofaScore: {fmt(d.sofascore, 1)}</span>}
    </div>
  );
};

const SplitTable = ({ title, rows, playerAvg }) => {
  if (rows.length === 0) return null;
  return (
    <div className="dash-split">
      <h4>{title}</h4>
      {rows.map(row => (
        <div key={row.key} className="dash-split-row">
          <span className="dash-split-label" title={row.label}>{row.label}</span>
          <span className="dash-split-apps">{row.apps} PJ</span>
          <div className="dash-split-bar">
            <div className={`dash-split-fill tier-${ratingTier(row.avg)}`} style={{ width: `${(row.avg / 10) * 100}%` }} />
          </div>
          <span className={`dash-split-avg tier-text-${ratingTier(row.avg)}`}>
            {fmt(row.avg, 2)}
            {playerAvg !== null && row.apps > 0 && (
              <small className={row.avg - playerAvg >= 0 ? 'up' : 'down'}>{fmtSigned(row.avg - playerAvg, 1)}</small>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

const PlayerDetail = ({ player, rank, totalRanked, color, onClose }) => {
  // Bloquear el scroll de fondo y cerrar con Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const chartData = useMemo(
    () => [...player.log].reverse().map((l, i) => ({
      // Clave única por partido: con nombres repetidos (mismo rival o mismas
      // primeras palabras) el tooltip mostraba los datos de otro partido
      x: i,
      rival: l.rival,
      label: l.rival.split(' ').slice(0, 2).join(' '),
      date: l.date,
      score: l.score,
      nota: l.rating,
      equipo: l.teamAvg !== null ? Number(l.teamAvg.toFixed(2)) : null,
      sofascore: l.sofascore,
    })),
    [player]
  );

  const splits = useMemo(() => ({
    competition: splitBy(player.log, l => l.competition),
    result: splitBy(player.log, l => l.result, k => RESULT_LABELS[k]),
    venue: splitBy(player.log, l => l.venue, k => (k === 'home' ? 'Local' : 'Visitante')),
    role: splitBy(player.log, l => (l.starter ? 'starter' : 'sub'), k => (k === 'starter' ? 'Titular' : 'Suplente')),
  }), [player]);

  const byRating = [...player.log].sort((a, b) => b.rating - a.rating);
  const best = byRating.slice(0, 3);
  const worst = byRating.slice(-3).reverse();
  const hasSofa = player.sofaAvg !== null;
  const TrendIcon = player.trend > 0.15 ? TrendingUp : player.trend < -0.15 ? TrendingDown : Minus;
  const trendClass = player.trend > 0.15 ? 'up' : player.trend < -0.15 ? 'down' : 'flat';
  const position = POSITIONS[player.position];

  const stats = [
    { label: 'Partidos', value: player.apps },
    { label: 'Minutos', value: player.minutes.toLocaleString('es-AR'), sub: player.apps ? `${Math.round(player.minutes / player.apps)}' por partido` : null },
    { label: 'Mejor nota', value: fmt(player.max, 1), tier: ratingTier(player.max) },
    { label: 'Peor nota', value: fmt(player.min, 1), tier: ratingTier(player.min) },
    { label: 'Regularidad', value: fmt(player.std, 2), sub: 'desvío (menor = más regular)' },
    { label: 'Veces figura', value: player.mvp, sub: 'mejor nota del partido' },
    { label: 'Goles', value: player.goals },
    { label: 'Asistencias', value: player.assists },
    { label: 'Titular', value: `${Math.round(player.startPct * 100)}%`, sub: `${player.starts} de ${player.apps}` },
    { label: 'Tarjetas', value: `${player.yellow}🟨 ${player.red}🟥` },
    { label: 'vs equipo', value: fmtSigned(player.vsTeam, 2), sub: 'sobre el promedio del equipo', signed: player.vsTeam },
    ...(hasSofa ? [{ label: 'vs SofaScore', value: fmtSigned(player.sofaDiff, 2), sub: `SofaScore promedia ${fmt(player.sofaAvg, 2)}`, signed: player.sofaDiff }] : []),
  ];

  return (
    <div className="dash-sheet-overlay" onClick={onClose}>
      <div className="dash-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={player.name}>
        <header className="dash-sheet-header">
          <div className="dash-sheet-title">
            {player.shirtNumber !== '' && player.shirtNumber !== undefined && (
              <span className="dash-shirt">{player.shirtNumber}</span>
            )}
            <div>
              <h2>{player.name}</h2>
              <p>
                {position ? position.label : 'Jugador'}
                {rank ? ` · #${rank} de ${totalRanked} en el ranking` : ''}
              </p>
            </div>
          </div>
          <button className="dash-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </header>

        <div className="dash-sheet-body">
          {/* Resumen principal */}
          <div className="dash-hero">
            <div className={`dash-hero-rating tier-bg-${ratingTier(player.avg)}`}>
              <span>{fmt(player.avg, 2)}</span>
              <small>Promedio</small>
            </div>
            <div className="dash-hero-side">
              <div className="dash-hero-item">
                <small>Forma (últimos 5)</small>
                <strong className={`tier-text-${ratingTier(player.form)}`}>{fmt(player.form, 2)}</strong>
              </div>
              <div className={`dash-trend ${trendClass}`}>
                <TrendIcon size={16} />
                {fmtSigned(player.trend, 2)} vs su promedio
              </div>
              <div className="dash-form-dots" aria-label="Últimas notas">
                {player.log.slice(0, 5).reverse().map(l => (
                  <span key={l.matchId} className={`dash-form-dot tier-bg-${ratingTier(l.rating)}`} title={`vs ${l.rival}: ${l.rating}`}>
                    {fmt(l.rating, 1)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="dash-stat-grid">
            {stats.map(s => (
              <div key={s.label} className="dash-stat">
                <small>{s.label}</small>
                <strong className={s.tier ? `tier-text-${s.tier}` : s.signed !== undefined && s.signed !== null ? (s.signed >= 0 ? 'up' : 'down') : ''}>
                  {s.value}
                </strong>
                {s.sub && <span>{s.sub}</span>}
              </div>
            ))}
          </div>

          {/* Evolución */}
          {chartData.length > 1 && (
            <section className="dash-sheet-section">
              <h3>Evolución de notas</h3>
              <div className="dash-legend">
                <span><i style={{ background: color }} /> Tu nota</span>
                <span><i className="dashed" /> Promedio del equipo</span>
                {hasSofa && <span><i style={{ background: '#2f7ed8' }} /> SofaScore</span>}
              </div>
              <div className="dash-chart">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8ec" />
                    <XAxis dataKey="x" tickFormatter={i => chartData[i]?.label ?? ''} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={player.avg} stroke={color} strokeOpacity={0.35} strokeDasharray="4 4" />
                    <Line animationDuration={500} type="monotone" dataKey="equipo" stroke="#9aa0a6" strokeDasharray="5 4" dot={false} strokeWidth={1.5} connectNulls />
                    {hasSofa && <Line animationDuration={500} type="monotone" dataKey="sofascore" stroke="#2f7ed8" dot={false} strokeWidth={1.5} connectNulls />}
                    <Line animationDuration={500} type="monotone" dataKey="nota" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Rendimiento por contexto */}
          <section className="dash-sheet-section">
            <h3>Rendimiento por contexto</h3>
            <div className="dash-splits">
              <SplitTable title="Por resultado" rows={splits.result} playerAvg={player.avg} />
              <SplitTable title="Local / Visitante" rows={splits.venue} playerAvg={player.avg} />
              <SplitTable title="Titular / Suplente" rows={splits.role} playerAvg={player.avg} />
              <SplitTable title="Por competición" rows={splits.competition} playerAvg={player.avg} />
            </div>
          </section>

          {/* Mejores y peores */}
          {player.apps >= 4 && (
            <section className="dash-sheet-section">
              <div className="dash-best-worst">
                <div>
                  <h3>Mejores partidos</h3>
                  {best.map(l => (
                    <div key={l.matchId} className="dash-mini-match">
                      <span>vs {l.rival}<small>{l.date}</small></span>
                      <b className={`dash-pill tier-bg-${ratingTier(l.rating)}`}>{fmt(l.rating, 1)}</b>
                    </div>
                  ))}
                </div>
                <div>
                  <h3>Peores partidos</h3>
                  {worst.map(l => (
                    <div key={l.matchId} className="dash-mini-match">
                      <span>vs {l.rival}<small>{l.date}</small></span>
                      <b className={`dash-pill tier-bg-${ratingTier(l.rating)}`}>{fmt(l.rating, 1)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Historial completo */}
          <section className="dash-sheet-section">
            <h3>Todos sus partidos ({player.apps})</h3>
            <div className="dash-log">
              {player.log.map(l => (
                <div key={l.matchId} className="dash-log-row">
                  <span className={`dash-result result-${l.result}`} title={RESULT_LABELS[l.result]}>{RESULT_SHORT[l.result]}</span>
                  <div className="dash-log-main">
                    <span className="dash-log-rival">
                      {l.mvp && <Star size={13} className="dash-mvp-icon" aria-label="Figura" />}
                      vs {l.rival}
                    </span>
                    <span className="dash-log-meta">
                      {l.date} · {l.score} · {l.competition}
                    </span>
                    <span className="dash-log-stats">
                      {l.minutes}'{!l.starter && ' (ingresó)'}
                      {l.goals > 0 && ` · ⚽${l.goals > 1 ? `×${l.goals}` : ''}`}
                      {l.assists > 0 && ` · 🅰️${l.assists > 1 ? `×${l.assists}` : ''}`}
                      {l.yellow && ' · 🟨'}
                      {l.red && ' · 🟥'}
                      {l.sofascore !== null && ` · SofaScore ${fmt(l.sofascore, 1)}`}
                    </span>
                  </div>
                  <b className={`dash-pill tier-bg-${ratingTier(l.rating)}`}>{fmt(l.rating, 1)}</b>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PlayerDetail;
