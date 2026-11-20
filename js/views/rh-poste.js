// Parcours d'un poste : thématiques (obligatoires ou internes) et suivi des collaborateurs de ce poste.
import { getProfilesData, loadContent, themesOf } from '../data.js';
import { esc, fmtDate, fmtDateInput } from '../util.js';
import { CATEGORIES } from '../formations-store.js';
import { suggestFormations } from '../formation-suggest.js';
import { icon, badge, bar, avatar, pageHead } from '../ui.js';
import { KINDS, STATUS_P } from '../parcours-store.js';
import { buildModel, reviewState, nextReviewFrom, suggestFor } from '../parcours.js';
import { personalLink, personalMessage, shareHTML } from '../share.js';

const SRC = { libre: 'Thématique libre', theme: 'Thème de la plateforme', formation: 'Formation du catalogue' };
const ST_ORDER = ['a_faire', 'en_cours', 'valide'];

export async function poste(ctx, root) {
  const data = await getProfilesData();
  const profile = data.profiles.find((p) => p.id === ctx.params.id);
  if (!profile) { (await import('./notfound.js')).default(ctx, root); return; }
  const company = await ctx.store.getCompany(ctx.user.companyId);
  const content = await loadContent(profile.id);
  const tab = ctx.query.get('tab') === 'suivi' ? 'suivi' : 'parcours';
  const base = `#/rh/poste/${encodeURIComponent(profile.id)}`;
  const sector = await ctx.store.getCompanySector(company.id);
  const dayTs = (v) => (v ? new Date(v + 'T12:00:00').getTime() : null);
  ctx.setTitle(`Parcours · ${profile.name}`);
  const themeNames = content ? themesOf(content) : [];

  const draw = async () => {
    const employees = (await ctx.store.listEmployees(company.id)).filter((e) => e.profileId === profile.id).sort((a, b) => a.name.localeCompare(b.name));
    const model = await buildModel(ctx, company, employees);
    const items = model.byProfile.get(profile.id) || [];
    const formations = model.formations;
    const sugg = await suggestFor(profile.id, items);
    const ideas = suggestFormations(profile, sector, [...items.map((i) => i.title), ...formations.map((f) => f.title)]);
    if (!ctx.alive()) return;
    const per = employees.map((e) => model.per.get(e.id));
    const avg = per.length && items.length ? Math.round(per.reduce((a, x) => a + x.pct, 0) / per.length) : null;
    const hours = items.reduce((a, i) => a + (i.hours || 0), 0);
    const tabs = [['parcours', 'Thématiques du poste'], ['suivi', 'Suivi des collaborateurs']];

    const itemCard = (it, k) => {
      const src = it.source === 'theme' ? `${SRC.theme} : ${it.theme}` : it.source === 'formation' ? `${SRC.formation} : ${formations.find((f) => f.id === it.formationId)?.title || 'supprimée'}` : SRC.libre;
      const q = it.source === 'theme' && content ? content.questions.filter((x) => x.theme === it.theme).length : 0;
      return `<article class="card th-card" data-id="${esc(it.id)}"><div class="th-order"><button type="button" class="btn btn-ghost btn-sm" data-mv="-1" aria-label="Monter" ${k === 0 ? 'disabled' : ''}>▲</button><span class="th-n">${k + 1}</span><button type="button" class="btn btn-ghost btn-sm" data-mv="1" aria-label="Descendre" ${k === items.length - 1 ? 'disabled' : ''}>▼</button></div>
        <div class="th-main"><div class="btn-row" style="gap:.35rem">${badge(KINDS[it.kind].label, KINDS[it.kind].tone)}${it.hours ? `<span class="xs muted">${it.hours} h</span>` : ''}${it.due ? `<span class="xs muted">· échéance ${fmtDate(it.due)}</span>` : ''}</div>
          <h3>${esc(it.title)}</h3><p class="xs muted">${esc(src)}${q ? ` · ${q} questions` : ''}</p>${it.note ? `<p class="small">${esc(it.note)}</p>` : ''}</div>
        <div class="th-act"><details class="inline-details"><summary class="btn btn-light btn-sm">${icon('edit', 14)} Modifier</summary>
          <form class="th-edit card" data-edit="${esc(it.id)}" novalidate>${fields(it, 'e' + k)}<button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></form></details>
          <button type="button" class="btn btn-ghost btn-sm" data-del="${esc(it.id)}" aria-label="Retirer ${esc(it.title)}">${icon('trash', 14)}</button></div></article>`;
    };
    const fields = (it = {}, p = 'n') => `<div class="field"><label for="${p}-t">Titre de la thématique</label><input id="${p}-t" type="text" maxlength="160" required value="${esc(it.title || '')}" placeholder="Ex. Passation de poste, tutorat, retour d’expérience"></div>
      <div class="form-grid"><div class="field"><label for="${p}-k">Type</label><select id="${p}-k">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === (it.kind || 'interne') ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="${p}-s">Origine</label><select id="${p}-s" data-src>${Object.entries(SRC).map(([k, v]) => `<option value="${k}" ${k === (it.source || 'libre') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
        <div class="field src-theme" ${(it.source || 'libre') === 'theme' ? '' : 'hidden'}><label for="${p}-th">Thème de la plateforme</label><select id="${p}-th">${themeNames.map((t) => `<option value="${esc(t.name)}" ${t.name === it.theme ? 'selected' : ''}>${esc(t.name)}</option>`).join('') || '<option value="">Aucun thème</option>'}</select></div>
        <div class="field src-formation" ${(it.source || 'libre') === 'formation' ? '' : 'hidden'}><label for="${p}-f">Formation du catalogue</label><select id="${p}-f">${formations.map((f) => `<option value="${esc(f.id)}" ${f.id === it.formationId ? 'selected' : ''}>${esc(f.title)}</option>`).join('') || '<option value="">Catalogue vide</option>'}</select></div>
        <div class="field"><label for="${p}-h">Durée (heures)</label><input id="${p}-h" type="number" min="0" max="999" inputmode="numeric" value="${it.hours || ''}"></div>
        <div class="field"><label for="${p}-due">Échéance par défaut</label><input id="${p}-due" type="date" value="${it.due ? fmtDateInput(it.due) : ''}"></div></div>
      <div class="field"><label for="${p}-n">Précisions (facultatif)</label><input id="${p}-n" type="text" maxlength="300" value="${esc(it.note || '')}" placeholder="Qui transmet, comment c’est validé…"></div>`;

    const parcoursHTML = `<section class="block"><div class="split"><h2>Série de thématiques</h2><span class="muted small">${items.length} thématique${items.length > 1 ? 's' : ''} · ${hours} h</span></div>
      <p class="muted small">Ce que doit maîtriser une personne à ce poste : les modules obligatoires et vos thématiques internes de montée en compétences. Chaque collaborateur du poste reçoit cette série automatiquement.</p>
      <div class="stack">${items.map(itemCard).join('') || '<div class="card"><p class="muted">Aucune thématique pour l’instant. Partez des suggestions ci-dessous ou ajoutez les vôtres.</p></div>'}</div>
      ${sugg.length ? `<div class="card sugg-card"><div class="split"><h3>Suggestions pour ce poste</h3><button type="button" class="btn btn-primary btn-sm" data-add-all>${icon('plus', 14)} Tout ajouter (obligatoires)</button></div>
        <p class="xs muted">Thèmes de la plateforme pour ce poste, validés automatiquement par les résultats d’examen.</p>
        <div class="chips">${sugg.map((s, i) => `<button type="button" class="chip" data-add-sugg="${i}" title="${s.count} questions">+ ${esc(s.title)}</button>`).join('')}</div></div>` : ''}
      ${ideas.length ? `<div class="card sugg-card"><h3>Formations cohérentes avec ce poste</h3><p class="xs muted">Classées selon votre secteur, le niveau et l’intitulé du poste. L’ajout crée la formation dans votre catalogue et l’ajoute au parcours.</p>
        <ul class="idea-list">${ideas.map((f, i) => `<li><span class="idea-t"><strong>${esc(f.title)}</strong><span class="xs muted">${esc(f.category)} · ${f.hours} h${f.validityMonths ? ` · validité ${f.validityMonths} mois` : ''}${f.match ? ' · adaptée à ce poste' : ''}</span></span><button type="button" class="btn btn-light btn-sm" data-add-idea="${i}">${icon('plus', 14)} Ajouter</button></li>`).join('')}</ul></div>` : ''}
      <details class="card add-box" style="margin-top:var(--sp-4)"><summary class="btn btn-outline btn-sm">${icon('plus', 14)} Créer une formation pour ce poste</summary>
        <form id="fm-new" novalidate style="margin-top:var(--sp-4)"><div class="field"><label for="fm-t">Titre de la formation</label><input id="fm-t" type="text" maxlength="120" placeholder="Ex. Habilitation électrique BR, parcours de tutorat"></div>
          <div class="form-grid"><div class="field"><label for="fm-c">Catégorie</label><select id="fm-c">${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div><div class="field"><label for="fm-k">Type</label><select id="fm-k">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
            <div class="field"><label for="fm-h">Durée (heures)</label><input id="fm-h" type="number" min="0" max="999" inputmode="numeric"></div><div class="field"><label for="fm-v">Validité (mois, 0 = illimitée)</label><input id="fm-v" type="number" min="0" max="120" inputmode="numeric" value="0"></div>
            <div class="field"><label for="fm-p">Organisme ou formateur</label><input id="fm-p" type="text" maxlength="120"></div><div class="field"><label for="fm-d">Échéance par défaut</label><input id="fm-d" type="date"></div></div>
          <div class="field-error" id="fm-err" role="alert"></div><button class="btn btn-primary" type="submit">Créer et ajouter au poste</button></form></details>
      <details class="card add-box" ${items.length ? '' : 'open'} style="margin-top:var(--sp-4)"><summary class="btn btn-outline btn-sm">${icon('plus', 14)} Ajouter une thématique interne</summary>
        <form id="th-new" novalidate style="margin-top:var(--sp-4)">${fields({}, 'n')}<div class="field-error" id="th-err" role="alert"></div><button class="btn btn-primary" type="submit">Ajouter au parcours</button></form></details></section>`;

    const cell = (r, e) => {
      const key = `${e.id}|${r.item.id}`;
      return `<td class="sv sv-${r.status}"><select class="sel-sm sv-sel" data-sv="${esc(key)}" aria-label="${esc(r.item.title)} pour ${esc(e.name)}">
        <option value="auto" ${r.auto ? 'selected' : ''}>${r.auto ? STATUS_P[r.status].label + ' (auto)' : 'Automatique'}</option>
        ${ST_ORDER.map((k) => `<option value="${k}" ${!r.auto && r.status === k ? 'selected' : ''}>${STATUS_P[k].label}</option>`).join('')}</select>${r.via ? `<span class="xs muted">${esc(r.via)}</span>` : ''}
        <input type="date" class="sel-sm sv-due ${r.late ? 'is-late' : ''}" data-svdue="${esc(key)}" value="${r.due ? fmtDateInput(r.due) : ''}" aria-label="Échéance : ${esc(r.item.title)} pour ${esc(e.name)}" title="Échéance"></td>`;
    };
    const suiviHTML = `<section class="block"><div class="split"><h2>Suivi et mise à jour</h2><span class="muted small">${employees.length} collaborateur${employees.length > 1 ? 's' : ''}</span></div>
      <p class="muted small">« Automatique » : statut déduit des examens de la plateforme et des inscriptions aux formations. Choisissez un statut pour le fixer vous-même (mise en situation, tutorat, validation du responsable), et adaptez l’échéance de chaque personne.</p>
      <p class="sv-legend"><span class="l-ok">Validé</span><span class="l-mid">En cours</span><span>À faire</span><span class="l-ko">Échéance dépassée (date en rouge)</span></p>
      ${!items.length ? '<div class="card"><p class="muted">Définissez d’abord les thématiques du poste.</p></div>' : !employees.length ? '<div class="card"><p class="muted">Aucun collaborateur n’occupe ce poste. Ajoutez-en dans « Mes équipes » en choisissant ce poste.</p></div>'
      : `<div class="table-wrap"><table class="table matrix sv-table"><caption class="sr-only">Suivi des thématiques par collaborateur</caption><thead><tr><th>Collaborateur</th>${items.map((i) => `<th>${esc(i.title)}<br>${badge(KINDS[i.kind].label, KINDS[i.kind].tone)}</th>`).join('')}<th>Progression</th><th>Revue</th></tr></thead><tbody>
        ${employees.map((e) => { const x = model.per.get(e.id); const rs = reviewState(x.review);
          return `<tr><td><a class="emp-inline" href="#/rh/equipe/${esc(e.id)}">${avatar(e, 32)}<strong>${esc(e.name)}</strong></a></td>${x.rows.map((r) => cell(r, e)).join('')}
            <td class="nowrap"><strong>${x.pct} %</strong>${bar(x.pct, x.pct >= 70 ? 'ok' : x.pct < 40 ? 'ko' : '')}</td>
            <td>${badge(rs.label, rs.tone)}<br><button type="button" class="btn btn-light btn-sm" data-review="${esc(e.id)}">Revue faite</button></td></tr>`; }).join('')}</tbody></table></div>
        <h3 style="margin-top:var(--sp-5)">Envoyer le lien de parcours</h3><div class="stack">${(await Promise.all(employees.map(async (e) => { const link = await personalLink(ctx, e); return `<div class="card link-row"><div class="emp-inline">${avatar(e, 32)}<strong>${esc(e.name)}</strong></div>${shareHTML({ link, message: personalMessage(e, company, link), subject: `Votre parcours de formation · ${profile.name}`, email: e.email, who: e.name })}</div>`; }))).join('')}</div>`}</section>`;

    root.innerHTML = `<div class="container page">
      ${pageHead({ crumbs: [{ label: 'Espace entreprise', href: '#/rh' }, { label: 'Mes formations', href: '#/rh?vue=formations' }, { label: profile.name }], back: '#/rh?vue=formations', eyebrow: 'Parcours de poste', title: profile.name, text: 'Thématiques obligatoires et internes de ce poste, suivi des collaborateurs.' })}
      <div class="grid grid-4 stats"><div class="card stat"><span class="stat-n">${items.length}</span><span class="muted small">thématiques</span></div>
        <div class="card stat"><span class="stat-n">${hours} h</span><span class="muted small">de montée en compétences</span></div>
        <div class="card stat"><span class="stat-n">${employees.length}</span><span class="muted small">collaborateur${employees.length > 1 ? 's' : ''} sur ce poste</span></div>
        <div class="card stat"><span class="stat-n">${avg == null ? '—' : avg + ' %'}</span><span class="muted small">progression moyenne</span></div></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<a role="tab" class="tab" href="${base}?tab=${k}" aria-selected="${k === tab}">${l}</a>`).join('')}</div>
      <div class="tab-body">${tab === 'suivi' ? suiviHTML : parcoursHTML}</div></div>`;
    root._m = { items, sugg, ideas, employees, model };
  };
  await draw();
  if (!ctx.alive()) return;

  const read = (scope, p) => {
    const g = (s) => scope.querySelector(`#${p}-${s}`);
    const source = g('s').value;
    return { title: g('t').value.trim(), kind: g('k').value, source, theme: g('th')?.value || '', formationId: g('f')?.value || '', hours: g('h').value, note: g('n').value, due: dayTs(g('due').value) };
  };
  root.addEventListener('change', async (e) => {
    const src = e.target.closest('[data-src]');
    if (src) { const f = src.closest('form'); f.querySelector('.src-theme').hidden = src.value !== 'theme'; f.querySelector('.src-formation').hidden = src.value !== 'formation'; return; }
    const svd = e.target.closest('[data-svdue]');
    if (svd) {
      const [employeeId, itemId] = svd.dataset.svdue.split('|');
      await ctx.store.setSuivi({ companyId: company.id, employeeId, itemId, due: dayTs(svd.value) });
      ctx.toast('Échéance mise à jour.'); await draw(); return;
    }
    const sv = e.target.closest('[data-sv]');
    if (sv) {
      const [employeeId, itemId] = sv.dataset.sv.split('|');
      await ctx.store.setSuivi({ companyId: company.id, employeeId, itemId, status: sv.value });
      ctx.toast('Suivi mis à jour.'); await draw();
    }
  });
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = root._m;
    if (e.target.id === 'fm-new') {
      const g = (x) => root.querySelector(`#fm-${x}`); const title = g('t').value.trim();
      if (title.length < 3) { root.querySelector('#fm-err').textContent = 'Saisissez un titre (3 caractères minimum).'; return; }
      await addFormationToPoste({ title, category: g('c').value, hours: g('h').value, validityMonths: g('v').value, provider: g('p').value }, g('k').value, dayTs(g('d').value));
      ctx.toast('Formation créée et ajoutée au poste.'); await draw(); return;
    }
    if (e.target.id === 'th-new') {
      const v = read(e.target, 'n');
      if (v.title.length < 3) { root.querySelector('#th-err').textContent = 'Saisissez un titre (3 caractères minimum).'; return; }
      if (m.items.some((i) => i.title.toLowerCase() === v.title.toLowerCase())) { root.querySelector('#th-err').textContent = 'Cette thématique existe déjà pour ce poste.'; return; }
      await ctx.store.saveThematique({ ...v, companyId: company.id, profileId: profile.id }); ctx.toast('Thématique ajoutée.'); await draw(); return;
    }
    const id = e.target.dataset.edit;
    if (id) {
      const it = m.items.find((i) => i.id === id); const p = e.target.querySelector('input').id.split('-')[0];
      const v = read(e.target, p);
      if (v.title.length < 3) return;
      await ctx.store.saveThematique({ ...it, ...v }); ctx.toast('Thématique enregistrée.'); await draw();
    }
  });
  /** Crée (ou retrouve) la formation du catalogue puis l'ajoute au parcours du poste. */
  const addFormationToPoste = async (f, kind, due) => {
    const have = (await ctx.store.listFormations(company.id)).find((x) => x.title.toLowerCase() === f.title.toLowerCase());
    const row = have || await ctx.store.saveFormation({ ...f, companyId: company.id });
    await ctx.store.saveThematique({ companyId: company.id, profileId: profile.id, title: row.title, kind, source: 'formation', formationId: row.id, hours: row.hours, due });
  };
  root.addEventListener('click', async (e) => {
    const m = root._m;
    const idea = e.target.closest('[data-add-idea]');
    if (idea) { const f = m.ideas[Number(idea.dataset.addIdea)]; await addFormationToPoste(f, ['Sécurité', 'Réglementaire'].includes(f.category) ? 'obligatoire' : 'interne', null); ctx.toast('Formation ajoutée au poste.'); await draw(); return; }
    const mv = e.target.closest('[data-mv]');
    if (mv) { await ctx.store.moveThematique(mv.closest('.th-card').dataset.id, Number(mv.dataset.mv)); await draw(); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      const it = m.items.find((i) => i.id === del.dataset.del);
      if (!window.confirm(`Retirer « ${it.title} » du parcours ? Le suivi saisi pour cette thématique sera supprimé.`)) return;
      await ctx.store.deleteThematique(it.id); ctx.toast('Thématique retirée.'); await draw(); return;
    }
    const add = e.target.closest('[data-add-sugg]');
    if (add) { const s = m.sugg[Number(add.dataset.addSugg)]; await ctx.store.saveThematique({ companyId: company.id, profileId: profile.id, title: s.title, kind: 'obligatoire', source: 'theme', theme: s.theme, hours: s.hours }); ctx.toast('Thématique ajoutée.'); await draw(); return; }
    if (e.target.closest('[data-add-all]')) { for (const s of m.sugg) await ctx.store.saveThematique({ companyId: company.id, profileId: profile.id, title: s.title, kind: 'obligatoire', source: 'theme', theme: s.theme, hours: s.hours }); ctx.toast(`${m.sugg.length} thématique(s) ajoutée(s).`); await draw(); return; }
    const rv = e.target.closest('[data-review]');
    if (rv) { const now = Date.now(); await ctx.store.saveReview({ companyId: company.id, employeeId: rv.dataset.review, last: now, next: nextReviewFrom(now) }); ctx.toast('Revue enregistrée, prochaine dans 90 jours.'); await draw(); }
  });
}
