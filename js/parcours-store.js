// Parcours par poste : série de thématiques (obligatoires ou internes) définie par l'entreprise pour chaque poste,
// suivi individuel (statut, date, commentaire) et revues de management. Stockage local, comme « Mes formations ».
import { uid, makeToken } from './util.js';

const KEY = 'mrs.parcours.v1';
const empty = () => ({ items: [], suivi: [], reviews: [], tokens: {}, demo: {} });
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Array.isArray(v.items) ? { ...empty(), ...v } : empty(); } catch { return empty(); } };
const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage plein ou indisponible */ } };
const clean = (s, n = 160) => String(s ?? '').trim().slice(0, n);

export const KINDS = { obligatoire: { label: 'Obligatoire', tone: 'navy' }, interne: { label: 'Interne', tone: 'info' } };
export const STATUS_P = { a_faire: { label: 'À faire', tone: '' }, en_cours: { label: 'En cours', tone: 'warn' }, valide: { label: 'Validé', tone: 'ok' } };
export const REVIEW_DAYS = 90;

export const parcoursMethods = {
  async listThematiques(companyId, profileId) {
    return read().items.filter((i) => i.companyId === companyId && (!profileId || i.profileId === profileId)).sort((a, b) => a.order - b.order);
  },
  async saveThematique(t) {
    const d = read();
    const kind = KINDS[t.kind] ? t.kind : 'interne';
    const source = ['theme', 'formation', 'libre'].includes(t.source) ? t.source : 'libre';
    const mine = d.items.filter((i) => i.companyId === t.companyId && i.profileId === t.profileId);
    const row = {
      id: t.id || uid('th'), companyId: t.companyId, profileId: t.profileId, title: clean(t.title), kind, source,
      theme: source === 'theme' ? clean(t.theme) : '', formationId: source === 'formation' ? clean(t.formationId, 60) : '',
      hours: Math.max(0, Math.min(999, Number(t.hours) || 0)), note: clean(t.note, 300), due: Number(t.due) > 0 ? Number(t.due) : null,
      order: t.order ?? (mine.reduce((m, i) => Math.max(m, i.order), 0) + 1), createdAt: t.createdAt || Date.now(),
    };
    const i = d.items.findIndex((x) => x.id === row.id);
    if (i >= 0) d.items[i] = row; else d.items.push(row);
    write(d);
    return row;
  },
  async deleteThematique(id) { const d = read(); d.items = d.items.filter((i) => i.id !== id); d.suivi = d.suivi.filter((s) => s.itemId !== id); write(d); },
  async moveThematique(id, dir) {
    const d = read(); const it = d.items.find((i) => i.id === id); if (!it) return;
    const sib = d.items.filter((i) => i.companyId === it.companyId && i.profileId === it.profileId).sort((a, b) => a.order - b.order);
    const k = sib.findIndex((i) => i.id === id); const o = sib[k + dir]; if (!o) return;
    [it.order, o.order] = [o.order, it.order]; write(d);
  },
  async listSuivi(companyId, employeeId) { return read().suivi.filter((s) => s.companyId === companyId && (!employeeId || s.employeeId === employeeId)); },
  /** status : 'a_faire' | 'en_cours' | 'valide' (fixé par le responsable) ou 'auto' (déduit des examens et inscriptions). due : échéance propre au collaborateur. */
  async setSuivi({ companyId, employeeId, itemId, status, comment, date, due }) {
    const d = read();
    let row = d.suivi.find((s) => s.employeeId === employeeId && s.itemId === itemId);
    if (!row) { if (status === 'auto' && !comment && !due) return null; row = { id: uid('sv'), companyId, employeeId, itemId, status: 'auto', comment: '', due: null }; d.suivi.push(row); }
    if (status !== undefined) row.status = status === 'auto' ? 'auto' : STATUS_P[status] ? status : 'a_faire';
    if (row.status !== 'auto') row.date = date || row.date || Date.now();
    if (comment !== undefined) row.comment = clean(comment, 300);
    if (due !== undefined) row.due = Number(due) > 0 ? Number(due) : null;
    row.updatedAt = Date.now();
    if (row.status === 'auto' && !row.comment && !row.due) { d.suivi = d.suivi.filter((s) => s !== row); write(d); return null; }
    write(d);
    return row;
  },
  async listReviews(companyId) { return read().reviews.filter((r) => r.companyId === companyId); },
  async saveReview({ companyId, employeeId, last, next, note }) {
    const d = read();
    let r = d.reviews.find((x) => x.employeeId === employeeId);
    if (!r) { r = { companyId, employeeId, last: null, next: null, note: '' }; d.reviews.push(r); }
    if (last !== undefined) r.last = last; if (next !== undefined) r.next = next; if (note !== undefined) r.note = clean(note, 600);
    write(d);
    return r;
  },
  /** Jeton du lien personnel d'un collaborateur (créé à la demande). */
  async employeeToken(employeeId) {
    const d = read();
    let t = Object.keys(d.tokens).find((k) => d.tokens[k] === employeeId);
    if (!t) { t = makeToken(); d.tokens[t] = employeeId; write(d); }
    return t;
  },
  async employeeIdByToken(token) { return read().tokens[token] || null; },
  async parcoursCompanyIds() { return [...new Set(read().items.map((i) => i.companyId))]; },
  async parcoursDemoDone(companyId) { return !!read().demo[companyId]; },
  async markParcoursDemo(companyId) { const d = read(); d.demo[companyId] = true; write(d); },
  async clearParcours(companyId) { const d = read(); d.items = d.items.filter((i) => i.companyId !== companyId); d.suivi = d.suivi.filter((s) => s.companyId !== companyId); d.reviews = d.reviews.filter((r) => r.companyId !== companyId); write(d); },
};
