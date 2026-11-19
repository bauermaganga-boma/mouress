// Passage d'examen : écran d'introduction, transitions, question chronométrée, sauvegarde à chaque réponse,
// reprise après rechargement. Utilisé par #/examen/<profil> et #/t/<token>.
//
// Anti-triche (côté client, limites assumées V1) :
//  - le chrono est calculé sur des horodatages absolus enregistrés (qStart) : recharger la page ne remet pas le temps à zéro ;
//  - l'ordre des questions et des choix est tiré une fois et enregistré ;
//  - à la reprise, la question en cours dont le temps est écoulé compte comme perdue ;
//  - aucun retour arrière : une réponse validée est définitive.
import { CONFIG } from '../config.js';
import { esc, isEmail, pct, fmtClock } from './util.js';
import { icon, bar } from './ui.js';
import { local } from './store.js';
import { answerCurrent, finalize, reconcile } from './quiz.js';
import { choicesHTML, questionBodyHTML } from './qview.js';

/** Écran d'introduction + identification. Résout {name,email} quand le candidat démarre. */
export function showIntro(root, o) {
  const me = local.getMe();
  return new Promise((resolve) => {
    root.innerHTML = `<div class="container-narrow page">
      ${o.crumbs || ''}
      <div class="card intro">
        ${o.context ? `<p class="eyebrow dark">${esc(o.context)}</p>` : ''}
        <h1 class="h1-md">${esc(o.title)}</h1>
        ${o.subtitle ? `<p class="muted">${esc(o.subtitle)}</p>` : ''}
        <ul class="rules">
          <li>${icon('target', 20)}<span><strong>${o.total} questions</strong> sur ${o.themes} thèmes, tirées au hasard, dans un ordre mélangé.</span></li>
          <li>${icon('clock', 20)}<span>Chaque question est <strong>chronométrée</strong> (1 min 30 par question, avec une pause de 4 secondes entre deux questions). Temps écoulé = question perdue.</span></li>
          <li>${icon('lock', 20)}<span><strong>Pas de retour arrière</strong> : une réponse validée est définitive. Choisissez puis cliquez sur « Valider ».</span></li>
          <li>${icon('refresh', 20)}<span>Si la page se recharge, l’examen reprend là où il était. <strong>Le chronomètre continue de tourner.</strong></span></li>
          <li>${icon('award', 20)}<span>Seuil de réussite : <strong>${o.passMark} %</strong>. ${o.certificate ? 'Une attestation vérifiable est délivrée en cas de réussite.' : 'Votre résultat est transmis à l’entreprise.'}</span></li>
        </ul>
        <form id="idform" novalidate>
          <div class="form-grid">
            <div class="field"><label for="c-name">Nom et prénom${o.nameOptional ? ' (facultatif)' : ''}</label><input id="c-name" type="text" autocomplete="name" ${o.nameOptional ? '' : 'required'} value="${esc(o.name ?? me.name)}"><span class="field-error" id="e-name" role="alert"></span></div>
            <div class="field"><label for="c-email">E-mail${o.emailRequired ? '' : ' (facultatif)'}</label><input id="c-email" type="email" autocomplete="email" ${o.emailRequired ? 'required' : ''} value="${esc(o.email ?? me.email)}"><span class="field-error" id="e-email" role="alert"></span></div>
          </div>
          ${o.certificate ? `<p class="hint xs muted">${o.nameOptional ? 'Vous pouvez passer le test sans nom ni e-mail : l’attestation portera alors la mention « Candidat anonyme ».' : 'Le nom saisi figurera sur l’attestation.'}</p>` : ''}
          <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit">Commencer l’examen ${icon('arrow', 18)}</button>${o.backHref ? `<a class="btn btn-light" href="${esc(o.backHref)}">← Retour</a>` : ''}</div>
        </form></div></div>`;
    root.querySelector('#idform').addEventListener('submit', (e) => {
      e.preventDefault();
      let name = root.querySelector('#c-name').value.trim();
      const email = root.querySelector('#c-email').value.trim();
      const nameOk = o.nameOptional ? (name === '' || name.length >= 3) : name.length >= 3;
      root.querySelector('#e-name').textContent = nameOk ? '' : 'Saisissez votre nom complet (ou laissez vide).';
      root.querySelector('#e-email').textContent = (o.emailRequired || email) && !isEmail(email) ? 'Saisissez une adresse e-mail valide.' : '';
      if (!nameOk || ((o.emailRequired || email) && !isEmail(email))) return;
      if (!name && o.nameOptional) name = 'Candidat anonyme';
      local.setMe({ name: name === 'Candidat anonyme' ? '' : name, email });
      resolve({ name, email });
    });
  });
}

/** Applique la règle de reprise puis renvoie true si la tentative a changé. */
export async function resumeAttempt(ctx, att, content) {
  if (reconcile(att, content)) { await ctx.store.saveAttempt(att); return true; }
  return false;
}

export function runExam(ctx, root, { attempt: att, content, onDone }) {
  ctx.setChrome('focus');
  const byId = new Map(content.questions.map((q) => [q.id, q]));
  let timerId = null;
  let tick = null;
  let busy = false;
  const stopTimers = () => { clearInterval(timerId); clearInterval(tick); timerId = tick = null; };
  const beforeUnload = (e) => { if (att.status === 'in_progress') { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  let keyH = null;
  const cleanup = () => { stopTimers(); window.removeEventListener('beforeunload', beforeUnload); if (keyH) document.removeEventListener('keydown', keyH); };
  ctx.onLeave(cleanup);

  const frame = (inner, timer = '') => {
    root.innerHTML = `<div class="container-narrow page quiz exam-frame">
      <div class="quiz-head"><div class="quiz-top"><span class="small"><strong>Question ${Math.min(att.idx + 1, att.total)}</strong> / ${att.total}</span><span class="badge badge-navy">Examen</span></div>
      ${bar(pct(att.idx, att.total))}${timer}</div>${inner}</div>`;
  };

  const save = () => ctx.store.saveAttempt(att);

  async function step() {
    if (!ctx.alive()) return;
    stopTimers();
    if (att.status === 'done') { cleanup(); onDone(att); return; }
    if (att.phase === 'finishing') return finish();
    if (att.phase === 'transition') return transition();
    return question();
  }

  function transition() {
    let left = CONFIG.EXAM_TRANSITION_SECONDS;
    const first = att.idx === 0;
    frame(`<div class="card transition center" aria-live="polite">
      <p class="eyebrow dark">${first ? 'Prêt ?' : 'Réponse enregistrée'}</p>
      <h1 class="h1-md">Question ${att.idx + 1} sur ${att.total}</h1>
      <p class="muted">La question s’affiche dans <strong id="tcount">${left}</strong> s. Le chronomètre démarre à l’affichage.</p>
      <button type="button" class="btn btn-primary" id="go">Afficher la question ${icon('arrow', 16)}</button></div>`);
    const go = async () => {
      if (busy) return; busy = true; stopTimers();
      att.phase = 'question'; att.qStart = Date.now();
      await save(); busy = false; step();
    };
    root.querySelector('#go').addEventListener('click', go);
    root.querySelector('#go').focus();
    tick = setInterval(() => {
      left--;
      const el = root.querySelector('#tcount');
      if (el) el.textContent = Math.max(left, 0);
      if (left <= 0) go();
    }, 1000);
  }

  function question() {
    const it = att.items[att.idx];
    const q = byId.get(it.qid);
    if (!q) { // question retirée du contenu : on la compte comme perdue
      answerCurrent(att, content, null); save().then(step); return;
    }
    let picked = null;
    const deadline = att.qStart + it.seconds * 1000;
    frame(`<div class="card q-card">${questionBodyHTML(q)}<div id="choices">${choicesHTML(q, it.order)}</div></div>
      <div class="btn-row quiz-actions"><button class="btn btn-primary btn-lg" type="button" id="validate" disabled>Valider ma réponse</button></div>
      <p class="xs muted center kbd-hint">Touches 1 à 4 ou A à D pour choisir, Entrée pour valider.</p>`,
      `<div class="timer" role="timer" aria-label="Temps restant"><div class="timer-bar"><span id="tbar"></span></div><span id="tsec" class="timer-sec">${fmtClock(it.seconds)}</span></div>`);
    const vbtn = root.querySelector('#validate');
    const choose = (d) => {
      picked = d;
      root.querySelector('#choices').innerHTML = choicesHTML(q, it.order, { picked: d });
      vbtn.disabled = false;
    };
    root.querySelector('#choices').addEventListener('click', (e) => { const b = e.target.closest('.choice'); if (b) choose(Number(b.dataset.d)); });
    const commit = async (value) => {
      if (busy) return; busy = true; stopTimers();
      if (keyH) document.removeEventListener('keydown', keyH);
      answerCurrent(att, content, value);
      await save();
      busy = false; step();
    };
    vbtn.addEventListener('click', () => { if (picked != null) commit(picked); });
    keyH = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' && picked != null) { e.preventDefault(); commit(picked); return; }
      const d = 'abcd'.indexOf(e.key.toLowerCase()) >= 0 ? 'abcd'.indexOf(e.key.toLowerCase()) : Number(e.key) - 1;
      if (d >= 0 && d < it.order.length) { e.preventDefault(); choose(d); }
    };
    document.addEventListener('keydown', keyH);

    const paint = () => {
      const left = deadline - Date.now();
      const tb = root.querySelector('#tbar');
      if (!tb) return stopTimers();
      tb.style.width = `${Math.max(0, (left / (it.seconds * 1000)) * 100)}%`;
      tb.parentElement.classList.toggle('low', left < 10000);
      root.querySelector('#tsec').textContent = fmtClock(left / 1000);
      if (left <= 0) commit(null); // temps écoulé : question perdue
    };
    paint();
    timerId = setInterval(paint, 100);
  }

  async function finish() {
    finalize(att);
    if (att.passed) {
      const cert = await ctx.store.createCertificate(att);
      att.certCode = cert.code;
    }
    await save();
    cleanup();
    onDone(att);
  }

  step();
}
