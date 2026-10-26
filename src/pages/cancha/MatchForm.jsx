import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Loader } from 'lucide-react';
import { uniq, ownPlayers, rivalPlayers } from './canchaStats';

const EMPTY = {
  fecha: '', rival: '', gf: '', gc: '', comp: '', ronda: '', dt: '', estadio: '', notas: '',
  goles: [], golesRival: [], penales: null,
};

const GoalRows = ({ title, goals, onChange, listId, otherListId }) => (
  <div className="cancha-goals">
    <h4>{title}</h4>
    {goals.map((g, i) => (
      <div key={i} className="cancha-goal-row">
        <input
          value={g.jugador}
          // En un autogol se sugieren jugadores del otro equipo
          list={g.tipo === 'autogol' ? otherListId : listId}
          placeholder="Jugador"
          autoComplete="off"
          onChange={e => onChange(goals.map((x, j) => (j === i ? { ...x, jugador: e.target.value } : x)))}
        />
        <select value={g.tipo} onChange={e => onChange(goals.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))}>
          <option value="gol">Gol</option>
          <option value="penal">Penal</option>
          <option value="autogol">Autogol</option>
        </select>
        <button type="button" className="dash-icon-btn" onClick={() => onChange(goals.filter((_, j) => j !== i))} aria-label="Quitar gol">
          <Trash2 size={16} />
        </button>
      </div>
    ))}
    <button type="button" className="dash-chip" onClick={() => onChange([...goals, { jugador: '', tipo: 'gol' }])}>
      <Plus size={14} /> Agregar gol
    </button>
  </div>
);

const MatchForm = ({ entry, all, clubName, saving, onSave, onClose }) => {
  const [form, setForm] = useState(() => {
    if (entry) {
      return { ...EMPTY, ...entry, gf: String(entry.gf), gc: String(entry.gc), goles: entry.goles || [], golesRival: entry.golesRival || [] };
    }
    // Nuevo: hoy, último DT y estadio más frecuente
    const last = all[0];
    const stadiums = all.map(a => a.estadio).filter(Boolean);
    const topStadium = stadiums.sort((a, b) => stadiums.filter(x => x === b).length - stadiums.filter(x => x === a).length)[0] || '';
    return { ...EMPTY, fecha: new Date().toISOString().slice(0, 10), dt: last?.dt || '', estadio: topStadium };
  });
  const [penOn, setPenOn] = useState(!!entry?.penales);
  const [error, setError] = useState('');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const lists = useMemo(() => ({
    rival: uniq(all, p => p.rival),
    comp: uniq(all, p => p.comp),
    ronda: uniq(all, p => p.ronda),
    dt: uniq(all, p => p.dt),
    estadio: uniq(all, p => p.estadio),
    own: ownPlayers(all),
    other: rivalPlayers(all),
  }), [all]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  // Al cambiar el resultado se agregan filas de goles vacías hasta igualar
  const setScore = (key, value) => {
    const goalsKey = key === 'gf' ? 'goles' : 'golesRival';
    setForm(f => {
      const n = Number(value) || 0;
      const goals = [...f[goalsKey]];
      while (goals.length < n) goals.push({ jugador: '', tipo: 'gol' });
      return { ...f, [key]: value, [goalsKey]: goals };
    });
  };

  const tie = form.gf !== '' && form.gf === form.gc;
  const filledOwn = form.goles.filter(g => g.jugador.trim()).length;
  const filledRival = form.golesRival.filter(g => g.jugador.trim()).length;
  const mismatch = [
    form.gf !== '' && filledOwn !== Number(form.gf) ? `${clubName}: ${filledOwn} de ${form.gf} goles cargados` : null,
    form.gc !== '' && filledRival !== Number(form.gc) ? `Rival: ${filledRival} de ${form.gc} goles cargados` : null,
  ].filter(Boolean);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fecha || !form.rival.trim() || form.gf === '' || form.gc === '') {
      setError('Completá fecha, rival y resultado');
      return;
    }
    const pen = tie && penOn ? { club: Number(form.penales?.club), rival: Number(form.penales?.rival) } : null;
    if (pen && (isNaN(pen.club) || isNaN(pen.rival) || pen.club === pen.rival)) {
      setError('Los penales tienen que tener un ganador');
      return;
    }
    if (mismatch.length && !window.confirm('La cantidad de goles cargados no coincide con el resultado. ¿Guardar igual?')) return;

    const cleanGoals = goals => goals.filter(g => g.jugador.trim()).map(g => ({ jugador: g.jugador.trim(), tipo: g.tipo }));
    onSave({
      fecha: form.fecha,
      rival: form.rival.trim(),
      gf: Number(form.gf),
      gc: Number(form.gc),
      comp: form.comp.trim(),
      ronda: form.ronda.trim(),
      dt: form.dt.trim(),
      estadio: form.estadio.trim(),
      notas: form.notas.trim(),
      goles: cleanGoals(form.goles),
      golesRival: cleanGoals(form.golesRival),
      penales: pen,
    });
  };

  const field = (key, label, props = {}) => (
    <label className="dash-field">
      <span>{label}</span>
      <input value={form[key]} onChange={e => set(key, e.target.value)} autoComplete="off" {...props} />
    </label>
  );

  return (
    <div className="dash-sheet-overlay" onClick={onClose}>
      <form className="dash-sheet cancha-form" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <header className="dash-sheet-header">
          <div className="dash-sheet-title">
            <div>
              <h2>{entry ? 'Editar partido' : 'Nuevo partido en la cancha'}</h2>
              {entry?.ratingId && <p>Vinculado con tu valoración</p>}
            </div>
          </div>
          <button type="button" className="dash-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
        </header>

        <div className="dash-sheet-body">
          <section className="dash-sheet-section cancha-form-grid">
            {field('fecha', 'Fecha', { type: 'date', required: true })}
            {field('rival', 'Rival', { list: 'cf-rival', required: true })}
            {field('gf', `Goles ${clubName}`, { type: 'number', min: 0, inputMode: 'numeric', onChange: e => setScore('gf', e.target.value), required: true })}
            {field('gc', 'Goles rival', { type: 'number', min: 0, inputMode: 'numeric', onChange: e => setScore('gc', e.target.value), required: true })}
            {tie && (
              <div className="cancha-pen">
                <label className="cancha-check">
                  <input type="checkbox" checked={penOn} onChange={e => setPenOn(e.target.checked)} /> Hubo penales
                </label>
                {penOn && (
                  <>
                    <input type="number" min="0" placeholder={clubName} value={form.penales?.club ?? ''} onChange={e => set('penales', { ...form.penales, club: e.target.value })} />
                    <input type="number" min="0" placeholder="Rival" value={form.penales?.rival ?? ''} onChange={e => set('penales', { ...form.penales, rival: e.target.value })} />
                  </>
                )}
              </div>
            )}
            {field('comp', 'Competencia', { list: 'cf-comp' })}
            {field('ronda', 'Ronda', { list: 'cf-ronda' })}
            {field('dt', 'DT', { list: 'cf-dt' })}
            {field('estadio', 'Estadio', { list: 'cf-estadio' })}
            <div className="cancha-full">{field('notas', 'Notas', { placeholder: 'Con quién fui, qué pasó…' })}</div>
          </section>

          <section className="dash-sheet-section cancha-goals-wrap">
            <GoalRows title={`⚽ Goles de ${clubName}`} goals={form.goles} onChange={v => set('goles', v)} listId="cf-own" otherListId="cf-other" />
            <GoalRows title="Goles del rival" goals={form.golesRival} onChange={v => set('golesRival', v)} listId="cf-other" otherListId="cf-own" />
            <p className="dash-muted cancha-hint">
              En un <b>autogol</b>, poné el nombre de quien la metió en contra, en la lista del equipo que se benefició.
            </p>
          </section>

          {mismatch.length > 0 && <p className="cancha-warn">{mismatch.join(' · ')}</p>}
          {error && <p className="cancha-warn">{error}</p>}

          <div className="dash-share-actions">
            <button type="button" className="dash-share-btn secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="dash-share-btn primary" disabled={saving}>
              {saving ? <><Loader size={18} className="spinner" /> Guardando…</> : 'Guardar'}
            </button>
          </div>
        </div>

        {Object.entries({ rival: lists.rival, comp: lists.comp, ronda: lists.ronda, dt: lists.dt, estadio: lists.estadio, own: lists.own, other: lists.other }).map(([k, vals]) => (
          <datalist key={k} id={`cf-${k}`}>{vals.map(v => <option key={v} value={v} />)}</datalist>
        ))}
      </form>
    </div>
  );
};

export default MatchForm;
