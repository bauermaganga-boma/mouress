// Attestation de réussite : QR code + gabarit HTML imprimable (A4 paysage, voir css/certificate.css).
import qrcode from '../vendor/qrcode.mjs';
import { esc, fmtDate, absUrl } from './util.js';

export function verifyUrl(code) { return absUrl(`#/verifier?code=${encodeURIComponent(code)}`); }

export function qrSvg(text) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR code de vérification de l’attestation' });
  } catch (e) {
    console.warn('QR indisponible', e);
    return '';
  }
}

export const MENTION = 'Attestation de réussite à un test d’aptitude MOURESS — ne constitue pas un diplôme officiel';

export function certificateHTML(cert, profileName, sectorName = '', val = null) {
  const url = verifyUrl(cert.code);
  return `<article class="certificate" aria-label="Attestation de réussite">
    <div class="cert-frame">
      <div class="cert-corner cert-corner-tl"></div><div class="cert-corner cert-corner-br"></div>
      <header class="cert-head">
        <img class="cert-logo" src="assets/logo/mouress-logo-horizontal-couleur-pour-fond-clair.svg" alt="MOURESS">
        <span class="cert-academy">Training</span>
      </header>
      <p class="cert-kicker">Attestation de réussite</p>
      <p class="cert-intro">MOURESS Training atteste que</p>
      <h2 class="cert-name">${esc(cert.name)}</h2>
      <p class="cert-text">a réussi le test d’aptitude</p>
      <p class="cert-profile">${esc(profileName)}</p>
      ${sectorName ? `<p class="cert-sector">${esc(sectorName)}</p>` : ''}
      <div class="cert-meta">
        <div><span>Score obtenu</span><strong>${esc(cert.percent)} %</strong><small>seuil de réussite ${esc(cert.passMark)} %</small></div>
        <div><span>Délivrée le</span><strong>${esc(fmtDate(cert.date))}</strong><small>${val ? `Valable jusqu’au ${esc(fmtDate(val.until))}` : 'Libreville, Gabon'}</small></div>
        <div><span>Code de vérification</span><strong class="cert-code">${esc(cert.code)}</strong><small>à vérifier sur la page « Vérifier »</small></div>
      </div>
      <footer class="cert-foot">
        <div class="cert-qr">${qrSvg(url)}</div>
        <p class="cert-mention">${esc(MENTION)}.<br>Vérification en ligne : <span class="cert-url">${esc(url)}</span></p>
        <div class="cert-seal"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 21l5-3 5 3-1.5-7"/></svg><span>MOURESS<br>Training</span></div>
      </footer>
    </div>
  </article>`;
}

/** Exemple d'attestation (aperçu repliable, filigrane « EXEMPLE ») : montre au candidat ce qu'il obtient en cas de réussite. */
export function sampleCertificateHTML(profileName, sectorName = '', passMark = 70) {
  const cert = { name: 'Prénom NOM', percent: 85, passMark, date: Date.now(), code: 'MRS-2026-EXEMPL' };
  return `<details class="cert-sample"><summary class="btn btn-light btn-sm">Voir un exemple d’attestation</summary>
    <p class="xs muted" style="margin:.6rem 0 0">Exemple fictif : l’attestation réelle porte votre nom, votre score, une date et un code vérifiable (QR code).</p>
    <div class="cert-stage">${certificateHTML(cert, profileName, sectorName, null)}</div></details>`;
}
