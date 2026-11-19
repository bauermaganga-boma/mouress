// Mes équipes : annuaire des collaborateurs (conformité), alertes, import CSV, fiche collaborateur et plan de formation.
import { CONFIG } from '../../config.js';
import { getProfilesData, levelOf, loadContent } from '../data.js';
import { esc, fmtDate, fmtDateInput, fmtMoney, absUrl, downloadFile, toCsv, isEmail, pct } from '../util.js';
import { icon, badge, bar, pageHead, crumbs, whatsappLink, avatar } from '../ui.js';
import { COMPLIANCE, habilitations, compliance, passPrice, validity } from '../pass.js';
import { band, BAND_LABEL, collabStats, matrixThemes, gaps, recommend } from '../skills.js';
import { employeeFormations } from './rh-formations.js';

const DAY = 86400000;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const PRIORITY = { haute: 'Haute', normale: 'Normale', basse: 'Basse' };
export const REASON = { recyclage: 'Recyclage', montee: 'Montée en compétences', obligation: 'Obligation' };
const PLAN_LABEL = { planned: { label: 'Planifiée', tone: 'info' }, in_progress: { label: 'En cours', tone: 'warn' }, done: { label: 'Faite', tone: 'ok' } };
const planBadge = (p) => (p.status !== 'done' && p.late ? badge('En retard', 'ko') : badge(PLAN_LABEL[p.status].label, PLAN_LABEL[p.status].tone));
const pill = (st) => badge(COMPLIANCE[st].label, COMPLIANCE[st].tone);

export function profileOptions(data, selected = '') {
  return (data.levels || []).map((lv) => {
    const ps = data.profiles.filter((p) => p.level === lv.id);
    return ps.length ? `<optgroup label="${esc(lv.name)}">${ps.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}

const validityText = (v) => (v.status === 'expired' ? `Expirée depuis ${Math.max(1, -v.days)} j` : v.status === 'soon' ? `Expire dans ${Math.max(0, v.days)} j` : `Valide (${v.days} j restants)`);
const validityBadge = (v) => badge(validityText(v), v.status === 'expired' ? 'ko' : v.status === 'soon' ? 'warn' : 'ok');

/** Données de l'annuaire : collaborateurs, habilitations (attestations par e-mail), plan, conformité. */
export async function loadTeam(ctx, company, data) {
  const [employees, plans] = await Promise.all([ctx.store.listEmployees(company.id), ctx.store.listPlan(company.id)]);
  const pById = new Map(data.profiles.map((p) => [p.id, p]));
  const rows = [];
  for (const e of employees) {
    const certs = await ctx.store.listCertificatesByEmail(e.email);
    const habs = habilitations(certs, pById);
    const myPlans = plans.filter((p) => p.employeeId === e.id);
    rows.push({ e, habs, plans: myPlans, status: compliance(habs, myPlans) });
  }
  rows.sort((a, b) => a.e.name.localeCompare(b.e.name));
  return { rows, plans, pById };
}

function teamAlerts(rows, pById) {
  const out = [];
  for (const r of rows) {
    for (const h of r.habs) if (h.v.status !== 'valid') out.push({ r, kind: 'cert', tone: h.v.status === 'expired' ? 'ko' : 'warn', until: h.v.until, text: `${h.profile?.name || h.cert.profileId} : ${validityText(h.v).toLowerCase()}` });
    for (const p of r.plans) if (p.late) out.push({ r, kind: 'plan', tone: 'ko', until: p.due, text: `Plan en retard : ${pById.get(p.profileId)?.name || p.profileId} (échéance ${fmtDate(p.due)})` });
  }
  return out.sort((a, b) => a.until - b.until);
}

/** « nom;email;poste;équipe;date d'embauche » (séparateur ; ou ,). La première ligne d'en-tête est ignorée. */
export function parseEmployeeCsv(text, data) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const list = []; const warnings = [];
  const matchProfile = (v) => {
    const k = norm(v); if (!k) return '';
    const p = data.profiles.find((x) => x.id === v.trim()) || data.profiles.find((x) => norm(x.name) === k) || data.profiles.find((x) => norm(x.name).includes(k));
    return p?.id || '';
  };
  const parseDate = (v) => {
    const m = String(v || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/) || String(v || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const d = m[1].length === 4 ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d) ? null : d.getTime();
  };
  lines.forEach((line, i) => {
    const sep = line.includes(';') ? ';' : ',';
    const c = line.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
    if (i === 0 && /e-?mail|mail/i.test(line) && !isEmail(c[1])) return;
    if (!isEmail(c[1])) { warnings.push(`Ligne ${i + 1} ignorée : e-mail invalide.`); return; }
    const profileId = matchProfile(c[2] || '');
    if (c[2] && !profileId) warnings.push(`Ligne ${i + 1} : poste « ${c[2]} » non reconnu (laissé vide).`);
    list.push({ name: c[0] || c[1].split('@')[0], email: c[1], profileId, team: c[3] || '', hireDate: parseDate(c[4]) });
  });
  return { list, warnings };
}

/* ------------------------------------------------------------------ Onglet « Mes équipes » */
export async function renderTeamTab(ctx, host, company, data, trainingSessions, redraw) {
  const { rows, plans, pById } = await loadTeam(ctx, company, data);
  if (!ctx.alive()) return;
  const count = (st) => rows.filter((r) => r.status === st).length;
  const alerts = teamAlerts(rows, pById);
  const teams = [...new Set(rows.map((r) => r.e.team).filter(Boolean))].sort();
  const usedProfiles = [...new Set(rows.map((r) => r.e.profileId).filter(Boolean))];
  const f = { q: '', team: '', profile: '', status: '' };

  host.innerHTML = `
    <div class="grid grid-4 stats">
      <div class="card stat"><span class="stat-n">${rows.length}</span><span class="muted small">collaborateurs</span></div>
      <div class="card stat"><span class="stat-n">${count('valid')}</span><span class="muted small">habilitations valides</span></div>
      <div class="card stat"><span class="stat-n">${count('soon')}</span><span class="muted small">expirent sous ${CONFIG.ALERT_DAYS} j</span></div>
      <div class="card stat"><span class="stat-n">${count('expired')}</span><span class="muted small">expirées · ${plans.filter((p) => p.late).length} plan(s) en retard</span></div></div>
    ${alerts.length ? `<section class="block"><h2>Alertes</h2><div class="card"><ul class="due-list">${alerts.slice(0, 8).map((a) => `<li>${badge(a.kind === 'cert' ? 'Habilitation' : 'Échéance', a.tone)}<span><strong>${esc(a.r.e.name)}</strong><br><span class="xs muted">${esc(a.text)}</span></span><a class="btn btn-light btn-sm" href="#/rh/equipe/${esc(a.r.e.id)}">Voir la fiche</a></li>`).join('')}</ul>${alerts.length > 8 ? `<p class="xs muted">+ ${alerts.length - 8} autre(s) alerte(s) dans les fiches.</p>` : ''}</div></section>` : ''}
    <section class="block"><div class="split"><h2>Annuaire des collaborateurs</h2><div class="btn-row">
      <button type="button" class="btn btn-sm btn-light" id="csv-dir">${icon('download', 14)} Export CSV</button></div></div>
      <div class="card filters-card"><div class="form-grid">
        <div class="field"><label for="d-q">Recherche</label><input id="d-q" type="search" placeholder="Nom ou e-mail" autocomplete="off"></div>
        <div class="field"><label for="d-t">Équipe / service</label><select id="d-t"><option value="">Toutes</option>${teams.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div>
        <div class="field"><label for="d-p">Profil</label><select id="d-p"><option value="">Tous</option>${usedProfiles.map((id) => `<option value="${esc(id)}">${esc(pById.get(id)?.name || id)}</option>`).join('')}</select></div>
        <div class="field"><label for="d-s">Conformité</label><select id="d-s"><option value="">Toutes</option>${Object.entries(COMPLIANCE).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div></div></div>
      <p class="muted small" id="d-count" aria-live="polite"></p><div class="stack" id="dir"></div>
      <div class="grid grid-2" style="margin-top:var(--sp-5)">
        <details class="card add-box"><summary class="btn btn-outline btn-sm">${icon('plus', 14)} Ajouter un collaborateur</summary>
          <form id="emp-form" novalidate style="margin-top:var(--sp-4)">
            <div class="field"><label for="e-name">Nom et prénom</label><input id="e-name" type="text" required></div>
            <div class="field"><label for="e-email">E-mail</label><input id="e-email" type="email" required></div>
            <div class="field"><label for="e-prof">Poste / profil</label><select id="e-prof"><option value="">— Choisir —</option>${profileOptions(data)}</select></div>
            <div class="form-grid"><div class="field"><label for="e-team">Équipe ou service</label><input id="e-team" type="text" placeholder="Ex. Maintenance"></div>
              <div class="field"><label for="e-hire">Date d’embauche (facultatif)</label><input id="e-hire" type="date"></div></div>
            <div class="field-error" id="e-err" role="alert"></div><button class="btn btn-primary" type="submit">Ajouter</button></form></details>
        <details class="card add-box"><summary class="btn btn-outline btn-sm">${icon('download', 14)} Importer un CSV</summary>
          <form id="imp-form" novalidate style="margin-top:var(--sp-4)"><p class="small muted">Une ligne par collaborateur : <code>nom;e-mail;poste;équipe;date d’embauche</code> (poste = nom ou identifiant du profil, date au format AAAA-MM-JJ ou JJ/MM/AAAA). Le poste, l’équipe et la date sont facultatifs.</p>
            <div class="field"><label for="imp-file">Fichier .csv</label><input id="imp-file" type="file" accept=".csv,text/csv,text/plain"></div>
            <div class="field"><label for="imp-text">ou collez les lignes</label><textarea id="imp-text" placeholder="Jean Mba;jean@exemple.com;Technicien électricien industriel;Maintenance;2022-03-01"></textarea></div>
            <div class="field-error" id="imp-msg" role="status"></div><button class="btn btn-primary" type="submit">Importer</button></form></details></div></section>
    ${trainingSessions.length ? `<section class="block"><h2>Sessions de montée en compétences</h2><p class="muted small">Suivi d’une équipe sur un profil : matrice de compétences, écarts et assignations.</p><div class="grid grid-2">${trainingSessions.map((s) => {
      const done = s.invitations.filter((i) => i.attempt?.status === 'done').length;
      return `<a class="card card-link sess" href="#/rh/session/${esc(s.id)}"><div class="split" style="align-items:flex-start">${badge('Montée en compétences', 'info')}<span class="xs muted">${s.deadline ? 'jusqu’au ' + fmtDate(s.deadline) : ''}</span></div><h3>${esc(s.title)}</h3><p class="muted small">${esc(pById.get(s.profileId)?.name || s.profileId)}</p><div class="sess-nums"><span><strong>${s.invitations.length}</strong> collaborateurs</span><span><strong>${done}</strong> testé(s)</span></div>${bar(pct(done, s.invitations.length))}</a>`;
    }).join('')}</div></section>` : ''}`;

  const $ = (q) => host.querySelector(q);
  const draw = () => {
    const q = norm(f.q);
    const list = rows.filter((r) => (!q || norm(`${r.e.name} ${r.e.email}`).includes(q)) && (!f.team || r.e.team === f.team) && (!f.profile || r.e.profileId === f.profile) && (!f.status || r.status === f.status));
    $('#d-count').textContent = `${list.length} collaborateur${list.length > 1 ? 's' : ''}`;
    $('#dir').innerHTML = list.map((r) => `<a class="card card-link emp-card" href="#/rh/equipe/${esc(r.e.id)}">${avatar(r.e, 52)}<div class="emp-main"><strong>${esc(r.e.name)}</strong><span class="xs muted">${esc(r.e.email)}</span>
      <span class="small">${esc(pById.get(r.e.profileId)?.name || 'Poste non renseigné')}${r.e.team ? ` · ${esc(r.e.team)}` : ''}</span></div>
      <div class="emp-side">${pill(r.status)}<span class="funnel-go sm">${icon('arrow', 18)}</span></div></a>`).join('') || '<div class="card"><p class="muted">Aucun collaborateur ne correspond. Ajoutez-en un ou importez un CSV.</p></div>';
  };
  draw();
  host.addEventListener('input', (e) => { if (e.target.id === 'd-q') { f.q = e.target.value; draw(); } });
  host.addEventListener('change', (e) => {
    if (e.target.id === 'd-t') f.team = e.target.value;
    else if (e.target.id === 'd-p') f.profile = e.target.value;
    else if (e.target.id === 'd-s') f.status = e.target.value;
    else if (e.target.id === 'imp-file') { const file = e.target.files[0]; if (file) file.text().then((t) => { $('#imp-text').value = t; }); return; } else return;
    draw();
  });
  host.addEventListener('click', (e) => {
    if (!e.target.closest('#csv-dir')) return;
    const out = [['Collaborateur', 'E-mail', 'Poste', 'Équipe', 'Date d’embauche', 'Conformité']];
    for (const r of rows) out.push([r.e.name, r.e.email, pById.get(r.e.profileId)?.name || '', r.e.team, r.e.hireDate ? fmtDate(r.e.hireDate) : '', COMPLIANCE[r.status].label]);
    downloadFile('collaborateurs.csv', toCsv(out));
  });
  $('#emp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#e-err'); err.textContent = '';
    const name = $('#e-name').value.trim(); const email = $('#e-email').value.trim();
    if (name.length < 2) { err.textContent = 'Saisissez le nom du collaborateur.'; return; }
    if (!isEmail(email)) { err.textContent = 'Adresse e-mail invalide.'; return; }
    if (rows.some((r) => r.e.email === email.toLowerCase())) { err.textContent = 'Un collaborateur existe déjà avec cet e-mail.'; return; }
    const hire = $('#e-hire').value ? new Date($('#e-hire').value + 'T00:00:00').getTime() : null;
    const emp = await ctx.store.saveEmployee({ companyId: company.id, name, email, profileId: $('#e-prof').value, team: $('#e-team').value, hireDate: hire });
    ctx.toast('Collaborateur ajouté.');
    ctx.go(`/rh/equipe/${emp.id}`);
  });
  $('#imp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { list, warnings } = parseEmployeeCsv($('#imp-text').value, data);
    const msg = $('#imp-msg');
    if (!list.length) { msg.className = 'field-error'; msg.textContent = warnings[0] || 'Aucune ligne valide à importer.'; return; }
    const r = await ctx.store.addEmployees(company.id, list.map((x) => ({ ...x, companyId: company.id })));
    ctx.toast(`${r.added} collaborateur(s) importé(s)${r.skipped ? `, ${r.skipped} ignoré(s) (déjà présents)` : ''}.`);
    await redraw();
  });
}

/* ------------------------------------------------------------------ Fiche collaborateur */
export async function employee(ctx, root) {
  const data = await getProfilesData();
  const company = await ctx.store.getCompany(ctx.user.companyId);
  const pById = new Map(data.profiles.map((p) => [p.id, p]));
  const back = '#/rh?vue=equipes';
  const notFound = async () => (await import('./notfound.js')).default(ctx, root);
  const id = ctx.params.id;

  const draw = async () => {
    const emp = await ctx.store.getEmployee(id);
    if (!emp || emp.companyId !== company.id) return notFound();
    const [certs, attempts, plans] = await Promise.all([ctx.store.listCertificatesByEmail(emp.email), ctx.store.listAttemptsByEmail(company.id, emp.email), ctx.store.listPlan(company.id, emp.id)]);
    const habs = habilitations(certs, pById).sort((a, b) => a.v.until - b.v.until);
    const st = compliance(habs, plans);
    const poste = pById.get(emp.profileId);
    ctx.setTitle(emp.name);

    // historique des examens regroupé par profil, avec matrice et écarts
    const byProfile = new Map();
    for (const a of attempts) { if (!byProfile.has(a.profileId)) byProfile.set(a.profileId, []); byProfile.get(a.profileId).push(a); }
    const histo = [];
    for (const [pid, list] of byProfile) {
      const stats = collabStats({ attempts: list });
      const g = gaps(stats, list[list.length - 1].passMark || CONFIG.PASS_MARK);
      const recs = [];
      for (const x of g.slice(0, 4)) recs.push({ ...x, rec: await recommend(pid, x.theme) });
      histo.push({ pid, list, stats, recs });
    }
    if (!ctx.alive()) return;

    const planRows = plans.map((p) => {
      const prof = pById.get(p.profileId);
      return `<tr><td><strong>${esc(prof?.name || p.profileId)}</strong>${p.fromCert ? '<br><span class="xs muted">Renouvellement</span>' : ''}</td><td>${esc(REASON[p.reason] || p.reason)}</td><td>${badge(PRIORITY[p.priority] || p.priority, p.priority === 'haute' ? 'warn' : '')}</td>
        <td class="nowrap">${fmtDate(p.due)}</td><td>${planBadge(p)}</td>
        <td><div class="btn-row" style="gap:.35rem">${p.status === 'planned' && !p.invitationId ? `<a class="btn btn-primary btn-sm" href="#/rh/inviter?plan=${esc(p.id)}">Acheter le Pass · ${esc(fmtMoney(passPrice(prof?.level)))}</a>` : ''}
          ${p.token ? `<button type="button" class="btn btn-light btn-sm" data-copy="${esc(absUrl('#/t/' + p.token))}">${icon('copy', 14)} Lien</button><a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="${esc(whatsappLink(`Bonjour ${emp.name}, voici votre Pass de formation « ${prof?.name || ''} » : ${absUrl('#/t/' + p.token)}`))}">${icon('whatsapp', 14)}</a>` : ''}
          ${p.status !== 'done' && !p.token ? `<button type="button" class="btn btn-light btn-sm" data-plan-done="${esc(p.id)}">Marquer faite</button>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-plan-del="${esc(p.id)}" aria-label="Retirer du plan">${icon('x', 14)}</button></div></td></tr>`;
    }).join('');

    root.innerHTML = `<div class="container page">
      ${pageHead({ crumbs: [{ label: 'Espace entreprise', href: '#/rh' }, { label: 'Mes équipes', href: back }, { label: emp.name }], back, eyebrow: emp.team || 'Collaborateur', title: emp.name,
        text: `${poste ? poste.name + (levelOf(data, poste.level) ? ' · ' + levelOf(data, poste.level).name : '') : 'Poste non renseigné'}${emp.hireDate ? ` · embauché le ${fmtDate(emp.hireDate)}` : ''}` })}
      <div class="emp-id">${avatar(emp, 84)}<div class="btn-row emp-head-row" style="margin:0">${pill(st)}<span class="muted small">${esc(emp.email)}</span></div></div>
      <div class="btn-row" style="margin:var(--sp-3) 0 var(--sp-5)"><details class="inline-details"><summary class="btn btn-light btn-sm">Modifier la fiche</summary>
        <form id="emp-edit" class="card" novalidate style="margin-top:var(--sp-3)"><div class="form-grid">
          <div class="photo-field">${avatar(emp, 56)}<label class="btn btn-light btn-sm" for="x-photo">Changer la photo</label><input id="x-photo" type="file" accept="image/*" hidden>${emp.photo ? '<button type="button" class="btn btn-ghost btn-sm" id="x-photo-del">Retirer la photo</button>' : ''}</div>
          <div class="field"><label for="x-name">Nom</label><input id="x-name" type="text" value="${esc(emp.name)}"></div>
          <div class="field"><label for="x-email">E-mail</label><input id="x-email" type="email" value="${esc(emp.email)}"></div>
          <div class="field"><label for="x-prof">Poste / profil</label><select id="x-prof"><option value="">— Aucun —</option>${profileOptions(data, emp.profileId)}</select></div>
          <div class="field"><label for="x-team">Équipe ou service</label><input id="x-team" type="text" value="${esc(emp.team)}"></div>
          <div class="field"><label for="x-hire">Date d’embauche</label><input id="x-hire" type="date" value="${emp.hireDate ? fmtDateInput(emp.hireDate) : ''}"></div></div>
          <div class="field-error" id="x-err" role="alert"></div><div class="btn-row"><button class="btn btn-primary" type="submit">Enregistrer</button><button type="button" class="btn btn-danger btn-sm" id="emp-del">Supprimer le collaborateur</button></div></form></details></div>

      <section class="block"><h2>Formations et habilitations</h2>
        ${habs.length ? `<div class="table-wrap"><table class="table"><caption class="sr-only">Formations et habilitations</caption><thead><tr><th>Formation</th><th>Obtention</th><th>Validité</th><th>Expiration</th><th>Statut</th><th></th></tr></thead><tbody>
          ${habs.map((h) => {
            const active = plans.find((p) => p.profileId === h.cert.profileId && p.status !== 'done');
            return `<tr class="hab-${h.v.status}"><td><strong>${esc(h.profile?.name || h.cert.profileName || h.cert.profileId)}</strong><br><a class="xs" href="#/attestation/${esc(h.cert.code)}">${esc(h.cert.code)}</a></td><td class="nowrap">${fmtDate(h.cert.date)}</td><td>${h.v.months} mois</td><td class="nowrap">${fmtDate(h.v.until)}</td><td>${validityBadge(h.v)}</td>
              <td>${h.v.status === 'valid' ? '' : active ? '<span class="xs muted">Déjà au plan</span>' : `<button type="button" class="btn btn-primary btn-sm" data-renew="${esc(h.cert.code)}" data-profile="${esc(h.cert.profileId)}" data-until="${h.v.until}">Renouveler</button>`}</td></tr>`;
          }).join('')}</tbody></table></div><p class="xs muted">Durée de validité par défaut : ${CONFIG.VALIDITY_MONTHS_DEFAULT} mois (provisoire), ou durée propre au profil si elle est définie.</p>`
          : '<div class="card"><p class="muted">Aucune attestation rattachée à l’e-mail de ce collaborateur. Elle apparaîtra après la réussite d’un examen avec cet e-mail.</p></div>'}</section>

      <section class="block"><div class="split"><h2>Plan de formation</h2><button type="button" class="btn btn-navy btn-sm" id="csv-plan">${icon('download', 14)} Export CSV</button></div>
        ${plans.length ? `<div class="table-wrap"><table class="table"><caption class="sr-only">Plan de formation</caption><thead><tr><th>Formation</th><th>Motif</th><th>Priorité</th><th>Échéance</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${planRows}</tbody></table></div>` : '<div class="card"><p class="muted">Aucune formation planifiée.</p></div>'}
        <details class="card add-box" style="margin-top:var(--sp-4)"><summary class="btn btn-outline btn-sm">${icon('plus', 14)} Ajouter au plan</summary>
          <form id="plan-form" novalidate style="margin-top:var(--sp-4)"><div class="field"><label for="pl-prof">Formation (profil)</label><select id="pl-prof">${profileOptions(data, emp.profileId)}</select></div>
            <div class="form-grid"><div class="field"><label for="pl-due">Échéance</label><input id="pl-due" type="date" value="${fmtDateInput(Date.now() + 60 * DAY)}"></div>
              <div class="field"><label for="pl-reason">Motif</label><select id="pl-reason">${Object.entries(REASON).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
              <div class="field"><label for="pl-prio">Priorité</label><select id="pl-prio">${Object.entries(PRIORITY).map(([k, v]) => `<option value="${k}" ${k === 'normale' ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div></div>
            <div class="field-error" id="pl-err" role="alert"></div><button class="btn btn-primary" type="submit">Ajouter au plan</button></form></details>
        <p class="xs muted" style="margin-top:var(--sp-3)">Une formation planifiée devient active quand vous achetez le Pass correspondant (prix selon le niveau du poste) : le collaborateur reçoit alors son lien.</p></section>

      ${await employeeFormations(ctx, company, emp)}

      <section class="block"><h2>Historique des examens et compétences</h2>
        ${histo.length ? histo.map((h) => {
          const themes = matrixThemes([{ attempts: h.list }]);
          const pm = h.list[h.list.length - 1].passMark || CONFIG.PASS_MARK;
          const cell = (p, d) => `<td class="mx mx-${band(p, pm)}">${p == null ? '—' : `<strong>${p} %</strong>`}<span class="sr-only"> ${BAND_LABEL[band(p, pm)]}</span>${d != null ? `<span class="mx-d ${d >= 0 ? 'up' : 'down'}">${d > 0 ? '▲' : d < 0 ? '▼' : '='}${d ? (d > 0 ? '+' : '') + d : ''}</span>` : ''}</td>`;
          return `<article class="card histo"><h3>${esc(pById.get(h.pid)?.name || h.pid)}</h3>
            <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Score</th><th>Résultat</th><th></th></tr></thead><tbody>${h.list.map((a) => `<tr><td class="nowrap">${fmtDate(a.finishedAt)}</td><td><strong>${a.percent} %</strong></td><td>${badge(a.passed ? 'Réussi' : 'Non réussi', a.passed ? 'ok' : 'ko')}</td><td>${a.synthetic ? '' : `<a href="#/resultat/${esc(a.id)}">Détail</a>`}</td></tr>`).join('')}</tbody></table></div>
            <h4 style="margin-top:var(--sp-4)">Matrice par thème</h4><div class="table-wrap"><table class="table matrix"><thead><tr><th></th>${themes.map((t) => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>
              <tr><th>Dernier test</th>${themes.map((t) => cell(h.stats.themesLast[t] ?? null, h.stats.delta[t] ?? null)).join('')}</tr>
              ${h.list.length > 1 ? `<tr><th>1<span class="xs">er</span> test</th>${themes.map((t) => cell(h.stats.themesFirst[t] ?? null, null)).join('')}</tr>` : ''}</tbody></table></div>
            ${h.recs.length ? `<h4 style="margin-top:var(--sp-4)">Écarts à combler</h4><ul class="rec-list">${h.recs.map((g) => `<li class="rec"><div class="split"><strong>${esc(g.theme)}</strong>${badge(g.pct + ' %', g.pct < 50 ? 'ko' : 'warn')}</div><ul class="rec-items">${g.rec.modules.map((m) => `<li><a href="#/cours/${esc(h.pid)}/${esc(m.id)}">${icon('book', 14)} ${esc(m.title)}</a></li>`).join('')}<li><a href="#/entrainement/${esc(h.pid)}?theme=${encodeURIComponent(g.theme)}">${icon('target', 14)} Série d’entraînement « ${esc(g.theme)} »</a></li></ul></li>`).join('')}</ul>
              <button type="button" class="btn btn-outline btn-sm" data-plan-profile="${esc(h.pid)}">Planifier un recyclage de ce profil</button>` : '<p class="small muted">Tous les thèmes atteignent le seuil.</p>'}</article>`;
        }).join('') : '<div class="card"><p class="muted">Aucun examen passé avec cet e-mail dans vos sessions.</p></div>'}</section></div>`;

    // données utiles aux gestionnaires
    root._ctxData = { emp, plans, pById };
  };

  await draw();
  if (!ctx.alive()) return;

  const setPhoto = async (photo) => { const { emp } = root._ctxData; await ctx.store.saveEmployee({ ...emp, photo }); ctx.toast(photo ? 'Photo enregistrée.' : 'Photo retirée.'); await draw(); };
  root.addEventListener('change', (ev) => {
    if (ev.target.id !== 'x-photo') return;
    const file = ev.target.files?.[0]; if (!file || !file.type.startsWith('image/')) return;
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const S = 240, c = document.createElement('canvas'); c.width = c.height = S; const k = Math.max(S / img.width, S / img.height); const w = img.width * k, h = img.height * k; c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h); URL.revokeObjectURL(url); setPhoto(c.toDataURL('image/jpeg', 0.82)); };
    img.onerror = () => URL.revokeObjectURL(url); img.src = url;
  });
  root.addEventListener('click', (ev) => { if (ev.target.closest('#x-photo-del')) setPhoto(''); });

  root.addEventListener('submit', async (e) => {
    const { emp } = root._ctxData;
    if (e.target.id === 'emp-rec-form') {
      e.preventDefault();
      await ctx.store.saveFormationRecord({ companyId: company.id, formationId: root.querySelector('#er-f').value, employeeId: emp.id, status: 'planned', date: Date.now() });
      ctx.toast('Inscrit à la formation.'); await draw(); return;
    }
    if (e.target.id === 'emp-edit') {
      e.preventDefault();
      const name = root.querySelector('#x-name').value.trim(); const email = root.querySelector('#x-email').value.trim();
      const err = root.querySelector('#x-err');
      if (name.length < 2 || !isEmail(email)) { err.textContent = 'Nom et e-mail valides requis.'; return; }
      const hire = root.querySelector('#x-hire').value ? new Date(root.querySelector('#x-hire').value + 'T00:00:00').getTime() : null;
      await ctx.store.saveEmployee({ ...emp, name, email, profileId: root.querySelector('#x-prof').value, team: root.querySelector('#x-team').value, hireDate: hire });
      ctx.toast('Fiche enregistrée.'); await draw();
    } else if (e.target.id === 'plan-form') {
      e.preventDefault();
      const due = new Date(root.querySelector('#pl-due').value + 'T23:59:59').getTime();
      if (!due) { root.querySelector('#pl-err').textContent = 'Choisissez une échéance.'; return; }
      await ctx.store.addPlanItem({ employeeId: emp.id, profileId: root.querySelector('#pl-prof').value, due, reason: root.querySelector('#pl-reason').value, priority: root.querySelector('#pl-prio').value });
      ctx.toast('Ajouté au plan de formation.'); await draw();
    }
  });
  root.addEventListener('click', async (e) => {
    const { emp, plans, pById: pb } = root._ctxData;
    const recDel = e.target.closest('[data-emp-rec-del]');
    if (recDel) { await ctx.store.deleteFormationRecord(recDel.dataset.empRecDel); ctx.toast('Formation retirée de la fiche.'); await draw(); return; }
    const copy = e.target.closest('[data-copy]');
    if (copy) { const { copyText } = await import('../util.js'); ctx.toast((await copyText(copy.dataset.copy)) ? 'Lien copié.' : 'Copie impossible.'); return; }
    const renew = e.target.closest('[data-renew]');
    if (renew) {
      const until = Number(renew.dataset.until);
      await ctx.store.addPlanItem({ employeeId: emp.id, profileId: renew.dataset.profile, due: Math.max(until, Date.now() + 30 * DAY), reason: 'recyclage', priority: 'haute', fromCert: renew.dataset.renew });
      ctx.toast('Renouvellement ajouté au plan.'); await draw(); return;
    }
    const pp = e.target.closest('[data-plan-profile]');
    if (pp) {
      await ctx.store.addPlanItem({ employeeId: emp.id, profileId: pp.dataset.planProfile, due: Date.now() + 60 * DAY, reason: 'recyclage', priority: 'normale' });
      ctx.toast('Recyclage ajouté au plan.'); await draw(); return;
    }
    const done = e.target.closest('[data-plan-done]');
    if (done) { await ctx.store.updatePlanItem(done.dataset.planDone, { status: 'done', doneAt: Date.now() }); await draw(); return; }
    const del = e.target.closest('[data-plan-del]');
    if (del) { await ctx.store.deletePlanItem(del.dataset.planDel); await draw(); return; }
    if (e.target.closest('#emp-del')) {
      if (!window.confirm(`Supprimer ${emp.name} et son plan de formation ? Les attestations déjà délivrées ne sont pas supprimées.`)) return;
      await ctx.store.deleteEmployee(emp.id); ctx.toast('Collaborateur supprimé.'); ctx.go('/rh?vue=equipes'); return;
    }
    if (e.target.closest('#csv-plan')) {
      const out = [['Collaborateur', 'Formation', 'Motif', 'Priorité', 'Échéance', 'Statut']];
      for (const p of plans) out.push([emp.name, pb.get(p.profileId)?.name || p.profileId, REASON[p.reason] || p.reason, PRIORITY[p.priority] || p.priority, fmtDate(p.due), p.status !== 'done' && p.late ? 'En retard' : PLAN_LABEL[p.status].label]);
      downloadFile(`plan-${emp.name.replace(/\s+/g, '-').toLowerCase()}.csv`, toCsv(out));
    }
  });
}
