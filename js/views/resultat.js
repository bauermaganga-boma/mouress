import { CONFIG } from '../../config.js';
import { getProfile, loadContent } from '../data.js';
import { esc, fmtDate, fmtDuration, pct } from '../util.js';
import { icon, badge, bar, scoreRing } from '../ui.js';
import { choicesHTML, questionBodyHTML, correctDisplayIndex } from '../qview.js';

export default async function render(ctx, root) {
  const att = await ctx.store.getAttempt(ctx.params.id);
  if (!att) { (await import('./notfound.js')).default(ctx, root); return; }
  if (att.status !== 'done') {
    if (att.sessionId) { root.innerHTML = `<div class="container-narrow page"><div class="alert alert-info">Ce test n’est pas terminé.</div></div>`; return; }
    ctx.go(`/examen/${att.profileId}`); return;
  }
  const profile = await getProfile(att.profileId);
  const content = await loadContent(att.profileId);
  const name = profile?.name || att.profileName || att.profileId;
  ctx.setTitle(`Résultat — ${name}`);

  let isOwnerRH = false;
  let training = false;
  if (att.sessionId) {
    const s = await ctx.store.getSession(att.sessionId).catch(() => null);
    training = s?.type === 'training';
    isOwnerRH = !!(ctx.user && s && s.companyId === ctx.user.companyId);
  }
  const showCorrection = att.items?.length && content && (!att.sessionId || training || CONFIG.SHOW_CORRECTION_FOR_SESSIONS || isOwnerRH);
  if (!ctx.alive()) return;

  const themes = Object.entries(att.themes || {});
  const best = themes.slice().sort((a, b) => pct(b[1].ok, b[1].total) - pct(a[1].ok, a[1].total));
  const weak = themes.filter(([, v]) => pct(v.ok, v.total) < att.passMark);

  root.innerHTML = `<div class="container-narrow page result">
    ${isOwnerRH ? `<div class="crumbs"><a href="#/rh">Tableau de bord</a><span>›</span><a href="#/rh/session/${esc(att.sessionId)}">Session</a><span>›</span><span>Résultat</span></div>` : ''}
    <div class="card result-head ${att.passed ? 'is-pass' : 'is-fail'}">
      ${scoreRing(att.percent, att.passed)}
      <div>
        <p class="eyebrow dark">${esc(name)}</p>
        <h1 class="h1-md">${att.passed ? 'Félicitations, test réussi' : 'Test non réussi cette fois'}</h1>
        <p><strong>${esc(att.candidate?.name || '')}</strong> · ${att.correct} bonne${att.correct > 1 ? 's' : ''} réponse${att.correct > 1 ? 's' : ''} sur ${att.total}</p>
        <div class="btn-row" style="gap:.4rem">${badge(`Seuil ${att.passMark} %`, att.passed ? 'ok' : 'warn')}${badge(`Durée ${fmtDuration(att.durationMs)}`)}${badge(fmtDate(att.finishedAt))}</div>
      </div>
    </div>
    ${att.sessionId && !isOwnerRH ? `<div class="alert alert-info">${icon('check', 16)} ${training ? 'Votre résultat a été ajouté à votre parcours de montée en compétences.' : 'Votre résultat a été transmis à l’entreprise qui vous a invité. Merci de votre participation.'}</div>` : ''}
    ${att.passed && att.certCode ? `<div class="card cert-cta"><div><h3>Votre attestation est prête</h3><p class="muted">Code <strong>${esc(att.certCode)}</strong> — vérifiable en ligne, imprimable en PDF.</p></div>
      <a class="btn btn-primary" href="#/attestation/${esc(att.certCode)}">${icon('award', 18)} Voir l’attestation</a></div>` : ''}
    ${themes.length ? `<section class="block"><h2>Résultat par thème</h2><div class="card">${themes.map(([t, v]) => {
      const p = pct(v.ok, v.total);
      return `<div class="theme-row"><span><strong>${esc(t)}</strong></span><span class="xs muted">${v.ok}/${v.total} · ${p} %</span>${bar(p, p >= att.passMark ? 'ok' : 'ko')}</div>`;
    }).join('')}</div>
      ${weak.length ? `<p class="muted small" style="margin-top:var(--sp-3)">À renforcer : ${weak.map(([t]) => esc(t)).join(', ')}.</p>` : best.length ? '<p class="muted small" style="margin-top:var(--sp-3)">Tous les thèmes atteignent le seuil.</p>' : ''}</section>` : ''}
    ${showCorrection ? correctionHTML(att, content) : ''}
    <div class="btn-row" style="margin-top:var(--sp-6)">
      ${att.sessionId ? (isOwnerRH ? `<a class="btn btn-navy" href="#/rh/session/${esc(att.sessionId)}">Retour à la session</a>` : training ? `<a class="btn btn-primary" href="#/mon-espace">Mon parcours</a><a class="btn btn-outline" href="#/entrainement/${esc(att.profileId)}">S’entraîner</a>` : '') : `<a class="btn btn-primary" href="#/examen/${esc(att.profileId)}">${icon('refresh', 18)} Repasser l’examen</a><a class="btn btn-outline" href="#/entrainement/${esc(att.profileId)}">S’entraîner</a><a class="btn btn-ghost" href="#/mon-espace">Mon espace</a>`}
    </div></div>`;
}

function correctionHTML(att, content) {
  const byId = new Map(content.questions.map((q) => [q.id, q]));
  const rows = att.items.map((it, i) => {
    const q = byId.get(it.qid);
    if (!q) return '';
    const cd = correctDisplayIndex(q, it.order);
    return `<article class="card corr ${it.ok ? 'corr-ok' : 'corr-ko'}">
      <header class="corr-head"><span class="badge ${it.ok ? 'badge-ok' : 'badge-ko'}">${it.ok ? 'Correct' : it.picked == null ? 'Temps écoulé' : 'Incorrect'}</span><span class="xs muted">Question ${i + 1} · ${esc(q.theme)}</span></header>
      ${questionBodyHTML(q)}
      ${choicesHTML(q, it.order, { picked: it.picked, locked: true, correctDisplay: cd })}
      <div class="feedback ${it.ok ? 'ok' : 'ko'}"><strong>Explication</strong><p>${esc(q.explain || '')}</p></div></article>`;
  }).join('');
  return `<section class="block"><h2>Correction détaillée</h2><div class="stack">${rows}</div></section>`;
}
