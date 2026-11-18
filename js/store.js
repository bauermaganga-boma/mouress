// Couche données : interface asynchrone unique, deux adaptateurs.
//   - LocalStore    : localStorage (mode démo, par défaut) — testé.
//   - SupabaseStore : js/store-supabase.js, activé si config.js fournit SUPABASE_URL et SUPABASE_ANON_KEY.
//                     ATTENTION : non testé contre une vraie instance Supabase.
//
// Contrat (toutes les méthodes sont async) :
//   init()                                   currentUser()            signUp({companyName,name,email,password})
//   signIn(email,password)                   signOut()                getCompany(id)
//   listSessions(companyId)  -> sessions avec .invitations[] (chacune avec .attempt résumé)
//   getSession(id)           -> session avec .invitations[]
//   createSession({companyId,title,profileId,questionCount,passMark,deadline,candidates:[{name,email}]})
//   addInvitations(sessionId,candidates)     getInvitationByToken(token) -> {invitation,session,company}|null
//   saveAttempt(attempt)  getAttempt(id)  listAttemptsByDevice()  listAttemptsBySession(sessionId)
//   listAssignments(sessionId)  addAssignments(sessionId,list)  listCollabByEmail(email)  markAssignmentsDone(email,{profileId,moduleId?,theme?})
//   createCertificate(attempt)  getCertificate(code)  listCertificatesByDevice()
//   purchaseCredits(companyId,pack,payment)  listTransactions(companyId)
// Progression de cours et identité du candidat : toujours locales à l'appareil (voir `local` ci-dessous).

import { CONFIG } from '../config.js';
import { uid, makeToken, certCode, sha256 } from './util.js';
import { buildSeed } from './seed.js';

const KEY = 'mrs.db.v1';
const AUTH = 'mrs.auth.v1';
const DEVICE = 'mrs.device.v1';
const PROGRESS = 'mrs.progress.v1';
const ME = 'mrs.me.v1';

const readJSON = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

/** Données propres à l'appareil, communes aux deux adaptateurs. */
export const local = {
  deviceId() {
    let d = null;
    try { d = localStorage.getItem(DEVICE); } catch { /* ignore */ }
    if (!d) { d = uid('dev'); try { localStorage.setItem(DEVICE, d); } catch { /* ignore */ } }
    return d;
  },
  getMe() { return readJSON(ME, { name: '', email: '' }); },
  setMe(me) { writeJSON(ME, { name: String(me.name || '').trim(), email: String(me.email || '').trim() }); },
  getProgress() { return readJSON(PROGRESS, {}); },
  saveProgress(p) { writeJSON(PROGRESS, p); },
  markModule(profileId, moduleId) {
    const p = this.getProgress();
    p[profileId] = p[profileId] || { modules: {}, practice: {} };
    p[profileId].modules[moduleId] = Date.now();
    this.saveProgress(p);
  },
  addPractice(profileId, byTheme) {
    const p = this.getProgress();
    const e = (p[profileId] = p[profileId] || { modules: {}, practice: {} });
    for (const [t, v] of Object.entries(byTheme)) {
      const c = (e.practice[t] = e.practice[t] || { ok: 0, total: 0 });
      c.ok += v.ok; c.total += v.total;
    }
    e.lastPractice = Date.now();
    this.saveProgress(p);
  },
};

class LocalStore {
  constructor() { this.kind = 'local'; this.db = null; }

  async init() {
    this.db = readJSON(KEY, null);
    if (!this.db || this.db.v !== 1) {
      this.db = await buildSeed();
      this._save();
    }
    this.db.assignments = this.db.assignments || [];
  }
  _save() {
    if (!writeJSON(KEY, this.db)) console.warn('Stockage local indisponible ou plein.');
  }
  /** Réinitialise les données de démonstration (utile pour les tests). */
  async resetDemo() { this.db = await buildSeed(); this._save(); try { localStorage.removeItem(AUTH); } catch { /* ignore */ } }

  // ---------- Authentification (démo : aucun vrai secret n'est protégé) ----------
  async currentUser() {
    const id = readJSON(AUTH, null);
    const u = id && this.db.users.find((x) => x.id === id);
    return u ? { id: u.id, email: u.email, name: u.name, companyId: u.companyId } : null;
  }
  async signUp({ companyName, name, email, password }) {
    email = String(email).trim().toLowerCase();
    if (this.db.users.some((u) => u.email === email)) throw new Error('Un compte existe déjà avec cet e-mail.');
    const company = { id: uid('c'), name: String(companyName).trim(), credits: CONFIG.FREE_CREDITS_ON_SIGNUP, createdAt: Date.now() };
    const user = { id: uid('u'), companyId: company.id, email, name: String(name).trim(), hash: await sha256(password) };
    this.db.companies.push(company);
    this.db.users.push(user);
    if (CONFIG.FREE_CREDITS_ON_SIGNUP) {
      this.db.transactions.push({ id: uid('t'), companyId: company.id, type: 'bonus', credits: CONFIG.FREE_CREDITS_ON_SIGNUP, amount: 0, method: '', ref: 'Crédits de bienvenue', date: Date.now() });
    }
    this._save();
    writeJSON(AUTH, user.id);
    return this.currentUser();
  }
  async signIn(email, password) {
    email = String(email).trim().toLowerCase();
    const u = this.db.users.find((x) => x.email === email);
    if (!u || u.hash !== await sha256(password)) throw new Error('E-mail ou mot de passe incorrect.');
    writeJSON(AUTH, u.id);
    return this.currentUser();
  }
  async signOut() { try { localStorage.removeItem(AUTH); } catch { /* ignore */ } }

  async getCompany(id) { const c = this.db.companies.find((x) => x.id === id); return c ? { ...c } : null; }

  // ---------- Sessions et invitations ----------
  _decorate(s) {
    const invitations = this.db.invitations.filter((i) => i.sessionId === s.id).map((i) => this._decorateInv(i, s));
    return { ...s, type: s.type || 'recruitment', invitations };
  }
  _decorateInv(i, s) {
    const attempts = this.db.attempts.filter((a) => a.invitationId === i.id).map((a) => ({ ...a, items: undefined })).sort((a, b) => a.startedAt - b.startedAt);
    const last = attempts[attempts.length - 1] || null;
    let status = 'invited';
    if (last) status = last.status === 'done' ? (last.passed ? 'passed' : 'failed') : 'started';
    else if (s.deadline && Date.now() > s.deadline) status = 'expired';
    return { ...i, status, attempt: last, attempts };
  }
  async listSessions(companyId) {
    return this.db.sessions.filter((s) => s.companyId === companyId).sort((a, b) => b.createdAt - a.createdAt).map((s) => this._decorate(s));
  }
  async getSession(id) {
    const s = this.db.sessions.find((x) => x.id === id);
    return s ? this._decorate(s) : null;
  }
  _spend(company, n, ref) {
    if (company.credits < n) throw new Error(`Crédits insuffisants : ${n} nécessaire(s), ${company.credits} disponible(s).`);
    company.credits -= n;
    this.db.transactions.push({ id: uid('t'), companyId: company.id, type: 'use', credits: -n, amount: 0, method: '', ref, date: Date.now() });
  }
  _invite(sessionId, candidates) {
    return candidates.map((c) => {
      const inv = { id: uid('i'), sessionId, token: makeToken(), name: String(c.name || '').trim(), email: String(c.email || '').trim(), status: 'invited', attemptId: null, createdAt: Date.now(), startedAt: null, finishedAt: null };
      this.db.invitations.push(inv);
      return inv;
    });
  }
  async createSession({ companyId, title, profileId, questionCount, passMark, deadline, candidates, type = 'recruitment' }) {
    const company = this.db.companies.find((c) => c.id === companyId);
    if (!company) throw new Error('Entreprise introuvable.');
    if (!candidates?.length) throw new Error('Ajoutez au moins un candidat.');
    this._spend(company, candidates.length, `Session « ${title} » : ${candidates.length} candidat(s)`);
    const s = { id: uid('s'), type, companyId, title: String(title).trim(), profileId, questionCount, passMark: passMark || CONFIG.PASS_MARK, createdAt: Date.now(), deadline };
    this.db.sessions.push(s);
    this._invite(s.id, candidates);
    this._save();
    return this._decorate(s);
  }
  async addInvitations(sessionId, candidates) {
    const s = this.db.sessions.find((x) => x.id === sessionId);
    if (!s) throw new Error('Session introuvable.');
    const company = this.db.companies.find((c) => c.id === s.companyId);
    this._spend(company, candidates.length, `Session « ${s.title} » : ${candidates.length} candidat(s) ajouté(s)`);
    this._invite(sessionId, candidates);
    this._save();
    return this._decorate(s);
  }
  async getInvitationByToken(token) {
    const inv = this.db.invitations.find((i) => i.token === token);
    if (!inv) return null;
    const session = this.db.sessions.find((s) => s.id === inv.sessionId);
    const company = this.db.companies.find((c) => c.id === session.companyId);
    const full = this._decorateInv(inv, session);
    const last = full.attempt ? this.db.attempts.find((a) => a.id === full.attempt.id) : null;
    return { invitation: full, session: { ...session, type: session.type || 'recruitment' }, company: { name: company.name }, attempt: last ? { ...last } : null, attempts: full.attempts };
  }

  // ---------- Tentatives ----------
  async saveAttempt(a) {
    const copy = JSON.parse(JSON.stringify(a));
    const i = this.db.attempts.findIndex((x) => x.id === a.id);
    if (i >= 0) this.db.attempts[i] = copy; else this.db.attempts.push(copy);
    if (a.invitationId) {
      const inv = this.db.invitations.find((x) => x.id === a.invitationId);
      if (inv) {
        inv.attemptId = a.id;
        inv.name = a.candidate?.name || inv.name;
        inv.email = a.candidate?.email || inv.email;
        inv.startedAt = inv.startedAt || a.startedAt;
        if (a.status === 'done') { inv.status = a.passed ? 'passed' : 'failed'; inv.finishedAt = a.finishedAt; } else inv.status = 'started';
      }
    }
    this._save();
  }
  async getAttempt(id) { const a = this.db.attempts.find((x) => x.id === id); return a ? JSON.parse(JSON.stringify(a)) : null; }
  async listAttemptsByDevice() {
    const d = local.deviceId();
    return this.db.attempts.filter((a) => a.deviceId === d).map((a) => ({ ...a, items: undefined })).sort((x, y) => y.startedAt - x.startedAt);
  }
  async listAttemptsBySession(sessionId) {
    return this.db.attempts.filter((a) => a.sessionId === sessionId).map((a) => ({ ...a, items: undefined }));
  }

  // ---------- Montée en compétences : assignations ----------
  async listAssignments(sessionId) { return this.db.assignments.filter((a) => a.sessionId === sessionId).map((a) => ({ ...a })); }
  async addAssignments(sessionId, list) {
    const out = [];
    for (const it of list) {
      const dup = this.db.assignments.find((a) => a.sessionId === sessionId && a.invitationId === it.invitationId && a.kind === it.kind
        && (a.moduleId || '') === (it.moduleId || '') && (a.theme || '') === (it.theme || '') && !a.doneAt);
      if (dup) { dup.due = it.due; out.push({ ...dup }); continue; }
      const a = { id: uid('as'), sessionId, invitationId: it.invitationId, kind: it.kind, profileId: it.profileId, moduleId: it.moduleId || null, theme: it.theme || null, due: it.due, createdAt: Date.now(), doneAt: null };
      this.db.assignments.push(a); out.push({ ...a });
    }
    this._save();
    return out;
  }
  async listCollabByEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return [];
    const res = [];
    for (const inv of this.db.invitations) {
      if ((inv.email || '').toLowerCase() !== e) continue;
      const s = this.db.sessions.find((x) => x.id === inv.sessionId);
      if (!s || (s.type || 'recruitment') !== 'training') continue;
      const company = this.db.companies.find((c) => c.id === s.companyId);
      res.push({ invitation: this._decorateInv(inv, s), session: { ...s }, company: { name: company.name }, assignments: this.db.assignments.filter((a) => a.invitationId === inv.id).map((a) => ({ ...a })) });
    }
    return res;
  }
  async markAssignmentsDone(email, { profileId, moduleId, theme }) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return 0;
    const ids = new Set(this.db.invitations.filter((i) => (i.email || '').toLowerCase() === e).map((i) => i.id));
    let n = 0;
    for (const a of this.db.assignments) {
      if (a.doneAt || !ids.has(a.invitationId) || a.profileId !== profileId) continue;
      if ((moduleId && a.kind === 'module' && a.moduleId === moduleId) || (theme && a.kind === 'practice' && a.theme === theme)) { a.doneAt = Date.now(); n++; }
    }
    if (n) this._save();
    return n;
  }

  // ---------- Attestations ----------
  async createCertificate(attempt) {
    const existing = this.db.certificates.find((c) => c.attemptId === attempt.id);
    if (existing) return { ...existing };
    let code;
    do { code = certCode(new Date(attempt.finishedAt || Date.now())); } while (this.db.certificates.some((c) => c.code === code));
    const cert = {
      code, attemptId: attempt.id, name: attempt.candidate?.name || 'Candidat', email: attempt.candidate?.email || '',
      profileId: attempt.profileId, profileName: attempt.profileName || '', percent: attempt.percent, passMark: attempt.passMark,
      date: attempt.finishedAt || Date.now(),
    };
    this.db.certificates.push(cert);
    this._save();
    return { ...cert };
  }
  async getCertificate(code) {
    const c = this.db.certificates.find((x) => x.code === String(code).trim().toUpperCase());
    return c ? { ...c } : null;
  }
  async listCertificatesByDevice() {
    const ids = new Set(this.db.attempts.filter((a) => a.deviceId === local.deviceId()).map((a) => a.id));
    return this.db.certificates.filter((c) => ids.has(c.attemptId)).sort((a, b) => b.date - a.date);
  }

  // ---------- Crédits ----------
  async purchaseCredits(companyId, pack, payment) {
    const company = this.db.companies.find((c) => c.id === companyId);
    if (!company) throw new Error('Entreprise introuvable.');
    company.credits += pack.credits;
    // Aucune donnée de paiement sensible n'est conservée : seulement le mode et la référence.
    this.db.transactions.push({ id: uid('t'), companyId, type: 'purchase', credits: pack.credits, amount: pack.price, method: payment.method, ref: payment.ref, date: Date.now(), demo: payment.provider === 'simulated' });
    this._save();
    return { ...company };
  }
  async listTransactions(companyId) {
    return this.db.transactions.filter((t) => t.companyId === companyId).sort((a, b) => b.date - a.date);
  }
}

export let store = null;

export async function initStore() {
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    const { SupabaseStore } = await import('./store-supabase.js');
    store = new SupabaseStore(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, local);
  } else {
    store = new LocalStore();
  }
  await store.init();
  return store;
}
