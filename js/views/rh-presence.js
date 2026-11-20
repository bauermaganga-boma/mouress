// Présence et rotations : où est chaque collaborateur aujourd'hui, quand a lieu la prochaine relève, et s'il est apte à intervenir.
import { esc, fmtDate, fmtDateInput } from '../util.js';
import { icon, badge, bar, avatar } from '../ui.js';
import { loadTeam } from './rh-teams.js';
import { whereIs, aptitude, upcomingChanges, lieuText, LIEUX, ABSENCES, REGIMES, WORK_PLACES, regimeDays } from '../presence.js';

const DAY = 86400000;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dayTs = (v) => (v ? new Date(v + 'T12:00:00').getTime() : null);

/** Champs de présence d'une fiche (base, régime, lieu de rotation, début de présence, absence). prefix distingue les formulaires. */
export function presenceFieldsHTML(p, o = {}, bases = []) {
  const ab = o.absence || {};
  return `<datalist id="${p}-dl-base">${bases.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
    <fieldset class="presence-box"><legend class="label">Présence et rotation</legend><div class="form-grid">
      <div class="field"><label for="${p}-base">Base de rattachement</label><input id="${p}-base" type="text" list="${p}-dl-base" value="${esc(o.base || '')}" placeholder="Ex. Base Port-Gentil"></div>
      <div class="field"><label for="${p}-reg">Régime de travail</label><select id="${p}-reg"><option value="">— Non renseigné —</option>${Object.entries(REGIMES).map(([k, v]) => `<option value="${k}" ${k === o.regime ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <div class="field rot-only"><label for="${p}-wp">Lieu de travail en rotation</label><select id="${p}-wp"><option value="">—</option>${Object.entries(WORK_PLACES).map(([k, v]) => `<option value="${k}" ${k === o.workPlace ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <div class="field rot-only"><label for="${p}-site">Nom du site ou de la plateforme</label><input id="${p}-site" type="text" value="${esc(o.siteName || '')}" placeholder="Ex. Plateforme Mandji"></div>
      <div class="field rot-only"><label for="${p}-cs">Début de la présence en cours</label><input id="${p}-cs" type="date" value="${o.cycleStart ? fmtDateInput(o.cycleStart) : ''}"><span class="hint xs">Premier jour de la période sur site en cours. Le calendrier de rotation s’en déduit.</span></div></div>
      <div class="form-grid"><div class="field"><label for="${p}-abt">Absence ou déplacement</label><select id="${p}-abt"><option value="">Aucun</option>${Object.entries(ABSENCES).map(([k, v]) => `<option value="${k}" ${k === ab.type ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
        <div class="field"><label for="${p}-abf">Du</label><input id="${p}-abf" type="date" value="${ab.from ? fmtDateInput(ab.from) : ''}"></div>
        <div class="field"><label for="${p}-abu">Au</label><input id="${p}-abu" type="date" value="${ab.to ? fmtDateInput(ab.to) : ''}"></div></div></fieldset>`;
}
export function readPresenceFields(scope, p) {
  const g = (s) => scope.querySelector(`#${p}-${s}`);
  const type = g('abt').value;
  return { base: g('base').value, regime: g('reg').value, workPlace: regimeDays(g('reg').value) ? g('wp').value : '', siteName: regimeDays(g('reg').value) ? g('site').value : '',
    cycleStart: regimeDays(g('reg').value) ? dayTs(g('cs').value) : null, absence: type && g('abf').value && g('abu').value ? { type, from: dayTs(g('abf').value), to: dayTs(g('abu').value) } : null };
}
/** Affiche les champs de rotation seulement pour un régime de rotation. */
export function bindPresenceFields(root, p) {
  const sync = () => { const reg = root.querySelector(`#${p}-reg`); if (!reg) return; reg.closest('fieldset').querySelectorAll('.rot-only').forEach((el) => { el.hidden = !regimeDays(reg.value); }); };
  if (!root.dataset['pf' + p]) { root.dataset['pf' + p] = '1'; root.addEventListener('change', (e) => { if (e.target.id === `${p}-reg`) sync(); }); }
  sync();
}

export const lieuBadge = (w) => badge(lieuText(w), LIEUX[w.lieu]?.tone || '');

export async function renderPresence(ctx, host, company, data, employees, opts = {}) {
  const team = await loadTeam(ctx, company, data);
  if (!ctx.alive()) return;
  const now = Date.now();
  const pName = (id) => data.profiles.find((p) => p.id === id)?.name || id;
  const rowOf = new Map(team.rows.map((r) => [r.e.id, r]));
  const list = employees.map((e) => ({ e, where: whereIs(e, now), apt: aptitude(rowOf.get(e.id)?.habs || [], now), set: !!(e.regime || e.base || e.absence) }));
  const bases = [...new Set(employees.map((e) => e.base).filter(Boolean))].sort();
  const f = { q: '', lieu: '', apt: '' };
  const count = (...k) => list.filter((x) => k.includes(x.where.lieu)).length;
  const onSite = list.filter((x) => ['site', 'offshore'].includes(x.where.lieu));
  const unfit = list.filter((x) => x.apt.key === 'ko');
  const changes = upcomingChanges(list, 14, now);
  const notSet = list.filter((x) => !x.set).length;

  const card = (label, n, sub, ico, t = '') => `<div class="card kpi ${t ? 'kpi-' + t : ''}"><span class="kpi-label">${icon(ico, 16)} ${label}</span><span class="kpi-val">${n}</span><span class="kpi-def">${sub}</span></div>`;
  host.innerHTML = `
    <div class="kpi-grid">
      ${card('À la base', count('base'), `${list.filter((x) => x.where.lieu === 'formation').length} en formation`, 'building')}
      ${card('Sur site à terre', count('site'), `${new Set(list.filter((x) => x.where.lieu === 'site').map((x) => x.where.place)).size} site(s)`, 'pin')}
      ${card('Offshore', count('offshore'), `${changes.filter((c) => c.w.lieu === 'offshore' && c.w.next === 'relève').length} relève(s) sous 14 jours`, 'ship')}
      ${card('Repos et absences', count('repos', 'conge', 'maladie', 'deplacement'), `${count('conge', 'maladie')} en congé ou arrêt`, 'calendar')}
      ${card('Aptes à intervenir', `${onSite.filter((x) => x.apt.key === 'ok' || x.apt.key === 'warn').length} / ${onSite.length}`, 'Sur site ou offshore, habilitations valides.', 'check', unfit.length ? 'warn' : 'ok')}
      ${card('À retirer', unfit.length, 'Habilitation expirée : ne pas faire intervenir.', 'shield', unfit.length ? 'ko' : 'ok')}</div>
    ${notSet ? `<div class="alert alert-warn"><strong>${notSet} fiche(s) sans base ni régime.</strong> Renseignez-les (fiche collaborateur) pour les voir ici avec leur rotation.</div>` : ''}
    <section class="block"><div class="split"><h2>Qui est où</h2><span class="muted small" id="pr-count" aria-live="polite"></span></div>
      <div class="card filters-card"><div class="form-grid">
        <div class="field"><label for="pr-q">Recherche</label><input id="pr-q" type="search" placeholder="Nom, poste ou site" autocomplete="off"></div>
        <div class="field"><label for="pr-l">Où</label><select id="pr-l"><option value="">Partout</option>${Object.entries(LIEUX).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="pr-a">Aptitude</label><select id="pr-a"><option value="">Toutes</option><option value="ok">Apte</option><option value="warn">Expire bientôt</option><option value="ko">À retirer</option></select></div></div></div>
      <div id="pr-table"></div>
      <p class="xs muted">La situation est calculée chaque jour à partir du régime de rotation et de la date de début de présence de la fiche. Une absence en cours remplace la rotation.</p></section>
    <section class="block"><h2>Relèves et retours des 14 prochains jours</h2>
      ${changes.length ? `<div class="card"><ul class="due-list">${changes.map((c) => `<li>${badge(c.w.next === 'relève' ? 'Relève' : c.w.next === 'retour' ? 'Retour' : 'Retour sur site', c.w.lieu === 'offshore' ? 'info' : c.w.lieu === 'site' ? 'ok' : '')}<span><strong>${esc(c.e.name)}</strong><br><span class="xs muted">${esc(pName(c.e.profileId))} · ${esc(c.w.place || '')} · le ${fmtDate(c.w.until)}</span></span><a class="btn btn-light btn-sm" href="#/rh/equipe/${esc(c.e.id)}">Fiche</a></li>`).join('')}</ul></div>` : '<div class="card"><p class="muted">Aucune relève prévue sous 14 jours.</p></div>'}</section>`;

  const draw = () => {
    const q = norm(f.q);
    const rows = list.filter((x) => (!q || norm(`${x.e.name} ${pName(x.e.profileId)} ${x.where.place}`).includes(q)) && (!f.lieu || x.where.lieu === f.lieu) && (!f.apt || x.apt.key === f.apt));
    host.querySelector('#pr-count').textContent = `${rows.length} collaborateur${rows.length > 1 ? 's' : ''}`;
    host.querySelector('#pr-table').innerHTML = rows.length ? `<div class="table-wrap"><table class="table people-table"><caption class="sr-only">Présence des collaborateurs</caption><thead><tr><th>Collaborateur</th><th>Où</th><th>Rotation</th><th>Aptitude</th><th></th></tr></thead><tbody>
      ${rows.map((x) => { const w = x.where; const L = LIEUX[w.lieu];
        const prog = w.total ? `<div class="rot-bar rot-${w.lieu}">${bar(Math.round((w.day / w.total) * 100))}</div><span class="xs muted">Jour ${w.day} sur ${w.total}${w.until && w.next ? ` · ${w.next === 'relève' ? 'relève' : w.next === 'retour' ? 'retour' : 'retour sur site'} le ${fmtDate(w.until)}` : ''}</span>` : `<span class="xs muted">${x.e.regime === 'sedentaire' ? 'Sédentaire' : x.set ? '' : 'Non renseigné'}</span>`;
        return `<tr><td><a class="emp-inline" href="#/rh/equipe/${esc(x.e.id)}">${avatar(x.e, 36)}<span><strong>${esc(x.e.name)}</strong><br><span class="xs muted">${esc(pName(x.e.profileId))}${x.e.base ? ' · ' + esc(x.e.base) : ''}</span></span></a></td>
          <td>${badge(lieuText(w), L?.tone || '')}</td><td>${prog}</td>
          <td>${badge(x.apt.label, x.apt.tone)}${x.apt.detail ? `<br><span class="xs muted">${esc(x.apt.detail)}</span>` : ''}</td><td><a class="btn btn-light btn-sm" href="#/rh/equipe/${esc(x.e.id)}">Fiche</a></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card"><p class="muted">Aucun collaborateur ne correspond.</p></div>';
  };
  draw();
  host.addEventListener('input', (e) => { if (e.target.id === 'pr-q') { f.q = e.target.value; draw(); } });
  host.addEventListener('change', (e) => { if (e.target.id === 'pr-l') f.lieu = e.target.value; else if (e.target.id === 'pr-a') f.apt = e.target.value; else return; draw(); });
}
