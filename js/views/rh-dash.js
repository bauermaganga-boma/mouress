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
import { whereIs } from '../presence.js';
import { renderPresence } from './rh-presence.js';

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
  const vue = ['recrutements', 'equipes', 'formations', 'presence'].includes(ctx.query.get('vue')) ? ctx.query.get('vue') : 'pilotage';
  const allEmployees = employees;
  // Espace : « Global » ou une base de rattachement (comme le sélecteur de sites d'un espace multi-sites)
  const bases = [...new Set(allEmployees.map((e) => e.base).filter(Boolean))].sort();
  let espace = ctx.query.has('espace') ? ctx.query.get('espace') : '';
  try { if (!ctx.query.has('espace')) espace = localStorage.getItem('mrs.rh.espace') || ''; else localStorage.setItem('mrs.rh.espace', espace); } catch { /* ignore */ }
  if (espace && !bases.includes(espace)) espace = '';
  if (espace) employees = allEmployees.filter((e) => e.base === espace);
  const nbFormations = (await ctx.store.listFormations(company.id)).length;
  const recruits = sessions.filter((s) => s.type === 'recruitment');
  const trainings = sessions.filter((s) => s.type === 'training');
  const openCount = recruits.filter((s) => s.status !== 'closed').length;
  const counts = recruits.map(recruitCounts);
  const sum = (k) => counts.reduce((a, c) => a + c[k], 0);
  const nowPos = allEmployees.map((e) => whereIs(e));
  const offshoreNow = nowPos.filter((w) => w.lieu === 'offshore').length;
  const TITLES = { pilotage: 'Tableau de bord', presence: 'Présence et rotations', equipes: 'Collaborateurs', formations: 'Parcours et formations', recrutements: 'Recrutements' };
  const link = (v) => (v === 'pilotage' ? '#/rh' : '#/rh?vue=' + v);
  const nav = (v, ico, label, count) => `<a class="rh-nav ${vue === v ? 'on' : ''}" href="${link(v)}" ${vue === v ? 'aria-current="page"' : ''}>${icon(ico, 18)}<span>${label}</span>${count != null ? `<em>${count}</em>` : ''}</a>`;
  const espaceSwitch = bases.length ? `<div class="espace-switch" role="group" aria-label="Espace"><span class="role-lead">Espace</span><a class="role-tab" href="#/rh?${vue === 'pilotage' ? '' : 'vue=' + vue + '&'}espace=" aria-current="${!espace}">Global</a>${bases.map((bs) => `<a class="role-tab" href="#/rh?${vue === 'pilotage' ? '' : 'vue=' + vue + '&'}espace=${encodeURIComponent(bs)}" aria-current="${espace === bs}">${esc(bs)}</a>`).join('')}</div>` : '';

  root.innerHTML = `<div class="container page rh-shell">
    <aside class="rh-side" aria-label="Navigation de l’espace entreprise">
      <div class="rh-side-head"><strong>${esc(company.name)}</strong><span class="xs">${icon('factory', 14)} ${esc(sec?.name || sector)} · <a href="#/rh?secteur=choisir">Changer</a></span></div>
      <p class="rh-side-label">Pilotage</p>
      ${nav('pilotage', 'chart', 'Tableau de bord')}
      ${nav('presence', 'pin', 'Présence et rotations', offshoreNow ? offshoreNow + ' offshore' : null)}
      <p class="rh-side-label">Équipes</p>
      ${nav('equipes', 'users', 'Collaborateurs', allEmployees.length)}
      ${nav('formations', 'book', 'Parcours et formations', nbFormations)}
      <p class="rh-side-label">Recrutement</p>
      ${nav('recrutements', 'briefcase', 'Recrutements', openCount)}
      <p class="rh-side-label">Administration</p>
      <a class="rh-nav" href="#/rh/facturation">${icon('card', 18)}<span>Facturation et Pass</span></a>
    </aside>
    <div class="rh-main">
      <div class="page-head split"><div><p class="eyebrow dark">${esc(company.name)}</p><h1 class="page-title">${TITLES[vue]}</h1></div>
        <div class="btn-row">${vue === 'formations' ? `<a class="btn btn-primary" href="#/rh?vue=formations&nouvelle=1">${icon('plus', 18)} Nouvelle formation</a>` : vue === 'equipes' || vue === 'presence' ? `<a class="btn btn-primary" href="#/rh/inviter?type=training">${icon('plus', 18)} Inviter un collaborateur</a>` : `<a class="btn btn-primary" href="#/rh/inviter?type=recruitment">${icon('plus', 18)} Nouveau recrutement</a>`}</div></div>
      ${espaceSwitch}
      ${company.demo ? '<div class="alert alert-warn"><strong>Entreprise Démo</strong> — données fictives, stockées dans ce navigateur.</div>' : ''}
      <div class="seg seg-5 rh-seg" role="tablist" aria-label="Sections">
        <a role="tab" class="seg-tab" href="${link('pilotage')}" aria-selected="${vue === 'pilotage'}">${icon('chart', 20)}<span><strong>Tableau</strong></span></a>
        <a role="tab" class="seg-tab" href="${link('presence')}" aria-selected="${vue === 'presence'}">${icon('pin', 20)}<span><strong>Présence</strong></span></a>
        <a role="tab" class="seg-tab" href="${link('equipes')}" aria-selected="${vue === 'equipes'}">${icon('users', 20)}<span><strong>Équipes</strong></span></a>
        <a role="tab" class="seg-tab" href="${link('formations')}" aria-selected="${vue === 'formations'}">${icon('book', 20)}<span><strong>Formations</strong></span></a>
        <a role="tab" class="seg-tab" href="${link('recrutements')}" aria-selected="${vue === 'recrutements'}">${icon('briefcase', 20)}<span><strong>Recrut.</strong></span></a></div>
      <div id="tab-body" role="tabpanel"></div></div></div>`;
  const host = root.querySelector('#tab-body');

  if (vue === 'pilotage') {
    await renderPilotage(ctx, host, company, data, sessions, employees, { sector, espace });
    return;
  }

  if (vue === 'presence') {
    await renderPresence(ctx, host, company, data, employees, { sector });
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
