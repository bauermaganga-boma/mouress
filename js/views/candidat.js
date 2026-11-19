// Lien personnel #/t/<token> : accueil du Pass → formation → entraînement → examen → résultat et attestation.
import { CONFIG } from '../../config.js';
import { getProfile, loadContent, themesOf } from '../data.js';
import { local } from '../store.js';
import { esc, fmtDate, pct } from '../util.js';
import { icon, badge, bar, comingSoon, pageHead } from '../ui.js';
import { createExamAttempt, examSize } from '../quiz.js';
import { showIntro, runExam, resumeAttempt } from '../examrunner.js';
import { attemptsUsed, attemptsLeft } from '../pass.js';

const msg = (root, title, text, extra = '') => {
  root.innerHTML = `<div class="container-narrow page"><div class="card center"><h1 class="page-title">${esc(title)}</h1><p class="muted">${text}</p>${extra}</div></div>`;
};

export default async function render(ctx, root) {
  ctx.setTitle('Mon Pass');
  const token = ctx.params.token;
  const found = await ctx.store.getInvitationByToken(token);
  if (!found) { msg(root, 'Lien invalide', 'Ce lien n’existe pas ou a été supprimé. Contactez la personne qui vous l’a envoyé.'); return; }
  const { invitation: inv, session, company, attempts } = found;
  const profile = await getProfile(session.profileId);
  const content = await loadContent(session.profileId);
  if (!ctx.alive()) return;
  if (!profile || !content || !content.questions.length) { root.innerHTML = `<div class="container page">${comingSoon(profile?.name || '')}</div>`; return; }
  if (inv.email) local.setMe({ name: inv.name || local.getMe().name, email: inv.email });

  const expired = session.deadline && Date.now() > session.deadline;
  const real = (attempts || []).filter((a) => !a.synthetic);
  const inProgress = real.find((a) => a.status === 'in_progress');
  const doneList = (attempts || []).filter((a) => a.status === 'done');
  const passedAtt = doneList.find((a) => a.passed);
  const left = attemptsLeft(attempts);
  const done = (att) => ctx.go(`/resultat/${att.id}`);

  const start = async () => {
    const n = examSize(content, session.questionCount);
    const info = await showIntro(root, {
      title: session.title, context: `${company.name} · ${profile.name}`, subtitle: `Examen de votre Pass. Tentative ${attemptsUsed(attempts) + 1} sur ${CONFIG.ATTEMPTS_PER_PASS}.`,
      total: n, themes: themesOf(content).length, passMark: session.passMark, certificate: true, emailRequired: true, name: inv.name || undefined, email: inv.email || undefined,
      backHref: `#/t/${token}`,
    });
    if (!ctx.alive()) return;
    const att = createExamAttempt({ profile, content, count: session.questionCount, candidate: info, session, invitation: inv, passMark: session.passMark });
    await ctx.store.saveAttempt(att);
    runExam(ctx, root, { attempt: att, content, onDone: done });
  };

  // Examen en cours : reprise automatique (le chrono a continué de tourner).
  if (inProgress) {
    const att = await ctx.store.getAttempt(inProgress.id);
    const changed = await resumeAttempt(ctx, att, content);
    ctx.toast(changed ? 'Examen repris : la question en cours était hors délai et est comptée comme perdue.' : 'Examen repris là où vous l’aviez laissé.');
    runExam(ctx, root, { attempt: att, content, onDone: done });
    return;
  }

  const prog = local.getProgress()[profile.id] || { modules: {}, practice: {} };
  const mods = content.modules;
  const modsDone = mods.filter((m) => prog.modules[m.id]).length;
  const nextMod = mods.find((m) => !prog.modules[m.id]) || mods[0];
  const themes = themesOf(content);
  const last = doneList[doneList.length - 1];
  const canExam = !expired && !passedAtt && left > 0;
  const q = `?pass=${encodeURIComponent(token)}`;

  root.innerHTML = `<div class="container page">
    ${pageHead({ eyebrow: `${company.name} · ${session.type === 'training' ? 'Montée en compétences' : 'Recrutement'}`, title: `Bonjour ${(inv.name || '').split(' ')[0] || ''}`.trim(),
      text: `Votre Pass pour « ${session.title} » — profil ${profile.name}.${session.deadline ? ` Examen à passer avant le ${fmtDate(session.deadline)}.` : ''}` })}
    ${expired && !passedAtt ? '<div class="alert alert-warn">La date limite est dépassée : l’examen n’est plus accessible. La formation et l’entraînement restent disponibles.</div>' : ''}
    <ol class="pass-steps">
      <li class="card pass-step"><span class="step-n2">1</span><div><h2 class="h3-sm">Formation</h2><p class="muted small">${mods.length} modules de cours, à votre rythme.</p>${bar(pct(modsDone, mods.length), 'ok')}<p class="xs muted">${modsDone} / ${mods.length} terminé(s)</p>
        ${mods.length ? `<a class="btn btn-outline" href="#/cours/${esc(profile.id)}/${esc(nextMod.id)}${q}">${icon('book', 18)} ${modsDone ? 'Continuer la formation' : 'Commencer la formation'}</a>` : ''}</div></li>
      <li class="card pass-step"><span class="step-n2">2</span><div><h2 class="h3-sm">Entraînement</h2><p class="muted small">Illimité, avec correction et explication immédiates.</p>
        <div class="chips">${themes.map((t) => `<a class="chip chip-link" href="#/entrainement/${esc(profile.id)}${q}&theme=${encodeURIComponent(t.name)}">${esc(t.name)}</a>`).join('')}</div>
        <a class="btn btn-outline" href="#/entrainement/${esc(profile.id)}${q}">${icon('target', 18)} S’entraîner</a></div></li>
      <li class="card pass-step pass-exam"><span class="step-n2">3</span><div><h2 class="h3-sm">Examen</h2><p class="muted small">${examSize(content, session.questionCount)} questions, 1 min 30 par question, sans retour arrière. Seuil ${session.passMark} %. Vous pouvez vous entraîner autant que vous voulez avant de vous lancer.</p>
        <p class="small"><strong>Tentatives restantes : ${left} sur ${CONFIG.ATTEMPTS_PER_PASS}</strong></p>
        ${canExam ? `<button type="button" class="btn btn-primary btn-lg" id="go">${icon('clock', 20)} Passer l’examen</button>` : `<p class="muted small">${passedAtt ? 'Examen réussi : bravo !' : expired ? 'Date limite dépassée.' : 'Toutes vos tentatives sont utilisées.'}</p>`}</div></li>
      <li class="card pass-step"><span class="step-n2">4</span><div><h2 class="h3-sm">Résultat et attestation</h2>
        ${doneList.length ? `<ul class="plain">${doneList.map((a) => `<li>${fmtDate(a.finishedAt)} — <strong>${a.percent} %</strong> ${badge(a.passed ? 'Réussi' : 'Non réussi', a.passed ? 'ok' : 'warn')} ${a.synthetic ? '' : `<a href="#/resultat/${esc(a.id)}">Détail</a>`}</li>`).join('')}</ul>
          ${(passedAtt?.certCode || last?.certCode) ? `<a class="btn btn-primary" href="#/attestation/${esc(passedAtt?.certCode || last.certCode)}">${icon('award', 18)} Voir mon attestation</a>` : ''}
          <p class="xs muted">Votre résultat est transmis à ${esc(company.name)}.</p>` : '<p class="muted small">Votre résultat apparaîtra ici après l’examen. Il est transmis à l’entreprise ; une attestation vérifiable est délivrée si vous réussissez.</p>'}</div></li>
    </ol>
    ${session.type === 'training' ? '<p class="center small"><a href="#/mon-espace">Voir « Mon parcours »</a></p>' : ''}
  </div>`;
  root.querySelector('#go')?.addEventListener('click', start);
}
