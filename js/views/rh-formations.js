// Mes formations : catalogue propre à l'entreprise (ajout, modification, retrait) et suivi des participants.
import { esc, fmtDate, fmtDateInput, addMonths, pct } from '../util.js';
import { icon, badge, bar, avatar, pageHead } from '../ui.js';
import { CATEGORIES, MODES, REC_STATUS, SUGGESTIONS } from '../formations-store.js';

const opts = (list, sel) => list.map((c) => `<option value="${esc(c)}" ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');
const dayTs = (v) => (v ? new Date(v + 'T12:00:00').getTime() : null);

function formFields(f = {}, idp = 'f') {
  return `<div class="field"><label for="${idp}-title">Titre de la formation</label><input id="${idp}-title" type="text" required maxlength="120" value="${esc(f.title || '')}" placeholder="Ex. Habilitation électrique BR"></div>
    <div class="form-grid">
      <div class="field"><label for="${idp}-cat">Catégorie</label><select id="${idp}-cat">${opts(CATEGORIES, f.category || 'Sécurité')}</select></div>
      <div class="field"><label for="${idp}-mode">Modalité</label><select id="${idp}-mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${k === (f.mode || 'presentiel') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <div class="field"><label for="${idp}-hours">Durée (heures)</label><input id="${idp}-hours" type="number" min="0" max="999" inputmode="numeric" value="${f.hours || ''}"></div>
      <div class="field"><label for="${idp}-valid">Validité (mois, 0 = illimitée)</label><input id="${idp}-valid" type="number" min="0" max="120" inputmode="numeric" value="${f.validityMonths || 0}"></div></div>
    <div class="field"><label for="${idp}-prov">Organisme ou formateur</label><input id="${idp}-prov" type="text" maxlength="120" value="${esc(f.provider || '')}" placeholder="Ex. MOURESS, organisme agréé…"></div>
    <div class="field"><label for="${idp}-url">Lien vers le support ou l’inscription (facultatif)</label><input id="${idp}-url" type="url" inputmode="url" value="${esc(f.url || '')}" placeholder="https://…"></div>
    <div class="field"><label for="${idp}-desc">Contenu, objectifs, remarques</label><textarea id="${idp}-desc" rows="3" maxlength="1200">${esc(f.description || '')}</textarea></div>`;
}
const readForm = (root, idp = 'f') => ({
  title: root.querySelector(`#${idp}-title`).value.trim(), category: root.querySelector(`#${idp}-cat`).value, mode: root.querySelector(`#${idp}-mode`).value,
  hours: root.querySelector(`#${idp}-hours`).value, validityMonths: root.querySelector(`#${idp}-valid`).value, provider: root.querySelector(`#${idp}-prov`).value,
  url: root.querySelector(`#${idp}-url`).value, description: root.querySelector(`#${idp}-desc`).value,
});

async function loadAll(ctx, company) {
  const [formations, records, employees] = await Promise.all([ctx.store.listFormations(company.id), ctx.store.listFormationRecords(company.id), ctx.store.listEmployees(company.id)]);
  const empIds = new Set(employees.map((e) => e.id));
  return { formations, records: records.filter((r) => empIds.has(r.employeeId)), employees };
}

/** Onglet « Mes formations » du tableau de bord. */
export async function renderFormationsTab(ctx, host, company, redraw) {
  const { formations, records } = await loadAll(ctx, company);
  if (!ctx.alive()) return;
  const doneAll = records.filter((r) => r.status === 'done').length;
  host.innerHTML = `<div class="grid grid-3 stats">
      <div class="card stat"><span class="stat-n">${formations.length}</span><span class="muted small">formation${formations.length > 1 ? 's' : ''} au catalogue</span></div>
      <div class="card stat"><span class="stat-n">${records.length}</span><span class="muted small">inscription${records.length > 1 ? 's' : ''} de collaborateurs</span></div>
      <div class="card stat"><span class="stat-n">${doneAll}</span><span class="muted small">terminée${doneAll > 1 ? 's' : ''}</span></div></div>
    <section class="block"><div class="split"><h2>Catalogue de l’entreprise</h2></div>
      <details class="card add-box" id="new-formation" ${formations.length ? '' : 'open'}><summary class="btn btn-primary btn-sm">${icon('plus', 14)} Nouvelle formation</summary>
        <form id="f-new" novalidate style="margin-top:var(--sp-4)">
          <p class="small muted">Donnez le titre que vous voulez, ou partez d’une suggestion :</p>
          <div class="chips" id="f-sugg">${SUGGESTIONS.map((s) => `<button type="button" class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join('')}</div>
          ${formFields({}, 'n')}
          <div class="field-error" id="n-err" role="alert"></div><button class="btn btn-primary" type="submit">Ajouter au catalogue</button></form></details>
      <div class="grid grid-2" style="margin-top:var(--sp-4)">${formations.map((f) => {
        const rs = records.filter((r) => r.formationId === f.id); const done = rs.filter((r) => r.status === 'done').length;
        return `<article class="card formation-card"><div class="split" style="align-items:flex-start;gap:.4rem">${badge(f.category, 'info')}<span class="xs muted">${esc(MODES[f.mode])}${f.hours ? ` · ${f.hours} h` : ''}</span></div>
          <h3>${esc(f.title)}</h3>${f.provider ? `<p class="small muted">${esc(f.provider)}</p>` : ''}
          <div class="sess-nums"><span><strong>${rs.length}</strong> inscrit${rs.length > 1 ? 's' : ''}</span><span><strong>${done}</strong> terminée${done > 1 ? 's' : ''}</span>${f.validityMonths ? `<span>validité ${f.validityMonths} mois</span>` : ''}</div>${bar(pct(done, rs.length))}
          <div class="btn-row" style="margin-top:var(--sp-3)"><a class="btn btn-primary btn-sm" href="#/rh/formation/${esc(f.id)}">${icon('users', 14)} Participants</a>
            <button type="button" class="btn btn-ghost btn-sm" data-f-del="${esc(f.id)}" aria-label="Retirer la formation ${esc(f.title)}">${icon('trash', 14)} Retirer</button></div></article>`;
      }).join('') || '<div class="card"><p class="muted">Aucune formation pour l’instant. Ajoutez la première : son titre, sa durée, sa validité.</p></div>'}</div></section>`;

  host.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-sugg]');
    if (s) { host.querySelector('#n-title').value = s.dataset.sugg; host.querySelector('#n-title').focus(); return; }
    const del = e.target.closest('[data-f-del]');
    if (del) {
      const f = formations.find((x) => x.id === del.dataset.fDel);
      const n = records.filter((r) => r.formationId === f.id).length;
      if (!window.confirm(`Retirer « ${f.title} » du catalogue ?${n ? ` Les ${n} inscription(s) associée(s) seront aussi supprimées.` : ''}`)) return;
      await ctx.store.deleteFormation(f.id); ctx.toast('Formation retirée.'); await redraw();
    }
  });
  host.querySelector('#f-new').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = readForm(host, 'n'); const err = host.querySelector('#n-err');
    if (v.title.length < 3) { err.textContent = 'Saisissez un titre (3 caractères minimum).'; return; }
    if (formations.some((f) => f.title.toLowerCase() === v.title.toLowerCase())) { err.textContent = 'Une formation porte déjà ce titre.'; return; }
    const f = await ctx.store.saveFormation({ ...v, companyId: company.id });
    ctx.toast('Formation ajoutée.'); ctx.go(`/rh/formation/${f.id}`);
  });
}

/** Page d'une formation : modification et participants. */
export async function formation(ctx, root) {
  const company = await ctx.store.getCompany(ctx.user.companyId);
  const id = ctx.params.id;
  const draw = async () => {
    const f = await ctx.store.getFormation(id);
    if (!f || f.companyId !== company.id) { (await import('./notfound.js')).default(ctx, root); return; }
    const { records, employees } = await loadAll(ctx, company);
    if (!ctx.alive()) return;
    ctx.setTitle(f.title);
    const mine = records.filter((r) => r.formationId === f.id);
    const empById = new Map(employees.map((e) => [e.id, e]));
    const free = employees.filter((e) => !mine.some((r) => r.employeeId === e.id)).sort((a, b) => a.name.localeCompare(b.name));
    root.innerHTML = `<div class="container page">
      ${pageHead({ crumbs: [{ label: 'Espace entreprise', href: '#/rh' }, { label: 'Mes formations', href: '#/rh?vue=formations' }, { label: f.title }], back: '#/rh?vue=formations', eyebrow: f.category, title: f.title,
        text: [MODES[f.mode], f.hours ? `${f.hours} h` : '', f.provider, f.validityMonths ? `validité ${f.validityMonths} mois` : 'validité illimitée'].filter(Boolean).join(' · ') })}
      ${f.description ? `<div class="card"><p>${esc(f.description).replace(/\n/g, '<br>')}</p></div>` : ''}
      <div class="btn-row" style="margin:var(--sp-4) 0">${f.url ? `<a class="btn btn-outline btn-sm" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${icon('link', 14)} Ouvrir le support</a>` : ''}
        <details class="inline-details"><summary class="btn btn-light btn-sm">${icon('edit', 14)} Modifier la formation</summary>
          <form id="f-edit" class="card" novalidate style="margin-top:var(--sp-3)">${formFields(f, 'x')}<div class="field-error" id="x-err" role="alert"></div>
            <div class="btn-row"><button class="btn btn-primary" type="submit">Enregistrer</button><button type="button" class="btn btn-danger btn-sm" id="f-del">${icon('trash', 14)} Retirer la formation</button></div></form></details></div>

      <section class="block"><h2>Participants (${mine.length})</h2>
        ${mine.length ? `<div class="table-wrap"><table class="table"><caption class="sr-only">Participants à la formation</caption><thead><tr><th>Collaborateur</th><th>Statut</th><th>Date</th><th>Fin de validité</th><th></th></tr></thead><tbody>
          ${mine.map((r) => { const e = empById.get(r.employeeId); const until = f.validityMonths && r.status === 'done' && r.doneAt ? addMonths(r.doneAt, f.validityMonths) : null;
            return `<tr><td><a class="emp-inline" href="#/rh/equipe/${esc(e.id)}">${avatar(e, 36)}<strong>${esc(e.name)}</strong></a></td>
              <td><select class="sel-sm" data-rec-status="${esc(r.id)}" aria-label="Statut de ${esc(e.name)}">${Object.entries(REC_STATUS).map(([k, v]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></td>
              <td class="nowrap"><input type="date" class="sel-sm" data-rec-date="${esc(r.id)}" value="${r.date ? fmtDateInput(r.date) : ''}" aria-label="Date pour ${esc(e.name)}"></td>
              <td class="nowrap">${until ? (until < Date.now() ? badge(`Expirée le ${fmtDate(until)}`, 'ko') : badge(fmtDate(until), 'ok')) : '—'}</td>
              <td><button type="button" class="btn btn-ghost btn-sm" data-rec-del="${esc(r.id)}" aria-label="Retirer ${esc(e.name)}">${icon('x', 14)} Retirer</button></td></tr>`; }).join('')}</tbody></table></div>`
          : '<div class="card"><p class="muted">Personne n’est encore inscrit à cette formation.</p></div>'}
        <details class="card add-box" style="margin-top:var(--sp-4)" ${mine.length ? '' : 'open'}><summary class="btn btn-outline btn-sm">${icon('plus', 14)} Inscrire des collaborateurs</summary>
          ${free.length ? `<form id="rec-form" novalidate style="margin-top:var(--sp-4)"><fieldset class="pick-list"><legend class="label">Collaborateurs à inscrire</legend>
            ${free.map((e) => `<label class="pick"><input type="checkbox" name="emp" value="${esc(e.id)}">${avatar(e, 32)}<span>${esc(e.name)}<span class="xs muted"> ${esc(e.team || '')}</span></span></label>`).join('')}</fieldset>
            <div class="form-grid"><div class="field"><label for="r-status">Statut</label><select id="r-status">${Object.entries(REC_STATUS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
              <div class="field"><label for="r-date">Date</label><input id="r-date" type="date" value="${fmtDateInput(Date.now())}"></div></div>
            <div class="field-error" id="r-err" role="alert"></div><button class="btn btn-primary" type="submit">Inscrire</button></form>`
          : `<p class="muted small" style="margin-top:var(--sp-3)">${employees.length ? 'Tous vos collaborateurs sont déjà inscrits.' : 'Aucun collaborateur : ajoutez-en dans « Mes équipes ».'}</p>`}</details></section></div>`;
  };
  await draw();
  if (!ctx.alive()) return;

  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = await ctx.store.getFormation(id);
    if (e.target.id === 'f-edit') {
      const v = readForm(root, 'x');
      if (v.title.length < 3) { root.querySelector('#x-err').textContent = 'Saisissez un titre (3 caractères minimum).'; return; }
      await ctx.store.saveFormation({ ...f, ...v }); ctx.toast('Formation enregistrée.'); await draw();
    } else if (e.target.id === 'rec-form') {
      const ids = [...root.querySelectorAll('input[name="emp"]:checked')].map((i) => i.value);
      if (!ids.length) { root.querySelector('#r-err').textContent = 'Cochez au moins un collaborateur.'; return; }
      const status = root.querySelector('#r-status').value; const date = dayTs(root.querySelector('#r-date').value) || Date.now();
      for (const eid of ids) await ctx.store.saveFormationRecord({ companyId: company.id, formationId: f.id, employeeId: eid, status, date });
      ctx.toast(`${ids.length} collaborateur(s) inscrit(s).`); await draw();
    }
  });
  root.addEventListener('change', async (e) => {
    const st = e.target.closest('[data-rec-status]'); const dt = e.target.closest('[data-rec-date]');
    const rid = st ? st.dataset.recStatus : dt ? dt.dataset.recDate : null; if (!rid) return;
    const r = (await ctx.store.listFormationRecords(company.id, { formationId: id })).find((x) => x.id === rid); if (!r) return;
    if (st) await ctx.store.saveFormationRecord({ ...r, status: st.value, doneAt: st.value === 'done' ? (r.date || Date.now()) : null });
    else { const t = dayTs(dt.value); await ctx.store.saveFormationRecord({ ...r, date: t, doneAt: r.status === 'done' && t ? t : r.doneAt }); }
    ctx.toast('Mis à jour.'); await draw();
  });
  root.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-rec-del]');
    if (del) { await ctx.store.deleteFormationRecord(del.dataset.recDel); ctx.toast('Participant retiré.'); await draw(); return; }
    if (e.target.closest('#f-del')) {
      const f = await ctx.store.getFormation(id);
      if (!window.confirm(`Retirer « ${f.title} » et toutes ses inscriptions ?`)) return;
      await ctx.store.deleteFormation(id); ctx.toast('Formation retirée.'); ctx.go('/rh?vue=formations');
    }
  });
}

/** Bloc « Formations de l'entreprise » dans la fiche d'un collaborateur. */
export async function employeeFormations(ctx, company, emp) {
  const [formations, records] = await Promise.all([ctx.store.listFormations(company.id), ctx.store.listFormationRecords(company.id, { employeeId: emp.id })]);
  const fById = new Map(formations.map((f) => [f.id, f]));
  const mine = records.filter((r) => fById.has(r.formationId));
  const free = formations.filter((f) => !mine.some((r) => r.formationId === f.id));
  return `<section class="block" id="emp-formations"><div class="split"><h2>Formations de l’entreprise</h2><a class="btn btn-light btn-sm" href="#/rh?vue=formations">Gérer le catalogue</a></div>
    ${mine.length ? `<div class="card"><ul class="due-list">${mine.map((r) => { const f = fById.get(r.formationId); const until = f.validityMonths && r.status === 'done' && r.doneAt ? addMonths(r.doneAt, f.validityMonths) : null;
      return `<li>${badge(REC_STATUS[r.status].label, REC_STATUS[r.status].tone)}<span><a href="#/rh/formation/${esc(f.id)}"><strong>${esc(f.title)}</strong></a><br><span class="xs muted">${esc(f.category)}${r.date ? ` · ${fmtDate(r.date)}` : ''}${until ? ` · valable jusqu’au ${fmtDate(until)}` : ''}</span></span>
        <button type="button" class="btn btn-ghost btn-sm" data-emp-rec-del="${esc(r.id)}" aria-label="Retirer ${esc(f.title)}">${icon('x', 14)}</button></li>`; }).join('')}</ul></div>` : '<div class="card"><p class="muted">Aucune formation de l’entreprise pour ce collaborateur.</p></div>'}
    ${free.length ? `<form id="emp-rec-form" class="due-pick" novalidate><label for="er-f" class="label">Inscrire à</label><select id="er-f">${free.map((f) => `<option value="${esc(f.id)}">${esc(f.title)}</option>`).join('')}</select><button class="btn btn-outline btn-sm" type="submit">${icon('plus', 14)} Inscrire</button></form>`
      : `<p class="xs muted" style="margin-top:var(--sp-3)">${formations.length ? 'Toutes les formations du catalogue sont déjà attribuées.' : 'Créez d’abord une formation dans « Mes formations ».'}</p>`}</section>`;
}
