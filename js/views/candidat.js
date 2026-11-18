// Lien RH #/t/<token> : identification simple, examen, résultat transmis à la session.
import { getProfile, loadContent, themesOf } from '../data.js';
import { local } from '../store.js';
import { esc, fmtDate } from '../util.js';
import { icon, badge, comingSoon } from '../ui.js';
import { createExamAttempt, examSize } from '../quiz.js';
import { showIntro, runExam, resumeAttempt } from '../examrunner.js';

const msg = (root, title, text, extra = '') => {
  root.innerHTML = `<div class="container-narrow page center"><div class="card"><h1 class="h1-md">${esc(title)}</h1><p class="muted">${text}</p>${extra}</div></div>`;
};

export default async function render(ctx, root) {
  ctx.setTitle('Test d’aptitude');
  const found = await ctx.store.getInvitationByToken(ctx.params.token);
  if (!found) { msg(root, 'Lien invalide', 'Ce lien de test n’existe pas ou a été supprimé. Contactez la personne qui vous l’a envoyé.'); return; }
  const { invitation: inv, session, company, attempts } = found;
  const profile = await getProfile(session.profileId);
  const content = await loadContent(session.profileId);
  if (!ctx.alive()) return;
  if (!profile || !content || !content.questions.length) { root.innerHTML = `<div class="container page">${comingSoon(profile?.name || '')}</div>`; return; }
  const training = session.type === 'training';
  const expired = session.deadline && Date.now() > session.deadline;
  const real = (attempts || []).filter((a) => !a.synthetic);
  const inProgress = real.find((a) => a.status === 'in_progress');
  const lastDone = [...(attempts || [])].reverse().find((a) => a.status === 'done');
  const done = (att) => ctx.go(`/resultat/${att.id}`);

  const start = async () => {
    const n = examSize(content, session.questionCount);
    const info = await showIntro(root, {
      title: session.title, context: `${company.name} — ${profile.name}`, subtitle: training ? 'Test de positionnement de votre parcours de montée en compétences.' : 'Test d’aptitude proposé par votre futur employeur.',
      total: n, themes: themesOf(content).length, passMark: session.passMark, certificate: false, emailRequired: true, name: inv.name || undefined, email: inv.email || undefined,
    });
    if (!ctx.alive()) return;
    const att = createExamAttempt({ profile, content, count: session.questionCount, candidate: info, session, invitation: inv, passMark: session.passMark });
    await ctx.store.saveAttempt(att);
    runExam(ctx, root, { attempt: att, content, onDone: done });
  };

  if (inProgress) {
    const att = await ctx.store.getAttempt(inProgress.id);
    const changed = await resumeAttempt(ctx, att, content);
    ctx.toast(changed ? 'Test repris : la question en cours était hors délai et est comptée comme perdue.' : 'Test repris là où vous l’aviez laissé.');
    runExam(ctx, root, { attempt: att, content, onDone: done });
    return;
  }

  if (!training) {
    if (lastDone) {
      msg(root, 'Test déjà passé', `Vous avez déjà passé ce test le ${fmtDate(lastDone.finishedAt)}. Votre résultat a été transmis à ${esc(company.name)}. Chaque lien n’autorise qu’un seul passage.`,
        `<a class="btn btn-outline" href="#/resultat/${esc(lastDone.id)}">Revoir mon résultat</a>`);
      return;
    }
    if (expired) { msg(root, 'Session terminée', `La date limite (${fmtDate(session.deadline)}) est dépassée. Contactez ${esc(company.name)} si vous avez besoin d’un nouveau lien.`); return; }
    await start();
    return;
  }

  // Montée en compétences : accueil du collaborateur, plusieurs passages autorisés.
  local.setMe({ name: inv.name, email: inv.email });
  const past = (attempts || []).filter((a) => a.status === 'done');
  root.innerHTML = `<div class="container-narrow page">
    <p class="eyebrow dark">${esc(company.name)} · Montée en compétences</p>
    <h1 class="h1-md">Bonjour ${esc((inv.name || '').split(' ')[0] || '')}</h1>
    <p class="muted">Votre parcours « ${esc(session.title)} » — profil ${esc(profile.name)}. Passez le test autant de fois que nécessaire jusqu’au ${fmtDate(session.deadline)}, entraînez-vous entre deux passages et suivez votre progression.</p>
    <div class="btn-row" style="margin:var(--sp-5) 0">
      ${expired ? badge('Échéance dépassée', 'warn') : `<button type="button" class="btn btn-primary btn-lg" id="go">${icon('clock', 20)} ${past.length ? 'Repasser le test' : 'Passer le test'}</button>`}
      <a class="btn btn-outline btn-lg" href="#/mon-espace">${icon('target', 20)} Mon parcours</a></div>
    ${past.length ? `<div class="card"><h2 class="h3-sm">Mes passages</h2><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Score</th><th>Résultat</th><th></th></tr></thead><tbody>
      ${past.map((a) => `<tr><td>${fmtDate(a.finishedAt)}</td><td><strong>${a.percent} %</strong></td><td>${badge(a.passed ? 'Seuil atteint' : 'À renforcer', a.passed ? 'ok' : 'warn')}</td><td>${a.synthetic ? '' : `<a href="#/resultat/${esc(a.id)}">Détail</a>`}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
  </div>`;
  root.querySelector('#go')?.addEventListener('click', start);
}
