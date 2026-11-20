// Onglet « Pilotage » : indicateurs de l'entreprise (parcours par poste, conformité, recrutements) et actions de management à traiter.
import { CONFIG } from '../../config.js';
import { esc, fmtDate, pct } from '../util.js';
import { icon, badge, bar } from '../ui.js';
import { loadTeam } from './rh-teams.js';
import { recruitCounts } from './rh-recruit.js';
import { buildModel, reviewState, ensureDemo } from '../parcours.js';

const DAY = 86400000;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const kpi = (n, label, tone = '', sub = '') => `<div class="card stat kpi ${tone ? 'kpi-' + tone : ''}"><span class="stat-n">${n}</span><span class="muted small">${label}</span>${sub ? `<span class="xs muted">${sub}</span>` : ''}</div>`;

function donut(parts) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total) return '<p class="muted small">Aucune thématique définie : créez le parcours d’un poste pour alimenter ce graphique.</p>';
  let off = 25;
  const arcs = parts.map((p) => { const v = (p.n / total) * 100; const a = `<circle class="dn dn-${p.k}" cx="18" cy="18" r="15.915" fill="none" stroke-width="5" stroke-dasharray="${v} ${100 - v}" stroke-dashoffset="${off}"></circle>`; off -= v; return a; }).join('');
  const ok = parts.find((p) => p.k === 'ok')?.n || 0;
  return `<div class="donut"><svg viewBox="0 0 36 36" role="img" aria-label="Répartition des thématiques"><circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--c-surface-2)" stroke-width="5"></circle>${arcs}
    <text x="18" y="19.5" text-anchor="middle" class="dn-t">${pct(ok, total)} %</text></svg>
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

export async function renderPilotage(ctx, host, company, data, sessions, employees) {
  await ensureDemo(ctx, company, employees);
  const [team, model] = await Promise.all([loadTeam(ctx, company, data), buildModel(ctx, company, employees)]);
  if (!ctx.alive()) return;
  const pName = (id) => data.profiles.find((p) => p.id === id)?.name || id;
  const now = Date.now();
  const all = [...model.per.values()];
  const withParcours = all.filter((x) => x.total > 0);
  const sum = (k) => all.reduce((a, x) => a + x[k], 0);
  const avgPct = withParcours.length ? Math.round(withParcours.reduce((a, x) => a + x.pct, 0) / withParcours.length) : null;
  const habValid = team.rows.filter((r) => r.status === 'valid').length;
  const habSoon = team.rows.filter((r) => r.status === 'soon').length;
  const planLate = team.plans.filter((p) => p.late).length;
  const reviewsDue = all.filter((x) => x.total > 0 && ['late', 'soon', 'none'].includes(reviewState(x.review).key)).length;
  const recruits = sessions.filter((s) => s.type === 'recruitment');
  const rc = recruits.map(recruitCounts); const rsum = (k) => rc.reduce((a, c) => a + c[k], 0);
  const openRec = recruits.filter((s) => s.status !== 'closed').length;

  // regroupements
  const teams = [...new Set(employees.map((e) => e.team || 'Sans équipe'))];
  const teamRows = teams.map((t) => { const xs = withParcours.filter((x) => (x.emp.team || 'Sans équipe') === t); return xs.length ? { label: t, value: Math.round(xs.reduce((a, x) => a + x.pct, 0) / xs.length), sub: `${xs.length} collaborateur${xs.length > 1 ? 's' : ''}` } : null; }).filter(Boolean).sort((a, b) => a.value - b.value);
  const posteIds = [...new Set(employees.map((e) => e.profileId).filter(Boolean))];
  const posteRows = posteIds.map((pid) => { const xs = all.filter((x) => x.emp.profileId === pid); const n = (model.byProfile.get(pid) || []).length; return { label: pName(pid), href: `#/rh/poste/${pid}`, value: xs.length && n ? Math.round(xs.reduce((a, x) => a + x.pct, 0) / xs.length) : 0, sub: n ? `${n} thématiques · ${xs.length} collaborateur${xs.length > 1 ? 's' : ''}` : 'Parcours à définir' }; }).sort((a, b) => a.value - b.value);

  // actions de management à traiter
  const todo = [];
  for (const p of team.plans.filter((x) => x.late)) { const e = employees.find((x) => x.id === p.employeeId); if (e) todo.push({ w: 1, tone: 'ko', tag: 'Plan en retard', who: e.name, text: `${pName(p.profileId)} (échéance ${fmtDate(p.due)})`, href: `#/rh/equipe/${e.id}` }); }
  for (const r of team.rows) for (const h of r.habs.filter((x) => x.v.status !== 'valid')) todo.push({ w: h.v.status === 'expired' ? 1 : 3, tone: h.v.status === 'expired' ? 'ko' : 'warn', tag: h.v.status === 'expired' ? 'Habilitation expirée' : 'Habilitation à renouveler', who: r.e.name, text: h.profile?.name || h.cert.profileId, href: `#/rh/equipe/${r.e.id}` });
  for (const x of withParcours) { const rs = reviewState(x.review); if (rs.key !== 'ok') todo.push({ w: rs.key === 'late' ? 2 : 4, tone: rs.tone || 'info', tag: 'Revue de management', who: x.emp.name, text: rs.label, href: `#/rh/equipe/${x.emp.id}` }); }
  for (const x of all) for (const r of x.rows) if (r.status === 'en_cours' && r.date && now - r.date > 30 * DAY) todo.push({ w: 5, tone: 'warn', tag: 'Bloqué ?', who: x.emp.name, text: `« ${r.item.title} » en cours depuis plus de 30 jours`, href: `#/rh/equipe/${x.emp.id}` });
  for (const e of employees.filter((x) => !x.profileId)) todo.push({ w: 6, tone: '', tag: 'Poste manquant', who: e.name, text: 'Renseignez son poste pour lui attribuer un parcours.', href: `#/rh/equipe/${e.id}` });
  for (const pid of posteIds.filter((id) => !(model.byProfile.get(id) || []).length)) todo.push({ w: 6, tone: 'info', tag: 'Parcours à créer', who: pName(pid), text: 'Aucune thématique définie pour ce poste.', href: `#/rh/poste/${pid}` });
  todo.sort((a, b) => a.w - b.w);

  const worst = withParcours.slice().sort((a, b) => a.pct - b.pct || a.emp.name.localeCompare(b.emp.name)).slice(0, 5);

  host.innerHTML = `
    <div class="grid grid-4 stats kpis-top">
      ${kpi(employees.length, 'collaborateurs', '', `${employees.filter((e) => e.profileId).length} avec un poste défini`)}
      ${kpi(avgPct == null ? '—' : avgPct + ' %', 'progression moyenne des parcours', avgPct != null && avgPct < 40 ? 'ko' : avgPct >= 70 ? 'ok' : '')}
      ${kpi(`${sum('valide')} / ${sum('total')}`, 'thématiques validées', '', `${sum('en_cours')} en cours`)}
      ${kpi(reviewsDue, 'revues de management à faire', reviewsDue ? 'warn' : 'ok', 'en retard, sous 14 jours ou à planifier')}
      ${kpi(`${pct(habValid, employees.length)} %`, 'habilitations valides', habValid < employees.length ? 'warn' : 'ok', `${habSoon} expirent sous ${CONFIG.ALERT_DAYS} j`)}
      ${kpi(planLate, 'plan(s) en retard', planLate ? 'ko' : 'ok')}
      ${kpi(openRec, 'recrutement(s) ouvert(s)', '', `${rsum('invited')} candidats · ${rsum('hired')} retenu(s)`)}
      ${kpi(model.formations.length, 'formations internes au catalogue', '', `${model.records.filter((r) => r.status === 'done').length} terminée(s)`)}</div>

    <div class="pil-grid">
      <section class="card pil-card"><h3>Avancement des thématiques</h3>${donut([{ k: 'ok', label: 'Validées', n: sum('valide') }, { k: 'mid', label: 'En cours', n: sum('en_cours') }, { k: 'todo', label: 'À faire', n: sum('a_faire') }])}</section>
      <section class="card pil-card"><h3>Thématiques validées par mois</h3>${columns(model.events)}<p class="xs muted">6 derniers mois, tous collaborateurs.</p></section>
      <section class="card pil-card"><h3>Progression par équipe</h3>${hbars(teamRows, 'Définissez le parcours des postes pour voir la progression des équipes.')}</section>
      <section class="card pil-card"><h3>Progression par poste</h3>${hbars(posteRows, 'Ajoutez des collaborateurs avec un poste.')}<a class="btn btn-light btn-sm" href="#/rh?vue=formations">${icon('plus', 14)} Définir un parcours de poste</a></section>
      <section class="card pil-card"><h3>Recrutements</h3>${recruits.length ? `<ul class="funnel-mini">${[['Candidats invités', rsum('invited')], ['En formation ou examen', rsum('training') + rsum('exam')], ['Examens passés', rsum('done')], ['Réussis', rsum('passed')], ['Retenus', rsum('hired')]].map(([l, n], i, a) => `<li><span class="small">${l}</span><div class="fm-bar"><span style="width:${pct(n, Math.max(1, a[0][1]))}%"></span></div><strong>${n}</strong></li>`).join('')}</ul>` : '<p class="muted small">Aucun recrutement en cours.</p>'}<a class="btn btn-light btn-sm" href="#/rh?vue=recrutements">Voir les recrutements</a></section>
      <section class="card pil-card"><h3>Conformité des habilitations</h3>${(() => { const v = habValid; const s = habSoon; const x = team.rows.filter((r) => r.status === 'expired').length; const o = employees.length - v - s - x; const t = Math.max(1, employees.length);
        return `<div class="stack-bar" role="img" aria-label="Conformité"><span class="sb-ok" style="width:${pct(v, t)}%"></span><span class="sb-warn" style="width:${pct(s, t)}%"></span><span class="sb-ko" style="width:${pct(x, t)}%"></span><span class="sb-none" style="width:${pct(o, t)}%"></span></div>
        <ul class="legend-list"><li><span class="lg-dot dn-bg-ok"></span>Valides <strong>${v}</strong></li><li><span class="lg-dot dn-bg-mid"></span>Bientôt expirées <strong>${s}</strong></li><li><span class="lg-dot dn-bg-ko"></span>Expirées <strong>${x}</strong></li><li><span class="lg-dot dn-bg-todo"></span>À planifier <strong>${Math.max(0, o)}</strong></li></ul>`; })()}</section></div>

    <section class="block"><div class="split"><h2>À traiter par le management</h2>${todo.length ? badge(`${todo.length} action${todo.length > 1 ? 's' : ''}`, 'warn') : ''}</div>
      ${todo.length ? `<div class="card"><ul class="due-list">${todo.slice(0, 10).map((t) => `<li>${badge(t.tag, t.tone)}<span><strong>${esc(t.who)}</strong><br><span class="xs muted">${esc(t.text)}</span></span><a class="btn btn-light btn-sm" href="${esc(t.href)}">Traiter</a></li>`).join('')}</ul>${todo.length > 10 ? `<p class="xs muted">+ ${todo.length - 10} autre(s) action(s).</p>` : ''}</div>`
        : '<div class="card"><p class="muted">Rien à traiter : parcours à jour, revues planifiées, habilitations valides.</p></div>'}</section>

    ${worst.length ? `<section class="block"><h2>Collaborateurs à accompagner en priorité</h2><div class="grid grid-2">${worst.map((x) => {
      const rs = reviewState(x.review);
      return `<a class="card card-link sess" href="#/rh/equipe/${esc(x.emp.id)}"><div class="split" style="align-items:flex-start"><strong>${esc(x.emp.name)}</strong>${badge(rs.label, rs.tone)}</div><p class="muted small">${esc(pName(x.emp.profileId))}${x.emp.team ? ' · ' + esc(x.emp.team) : ''}</p><div class="split small"><span>${x.valide} / ${x.total} validées</span><strong>${x.pct} %</strong></div>${bar(x.pct, x.pct >= 70 ? 'ok' : x.pct < 40 ? 'ko' : '')}</a>`;
    }).join('')}</div></section>` : ''}`;
}
