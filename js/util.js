// Utilitaires partagés. Toute donnée utilisateur affichée passe par esc().

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function randomInt(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans I, L, O, 0, 1 (lisibilité)
export function randomString(n, alphabet = ALPHA) {
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[randomInt(alphabet.length)];
  return s;
}
export const uid = (prefix = 'id') => `${prefix}_${randomString(10, 'abcdefghjkmnpqrstuvwxyz23456789')}`;
export const makeToken = () => randomString(14, 'abcdefghjkmnpqrstuvwxyz23456789');

export function certCode(date = new Date()) {
  return `MRS-${date.getFullYear()}-${randomString(6)}`;
}
export const CODE_RE = /^MRS-\d{4}-[A-Z0-9]{6}$/;

export function fmtDate(ts, withTime = false) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  const opts = withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'long', year: 'numeric' };
  return d.toLocaleDateString('fr-FR', opts);
}
export function fmtDateInput(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtDuration(ms) {
  if (ms == null || isNaN(ms)) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`;
}
export function fmtMoney(n, cur = 'FCFA') {
  const NB = String.fromCharCode(160);
  const digits = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  return digits + NB + cur;
}
export function fmtClock(s) {
  s = Math.max(0, Math.ceil(s));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`;
}
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'plain:' + text;
  }
}

export function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim()); }

export function absUrl(hash) {
  return location.origin === 'null' || location.protocol === 'file:'
    ? location.href.split('#')[0] + hash
    : location.origin + location.pathname + hash;
}

export function downloadFile(name, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }
}

export function csvCell(v) {
  const s = String(v ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');

/** Mini-rendu : paragraphes, listes « - », gras **mot**. Le texte est échappé avant. */
export function mdLite(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    let out = '';
    let list = [];
    let para = [];
    const flushPara = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>`; para = []; } };
    const flushList = () => { if (list.length) { out += `<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`; list = []; } };
    for (const l of lines) {
      if (/^[-•]\s+/.test(l)) { flushPara(); list.push(l.replace(/^[-•]\s+/, '')); }
      else { flushList(); para.push(l); }
    }
    flushPara(); flushList();
    return out;
  }).join('');
}

/** Ajoute n mois à un horodatage (le 31 + 1 mois tombe sur le dernier jour du mois suivant). */
export function addMonths(ts, n) {
  const d = new Date(ts);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);
  return d.getTime();
}
