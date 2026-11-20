// Espace administrateur MOURESS : suivi commercial des entreprises clientes (Pass achetés, montants, avancement). Réservé à MOURESS.
import { esc, fmtDate, fmtMoney, sha256 } from '../util.js';
import { CONFIG } from '../../config.js';

const KEY = 'mrs.admin.ok';
const isOpen = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

export default async function render(ctx, root) {
  ctx.setTitle('Administration MOURESS');
  if (!isOpen()) {
    root.innerHTML = `<div class="container-narrow page"><div class="card" style="max-width:420px;margin:var(--sp-6) auto"><h1>Administration MOURESS</h1>
      <p class="muted">Accès réservé à l’équipe MOURESS.</p>
      <form id="adm-f" class="stack"><div class="field"><label for="adm-p">Mot de passe</label><input id="adm-p" type="password" autocomplete="current-password" required></div>
      <p class="field-error" id="adm-e" role="alert" hidden>Mot de passe incorrect.</p><button class="btn btn-primary" type="submit">Entrer</button></form></div></div>`;
    root.querySelector('#adm-f').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await sha256(root.querySelector('#adm-p').value) === CONFIG.ADMIN_HASH) { try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } render(ctx, root); }
      else root.querySelector('#adm-e').hidden = false;
    });
    return;
  }
  const db = ctx.store.db;
  if (!db) { root.innerHTML = '<div class="container-narrow page"><h1>Administration MOURESS</h1><p class="muted">Aucune donnée disponible avec ce mode de stockage.</p></div>'; return; }
  const rows = (db.companies || []).filter((c) => !c.demo).concat((db.companies || []).filter((c) => c.demo)).map((c) => {
    const orders = (db.orders || []).filter((o) => o.companyId === c.id);
    const sessions = (db.sessions || []).filter((s) => s.companyId === c.id);
    return { c, emps: (db.employees || []).filter((e) => e.companyId === c.id).length, passes: orders.reduce((a, o) => a + (o.qty || 0), 0), total: orders.reduce((a, o) => a + (o.total || 0), 0), sessions: sessions.length, last: orders.reduce((a, o) => Math.max(a, o.date || 0), 0) };
  });
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const orders = [...(db.orders || [])].sort((a, b) => b.date - a.date).slice(0, 30);
  const nameOf = (id) => (db.companies || []).find((c) => c.id === id)?.name || id;
  root.innerHTML = `<div class="container page"><div class="page-head split"><div><p class="eyebrow dark">MOURESS</p><h1 class="page-title">Administration</h1></div><button class="btn btn-light btn-sm" id="adm-out">Quitter</button></div>
    <div class="kpi-grid"><div class="card kpi"><span class="kpi-label">Entreprises</span><span class="kpi-val">${rows.length}</span></div>
      <div class="card kpi"><span class="kpi-label">Collaborateurs suivis</span><span class="kpi-val">${sum('emps')}</span></div>
      <div class="card kpi"><span class="kpi-label">Pass vendus</span><span class="kpi-val">${sum('passes')}</span></div>
      <div class="card kpi"><span class="kpi-label">Chiffre d’affaires</span><span class="kpi-val">${esc(fmtMoney(sum('total')))}</span></div></div>
    <section class="block"><h2>Entreprises clientes</h2><div class="table-wrap"><table class="table"><thead><tr><th>Entreprise</th><th>Collaborateurs</th><th>Sessions</th><th>Pass</th><th>Montant</th><th>Dernier achat</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><strong>${esc(r.c.name)}</strong>${r.c.demo ? ' <span class="xs muted">(démo)</span>' : ''}</td><td>${r.emps}</td><td>${r.sessions}</td><td>${r.passes}</td><td>${esc(fmtMoney(r.total))}</td><td>${r.last ? fmtDate(r.last) : '—'}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="block"><h2>Derniers achats</h2>${orders.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Entreprise</th><th>N°</th><th>Poste</th><th>Pass</th><th>Montant</th></tr></thead><tbody>
      ${orders.map((o) => `<tr><td>${fmtDate(o.date)}</td><td>${esc(nameOf(o.companyId))}</td><td>${esc(o.number)}</td><td>${esc(o.profileName || o.sessionTitle || '')}</td><td>${o.qty}</td><td>${esc(fmtMoney(o.total))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun achat.</p>'}</section>
    <p class="xs muted">Les données affichées sont celles enregistrées dans ce navigateur, tant que la base partagée n’est pas connectée.</p></div>`;
  root.querySelector('#adm-out').addEventListener('click', () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } location.hash = '#/'; });
}
