// Rendu partagé d'une question (entraînement, examen, correction).
import { esc } from './util.js';
import { figure } from './ui.js';

export const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** order : ordre d'affichage (indices des choix d'origine). state : {picked, locked, correctDisplay} */
export function choicesHTML(q, order, state = {}) {
  const { picked = null, locked = false, correctDisplay = -1 } = state;
  return `<div class="choices" role="radiogroup" aria-label="Réponses possibles">${order.map((orig, d) => {
    let cls = 'choice';
    let mark = '';
    if (picked === d && !locked) cls += ' selected';
    if (locked) {
      if (d === correctDisplay) { cls += ' correct'; mark = '<span class="choice-mark" aria-hidden="true">✓</span>'; }
      else if (picked === d) { cls += ' wrong'; mark = '<span class="choice-mark" aria-hidden="true">✗</span>'; }
    }
    return `<button type="button" class="${cls}" role="radio" aria-checked="${picked === d}" data-d="${d}" ${locked ? 'disabled' : ''}>
      <span class="choice-key" aria-hidden="true">${KEYS[d]}</span><span class="choice-text">${esc(q.choices[orig])}</span>${mark}
      ${locked && d === correctDisplay ? '<span class="sr-only"> Bonne réponse</span>' : ''}${locked && picked === d && d !== correctDisplay ? '<span class="sr-only"> Votre réponse, incorrecte</span>' : ''}</button>`;
  }).join('')}</div>`;
}

export function questionBodyHTML(q) {
  const long = String(q.q).length > 320;
  return `${q.img ? figure(q.img, q.imgAlt, 'q-fig') : ''}<div class="q-statement ${long ? 'q-long' : ''}" ${long ? 'tabindex="0" role="region" aria-label="Énoncé de la question (défilable)"' : ''}><h2 class="q-text">${esc(q.q)}</h2></div>`;
}

export const correctDisplayIndex = (q, order) => order.findIndex((o) => o === q.answer);
