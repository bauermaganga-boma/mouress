// Logique du parcours par poste : statut d'une thématique (saisi par le management ou déduit des résultats),
// progression par collaborateur, modèle d'équipe pour le tableau de bord, données de démonstration.
import { CONFIG } from '../config.js';
import { loadContent, themesOf } from './data.js';
import { collabStats } from './skills.js';
import { pct, addMonths } from './util.js';
import { STATUS_P, REVIEW_DAYS } from './parcours-store.js';

const DAY = 86400000;
const REC_TO_P = { planned: 'a_faire', in_progress: 'en_cours', done: 'valide' };

/**
 * Statut d'une thématique pour un collaborateur.
 * 1) saisie manuelle du management ; 2) formation du catalogue liée ; 3) résultat d'examen sur le thème de la plateforme.
 */
export function deriveStatus(item, ctx) {
  const row = ctx.suivi.find((s) => s.itemId === item.id);
  const base = deriveCore(item, ctx, row);
  const due = row?.due || item.due || null;
  return { ...base, due, late: base.status !== 'valide' && !!due && due < Date.now() };
}

function deriveCore(item, ctx, manual) {
  if (manual && manual.status !== 'auto') return { status: manual.status, auto: false, comment: manual.comment || '', date: manual.date || null };
  if (item.source === 'formation') {
    const r = ctx.records.find((x) => x.formationId === item.formationId);
    if (r) return { status: REC_TO_P[r.status] || 'a_faire', auto: true, date: r.doneAt || r.date || null, via: 'inscription', comment: manual?.comment || '' };
  }
  if (item.source === 'theme') {
    const p = ctx.stats?.themesLast?.[item.theme];
    if (p != null) {
      const at = ctx.stats.last?.finishedAt || null;
      return { status: p >= ctx.passMark ? 'valide' : 'en_cours', auto: true, comment: manual?.comment || '', date: at, via: `examen : ${p} %` };
    }
  }
  return { status: 'a_faire', auto: true, comment: manual?.comment || '', date: null };
}

export const progressOf = (states) => {
  const total = states.length; const valide = states.filter((s) => s.status === 'valide').length; const cours = states.filter((s) => s.status === 'en_cours').length;
  return { total, valide, en_cours: cours, a_faire: total - valide - cours, pct: pct(valide, total) };
};

/** Modèle complet de l'entreprise : collaborateurs, thématiques par poste, statuts, revues, événements datés. */
export async function buildModel(ctx, company, employees) {
  const [items, suiviAll, records, reviews, formations] = await Promise.all([
    ctx.store.listThematiques(company.id), ctx.store.listSuivi(company.id), ctx.store.listFormationRecords(company.id), ctx.store.listReviews(company.id), ctx.store.listFormations(company.id)]);
  const fById = new Map(formations.map((f) => [f.id, f]));
  const byProfile = new Map();
  for (const i of items) { if (!byProfile.has(i.profileId)) byProfile.set(i.profileId, []); byProfile.get(i.profileId).push(i); }
  const per = new Map(); const events = [];
  for (const e of employees) {
    const mine = byProfile.get(e.profileId) || [];
    const attempts = mine.some((i) => i.source === 'theme') ? (await ctx.store.listAttemptsByEmail(company.id, e.email)).filter((a) => a.profileId === e.profileId) : [];
    const stats = collabStats({ attempts });
    const c = { suivi: suiviAll.filter((s) => s.employeeId === e.id), records: records.filter((r) => r.employeeId === e.id), stats, passMark: attempts[attempts.length - 1]?.passMark || CONFIG.PASS_MARK };
    const rows = mine.map((item) => ({ item, ...deriveStatus(item, c), formation: fById.get(item.formationId) || null }));
    for (const r of rows) if (r.status === 'valide' && r.date) events.push({ ts: r.date, employeeId: e.id });
    const rv = reviews.find((x) => x.employeeId === e.id) || null;
    per.set(e.id, { emp: e, rows, ...progressOf(rows), late: rows.filter((r) => r.late).length, review: rv, stats });
  }
  return { items, byProfile, per, events, reviews, formations, records };
}

export function reviewState(rv, now = Date.now()) {
  if (!rv || !rv.next) return { key: 'none', label: 'Revue à planifier', tone: '' };
  const d = Math.ceil((rv.next - now) / DAY);
  if (rv.next < now) return { key: 'late', label: `Revue en retard de ${Math.max(1, Math.floor((now - rv.next) / DAY))} j`, tone: 'ko' };
  if (d <= 14) return { key: 'soon', label: `Revue dans ${d} j`, tone: 'warn' };
  return { key: 'ok', label: `Revue dans ${d} j`, tone: 'info' };
}
export const nextReviewFrom = (ts = Date.now()) => ts + REVIEW_DAYS * DAY;

/** Première thématique non validée : « prochaine action » proposée au collaborateur et à son responsable. */
export function nextAction(rows) {
  const r = rows.find((x) => x.status === 'en_cours') || rows.find((x) => x.status === 'a_faire');
  return r || null;
}
export function actionHref(row, profileId) {
  const it = row.item;
  if (it.source === 'theme') return `#/entrainement/${profileId}?theme=${encodeURIComponent(it.theme)}`;
  if (it.source === 'formation' && row.formation?.url) return row.formation.url;
  return '';
}

/** Propose des thématiques à partir des thèmes de la plateforme pour un poste (celles qui n'existent pas encore). */
export async function suggestFor(profileId, existing) {
  const c = await loadContent(profileId);
  if (!c) return [];
  const have = new Set(existing.filter((i) => i.source === 'theme').map((i) => i.theme));
  return themesOf(c).filter((t) => !have.has(t.name)).map((t) => ({ title: t.name, theme: t.name, count: t.count, hours: Math.max(1, Math.round(c.modules.filter((m) => m.theme === t.name).reduce((s, m) => s + (m.minutes || 8), 0) / 60)) }));
}

/** Démonstration : parcours, statuts et revues pour l'entreprise démo (une seule fois). */
export async function ensureDemo(ctx, company, employees) {
  if (!company.demo || await ctx.store.parcoursDemoDone(company.id)) return;
  await ctx.store.markParcoursDemo(company.id);
  if ((await ctx.store.listThematiques(company.id)).length) return;
  const now = Date.now();
  const postes = [...new Set(employees.map((e) => e.profileId).filter(Boolean))];
  const internes = ['Passation de poste et gestes métier', 'Retour d’expérience terrain', 'Tutorat par un référent'];
  const doneMonths = [5, 4, 3, 2, 1, 0];
  const made = {};
  for (const pid of postes) {
    const c = await loadContent(pid);
    const themes = c ? themesOf(c).slice(0, 3).map((t) => t.name) : [];
    const list = [];
    for (const t of themes) list.push(await ctx.store.saveThematique({ companyId: company.id, profileId: pid, title: t, kind: 'obligatoire', source: 'theme', theme: t, hours: 4 }));
    list.push(await ctx.store.saveThematique({ companyId: company.id, profileId: pid, title: internes[0], kind: 'interne', source: 'libre', hours: 6, note: 'Transmission par un collègue expérimenté.' }));
    list.push(await ctx.store.saveThematique({ companyId: company.id, profileId: pid, title: internes[1], kind: 'interne', source: 'libre', hours: 2 }));
    made[pid] = list;
  }
  let k = 0;
  for (const e of employees) {
    const list = made[e.profileId] || [];
    const upto = (e.id.charCodeAt(e.id.length - 1) + k++) % (list.length + 1);
    for (let j = 0; j < upto; j++) {
      const ts = addMonths(now, -doneMonths[(j + k) % doneMonths.length]);
      await ctx.store.setSuivi({ companyId: company.id, employeeId: e.id, itemId: list[j].id, status: j === upto - 1 && k % 2 ? 'en_cours' : 'valide', date: ts, comment: j === 0 ? 'Validé après mise en situation.' : '' });
    }
    await ctx.store.saveReview({ companyId: company.id, employeeId: e.id, last: now - (30 + 12 * k) * DAY, next: now + (k % 3 === 0 ? -9 : k % 3 === 1 ? 8 : 40) * DAY, note: '' });
  }
}

export { STATUS_P };

/** Ajoute le département et le responsable (manager) à chaque collaborateur. */
export async function withOrg(ctx, employees) {
  const org = await ctx.store.listOrg();
  return employees.map((e) => ({ ...e, dept: org[e.id]?.dept || '', managerId: org[e.id]?.managerId || '' }));
}

/** Démonstration : secteur, départements, services et managers de l'entreprise démo (une seule fois). */
export async function ensureDemoOrg(ctx, company, employees) {
  if (!company.demo || await ctx.store.orgDemoDone(company.id)) return;
  await ctx.store.markOrgDemo(company.id);
  if (!(await ctx.store.getCompanySector(company.id))) await ctx.store.setCompanySector(company.id, 'petrole-gaz');
  const dept = { 'Maintenance Port-Gentil': 'Département Maintenance', 'Production offshore': 'Département Production', QHSE: 'Département QHSE' };
  const mgr = { e_demo2: 'e_demo1', e_demo3: 'e_demo1', e_demo4: 'e_demo1', e_demo5: 'e_demo1', e_demo8: 'e_demo6' };
  for (const e of employees) {
    if (e.id === 'e_demo4' || e.id === 'e_demo5') await ctx.store.saveEmployee({ ...e, team: 'Maintenance Libreville' });
    await ctx.store.setOrg(e.id, { dept: dept[e.team] || '', managerId: mgr[e.id] || '' });
  }
}
