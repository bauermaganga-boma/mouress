// Formations propres à l'entreprise (titre libre) et inscription des collaborateurs.
// Stockage local au navigateur (comme le reste du mode démo) ; même interface quel que soit le store principal.
import { uid } from './util.js';

const KEY = 'mrs.formations.v1';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Array.isArray(v.formations) ? v : { formations: [], records: [] }; } catch { return { formations: [], records: [] }; } };
const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage plein ou indisponible */ } };
const clean = (s, n = 200) => String(s ?? '').trim().slice(0, n);

export const CATEGORIES = ['Sécurité', 'Technique', 'Réglementaire', 'Management', 'Langues', 'Qualité / HSE', 'Autre'];
export const MODES = { presentiel: 'Présentiel', elearning: 'E-learning', mixte: 'Mixte' };
export const REC_STATUS = { planned: { label: 'Planifiée', tone: 'info' }, in_progress: { label: 'En cours', tone: 'warn' }, done: { label: 'Terminée', tone: 'ok' } };
export const SUGGESTIONS = ['Habilitation électrique', 'Travail en hauteur', 'Secourisme (SST)', 'Lutte contre l’incendie', 'Espaces confinés', 'Permis de travail', 'Conduite d’engins', 'Anglais technique', 'Management d’équipe', 'Sensibilisation H2S'];

export const formationMethods = {
  async listFormations(companyId) { return read().formations.filter((f) => f.companyId === companyId).sort((a, b) => a.title.localeCompare(b.title)); },
  async getFormation(id) { return read().formations.find((f) => f.id === id) || null; },
  async saveFormation(f) {
    const d = read();
    const row = {
      id: f.id || uid('f'), companyId: f.companyId, title: clean(f.title, 120), category: CATEGORIES.includes(f.category) ? f.category : 'Autre',
      hours: Math.max(0, Math.min(999, Number(f.hours) || 0)), provider: clean(f.provider, 120), mode: MODES[f.mode] ? f.mode : 'presentiel',
      validityMonths: Math.max(0, Math.min(120, parseInt(f.validityMonths, 10) || 0)), url: /^https?:\/\//i.test(f.url || '') ? clean(f.url, 500) : '',
      description: clean(f.description, 1200), createdAt: f.createdAt || Date.now(),
    };
    const i = d.formations.findIndex((x) => x.id === row.id);
    if (i >= 0) d.formations[i] = row; else d.formations.push(row);
    write(d);
    return row;
  },
  async deleteFormation(id) {
    const d = read();
    d.formations = d.formations.filter((f) => f.id !== id);
    d.records = d.records.filter((r) => r.formationId !== id);
    write(d);
  },
  async listFormationRecords(companyId, { employeeId, formationId } = {}) {
    return read().records.filter((r) => r.companyId === companyId && (!employeeId || r.employeeId === employeeId) && (!formationId || r.formationId === formationId));
  },
  async saveFormationRecord(r) {
    const d = read();
    const status = REC_STATUS[r.status] ? r.status : 'planned';
    let row = d.records.find((x) => (r.id ? x.id === r.id : x.formationId === r.formationId && x.employeeId === r.employeeId));
    const fields = { companyId: r.companyId, formationId: r.formationId, employeeId: r.employeeId, status, date: r.date || null, doneAt: status === 'done' ? (r.doneAt || r.date || Date.now()) : null, note: clean(r.note, 300) };
    if (row) Object.assign(row, fields); else { row = { id: uid('fr'), createdAt: Date.now(), ...fields }; d.records.push(row); }
    write(d);
    return row;
  },
  async deleteFormationRecord(id) { const d = read(); d.records = d.records.filter((r) => r.id !== id); write(d); },
};
