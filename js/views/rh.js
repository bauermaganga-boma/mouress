// Espace entreprise : tableau de bord, création de session, session (recrutement / montée en compétences), crédits.
import { CONFIG } from '../../config.js';
import { getProfilesData, loadContent, sectorOf, levelOf } from '../data.js';
import { esc, fmtDate, fmtDateInput, fmtDuration, fmtMoney, absUrl, copyText, downloadFile, toCsv, isEmail, pct } from '../util.js';
import { icon, badge, bar, statusBadge, whatsappLink } from '../ui.js';
import { pay, demoBanner, METHODS, paymentFormHTML, methodLabel } from '../payments.js';
import { band, BAND_LABEL, collabStats, matrixThemes, gaps, recommend, dueState, assignmentTitle, assignmentHref } from '../skills.js';

const DAY = 86400000;
const TYPE = {
  recruitment: { label: 'Recrutement', tone: 'navy', unit: 'candidat', units: 'candidats' },
  training: { label: 'Montée en compétences', tone: 'info', unit: 'collaborateur', units: 'collaborateurs' },
};
const linkOf = (inv) => absUrl(`#/t/${inv.token}`);

function inviteMessage(inv, s, company) {
  const when = s.deadline ? ` avant le ${fmtDate(s.deadline)}` : '';
  if (s.type === 'training') {
    return `Bonjour ${inv.name || ''}, ${company} vous invite à suivre votre parcours de montée en compétences « ${s.title} »${when}. Vous pouvez passer le test et vous entraîner autant de fois que nécessaire : ${linkOf(inv)}`;
  }
  return `Bonjour ${inv.name || ''}, ${company} vous invite à passer un test d’aptitude « ${s.title} » (${s.questionCount} questions)${when}. Votre lien personnel : ${linkOf(inv)}`;
}

function shareButtons(inv, s, company) {
  const msg = inviteMessage(inv, s, company);
  const subject = s.type === 'training' ? `Montée en compétences — ${s.title}` : `Test d’aptitude — ${s.title}`;
  return `<div class="btn-row share" style="gap:.35rem">
    <button type="button" class="btn btn-light btn-sm" data-copy="${esc(linkOf(inv))}" aria-label="Copier le lien de ${esc(inv.name || inv.email || 'ce candidat')}">${icon('copy', 14)} Copier</button>
    <a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="${esc(whatsappLink(msg))}" aria-label="Envoyer par WhatsApp à ${esc(inv.name || inv.email || 'ce candidat')}">${icon('whatsapp', 14)} WhatsApp</a>
    <a class="btn btn-light btn-sm" href="mailto:${esc(inv.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}" aria-label="Envoyer par e-mail à ${esc(inv.name || inv.email || 'ce candidat')}">${icon('mail', 14)} E-mail</a></div>`;
}

function bindCopy(ctx, root) {
  if (root.dataset.copyBound) return;
  root.dataset.copyBound = '1';
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    ctx.toast((await copyText(b.dataset.copy)) ? 'Lien copié.' : 'Copie impossible : sélectionnez le lien manuellement.');
  });
}

/** « Nom, e-mail » | « Nom <e-mail> » | e-mail seul | nom seul, un par ligne. */
export function parsePeople(text, requireEmail) {
  const list = []; const errors = [];
  String(text || '').split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const m = line.match(/[^\s,<>;]+@[^\s,<>;]+\.[^\s,<>;]{2,}/);
    const email = m ? m[0] : '';
    const name = line.replace(email, '').replace(/[<>,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (requireEmail && !isEmail(email)) { errors.push(`Ligne ${i + 1} : e-mail manquant ou invalide (« ${line} »).`); return; }
    if (!name && !email) return;
    list.push({ name: name || email.split('@')[0], email });
  });
  return { list, errors };
}

const sessionStats = (s) => {
  const inv = s.invitations;
  const done = inv.filter((i) => i.attempt?.status === 'done');
  return { invited: inv.length, done: done.length, passed: inv.filter((i) => i.status === 'passed').length, started: inv.filter((i) => i.status === 'started').length,
    avg: done.length ? Math.round(done.reduce((a, i) => a + i.attempt.percent, 0) / done.length) : null };
};

/* ------------------------------------------------------------------ Tableau de bord */
export async function dashboard(ctx, root) {
  ctx.setTitle('Tableau de bord RH');
  const data = await getProfilesData();
  const company = await ctx.store.getCompany(ctx.user.companyId);
  const sessions = await ctx.store.listSessions(company.id);
  const trainings = sessions.filter((s) => s.type === 'training');
  const assignments = [];
  for (const s of trainings) for (const a of await ctx.store.listAssignments(s.id)) assignments.push({ ...a, session: s, inv: s.invitations.find((i) => i.id === a.invitationId) });
  if (!ctx.alive()) return;
  const all = sessions.flatMap((s) => s.invitations);
  const finished = all.filter((i) => i.attempt?.status === 'done');
  const rate = finished.length ? pct(finished.filter((i) => i.attempt.passed).length, finished.length) : null;
  const pending = assignments.filter((a) => !a.doneAt).map((a) => ({ ...a, st: dueState(a) })).sort((a, b) => a.due - b.due);
  const late = pending.filter((a) => a.st.key === 'late').length;

  root.innerHTML = `<div class="container page">
    <div class="page-head split"><div><p class="eyebrow dark">Espace entreprise</p><h1 class="h1-md">${esc(company.name)}</h1></div>
      <div class="btn-row"><a class="btn btn-primary" href="#/rh/nouvelle-session">${icon('plus', 18)} Nouvelle session</a><a class="btn btn-outline" href="#/rh/credits">${icon('card', 18)} Acheter des crédits</a></div></div>
    ${company.demo ? '<div class="alert alert-warn"><strong>Entreprise Démo</strong> — données fictives, stockées dans ce navigateur.</div>' : ''}
    ${company.credits < 3 ? `<div class="alert alert-warn">Il vous reste ${company.credits} crédit(s). <a href="#/rh/credits">Recharger</a></div>` : ''}
    <div class="grid grid-4 stats">
      <div class="card stat"><span class="stat-n">${company.credits}</span><span class="muted small">crédits disponibles</span></div>
      <div class="card stat"><span class="stat-n">${sessions.length}</span><span class="muted small">sessions (${trainings.length} montée en compétences)</span></div>
      <div class="card stat"><span class="stat-n">${all.length}</span><span class="muted small">personnes invitées · ${finished.length} terminé(s)</span></div>
      <div class="card stat"><span class="stat-n">${rate == null ? '—' : rate + ' %'}</span><span class="muted small">taux de réussite</span></div></div>
    ${pending.length ? `<section class="block"><div class="split"><h2>Échéances à suivre</h2>${late ? badge(`${late} en retard`, 'ko') : ''}</div>
      <div class="card"><ul class="due-list">${pending.slice(0, 6).map((a) => `<li><span>${badge(a.st.label, a.st.tone)}</span>
        <span><strong>${esc(a.inv?.name || '—')}</strong> — ${esc(assignmentTitle(a, null))}<br><span class="xs muted">${esc(a.session.title)} · avant le ${fmtDate(a.due)}</span></span>
        <a class="btn btn-light btn-sm" href="#/rh/session/${esc(a.session.id)}?tab=gaps">Suivre</a></li>`).join('')}</ul></div></section>` : ''}
    <section class="block"><h2>Sessions</h2>
      ${sessions.length ? `<div class="grid grid-2">${sessions.map((s) => {
        const st = sessionStats(s); const p = data.profiles.find((x) => x.id === s.profileId);
        return `<a class="card card-link sess" href="#/rh/session/${esc(s.id)}"><div class="split" style="align-items:flex-start">${badge(TYPE[s.type].label, TYPE[s.type].tone)}<span class="xs muted">${s.deadline ? 'jusqu’au ' + fmtDate(s.deadline) : ''}</span></div>
          <h3>${esc(s.title)}</h3><p class="muted small">${esc(p?.name || s.profileId)} · ${s.questionCount} questions</p>
          <div class="sess-nums"><span><strong>${st.invited}</strong> ${TYPE[s.type].units}</span><span><strong>${st.done}</strong> terminé(s)</span><span><strong>${st.passed}</strong> réussi(s)</span>${st.avg != null ? `<span>moy. <strong>${st.avg} %</strong></span>` : ''}</div>
          ${bar(pct(st.done, st.invited))}</a>`;
      }).join('')}</div>` : `<div class="card"><h3>Aucune session pour l’instant</h3><p class="muted">Créez votre première session de test ou de montée en compétences.</p><a class="btn btn-primary" href="#/rh/nouvelle-session">Créer une session</a></div>`}</section>
  </div>`;
}

/* ------------------------------------------------------------------ Nouvelle session */
export async function newSession(ctx, root) {
  ctx.setTitle('Nouvelle session');
  const data = await getProfilesData();
  const company = await ctx.store.getCompany(ctx.user.companyId);
  if (!ctx.alive()) return;
  let type = ctx.query.get('type') === 'training' ? 'training' : 'recruitment';
  const pre = ctx.query.get('profil') || '';
  const options = data.sectors.map((sec) => {
    const ps = data.profiles.filter((p) => p.sector === sec.id).sort((a, b) => data.levels.findIndex((l) => l.id === a.level) - data.levels.findIndex((l) => l.id === b.level));
    return ps.length ? `<optgroup label="${esc(sec.name)}">${ps.map((p) => `<option value="${esc(p.id)}" ${p.id === pre ? 'selected' : ''}>${esc(p.name)} — ${esc(levelOf(data, p.level)?.name || '')}</option>`).join('')}</optgroup>` : '';
  }).join('');

  root.innerHTML = `<div class="container-narrow page">
    <div class="crumbs"><a href="#/rh">Tableau de bord</a><span>›</span><span>Nouvelle session</span></div>
    <h1 class="h1-md">Nouvelle session</h1>
    <form id="nf" class="stack" novalidate>
      <fieldset class="card type-pick"><legend class="label">Type de session</legend>
        <label class="type-opt"><input type="radio" name="type" value="recruitment"><span><strong>Recrutement</strong><span class="muted small">Lien envoyé à des candidats externes, un seul passage par candidat.</span></span></label>
        <label class="type-opt"><input type="radio" name="type" value="training"><span><strong>Montée en compétences</strong><span class="muted small">Équipe nommée de collaborateurs en poste, plusieurs passages, suivi avant / après et plan d’action.</span></span></label></fieldset>
      <div class="card">
        <div class="field"><label for="n-title" id="l-title">Poste</label><input id="n-title" type="text" required maxlength="120"><span class="hint" id="h-title"></span></div>
        <div class="field"><label for="n-profile">Profil de test</label><select id="n-profile">${options}</select><span class="hint" id="h-profile"></span></div>
        <div class="form-grid">
          <div class="field"><label for="n-q">Nombre de questions</label><input id="n-q" type="number" min="5" max="60" value="${CONFIG.EXAM_QUESTIONS}"><span class="hint">Limité au nombre de questions disponibles pour le profil.</span></div>
          <div class="field"><label for="n-due" id="l-due">Date limite</label><input id="n-due" type="date" value="${fmtDateInput(Date.now() + 30 * DAY)}"></div>
          <div class="field"><label for="n-pass">Seuil de réussite</label><select id="n-pass">${[60, 70, 80].map((v) => `<option value="${v}" ${v === CONFIG.PASS_MARK ? 'selected' : ''}>${v} %</option>`).join('')}</select></div></div>
        <div class="field"><label for="n-people" id="l-people">Candidats</label><textarea id="n-people" placeholder="Jean Mba, jean.mba@exemple.com&#10;Marie Nzamba, marie@exemple.com"></textarea><span class="hint" id="h-people"></span></div>
      </div>
      <div class="card cost" aria-live="polite"><div><strong id="cost-line"></strong><div class="muted small">Solde : ${company.credits} crédit(s)</div></div><a class="btn btn-ghost btn-sm" href="#/rh/credits">Acheter des crédits</a></div>
      <div class="field-error" id="n-err" role="alert"></div>
      <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit">Créer la session</button><a class="btn btn-ghost" href="#/rh">Annuler</a></div>
    </form></div>`;

  const $ = (s) => root.querySelector(s);
  const count = () => parsePeople($('#n-people').value, type === 'training').list.length;
  const sync = () => {
    const t = TYPE[type];
    root.querySelectorAll('input[name=type]').forEach((r) => { r.checked = r.value === type; });
    $('#l-title').textContent = type === 'training' ? 'Nom de l’équipe' : 'Intitulé du poste';
    $('#n-title').placeholder = type === 'training' ? 'Ex. Équipe maintenance Port-Gentil' : 'Ex. Opérateur de production — Libreville';
    $('#h-title').textContent = type === 'training' ? 'Visible par les collaborateurs dans leur parcours.' : '';
    $('#l-due').textContent = type === 'training' ? 'Échéance du parcours' : 'Date limite pour passer le test';
    $('#l-people').textContent = type === 'training' ? 'Collaborateurs (un par ligne : nom, e-mail)' : 'Candidats (un par ligne : nom, e-mail)';
    $('#h-people').textContent = type === 'training'
      ? 'L’e-mail est obligatoire : il relie le collaborateur à son parcours. Plusieurs passages autorisés.'
      : 'L’e-mail est facultatif. Chaque ligne reçoit un lien personnel, à usage unique.';
    const n = count();
    $('#cost-line').textContent = `${n} ${n > 1 ? t.units : t.unit} = ${n} crédit${n > 1 ? 's' : ''}`;
  };
  sync();
  root.addEventListener('change', (e) => { if (e.target.name === 'type') { type = e.target.value; sync(); } });
  $('#n-people').addEventListener('input', sync);

  $('#nf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#n-err'); err.textContent = '';
    const title = $('#n-title').value.trim();
    const { list, errors } = parsePeople($('#n-people').value, type === 'training');
    if (title.length < 3) { err.textContent = type === 'training' ? 'Donnez un nom à l’équipe.' : 'Saisissez l’intitulé du poste.'; return; }
    if (errors.length) { err.textContent = errors[0]; return; }
    if (!list.length) { err.textContent = 'Ajoutez au moins une personne.'; return; }
    if (list.length > company.credits) { err.innerHTML = `Crédits insuffisants : ${list.length} nécessaire(s), ${company.credits} disponible(s). <a href="#/rh/credits">Acheter des crédits</a>`; return; }
    const profileId = $('#n-profile').value;
    const content = await loadContent(profileId);
    let qn = Math.max(5, Math.min(60, Number($('#n-q').value) || CONFIG.EXAM_QUESTIONS));
    if (content) qn = Math.min(qn, content.questions.length);
    const due = new Date($('#n-due').value + 'T23:59:59').getTime();
    if (!due || due < Date.now()) { err.textContent = 'La date limite doit être dans le futur.'; return; }
    try {
      const s = await ctx.store.createSession({ companyId: company.id, type, title, profileId, questionCount: qn, passMark: Number($('#n-pass').value), deadline: due, candidates: list });
      ctx.toast(`Session créée : ${list.length} lien(s) généré(s).`);
      ctx.go(`/rh/session/${s.id}`);
    } catch (ex) { err.textContent = ex.message; }
  });
}

/* ------------------------------------------------------------------ Session */
export async function session(ctx, root) {
  const s = await ctx.store.getSession(ctx.params.id);
  if (!s || s.companyId !== ctx.user.companyId) { (await import('./notfound.js')).default(ctx, root); return; }
  const company = await ctx.store.getCompany(s.companyId);
  const data = await getProfilesData();
  const profile = data.profiles.find((p) => p.id === s.profileId);
  const content = await loadContent(s.profileId);
  if (!ctx.alive()) return;
  ctx.setTitle(s.title);
  bindCopy(ctx, root);
  const env = { ctx, root, s, company, data, profile, content };
  if (s.type === 'training') await trainingView(env); else recruitmentView(env);
}

function sessionHead({ s, profile, data }) {
  return `<div class="crumbs"><a href="#/rh">Tableau de bord</a><span>›</span><span>Session</span></div>
    <div class="page-head split"><div><div class="btn-row" style="gap:.4rem">${badge(TYPE[s.type].label, TYPE[s.type].tone)}${badge(profile?.name || s.profileId)}${badge(levelOf(data, profile?.level)?.name || '')}</div>
    <h1 class="h1-md" style="margin-top:.5rem">${esc(s.title)}</h1>
    <p class="muted small">${s.questionCount} questions · seuil ${s.passMark} % · ${s.type === 'training' ? 'échéance' : 'date limite'} ${fmtDate(s.deadline)}</p></div></div>`;
}

function addPeopleForm(s) {
  return `<details class="card add-box"><summary class="btn btn-outline btn-sm">${icon('plus', 14)} Ajouter des ${TYPE[s.type].units}</summary>
    <form id="addf" novalidate style="margin-top:var(--sp-4)"><div class="field"><label for="add-people">Un par ligne : nom, e-mail</label><textarea id="add-people"></textarea><span class="hint">1 crédit par ${TYPE[s.type].unit}.</span></div>
    <div class="field-error" id="add-err" role="alert"></div><button class="btn btn-primary" type="submit">Ajouter et générer les liens</button></form></details>`;
}
function bindAddForm({ ctx, root, s }) {
  root.querySelector('#addf')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = root.querySelector('#add-err'); err.textContent = '';
    const { list, errors } = parsePeople(root.querySelector('#add-people').value, s.type === 'training');
    if (errors.length) { err.textContent = errors[0]; return; }
    if (!list.length) { err.textContent = 'Saisissez au moins une personne.'; return; }
    try { await ctx.store.addInvitations(s.id, list); ctx.toast('Ajouté.'); await session(ctx, root); } catch (ex) { err.innerHTML = `${esc(ex.message)} <a href="#/rh/credits">Acheter des crédits</a>`; }
  });
}

/* ---- Recrutement */
function recruitmentView(env) {
  const { ctx, root, s, company } = env;
  const st = sessionStats(s);
  const themes = matrixThemes(s.invitations);
  root.innerHTML = `<div class="container page">${sessionHead(env)}
    <div class="grid grid-4 stats">
      <div class="card stat"><span class="stat-n">${st.invited}</span><span class="muted small">invités</span></div>
      <div class="card stat"><span class="stat-n">${st.started}</span><span class="muted small">en cours</span></div>
      <div class="card stat"><span class="stat-n">${st.done}</span><span class="muted small">terminés · ${st.passed} réussi(s)</span></div>
      <div class="card stat"><span class="stat-n">${st.avg == null ? '—' : st.avg + ' %'}</span><span class="muted small">score moyen</span></div></div>
    <div class="btn-row" style="margin-bottom:var(--sp-4)"><button type="button" class="btn btn-navy" id="csv">${icon('download', 18)} Exporter en CSV</button></div>
    ${addPeopleForm(s)}
    <section class="block"><h2>Candidats</h2><div class="table-wrap"><table class="table"><caption class="sr-only">Candidats de la session</caption>
      <thead><tr><th>Candidat</th><th>Statut</th><th>Score</th><th>Temps</th><th>Lien à envoyer</th></tr></thead><tbody>
      ${s.invitations.map((inv) => {
        const a = inv.attempt;
        const done = a?.status === 'done';
        const th = done ? Object.entries(a.themes || {}) : [];
        return `<tr><td><strong>${esc(inv.name || '—')}</strong><br><span class="xs muted">${esc(inv.email || '')}</span></td>
          <td>${statusBadge(inv.status)}</td>
          <td>${done ? `<strong>${a.percent} %</strong>${th.length ? `<details class="mini"><summary class="xs">Détail par thème</summary>${th.map(([t, v]) => `<div class="theme-row"><span class="xs">${esc(t)}</span><span class="xs muted">${pct(v.ok, v.total)} %</span>${bar(pct(v.ok, v.total), pct(v.ok, v.total) >= s.passMark ? 'ok' : 'ko')}</div>`).join('')}${a.synthetic ? '' : `<a class="xs" href="#/resultat/${esc(a.id)}">Voir la correction</a>`}</details>` : ''}` : '—'}</td>
          <td>${done ? fmtDuration(a.durationMs) : '—'}</td><td>${shareButtons(inv, s, company.name)}</td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="xs muted" style="margin-top:var(--sp-3)">Le lien est personnel. Le candidat saisit son nom et son e-mail, passe le test, et le résultat apparaît ici.</p></section></div>`;
  bindAddForm(env);
  root.querySelector('#csv').addEventListener('click', () => {
    const rows = [['Candidat', 'E-mail', 'Statut', 'Score (%)', 'Résultat', 'Temps', 'Date', ...themes.map((t) => `${t} (%)`)]];
    for (const inv of s.invitations) {
      const a = inv.attempt; const done = a?.status === 'done';
      rows.push([inv.name, inv.email, { invited: 'Invité', started: 'En cours', passed: 'Réussi', failed: 'Échoué', expired: 'Expiré' }[inv.status], done ? a.percent : '', done ? (a.passed ? 'Réussi' : 'Échoué') : '', done ? fmtDuration(a.durationMs) : '', done ? fmtDate(a.finishedAt) : '',
        ...themes.map((t) => (done && a.themes?.[t] ? pct(a.themes[t].ok, a.themes[t].total) : ''))]);
    }
    downloadFile(`session-${s.id}.csv`, toCsv(rows));
  });
}

/* ---- Montée en compétences */
async function trainingView(env) {
  const { ctx, root, s, company, content } = env;
  const passMark = s.passMark;
  const collabId = ctx.query.get('collab');
  const tab = ['matrix', 'gaps', 'team'].includes(ctx.query.get('tab')) ? ctx.query.get('tab') : 'matrix';
  const invs = s.invitations.map((inv) => ({ ...inv, stats: collabStats(inv) }));
  const themes = matrixThemes(s.invitations);
  const assignments = await ctx.store.listAssignments(s.id);
  if (!ctx.alive()) return;
  const tested = invs.filter((i) => i.stats.count);
  const deltas = invs.filter((i) => i.stats.overallDelta != null).map((i) => i.stats.overallDelta);
  const avgDelta = deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null;
  const below = tested.filter((i) => i.stats.overallLast < passMark).length;
  const lateCount = assignments.filter((a) => dueState(a).key === 'late').length;
  const base = `#/rh/session/${esc(s.id)}`;
  const sign = (d) => (d > 0 ? `+${d}` : `${d}`);
  const trend = (d) => (d == null ? '<span class="muted xs">1 test</span>' : `<span class="trend ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${sign(d)} pts</span>`);
  const cell = (p, d) => `<td class="mx mx-${band(p, passMark)}">${p == null ? '—' : `<strong>${p} %</strong>`}<span class="sr-only"> ${BAND_LABEL[band(p, passMark)]}</span>${d != null ? `<span class="mx-d ${d >= 0 ? 'up' : 'down'}">${d > 0 ? '▲' : d < 0 ? '▼' : '='}${d ? sign(d) : ''}</span>` : ''}</td>`;

  const legend = `<p class="legend xs"><span class="lg lg-ko"></span> &lt; 50 % faible <span class="lg lg-mid"></span> 50 % à ${passMark - 1} % à renforcer <span class="lg lg-ok"></span> ≥ ${passMark} % atteint · ▲▼ = évolution entre le 1er et le dernier test</p>`;

  const matrixHTML = () => `${legend}<div class="table-wrap"><table class="table matrix"><caption class="sr-only">Matrice de compétences : collaborateurs par thème</caption>
    <thead><tr><th>Collaborateur</th><th>Global</th><th>Tendance</th>${themes.map((t) => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>
    ${invs.map((i) => `<tr><td><a href="${base}?collab=${esc(i.id)}"><strong>${esc(i.name)}</strong></a><br><span class="xs muted">${i.stats.count ? i.stats.count + ' test(s)' : 'Pas encore testé'}</span></td>
      ${cell(i.stats.overallLast, null)}<td>${i.stats.count ? trend(i.stats.overallDelta) : '—'}</td>
      ${themes.map((t) => cell(i.stats.themesLast[t] ?? null, i.stats.delta[t] ?? null)).join('')}</tr>`).join('')}
    </tbody><tfoot><tr><th>Moyenne équipe</th>${(() => {
      const avg = (vals) => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
      const g = avg(tested.map((i) => i.stats.overallLast));
      return cell(g, null) + '<td></td>' + themes.map((t) => cell(avg(tested.map((i) => i.stats.themesLast[t]).filter((v) => v != null)), null)).join('');
    })()}</tr></tfoot></table></div>`;

  async function recsFor(inv) {
    const out = [];
    for (const g of gaps(inv.stats, passMark)) out.push({ ...g, rec: await recommend(s.profileId, g.theme) });
    return out;
  }
  const assigned = (inv, kind, key) => assignments.find((a) => a.invitationId === inv.id && a.kind === kind && ((kind === 'module' ? a.moduleId : a.theme) === key) && !a.doneAt);
  const recItems = (inv, g) => {
    const rows = [];
    for (const m of g.rec.modules) rows.push({ kind: 'module', key: m.id, title: `Module : ${m.title}`, href: `#/cours/${s.profileId}/${m.id}`, theme: g.theme, moduleId: m.id });
    rows.push({ kind: 'practice', key: g.theme, title: `Entraînement : série « ${g.theme} »`, href: `#/entrainement/${s.profileId}?theme=${encodeURIComponent(g.theme)}`, theme: g.theme });
    return rows.map((r) => {
      const a = assigned(inv, r.kind, r.key);
      return `<li><a href="${esc(r.href)}">${esc(r.title)}</a>${a ? `<span class="badge badge-ok">Assigné · avant le ${fmtDate(a.due)}</span>`
        : `<button type="button" class="btn btn-light btn-sm" data-assign='${esc(JSON.stringify({ inv: inv.id, kind: r.kind, theme: r.theme, moduleId: r.moduleId || null }))}'>Assigner</button>`}</li>`;
    }).join('');
  };

  const dueListHTML = (list, showName = true) => list.length ? `<ul class="due-list">${list.sort((a, b) => a.due - b.due).map((a) => {
    const st = dueState(a); const inv = invs.find((i) => i.id === a.invitationId);
    return `<li>${badge(st.label, st.tone)}<span>${showName ? `<strong>${esc(inv?.name || '—')}</strong> — ` : ''}${esc(assignmentTitle(a, content))}<br><span class="xs muted">avant le ${fmtDate(a.due)}</span></span>
      <a class="btn btn-light btn-sm" href="${esc(assignmentHref(a))}">Ouvrir</a></li>`;
  }).join('')}</ul>` : '<p class="muted small">Aucune assignation pour l’instant.</p>';

  const head = `${sessionHead(env)}
    <div class="grid grid-4 stats">
      <div class="card stat"><span class="stat-n">${invs.length}</span><span class="muted small">collaborateurs · ${tested.length} testé(s)</span></div>
      <div class="card stat"><span class="stat-n">${avgDelta == null ? '—' : sign(avgDelta) + ' pts'}</span><span class="muted small">progression moyenne avant / après</span></div>
      <div class="card stat"><span class="stat-n">${below}</span><span class="muted small">sous le seuil de ${passMark} %</span></div>
      <div class="card stat"><span class="stat-n">${lateCount}</span><span class="muted small">assignation(s) en retard</span></div></div>`;

  /* ----- Vue individuelle */
  if (collabId) {
    const inv = invs.find((i) => i.id === collabId);
    if (!inv) { ctx.go(`/rh/session/${s.id}`); return; }
    const st = inv.stats; const recs = await recsFor(inv);
    if (!ctx.alive()) return;
    const mine = assignments.filter((a) => a.invitationId === inv.id);
    root.innerHTML = `<div class="container page">
      <div class="crumbs"><a href="#/rh">Tableau de bord</a><span>›</span><a href="${base}">${esc(s.title)}</a><span>›</span><span>${esc(inv.name)}</span></div>
      <div class="page-head split"><div><h1 class="h1-md">${esc(inv.name)}</h1><p class="muted small">${esc(inv.email)} · ${st.count} test(s) passé(s)</p></div><a class="btn btn-light" href="${base}?tab=matrix">← Équipe</a></div>
      ${st.count ? `<div class="grid grid-3 stats"><div class="card stat"><span class="stat-n">${st.overallFirst} %</span><span class="muted small">1er test</span></div>
        <div class="card stat"><span class="stat-n">${st.overallLast} %</span><span class="muted small">dernier test</span></div>
        <div class="card stat"><span class="stat-n">${st.overallDelta == null ? '—' : sign(st.overallDelta) + ' pts'}</span><span class="muted small">évolution</span></div></div>
        <section class="block"><h2>Avant / après par thème</h2><div class="card">${themes.filter((t) => st.themesLast[t] != null).map((t) => {
          const a = st.themesFirst[t]; const b = st.themesLast[t];
          return `<div class="ba"><div class="split"><strong>${esc(t)}</strong><span class="badge badge-${band(b, passMark) === 'ok' ? 'ok' : band(b, passMark) === 'ko' ? 'ko' : 'warn'}">${BAND_LABEL[band(b, passMark)]}</span></div>
            ${st.count > 1 ? `<div class="ba-row"><span class="xs muted">Avant</span>${bar(a ?? 0)}<span class="xs">${a ?? '—'} %</span></div>` : ''}
            <div class="ba-row"><span class="xs muted">${st.count > 1 ? 'Après' : 'Résultat'}</span>${bar(b, band(b, passMark) === 'ok' ? 'ok' : band(b, passMark) === 'ko' ? 'ko' : '')}<span class="xs"><strong>${b} %</strong> ${st.delta[t] != null ? trend(st.delta[t]) : ''}</span></div></div>`;
        }).join('')}</div></section>` : '<div class="alert alert-info">Ce collaborateur n’a pas encore passé le test. Envoyez-lui son lien ci-dessous.</div>'}
      <section class="block"><h2>Analyse des écarts</h2>
        ${recs.length ? `<div class="card"><ul class="rec-list">${recs.map((g) => `<li class="rec"><div class="split"><strong>${esc(g.theme)}</strong>${badge(g.pct + ' %', g.pct < 50 ? 'ko' : 'warn')}</div>
          <ul class="rec-items">${recItems(inv, g)}</ul>${g.rec.available ? '' : '<p class="xs muted">Contenu bientôt disponible pour ce profil.</p>'}</li>`).join('')}</ul>
          <div class="due-pick"><label for="due-d" class="label">Échéance</label><input id="due-d" type="date" value="${fmtDateInput(Date.now() + 14 * DAY)}"><button type="button" class="btn btn-primary" data-assign-all="${esc(inv.id)}">Tout assigner</button></div></div>`
          : `<div class="card"><p>${st.count ? 'Tous les thèmes atteignent le seuil : aucun écart à combler.' : 'Les écarts apparaîtront après le premier test.'}</p></div>`}</section>
      <section class="block"><h2>Plan d’action</h2><div class="card">${dueListHTML(mine, false)}</div></section>
      <section class="block"><h2>Lien du collaborateur</h2><div class="card">${shareButtons(inv, s, company.name)}</div></section></div>`;
    bindAssign(env, assignments, recs.map((g) => g), invs);
    return;
  }

  /* ----- Vue équipe */
  const tabs = [['matrix', 'Matrice de compétences'], ['gaps', 'Écarts et plan d’action'], ['team', 'Collaborateurs et liens']];
  let body = '';
  let allRecs = null;
  if (tab === 'matrix') {
    body = `<div class="split" style="margin-bottom:var(--sp-3)"><h2>Matrice collaborateurs × thèmes</h2><button type="button" class="btn btn-navy btn-sm" id="csv">${icon('download', 16)} Exporter en CSV</button></div>
      ${themes.length ? matrixHTML() : '<div class="card"><p class="muted">Aucun test terminé pour l’instant : la matrice se remplira au fil des passages.</p></div>'}`;
  } else if (tab === 'gaps') {
    allRecs = [];
    for (const inv of invs) if (inv.stats.count) allRecs.push({ inv, gaps: await recsFor(inv) });
    if (!ctx.alive()) return;
    const needing = allRecs.filter((r) => r.gaps.length);
    body = `<div class="split" style="margin-bottom:var(--sp-3)"><h2>Écarts et plan d’action</h2>
      <div class="due-pick"><label for="due-d" class="label">Échéance des assignations</label><input id="due-d" type="date" value="${fmtDateInput(Date.now() + 14 * DAY)}"><button type="button" class="btn btn-primary btn-sm" data-assign-team>Tout assigner à l’équipe</button></div></div>
      ${needing.length ? needing.map((r) => `<article class="card gap-card"><div class="split"><h3><a href="${base}?collab=${esc(r.inv.id)}">${esc(r.inv.name)}</a></h3>${badge(r.inv.stats.overallLast + ' % global', band(r.inv.stats.overallLast, passMark) === 'ok' ? 'ok' : 'warn')}</div>
        <ul class="rec-list">${r.gaps.map((g) => `<li class="rec"><div class="split"><strong>${esc(g.theme)}</strong>${badge(g.pct + ' %', g.pct < 50 ? 'ko' : 'warn')}</div><ul class="rec-items">${recItems(r.inv, g)}</ul></li>`).join('')}</ul></article>`).join('')
        : '<div class="card"><p class="muted">Aucun écart détecté : tous les collaborateurs testés atteignent le seuil sur chaque thème.</p></div>'}
      <section class="block"><div class="split"><h2>Échéances</h2>${lateCount ? badge(`${lateCount} en retard`, 'ko') : ''}</div><div class="card">${dueListHTML(assignments)}</div></section>`;
  } else {
    body = `${addPeopleForm(s)}<h2 style="margin-top:var(--sp-5)">Collaborateurs</h2><div class="table-wrap"><table class="table"><caption class="sr-only">Collaborateurs et liens</caption>
      <thead><tr><th>Collaborateur</th><th>Tests</th><th>Dernier score</th><th>Lien personnel</th></tr></thead><tbody>
      ${invs.map((i) => `<tr><td><a href="${base}?collab=${esc(i.id)}"><strong>${esc(i.name)}</strong></a><br><span class="xs muted">${esc(i.email)}</span></td><td>${i.stats.count}</td>
        <td>${i.stats.count ? `${i.stats.overallLast} % ${trend(i.stats.overallDelta)}` : statusBadge(i.status)}</td><td>${shareButtons(i, s, company.name)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  root.innerHTML = `<div class="container page">${head}
    <div class="tabs" role="tablist" aria-label="Vues de la session">${tabs.map(([k, l]) => `<a role="tab" class="tab" href="${base}?tab=${k}" aria-selected="${k === tab}">${l}</a>`).join('')}</div>
    <div class="tab-body">${body}</div></div>`;
  bindAddForm(env);
  bindAssign(env, assignments, null, invs, allRecs);
  root.querySelector('#csv')?.addEventListener('click', () => {
    const rows = [['Collaborateur', 'E-mail', 'Tests passés', '1er test (%)', 'Dernier test (%)', 'Évolution (pts)', ...themes.flatMap((t) => [`${t} — dernier (%)`, `${t} — évolution (pts)`])]];
    for (const i of invs) {
      const st = i.stats;
      rows.push([i.name, i.email, st.count, st.overallFirst ?? '', st.overallLast ?? '', st.overallDelta ?? '', ...themes.flatMap((t) => [st.themesLast[t] ?? '', st.delta[t] ?? ''])]);
    }
    downloadFile(`competences-${s.id}.csv`, toCsv(rows));
  });
}

/** Assignations en 1 clic (par ligne, par collaborateur, ou pour toute l'équipe). */
function bindAssign(env, assignments, indivRecs, invs, teamRecs) {
  const { ctx, root, s } = env;
  if (root.dataset.assignBound) return;
  root.dataset.assignBound = '1';
  const dueTs = () => new Date((root.querySelector('#due-d')?.value || fmtDateInput(Date.now() + 14 * DAY)) + 'T23:59:59').getTime();
  const reload = async (msg) => { ctx.toast(msg); await session(ctx, root); };
  const toItem = (d) => ({ invitationId: d.inv, kind: d.kind, profileId: s.profileId, moduleId: d.moduleId, theme: d.theme, due: dueTs() });
  root.addEventListener('click', async (e) => {
    const one = e.target.closest('[data-assign]');
    if (one) { await ctx.store.addAssignments(s.id, [toItem(JSON.parse(one.dataset.assign))]); await reload('Assigné avec échéance.'); return; }
    const all = e.target.closest('[data-assign-all]');
    if (all) {
      const list = [];
      root.querySelectorAll(`[data-assign]`).forEach((b) => { const d = JSON.parse(b.dataset.assign); if (d.inv === all.dataset.assignAll) list.push(toItem(d)); });
      if (!list.length) { ctx.toast('Tout est déjà assigné.'); return; }
      await ctx.store.addAssignments(s.id, list); await reload(`${list.length} assignation(s) créée(s).`); return;
    }
    if (e.target.closest('[data-assign-team]')) {
      const list = [];
      root.querySelectorAll('[data-assign]').forEach((b) => list.push(toItem(JSON.parse(b.dataset.assign))));
      if (!list.length) { ctx.toast('Tout est déjà assigné.'); return; }
      await ctx.store.addAssignments(s.id, list); await reload(`${list.length} assignation(s) créée(s) pour l’équipe.`);
    }
  });
}

/* ------------------------------------------------------------------ Crédits */
export async function credits(ctx, root) {
  ctx.setTitle('Crédits');
  const draw = async () => {
    const company = await ctx.store.getCompany(ctx.user.companyId);
    const tx = await ctx.store.listTransactions(company.id);
    if (!ctx.alive()) return;
    root.innerHTML = `<div class="container-narrow page">
      <div class="crumbs"><a href="#/rh">Tableau de bord</a><span>›</span><span>Crédits</span></div>
      <h1 class="h1-md">Crédits</h1>${demoBanner()}
      <div class="card stat" style="margin-bottom:var(--sp-5)"><span class="stat-n" id="balance">${company.credits}</span><span class="muted small">crédits disponibles · 1 crédit = 1 candidat ou 1 collaborateur invité</span></div>
      <div id="paid"></div>
      <form id="pf" class="stack" novalidate>
        <fieldset class="card"><legend class="label">1. Choisissez un pack</legend><div class="pack-pick">${CONFIG.PACKS.map((p, i) => `<label class="pack-opt"><input type="radio" name="pack" value="${esc(p.id)}" ${p.featured || i === 0 ? 'checked' : ''}><span><strong>${p.credits} crédits</strong><span class="muted small">${esc(p.label)} · ${fmtMoney(p.price)}</span></span></label>`).join('')}</div>
          <p class="xs muted">Prix provisoires, susceptibles d’évoluer.</p></fieldset>
        <fieldset class="card"><legend class="label">2. Mode de paiement</legend>
          <div class="method-pick">${METHODS.map((m, i) => `<label class="pack-opt"><input type="radio" name="method" value="${m.id}" ${i === 0 ? 'checked' : ''}><span><strong>${esc(m.label)}</strong><span class="muted small">${esc(m.hint)}</span></span></label>`).join('')}</div>
          <div id="pay-fields" style="margin-top:var(--sp-4)"></div></fieldset>
        <div class="field-error" id="p-err" role="alert"></div>
        <button class="btn btn-primary btn-lg" type="submit" id="pay-btn"></button></form>
      <section class="block"><h2>Historique</h2>${tx.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Opération</th><th>Crédits</th><th>Montant</th></tr></thead><tbody>
        ${tx.map((t) => `<tr><td>${fmtDate(t.date)}</td><td>${t.type === 'purchase' ? `Achat ${t.demo ? '(démo) ' : ''}· ${methodLabel(t.method)}<br><span class="xs muted">${esc(t.ref)}</span>` : esc(t.ref || (t.type === 'bonus' ? 'Crédits offerts' : 'Utilisation'))}</td>
        <td><strong style="color:${t.credits > 0 ? 'var(--c-ok)' : 'var(--c-ko)'}">${t.credits > 0 ? '+' : ''}${t.credits}</strong></td><td>${t.amount ? fmtMoney(t.amount) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune opération.</p>'}</section></div>`;

    const $ = (q) => root.querySelector(q);
    const pack = () => CONFIG.PACKS.find((p) => p.id === root.querySelector('input[name=pack]:checked').value);
    const method = () => root.querySelector('input[name=method]:checked').value;
    const syncBtn = () => { $('#pay-btn').textContent = `Payer ${fmtMoney(pack().price)} (démo)`; };
    const syncFields = () => { $('#pay-fields').innerHTML = paymentFormHTML(method()); };
    syncBtn(); syncFields();
    $('#pf').addEventListener('change', (e) => { if (e.target.name === 'pack') syncBtn(); if (e.target.name === 'method') syncFields(); });
    $('#pf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#p-err'); err.textContent = '';
      const btn = $('#pay-btn'); btn.disabled = true; btn.textContent = 'Traitement en cours…';
      const details = Object.fromEntries([...root.querySelectorAll('#pay-fields input')].map((i) => [i.name, i.value]));
      const pk = pack();
      try {
        const res = await pay({ amount: pk.price, method: method(), company: { id: company.id, name: company.name }, details });
        if (!res.ok) { err.textContent = res.message || 'Le paiement a échoué.'; btn.disabled = false; syncBtn(); return; }
        root.querySelectorAll('#pay-fields input').forEach((i) => { i.value = ''; }); // aucune donnée de paiement conservée
        await ctx.store.purchaseCredits(company.id, pk, res);
        await draw();
        root.querySelector('#paid').innerHTML = `<div class="alert alert-ok" role="status"><strong>Paiement simulé accepté.</strong> ${pk.credits} crédits ajoutés (référence ${esc(res.ref)}).</div>`;
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; syncBtn(); }
    });
  };
  await draw();
}
