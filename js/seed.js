// Données de démonstration : Entreprise Démo, compte RH, 2 sessions, 7 candidats fictifs.
// Les thèmes sont lus dans le contenu du profil s'il existe, sinon des thèmes génériques sont utilisés.
import { CONFIG } from '../config.js';
import { loadContent, themesOf, getProfilesData } from './data.js';
import { sha256, addMonths } from './util.js';
import { passPrice } from './pass.js';

const DAY = 86400000;

async function themeNames(profileId, fallback) {
  const c = await loadContent(profileId);
  const t = c ? themesOf(c).map((x) => x.name) : [];
  return t.length >= 3 ? t.slice(0, 5) : fallback;
}

// Répartition déterministe d'un score sur les thèmes.
function synthThemes(names, total, percent, salt) {
  const per = Math.max(1, Math.floor(total / names.length));
  const themes = {};
  let left = total;
  let okTarget = Math.round((percent / 100) * total);
  names.forEach((n, i) => {
    const t = i === names.length - 1 ? left : per;
    left -= t;
    const wobble = ((salt * 7 + i * 5) % 5) - 2; // -2..2
    let ok = Math.round((percent / 100) * t) + (i % 2 ? wobble > 0 ? 1 : 0 : wobble < 0 ? -1 : 0);
    ok = Math.max(0, Math.min(t, ok));
    themes[n] = { ok, total: t };
  });
  // recale pour que la somme corresponde au score annoncé
  let sum = Object.values(themes).reduce((a, b) => a + b.ok, 0);
  const keys = Object.keys(themes);
  let guard = 0;
  while (sum !== okTarget && guard++ < 100) {
    const k = keys[guard % keys.length];
    if (sum < okTarget && themes[k].ok < themes[k].total) { themes[k].ok++; sum++; }
    else if (sum > okTarget && themes[k].ok > 0) { themes[k].ok--; sum--; }
  }
  return themes;
}

let LEVELS = {};
const levelOfProfile = (id) => LEVELS[id] || 'tech';

export async function buildSeed() {
  const now = Date.now();
  const hash = await sha256(CONFIG.DEMO_ACCOUNT.password);
  const db = {
    v: 3, companies: [], users: [], sessions: [], invitations: [], attempts: [], certificates: [], orders: [], assignments: [], employees: [], plan: [],
  };
  db.companies.push({ id: 'c_demo', name: 'Entreprise Démo', createdAt: now - 40 * DAY, demo: true });
  db.users.push({ id: 'u_demo', companyId: 'c_demo', email: CONFIG.DEMO_ACCOUNT.email, name: 'Aurélie Démo (RH)', hash });

  const pdata = await getProfilesData();
  const ids = new Set(pdata.profiles.map((p) => p.id));
  const pick = (id, i) => (ids.has(id) ? id : pdata.profiles[i % pdata.profiles.length].id);
  LEVELS = Object.fromEntries(pdata.profiles.map((p) => [p.id, p.level]));
  const P1 = pick('op-prod', 0); const P2 = pick('ing-eia', 1); const P3 = pick('tech-elec', 2);
  const t3 = await themeNames(P3, ['Distribution électrique', 'Moteurs et variateurs', 'Protections et ATEX', 'Consignation et sécurité']);
  const t1 = await themeNames(P1, ['Procédés de production', 'Machines tournantes', 'Sécurité et permis', 'Lecture de schémas']);
  const t2 = await themeNames(P2, ['Électricité industrielle', 'Instrumentation', 'Automatisme et DCS', 'Sûreté fonctionnelle']);

  const sessions = [
    { id: 's_demo1', title: 'Opérateur de production — recrutement T4', profileId: P1, questionCount: 20, passMark: 70, createdAt: now - 12 * DAY, deadline: now + 20 * DAY, themes: t1,
      cands: [
        ['Jean-Pierre Mba Obame', 'jp.mba@exemple.com', 'done', 82, 17 * 60e3 + 40e3, 'MRS-2026-K7M2QX'],
        ['Marie-Claire Nzamba', 'mc.nzamba@exemple.com', 'done', 65, 21 * 60e3 + 5e3],
        ['Patrick Ondo Mintsa', 'p.ondo@exemple.com', 'done', 74, 19 * 60e3 + 12e3, 'MRS-2026-P4TW9R'],
        ['Estelle Moussavou', 'e.moussavou@exemple.com', 'progress'],
      ] },
    { id: 's_demo2', title: 'Ingénieur EIA — poste Libreville', profileId: P2, questionCount: 25, passMark: 70, createdAt: now - 6 * DAY, deadline: now + 10 * DAY, themes: t2,
      cands: [
        ['Rodrigue Ndong Ella', 'r.ndong@exemple.com', 'done', 91, 26 * 60e3 + 30e3, 'MRS-2026-H8NC3D'],
        ['Sandrine Biyoghe', 's.biyoghe@exemple.com', 'done', 58, 24 * 60e3 + 50e3],
        ['Fabrice Mavoungou', 'f.mavoungou@exemple.com', 'invited'],
      ] },
  ];

  let n = 0;
  for (const s of sessions) {
    db.sessions.push({ id: s.id, status: 'open', level: levelOfProfile(s.profileId), type: 'recruitment', companyId: 'c_demo', title: s.title, profileId: s.profileId, questionCount: s.questionCount, passMark: s.passMark, createdAt: s.createdAt, deadline: s.deadline });
    for (const c of s.cands) {
      n++;
      const [name, email, kind, percent, dur, code] = c;
      const inv = { id: `i_demo${n}`, sessionId: s.id, token: `demo${String(n).padStart(2, '0')}tok${s.id.slice(-1)}x${n}`, name, email, status: 'invited', attemptId: null, createdAt: s.createdAt, startedAt: null, finishedAt: null };
      if (kind === 'done' || kind === 'progress') {
        const started = now - (n + 1) * DAY * 0.8;
        inv.startedAt = started;
        inv.attemptId = `a_demo${n}`;
        const att = {
          id: inv.attemptId, mode: 'exam', synthetic: true, deviceId: 'seed', profileId: s.profileId, sessionId: s.id, invitationId: inv.id,
          candidate: { name, email }, startedAt: started, passMark: s.passMark, total: s.questionCount, items: [], idx: 0, phase: 'question',
          status: kind === 'done' ? 'done' : 'in_progress',
        };
        if (kind === 'done') {
          const correct = Math.round((percent / 100) * s.questionCount);
          Object.assign(att, {
            finishedAt: started + dur, durationMs: dur, correct, percent: Math.round((correct / s.questionCount) * 100),
            themes: synthThemes(s.themes, s.questionCount, percent, n),
          });
          att.passed = att.percent >= s.passMark;
          inv.status = att.passed ? 'passed' : 'failed';
          inv.finishedAt = att.finishedAt;
          if (code && att.passed) {
            db.certificates.push({ code, attemptId: att.id, name, email, profileId: s.profileId, profileName: '', percent: att.percent, passMark: s.passMark, date: att.finishedAt });
          }
        } else {
          inv.status = 'started';
        }
        db.attempts.push(att);
      }
      db.invitations.push(inv);
    }
  }
  // --- Session « Montée en compétences » : équipe nommée, plusieurs passages, avant / après ---
  const total3 = 20;
  const biasRows = [
    ['Alain Obiang', 'a.obiang@exemple.com', [[60, 40, 45, 45], [75, 70, 62, 78]]],
    ['Nadège Koumba', 'n.koumba@exemple.com', [[55, 60, 50, 55], [60, 68, 55, 66]]],
    ['Hervé Ndzigou', 'h.ndzigou@exemple.com', [[82, 78, 80, 80], [90, 85, 88, 90]]],
    ['Chantal Mboumba', 'c.mboumba@exemple.com', [[35, 50, 40, 50]]],
    ['Lionel Essono', 'l.essono@exemple.com', []],
  ];
  const s3 = { id: 's_demo3', level: levelOfProfile(P3), type: 'training', companyId: 'c_demo', title: 'Équipe maintenance — montée en compétences 2026', profileId: P3, questionCount: total3, passMark: 70, createdAt: now - 45 * DAY, deadline: now + 30 * DAY };
  db.sessions.push(s3);
  const per = Math.max(1, Math.floor(total3 / t3.length));
  biasRows.forEach(([name, email, tries], k) => {
    const inv = { id: 'i_team' + k, sessionId: s3.id, token: 'team0' + k + 'tokz' + k + 'q', name, email, status: 'invited', attemptId: null, createdAt: s3.createdAt, startedAt: null, finishedAt: null };
    tries.forEach((pcts, j) => {
      const started = now - (tries.length - j === 2 ? 38 : 6) * DAY + k * 3600e3;
      const themes = {};
      t3.forEach((n2, ti) => { const t = ti === t3.length - 1 ? total3 - per * (t3.length - 1) : per; themes[n2] = { ok: Math.round((pcts[ti % pcts.length] / 100) * t), total: t }; });
      const correct = Object.values(themes).reduce((a, b) => a + b.ok, 0);
      const percent = Math.round((correct / total3) * 100);
      const dur = (14 + k + j) * 60e3;
      const att = { id: 'a_team' + k + '_' + j, mode: 'exam', synthetic: true, deviceId: 'seed', profileId: P3, sessionId: s3.id, invitationId: inv.id, candidate: { name, email },
        startedAt: started, finishedAt: started + dur, durationMs: dur, passMark: 70, total: total3, items: [], idx: total3, phase: 'done', status: 'done', correct, percent, passed: percent >= 70, themes };
      db.attempts.push(att);
      inv.attemptId = att.id; inv.startedAt = inv.startedAt || started; inv.finishedAt = att.finishedAt; inv.status = att.passed ? 'passed' : 'failed';
    });
    db.invitations.push(inv);
  });
  let aid = 0;
  const as = (inv, kind, theme, dueDays, doneDays) => ({ id: 'as_demo' + (aid++), sessionId: s3.id, invitationId: inv, kind, profileId: P3, moduleId: null, theme, due: now + dueDays * DAY, createdAt: now - 10 * DAY, doneAt: doneDays == null ? null : now - doneDays * DAY });
  db.assignments = [
    as('i_team0', 'practice', t3[2], -2),
    as('i_team0', 'practice', t3[3], 6),
    as('i_team1', 'practice', t3[3], 12, 1),
    as('i_team3', 'practice', t3[0], 5),
    as('i_team3', 'practice', t3[2], 5),
  ];
  // Recrutements : quelques décisions
  const dec = (id, d) => { const i = db.invitations.find((x) => x.id === id); if (i) i.decision = d; };
  dec('i_demo1', 'hired'); dec('i_demo2', 'rejected');

  // Mes équipes : collaborateurs aux cas variés (valide, expire bientôt, expirée, à planifier, plan en retard, plan à venir)
  const P4 = pick('hse-agent', 3); const P5 = pick('tech-instru', 4);
  const mAgo = (n) => addMonths(now, -n);
  const people = [
    ['e_demo1', 'Alain Obiang', 'a.obiang@exemple.com', P3, 'Maintenance Port-Gentil', mAgo(40), { cert: [P3, mAgo(5), 'MRS-2026-E1A111'] }],
    ['e_demo2', 'Nadège Koumba', 'n.koumba@exemple.com', P3, 'Maintenance Port-Gentil', mAgo(30), { cert: [P3, addMonths(now, -24) + 45 * DAY, 'MRS-2024-E2B222'] }],
    ['e_demo3', 'Hervé Ndzigou', 'h.ndzigou@exemple.com', P3, 'Maintenance Port-Gentil', mAgo(60), { cert: [P3, mAgo(26), 'MRS-2024-E3C333'] }],
    ['e_demo4', 'Chantal Mboumba', 'c.mboumba@exemple.com', P3, 'Maintenance Port-Gentil', mAgo(8), {}],
    ['e_demo5', 'Lionel Essono', 'l.essono@exemple.com', P3, 'Maintenance Port-Gentil', mAgo(3), {}],
    ['e_demo6', 'Marc Obame', 'm.obame@exemple.com', P1, 'Production offshore', mAgo(18), { cert: [P1, mAgo(1), 'MRS-2026-E6F666'] }],
    ['e_demo7', 'Estelle Ndong', 'e.ndong@exemple.com', P4, 'QHSE', mAgo(50), { cert: [P4, mAgo(30), 'MRS-2024-E7G777'] }],
    ['e_demo8', 'Karim Mba', 'k.mba@exemple.com', P1, 'Production offshore', mAgo(22), { cert: [P1, mAgo(3), 'MRS-2026-E8H888'] }],
  ];
  for (const [id, name, email, profileId, team, hire, extra] of people) {
    db.employees.push({ id, companyId: 'c_demo', name, email, profileId, team, hireDate: hire, createdAt: now - 20 * DAY });
    if (extra.cert) {
      const [pid, date, code] = extra.cert;
      db.certificates.push({ code, attemptId: 'a_' + id, name, email, profileId: pid, profileName: '', percent: 74 + (id.length + name.length) % 17, passMark: 70, date });
    }
  }
  const pl = (employeeId, profileId, dueDays, reason, priority, status = 'planned', extra = {}) =>
    db.plan.push({ id: 'p_demo' + db.plan.length, employeeId, profileId, due: now + dueDays * DAY, reason, priority, status, invitationId: null, sessionId: null, createdAt: now - 12 * DAY, doneAt: null, ...extra });
  pl('e_demo1', P5, -10, 'obligation', 'haute');                 // plan en retard
  pl('e_demo3', P3, 20, 'recyclage', 'haute');                   // renouvellement à venir
  pl('e_demo5', P3, 30, 'montee', 'normale');                    // plan à venir
  pl('e_demo7', P4, 10, 'recyclage', 'haute', 'in_progress');    // en cours
  pl('e_demo8', P2, -3, 'montee', 'normale');                    // plan en retard

  // Un Pass par personne : une commande payée (démo) par session.
  const inv = db.invitations.find((i) => i.id === 'i_demo7');
  if (inv) inv.trainingAt = now - 2 * DAY;
  db.sessions.forEach((sess, k) => {
    const list = db.invitations.filter((i) => i.sessionId === sess.id);
    const unit = passPrice(sess.level);
    const order = { id: 'o_demo' + (k + 1), number: 'MRS-' + new Date(now).getFullYear() + '-' + String(k + 1).padStart(4, '0'), companyId: 'c_demo', sessionId: sess.id, sessionTitle: sess.title,
      profileId: sess.profileId, profileName: pdata.profiles.find((p) => p.id === sess.profileId)?.name || '', level: sess.level, unitPrice: unit, qty: list.length, total: unit * list.length,
      method: k === 1 ? 'airtel' : 'card', ref: 'DEMO-000' + (k + 1), demo: true, date: sess.createdAt };
    db.orders.push(order);
    list.forEach((i) => { i.orderId = order.id; i.price = unit; });
  });
  return db;
}
