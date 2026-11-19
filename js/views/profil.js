import { CONFIG } from '../../config.js';
import { getProfilesData, loadContent, domainOf, branchOf, levelOf, themesOf, funnelDomainFor } from '../data.js';
import { local } from '../store.js';
import { esc, fmtDate, pct } from '../util.js';
import { icon, badge, bar, comingSoon, crumbs } from '../ui.js';
import { examSize, qSeconds } from '../quiz.js';
import { sampleCertificateHTML } from '../certificate.js';

export default async function render(ctx, root) {
  const data = await getProfilesData();
  const profile = data.profiles.find((p) => p.id === ctx.params.id);
  if (!profile) { (await import('./notfound.js')).default(ctx, root); return; }
  ctx.setTitle(profile.name);
  const dom = domainOf(data, funnelDomainFor(data, profile));
  const grp = (data.groups || []).find((g) => g.id === dom?.group);
  const noLvl = !!branchOf(data, profile.branch)?.noLevel;
  const sharedOnly = !!branchOf(data, profile.branch)?.sharedOnly;
  const listHref = sharedOnly ? (grp ? `#/formation/${grp.id}` : '#/formation') : dom ? `#/formation/${dom.id}/${profile.branch}${noLvl ? '' : '/' + profile.level}` : '#/formation';
  const branch = branchOf(data, profile.branch);
  const lvl = levelOf(data, profile.level);
  const bc = sharedOnly
    ? crumbs([{ label: 'Formation', href: '#/formation' }, ...(grp ? [{ label: grp.name, href: `#/formation/${grp.id}` }] : []), { label: profile.name }])
    : crumbs([{ label: 'Formation', href: '#/formation' }, ...(grp ? [{ label: grp.name, href: `#/formation/${grp.id}` }] : []), { label: dom?.name || 'Secteur', href: dom ? `#/formation/${dom.id}` : '#/formation' }, { label: branch?.name || 'Métiers', href: dom ? `#/formation/${dom.id}/${profile.branch}` : '#/formation' }, ...(noLvl ? [] : [{ label: lvl?.name || 'Niveau', href: listHref }])]);
  const content = await loadContent(profile.id);
  if (!ctx.alive()) return;

  const head = `${bc}
    <a class="back-link" href="${listHref}">${icon('arrow', 16, 'flip')} ${sharedOnly ? 'Retour' : 'Retour à la liste des postes'}</a>
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

  // regroupement par thème : cours + entraînement ensemble
  const modsOf = (name) => content.modules.map((m, i) => ({ m, i })).filter((x) => (x.m.theme || '') === name);
  const known = new Set(themes.map((t) => t.name));
  const groups = themes.map((t) => ({ name: t.name, count: t.count, mods: modsOf(t.name) }));
  const orphans = content.modules.map((m, i) => ({ m, i })).filter((x) => !known.has(x.m.theme || ''));
  if (orphans.length) groups.push({ name: 'Autres cours', count: 0, mods: orphans, noPractice: true });
  const firstTodo = content.modules.find((m) => !prog.modules[m.id]) || content.modules[0];
  const themeBlock = (g, gi) => {
    const doneN = g.mods.filter((x) => prog.modules[x.m.id]).length;
    const pr = g.noPractice ? null : prog.practice[g.name];
    const rate = pr ? pct(pr.ok, pr.total) : null;
    const allRead = g.mods.length ? doneN === g.mods.length : true;
    const state = allRead && (g.noPractice || (rate != null && rate >= 70)) ? 'done' : doneN || pr ? 'going' : 'todo';
    const label = { done: 'Terminé', going: 'En cours', todo: 'À commencer' }[state];
    return `<article class="theme-block theme-${state}" id="th-${gi}">
      <header class="theme-head"><span class="theme-num">${state === 'done' ? icon('check', 16) : gi + 1}</span>
        <div class="theme-title"><h3>${esc(g.name)}</h3><span class="xs muted">${g.mods.length ? g.mods.length + ' cours' : ''}${g.mods.length && g.count ? ' · ' : ''}${g.count ? g.count + ' questions' : ''}</span></div>
        <span class="theme-state">${label}</span></header>
      ${g.mods.length ? `<ul class="theme-lessons">${g.mods.map((x) => `<li><a href="#/cours/${esc(profile.id)}/${esc(x.m.id)}"><span class="les-dot ${prog.modules[x.m.id] ? 'done' : ''}">${prog.modules[x.m.id] ? icon('check', 12) : ''}</span><span class="les-t">${esc(x.m.title)}</span><span class="xs muted">${esc(x.m.minutes || 8)} min</span></a></li>`).join('')}</ul>` : ''}
      ${g.noPractice ? '' : `<div class="theme-foot"><span class="xs muted">${rate == null ? 'Pas encore pratiqué' : 'Réussite cumulée : ' + rate + ' %'}</span><a class="btn btn-outline btn-sm" href="#/entrainement/${esc(profile.id)}?theme=${encodeURIComponent(g.name)}">${icon('target', 14)} S’entraîner sur ce thème</a></div>${bar(rate ?? 0, rate == null ? '' : rate >= 70 ? 'ok' : '')}`}
    </article>`;
  };

  root.innerHTML = `<div class="container page">${head}
    <div class="actions-row">
      <a class="btn btn-primary btn-md" href="#/examen/${esc(profile.id)}">${icon('clock', 16)} Passer l’examen</a>
      <a class="btn btn-outline btn-md" href="#/entrainement/${esc(profile.id)}">${icon('target', 16)} S’entraîner</a>
      ${content.modules.length ? `<a class="btn btn-light btn-md" href="#/cours/${esc(profile.id)}/${esc(firstTodo.id)}">${icon('book', 16)} ${doneMods ? 'Continuer' : 'Cours'}</a>` : ''}
    </div>
    <ul class="kpis" aria-label="Résumé">
      <li><strong>${content.modules.length}</strong><span>cours</span></li>
      <li><strong>${content.questions.length}</strong><span>questions · ${themes.length} thèmes</span></li>
      <li><strong>${n}</strong><span>à l’examen · ~${minutes} min</span></li>
      <li><strong>${attempts.length ? best + ' %' : '—'}</strong><span>meilleur score</span></li>
    </ul>

    <section class="block"><div class="split"><h2>Thèmes</h2><span class="muted small">${doneMods} / ${content.modules.length} cours terminés</span></div>
      ${bar(pct(doneMods, content.modules.length), 'ok')}
      <div class="theme-list">${groups.map(themeBlock).join('')}</div></section>

    <section class="block"><h2>Attestation</h2>
      <p class="muted small">En cas de réussite (seuil ${CONFIG.PASS_MARK} %), vous recevez une attestation vérifiable en ligne.</p>
      ${sampleCertificateHTML(profile.name, dom?.name || '', CONFIG.PASS_MARK)}</section>

    <section class="block"><h2>Examen</h2>
      <div class="card exam-card"><div><p><strong>${n} questions</strong> tirées de façon équilibrée entre les ${themes.length} thèmes, dans un ordre mélangé. Une question à la fois, <strong>chronométrée</strong>, sans retour arrière. Seuil de réussite : <strong>${CONFIG.PASS_MARK} %</strong>. Une attestation vérifiable est délivrée en cas de réussite.</p></div>
      <a class="btn btn-primary" href="#/examen/${esc(profile.id)}">Commencer l’examen ${icon('arrow', 16)}</a></div></section>

    ${attempts.length ? `<section class="block"><h2>Mes meilleurs scores</h2><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Score</th><th>Résultat</th><th></th></tr></thead><tbody>
      ${attempts.slice().sort((a, b) => b.percent - a.percent).slice(0, 5).map((a) => `<tr><td>${fmtDate(a.finishedAt)}</td><td><strong>${a.percent} %</strong></td><td>${badge(a.passed ? 'Réussi' : 'Non réussi', a.passed ? 'ok' : 'ko')}</td><td><a href="#/resultat/${esc(a.id)}">Voir</a></td></tr>`).join('')}
      </tbody></table></div></section>` : ''}
  </div>`;
}
