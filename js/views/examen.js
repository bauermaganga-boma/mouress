import { CONFIG } from '../../config.js';
import { getProfile, loadContent, themesOf } from '../data.js';
import { esc } from '../util.js';
import { comingSoon } from '../ui.js';
import { createExamAttempt, examSize } from '../quiz.js';
import { showIntro, runExam, resumeAttempt } from '../examrunner.js';

export default async function render(ctx, root) {
  const profile = await getProfile(ctx.params.id);
  if (!profile) { (await import('./notfound.js')).default(ctx, root); return; }
  ctx.setTitle(`Examen — ${profile.name}`);
  const content = await loadContent(profile.id);
  if (!ctx.alive()) return;
  if (!content || !content.questions.length) { root.innerHTML = `<div class="container page">${comingSoon(profile.name)}</div>`; return; }

  const done = (att) => ctx.go(`/resultat/${att.id}`);

  // Reprise d'un examen libre en cours sur cet appareil.
  const mine = (await ctx.store.listAttemptsByDevice()).find((a) => a.profileId === profile.id && a.status === 'in_progress' && !a.sessionId && !a.synthetic);
  if (mine) {
    const att = await ctx.store.getAttempt(mine.id);
    const changed = await resumeAttempt(ctx, att, content);
    ctx.toast(changed ? 'Examen repris : le temps de la question en cours était écoulé, elle est comptée comme perdue.' : 'Examen repris là où vous l’aviez laissé.');
    runExam(ctx, root, { attempt: att, content, onDone: done });
    return;
  }

  const n = examSize(content);
  const info = await showIntro(root, {
    title: profile.name, context: 'Examen d’aptitude', total: n, themes: themesOf(content).length, passMark: CONFIG.PASS_MARK, certificate: true,
    backHref: `#/profil/${profile.id}`,
    crumbs: `<div class="crumbs"><a href="#/formation">Formation</a><span>›</span><a href="#/profil/${esc(profile.id)}">${esc(profile.name)}</a><span>›</span><span>Examen</span></div>`,
  });
  if (!ctx.alive()) return;
  const att = createExamAttempt({ profile, content, count: CONFIG.EXAM_QUESTIONS, candidate: info });
  await ctx.store.saveAttempt(att);
  runExam(ctx, root, { attempt: att, content, onDone: done });
}
