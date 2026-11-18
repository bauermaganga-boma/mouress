import { CONFIG } from '../../config.js';
import { getProfilesData, loadContent, domainOf, branchOf, levelOf, themesOf, funnelDomainFor } from '../data.js';
import { local } from '../store.js';
import { esc, fmtDate, pct } from '../util.js';
import { icon, badge, bar, comingSoon, crumbs } from '../ui.js';
import { examSize, qSeconds } from '../quiz.js';

export default async function render(ctx, root) {
  const data = await getProfilesData();
  const profile = data.profiles.find((p) => p.id === ctx.params.id);
  if (!profile) { (await import('./notfound.js')).default(ctx, root); return; }
  ctx.setTitle(profile.name);
  const dom = domainOf(data, funnelDomainFor(data, profile));
  const grp = (data.groups || []).find((g) => g.id === dom?.group);
  const noLvl = !!branchOf(data, profile.branch)?.noLevel;
  const listHref = dom ? `#/formation/${dom.id}/${profile.branch}${noLvl ? '' : '/' + profile.level}` : '#/formation';
  const branch = branchOf(data, profile.branch);
  const lvl = levelOf(data, profile.level);
  const bc = crumbs([{ label: 'Formation', href: '#/formation' }, ...(grp ? [{ label: grp.name, href: `#/formation/${grp.id}` }] : []), { label: dom?.name || 'Secteur', href: dom ? `#/formation/${dom.id}` : '#/formation' }, { label: branch?.name || 'Métiers', href: dom ? `#/formation/${dom.id}/${profile.branch}` : '#/formation' }, ...(noLvl ? [] : [{ label: lvl?.name || 'Niveau', href: listHref }])]);
  const content = await loadContent(profile.id);
  if (!ctx.alive()) return;

  const head = `${bc}
    <a class="back-link" href="${listHref}">${icon('arrow', 16, 'flip')} Retour à la liste des postes</a>
    <div class="profile-head"><span class="pcard-ico big">${icon(dom?.icon || 'briefcase', 30)}</span>
    <div><div class="btn-row" style="gap:.4rem">${badge(lvl?.name || '', 'info')}${badge(dom?.name || '')}</div>
    <h1 class="page-title">${esc(profile.name)}</h1><p class="muted">${esc(profile.desc)}</p></div></div>`;

  if (!content || (!content.questions.length && !content.modules.length)) {
    root.innerHTML = `<div class="container page">${head}${comingSoon(profile.name)}</div>`;
    return;
  }

  const prog = local.getProgress()[profile.id] || { modules: {}, practice: {} };
  const themes = themesOf(content);
  const doneMods = content.modules.filter((m) => prog.modules[m.id]).length;
  const attempts = (await ctx.store.listAttemptsByDevice()).filter((a) => a.profileId === profile.id && a.status === 'done' && !a.sessionId);
  const best = attempts.reduce((m, a) => Math.max(m, a.percent), 0);
  const n = examSize(content);
  const minutes = Math.round(content.questions.slice(0, n).reduce((s, q) => s + qSeconds(q), 0) / 60);

  root.innerHTML = `<div class="container page">${head}
    <div class="btn-row" style="margin-bottom:var(--sp-6)">
      <a class="btn btn-primary btn-lg" href="#/examen/${esc(profile.id)}">${icon('clock', 20)} Passer l’examen</a>
      <a class="btn btn-outline btn-lg" href="#/entrainement/${esc(profile.id)}">${icon('target', 20)} S’entraîner</a>
      ${content.modules.length ? `<a class="btn btn-light btn-lg" href="#/cours/${esc(profile.id)}/${esc(content.modules.find((m) => !prog.modules[m.id])?.id || content.modules[0].id)}">${icon('book', 20)} ${doneMods ? 'Continuer le cours' : 'Commencer le cours'}</a>` : ''}
    </div>
    <div class="grid grid-4 stats">
      <div class="card stat"><span class="stat-n">${content.modules.length}</span><span class="muted small">modules de cours</span></div>
      <div class="card stat"><span class="stat-n">${content.questions.length}</span><span class="muted small">questions · ${themes.length} thèmes</span></div>
      <div class="card stat"><span class="stat-n">${n}</span><span class="muted small">questions à l’examen · ~${minutes} min</span></div>
      <div class="card stat"><span class="stat-n">${attempts.length ? best + ' %' : '—'}</span><span class="muted small">meilleur score${attempts.length ? ` (${attempts.length} essai${attempts.length > 1 ? 's' : ''})` : ''}</span></div>
    </div>

    <section class="block"><div class="split"><h2>Cours</h2><span class="muted small">${doneMods} / ${content.modules.length} terminé${doneMods > 1 ? 's' : ''}</span></div>
      ${bar(pct(doneMods, content.modules.length), 'ok')}
      <ol class="mod-list">${content.modules.map((m, i) => `<li><a class="card card-link mod" href="#/cours/${esc(profile.id)}/${esc(m.id)}">
        <span class="mod-n ${prog.modules[m.id] ? 'done' : ''}">${prog.modules[m.id] ? icon('check', 18) : i + 1}</span>
        <span class="mod-t"><strong>${esc(m.title)}</strong><span class="muted xs">${esc(m.theme || '')} · ${esc(m.minutes || 8)} min</span></span>${icon('arrow', 18)}</a></li>`).join('')}</ol></section>

    <section class="block"><h2>Entraînement par thème</h2>
      <p class="muted">Feedback immédiat et explication après chaque question. Sans note, sans limite d’essais.</p>
      <div class="grid grid-3">${themes.map((t) => {
        const pr = prog.practice[t.name];
        const rate = pr ? pct(pr.ok, pr.total) : null;
        return `<a class="card card-link theme" href="#/entrainement/${esc(profile.id)}?theme=${encodeURIComponent(t.name)}"><h4>${esc(t.name)}</h4>
          <span class="muted xs">${t.count} questions</span>${bar(rate ?? 0, rate == null ? '' : rate >= 70 ? 'ok' : '')}
          <span class="xs muted">${rate == null ? 'Pas encore pratiqué' : `Réussite cumulée : ${rate} %`}</span></a>`;
      }).join('')}</div></section>

    <section class="block"><h2>Examen</h2>
      <div class="card exam-card"><div><p><strong>${n} questions</strong> tirées de façon équilibrée entre les ${themes.length} thèmes, dans un ordre mélangé. Une question à la fois, <strong>chronométrée</strong>, sans retour arrière. Seuil de réussite : <strong>${CONFIG.PASS_MARK} %</strong>. Une attestation vérifiable est délivrée en cas de réussite.</p></div>
      <a class="btn btn-primary" href="#/examen/${esc(profile.id)}">Commencer l’examen ${icon('arrow', 16)}</a></div></section>

    ${attempts.length ? `<section class="block"><h2>Mes meilleurs scores</h2><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Score</th><th>Résultat</th><th></th></tr></thead><tbody>
      ${attempts.slice().sort((a, b) => b.percent - a.percent).slice(0, 5).map((a) => `<tr><td>${fmtDate(a.finishedAt)}</td><td><strong>${a.percent} %</strong></td><td>${badge(a.passed ? 'Réussi' : 'Non réussi', a.passed ? 'ok' : 'ko')}</td><td><a href="#/resultat/${esc(a.id)}">Voir</a></td></tr>`).join('')}
      </tbody></table></div></section>` : ''}
  </div>`;
}
