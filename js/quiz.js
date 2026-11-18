// Moteur de quiz : tirage équilibré, tentatives d'examen, notation. Aucune manipulation du DOM ici.
import { CONFIG } from '../config.js';
import { shuffle, uid, pct } from './util.js';
import { local } from './store.js';

/** Tirage équilibré par thème : répartition à tour de rôle entre thèmes, ordre final mélangé. */
export function drawBalanced(questions, n) {
  const pools = new Map();
  for (const q of questions) {
    if (!pools.has(q.theme)) pools.set(q.theme, []);
    pools.get(q.theme).push(q);
  }
  const names = shuffle([...pools.keys()]);
  names.forEach((t) => pools.set(t, shuffle(pools.get(t))));
  const total = Math.min(n, questions.length);
  const quota = Object.fromEntries(names.map((t) => [t, 0]));
  let assigned = 0;
  while (assigned < total) {
    let progressed = false;
    for (const t of names) {
      if (assigned >= total) break;
      if (quota[t] < pools.get(t).length) { quota[t]++; assigned++; progressed = true; }
    }
    if (!progressed) break;
  }
  const picked = [];
  for (const t of names) picked.push(...pools.get(t).slice(0, quota[t]));
  return shuffle(picked);
}

export const shuffledOrder = (q) => shuffle(q.choices.map((_, i) => i));

/** Durée effective d'une question : au moins 1 min 30 ; 2 min pour les cas pratiques et calculs ; jamais moins que la durée du contenu. */
export function qSeconds(q) {
  const base = q.seconds || 45;
  const floor = base >= CONFIG.LONG_THRESHOLD ? CONFIG.LONG_QUESTION_SECONDS : CONFIG.MIN_QUESTION_SECONDS;
  return Math.max(base, floor);
}

export function examSize(content, requested) {
  const want = requested || CONFIG.EXAM_QUESTIONS;
  return Math.min(want, content.questions.length);
}

export function createExamAttempt({ profile, content, count, candidate, session, invitation, passMark }) {
  const qs = drawBalanced(content.questions, examSize(content, count));
  return {
    id: uid('a'), mode: 'exam', deviceId: local.deviceId(),
    profileId: profile.id, profileName: profile.name,
    sessionId: session?.id || null, invitationId: invitation?.id || null,
    candidate: { name: candidate.name, email: candidate.email || '' },
    startedAt: Date.now(), passMark: passMark || CONFIG.PASS_MARK,
    total: qs.length,
    items: qs.map((q) => ({ qid: q.id, theme: q.theme, seconds: qSeconds(q), order: shuffledOrder(q), picked: null, ok: null, timeUsed: null })),
    idx: 0, phase: 'transition', qStart: null, status: 'in_progress',
  };
}

/** Enregistre la réponse à la question courante (picked = indice affiché, ou null si temps écoulé). */
export function answerCurrent(att, content, picked, now = Date.now()) {
  const item = att.items[att.idx];
  const q = content.questions.find((x) => x.id === item.qid);
  const timeUsed = Math.min(item.seconds * 1000, Math.max(0, now - (att.qStart || now)));
  item.picked = picked;
  item.timeUsed = picked == null ? item.seconds * 1000 : timeUsed;
  item.ok = picked != null && q ? item.order[picked] === q.answer : false;
  att.idx += 1;
  att.qStart = null;
  att.phase = att.idx >= att.items.length ? 'finishing' : 'transition';
  return att;
}

/** Au rechargement : la question en cours dont le temps a expiré compte comme perdue. */
export function reconcile(att, content, now = Date.now()) {
  let changed = false;
  if (att.status === 'in_progress' && att.phase === 'question') {
    const it = att.items[att.idx];
    if (!it || !att.qStart || now >= att.qStart + it.seconds * 1000) {
      if (it) { answerCurrent(att, content, null, now); changed = true; }
    }
  }
  return changed;
}

export function finalize(att, now = Date.now()) {
  const themes = {};
  let correct = 0;
  let spent = 0;
  for (const it of att.items) {
    const t = (themes[it.theme] = themes[it.theme] || { ok: 0, total: 0 });
    t.total++;
    if (it.ok) { t.ok++; correct++; }
    spent += it.timeUsed || 0;
  }
  att.correct = correct;
  att.percent = pct(correct, att.items.length);
  att.passed = att.percent >= att.passMark;
  att.themes = themes;
  att.durationMs = spent;
  att.finishedAt = now;
  att.status = 'done';
  att.phase = 'done';
  return att;
}

/** Entraînement : sélection (thème optionnel) mélangée avec ordre des choix mélangé. */
export function buildPractice(content, { theme, n }) {
  const pool = theme ? content.questions.filter((q) => q.theme === theme) : content.questions;
  const qs = theme ? shuffle(pool).slice(0, n) : drawBalanced(pool, n);
  return qs.map((q) => ({ q, order: shuffledOrder(q) }));
}

export function themeBreakdown(items) {
  const t = {};
  for (const it of items) {
    const e = (t[it.theme] = t[it.theme] || { ok: 0, total: 0 });
    e.total++;
    if (it.ok) e.ok++;
  }
  return t;
}
