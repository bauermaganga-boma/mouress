// Pass : tarification par niveau de poste et limites de tentatives.
import { CONFIG } from '../config.js';
import { addMonths } from './util.js';

const DAY = 86400000;

/** Prix d'un Pass (FCFA) selon le niveau du poste. Le niveau inconnu retombe sur le tarif technicien. */
export const passPrice = (level) => CONFIG.PASS_PRICES[level] ?? CONFIG.PASS_PRICES.tech;

/** Tentatives d'examen terminées ou en cours (hors données de démonstration synthétiques) comptées sur un Pass. */
export function attemptsUsed(attempts) {
  return (attempts || []).filter((a) => a.status === 'done' || (a.status === 'in_progress' && !a.synthetic)).length;
}
export const attemptsLeft = (attempts) => Math.max(0, CONFIG.ATTEMPTS_PER_PASS - attemptsUsed(attempts));

/** Validité d'une attestation : mois (profil ou défaut), date d'expiration, jours restants, statut valid | soon | expired. */
export function validity(cert, profile, now = Date.now()) {
  const months = Number(profile?.validityMonths) > 0 ? Number(profile.validityMonths) : CONFIG.VALIDITY_MONTHS_DEFAULT;
  const until = addMonths(cert.date, months);
  const days = Math.ceil((until - now) / DAY);
  const status = until < now ? 'expired' : days <= CONFIG.ALERT_DAYS ? 'soon' : 'valid';
  return { months, until, days, status };
}

export const COMPLIANCE = {
  valid: { label: 'Valide', tone: 'ok' },
  soon: { label: 'Expire bientôt', tone: 'warn' },
  expired: { label: 'Expirée', tone: 'ko' },
  planned: { label: 'Planifiée', tone: 'info' },
  todo: { label: 'À planifier', tone: '' },
};
const RANK = { expired: 3, soon: 2, valid: 1 };

/** Habilitations d'un collaborateur : dernière attestation par profil, avec sa validité. */
export function habilitations(certs, profilesById, now = Date.now()) {
  const latest = new Map();
  for (const c of [...certs].sort((a, b) => a.date - b.date)) latest.set(c.profileId, c);
  return [...latest.values()].map((c) => ({ cert: c, profile: profilesById.get(c.profileId), v: validity(c, profilesById.get(c.profileId), now) }));
}

/** Pastille de conformité : pire statut des habilitations ; sinon planifiée (plan actif) ou à planifier. */
export function compliance(habs, plans = []) {
  if (habs.length) return habs.reduce((w, h) => (RANK[h.v.status] > RANK[w] ? h.v.status : w), 'valid');
  return plans.some((p) => p.status !== 'done') ? 'planned' : 'todo';
}
