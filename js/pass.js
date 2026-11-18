// Pass : tarification par niveau de poste et limites de tentatives.
import { CONFIG } from '../config.js';

/** Prix d'un Pass (FCFA) selon le niveau du poste. Le niveau inconnu retombe sur le tarif technicien. */
export const passPrice = (level) => CONFIG.PASS_PRICES[level] ?? CONFIG.PASS_PRICES.tech;

/** Tentatives d'examen terminées ou en cours (hors données de démonstration synthétiques) comptées sur un Pass. */
export function attemptsUsed(attempts) {
  return (attempts || []).filter((a) => a.status === 'done' || (a.status === 'in_progress' && !a.synthetic)).length;
}
export const attemptsLeft = (attempts) => Math.max(0, CONFIG.ATTEMPTS_PER_PASS - attemptsUsed(attempts));
