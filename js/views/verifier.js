import { getProfilesData } from '../data.js';
import { esc, fmtDate, CODE_RE } from '../util.js';
import { icon } from '../ui.js';

export default async function render(ctx, root) {
  ctx.setTitle('Vérifier une attestation');
  const data = await getProfilesData();
  const initial = (ctx.query.get('code') || '').trim().toUpperCase();
  const demo = ctx.store.kind === 'local' ? 'MRS-2026-K7M2QX' : '';
  root.innerHTML = `<div class="container-narrow page">
    <div class="page-head"><h1>Vérifier une attestation</h1>
    <p>Saisissez le code figurant sur l’attestation (format <strong>MRS-AAAA-XXXXXX</strong>) ou scannez son QR code.</p></div>
    <form class="card" id="vf" novalidate>
      <div class="field"><label for="code">Code d’attestation</label><input id="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="MRS-2026-ABC123" value="${esc(initial)}"></div>
      <div class="btn-row"><button class="btn btn-primary" type="submit">${icon('search', 18)} Vérifier</button>${demo ? `<button type="button" class="btn btn-ghost btn-sm" id="demo">Utiliser un code de démonstration</button>` : ''}</div>
    </form>
    <div id="out" aria-live="polite" style="margin-top:var(--sp-5)"></div>
    <p class="xs muted" style="margin-top:var(--sp-5)">Une attestation MOURESS Académie atteste de la réussite à un test d’aptitude. Elle ne constitue pas un diplôme officiel.</p></div>`;

  const out = root.querySelector('#out');
  const input = root.querySelector('#code');
  const check = async () => {
    const code = input.value.trim().toUpperCase();
    if (!CODE_RE.test(code)) { out.innerHTML = `<div class="alert alert-ko">Format de code invalide. Exemple : MRS-2026-ABC123.</div>`; return; }
    const cert = await ctx.store.getCertificate(code);
    if (!cert) { out.innerHTML = `<div class="alert alert-ko"><strong>Code non reconnu.</strong> Aucune attestation ne correspond à ${esc(code)}. Vérifiez la saisie.</div>`; return; }
    const profile = data.profiles.find((p) => p.id === cert.profileId);
    out.innerHTML = `<div class="card verified"><span class="badge badge-ok">${icon('check', 14)} Attestation authentique</span>
      <h2 class="h1-md" style="margin-top:.6rem">${esc(cert.name)}</h2>
      <dl class="dl"><div><dt>Test réussi</dt><dd>${esc(profile?.name || cert.profileName || cert.profileId)}</dd></div>
      <div><dt>Score</dt><dd>${esc(cert.percent)} % (seuil ${esc(cert.passMark)} %)</dd></div>
      <div><dt>Délivrée le</dt><dd>${esc(fmtDate(cert.date))}</dd></div>
      <div><dt>Code</dt><dd>${esc(cert.code)}</dd></div></dl>
      <a class="btn btn-outline" href="#/attestation/${esc(cert.code)}">Voir l’attestation</a></div>`;
  };
  root.querySelector('#vf').addEventListener('submit', (e) => { e.preventDefault(); check(); });
  root.querySelector('#demo')?.addEventListener('click', () => { input.value = demo; check(); });
  if (initial) check();
}
