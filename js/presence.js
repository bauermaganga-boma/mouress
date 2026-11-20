// Présence : où est chaque collaborateur aujourd'hui (base, site à terre, offshore, repos, congé…), selon son régime de rotation.
// Aptitude à intervenir : déduite de ses habilitations. Tout est calculé à partir de la fiche ; aucune saisie quotidienne.
const DAY = 86400000;

export const LIEUX = {
  base: { label: 'Base', tone: '', icon: 'building' },
  site: { label: 'Site', tone: 'ok', icon: 'pin' },
  offshore: { label: 'Offshore', tone: 'info', icon: 'ship' },
  repos: { label: 'Repos', tone: '', icon: 'home' },
  conge: { label: 'Congé', tone: 'warn', icon: 'calendar' },
  maladie: { label: 'Arrêt', tone: 'warn', icon: 'calendar' },
  deplacement: { label: 'Déplacement', tone: 'info', icon: 'pin' },
  formation: { label: 'Formation', tone: 'info', icon: 'book' },
};
export const ABSENCES = { conge: 'Congé', maladie: 'Arrêt maladie', deplacement: 'Déplacement', formation: 'En formation' };
export const REGIMES = { sedentaire: 'Sédentaire (horaires de bureau)', '14/14': 'Rotation 14 jours / 14 jours', '21/21': 'Rotation 21 jours / 21 jours', '28/28': 'Rotation 28 jours / 28 jours', '7/7': 'Rotation 7 jours / 7 jours' };
export const WORK_PLACES = { site: 'Site à terre', offshore: 'Offshore' };

const day0 = (ts) => { const d = new Date(ts); d.setHours(12, 0, 0, 0); return d.getTime(); };
export const regimeDays = (r) => { const m = /^(\d+)\/(\d+)$/.exec(r || ''); return m ? [Number(m[1]), Number(m[2])] : null; };

/**
 * Situation d'une personne à une date : { lieu, label, place, day, total, until, next }.
 * until = date de fin de la situation actuelle ; next = ce qui suit (libellé).
 */
export function whereIs(o = {}, now = Date.now()) {
  const base = o.base || '';
  const a = o.absence;
  if (a && a.type && a.from && a.to && day0(a.from) <= day0(now) && day0(now) <= day0(a.to) + DAY - 1) {
    return { lieu: a.type, label: LIEUX[a.type]?.label || a.type, place: base, until: a.to, total: Math.round((a.to - a.from) / DAY) + 1, day: Math.floor((day0(now) - day0(a.from)) / DAY) + 1, next: 'retour' };
  }
  const rd = regimeDays(o.regime);
  if (!rd || !o.cycleStart) return { lieu: 'base', label: 'Base', place: base, until: null, next: '' };
  const [on, off] = rd; const len = on + off;
  const pos = (((day0(now) - day0(o.cycleStart)) / DAY) % len + len) % len;
  const cycleBegin = day0(now) - Math.floor(pos) * DAY;
  if (pos < on) {
    const lieu = o.workPlace === 'site' ? 'site' : 'offshore';
    return { lieu, label: LIEUX[lieu].label, place: o.siteName || base, day: Math.floor(pos) + 1, total: on, until: cycleBegin + on * DAY, next: 'relève', phase: 'on', home: base };
  }
  return { lieu: 'repos', label: 'Repos', place: base, day: Math.floor(pos - on) + 1, total: off, until: cycleBegin + len * DAY, next: 'retour sur site', phase: 'off', home: base };
}

/** Prochains changements de situation (relèves, retours) dans les N jours, triés par date. */
export function upcomingChanges(list, days = 14, now = Date.now()) {
  return list.map((x) => ({ ...x, w: x.where }))
    .filter((x) => x.w.until && x.w.until - now <= days * DAY && x.w.next)
    .sort((a, b) => a.w.until - b.w.until);
}

/** Aptitude à intervenir d'après les habilitations (r.habs de loadTeam) : ok / warn / ko. */
export function aptitude(habs = [], now = Date.now()) {
  const exp = habs.filter((h) => h.v.status === 'expired');
  if (exp.length) return { key: 'ko', tone: 'ko', label: 'À retirer', detail: `${exp[0].profile?.name || exp[0].cert.profileId} expirée` };
  const soon = habs.filter((h) => h.v.status === 'soon').sort((a, b) => a.v.until - b.v.until);
  if (soon.length) return { key: 'warn', tone: 'warn', label: `Expire dans ${Math.max(0, soon[0].v.days)} j`, detail: soon[0].profile?.name || soon[0].cert.profileId };
  if (!habs.length) return { key: 'none', tone: '', label: 'Aucune habilitation', detail: '' };
  return { key: 'ok', tone: 'ok', label: 'Apte à intervenir', detail: '' };
}

/** Libellé court d'une situation : « Base Port-Gentil », « Offshore · Plateforme Mandji », « Repos ». */
export const lieuText = (w) => (w.lieu === 'base' ? (w.place || 'Base') : w.lieu === 'repos' ? 'Repos' : `${LIEUX[w.lieu]?.label || w.label}${w.place ? ' · ' + w.place : ''}`);
