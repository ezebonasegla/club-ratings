/**
 * Genera src/styles/dark.css a partir de los CSS de la app.
 *
 * Para cada regla que define colores, emite la misma regla bajo
 * :root[data-theme="dark"] con los colores neutros invertidos (fondos claros →
 * oscuros, textos oscuros → claros). Se re-emiten TODAS las declaraciones de
 * color de cada regla (aunque no cambien) para que el orden de prioridad entre
 * reglas se mantenga igual que en el tema claro.
 *
 * Uso: npm run dark-css   (volver a correrlo cuando se cambien estilos)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const OUT = join(SRC, 'styles', 'dark.css');
const PREFIX = ':root[data-theme="dark"]';

// La tarjeta que se exporta como imagen al compartir se mantiene clara
const EXCLUDED_SELECTOR = /\.(share-(card|preview|rival|score|details|stats?|top-players|player-row|footer|subtitle|match-info)|player-rank|player-name-share|player-rating-share|pshare-)/;
const EXCLUDED_FILES = [/dark(-overrides)?\.css$/];

const COLOR_PROPS = /^(color|background|background-color|background-image|background-repeat|background-position|background-size|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke|caret-color|accent-color|--[\w-]+)$/;

// ---------- utilidades de color ----------
const clamp = (x) => Math.min(1, Math.max(0, x));

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
};

const hslToRgb = (h, s, l) => {
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map(x => Math.round(clamp(x) * 255));
};

const toHex = ([r, g, b]) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

// kind: 'text' (color), 'surface' (fondos, bordes) o 'any' (variables CSS)
const transformRgb = (r, g, b, a = 1, kind = 'any') => {
  if (a < 0.5) return null; // sombras, overlays y tintes translúcidos: sin cambios
  const [h, s, l] = rgbToHsl(r, g, b);
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  let out;
  if (chroma < 0.1) {
    // Lo que ya funciona sobre oscuro se deja: texto claro, fondos oscuros
    if (kind === 'text' && l >= 0.55) return null;
    if (kind === 'surface' && l < 0.5) return null;
    // Neutros: invertir luminosidad con un leve tinte azulado
    out = hslToRgb(222, 0.1, 0.08 + (1 - l) * 0.84);
  } else if (l >= 0.85 && kind !== 'text') {
    // Tintes claros (fondos de éxito/error/info): versión oscura del mismo tono
    out = hslToRgb(h, Math.min(s, 0.4), 0.17);
  } else if (kind === 'text' && l < 0.45) {
    // Texto oscuro con color: aclararlo para que se lea sobre fondo oscuro
    out = hslToRgb(h, Math.min(s, 0.75), 0.68);
  } else {
    return null; // colores de marca / estados: se mantienen
  }
  if (a < 1) return `rgba(${out.join(', ')}, ${a})`;
  return toHex(out);
};

const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };

const COLOR_RE = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)|\b(white|black)\b/gi;

const transformValue = (value, kind = 'any') =>
  value.replace(COLOR_RE, (match, hex, r, g, b, a, named) => {
    let rgb, alpha = 1;
    if (hex) {
      let h = hex;
      if (h.length <= 4) h = h.split('').map(c => c + c).join('');
      rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
      if (h.length === 8) alpha = parseInt(h.slice(6, 8), 16) / 255;
    } else if (r !== undefined) {
      rgb = [r, g, b].map(Number);
      if (a !== undefined) alpha = a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
    } else if (named) {
      rgb = NAMED[named.toLowerCase()];
    }
    return transformRgb(...rgb, alpha, kind) ?? match;
  });

// ---------- parser CSS mínimo ----------
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

const splitTopLevel = (str, sep) => {
  const parts = [];
  let depth = 0, quote = null, cur = '';
  for (const ch of str) {
    if (quote) { if (ch === quote) quote = null; cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
};

const parseBlock = (css) => {
  const nodes = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (prelude.startsWith('@media') || prelude.startsWith('@supports')) {
      nodes.push({ type: 'at', prelude, children: parseBlock(body) });
    } else if (!prelude.startsWith('@')) {
      nodes.push({ type: 'rule', selector: prelude, body });
    }
    i = j;
  }
  return nodes;
};

const prefixSelector = (selector) =>
  splitTopLevel(selector, ',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      if (s.startsWith(':root')) return PREFIX + s.slice(5);
      if (/^html\b/.test(s)) return `html[data-theme="dark"]${s.slice(4)}`;
      return `${PREFIX} ${s}`;
    })
    .join(',\n');

const renderNodes = (nodes, indent = '') => {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'at') {
      const inner = renderNodes(node.children, indent + '  ');
      if (inner.trim()) out += `${indent}${node.prelude} {\n${inner}${indent}}\n\n`;
      continue;
    }
    if (EXCLUDED_SELECTOR.test(node.selector)) continue;
    const decls = splitTopLevel(node.body, ';')
      .map(d => d.trim())
      .filter(Boolean)
      .map(d => {
        const idx = d.indexOf(':');
        return idx === -1 ? null : { prop: d.slice(0, idx).trim(), value: d.slice(idx + 1).trim() };
      })
      .filter(d => d && COLOR_PROPS.test(d.prop));
    if (decls.length === 0) continue;

    // Se emite aunque no cambie nada: así una regla más específica con el color
    // del club (p. ej. un botón activo) sigue ganándole a un fondo base oscurecido
    const transformed = decls.map(d => ({
      ...d,
      next: transformValue(d.value, d.prop === 'color' ? 'text' : d.prop.startsWith('--') ? 'any' : 'surface'),
    }));

    const sel = prefixSelector(node.selector).split('\n').map(l => indent + l).join('\n');
    out += `${sel} {\n${transformed.map(d => `${indent}  ${d.prop}: ${d.next};`).join('\n')}\n${indent}}\n\n`;
  }
  return out;
};

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : path.endsWith('.css') ? [path] : [];
});

const files = walk(SRC).filter(f => !EXCLUDED_FILES.some(re => re.test(f))).sort();
let output = `/* ARCHIVO GENERADO por scripts/generate-dark-css.mjs — no editar a mano.\n   Ajustes manuales del modo oscuro: src/styles/dark-overrides.css */\n\n`;
output += `${PREFIX} {\n  color-scheme: dark;\n}\n\n`;
for (const file of files) {
  const css = renderNodes(parseBlock(stripComments(readFileSync(file, 'utf8'))));
  if (css.trim()) output += `/* ---- ${relative(SRC, file)} ---- */\n${css}`;
}
writeFileSync(OUT, output);
console.log(`Generado ${relative(ROOT, OUT)} (${files.length} archivos procesados)`);
