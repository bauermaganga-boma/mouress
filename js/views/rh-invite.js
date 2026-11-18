// Achat de Pass : poste → personnes → paiement (simulé) → liens personnels générés APRÈS paiement.
import { CONFIG } from '../../config.js';
import { getProfilesData, getAvailability, levelOf, domainOf, branchOf, loadContent } from '../data.js';
import { esc, fmtMoney, fmtDateInput, fmtDate } from '../util.js';
import { icon, badge, pageHead } from '../ui.js';
import { pay, demoBanner, METHODS, paymentFormHTML } from '../payments.js';
import { passPrice } from '../pass.js';

const DAY = 86400000;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** « Nom, e-mail » | « Nom <e-mail> » | e-mail seul | nom seul, un par ligne. */
export function parsePeople(text, requireEmail) {
  const list = []; const errors = [];
  String(text || '').split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const m = line.match(/[^\s,<>;]+@[^\s,<>;]+\.[^\s,<>;]{2,}/);
    const email = m ? m[0] : '';
    const name = line.replace(email, '').replace(/[<>,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (requireEmail && !email) { errors.push(`Ligne ${i + 1} : e-mail manquant ou invalide (« ${line} »).`); return; }
    if (!name && !email) return;
    list.push({ name: name || email.split('@')[0], email });
  });
  return { list, errors };
}

export async function invite(ctx, root, helpers) {
  ctx.setTitle('Inviter un collaborateur ou un candidat');
  const data = await getProfilesData();
  const avail = await getAvailability();
  const company = await ctx.store.getCompany(ctx.user.companyId);
  const existing = ctx.query.get('session') ? await ctx.store.getSession(ctx.query.get('session')) : null;
  if (existing && existing.companyId !== company.id) { ctx.go('/rh'); return; }
  if (!ctx.alive()) return;

  let type = existing?.type || (ctx.query.get('type') === 'training' ? 'training' : 'recruitment');
  let profileId = existing?.profileId || ctx.query.get('profil') || '';
  const profileOf = (id) => data.profiles.find((p) => p.id === id);
  const available = (id) => !avail || !!avail[id];

  root.innerHTML = `<div class="container-narrow page">
    ${pageHead({ crumbs: [{ label: 'Espace entreprise', href: '#/rh' }, { label: 'Inviter' }], back: '#/rh', title: existing ? `Ajouter des Pass — ${existing.title}` : 'Inviter un collaborateur ou un candidat', text: 'Un Pass = une personne pour un poste : formation, entraînement illimité, examen, attestation si réussite et résultat transmis à votre entreprise.' })}
    ${demoBanner()}
    <form id="nf" class="stack" novalidate>
      ${existing ? '' : `<fieldset class="card type-pick"><legend class="label">1. Type de session</legend>
        <label class="type-opt"><input type="radio" name="type" value="recruitment"><span><strong>Recrutement</strong><span class="muted small">Candidats externes : chacun reçoit un lien personnel.</span></span></label>
        <label class="type-opt"><input type="radio" name="type" value="training"><span><strong>Montée en compétences</strong><span class="muted small">Équipe nommée : suivi avant / après et plan d’action.</span></span></label></fieldset>`}
      <div class="card" id="poste-box"><h2 class="h3-sm">${existing ? 'Poste' : '2. Poste'}</h2>
        ${existing ? `<p><strong>${esc(profileOf(profileId)?.name || profileId)}</strong></p>` : `
        <div class="field"><label for="p-q">Rechercher un poste</label><input id="p-q" type="search" placeholder="Ex. technicien, forage, comptable…" autocomplete="off"></div>
        <div class="form-grid"><div class="field"><label for="p-d">Secteur</label><select id="p-d"><option value="">Tous</option>${(data.domains || []).map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="p-l">Niveau</label><select id="p-l"><option value="">Tous</option>${(data.levels || []).map((l) => `<option value="${esc(l.id)}">${esc(l.name)} — ${esc(fmtMoney(passPrice(l.id)))}</option>`).join('')}</select></div></div>
        <div class="poste-list" id="poste-list" role="radiogroup" aria-label="Poste"></div>`}
      </div>
      <div class="card"><h2 class="h3-sm">${existing ? 'Personnes' : '3. Personnes'}</h2>
        ${existing ? '' : `<div class="field"><label for="n-title" id="l-title">Intitulé du poste</label><input id="n-title" type="text" maxlength="120"></div>
        <div class="form-grid"><div class="field"><label for="n-due" id="l-due">Date limite</label><input id="n-due" type="date" value="${fmtDateInput(Date.now() + 30 * DAY)}"></div>
        <div class="field"><label for="n-pass">Seuil de réussite</label><select id="n-pass">${[60, 70, 80].map((v) => `<option value="${v}" ${v === CONFIG.PASS_MARK ? 'selected' : ''}>${v} %</option>`).join('')}</select></div></div>`}
        <div class="field"><label for="n-people" id="l-people">Une personne par ligne : nom, e-mail</label><textarea id="n-people" placeholder="Jean Mba, jean.mba@exemple.com&#10;Marie Nzamba, marie@exemple.com"></textarea><span class="hint" id="h-people"></span></div>
      </div>
      <div class="card summary" aria-live="polite"><h2 class="h3-sm">Récapitulatif</h2><div id="sum"></div></div>
      <div class="card"><h2 class="h3-sm">Paiement</h2>
        <div class="method-pick">${METHODS.map((m, i) => `<label class="pack-opt"><input type="radio" name="method" value="${m.id}" ${i === 0 ? 'checked' : ''}><span><strong>${esc(m.label)}</strong><span class="muted small">${esc(m.hint)}</span></span></label>`).join('')}</div>
        <div id="pay-fields" style="margin-top:var(--sp-4)"></div></div>
      <div class="field-error" id="n-err" role="alert"></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit" id="pay-btn">Payer</button>
    </form>
    <div id="done"></div></div>`;

  helpers.bindCopy(ctx, root);
  const $ = (q) => root.querySelector(q);
  const method = () => root.querySelector('input[name=method]:checked').value;

  const drawList = () => {
    const box = $('#poste-list'); if (!box) return;
    const q = norm($('#p-q').value); const dm = $('#p-d').value; const lv = $('#p-l').value;
    const list = data.profiles.filter((p) => (!dm || p.domains.includes(dm)) && (!lv || p.level === lv) && (!q || norm(`${p.name} ${p.desc}`).includes(q)));
    box.innerHTML = list.map((p) => `<label class="poste-opt"><input type="radio" name="poste" value="${esc(p.id)}" ${p.id === profileId ? 'checked' : ''}>
      <span class="poste-body"><strong>${esc(p.name)}</strong><span class="xs muted">${esc(levelOf(data, p.level)?.name || '')} · ${esc(branchOf(data, p.branch)?.name || '')}</span>${available(p.id) ? '' : '<span class="badge badge-warn">Bientôt disponible</span>'}</span>
      <span class="poste-price">${esc(fmtMoney(passPrice(p.level)))}</span></label>`).join('') || '<p class="muted small">Aucun poste ne correspond.</p>';
  };

  const sync = () => {
    root.querySelectorAll('input[name=type]').forEach((r) => { r.checked = r.value === type; });
    if (!existing) {
      $('#l-title').textContent = type === 'training' ? 'Nom de l’équipe' : 'Intitulé du poste';
      $('#n-title').placeholder = type === 'training' ? 'Ex. Équipe maintenance Port-Gentil' : 'Ex. Opérateur de production — Libreville';
      $('#l-due').textContent = type === 'training' ? 'Échéance du parcours' : 'Date limite pour passer l’examen';
    }
    $('#l-people').textContent = type === 'training' ? 'Une personne par ligne : nom, e-mail (obligatoire)' : 'Une personne par ligne : nom, e-mail';
    $('#h-people').textContent = type === 'training' ? 'L’e-mail relie le collaborateur à son parcours « Mon espace ».' : 'L’e-mail est facultatif ; il sert à pré-remplir le lien.';
    const p = profileOf(profileId);
    const { list } = parsePeople($('#n-people').value, false);
    const n = list.length;
    const unit = p ? passPrice(p.level) : 0;
    $('#sum').innerHTML = p
      ? `<p class="sum-row"><span>${esc(p.name)}<br><span class="xs muted">Pass ${esc(levelOf(data, p.level)?.name || '')} · ${CONFIG.ATTEMPTS_PER_PASS} tentatives d’examen</span></span><strong>${esc(fmtMoney(unit))}</strong></p>
         <p class="sum-row"><span>Nombre de personnes</span><strong>${n}</strong></p><p class="sum-row sum-total"><span>Total</span><strong>${esc(fmtMoney(unit * n))}</strong></p>`
      : '<p class="muted">Choisissez un poste pour voir le tarif.</p>';
    $('#pay-btn').textContent = p && n ? `Payer ${fmtMoney(unit * n)} (démo) et générer les liens` : 'Payer';
    $('#pay-fields').innerHTML = paymentFormHTML(method());
  };
  const paySync = () => { $('#pay-fields').innerHTML = paymentFormHTML(method()); };

  if (!existing) drawList();
  sync();
  root.addEventListener('input', (e) => { if (['p-q'].includes(e.target.id)) drawList(); if (e.target.id === 'n-people') sync(); });
  root.addEventListener('change', (e) => {
    if (e.target.name === 'type') { type = e.target.value; sync(); }
    else if (e.target.name === 'poste') { profileId = e.target.value; sync(); }
    else if (e.target.name === 'method') paySync();
    else if (e.target.id === 'p-d' || e.target.id === 'p-l') drawList();
  });

  $('#nf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#n-err'); err.textContent = '';
    const p = profileOf(profileId);
    if (!p) { err.textContent = 'Choisissez un poste.'; return; }
    if (!available(p.id)) { err.textContent = 'Le contenu de ce poste n’est pas encore disponible : le Pass ne peut pas être vendu pour l’instant.'; return; }
    const { list, errors } = parsePeople($('#n-people').value, type === 'training');
    if (errors.length) { err.textContent = errors[0]; return; }
    if (!list.length) { err.textContent = 'Ajoutez au moins une personne.'; return; }
    let title; let due; let passMark;
    if (!existing) {
      title = $('#n-title').value.trim();
      if (title.length < 3) { err.textContent = type === 'training' ? 'Donnez un nom à l’équipe.' : 'Saisissez l’intitulé du poste.'; return; }
      due = new Date($('#n-due').value + 'T23:59:59').getTime();
      if (!due || due < Date.now()) { err.textContent = 'La date limite doit être dans le futur.'; return; }
      passMark = Number($('#n-pass').value);
    }
    const unit = passPrice(p.level);
    const btn = $('#pay-btn'); btn.disabled = true; btn.textContent = 'Paiement en cours…';
    const details = Object.fromEntries([...root.querySelectorAll('#pay-fields input')].map((i) => [i.name, i.value]));
    try {
      const res = await pay({ amount: unit * list.length, method: method(), company: { id: company.id, name: company.name }, details });
      if (!res.ok) { err.textContent = res.message || 'Le paiement a échoué.'; btn.disabled = false; sync(); return; }
      root.querySelectorAll('#pay-fields input').forEach((i) => { i.value = ''; }); // aucune donnée de paiement conservée
      let sessionId; let order;
      if (existing) { order = await ctx.store.addPasses(existing.id, list, unit, res, p.name); sessionId = existing.id; }
      else {
        const content = await loadContent(p.id);
        const qn = Math.min(CONFIG.EXAM_QUESTIONS, content?.questions.length || CONFIG.EXAM_QUESTIONS);
        const r = await ctx.store.createOrder({ companyId: company.id, type, title, profileId: p.id, profileName: p.name, level: p.level, unitPrice: unit, questionCount: qn, passMark, deadline: due, candidates: list, payment: res });
        sessionId = r.session.id; order = r.order;
      }
      const s = await ctx.store.getSession(sessionId);
      const mine = s.invitations.filter((i) => i.orderId === order.id);
      $('#nf').hidden = true;
      root.querySelector('.page-head2').hidden = true;
      root.querySelector('.demo-banner')?.setAttribute('hidden', '');
      $('#done').innerHTML = `<div class="card done-card"><div class="alert alert-ok" role="status"><strong>Paiement simulé accepté.</strong> ${list.length} Pass créé${list.length > 1 ? 's' : ''} — ${esc(fmtMoney(order.total))} (réf. ${esc(res.ref)}).</div>
        <h2 class="h3-sm">Liens personnels à envoyer</h2><p class="muted small">Chaque lien donne accès à la formation, à l’entraînement et à l’examen de la personne.</p>
        <div class="stack">${mine.map((i) => `<div class="link-row"><div><strong>${esc(i.name)}</strong><br><span class="xs muted">${esc(i.email || '')}</span></div>${helpers.shareButtons(i, s, company.name)}</div>`).join('')}</div>
        <div class="btn-row" style="margin-top:var(--sp-5)"><a class="btn btn-primary" href="#/rh/session/${esc(sessionId)}">Voir la session</a><a class="btn btn-outline" href="#/rh/recu/${esc(order.id)}">Voir le reçu</a><a class="btn btn-ghost" href="#/rh">Tableau de bord</a></div></div>`;
      window.scrollTo(0, 0);
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; sync(); }
  });
}
