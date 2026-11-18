// SupabaseStore — adaptateur de la couche données pour Supabase (REST PostgREST + GoTrue, sans SDK).
//
// *** NON TESTÉ contre une vraie instance Supabase. ***
// Écrit d'après supabase/schema.sql (lui aussi non testé). À valider sur un projet de test avant tout usage :
// authentification, politiques RLS, fonctions RPC (rpc_*), mapping des champs.
//
// Il respecte le même contrat que LocalStore (voir l'en-tête de js/store.js).
import { uid } from './util.js';

const TOKEN_KEY = 'mrs.sb.session.v1';

const ts = (v) => (v ? Date.parse(v) : null);
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

function fromAttempt(r) {
  if (!r) return null;
  const st = r.state || {};
  return {
    id: r.id, mode: 'exam', deviceId: r.device_id, profileId: r.profile_id, profileName: r.profile_name,
    sessionId: r.session_id, invitationId: r.invitation_id, candidate: { name: r.candidate_name, email: r.candidate_email || '' },
    startedAt: ts(r.started_at), finishedAt: ts(r.finished_at), status: r.status, passMark: r.pass_mark, total: r.total,
    correct: r.correct, percent: r.percent, passed: r.passed, durationMs: r.duration_ms, themes: r.themes || {}, certCode: r.cert_code,
    phase: st.phase || (r.status === 'done' ? 'done' : 'transition'), idx: st.idx || 0, qStart: st.qStart || null, items: st.items || [],
  };
}
const toPayload = (a) => ({
  id: a.id, deviceId: a.deviceId, profileId: a.profileId, profileName: a.profileName, candidate: a.candidate, status: a.status, passMark: a.passMark,
  total: a.total, correct: a.correct, percent: a.percent, passed: a.passed, durationMs: a.durationMs, themes: a.themes, certCode: a.certCode,
  startedAt: a.startedAt, finishedAt: a.finishedAt || '', state: { phase: a.phase, idx: a.idx, qStart: a.qStart, items: a.items },
});
const fromAssignment = (r) => ({ id: r.id, sessionId: r.session_id, invitationId: r.invitation_id, kind: r.kind, profileId: r.profile_id, moduleId: r.module_id, theme: r.theme, due: ts(r.due), createdAt: ts(r.created_at), doneAt: ts(r.done_at) });
const fromSession = (r) => ({ id: r.id, level: r.level, type: r.type, companyId: r.company_id, title: r.title, profileId: r.profile_id, questionCount: r.question_count, passMark: r.pass_mark, deadline: ts(r.deadline), createdAt: ts(r.created_at) });

function decorateInv(inv, s, attempts) {
  const list = attempts.sort((a, b) => a.startedAt - b.startedAt);
  const last = list[list.length - 1] || null;
  let status = 'invited';
  if (last) status = last.status === 'done' ? (last.passed ? 'passed' : 'failed') : 'started';
  else if (inv.training_at) status = 'training';
  else if (s.deadline && Date.now() > s.deadline) status = 'expired';
  return { id: inv.id, sessionId: inv.session_id, token: inv.token, name: inv.name, email: inv.email, createdAt: ts(inv.created_at), status, orderId: inv.order_id, price: inv.price, trainingAt: ts(inv.training_at), attempt: last && { ...last, items: undefined }, attempts: list.map((a) => ({ ...a, items: undefined })) };
}

export class SupabaseStore {
  constructor(url, anonKey, local) {
    this.kind = 'supabase';
    this.url = url.replace(/\/$/, '');
    this.key = anonKey;
    this.local = local;
    this.session = null;
  }

  async init() {
    try { this.session = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { this.session = null; }
  }

  _headers(extra = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.session?.access_token || this.key}`, 'Content-Type': 'application/json', ...extra };
  }
  async _fetch(path, { method = 'GET', body, headers } = {}) {
    const res = await fetch(`${this.url}${path}`, { method, headers: this._headers(headers), body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(json?.message || json?.msg || json?.error_description || `Erreur ${res.status}`);
    return json;
  }
  _rest(path, opts) { return this._fetch(`/rest/v1/${path}`, opts); }
  _rpc(name, args) { return this._fetch(`/rest/v1/rpc/${name}`, { method: 'POST', body: args }); }

  // ---------- Authentification ----------
  _setSession(s) { this.session = s; try { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
  async currentUser() {
    if (!this.session?.access_token) return null;
    try {
      const u = await this._fetch('/auth/v1/user');
      const p = (await this._rest(`profiles?id=eq.${u.id}&select=*`))[0];
      return p ? { id: u.id, email: u.email, name: p.full_name, companyId: p.company_id } : null;
    } catch { return null; }
  }
  async signUp({ companyName, name, email, password }) {
    const r = await this._fetch('/auth/v1/signup', { method: 'POST', body: { email, password } });
    if (!r.access_token) throw new Error('Confirmez votre e-mail puis connectez-vous.'); // confirmation e-mail activée
    this._setSession(r);
    await this._rpc('rpc_create_company', { p_company: companyName, p_name: name });
    return this.currentUser();
  }
  async signIn(email, password) {
    const r = await this._fetch('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    this._setSession(r);
    return this.currentUser();
  }
  async signOut() { this.session = null; try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }

  async getCompany(id) {
    const r = (await this._rest(`companies?id=eq.${id}&select=*`))[0];
    return r ? { id: r.id, name: r.name, createdAt: ts(r.created_at) } : null;
  }

  // ---------- Sessions ----------
  async _sessions(filter) {
    const rows = await this._rest(`sessions?${filter}&select=*,invitations(*)&order=created_at.desc`);
    const ids = rows.flatMap((r) => r.invitations.map((i) => i.id));
    const att = ids.length ? (await this._rest(`attempts?invitation_id=in.(${ids.join(',')})&select=*`)).map(fromAttempt) : [];
    return rows.map((r) => {
      const s = fromSession(r);
      return { ...s, invitations: r.invitations.map((i) => decorateInv(i, s, att.filter((a) => a.invitationId === i.id))) };
    });
  }
  async listSessions(companyId) { return this._sessions(`company_id=eq.${companyId}`); }
  async getSession(id) { return (await this._sessions(`id=eq.${id}`))[0] || null; }
  // Commande de Pass : à n'appeler qu'APRÈS confirmation du paiement (en production : webhook serveur de l'agrégateur).
  async createOrder({ type = 'recruitment', title, profileId, profileName, level, unitPrice, questionCount, passMark, deadline, candidates, payment }) {
    const r = await this._rpc('rpc_create_order', { p_type: type, p_title: title, p_profile: profileId, p_profile_name: profileName || '', p_level: level, p_unit: unitPrice, p_questions: questionCount, p_pass: passMark, p_deadline: iso(deadline), p_people: candidates, p_method: payment.method, p_ref: payment.ref, p_demo: payment.provider === 'simulated' });
    return { session: await this.getSession(r.session_id), order: await this.getOrder(r.order_id) };
  }
  async addPasses(sessionId, candidates, unitPrice, payment, profileName) {
    const id = await this._rpc('rpc_add_passes', { p_session: sessionId, p_people: candidates, p_unit: unitPrice, p_profile_name: profileName || '', p_method: payment.method, p_ref: payment.ref, p_demo: payment.provider === 'simulated' });
    return this.getOrder(id);
  }
  _order(o) { return { id: o.id, number: o.number, companyId: o.company_id, sessionId: o.session_id, sessionTitle: o.session_title, profileId: o.profile_id, profileName: o.profile_name, level: o.level, unitPrice: o.unit_price, qty: o.qty, total: o.total, method: o.method, ref: o.ref, demo: o.demo, date: ts(o.created_at) }; }
  async listOrders(companyId) { return (await this._rest(`orders?company_id=eq.${companyId}&select=*&order=created_at.desc`)).map((o) => this._order(o)); }
  async getOrder(id) { const o = (await this._rest(`orders?id=eq.${id}&select=*`))[0]; return o ? this._order(o) : null; }
  async touchInvitation(token) { await this._rpc('rpc_touch_invitation', { p_token: token }).catch(() => {}); }
  async getInvitationByToken(token) {
    const r = await this._rpc('rpc_get_invitation', { p_token: token });
    if (!r) return null;
    try { // mémorise les liens ouverts sur cet appareil (parcours collaborateur sans compte)
      const t = new Set(JSON.parse(localStorage.getItem('mrs.sb.tokens') || '[]')); t.add(token);
      localStorage.setItem('mrs.sb.tokens', JSON.stringify([...t]));
    } catch { /* ignore */ }
    const session = { ...r.session, deadline: ts(r.session.deadline) };
    const attempts = (r.attempts || []).map(fromAttempt);
    const inv = decorateInv({ id: r.invitation.id, session_id: r.invitation.sessionId, token: r.invitation.token, name: r.invitation.name, email: r.invitation.email }, session, attempts);
    const last = attempts[attempts.length - 1] || null;
    return { invitation: inv, session, company: r.company, attempt: last, attempts: inv.attempts };
  }

  // ---------- Tentatives ----------
  async saveAttempt(a) {
    let token = null;
    if (a.invitationId) {
      // Le token du lien est conservé localement par la vue candidat ; à défaut on le retrouve dans l'URL courante.
      token = (location.hash.match(/#\/t\/([\w-]+)/) || [])[1] || null;
    }
    await this._rpc('rpc_save_attempt', { p_token: token, p_attempt: toPayload(a) });
  }
  async getAttempt(id) { return fromAttempt(await this._rpc('rpc_get_attempt', { p_id: id, p_device: this.local.deviceId() })); }
  async listAttemptsByDevice() { return (await this._rpc('rpc_list_device_attempts', { p_device: this.local.deviceId() })).map((r) => ({ ...fromAttempt(r), items: undefined })); }
  async listAttemptsBySession(sessionId) { return (await this._rest(`attempts?session_id=eq.${sessionId}&select=*`)).map((r) => ({ ...fromAttempt(r), items: undefined })); }

  // ---------- Attestations ----------
  async createCertificate(attempt) {
    const code = `MRS-${new Date(attempt.finishedAt || Date.now()).getFullYear()}-${uid('x').slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, 'K').padEnd(6, 'K')}`;
    const r = await this._rpc('rpc_issue_certificate', { p_attempt: attempt.id, p_code: code });
    return { code: r.code, attemptId: attempt.id, name: r.holder_name, email: r.holder_email, profileId: r.profile_id, profileName: r.profile_name, percent: r.percent, passMark: r.pass_mark, date: ts(r.issued_at) };
  }
  async getCertificate(code) {
    const r = await this._rpc('verify_certificate', { p_code: code });
    return r ? { code: r.code, name: r.name, profileId: r.profileId, profileName: r.profileName, percent: r.percent, passMark: r.passMark, date: ts(r.date) } : null;
  }
  async listCertificatesByDevice() {
    const atts = (await this.listAttemptsByDevice()).filter((a) => a.certCode);
    const out = [];
    for (const a of atts) { const c = await this.getCertificate(a.certCode); if (c) out.push(c); }
    return out;
  }

  // ---------- Montée en compétences ----------
  async listAssignments(sessionId) { return (await this._rest(`assignments?session_id=eq.${sessionId}&select=*`)).map(fromAssignment); }
  async addAssignments(sessionId, list) {
    const rows = list.map((i) => ({ session_id: sessionId, invitation_id: i.invitationId, kind: i.kind, profile_id: i.profileId, module_id: i.moduleId || null, theme: i.theme || null, due: iso(i.due) }));
    return (await this._rest('assignments', { method: 'POST', body: rows, headers: { Prefer: 'return=representation' } })).map(fromAssignment);
  }
  async listCollabByEmail(email) {
    // Côté collaborateur (sans compte) : on s'appuie sur les tokens de liens déjà ouverts sur cet appareil.
    const tokens = JSON.parse(localStorage.getItem('mrs.sb.tokens') || '[]');
    const out = [];
    for (const t of tokens) {
      const f = await this.getInvitationByToken(t);
      if (f && f.session.type === 'training' && (f.invitation.email || '').toLowerCase() === String(email).toLowerCase()) {
        const assignments = (await this._rpc('rpc_my_assignments', { p_token: t })).map(fromAssignment);
        out.push({ invitation: f.invitation, session: f.session, company: f.company, assignments });
      }
    }
    return out;
  }
  async markAssignmentsDone(email, { profileId, moduleId, theme }) {
    const tokens = JSON.parse(localStorage.getItem('mrs.sb.tokens') || '[]');
    let n = 0;
    for (const t of tokens) n += await this._rpc('rpc_complete_assignments', { p_token: t, p_profile: profileId, p_module: moduleId || null, p_theme: theme || null });
    return n;
  }
}
