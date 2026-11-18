// Paiement. Fournisseur actuel : « simulated » (MODE DÉMO) — aucune donnée réelle n'est traitée ni stockée.
// Interface prête pour un agrégateur réel : remplacer PROVIDERS.active par un objet exposant
//   async pay({ amount, method, company, details }) -> { ok, ref, method, provider, message? }
// (par exemple un appel serveur qui renvoie l'URL de paiement de l'agrégateur, jamais de carte saisie ici).
import { esc, sleep, randomString } from './util.js';

export const METHODS = [
  { id: 'card', label: 'Carte bancaire (test)', hint: 'Numéro de test : 4242 4242 4242 4242' },
  { id: 'airtel', label: 'Airtel Money', hint: 'Numéro Gabon : 07 XX XX XX ou 06 XX XX XX' },
];

const luhn = (num) => {
  let sum = 0; let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = Number(num[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};

/** Valide les champs du formulaire simulé. Renvoie un message d'erreur ou ''. */
export function validateDetails(method, d) {
  if (method === 'card') {
    const n = String(d.number || '').replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(n) || !luhn(n)) return 'Numéro de carte invalide. Utilisez la carte de test 4242 4242 4242 4242.';
    if (!/^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/.test(String(d.expiry || '').trim())) return 'Date d’expiration invalide (format MM/AA).';
    if (!/^\d{3,4}$/.test(String(d.cvc || '').trim())) return 'Code de sécurité invalide (3 ou 4 chiffres).';
    return '';
  }
  if (method === 'airtel') {
    const n = String(d.phone || '').replace(/[\s.+-]/g, '').replace(/^241/, '');
    if (!/^0?[67]\d{7}$/.test(n)) return 'Numéro Airtel Money invalide (ex. 07 12 34 56).';
    return '';
  }
  return 'Mode de paiement inconnu.';
}

const simulated = {
  name: 'simulated',
  async pay({ amount, method, details }) {
    const err = validateDetails(method, details || {});
    if (err) return { ok: false, provider: 'simulated', method, message: err };
    await sleep(method === 'airtel' ? 1800 : 1100); // simule la validation USSD / 3-D Secure
    if (method === 'card' && String(details.number).replace(/\s/g, '') === '4000000000000002') {
      return { ok: false, provider: 'simulated', method, message: 'Carte refusée (carte de test de refus).' };
    }
    return { ok: true, provider: 'simulated', method, amount, ref: `DEMO-${randomString(8)}` };
    // Les numéros de carte / téléphone ne sont ni retournés ni conservés.
  },
};

export const PROVIDERS = { active: simulated };
export const isDemoMode = () => PROVIDERS.active.name === 'simulated';

/** API publique du SPEC : pay({amount, method, company, details}). */
export async function pay({ amount, method, company, details }) {
  return PROVIDERS.active.pay({ amount, method, company, details });
}

export function demoBanner() {
  return isDemoMode()
    ? `<div class="demo-banner" role="note"><strong>MODE DÉMO</strong> — aucun paiement réel : aucune somme n'est débitée, aucune donnée bancaire n'est conservée.</div>`
    : '';
}

export function paymentFormHTML(method) {
  if (method === 'card') {
    return `<div class="field"><label for="pf-num">Numéro de carte</label><input id="pf-num" name="number" type="text" inputmode="numeric" autocomplete="off" placeholder="4242 4242 4242 4242"><span class="hint">Carte de test uniquement. 4000 0000 0000 0002 simule un refus.</span></div>
      <div class="form-grid"><div class="field"><label for="pf-exp">Expiration</label><input id="pf-exp" name="expiry" type="text" inputmode="numeric" autocomplete="off" placeholder="12/30"></div>
      <div class="field"><label for="pf-cvc">Code de sécurité</label><input id="pf-cvc" name="cvc" type="text" inputmode="numeric" autocomplete="off" placeholder="123"></div></div>`;
  }
  return `<div class="field"><label for="pf-tel">Numéro Airtel Money</label><input id="pf-tel" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="07 12 34 56"><span class="hint">Simulation : aucune demande n'est envoyée au téléphone.</span></div>`;
}

export const methodLabel = (id) => esc((METHODS.find((m) => m.id === id) || { label: id || '—' }).label);
