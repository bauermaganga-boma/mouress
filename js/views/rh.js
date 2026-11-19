// Espace entreprise : tableau de bord, achat de Pass, session (recrutement / montée en compétences), facturation.
import { CONFIG } from '../../config.js';
import { getProfilesData, loadContent, sectorOf, levelOf } from '../data.js';
import { esc, fmtDate, fmtDateInput, fmtDuration, fmtMoney, absUrl, copyText, downloadFile, toCsv, isEmail, pct } from '../util.js';
import { icon, badge, bar, statusBadge, whatsappLink } from '../ui.js';
import { demoBanner, methodLabel } from '../payments.js';
import { passPrice, attemptsUsed } from '../pass.js';
import { invite as inviteImpl } from './rh-invite.js';
import { recruitView } from './rh-recruit.js';
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
    return `Bonjour ${inv.name || ''}, ${company} vous invite à suivre votre parcours de montée en compétences « ${s.title} »${when}. Votre Pass donne accès à la formation, à l’entraînement et à l’examen : ${linkOf(inv)}`;
  }
  return `Bonjour ${inv.name || ''}, ${company} vous invite à passer un test d’aptitude « ${s.title} » (${s.questionCount} questions)${when}. Votre Pass personnel (formation, entraînement, examen) : ${linkOf(inv)}`;
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

const sessionStats = (s) => {
  const inv = s.invitations;
  const done = inv.filter((i) => i.attempt?.status === 'done');
  return { invited: inv.length, done: done.length, passed: inv.filter((i) => i.status === 'passed').length, started: inv.filter((i) => i.status === 'started').length,
    avg: done.length ? Math.round(done.reduce((a, i) => a + i.attempt.percent, 0) / done.length) : null };
};

/* ------------------------------------------------------------------ Tableau de bord, recrutements, équipes */
export { dashboard } from './rh-dash.js';
export { employee } from './rh-teams.js';
export { formation } from './rh-formations.js';
export const teamHome = (ctx) => ctx.go('/rh?vue=equipes');

/* ------------------------------------------------------------------ Achat de Pass */
export const invite = (ctx, root) => inviteImpl(ctx, root, { shareButtons, bindCopy });

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
    <a class="back-link" href="#/rh">${icon('arrow', 16, 'flip')} Retour au tableau de bord</a>
    <div class="page-head split"><div><div class="btn-row" style="gap:.4rem">${badge(TYPE[s.type].label, TYPE[s.type].tone)}${badge(profile?.name || s.profileId)}${badge(levelOf(data, profile?.level)?.name || '')}</div>
    <h1 class="h1-md" style="margin-top:.5rem">${esc(s.title)}</h1>
    <p class="muted small">${s.questionCount} questions · seuil ${s.passMark} % · ${s.type === 'training' ? 'échéance' : 'date limite'} ${fmtDate(s.deadline)}</p></div></div>`;
}

function addPeopleForm(s) {
  return `<a class="btn btn-outline btn-sm" href="#/rh/inviter?session=${esc(s.id)}">${icon('plus', 14)} Ajouter des Pass (${esc(fmtMoney(passPrice(s.level)))} / personne)</a>`;
}
function bindAddForm() { /* l'ajout passe par la page d'achat de Pass */ }

/* ---- Recrutement */
function recruitmentView(env) {
  recruitView(env, { sessionHead, shareButtons, addPeopleForm, bindCopy });
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
      <div class="page-head split"><div><h1 class="h1-md">${esc(inv.name)}</h1><p class="muted small">${esc(inv.email)} · ${st.count} test(s) passé(s)</p></div><a class="back-link" href="${base}?tab=matrix">${icon('arrow', 16, 'flip')} Retour à l’équipe</a></div>
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

/* ------------------------------------------------------------------ Facturation / Mes Pass */
export async function billing(ctx, root) {
  ctx.setTitle('Facturation et Pass');
  const company = await ctx.store.getCompany(ctx.user.companyId);
  const orders = await ctx.store.listOrders(company.id);
  const sessions = await ctx.store.listSessions(company.id);
  if (!ctx.alive()) return;
  const passes = sessions.flatMap((s) => s.invitations.map((i) => ({ ...i, session: s })));
  const total = orders.reduce((a, o) => a + o.total, 0);
  root.innerHTML = `<div class="container page">
    <div class="crumbs"><a href="#/rh">Tableau de bord</a><span>›</span><span>Facturation</span></div>
    <div class="page-head split"><div><h1 class="h1-md">Facturation / Mes Pass</h1><p class="muted">Un Pass = une personne pour un poste. Prix provisoires par niveau : Technicien / Superviseur ${esc(fmtMoney(CONFIG.PASS_PRICES.tech))}, Ingénieur / Cadre ${esc(fmtMoney(CONFIG.PASS_PRICES.ing))}.</p></div>
      <a class="btn btn-primary" href="#/rh/inviter">${icon('plus', 18)} Acheter des Pass</a></div>${demoBanner()}
    <div class="grid grid-3 stats"><div class="card stat"><span class="stat-n">${passes.length}</span><span class="muted small">Pass achetés</span></div>
      <div class="card stat"><span class="stat-n">${orders.length}</span><span class="muted small">commandes</span></div>
      <div class="card stat"><span class="stat-n">${esc(fmtMoney(total))}</span><span class="muted small">total facturé (démo)</span></div></div>
    <section class="block"><h2>Commandes</h2>${orders.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Date</th><th>Poste</th><th>Pass</th><th>Montant</th><th>Paiement</th><th></th></tr></thead><tbody>
      ${orders.map((o) => `<tr><td class="nowrap">${esc(o.number)}</td><td class="nowrap">${fmtDate(o.date)}</td><td>${esc(o.profileName || o.sessionTitle)}<br><span class="xs muted">${esc(o.sessionTitle)}</span></td><td>${o.qty} × ${esc(fmtMoney(o.unitPrice))}</td><td><strong>${esc(fmtMoney(o.total))}</strong></td><td>${methodLabel(o.method)}${o.demo ? ' <span class="badge badge-warn">démo</span>' : ''}</td><td><a href="#/rh/recu/${esc(o.id)}">Reçu</a></td></tr>`).join('')}</tbody></table></div>` : '<div class="card"><p class="muted">Aucune commande pour l’instant.</p></div>'}</section>
    <section class="block"><h2>Mes Pass</h2>${passes.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Personne</th><th>Poste</th><th>Statut</th><th>Tentatives</th><th>Prix</th></tr></thead><tbody>
      ${passes.map((p) => `<tr><td><strong>${esc(p.name)}</strong><br><span class="xs muted">${esc(p.email || '')}</span></td><td><a href="#/rh/session/${esc(p.session.id)}">${esc(p.session.title)}</a></td><td>${statusBadge(p.status)}</td><td>${attemptsUsed(p.attempts)} / ${CONFIG.ATTEMPTS_PER_PASS}</td><td>${p.price ? esc(fmtMoney(p.price)) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card"><p class="muted">Aucun Pass.</p></div>'}</section></div>`;
}

export async function receipt(ctx, root) {
  const o = await ctx.store.getOrder(ctx.params.id);
  const company = o && (await ctx.store.getCompany(ctx.user.companyId));
  if (!o || o.companyId !== ctx.user.companyId) { (await import('./notfound.js')).default(ctx, root); return; }
  ctx.setTitle(`Reçu ${o.number}`);
  root.innerHTML = `<div class="container-narrow page"><div class="no-print btn-row" style="margin-bottom:var(--sp-4)"><a class="back-link" href="#/rh/facturation">${icon('arrow', 16, 'flip')} Retour à la facturation</a><button type="button" class="btn btn-primary" id="print">${icon('print', 18)} Imprimer / PDF</button></div>
    <article class="card receipt"><header class="split"><img src="assets/logo/mouress-logo-horizontal-couleur-pour-fond-clair.svg" alt="MOURESS" height="32" style="height:32px"><div class="right"><strong>Reçu n° ${esc(o.number)}</strong><br><span class="small muted">${fmtDate(o.date, true)}</span></div></header>
      ${o.demo ? '<p class="demo-banner"><strong>Reçu de démonstration</strong> — paiement simulé, aucune somme n’a été débitée.</p>' : ''}
      <p><span class="muted small">Client</span><br><strong>${esc(company.name)}</strong></p>
      <table class="table" style="min-width:0"><thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>
        <tr><td>Pass MOURESS Training — ${esc(o.profileName || o.sessionTitle)}<br><span class="xs muted">${esc(o.sessionTitle)} · formation, entraînement illimité, examen (${CONFIG.ATTEMPTS_PER_PASS} tentatives), attestation si réussite</span></td><td>${o.qty}</td><td>${esc(fmtMoney(o.unitPrice))}</td><td><strong>${esc(fmtMoney(o.total))}</strong></td></tr></tbody></table>
      <p class="right"><strong>Total payé : ${esc(fmtMoney(o.total))}</strong><br><span class="xs muted">Mode : ${methodLabel(o.method)} · réf. ${esc(o.ref)}</span></p>
      <p class="xs muted">MOURESS SAS — ${esc(CONFIG.CONTACT.address)} — ${esc(CONFIG.CONTACT.phone)}. Prix provisoires. Document simple, ne tient pas lieu de facture fiscale.</p></article></div>`;
  root.querySelector('#print').addEventListener('click', () => window.print());
}
