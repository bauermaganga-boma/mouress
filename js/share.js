// Partage d'un lien : copier, WhatsApp, e-mail. Le bouton « Copier » est géré globalement (data-share-copy).
import { esc, absUrl } from './util.js';
import { icon, whatsappLink } from './ui.js';

/** Lien personnel d'un collaborateur : ouvre son parcours de poste dans « Mon espace ». */
export async function personalLink(ctx, emp) { return absUrl(`#/p/${await ctx.store.employeeToken(emp.id)}`); }

export function personalMessage(emp, company, link) {
  return `Bonjour ${emp.name}, ${company.name} vous ouvre votre parcours de formation MOURESS Training : vos thématiques, votre progression et vos prochains cours. Accès personnel : ${link}`;
}

/** Trois boutons côte à côte : copier le lien, l'envoyer par WhatsApp, l'envoyer par e-mail. */
export function shareHTML({ link, message, subject, email = '', who = '' }) {
  const w = who ? ` de ${esc(who)}` : '';
  return `<div class="btn-row share" style="gap:.35rem">
    <button type="button" class="btn btn-light btn-sm" data-share-copy="${esc(link)}" aria-label="Copier le lien${w}">${icon('copy', 14)} Copier le lien</button>
    <a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="${esc(whatsappLink(message))}" aria-label="Envoyer par WhatsApp${w}">${icon('whatsapp', 14)} WhatsApp</a>
    <a class="btn btn-light btn-sm" href="mailto:${esc(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}" aria-label="Envoyer par e-mail${w}">${icon('mail', 14)} E-mail</a></div>`;
}
