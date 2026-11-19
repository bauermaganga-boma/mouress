import { getProfile, loadContent, themesOf } from '../data.js';
import { local } from '../store.js';
import { esc, pct, fmtClock } from '../util.js';
import { icon, bar, comingSoon } from '../ui.js';
import { buildPractice, themeBreakdown, qSeconds } from '../quiz.js';
import { choicesHTML, questionBodyHTML, correctDisplayIndex } from '../qview.js';

export default async function render(ctx, root) {
  const profile = await getProfile(ctx.params.id);
  if (!profile) { (await import('./notfound.js')).default(ctx, root); return; }
  ctx.setTitle(`Entraînement — ${profile.name}`);
  const content = await loadContent(profile.id);
  if (!ctx.alive()) return;
  if (!content || !content.questions.length) { root.innerHTML = `<div class="container page">${comingSoon(profile.name)}</div>`; return; }
  const themes = themesOf(content);
  const pass = ctx.query.get('pass');
  const home = pass ? `#/t/${pass}` : `#/profil/${profile.id}`;
  if (pass) ctx.store.touchInvitation?.(pass);
  const wanted = ctx.query.get('theme') || '';

  const setup = () => {
    ctx.setChrome('full');
    root.innerHTML = `<div class="container-narrow page">
      <nav class="crumbs" aria-label="Fil d’Ariane">${pass ? `<a href="${esc(home)}">Mon Pass</a>` : `<a href="#/formation">Formation</a><span>›</span><a href="${esc(home)}">${esc(profile.name)}</a>`}<span>›</span><span>Entraînement</span></nav>
      <h1 class="h1-md">Entraînement</h1>
      <p class="muted">Réponse corrigée et expliquée immédiatement. Rien n’est noté : c’est l’endroit pour progresser.</p>
      <form class="card" id="setup" novalidate>
        <div class="field"><label for="s-theme">Thème</label><select id="s-theme">
          <option value="">Tous les thèmes (tirage équilibré)</option>
          ${themes.map((t) => `<option value="${esc(t.name)}" ${t.name === wanted ? 'selected' : ''}>${esc(t.name)} (${t.count})</option>`).join('')}</select></div>
        <div class="field"><label for="s-n">Nombre de questions</label><select id="s-n"><option value="10">10</option><option value="20">20</option><option value="999">Toutes</option></select></div>
        <label class="check"><input type="checkbox" id="s-timer"> Activer le chronomètre (temps indicatif de chaque question)</label>
        <div class="btn-row" style="margin-top:var(--sp-4)"><button class="btn btn-primary btn-lg" type="submit">${icon('target', 20)} Commencer</button>
        <a class="btn btn-light" href="${esc(home)}">← Retour</a></div></form></div>`;
    root.querySelector('#setup').addEventListener('submit', (e) => {
      e.preventDefault();
      run({ theme: root.querySelector('#s-theme').value, n: Number(root.querySelector('#s-n').value), timer: root.querySelector('#s-timer').checked });
    });
  };

  function run(opts) {
    const list = buildPractice(content, opts);
    if (!list.length) { setup(); return; }
    const results = [];
    let i = 0;
    let timerId = null;
    let keyH = null;
    const stop = () => { clearInterval(timerId); timerId = null; };
    ctx.onLeave(() => { stop(); if (keyH) document.removeEventListener('keydown', keyH); });

    const show = () => {
      stop();
      if (keyH) document.removeEventListener('keydown', keyH);
      const { q, order } = list[i];
      const cd = correctDisplayIndex(q, order);
      let locked = false;
      const secs = qSeconds(q);
      ctx.setChrome('focus');
      root.innerHTML = `<div class="container-narrow page quiz">
        <div class="quiz-head"><div class="quiz-top"><span class="small"><strong>Question ${i + 1}</strong> / ${list.length}</span><span class="badge">${esc(q.theme)}</span></div>
        ${bar(pct(i, list.length))}
        ${opts.timer ? `<div class="timer" aria-hidden="true"><div class="timer-bar"><span id="tbar"></span></div><span id="tsec" class="timer-sec">${fmtClock(secs)}</span></div>` : ''}</div>
        <div class="card q-card">${questionBodyHTML(q)}<div id="choices">${choicesHTML(q, order)}</div>
        <div id="feedback" aria-live="polite"></div></div>
        <div class="btn-row quiz-actions"><a class="btn btn-light btn-sm" href="${esc(home)}">Quitter</a></div></div>`;
      const fb = root.querySelector('#feedback');

      const reveal = (picked, timedOut) => {
        if (locked) return;
        locked = true; stop();
        const ok = picked != null && picked === cd;
        results.push({ theme: q.theme, ok });
        root.querySelector('#choices').innerHTML = choicesHTML(q, order, { picked, locked: true, correctDisplay: cd });
        fb.innerHTML = `<div class="feedback ${ok ? 'ok' : 'ko'}"><strong>${ok ? 'Bonne réponse.' : timedOut ? 'Temps écoulé.' : 'Réponse incorrecte.'}</strong>
          <p>${esc(q.explain || '')}</p>
          <button type="button" class="btn btn-primary" id="next">${i + 1 < list.length ? 'Question suivante' : 'Voir mon bilan'} ${icon('arrow', 16)}</button></div>`;
        const nb = fb.querySelector('#next');
        nb.focus();
        nb.addEventListener('click', () => { i++; i < list.length ? show() : finish(); });
      };

      root.querySelector('#choices').addEventListener('click', (e) => {
        const b = e.target.closest('.choice');
        if (b && !locked) reveal(Number(b.dataset.d), false);
      });
      keyH = (e) => {
        if (locked || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = 'abcd'.indexOf(e.key.toLowerCase());
        const n = Number(e.key) - 1;
        const d = k >= 0 ? k : n;
        if (d >= 0 && d < order.length) reveal(d, false);
      };
      document.addEventListener('keydown', keyH);

      if (opts.timer) {
        const start = Date.now();
        timerId = setInterval(() => {
          const left = secs * 1000 - (Date.now() - start);
          const tb = root.querySelector('#tbar');
          if (!tb) return stop();
          tb.style.width = `${Math.max(0, (left / (secs * 1000)) * 100)}%`;
          tb.parentElement.classList.toggle('low', left < 10000);
          root.querySelector('#tsec').textContent = fmtClock(left / 1000);
          if (left <= 0) reveal(null, true);
        }, 100);
      }
    };

    const finish = () => {
      stop();
      ctx.setChrome('full');
      const by = themeBreakdown(results);
      local.addPractice(profile.id, by);
      for (const t of Object.keys(by)) ctx.store.markAssignmentsDone(local.getMe().email, { profileId: profile.id, theme: t }).catch(() => {});
      const ok = results.filter((r) => r.ok).length;
      const p = pct(ok, results.length);
      root.innerHTML = `<div class="container-narrow page"><div class="card center">
        <h1 class="h1-md">Bilan de l’entraînement</h1>
        <p class="big-score">${ok} / ${results.length} <span class="muted">(${p} %)</span></p>
        <p class="muted">${p >= 70 ? 'Très bien : vous êtes proche du niveau attendu à l’examen.' : 'Continuez : relisez les modules des thèmes les plus faibles puis recommencez.'}</p>
        <div class="theme-rows">${Object.entries(by).map(([t, v]) => `<div class="theme-row"><span>${esc(t)}</span><span class="xs muted">${v.ok}/${v.total}</span>${bar(pct(v.ok, v.total), pct(v.ok, v.total) >= 70 ? 'ok' : 'ko')}</div>`).join('')}</div>
        <div class="btn-row" style="justify-content:center;margin-top:var(--sp-5)">
          <button type="button" class="btn btn-primary" id="again">${icon('refresh', 18)} Recommencer</button>
          <a class="btn btn-outline" href="${pass ? esc(home) : `#/examen/${esc(profile.id)}`}">Passer l’examen</a>
          <a class="btn btn-ghost" href="${esc(home)}">${pass ? 'Retour à mon Pass' : 'Retour au profil'}</a></div></div></div>`;
      root.querySelector('#again').addEventListener('click', setup);
    };
    show();
  }

  setup();
}
