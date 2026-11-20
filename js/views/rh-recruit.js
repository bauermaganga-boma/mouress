// Recrutements : liste des postes ouverts et page d'un recrutement (classement, filtres, relance, retrait, comparaison, décisions, CSV).
import { CONFIG } from '../../config.js';
import { esc, fmtDate, fmtDuration, pct, downloadFile, toCsv, absUrl, isEmail } from '../util.js';
import { icon, badge, bar, statusBadge, whatsappLink } from '../ui.js';
import { attemptsUsed } from '../pass.js';
import { matrixThemes } from '../skills.js';

const DAY = 86400000;
const STATUS_TXT = { invited: 'Invité', training: 'En formation', started: 'En examen', passed: 'Réussi', failed: 'Échoué', expired: 'Expiré' };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Meilleur examen terminé d'un candidat (score le plus élevé). */
const bestAttempt = (inv) => (inv.attempts || []).filter((a) => a.status === 'done').sort((a, b) => b.percent - a.percent)[0] || null;

/** Candidat à relancer : n'a pas encore commencé (ni formation ni examen) ou n'a pas repris depuis longtemps. */
const toRemind = (inv) => inv.status === 'invited' || inv.status === 'expired';

export function recruitCounts(s) {
  const inv = s.invitations;
  return {
    invited: inv.length,
    training: inv.filter((i) => i.status === 'training').length,
    exam: inv.filter((i) => i.status === 'started').length,
    done: inv.filter((i) => bestAttempt(i)).length,
    passed: inv.filter((i) => i.status === 'passed').length,
    hired: inv.filter((i) => i.decision === 'hired').length,
    rejected: inv.filter((i) => i.decision === 'rejected').length,
    remind: inv.filter(toRemind).length,
  };
}

/** Onglet « Recrutements » du tableau de bord : un recrutement = un poste + un intitulé + un statut + une date limite. */
export function recruitListHTML(sessions, data) {
  const list = sessions.filter((s) => s.type === 'recruitment');
  if (!list.length) {
    return `<div class="card"><h3>Aucun recrutement pour l’instant</h3><p class="muted">Ouvrez un recrutement : choisissez le poste, invitez vos candidats par un Pass, comparez les résultats.</p><a class="btn btn-primary" href="#/rh/inviter?type=recruitment">${icon('plus', 18)} Nouveau recrutement</a></div>`;
  }
  const card = (s) => {
    const c = recruitCounts(s); const p = data.profiles.find((x) => x.id === s.profileId);
    const late = s.status !== 'closed' && s.deadline && s.deadline < Date.now();
    return `<a class="card card-link sess" href="#/rh/session/${esc(s.id)}">
      <div class="split" style="align-items:flex-start"><span class="btn-row" style="gap:.35rem">${badge(s.status === 'closed' ? 'Clôturé' : 'Ouvert', s.status === 'closed' ? '' : 'ok')}${late ? badge('Date dépassée', 'ko') : ''}${c.remind && s.status !== 'closed' ? badge(`${c.remind} à relancer`, 'warn') : ''}</span><span class="xs muted">${s.deadline ? 'jusqu’au ' + fmtDate(s.deadline) : ''}</span></div>
      <h3>${esc(s.title)}</h3><p class="muted small">${esc(p?.name || s.profileId)}</p>
      <div class="sess-nums"><span><strong>${c.invited}</strong> candidat${c.invited > 1 ? 's' : ''}</span><span><strong>${c.training + c.exam}</strong> en cours</span><span><strong>${c.done}</strong> examen${c.done > 1 ? 's' : ''} passé${c.done > 1 ? 's' : ''}</span><span><strong>${c.passed}</strong> réussi${c.passed > 1 ? 's' : ''}</span><span><strong>${c.hired}</strong> retenu${c.hired > 1 ? 's' : ''}</span></div>
      ${bar(pct(c.done, c.invited))}</a>`;
  };
  const open = list.filter((s) => s.status !== 'closed'); const closed = list.filter((s) => s.status === 'closed');
  return `${open.length ? `<div class="grid grid-2">${open.map(card).join('')}</div>` : '<p class="muted">Aucun recrutement ouvert.</p>'}
    ${closed.length ? `<h3 style="margin-top:var(--sp-5)">Clôturés</h3><div class="grid grid-2">${closed.map(card).join('')}</div>` : ''}`;
}

/** Frise d'avancement d'un candidat : Invité → Formation → Examen → Résultat → Décision. */
function stepper(inv, best) {
  const hasTrain = inv.status !== 'invited' && inv.status !== 'expired';
  const examDone = !!best;
  const steps = [
    ['Invité', true],
    ['Formation', hasTrain],
    ['Examen', examDone || inv.status === 'started'],
    ['Résultat', examDone],
    ['Décision', !!inv.decision],
  ];
  const cur = steps.findIndex(([, ok]) => !ok);
  return `<ol class="stepper" aria-label="Avancement">${steps.map(([l, ok], i) => `<li class="${ok ? 'done' : i === cur ? 'now' : ''}"><i aria-hidden="true"></i><span>${l}</span></li>`).join('')}</ol>`;
}

const FILTERS = [
  ['all', 'Tous', () => true],
  ['remind', 'À relancer', (i) => toRemind(i)],
  ['going', 'En cours', (i) => i.status === 'training' || i.status === 'started'],
  ['passed', 'Réussis', (i) => i.status === 'passed'],
  ['failed', 'Non réussis', (i) => i.status === 'failed'],
  ['hired', 'Retenus', (i) => i.decision === 'hired'],
];

/** Page d'un recrutement. helpers : { sessionHead, shareButtons, addPeopleForm, bindCopy }. */
export function recruitView(env, helpers) {
  const { ctx, root, s, company } = env;
  const themes = matrixThemes(s.invitations);
  const state = { sort: 'score', picked: new Set(), compare: false, q: '', filter: 'all' };

  const rows = () => {
    const f = FILTERS.find((x) => x[0] === state.filter)[2];
    const q = norm(state.q);
    const list = s.invitations.filter((i) => f(i) && (!q || norm(`${i.name} ${i.email}`).includes(q))).map((inv) => ({ inv, best: bestAttempt(inv) }));
    const byScore = (a, b) => (b.best?.percent ?? -1) - (a.best?.percent ?? -1) || a.inv.name.localeCompare(b.inv.name);
    if (state.sort === 'name') list.sort((a, b) => a.inv.name.localeCompare(b.inv.name));
    else if (state.sort === 'status') list.sort((a, b) => STATUS_TXT[a.inv.status].localeCompare(STATUS_TXT[b.inv.status]) || byScore(a, b));
    else list.sort(byScore);
    return list;
  };

  const decisionBadge = (d) => (d === 'hired' ? badge('Retenu', 'ok') : d === 'rejected' ? badge('Refusé', 'ko') : '');

  const remindMsg = (inv) => {
    const when = s.deadline ? ` avant le ${fmtDate(s.deadline)}` : '';
    return `Bonjour ${inv.name || ''}, petit rappel de ${company.name} : votre test « ${s.title} » est à passer${when}. Votre lien personnel : ${absUrl(`#/t/${inv.token}`)}`;
  };

  const candCard = (r, rank) => {
    const { inv, best } = r;
    const th = best ? Object.entries(best.themes || {}) : [];
    const label = inv.name || inv.email || 'ce candidat';
    return `<article class="card cand ${inv.decision ? 'cand-' + inv.decision : ''}">
      <div class="cand-top"><label class="check cmp-check"><input type="checkbox" data-cmp="${esc(inv.id)}" ${state.picked.has(inv.id) ? 'checked' : ''} aria-label="Comparer ${esc(label)}"></label>
        <span class="cand-rank">${best && state.sort === 'score' ? '#' + rank : ''}</span>
        <div class="cand-id"><strong>${esc(inv.name || '—')}</strong><span class="xs muted">${esc(inv.email || 'Pas d’e-mail')}</span></div>
        <div class="cand-score">${best ? `<strong>${best.percent} %</strong><span class="xs muted">meilleur score</span>` : '<span class="muted">—</span>'}</div></div>
      ${stepper(inv, best)}
      <div class="cand-meta">${statusBadge(inv.status)} ${decisionBadge(inv.decision)} <span class="xs muted">Tentatives ${attemptsUsed(inv.attempts)} / ${CONFIG.ATTEMPTS_PER_PASS}${best ? ` · ${fmtDuration(best.durationMs)}` : ''}</span></div>
      ${th.length ? `<details class="mini"><summary class="xs">Score par thème</summary>${th.map(([t, v]) => `<div class="theme-row"><span class="xs">${esc(t)}</span><span class="xs muted">${pct(v.ok, v.total)} %</span>${bar(pct(v.ok, v.total), pct(v.ok, v.total) >= s.passMark ? 'ok' : 'ko')}</div>`).join('')}${best.synthetic ? '' : `<a class="xs" href="#/resultat/${esc(best.id)}">Voir la correction</a>`}</details>` : ''}
      <div class="btn-row cand-actions">
        <button type="button" class="btn btn-sm ${inv.decision === 'hired' ? 'btn-navy' : 'btn-light'}" data-decide="hired" data-id="${esc(inv.id)}" aria-pressed="${inv.decision === 'hired'}">${icon('check', 14)} Retenir</button>
        <button type="button" class="btn btn-sm ${inv.decision === 'rejected' ? 'btn-danger' : 'btn-light'}" data-decide="rejected" data-id="${esc(inv.id)}" aria-pressed="${inv.decision === 'rejected'}">${icon('x', 14)} Refuser</button>
        ${toRemind(inv) && s.status !== 'closed' ? `<a class="btn btn-sm btn-whatsapp" target="_blank" rel="noopener" href="${esc(whatsappLink(remindMsg(inv)))}" aria-label="Relancer ${esc(label)} par WhatsApp">${icon('whatsapp', 14)} Relancer</a>` : ''}
      </div>
      <div class="cand-link"><span class="xs muted">Lien du Pass à envoyer au candidat</span>${helpers.shareButtons(inv, s, company.name)}</div>
      <details class="cand-more"><summary class="xs">Modifier ou retirer</summary>
        <form class="cand-edit" data-edit="${esc(inv.id)}" novalidate>
          <div class="form-grid"><div class="field"><label>Nom<input type="text" name="name" value="${esc(inv.name || '')}" maxlength="120"></label></div>
          <div class="field"><label>E-mail<input type="email" name="email" value="${esc(inv.email || '')}"></label></div></div>
          <p class="field-error" role="alert"></p>
          <div class="btn-row"><button type="submit" class="btn btn-sm btn-outline">Enregistrer</button>
            <button type="button" class="btn btn-sm btn-danger-outline" data-remove="${esc(inv.id)}">${icon('x', 14)} Retirer ce candidat</button></div>
        </form></details>
    </article>`;
  };

  const compareHTML = () => {
    const chosen = s.invitations.filter((i) => state.picked.has(i.id));
    if (chosen.length < 2) return '';
    const cols = chosen.map((i) => ({ inv: i, best: bestAttempt(i) }));
    const th = themes.length ? themes : [];
    return `<section class="card compare" id="cmp"><div class="split"><h2 class="h3-sm">Comparaison</h2><button type="button" class="btn btn-sm btn-ghost" data-cmp-close>Fermer</button></div>
      <div class="table-wrap"><table class="table cmp-table"><thead><tr><th></th>${cols.map((c) => `<th>${esc(c.inv.name)}<br>${decisionBadge(c.inv.decision)}</th>`).join('')}</tr></thead><tbody>
      <tr><th>Score global</th>${cols.map((c) => `<td><strong>${c.best ? c.best.percent + ' %' : '—'}</strong></td>`).join('')}</tr>
      <tr><th>Statut</th>${cols.map((c) => `<td>${statusBadge(c.inv.status)}</td>`).join('')}</tr>
      <tr><th>Temps</th>${cols.map((c) => `<td>${c.best ? fmtDuration(c.best.durationMs) : '—'}</td>`).join('')}</tr>
      ${th.map((t) => {
        const vals = cols.map((c) => (c.best?.themes?.[t] ? pct(c.best.themes[t].ok, c.best.themes[t].total) : null));
        const max = Math.max(...vals.filter((v) => v != null), -1);
        return `<tr><th>${esc(t)}</th>${vals.map((v) => `<td>${v == null ? '—' : `<span class="${v === max && vals.filter((x) => x === max).length === 1 ? 'cmp-best' : ''}">${v} %</span>${bar(v, v >= s.passMark ? 'ok' : 'ko')}`}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table></div></section>`;
  };

  /** Liste filtrée seule : la recherche ne fait pas perdre le focus du champ. */
  const drawList = () => {
    const list = rows();
    let rank = 0;
    root.querySelector('#cand-list').innerHTML = list.length ? list.map((r) => candCard(r, r.best ? ++rank : 0)).join('')
      : `<div class="card"><p class="muted">${s.invitations.length ? 'Aucun candidat ne correspond à ce filtre.' : 'Aucun candidat pour l’instant. Ajoutez des Pass pour inviter vos premiers candidats.'}</p></div>`;
    const cnt = root.querySelector('#cand-count'); if (cnt) cnt.textContent = `${list.length} sur ${s.invitations.length}`;
    root.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
  };

  const draw = () => {
    const c = recruitCounts(s);
    const late = s.status !== 'closed' && s.deadline && s.deadline < Date.now();
    const num = (k) => s.invitations.filter(FILTERS.find((x) => x[0] === k)[2]).length;
    root.innerHTML = `<div class="container page">${helpers.sessionHead(env)}
      <div class="split recruit-status"><div class="btn-row" style="gap:.4rem">${badge(s.status === 'closed' ? 'Recrutement clôturé' : 'Recrutement ouvert', s.status === 'closed' ? '' : 'ok')}${late ? badge('Date limite dépassée', 'ko') : ''}</div>
        <div class="btn-row">${s.status === 'closed' ? '' : `<button type="button" class="btn btn-outline btn-sm" data-extend="14">${icon('clock', 14)} Prolonger de 14 jours</button>`}
        <button type="button" class="btn ${s.status === 'closed' ? 'btn-outline' : 'btn-navy'} btn-sm" data-toggle-status>${s.status === 'closed' ? 'Rouvrir le recrutement' : 'Clôturer le recrutement'}</button></div></div>
      <div class="grid grid-4 stats">
        <div class="card stat"><span class="stat-n">${c.invited}</span><span class="muted small">candidats invités</span></div>
        <div class="card stat"><span class="stat-n">${c.training + c.exam}</span><span class="muted small">en formation ou en examen</span></div>
        <div class="card stat"><span class="stat-n">${c.done}</span><span class="muted small">examens passés · ${c.passed} réussi(s)</span></div>
        <div class="card stat"><span class="stat-n">${c.hired}</span><span class="muted small">retenu(s) · ${c.rejected} refusé(s)</span></div></div>
      ${c.remind && s.status !== 'closed' ? `<div class="alert alert-warn remind-bar"><span><strong>${c.remind} candidat${c.remind > 1 ? 's' : ''} n’${c.remind > 1 ? 'ont' : 'a'} pas encore commencé.</strong> Relancez-les depuis leur fiche.</span><button type="button" class="btn btn-sm btn-light" data-filter="remind">Voir les candidats à relancer</button></div>` : ''}
      <section class="block" style="margin-top:var(--sp-4)"><div class="split"><h2>Candidats <span class="xs muted" id="cand-count"></span></h2>
        <div class="btn-row">${s.status === 'closed' ? '' : helpers.addPeopleForm(s)}<button type="button" class="btn btn-navy btn-sm" id="csv">${icon('download', 14)} Export CSV</button></div></div>
        <div class="toolbar">
          <div class="field grow"><label for="q">Rechercher</label><input id="q" type="search" placeholder="Nom ou e-mail" value="${esc(state.q)}" autocomplete="off"></div>
          <div class="field"><label for="sort">Trier par</label><select id="sort"><option value="score" ${state.sort === 'score' ? 'selected' : ''}>Classement par score</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Nom</option><option value="status" ${state.sort === 'status' ? 'selected' : ''}>Statut</option></select></div>
          <button type="button" class="btn btn-primary btn-sm" data-compare ${state.picked.size < 2 ? 'disabled' : ''}>Comparer (${state.picked.size}/3)</button></div>
        <div class="chips filter-chips" role="group" aria-label="Filtrer par état">${FILTERS.map(([k, l]) => `<button type="button" class="chip chip-btn" data-filter="${k}" aria-pressed="${k === state.filter}">${l} <span class="chip-n">${num(k)}</span></button>`).join('')}</div>
        <p class="xs muted">Cochez 2 ou 3 candidats pour les comparer côte à côte.</p>
        <div id="cmp-host">${state.compare ? compareHTML() : ''}</div>
        <div class="stack" id="cand-list" style="margin-top:var(--sp-3)"></div></section></div>`;
    drawList();
  };

  draw();
  helpers.bindCopy(ctx, root);

  const reloadAll = async (msg) => { if (msg) ctx.toast(msg); const fresh = await ctx.store.getSession(s.id); Object.assign(s, fresh); state.picked = new Set([...state.picked].filter((id) => s.invitations.some((i) => i.id === id))); state.compare = state.compare && state.picked.size >= 2; draw(); };

  root.addEventListener('input', (e) => { if (e.target.id === 'q') { state.q = e.target.value; drawList(); } });
  root.addEventListener('change', (e) => {
    if (e.target.id === 'sort') { state.sort = e.target.value; drawList(); return; }
    const cb = e.target.closest('[data-cmp]');
    if (cb) {
      if (cb.checked) { if (state.picked.size >= 3) { cb.checked = false; ctx.toast('Maximum 3 candidats à comparer.'); return; } state.picked.add(cb.dataset.cmp); } else state.picked.delete(cb.dataset.cmp);
      state.compare = state.compare && state.picked.size >= 2;
      const b = root.querySelector('[data-compare]'); b.disabled = state.picked.size < 2; b.textContent = `Comparer (${state.picked.size}/3)`;
    }
  });
  root.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-edit]');
    if (!f) return;
    e.preventDefault();
    const name = f.elements.name.value.trim(); const email = f.elements.email.value.trim();
    const err = f.querySelector('.field-error');
    if (name.length < 2) { err.textContent = 'Saisissez le nom du candidat.'; return; }
    if (email && !isEmail(email)) { err.textContent = 'Adresse e-mail invalide.'; return; }
    await ctx.store.updateInvitation(f.dataset.edit, { name, email });
    await reloadAll('Candidat modifié.');
  });
  root.addEventListener('click', async (e) => {
    const flt = e.target.closest('[data-filter]');
    if (flt) { state.filter = flt.dataset.filter; drawList(); root.querySelector('#cand-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const cmp = e.target.closest('[data-compare]');
    if (cmp) { state.compare = true; root.querySelector('#cmp-host').innerHTML = compareHTML(); root.querySelector('#cmp')?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (e.target.closest('[data-cmp-close]')) { state.compare = false; root.querySelector('#cmp-host').innerHTML = ''; return; }
    const dec = e.target.closest('[data-decide]');
    if (dec) {
      const inv = s.invitations.find((i) => i.id === dec.dataset.id);
      const next = inv.decision === dec.dataset.decide ? null : dec.dataset.decide;
      await ctx.store.setDecision(inv.id, next); inv.decision = next;
      draw(); return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const inv = s.invitations.find((i) => i.id === rm.dataset.remove);
      const tried = attemptsUsed(inv.attempts);
      const warn = `Retirer ${inv.name || inv.email || 'ce candidat'} de ce recrutement ?\n\nSon lien ne fonctionnera plus${tried ? ' et ses résultats d’examen seront supprimés' : ''}. Le Pass payé n’est pas remboursé.`;
      if (!window.confirm(warn)) return;
      await ctx.store.removeInvitation(inv.id);
      await reloadAll('Candidat retiré.'); return;
    }
    const ext = e.target.closest('[data-extend]');
    if (ext) {
      const base = Math.max(s.deadline || 0, Date.now());
      await ctx.store.setSessionDeadline(s.id, base + Number(ext.dataset.extend) * DAY);
      await reloadAll('Date limite prolongée.'); return;
    }
    if (e.target.closest('[data-toggle-status]')) {
      s.status = s.status === 'closed' ? 'open' : 'closed';
      await ctx.store.setSessionStatus(s.id, s.status);
      ctx.toast(s.status === 'closed' ? 'Recrutement clôturé.' : 'Recrutement rouvert.');
      draw(); return;
    }
    if (e.target.closest('#csv')) {
      const rowsCsv = [['Rang', 'Candidat', 'E-mail', 'Statut', 'Décision', 'Meilleur score (%)', 'Tentatives', 'Temps', 'Date', ...themes.map((t) => `${t} (%)`)]];
      let rk = 0;
      for (const r of rows()) {
        const b = r.best;
        rowsCsv.push([b ? ++rk : '', r.inv.name, r.inv.email, STATUS_TXT[r.inv.status], { hired: 'Retenu', rejected: 'Refusé' }[r.inv.decision] || '', b ? b.percent : '', attemptsUsed(r.inv.attempts), b ? fmtDuration(b.durationMs) : '', b ? fmtDate(b.finishedAt) : '',
          ...themes.map((t) => (b?.themes?.[t] ? pct(b.themes[t].ok, b.themes[t].total) : ''))]);
      }
      downloadFile(`recrutement-${s.id}.csv`, toCsv(rowsCsv));
    }
  });
}
