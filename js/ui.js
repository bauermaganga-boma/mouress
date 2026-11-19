// Composants d'interface : fonctions qui renvoient du HTML (données échappées).
import { esc } from './util.js';
import { imgSrc } from './data.js';

const P = {
  rig: '<path d="M12 3 6 21M12 3l6 18M8.5 14h7M10 9h4M4 21h16M12 3v3"/>',
  refinery: '<path d="M4 21V9l4-3v15M8 21V12h5v9M13 21V7h3v14M16 21v-9h4v9M3 21h18M14.5 7V3"/>',
  mine: '<path d="M3 20l5-9 3 5 3-7 7 11H3zM9 20l2-4"/>',
  ship: '<path d="M3 15l2 5h14l2-5-9-3-9 3zM12 12V4h5v3h-5M7 10h3M5 20c2 1.5 4 1.5 7 0 3 1.5 5 1.5 7 0"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM8.5 12l2.5 2.5 5-5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 0 2 2h13"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.5 2.3 3.5 5.2"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  whatsapp: '<path d="M3 21l1.6-5A8.5 8.5 0 1 1 8 19.5L3 21z"/><path d="M9 8.5c0 3 2.5 5.5 5.5 6l1-1.5-2-1-1 .7a4 4 0 0 1-1.7-1.7l.7-1-1-2L9 8.5z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
  print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/>',
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 21l5-3 5 3-1.5-7"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  mobile: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z" transform="translate(-1 -1)"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  login: '<path d="M14 4h5v16h-5M9 8l-4 4 4 4M5 12h11"/>',
  zoom: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8.5v5M8.5 11h5"/>',
  factory: '<path d="M3 21V10l6 4V10l6 4V7h3v14M3 21h18M7 17h2M12 17h2M17 17h1"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
};

export function icon(name, size = 20, cls = '') {
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || P.info}</svg>`;
}

export const badge = (text, tone = '') => `<span class="badge ${tone ? 'badge-' + tone : ''}">${esc(text)}</span>`;

export function bar(percent, tone = '') {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return `<div class="bar ${tone ? 'bar-' + tone : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><span style="width:${p}%"></span></div>`;
}

/** Figure illustrée (question ou cours) ; clic = zoom. Renvoie '' si le chemin est invalide. */
export function figure(img, alt, cls = '') {
  const src = imgSrc(img);
  if (!src) return '';
  return `<figure class="qfig ${cls}"><button type="button" class="qfig-btn" data-zoom="${esc(src)}" data-alt="${esc(alt || '')}" aria-label="Agrandir l'image : ${esc(alt || 'illustration')}">
    <img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" decoding="async">
    <span class="qfig-zoom">${icon('zoom', 16)} Agrandir</span></button></figure>`;
}

export function emptyState(title, text, action = '') {
  return `<div class="empty card"><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>${action}</div>`;
}

export function comingSoon(name = '') {
  return `<div class="empty card coming-soon"><div class="coming-ico">${icon('clock', 28)}</div>
    <h3>Contenu bientôt disponible</h3>
    <p class="muted">${name ? `Le contenu du profil « ${esc(name)} » est en cours de validation par nos experts.` : 'Ce contenu est en cours de validation par nos experts.'} Revenez très bientôt, ou contactez-nous pour une mise à disposition prioritaire.</p>
    <div class="btn-row"><a class="btn btn-outline" href="#/formation">Voir les autres profils</a></div></div>`;
}

export function sectorIcon(sector, size = 24) {
  return icon(sector?.icon || 'briefcase', size);
}

export function logo(variant = 'clair', cls = '') {
  const f = variant === 'sombre'
    ? 'mouress-logo-horizontal-couleur-pour-fond-sombre.svg'
    : 'mouress-logo-horizontal-couleur-pour-fond-clair.svg';
  return `<img class="${cls}" src="assets/logo/${f}" alt="MOURESS" width="160" height="36">`;
}

export function scoreRing(percent, passed) {
  const r = 52; const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
  const col = passed ? 'var(--c-ok)' : 'var(--c-ko)';
  return `<div class="ring" role="img" aria-label="Score : ${percent} %">
    <svg viewBox="0 0 120 120" width="140" height="140"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--c-surface-2)" stroke-width="12"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 60 60)"/></svg>
    <div class="ring-val"><strong>${percent}%</strong></div></div>`;
}

export const STATUS = {
  invited: { label: 'Invité', tone: '' },
  training: { label: 'En formation', tone: 'info' },
  started: { label: 'En examen', tone: 'info' },
  passed: { label: 'Réussi', tone: 'ok' },
  failed: { label: 'Échoué', tone: 'ko' },
  expired: { label: 'Expiré', tone: 'warn' },
};
export const statusBadge = (s) => badge((STATUS[s] || STATUS.invited).label, (STATUS[s] || STATUS.invited).tone);

/** Fil d'Ariane cliquable : items = [{label, href?}] (le dernier est la page courante). */
export function crumbs(items) {
  return `<nav class="crumbs" aria-label="Fil d’Ariane">${items.map((c, i) => (c.href && i < items.length - 1
    ? `<a href="${esc(c.href)}">${esc(c.label)}</a><span aria-hidden="true">›</span>`
    : `<span ${i === items.length - 1 ? 'aria-current="page"' : ''}>${esc(c.label)}</span>`)).join('')}</nav>`;
}

/** En-tête de page homogène : fil d'Ariane, bouton retour, titre, texte. */
export function pageHead({ crumbs: c = [], back, title, text = '', actions = '', eyebrow = '' }) {
  return `<header class="page-head2">${c.length ? crumbs(c) : ''}
    ${back ? backLink(back) : ''}
    ${eyebrow ? `<p class="eyebrow dark">${esc(eyebrow)}</p>` : ''}
    <h1 class="page-title">${esc(title)}</h1>${text ? `<p class="page-sub">${esc(text)}</p>` : ''}${actions}</header>`;
}

/** Bouton retour homogène (même aspect partout). */
export const backLink = (href, label = 'Retour') => `<a class="back-link" href="${esc(href)}">${icon('arrow', 16, 'flip')} ${esc(label)}</a>`;

export function whatsappLink(text) { return `https://wa.me/?text=${encodeURIComponent(text)}`; }

// ---------- Avatars : photo du collaborateur si elle existe, sinon portrait illustré (stable pour un même nom) ----------
const hash = (s) => { let h = 2166136261; for (const c of String(s || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const SKIN = ['#6B4A36', '#7A5440', '#8D6249', '#A9785A', '#4E3527', '#C79A7A'];
const HAIR = ['#14110F', '#1E1814', '#2B211A'];
const SHIRT = ['#F28C28', '#0B2C5F', '#1F7A52', '#C0392B', '#2E6DA4'];
const BGS = ['#DCE8F7', '#FBE7CF', '#DDF0E6', '#EBE3F5', '#F6E1E1'];

export function avatarSvg(name) {
  const h = hash(name);
  const skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 3) % HAIR.length], shirt = SHIRT[(h >>> 5) % SHIRT.length], bg = BGS[(h >>> 7) % BGS.length];
  const style = (h >>> 9) % 5; // 0 court, 1 ras, 2 afro, 3 tresses/long, 4 court + barbe
  const helmet = (h >>> 12) % 3 !== 0;
  const helmetCol = ['#F2C200', '#FFFFFF', '#F28C28'][(h >>> 14) % 3];
  const hairShape = style === 1 ? '' : style === 2 ? `<circle cx="50" cy="38" r="22" fill="${hair}"/>` : style === 3 ? `<path d="M27 40c0-17 10-24 23-24s23 7 23 24v22H66V42H34v20H27z" fill="${hair}"/>` : `<path d="M30 40c0-13 8-20 20-20s20 7 20 20c-6-6-12-8-20-8s-14 2-20 8z" fill="${hair}"/>`;
  const beard = style === 4 ? `<path d="M34 50c0 13 7 19 16 19s16-6 16-19c-3 6-8 9-16 9s-13-3-16-9z" fill="${hair}" opacity=".9"/>` : '';
  const hat = helmet ? `<path d="M29 38c0-13 9-21 21-21s21 8 21 21z" fill="${helmetCol}"/><rect x="25" y="37" width="50" height="5" rx="2.5" fill="${helmetCol}" stroke="rgba(0,0,0,.15)"/><rect x="47" y="17" width="6" height="9" rx="2" fill="rgba(0,0,0,.12)"/>` : '';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" fill="${bg}"/>
    <path d="M12 100c0-20 16-30 38-30s38 10 38 30z" fill="${shirt}"/><path d="M38 72l12 12 12-12" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3"/>
    <rect x="43" y="56" width="14" height="16" rx="6" fill="${skin}"/>
    ${style === 2 || style === 3 ? hairShape : ''}
    <ellipse cx="50" cy="44" rx="16" ry="19" fill="${skin}"/>
    ${style !== 2 && style !== 3 ? hairShape : ''}${beard}
    <circle cx="44" cy="44" r="1.8" fill="#1a1a1a"/><circle cx="56" cy="44" r="1.8" fill="#1a1a1a"/><path d="M45 54c3 2.5 7 2.5 10 0" fill="none" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round"/>
    ${hat}</svg>`;
}

/** @param {{name:string, photo?:string}} p  @param {number} size */
export function avatar(p, size = 44) {
  const photo = typeof p?.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(p.photo) ? p.photo : null;
  return `<span class="avatar" style="width:${size}px;height:${size}px">${photo ? `<img src="${photo}" alt="" width="${size}" height="${size}">` : avatarSvg(p?.name)}</span>`;
}
