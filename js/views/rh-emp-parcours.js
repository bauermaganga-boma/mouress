// Fiche collaborateur : parcours de poste (statut par thématique), revue de management, lien personnel à envoyer.
import { getProfilesData } from '../data.js';
import { esc, fmtDate, fmtDateInput } from '../util.js';
import { icon, badge, bar } from '../ui.js';
import { KINDS, STATUS_P } from '../parcours-store.js';
import { buildModel, reviewState, nextReviewFrom, nextAction, actionHref } from '../parcours.js';
import { personalLink, personalMessage, shareHTML } from '../share.js';

const ST_ORDER = ['a_faire', 'en_cours', 'valide'];

export async function employeeParcours(ctx, company, emp) {
  const data = await getProfilesData();
  const poste = data.profiles.find((p) => p.id === emp.profileId);
  const link = await personalLink(ctx, emp);
  const share = `<div class="card link-row" id="emp-link"><div><strong>Lien personnel de ${esc(emp.name)}</strong><p class="xs muted">Ouvre son parcours de poste, sa progression et ses prochains cours dans « Mon espace ».</p></div>${shareHTML({ link, message: personalMessage(emp, company, link), subject: 'Votre parcours de formation', email: emp.email, who: emp.name })}</div>`;
  if (!poste) return `<section class="block" id="emp-parcours"><h2>Parcours de poste</h2><div class="card"><p class="muted">Renseignez le poste du collaborateur (« Modifier la fiche ») pour lui attribuer une série de thématiques.</p></div>${share}</section>`;
  const model = await buildModel(ctx, company, [emp]);
  const x = model.per.get(emp.id);
  const rs = reviewState(x.review);
  const na = nextAction(x.rows);
  const href = na ? actionHref(na, poste.id) : '';
  return `<section class="block" id="emp-parcours"><div class="split"><h2>Parcours de poste</h2><a class="btn btn-light btn-sm" href="#/rh/poste/${esc(poste.id)}">${icon('edit', 14)} Thématiques du poste</a></div>
    ${x.total ? `<div class="card"><div class="split small"><span><strong>${esc(poste.name)}</strong> · ${x.valide} / ${x.total} thématiques validées</span><strong>${x.pct} %</strong></div>${bar(x.pct, x.pct >= 70 ? 'ok' : x.pct < 40 ? 'ko' : '')}
      ${na ? `<p class="small" style="margin-top:var(--sp-3)">${icon('target', 14)} Prochaine étape : <strong>${esc(na.item.title)}</strong>${href ? ` <a href="${esc(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>Ouvrir</a>` : ''}</p>` : '<p class="small" style="margin-top:var(--sp-3)">Toutes les thématiques sont validées.</p>'}</div>
      <div class="table-wrap"><table class="table"><caption class="sr-only">Thématiques du poste</caption><thead><tr><th>Thématique</th><th>Statut</th><th>Commentaire du responsable</th></tr></thead><tbody>
      ${x.rows.map((r) => `<tr><td><strong>${esc(r.item.title)}</strong><br>${badge(KINDS[r.item.kind].label, KINDS[r.item.kind].tone)}${r.item.hours ? ` <span class="xs muted">${r.item.hours} h</span>` : ''}${r.via ? ` <span class="xs muted">${esc(r.via)}</span>` : ''}</td>
        <td class="sv sv-${r.status}"><select class="sel-sm sv-sel" data-ep-st="${esc(r.item.id)}" aria-label="Statut : ${esc(r.item.title)}"><option value="auto" ${r.auto ? 'selected' : ''}>${r.auto ? STATUS_P[r.status].label + ' (auto)' : 'Automatique'}</option>${ST_ORDER.map((k) => `<option value="${k}" ${!r.auto && r.status === k ? 'selected' : ''}>${STATUS_P[k].label}</option>`).join('')}</select>${r.date ? `<span class="xs muted">${fmtDate(r.date)}</span>` : ''}</td>
        <td><input type="text" class="sel-sm ep-com" data-ep-com="${esc(r.item.id)}" maxlength="300" value="${esc(r.comment || '')}" placeholder="Remarque, preuve de validation…" aria-label="Commentaire : ${esc(r.item.title)}"></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card"><p class="muted">Aucune thématique n’est définie pour le poste « ${esc(poste.name)} ». <a href="#/rh/poste/${esc(poste.id)}">Créer le parcours du poste</a></p></div>`}
    <div class="card review-card" id="revue"><div class="split"><h3>Revue de management</h3>${badge(rs.label, rs.tone)}</div>
      <p class="xs muted">${x.review?.last ? `Dernière revue le ${fmtDate(x.review.last)}.` : 'Aucune revue enregistrée.'}</p>
      <div class="form-grid"><div class="field"><label for="rv-next">Prochaine revue</label><input id="rv-next" type="date" value="${x.review?.next ? fmtDateInput(x.review.next) : ''}"></div></div>
      <div class="field"><label for="rv-note">Points d’attention, objectifs convenus</label><textarea id="rv-note" rows="3" maxlength="600">${esc(x.review?.note || '')}</textarea></div>
      <div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-rv-save>Enregistrer</button><button type="button" class="btn btn-outline btn-sm" data-rv-done>${icon('check', 14)} Revue effectuée aujourd’hui</button></div></div>
    ${share}</section>`;
}

/** Gestionnaires de la section (à brancher une seule fois sur la racine de la fiche). */
export function bindEmployeeParcours(ctx, root, company, getEmp, redraw) {
  root.addEventListener('change', async (e) => {
    const st = e.target.closest('[data-ep-st]');
    if (st) { await ctx.store.setSuivi({ companyId: company.id, employeeId: getEmp().id, itemId: st.dataset.epSt, status: st.value }); ctx.toast('Suivi mis à jour.'); await redraw(); return; }
    const com = e.target.closest('[data-ep-com]');
    if (com) {
      const itemId = com.dataset.epCom;
      const cur = (await ctx.store.listSuivi(company.id, getEmp().id)).find((s) => s.itemId === itemId);
      if (!cur && !com.value.trim()) return;
      await ctx.store.setSuivi({ companyId: company.id, employeeId: getEmp().id, itemId, status: cur?.status || 'en_cours', comment: com.value });
      ctx.toast('Commentaire enregistré.'); await redraw();
    }
  });
  root.addEventListener('click', async (e) => {
    const emp = getEmp();
    if (e.target.closest('[data-rv-save]')) {
      const d = root.querySelector('#rv-next').value;
      await ctx.store.saveReview({ companyId: company.id, employeeId: emp.id, next: d ? new Date(d + 'T12:00:00').getTime() : null, note: root.querySelector('#rv-note').value });
      ctx.toast('Revue enregistrée.'); await redraw(); return;
    }
    if (e.target.closest('[data-rv-done]')) {
      const now = Date.now();
      await ctx.store.saveReview({ companyId: company.id, employeeId: emp.id, last: now, next: nextReviewFrom(now), note: root.querySelector('#rv-note').value });
      ctx.toast('Revue effectuée, prochaine dans 90 jours.'); await redraw();
    }
  });
}
