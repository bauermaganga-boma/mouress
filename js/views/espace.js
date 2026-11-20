// Espace candidat / collaborateur : mon parcours, historique, attestations, progression.
import { getProfilesData, loadContent } from '../data.js';
import { local } from '../store.js';
import { esc, fmtDate, pct, isEmail } from '../util.js';
import { icon, badge, bar } from '../ui.js';
import { sampleCertificateHTML } from '../certificate.js';
import { gaps, collabStats, recommend, dueState, assignmentTitle, assignmentHref } from '../skills.js';
import { buildModel, reviewState, nextAction, actionHref } from '../parcours.js';
import { KINDS, STATUS_P } from '../parcours-store.js';

/** Lien personnel envoyé par l'entreprise : renseigne le profil de l'appareil puis ouvre « Mon espace ». */
export async function lien(ctx, root) {
  const id = await ctx.store.employeeIdByToken(ctx.params.token);
  const emp = id ? await ctx.store.getEmployee(id) : null;
  if (!emp) { (await import('./notfound.js')).default(ctx, root); return; }
  local.setMe({ name: emp.name, email: emp.email });
  ctx.toast(`Bonjour ${emp.name}, voici votre parcours.`);
  ctx.go('/mon-espace');
}

/** Parcours de poste de l'utilisateur, d'après son e-mail, dans les entreprises qui en ont défini un. */
async function myPostes(ctx, email, data, progress) {
  if (!email) return [];
  const out = [];
  for (const cid of await ctx.store.parcoursCompanyIds()) {
    const company = await ctx.store.getCompany(cid); if (!company) continue;
    for (const emp of (await ctx.store.listEmployees(cid)).filter((e) => e.email === email.toLowerCase() && e.profileId)) {
      const model = await buildModel(ctx, company, [emp]); const x = model.per.get(emp.id);
      if (x.total) out.push({ company, emp, x, poste: data.profiles.find((p) => p.id === emp.profileId), practice: progress[emp.profileId]?.practice || {} });
    }
  }
  return out;
}

export default async function render(ctx, root) {
  ctx.setTitle('Mon espace');
  const data = await getProfilesData();
  const me = local.getMe();
  const attempts = (await ctx.store.listAttemptsByDevice()).filter((a) => a.status === 'done');
  const certs = await ctx.store.listCertificatesByDevice();
  const collabs = me.email ? await ctx.store.listCollabByEmail(me.email) : [];
  const progress = local.getProgress();
  const postes = await myPostes(ctx, me.email, data, progress);
  if (!ctx.alive()) return;
  const pname = (id) => data.profiles.find((p) => p.id === id)?.name || id;

  // Parcours : assignations RH + recommandations issues du dernier test par profil.
  const contents = {};
  const need = new Set([...collabs.map((c) => c.session.profileId), ...Object.keys(progress)]);
  for (const id of need) contents[id] = await loadContent(id);
  const lastByProfile = new Map();
  for (const a of [...attempts].sort((x, y) => x.finishedAt - y.finishedAt)) lastByProfile.set(a.profileId, a);
  const recos = [];
  for (const [pid, a] of lastByProfile) {
    const stats = collabStats({ attempts: [a] });
    for (const g of gaps(stats, a.passMark || 70).slice(0, 3)) {
      const rec = await recommend(pid, g.theme);
      recos.push({ pid, ...g, rec });
    }
  }
  if (!ctx.alive()) return;

  const parcours = collabs.map((c) => {
    const as = c.assignments; const done = as.filter((a) => a.doneAt).length;
    const st = collabStats(c.invitation);
    return `<article class="card parcours">
      <div class="split" style="align-items:flex-start"><div><p class="eyebrow dark">${esc(c.company.name)}</p><h3>${esc(c.session.title)}</h3><p class="muted small">${esc(pname(c.session.profileId))} · échéance ${fmtDate(c.session.deadline)}</p></div>
        <a class="btn btn-primary btn-sm" href="#/t/${esc(c.invitation.token)}">${icon('clock', 16)} Prochain test</a></div>
      <div class="split small"><span>Progression du plan d’action</span><strong>${as.length ? pct(done, as.length) : 0} %</strong></div>${bar(as.length ? pct(done, as.length) : 0, 'ok')}
      ${st.count ? `<p class="small muted" style="margin-top:var(--sp-3)">Dernier test : <strong>${st.overallLast} %</strong>${st.overallDelta != null ? ` (${st.overallDelta >= 0 ? '+' : ''}${st.overallDelta} pts depuis le 1er test)` : ''}</p>` : '<p class="small muted" style="margin-top:var(--sp-3)">Vous n’avez pas encore passé le test de positionnement.</p>'}
      ${as.length ? `<ul class="due-list">${as.slice().sort((a, b) => a.due - b.due).map((a) => { const d = dueState(a); return `<li>${badge(d.label, d.tone)}<span>${esc(assignmentTitle(a, contents[a.profileId]))}<br><span class="xs muted">avant le ${fmtDate(a.due)}</span></span>${a.doneAt ? '' : `<a class="btn btn-light btn-sm" href="${esc(assignmentHref(a))}">Commencer</a>`}</li>`; }).join('')}</ul>` : '<p class="small muted">Aucune tâche assignée pour le moment.</p>'}
    </article>`;
  }).join('');

  const recoHtml = recos.length ? `<div class="grid grid-2">${recos.map((r) => `<div class="card"><div class="split"><strong>${esc(r.theme)}</strong>${badge(r.pct + ' %', r.pct < 50 ? 'ko' : 'warn')}</div><p class="xs muted">${esc(pname(r.pid))}</p>
    <ul class="rec-items">${r.rec.modules.map((m) => `<li><a href="#/cours/${esc(r.pid)}/${esc(m.id)}">${icon('book', 14)} ${esc(m.title)}</a></li>`).join('')}
    <li><a href="#/entrainement/${esc(r.pid)}?theme=${encodeURIComponent(r.theme)}">${icon('target', 14)} Série d’entraînement « ${esc(r.theme)} »</a></li></ul></div>`).join('')}</div>`
    : '<div class="card"><p class="muted">Vos entraînements conseillés apparaîtront après un premier examen : nous repérons les thèmes sous le seuil.</p></div>';

  const prog = Object.entries(progress).map(([pid, p]) => {
    const c = contents[pid]; const mods = c?.modules.length || 0; const done = Object.keys(p.modules || {}).length;
    const practiced = Object.values(p.practice || {}).reduce((a, v) => a + v.total, 0);
    const ok = Object.values(p.practice || {}).reduce((a, v) => a + v.ok, 0);
    return `<a class="card card-link" href="#/profil/${esc(pid)}"><h4>${esc(pname(pid))}</h4><div class="split xs muted"><span>Cours : ${done}${mods ? ' / ' + mods : ''} module(s)</span><span>${practiced ? `Entraînement : ${pct(ok, practiced)} % de réussite` : 'Pas d’entraînement'}</span></div>${bar(mods ? pct(done, mods) : 0, 'ok')}</a>`;
  }).join('');

  // Résumé et prochaine étape
  const passedN = attempts.filter((a) => a.passed).length;
  const modulesN = Object.values(progress).reduce((a, p) => a + Object.keys(p.modules || {}).length, 0);
  const pendingAs = collabs.flatMap((c) => c.assignments.filter((a) => !a.doneAt)).sort((a, b) => a.due - b.due);
  const nextA = pendingAs[0];
  const waiting = collabs.find((c) => c.invitation.status === 'invited' || c.invitation.status === 'training');
  const next = nextA ? { t: 'Prochaine tâche à faire', d: `${assignmentTitle(nextA, contents[nextA.profileId])} · avant le ${fmtDate(nextA.due)}`, href: assignmentHref(nextA), l: 'Commencer' }
    : waiting ? { t: 'Votre test vous attend', d: `${waiting.session.title} · ${waiting.company.name}`, href: `#/t/${waiting.invitation.token}`, l: 'Ouvrir mon Pass' }
    : !attempts.length ? { t: 'Commencez votre premier parcours', d: 'Choisissez un profil, suivez les cours puis entraînez-vous avant l’examen.', href: '#/formation', l: 'Choisir un profil' }
    : { t: 'Continuez à progresser', d: 'Retravaillez vos thèmes faibles avec les entraînements conseillés ci-dessous.', href: '#/formation', l: 'Voir les profils' };

  root.innerHTML = `<div class="container page">
    <div class="page-head"><p class="eyebrow dark">Candidat et collaborateur</p><h1 class="h1-md">${me.name ? 'Bonjour ' + esc(me.name.split(' ')[0]) : 'Mon espace'}</h1>
      <p>Retrouvez votre parcours, vos résultats et vos attestations. Les données sont enregistrées sur cet appareil.</p></div>
    <div class="grid grid-4 stats me-stats">
      <div class="card stat"><span class="stat-n">${modulesN}</span><span class="muted small">module(s) de cours suivis</span></div>
      <div class="card stat"><span class="stat-n">${attempts.length}</span><span class="muted small">examen(s) passé(s)</span></div>
      <div class="card stat"><span class="stat-n">${passedN}</span><span class="muted small">réussi(s)</span></div>
      <div class="card stat"><span class="stat-n">${certs.length}</span><span class="muted small">attestation(s)</span></div></div>
    <section class="card me-next" aria-label="Prochaine étape"><div><p class="eyebrow dark">Prochaine étape</p><h2>${esc(next.t)}</h2><p class="muted small">${esc(next.d)}</p></div><a class="btn btn-primary" href="${esc(next.href)}">${esc(next.l)} ${icon('arrow', 16)}</a></section>
    <details class="card me-form" ${me.email ? '' : 'open'}><summary>Mon profil${me.email ? ' · ' + esc(me.email) : ''}</summary>
    <form id="me" novalidate style="margin-top:var(--sp-3)"><div class="form-grid">
      <div class="field"><label for="me-name">Nom et prénom</label><input id="me-name" type="text" autocomplete="name" value="${esc(me.name)}"></div>
      <div class="field"><label for="me-email">E-mail <span class="hint">(relie votre compte à votre parcours d’entreprise)</span></label><input id="me-email" type="email" autocomplete="email" value="${esc(me.email)}"></div></div>
      <div class="field-error" id="me-err" role="alert"></div><button class="btn btn-outline btn-sm" type="submit">Enregistrer</button></form></details>

    ${postes.length ? `<section class="block"><h2>Mon parcours de poste</h2>${postes.map(({ company, emp, x, poste, practice }) => { const na = nextAction(x.rows); const href = na ? actionHref(na, poste.id) : ''; const rs = reviewState(x.review);
      return `<article class="card parcours"><div class="split" style="align-items:flex-start"><div><p class="eyebrow dark">${esc(company.name)}</p><h3>${esc(poste.name)}</h3><p class="muted small">${x.valide} / ${x.total} thématiques validées${emp.team ? ' · ' + esc(emp.team) : ''}</p></div><strong class="stat-n">${x.pct} %</strong></div>${bar(x.pct, x.pct >= 70 ? 'ok' : '')}
        ${na ? `<p class="small" style="margin-top:var(--sp-3)">Prochaine étape : <strong>${esc(na.item.title)}</strong> ${href ? `<a class="btn btn-primary btn-sm" href="${esc(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>Commencer</a>` : ''}</p>` : '<p class="small" style="margin-top:var(--sp-3)">Bravo, toutes vos thématiques sont validées.</p>'}
        <ul class="due-list">${x.rows.map((r) => { const pr = r.item.source === 'theme' ? practice[r.item.theme] : null; return `<li>${badge(STATUS_P[r.status].label, STATUS_P[r.status].tone)}<span><strong>${esc(r.item.title)}</strong> ${badge(KINDS[r.item.kind].label, KINDS[r.item.kind].tone)}<br><span class="xs muted">${r.item.hours ? r.item.hours + ' h' : ''}${pr ? ` · entraînement : ${pct(pr.ok, pr.total)} %` : ''}${r.comment ? ` · ${esc(r.comment)}` : ''}</span></span>${r.item.source === 'theme' ? `<a class="btn btn-light btn-sm" href="#/entrainement/${esc(poste.id)}?theme=${encodeURIComponent(r.item.theme)}">S’entraîner</a>` : ''}</li>`; }).join('')}</ul>
        <p class="xs muted" style="margin-top:var(--sp-3)">${badge(rs.label, rs.tone)} ${x.review?.next ? 'Prochaine revue avec votre responsable le ' + fmtDate(x.review.next) + '.' : ''}</p></article>`; }).join('')}</section>` : ''}

    <section class="block"><h2>Mon parcours</h2>
      ${parcours || `<div class="card"><p class="muted">${me.email ? 'Aucun parcours d’entreprise n’est associé à cet e-mail. Si votre employeur vous a envoyé un lien, ouvrez-le depuis cet appareil.' : 'Renseignez votre e-mail ci-dessus pour afficher le parcours proposé par votre entreprise.'}</p></div>`}
      <h3 style="margin-top:var(--sp-5)">Entraînements conseillés</h3>${recoHtml}</section>

    <section class="block"><h2>Historique des examens</h2>
      ${attempts.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Profil</th><th>Score</th><th>Résultat</th><th></th></tr></thead><tbody>
        ${attempts.map((a) => `<tr><td>${fmtDate(a.finishedAt)}</td><td>${esc(pname(a.profileId))}${a.sessionId ? ' <span class="badge">Session RH</span>' : ''}</td><td><strong>${a.percent} %</strong></td><td>${badge(a.passed ? 'Réussi' : 'Non réussi', a.passed ? 'ok' : 'ko')}</td><td><a href="#/resultat/${esc(a.id)}">Voir</a></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="card"><p class="muted">Aucun examen passé sur cet appareil.</p><a class="btn btn-primary" href="#/formation">Choisir un profil</a></div>'}</section>

    <section class="block"><h2>Mes attestations</h2>
      ${certs.length ? `<div class="grid grid-2">${certs.map((c) => `<a class="card card-link" href="#/attestation/${esc(c.code)}"><div class="split">${badge('Attestation', 'ok')}<span class="xs muted">${fmtDate(c.date)}</span></div><h4 style="margin-top:.5rem">${esc(pname(c.profileId))}</h4><p class="small muted">Score ${c.percent} % · code ${esc(c.code)}</p></a>`).join('')}</div>`
        : '<div class="card"><p class="muted">Réussissez un examen (seuil 70 %) pour obtenir une attestation vérifiable.</p>' + sampleCertificateHTML('Technicien électricien industriel', 'Pétrole & gaz', 70) + '</div>'}
      <a class="card card-link verify-card" href="#/verifier">${icon('award', 22)}<span><strong>Vérifier une attestation</strong><span class="xs muted">Saisissez le code MRS-… d’une attestation pour contrôler son authenticité.</span></span>${icon('arrow', 18)}</a></section>

    <section class="block"><h2>Ma progression</h2>${prog ? `<div class="grid grid-2">${prog}</div>` : '<div class="card"><p class="muted">Commencez un cours ou un entraînement : votre progression apparaîtra ici.</p></div>'}</section>
  </div>`;

  root.querySelector('#me').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = root.querySelector('#me-name').value.trim(); const email = root.querySelector('#me-email').value.trim();
    if (email && !isEmail(email)) { root.querySelector('#me-err').textContent = 'Adresse e-mail invalide.'; return; }
    local.setMe({ name, email });
    ctx.toast('Profil enregistré.');
    await render(ctx, root);
  });
}
