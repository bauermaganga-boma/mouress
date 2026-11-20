// Tableau de bord de l'espace entreprise : deux suivis distincts, « Recrutements » et « Mes équipes ».
import { getProfilesData } from '../data.js';
import { esc, fmtDate } from '../util.js';
import { icon, badge } from '../ui.js';
import { assignmentTitle } from '../skills.js';
import { dueState } from '../skills.js';
import { recruitListHTML, recruitCounts } from './rh-recruit.js';
import { renderTeamTab } from './rh-teams.js';
import { renderFormationsTab } from './rh-formations.js';
import { renderPilotage } from './rh-pilotage.js';
import { sectorList, sectorById, sectorProfiles } from '../sector.js';
import { withOrg, ensureDemoOrg } from '../parcours.js';

/** Premier écran du back-office : l'entreprise choisit son secteur d'activité ; ses postes et formations restent ensuite dans ce secteur. */
function sectorChooser(ctx, root, data, company, current) {
  const list = sectorList(data);
  root.innerHTML = `<div class="container page"><div class="page-head"><p class="eyebrow dark">Espace entreprise</p><h1 class="page-title">${esc(company.name)}</h1>
    <p class="lead">${current ? 'Changez de secteur d’activité.' : 'Commencez par choisir votre secteur d’activité.'} Les postes et les formations proposés resteront dans ce secteur.</p></div>
    <div class="grid grid-2 sector-pick">${list.map((s) => `<button type="button" class="card card-link funnel-card sector-card ${s.id === current ? 'is-on' : ''}" data-sector="${esc(s.id)}"><span class="funnel-ico">${icon(s.icon || 'factory', 28)}</span><span class="funnel-body"><strong class="funnel-title">${esc(s.name)}</strong>${s.desc ? `<span class="muted small">${esc(s.desc)}</span>` : ''}<span class="funnel-meta">${badge(`${sectorProfiles(data, s.id).length} postes`)}${s.id === current ? badge('Secteur actuel', 'ok') : ''}</span></span><span class="funnel-go">${icon('arrow', 22)}</span></button>`).join('')}</div>
    ${current ? '<p><a class="btn btn-light" href="#/rh">Annuler</a></p>' : ''}</div>`;
  root.querySelectorAll('[data-sector]').forEach((b) => b.addEventListener('click', async () => { await ctx.store.setCompanySector(company.id, b.dataset.sector); ctx.toast('Secteur enregistré.'); ctx.go('/rh'); await dashboard(ctx, root); }));
}

export async function dashboard(ctx, root) {
  ctx.setTitle('Tableau de bord entreprise');
  const data = await getProfilesData();
  const company = await ctx.store.getCompany(ctx.user.companyId);
  const sessions = await ctx.store.listSessions(company.id);
  let employees = await ctx.store.listEmployees(company.id);
  await ensureDemoOrg(ctx, company, employees);
  employees = await withOrg(ctx, await ctx.store.listEmployees(company.id));
  const sector = await ctx.store.getCompanySector(company.id);
  if (!ctx.alive()) return;
  if (!sector || ctx.query.get('secteur') === 'choisir') { sectorChooser(ctx, root, data, company, sector); return; }
  const sec = sectorById(data, sector);
  const vue = ['recrutements', 'equipes', 'formations'].includes(ctx.query.get('vue')) ? ctx.query.get('vue') : 'pilotage';
  const nbFormations = (await ctx.store.listFormations(company.id)).length;
  const recruits = sessions.filter((s) => s.type === 'recruitment');
  const trainings = sessions.filter((s) => s.type === 'training');
  const openCount = recruits.filter((s) => s.status !== 'closed').length;
  const counts = recruits.map(recruitCounts);
  const sum = (k) => counts.reduce((a, c) => a + c[k], 0);

  root.innerHTML = `<div class="container page">
    <div class="page-head split"><div><p class="eyebrow dark">Espace entreprise</p><h1 class="page-title">${esc(company.name)}</h1><p class="sector-line">${icon('factory', 16)} Secteur : <strong>${esc(sec?.name || sector)}</strong> · <a href="#/rh?secteur=choisir">Changer</a></p></div>
      <div class="btn-row">${vue === 'formations' ? `<a class="btn btn-primary" href="#/rh?vue=formations&nouvelle=1">${icon('plus', 18)} Nouvelle formation</a>` : `<a class="btn btn-primary" href="#/rh/inviter${vue === 'equipes' ? '?type=training' : '?type=recruitment'}">${icon('plus', 18)} ${vue === 'equipes' ? 'Inviter un collaborateur' : 'Nouveau recrutement'}</a>`}<a class="btn btn-outline" href="#/rh/facturation">${icon('card', 18)} Facturation / Mes Pass</a></div></div>
    ${company.demo ? '<div class="alert alert-warn"><strong>Entreprise Démo</strong> — données fictives, stockées dans ce navigateur.</div>' : ''}
    <div class="seg seg-4" role="tablist" aria-label="Type de suivi">
      <a role="tab" class="seg-tab" href="#/rh" aria-selected="${vue === 'pilotage'}">${icon('chart', 20)}<span><strong>Pilotage</strong><span class="xs">indicateurs</span></span></a>
      <a role="tab" class="seg-tab" href="#/rh?vue=recrutements" aria-selected="${vue === 'recrutements'}">${icon('users', 20)}<span><strong>Recrutements</strong><span class="xs">${openCount} ouvert${openCount > 1 ? 's' : ''}</span></span></a>
      <a role="tab" class="seg-tab" href="#/rh?vue=equipes" aria-selected="${vue === 'equipes'}">${icon('building', 20)}<span><strong>Mes équipes</strong><span class="xs">${employees.length} collaborateur${employees.length > 1 ? 's' : ''}</span></span></a>
      <a role="tab" class="seg-tab" href="#/rh?vue=formations" aria-selected="${vue === 'formations'}">${icon('book', 20)}<span><strong>Mes formations</strong><span class="xs">${nbFormations} au catalogue</span></span></a></div>
    <div id="tab-body" role="tabpanel"></div></div>`;
  const host = root.querySelector('#tab-body');

  if (vue === 'pilotage') {
    await renderPilotage(ctx, host, company, data, sessions, employees, { sector });
    return;
  }

  if (vue === 'recrutements') {
    host.innerHTML = `<div class="grid grid-4 stats">
        <div class="card stat"><span class="stat-n">${openCount}</span><span class="muted small">recrutement${openCount > 1 ? 's' : ''} ouvert${openCount > 1 ? 's' : ''}</span></div>
        <div class="card stat"><span class="stat-n">${sum('invited')}</span><span class="muted small">candidats invités</span></div>
        <div class="card stat"><span class="stat-n">${sum('done')}</span><span class="muted small">examens passés · ${sum('passed')} réussi(s)</span></div>
        <div class="card stat"><span class="stat-n">${sum('hired')}</span><span class="muted small">retenu(s)</span></div></div>
      <section class="block"><div class="split"><h2>Postes qui recrutent</h2></div>${recruitListHTML(sessions, data)}</section>`;
    return;
  }

  if (vue === 'formations') {
    await renderFormationsTab(ctx, host, company, () => dashboard(ctx, root), { sector });
    if (ctx.query.get('nouvelle')) { const d = host.querySelector('#new-formation'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }
    return;
  }

  await renderTeamTab(ctx, host, company, data, trainings, () => dashboard(ctx, root), { sector, employees });
  if (!ctx.alive()) return;

  // échéances d'assignations des sessions de montée en compétences (cours / séries d'entraînement)
  const assignments = [];
  for (const s of trainings) for (const a of await ctx.store.listAssignments(s.id)) assignments.push({ ...a, session: s, inv: s.invitations.find((i) => i.id === a.invitationId) });
  const pending = assignments.filter((a) => !a.doneAt).map((a) => ({ ...a, st: dueState(a) })).sort((a, b) => a.due - b.due);
  if (pending.length && ctx.alive()) {
    host.insertAdjacentHTML('beforeend', `<section class="block"><h2>Échéances des sessions d’équipe</h2><div class="card"><ul class="due-list">${pending.slice(0, 6).map((a) => `<li>${badge(a.st.label, a.st.tone)}
      <span><strong>${esc(a.inv?.name || '—')}</strong> — ${esc(assignmentTitle(a, null))}<br><span class="xs muted">${esc(a.session.title)} · avant le ${fmtDate(a.due)}</span></span>
      <a class="btn btn-light btn-sm" href="#/rh/session/${esc(a.session.id)}?tab=gaps">Suivre</a></li>`).join('')}</ul></div></section>`);
  }
}
