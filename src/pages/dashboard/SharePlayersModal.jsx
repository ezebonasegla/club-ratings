import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Copy, Check, Share2, Download, Loader, Minus, Plus } from 'lucide-react';
import { POSITIONS, SORT_OPTIONS, ratingTier, fmt, fmtSigned } from './stats';

// Valor que se muestra junto a cada jugador según el criterio de orden
const METRICS = {
  avg: { label: 'Prom.', get: p => fmt(p.avg, 2), tier: p => p.avg },
  form: { label: 'Forma', get: p => fmt(p.form, 2), tier: p => p.form },
  trend: { label: 'Tend.', get: p => fmtSigned(p.trend, 2) },
  apps: { label: 'PJ', get: p => p.apps },
  minutes: { label: 'Min', get: p => p.minutes },
  goals: { label: 'Goles', get: p => p.goals },
  assists: { label: 'Asist.', get: p => p.assists },
  ga: { label: 'G+A', get: p => p.goals + p.assists },
  mvp: { label: 'Figura', get: p => p.mvp },
  max: { label: 'Máx', get: p => fmt(p.max, 1), tier: p => p.max },
  min: { label: 'Mín', get: p => fmt(p.min, 1), tier: p => p.min },
  consistency: { label: 'Desvío', get: p => fmt(p.std, 2) },
  sofaDiff: { label: 'vs Sofa', get: p => fmtSigned(p.sofaDiff, 2) },
  starts: { label: 'Titular', get: p => `${Math.round(p.startPct * 100)}%` },
  cards: { label: 'Tarj.', get: p => `${p.yellow}🟨${p.red ? ` ${p.red}🟥` : ''}` },
  name: { label: 'Prom.', get: p => fmt(p.avg, 2), tier: p => p.avg },
};

const QUICK_COUNTS = [3, 5, 10, 15];

const SharePlayersModal = ({ players, sortBy, sortDir, club, filtersLabel, onClose }) => {
  const cardRef = useRef(null);
  const [count, setCount] = useState(Math.min(10, players.length));
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

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

  const metric = METRICS[sortBy] || METRICS.avg;
  const showAvgToo = !['avg', 'name'].includes(sortBy);
  const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Promedio';
  const shown = useMemo(() => players.slice(0, count), [players, count]);
  const reversed = sortDir !== (SORT_OPTIONS.find(o => o.value === sortBy)?.dir || 'desc');
  const title = `Ranking por ${sortLabel.toLowerCase()}${reversed ? ' (invertido)' : ''}`;
  const fileName = `ranking-${(club?.shortName || 'club').toLowerCase().replace(/\s+/g, '-')}-${sortBy}.png`;

  const buildText = () => {
    const medal = i => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`);
    let text = `⚽ ${club?.name || 'Mi Equipo'} — ${title}\n`;
    if (filtersLabel) text += `📋 ${filtersLabel}\n`;
    text += '\n';
    shown.forEach((p, i) => {
      text += `${medal(i)} ${p.name}: ${metric.get(p)}`;
      if (showAvgToo) text += ` (prom. ${fmt(p.avg, 2)})`;
      text += ` · ${p.apps} PJ\n`;
    });
    return text + '\nClub Ratings App';
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = (blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImage = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${club?.name || 'Mi Equipo'} — ${title}`, text: buildText() });
        } catch (error) {
          if (error.name !== 'AbortError') download(blob);
        }
      } else {
        download(blob);
      }
    } catch (error) {
      console.error('Error generando imagen:', error);
      alert('Error al generar la imagen');
    } finally {
      setGenerating(false);
    }
  };

  const canShareNatively = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="dash-sheet-overlay" onClick={onClose}>
      <div className="dash-sheet dash-share-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Compartir ranking">
        <header className="dash-sheet-header">
          <div className="dash-sheet-title">
            <div>
              <h2>Compartir ranking</h2>
              <p>{sortLabel} · {players.length} jugadores disponibles</p>
            </div>
          </div>
          <button className="dash-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </header>

        <div className="dash-sheet-body">
          {/* Cantidad de jugadores */}
          <div className="dash-sheet-section dash-share-count">
            <div className="dash-share-count-row">
              <span>Jugadores a compartir</span>
              <div className="dash-stepper">
                <button onClick={() => setCount(n => Math.max(1, n - 1))} disabled={count <= 1} aria-label="Menos">
                  <Minus size={14} />
                </button>
                <b>{count}</b>
                <button onClick={() => setCount(n => Math.min(players.length, n + 1))} disabled={count >= players.length} aria-label="Más">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="dash-chips">
              {QUICK_COUNTS.filter(n => n < players.length).map(n => (
                <button key={n} className={`dash-chip ${count === n ? 'active' : ''}`} onClick={() => setCount(n)}>
                  Top {n}
                </button>
              ))}
              <button className={`dash-chip ${count === players.length ? 'active' : ''}`} onClick={() => setCount(players.length)}>
                Todos ({players.length})
              </button>
            </div>
          </div>

          {/* Tarjeta que se exporta como imagen (siempre clara) */}
          <div className="pshare-wrap">
            <div className="pshare-card" ref={cardRef}>
              <div
                className="pshare-header"
                style={{ background: club?.colors?.primary || '#E30613', color: club?.colors?.text || '#fff' }}
              >
                <strong>{club?.name || 'Mi Equipo'}</strong>
                <span>{title}</span>
              </div>
              {filtersLabel && <div className="pshare-filters">{filtersLabel}</div>}
              <div className="pshare-cols">
                <span>#</span>
                <span>Jugador</span>
                <span>PJ</span>
                {showAvgToo && <span>Prom.</span>}
                <span>{metric.label}</span>
              </div>
              {shown.map((p, i) => {
                const tierValue = metric.tier ? metric.tier(p) : null;
                return (
                  <div key={p.id} className={`pshare-row ${i < 3 ? 'top' : ''}`}>
                    <span className="pshare-rank">{i + 1}</span>
                    <span className="pshare-name">
                      <span>{p.name}</span>
                      {POSITIONS[p.position] && <small>{POSITIONS[p.position].short}</small>}
                    </span>
                    <span className="pshare-apps">{p.apps}</span>
                    {showAvgToo && <span className="pshare-apps">{fmt(p.avg, 2)}</span>}
                    <span className={`pshare-value ${tierValue !== null ? `pshare-tier-${ratingTier(tierValue)}` : ''}`}>
                      {metric.get(p)}
                    </span>
                  </div>
                );
              })}
              <div className="pshare-footer">Club Ratings App</div>
            </div>
          </div>

          <div className="dash-share-actions">
            <button className="dash-share-btn secondary" onClick={handleCopy} disabled={generating}>
              {copied ? <><Check size={18} /> Copiado</> : <><Copy size={18} /> Copiar texto</>}
            </button>
            <button className="dash-share-btn primary" onClick={handleImage} disabled={generating}>
              {generating ? (
                <><Loader size={18} className="spinner" /> Generando...</>
              ) : canShareNatively ? (
                <><Share2 size={18} /> Compartir imagen</>
              ) : (
                <><Download size={18} /> Descargar imagen</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharePlayersModal;
