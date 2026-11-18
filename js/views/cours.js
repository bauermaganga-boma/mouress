import { getProfile, loadContent } from '../data.js';
import { local } from '../store.js';
import { esc, mdLite, pct } from '../util.js';
import { icon, bar, figure, comingSoon } from '../ui.js';

export default async function render(ctx, root) {
  const { id, mod } = ctx.params;
  const profile = await getProfile(id);
  if (!profile) { (await import('./notfound.js')).default(ctx, root); return; }
  const content = await loadContent(id);
  if (!ctx.alive()) return;
  if (!content || !content.modules.length) {
    ctx.setTitle(profile.name);
    root.innerHTML = `<div class="container page">${comingSoon(profile.name)}</div>`;
    return;
  }
  const i = content.modules.findIndex((m) => m.id === mod);
  if (i < 0) { (await import('./notfound.js')).default(ctx, root); return; }
  const m = content.modules[i];
  const prev = content.modules[i - 1];
  const next = content.modules[i + 1];
  const prog = () => local.getProgress()[id] || { modules: {} };
  const done = () => content.modules.filter((x) => prog().modules[x.id]).length;
  ctx.setTitle(m.title);
  const pass = ctx.query.get('pass');
  const q = pass ? `?pass=${encodeURIComponent(pass)}` : '';
  const home = pass ? `#/t/${pass}` : `#/profil/${id}`;
  if (pass) ctx.store.touchInvitation?.(pass);

  root.innerHTML = `<div class="container page lesson-wrap">
    <nav class="crumbs" aria-label="Fil d’Ariane">${pass ? `<a href="${esc(home)}">Mon Pass</a>` : `<a href="#/formation">Formation</a><span>›</span><a href="${esc(home)}">${esc(profile.name)}</a>`}<span>›</span><span>Module ${i + 1}</span></nav>
    <div class="lesson-progress"><div class="split"><span class="small muted">Module ${i + 1} sur ${content.modules.length}</span><span class="small muted" id="done-count">${done()} terminé(s)</span></div>
      <div id="pbar">${bar(pct(done(), content.modules.length), 'ok')}</div></div>
    <article class="lesson card">
      <p class="eyebrow dark">${esc(m.theme || 'Cours')} · ${esc(m.minutes || 8)} min de lecture</p>
      <h1 class="h1-md">${esc(m.title)}</h1>
      ${m.img ? figure(m.img, m.imgAlt, 'lesson-fig') : ''}
      <div class="prose">${mdLite(m.body)}</div>
      ${m.keyPoints?.length ? `<aside class="keypoints" aria-label="Points clés"><h2 class="kp-title">${icon('flag', 20)} À retenir</h2><ul>${m.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></aside>` : ''}
    </article>
    <div class="lesson-nav">
      ${prev ? `<a class="btn btn-light" href="#/cours/${esc(id)}/${esc(prev.id)}${q}">← Précédent</a>` : '<span></span>'}
      <button type="button" class="btn btn-primary" id="finish">${next ? 'Terminer et passer au suivant' : 'Terminer le cours'}</button>
    </div>
    <p class="center small muted" style="margin-top:var(--sp-5)"><a href="#/entrainement/${esc(id)}${pass ? `?pass=${encodeURIComponent(pass)}&theme=` : '?theme='}${m.theme ? encodeURIComponent(m.theme) : ''}">S’entraîner sur ce thème</a> · <a href="${esc(home)}">${pass ? 'Retour à mon Pass' : 'Retour au profil'}</a></p>
  </div>`;

  root.querySelector('#finish').addEventListener('click', () => {
    local.markModule(id, m.id);
    ctx.store.markAssignmentsDone(local.getMe().email, { profileId: id, moduleId: m.id }).catch(() => {});
    ctx.toast('Module enregistré comme terminé.');
    ctx.go(next ? `/cours/${id}/${next.id}${q}` : (pass ? `/t/${pass}` : `/profil/${id}`));
  });
}
