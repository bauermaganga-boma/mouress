// Onglet « Pilotage » du back-office : une vue par rôle (Direction générale, chef de département, chef de service, manager, RH).
// Chaque vue lit les mêmes données, filtrées sur le périmètre du rôle ; chaque indicateur porte sa définition.
import { CONFIG } from '../../config.js';
import { esc, fmtDate, fmtMoney, pct } from '../util.js';
import { icon, badge, bar, avatar } from '../ui.js';
import { loadTeam } from './rh-teams.js';
import { recruitCounts } from './rh-recruit.js';
import { buildModel, reviewState, ensureDemo, nextAction, actionHref } from '../parcours.js';

const DAY = 86400000;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const ROLES = [
  { k: 'dg', label: 'Direction générale', desc: 'Vue d’ensemble de l’entreprise : avancement, retards, risques et investissement.' },
  { k: 'dept', label: 'Chef de département', desc: 'Un département : ses services, ses postes et ses personnes.', pick: 'Département' },
  { k: 'service', label: 'Chef de service', desc: 'Un service : suivi personne par personne.', pick: 'Service' },
  { k: 'manager', label: 'Manager', desc: 'Mon équipe : prochaines étapes, revues et mises à jour.', pick: 'Manager' },
  { k: 'rh', label: 'RH', desc: 'Pilotage complet : parcours, recrutements, plans, habilitations et administration.' },
];

const tone = (v, good = 70, bad = 40) => (v >= good ? 'ok' : v < bad ? 'ko' : 'warn');
/** Indicateur : intitulé, valeur, définition en une phrase. */
const kpi = ({ label, value, def, t = '' }) => `<div class="card kpi ${t ? 'kpi-' + t : ''}"><span class="kpi-label">${label}</span><span class="kpi-val ${String(value).length > 9 ? 'long' : ''}">${value}</span><span class="kpi-def">${def}</span></div>`;

function donut(parts) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total) return '<p class="muted small">Aucune thématique : définissez le parcours d’un poste.</p>';
  let off = 25;
  const arcs = parts.map((p) => { const v = (p.n / total) * 100; const a = `<circle class="dn dn-${p.k}" cx="18" cy="18" r="15.915" fill="none" stroke-width="5" stroke-dasharray="${v} ${100 - v}" stroke-dashoffset="${off}"></circle>`; off -= v; return a; }).join('');
  const ok = parts.find((p) => p.k === 'ok')?.n || 0;
  return `<div class="donut"><svg viewBox="0 0 36 36" role="img" aria-label="Répartition des thématiques"><circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--c-surface-2)" stroke-width="5"></circle>${arcs}<text x="18" y="19.5" text-anchor="middle" class="dn-t">${pct(ok, total)} %</text></svg>
    <ul class="legend-list">${parts.map((p) => `<li><span class="lg-dot dn-bg-${p.k}"></span>${esc(p.label)} <strong>${p.n}</strong></li>`).join('')}</ul></div>`;
}
function hbars(rows, empty) {
  if (!rows.length) return `<p class="muted small">${empty}</p>`;
  return `<ul class="hbars">${rows.map((r) => `<li><div class="split"><span class="small">${r.href ? `<a href="${esc(r.href)}">${esc(r.label)}</a>` : esc(r.label)}</span><strong class="small">${r.value} %</strong></div>${bar(r.value, r.value >= 70 ? 'ok' : r.value < 40 ? 'ko' : '')}${r.sub ? `<span class="xs muted">${esc(r.sub)}</span>` : ''}</li>`).join('')}</ul>`;
}
function columns(events) {
  const now = new Date(); const buckets = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); buckets.push({ y: d.getFullYear(), m: d.getMonth(), n: 0 }); }
  for (const e of events) { const d = new Date(e.ts); const b = buckets.find((x) => x.y === d.getFullYear() && x.m === d.getMonth()); if (b) b.n++; }
  const max = Math.max(1, ...buckets.map((b) => b.n)); const W = 300; const H = 120; const bw = 34; const gap = (W - bw * 6) / 7;
  return `<svg class="cols" viewBox="0 0 ${W} ${H + 28}" role="img" aria-label="Thématiques validées par mois">${buckets.map((b, i) => {
    const h = Math.round((b.n / max) * H); const x = gap + i * (bw + gap);
    return `<rect x="${x}" y="${H - h + 4}" width="${bw}" height="${Math.max(h, 2)}" rx="5" class="col"></rect><text x="${x + bw / 2}" y="${H - h}" text-anchor="middle" class="col-n">${b.n || ''}</text><text x="${x + bw / 2}" y="${H + 20}" text-anchor="middle" class="col-l">${MONTHS[b.m]}</text>`;
  }).join('')}</svg>`;
}
const card = (title, body, foot = '') => `<section class="card pil-card"><h3>${title}</h3>${body}${foot}</section>`;

export async function renderPilotage(ctx, host, company, data, sessions, employees, opts = {}) {
  await ensureDemo(ctx, company, employees);
  const [team, model, orders] = await Promise.all([loadTeam(ctx, company, data), buildModel(ctx, company, employees), ctx.store.listOrders(company.id)]);
  if (!ctx.alive()) return;
  const now = Date.now();
  const pName = (id) => data.profiles.find((p) => p.id === id)?.name || id;
  const empById = new Map(employees.map((e) => [e.id, e]));

  // ----- rôle et périmètre
  let role = ctx.query.get('role');
  try { if (!ROLES.some((r) => r.k === role)) role = localStorage.getItem('mrs.rh.role'); } catch { /* ignore */ }
  if (!ROLES.some((r) => r.k === role)) role = 'dg';
  try { localStorage.setItem('mrs.rh.role', role); } catch { /* ignore */ }
  const R = ROLES.find((r) => r.k === role);
  const depts = [...new Set(employees.map((e) => e.dept).filter(Boolean))].sort();
  const services = [...new Set(employees.map((e) => e.team).filter(Boolean))].sort();
  const managers = employees.filter((m) => employees.some((e) => e.managerId === m.id)).sort((a, b) => a.name.localeCompare(b.name));
  const choices = role === 'dept' ? depts.map((d) => [d, d]) : role === 'service' ? services.map((s) => [s, s]) : role === 'manager' ? managers.map((m) => [m.id, m.name]) : [];
  let scope = ctx.query.get('scope');
  if (choices.length && !choices.some(([v]) => v === scope)) scope = choices[0][0];
  const emps = role === 'dept' ? employees.filter((e) => e.dept === scope) : role === 'service' ? employees.filter((e) => e.team === scope) : role === 'manager' ? employees.filter((e) => e.managerId === scope) : employees;
  const ids = new Set(emps.map((e) => e.id));
  const all = emps.map((e) => model.per.get(e.id)).filter(Boolean);
  const withP = all.filter((x) => x.total > 0);
  const rows = team.rows.filter((r) => ids.has(r.e.id));
  const plans = team.plans.filter((p) => ids.has(p.employeeId));
  const sum = (k) => all.reduce((a, x) => a + x[k], 0);
  const avgPct = withP.length ? Math.round(withP.reduce((a, x) => a + x.pct, 0) / withP.length) : null;
  const lateTh = sum('late');
  const reviewsDue = withP.filter((x) => ['late', 'soon', 'none'].includes(reviewState(x.review).key)).length;
  const habValid = rows.filter((r) => r.status === 'valid').length;
  const habSoon = rows.filter((r) => r.status === 'soon').length;
  const habExp = rows.filter((r) => r.status === 'expired').length;
  const planLate = plans.filter((p) => p.late).length;
  const recruits = sessions.filter((s) => s.type === 'recruitment');
  const rc = recruits.map(recruitCounts); const rsum = (k) => rc.reduce((a, c) => a + c[k], 0);
  const openRec = recruits.filter((s) => s.status !== 'closed').length;
  const spent = orders.reduce((a, o) => a + o.total, 0);
  const passes = sessions.reduce((a, s) => a + s.invitations.length, 0);

  // ----- regroupements
  const avgOf = (xs) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.pct, 0) / xs.length) : 0);
  const byKey = (key) => [...new Set(withP.map((x) => key(x.emp)).filter(Boolean))].map((g) => { const xs = withP.filter((x) => key(x.emp) === g); return { label: g, value: avgOf(xs), sub: `${xs.length} personne${xs.length > 1 ? 's' : ''} · ${xs.reduce((a, x) => a + x.late, 0)} en retard`, n: xs.length, late: xs.reduce((a, x) => a + x.late, 0), reviews: xs.filter((x) => ['late', 'soon', 'none'].includes(reviewState(x.review).key)).length }; }).sort((a, b) => a.value - b.value);
  const deptRows = byKey((e) => e.dept); const serviceRows = byKey((e) => e.team);
  const posteIds = [...new Set(emps.map((e) => e.profileId).filter(Boolean))];
  const posteRows = posteIds.map((pid) => { const xs = all.filter((x) => x.emp.profileId === pid); const n = (model.byProfile.get(pid) || []).length; return { label: pName(pid), href: `#/rh/poste/${pid}`, value: xs.length && n ? avgOf(xs) : 0, sub: n ? `${n} thématiques · ${xs.length} personne${xs.length > 1 ? 's' : ''}` : 'Parcours à définir' }; }).sort((a, b) => a.value - b.value);

  // ----- actions à traiter
  const todo = [];
  for (const p of plans.filter((x) => x.late)) { const e = empById.get(p.employeeId); if (e) todo.push({ w: 1, tone: 'ko', tag: 'Plan en retard', who: e.name, text: `${pName(p.profileId)} (échéance ${fmtDate(p.due)})`, href: `#/rh/equipe/${e.id}` }); }
  for (const x of all) for (const r of x.rows.filter((q) => q.late)) todo.push({ w: 2, tone: 'ko', tag: 'Échéance dépassée', who: x.emp.name, text: `« ${r.item.title} » (échéance ${fmtDate(r.due)})`, href: `#/rh/equipe/${x.emp.id}` });
  for (const r of rows) for (const h of r.habs.filter((q) => q.v.status !== 'valid')) todo.push({ w: h.v.status === 'expired' ? 1 : 3, tone: h.v.status === 'expired' ? 'ko' : 'warn', tag: h.v.status === 'expired' ? 'Habilitation expirée' : 'Habilitation à renouveler', who: r.e.name, text: h.profile?.name || h.cert.profileId, href: `#/rh/equipe/${r.e.id}` });
  for (const x of withP) { const rs = reviewState(x.review); if (rs.key !== 'ok') todo.push({ w: rs.key === 'late' ? 2 : 4, tone: rs.tone || 'info', tag: 'Revue de management', who: x.emp.name, text: rs.label, href: `#/rh/equipe/${x.emp.id}` }); }
  for (const x of all) for (const r of x.rows) if (r.status === 'en_cours' && r.date && now - r.date > 30 * DAY && !r.late) todo.push({ w: 5, tone: 'warn', tag: 'Bloqué ?', who: x.emp.name, text: `« ${r.item.title} » en cours depuis plus de 30 jours`, href: `#/rh/equipe/${x.emp.id}` });
  if (role === 'rh' || role === 'dg') {
    for (const e of emps.filter((x) => !x.profileId)) todo.push({ w: 6, tone: '', tag: 'Poste manquant', who: e.name, text: 'Renseignez son poste pour lui attribuer un parcours.', href: `#/rh/equipe/${e.id}` });
    for (const pid of posteIds.filter((id) => !(model.byProfile.get(id) || []).length)) todo.push({ w: 6, tone: 'info', tag: 'Parcours à créer', who: pName(pid), text: 'Aucune thématique définie pour ce poste.', href: `#/rh/poste/${pid}` });
  }
  todo.sort((a, b) => a.w - b.w);
  const todoMax = role === 'dg' ? 6 : 10;
  const todoHTML = `<section class="block"><div class="split"><h2>${role === 'dg' ? 'Points d’attention' : 'À traiter'}</h2>${todo.length ? badge(`${todo.length} action${todo.length > 1 ? 's' : ''}`, 'warn') : ''}</div>
    ${todo.length ? `<div class="card"><ul class="due-list">${todo.slice(0, todoMax).map((t) => `<li>${badge(t.tag, t.tone)}<span><strong>${esc(t.who)}</strong><br><span class="xs muted">${esc(t.text)}</span></span><a class="btn btn-light btn-sm" href="${esc(t.href)}">Traiter</a></li>`).join('')}</ul>${todo.length > todoMax ? `<p class="xs muted">+ ${todo.length - todoMax} autre(s) action(s).</p>` : ''}</div>`
      : '<div class="card"><p class="muted">Rien à traiter : parcours à jour, revues planifiées, habilitations valides.</p></div>'}</section>`;

  // ----- tableau de personnes
  const peopleTable = (xs) => !xs.length ? '<div class="card"><p class="muted">Aucune personne dans ce périmètre.</p></div>' : `<div class="table-wrap"><table class="table people-table"><caption class="sr-only">Personnes du périmètre</caption><thead><tr><th>Personne</th><th>Avancement</th><th>En retard</th><th>Prochaine étape</th><th>Revue</th><th></th></tr></thead><tbody>
    ${xs.map((x) => { const na = nextAction(x.rows); const rs = reviewState(x.review); const href = na ? actionHref(na, x.emp.profileId) : '';
      return `<tr><td><a class="emp-inline" href="#/rh/equipe/${esc(x.emp.id)}">${avatar(x.emp, 36)}<span><strong>${esc(x.emp.name)}</strong><br><span class="xs muted">${esc(pName(x.emp.profileId))}${x.emp.team ? ' · ' + esc(x.emp.team) : ''}</span></span></a></td>
        <td class="nowrap"><strong>${x.pct} %</strong> <span class="xs muted">${x.valide}/${x.total}</span>${bar(x.pct, x.pct >= 70 ? 'ok' : x.pct < 40 ? 'ko' : '')}</td>
        <td>${x.late ? badge(`${x.late}`, 'ko') : '<span class="muted">0</span>'}</td>
        <td class="small">${na ? `${esc(na.item.title)}${na.due ? `<br><span class="xs muted">échéance ${fmtDate(na.due)}</span>` : ''}` : '<span class="muted">Tout est validé</span>'}</td>
        <td>${badge(rs.label, rs.tone)}</td><td><a class="btn btn-light btn-sm" href="#/rh/equipe/${esc(x.emp.id)}">Suivre</a></td></tr>`; }).join('')}</tbody></table></div>`;

  // ----- indicateurs, clairs : intitulé, valeur, définition
  const K = {
    effectif: { label: 'Effectif', value: emps.length, def: `${emps.filter((e) => e.profileId).length} avec un poste défini` },
    avance: { label: 'Avancement des parcours', value: avgPct == null ? '—' : `${avgPct} %`, def: 'Part des thématiques validées, en moyenne par personne.', t: avgPct == null ? '' : tone(avgPct) },
    valid: { label: 'Thématiques validées', value: `${sum('valide')} / ${sum('total')}`, def: `${sum('en_cours')} en cours, ${sum('a_faire')} à faire.` },
    retard: { label: 'Thématiques en retard', value: lateTh, def: 'Échéance dépassée et non validées.', t: lateTh ? 'ko' : 'ok' },
    revues: { label: 'Revues à faire', value: reviewsDue, def: 'En retard, sous 14 jours ou jamais planifiées.', t: reviewsDue ? 'warn' : 'ok' },
    conf: { label: 'Conformité', value: `${pct(habValid, emps.length)} %`, def: `Personnes avec toutes leurs habilitations valides. ${habSoon} expirent sous ${CONFIG.ALERT_DAYS} j.`, t: tone(pct(habValid, emps.length), 80, 50) },
    renew: { label: 'Habilitations à renouveler', value: habSoon + habExp, def: `${habExp} expirée(s), ${habSoon} bientôt.`, t: habExp ? 'ko' : habSoon ? 'warn' : 'ok' },
    plans: { label: 'Plans en retard', value: planLate, def: 'Formations planifiées dont l’échéance est dépassée.', t: planLate ? 'ko' : 'ok' },
    budget: { label: 'Investissement formation', value: esc(fmtMoney(spent)), def: `${passes} Pass achetés (un Pass = une personne pour un poste).` },
    recrut: { label: 'Recrutements ouverts', value: openRec, def: `${rsum('invited')} candidats invités, ${rsum('hired')} retenu(s).` },
    cat: { label: 'Formations internes', value: model.formations.length, def: `Au catalogue, ${model.records.filter((r) => r.status === 'done').length} inscription(s) terminée(s).` },
    deptsRisk: { label: 'Départements à surveiller', value: deptRows.filter((d) => d.value < 40 || d.late).length, def: 'Avancement sous 40 % ou thématiques en retard.', t: deptRows.some((d) => d.value < 40 || d.late) ? 'warn' : 'ok' },
  };
  const sets = {
    dg: ['effectif', 'avance', 'retard', 'conf', 'recrut', 'deptsRisk', 'revues'],
    dept: ['effectif', 'avance', 'valid', 'retard', 'revues', 'conf', 'renew', 'plans'],
    service: ['effectif', 'avance', 'valid', 'retard', 'revues', 'conf', 'renew', 'plans'],
    manager: ['effectif', 'avance', 'retard', 'revues', 'renew', 'plans'],
    rh: ['effectif', 'avance', 'valid', 'retard', 'revues', 'conf', 'renew', 'plans', 'recrut', 'cat'],
  };
  const kpis = `<div class="kpi-grid">${sets[role].map((k) => kpi(K[k])).join('')}</div>`;

  const donutCard = card('Avancement des thématiques', donut([{ k: 'ok', label: 'Validées', n: sum('valide') }, { k: 'mid', label: 'En cours', n: sum('en_cours') }, { k: 'todo', label: 'À faire', n: sum('a_faire') }]));
  const monthCard = card('Thématiques validées par mois', columns(model.events.filter((e) => ids.has(e.employeeId))), '<p class="xs muted">6 derniers mois, dans ce périmètre.</p>');
  const deptCard = card('Avancement par département', hbars(deptRows, 'Renseignez le département des collaborateurs.'));
  const serviceCard = card('Avancement par service', hbars(serviceRows, 'Renseignez le service des collaborateurs.'));
  const posteCard = card('Avancement par poste', hbars(posteRows, 'Aucun poste dans ce périmètre.'), role === 'rh' ? `<a class="btn btn-light btn-sm" href="#/rh?vue=formations">${icon('plus', 14)} Définir un parcours de poste</a>` : '');
  const confCard = card('Conformité des habilitations', (() => { const t = Math.max(1, emps.length); const o = Math.max(0, emps.length - habValid - habSoon - habExp);
    return `<div class="stack-bar" role="img" aria-label="Conformité"><span class="sb-ok" style="width:${pct(habValid, t)}%"></span><span class="sb-warn" style="width:${pct(habSoon, t)}%"></span><span class="sb-ko" style="width:${pct(habExp, t)}%"></span><span class="sb-none" style="width:${pct(o, t)}%"></span></div>
    <ul class="legend-list"><li><span class="lg-dot dn-bg-ok"></span>Valides <strong>${habValid}</strong></li><li><span class="lg-dot dn-bg-mid"></span>Bientôt expirées <strong>${habSoon}</strong></li><li><span class="lg-dot dn-bg-ko"></span>Expirées <strong>${habExp}</strong></li><li><span class="lg-dot dn-bg-todo"></span>À planifier <strong>${o}</strong></li></ul>`; })());
  const recCard = card('Recrutements', recruits.length ? `<ul class="funnel-mini">${[['Candidats invités', rsum('invited')], ['En formation ou examen', rsum('training') + rsum('exam')], ['Examens passés', rsum('done')], ['Réussis', rsum('passed')], ['Retenus', rsum('hired')]].map(([l, n], i, a) => `<li><span class="small">${l}</span><div class="fm-bar"><span style="width:${pct(n, Math.max(1, a[0][1]))}%"></span></div><strong>${n}</strong></li>`).join('')}</ul>` : '<p class="muted small">Aucun recrutement en cours.</p>', '<a class="btn btn-light btn-sm" href="#/rh?vue=recrutements">Voir les recrutements</a>');

  // ----- contenu par rôle
  let body = '';
  const worst = withP.slice().sort((a, b) => a.pct - b.pct || a.emp.name.localeCompare(b.emp.name));
  if (role === 'dg') {
    body = `${kpis}<div class="pil-grid">${deptCard}${donutCard}${monthCard}${confCard}${recCard}${posteCard}</div>
      <section class="block"><h2>Départements</h2>${deptRows.length ? `<div class="table-wrap"><table class="table"><caption class="sr-only">Départements</caption><thead><tr><th>Département</th><th>Personnes</th><th>Avancement</th><th>En retard</th><th>Revues à faire</th><th></th></tr></thead><tbody>${deptRows.slice().sort((a, b) => a.label.localeCompare(b.label)).map((d) => `<tr><td><strong>${esc(d.label)}</strong></td><td>${d.n}</td><td class="nowrap"><strong>${d.value} %</strong>${bar(d.value, d.value >= 70 ? 'ok' : d.value < 40 ? 'ko' : '')}</td><td>${d.late ? badge(String(d.late), 'ko') : '0'}</td><td>${d.reviews ? badge(String(d.reviews), 'warn') : '0'}</td><td><a class="btn btn-light btn-sm" href="#/rh?role=dept&scope=${encodeURIComponent(d.label)}">Détail</a></td></tr>`).join('')}</tbody></table></div>` : '<div class="card"><p class="muted">Renseignez le département de vos collaborateurs (fiche collaborateur) pour comparer les départements.</p></div>'}</section>${todoHTML}`;
  } else if (role === 'dept') {
    body = `${kpis}<div class="pil-grid">${serviceCard}${posteCard}${donutCard}${confCard}</div><section class="block"><h2>Personnes du département</h2>${peopleTable(worst)}</section>${todoHTML}`;
  } else if (role === 'service') {
    body = `${kpis}<div class="pil-grid">${donutCard}${posteCard}${confCard}</div><section class="block"><h2>Personnes du service</h2>${peopleTable(worst)}</section>${todoHTML}`;
  } else if (role === 'manager') {
    body = `${kpis}<section class="block"><h2>Mon équipe</h2>${peopleTable(worst)}</section>${todoHTML}
      <section class="block"><div class="card hint-card"><p class="small">Pour mettre à jour un statut, une échéance ou une revue : ouvrez la personne (« Suivre »). Ses thématiques, ses commentaires et son lien personnel y sont regroupés.</p></div></section>`;
  } else {
    body = `<div class="rh-shortcuts"><a class="btn btn-outline btn-sm" href="#/rh?vue=equipes">${icon('users', 14)} Ajouter / importer des collaborateurs</a><a class="btn btn-outline btn-sm" href="#/rh?vue=formations">${icon('book', 14)} Parcours par poste et formations</a><a class="btn btn-outline btn-sm" href="#/rh/inviter?type=recruitment">${icon('plus', 14)} Nouveau recrutement</a><a class="btn btn-outline btn-sm" href="#/rh/facturation">${icon('card', 14)} Facturation</a></div>
      ${kpis}<div class="pil-grid">${donutCard}${monthCard}${deptCard}${serviceCard}${posteCard}${confCard}${recCard}</div>${todoHTML}
      ${worst.length ? `<section class="block"><h2>Collaborateurs à accompagner en priorité</h2>${peopleTable(worst.slice(0, 5))}</section>` : ''}`;
  }

  const picker = choices.length ? `<div class="scope-pick"><label for="scope-sel" class="label">${R.pick}</label><select id="scope-sel">${choices.map(([v, l]) => `<option value="${esc(v)}" ${v === scope ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`
    : (['dept', 'service', 'manager'].includes(role) ? '<p class="muted small">Aucun périmètre : renseignez le département, le service et le responsable dans les fiches collaborateurs.</p>' : '');
  host.innerHTML = `<nav class="role-tabs" aria-label="Vue du back-office"><span class="role-lead">Vue</span>${ROLES.map((r) => `<a class="role-tab" href="#/rh?role=${r.k}" aria-current="${r.k === role}">${esc(r.label)}</a>`).join('')}</nav>
    <div class="role-head"><p class="muted small">${esc(R.desc)}</p>${picker}</div>${body}`;
  host.querySelector('#scope-sel')?.addEventListener('change', (e) => { ctx.go(`/rh?role=${role}&scope=${encodeURIComponent(e.target.value)}`); });
}
