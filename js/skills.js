// Analyse de compétences : matrice par thème, tendance avant/après, écarts, recommandations, échéances.
import { loadContent } from './data.js';
import { pct } from './util.js';

const DAY = 86400000;

/** Bande de couleur : rouge < 50 %, orange < seuil, vert >= seuil. */
export function band(p, passMark = 70) {
  if (p == null) return 'none';
  return p < 50 ? 'ko' : p < passMark ? 'mid' : 'ok';
}
export const BAND_LABEL = { ko: 'Faible', mid: 'À renforcer', ok: 'Atteint', none: 'Non testé' };

const themePct = (att) => Object.fromEntries(Object.entries(att?.themes || {}).map(([t, v]) => [t, pct(v.ok, v.total)]));

/** Statistiques d'un collaborateur à partir de ses tentatives terminées. */
export function collabStats(inv) {
  const done = (inv.attempts || []).filter((a) => a.status === 'done');
  const first = done[0] || null;
  const last = done[done.length - 1] || null;
  const f = themePct(first); const l = themePct(last);
  const delta = {};
  if (done.length > 1) for (const t of Object.keys(l)) if (t in f) delta[t] = l[t] - f[t];
  return {
    count: done.length, first, last, themesFirst: f, themesLast: l, delta,
    overallFirst: first?.percent ?? null, overallLast: last?.percent ?? null,
    overallDelta: done.length > 1 ? last.percent - first.percent : null,
  };
}

export function matrixThemes(invitations) {
  const set = [];
  for (const inv of invitations) {
    for (const a of inv.attempts || []) for (const t of Object.keys(a.themes || {})) if (!set.includes(t)) set.push(t);
  }
  return set;
}

export function gaps(stats, passMark = 70) {
  return Object.entries(stats.themesLast).filter(([, p]) => p < passMark).sort((a, b) => a[1] - b[1]).map(([theme, p]) => ({ theme, pct: p }));
}

/** Modules de cours et série d'entraînement recommandés pour un thème. */
export async function recommend(profileId, theme) {
  const content = await loadContent(profileId);
  const modules = content ? content.modules.filter((m) => m.theme === theme).map((m) => ({ id: m.id, title: m.title, minutes: m.minutes })) : [];
  const hasTheme = content ? content.questions.some((q) => q.theme === theme) : false;
  return { modules, practice: hasTheme, available: !!content };
}

export function dueState(a, now = Date.now()) {
  if (a.doneAt) return { key: 'done', label: 'Fait', tone: 'ok' };
  const d = Math.ceil((a.due - now) / DAY);
  if (a.due < now) return { key: 'late', label: `En retard de ${Math.max(1, Math.floor((now - a.due) / DAY))} j`, tone: 'ko' };
  if (d <= 7) return { key: 'soon', label: d <= 1 ? 'Échéance demain' : `Dans ${d} j`, tone: 'warn' };
  return { key: 'ok', label: `Dans ${d} j`, tone: 'info' };
}

export function assignmentTitle(a, content) {
  if (a.kind === 'module') {
    const m = content?.modules?.find((x) => x.id === a.moduleId);
    return `Module : ${m?.title || a.moduleId}`;
  }
  return `Entraînement : ${a.theme}`;
}
export function assignmentHref(a) {
  return a.kind === 'module' ? `#/cours/${a.profileId}/${a.moduleId}` : `#/entrainement/${a.profileId}?theme=${encodeURIComponent(a.theme)}`;
}
