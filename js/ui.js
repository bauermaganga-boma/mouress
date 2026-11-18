// Composants d'interface : fonctions qui renvoient du HTML (données échappées).
import { esc } from './util.js';
import { imgSrc } from './data.js';

const P = {
  rig: '<path d="M12 3 6 21M12 3l6 18M8.5 14h7M10 9h4M4 21h16M12 3v3"/>',
  refinery: '<path d="M4 21V9l4-3v15M8 21V12h5v9M13 21V7h3v14M16 21v-9h4v9M3 21h18M14.5 7V3"/>',
  mine: '<path d="M3 20l5-9 3 5 3-7 7 11H3zM9 20l2-4"/>',
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
  started: { label: 'En cours', tone: 'info' },
  passed: { label: 'Réussi', tone: 'ok' },
  failed: { label: 'Échoué', tone: 'ko' },
  expired: { label: 'Expiré', tone: 'warn' },
};
export const statusBadge = (s) => badge((STATUS[s] || STATUS.invited).label, (STATUS[s] || STATUS.invited).tone);

export function whatsappLink(text) { return `https://wa.me/?text=${encodeURIComponent(text)}`; }
