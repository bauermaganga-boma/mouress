// Langue de l'interface (FR par défaut, EN au choix). Le français est la langue source : en mode anglais, les textes de
// l'interface sont traduits à l'affichage grâce à un dictionnaire (js/i18n-dict.js). Les cours et questions restent
// dans leur langue d'origine (français avec termes techniques anglais ; une partie des contenus pétroliers est en anglais).
import { EXACT, PATTERNS } from './i18n-dict.js';

const KEY = 'mrs.lang';
export const getLang = () => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'fr'; } catch { return 'fr'; } };
export const isEn = () => getLang() === 'en';
export function setLang(l) { try { localStorage.setItem(KEY, l === 'en' ? 'en' : 'fr'); } catch { /* ignore */ } location.reload(); }

const PAT = (PATTERNS || []).map(([r, t]) => { try { return [new RegExp(r), t]; } catch { return null; } }).filter(Boolean);
const norm = (s) => s.replace(/\s+/g, ' ').trim();

/** Traduit une chaîne (en conservant les espaces de début et de fin). Renvoie la chaîne d'origine si rien ne correspond. */
export function tr(s) {
  if (typeof s !== 'string') return s;
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const core = norm(m[2]);
  if (!core) return s;
  const hit = EXACT[core];
  if (hit !== undefined) return m[1] + hit + m[3];
  for (const [re, t] of PAT) if (re.test(core)) return m[1] + core.replace(re, t) + m[3];
  return s;
}

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

export function translateNode(root) {
  if (!isEn() || !root) return;
  if (root.nodeType === 3) { const v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
  if (root.nodeType !== 1) return;
  if (root.closest && root.closest('[data-notr]')) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const todo = [];
  for (let n = walker.currentNode; n; n = walker.nextNode()) todo.push(n);
  for (const n of todo) {
    if (n.nodeType === 3) {
      const p = n.parentElement;
      if (!p || SKIP.has(p.tagName) || p.closest('[data-notr]')) continue;
      const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v;
    } else if (!n.closest('[data-notr]')) {
      for (const a of ATTRS) { const v = n.getAttribute(a); if (v) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } }
    }
  }
}

let started = false;
export function startI18n() {
  document.documentElement.lang = getLang();
  if (!isEn() || started) return;
  started = true;
  translateNode(document.body);
  document.title = tr(document.title);
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateNode(m.target);
      else m.addedNodes.forEach((n) => translateNode(n));
    }
    const t = tr(document.title); if (t !== document.title) document.title = t;
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/** Sélecteur FR | EN pour l'en-tête. */
export function langSwitchHTML() {
  const l = getLang();
  return `<div class="lang-switch" role="group" aria-label="Langue / Language" data-notr>
    <button type="button" data-lang="fr" aria-pressed="${l === 'fr'}" lang="fr" title="Français">FR</button>
    <button type="button" data-lang="en" aria-pressed="${l === 'en'}" lang="en" title="English">EN</button></div>`;
}
