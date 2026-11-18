import { getProfilesData, domainOf } from '../data.js';
import { esc, copyText, CODE_RE } from '../util.js';
import { icon } from '../ui.js';
import { certificateHTML, verifyUrl } from '../certificate.js';
import { validity } from '../pass.js';
import { fmtDate } from '../util.js';

export default async function render(ctx, root) {
  const code = String(ctx.params.code || '').toUpperCase();
  const cert = CODE_RE.test(code) ? await ctx.store.getCertificate(code) : null;
  if (!cert) {
    ctx.setTitle('Attestation introuvable');
    root.innerHTML = `<div class="container-narrow page center"><h1>Attestation introuvable</h1>
      <p class="muted">Aucune attestation ne correspond au code « ${esc(code)} ». Vérifiez le code ou utilisez la page de vérification.</p>
      <a class="btn btn-primary" href="#/verifier?code=${encodeURIComponent(code)}">Vérifier un code</a></div>`;
    return;
  }
  const data = await getProfilesData();
  const profile = data.profiles.find((p) => p.id === cert.profileId);
  const profileName = profile?.name || cert.profileName || cert.profileId;
  const sector = profile ? domainOf(data, profile.domains?.[0])?.name : '';
  const val = validity(cert, profile);
  ctx.setTitle(`Attestation ${cert.code}`);
  if (!ctx.alive()) return;

  root.innerHTML = `<div class="container page cert-page">
    <div class="cert-actions no-print">
      <div><span class="badge badge-ok">${icon('check', 14)} Attestation authentique</span> ${val.status === 'expired' ? `<span class="badge badge-ko">Expirée le ${esc(fmtDate(val.until))}</span>` : `<span class="badge ${val.status === 'soon' ? 'badge-warn' : 'badge-ok'}">Valable jusqu’au ${esc(fmtDate(val.until))}</span>`}<h1 class="h1-md" style="margin-top:.5rem">Attestation de réussite</h1></div>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="print">${icon('print', 18)} Imprimer / Enregistrer en PDF</button>
        <button type="button" class="btn btn-light" id="copy">${icon('link', 18)} Copier le lien de vérification</button>
      </div>
    </div>
    <p class="muted small no-print">Pour obtenir un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d’impression (format A4 paysage, sans marges).</p>
    <div class="cert-stage">${certificateHTML(cert, profileName, sector, val)}</div>
  </div>`;
  root.querySelector('#print').addEventListener('click', () => window.print());
  root.querySelector('#copy').addEventListener('click', async () => {
    ctx.toast((await copyText(verifyUrl(cert.code))) ? 'Lien de vérification copié.' : 'Copie impossible : sélectionnez le lien manuellement.');
  });
}
