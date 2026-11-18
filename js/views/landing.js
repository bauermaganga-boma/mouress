// Page d'accueil institutionnelle MOURESS : prestataire de services industriels.
// Le Training (tests d'aptitude, formation) n'en est qu'une offre, mise en avant en fin de page.
import { CONFIG } from '../../config.js';
import { esc } from '../util.js';
import { icon } from '../ui.js';

const PH = (f) => `assets/img/photo/${f}`;

const SERVICES = [
  { ico: 'users', t: 'Placement de personnel', d: 'Ouvriers, techniciens, superviseurs, ingénieurs, management : qualifiés ou non, évalués avant d’être placés.' },
  { ico: 'flag', t: 'Supervision de travaux', d: 'Préparation (planning, méthodes, coordination), suivi journalier, reporting, contrôle qualité et gestion des effectifs.' },
  { ico: 'shield', t: 'HSE', d: 'Personnel formé aux normes HSE, supervision de chantier, analyses de risques, permis de travail, audits et inspections.' },
  { ico: 'chart', t: 'Engineering et études', d: 'PID, plans iso, 3D, notes de calcul, plans de génie civil : coordination des études et support engineering.' },
  { ico: 'check', t: 'Mise en service (commissioning)', d: 'Profils expérimentés, procédures de test, SAT, tests électriques, cause & effet, PV et suivi documentaire.' },
  { ico: 'wrench', t: 'Assistance technique et exploitation', d: 'Mise à disposition de personnel pour l’exploitation continue ; réglage, dépannage et maintenance ponctuels.' },
];

const METIERS = [
  { t: 'Maintenance', d: 'Préventive, corrective, arrêts programmés.', img: 'heavy-equipment-maintenance.jpg', alt: 'Maintenance d’engins lourds' },
  { t: 'Mécanique', d: 'Machines tournantes, turbines, compresseurs, levage.', img: 'gas-compressor.jpg', alt: 'Compresseur de gaz' },
  { t: 'Tuyauterie', d: 'Iso, supports, soudage, QMOS/QS, tests de pression, CND.', img: 'pipeline-welding.jpg', alt: 'Soudure de pipeline' },
  { t: 'Instrumentation', d: 'Capteurs, calibration, boucles 4-20 mA, tests de boucle.', img: 'wellhead-onshore.jpg', alt: 'Tête de puits équipée d’instruments' },
  { t: 'Automatisme', d: 'Contrôle-commande, cause & effet, Grafcet, supervision Siemens / Schneider, FAT/SAT.', img: 'control-room.jpg', alt: 'Salle de contrôle' },
  { t: 'Électricité', d: 'Tirage de câbles, armoires, tableaux BT/HT, essais, mise en service.', img: 'power-transformer.jpg', alt: 'Transformateur de puissance' },
];

const SECTEURS = [
  { t: 'Pétrole & gaz', d: 'Amont, aval, raffinerie, terminaux.', img: 'oil-rig-offshore.jpg', alt: 'Plateforme pétrolière offshore' },
  { t: 'Mines', d: 'Exploitation, traitement du minerai, engins.', img: 'open-pit-mine.jpg', alt: 'Mine à ciel ouvert' },
  { t: 'Énergie', d: 'Centrales thermiques, valorisation d’énergie, postes électriques.', img: 'electrical-substation.jpg', alt: 'Poste électrique' },
  { t: 'Infrastructures', d: 'Génie civil, structures métalliques, levage, logistique portuaire.', img: 'crane-lifting.jpg', alt: 'Grue de levage' },
];

const PHASES = [
  { n: '01', t: 'Construction', l: ['Placement de personnel', 'Supervision de travaux', 'HSE, sécurité, gardiennage'] },
  { n: '02', t: 'Mise en service', l: ['Profils commissioning, instrumentation, électricité, automatisme', 'Procédures de test, SAT, cause & effet', 'PV et suivi documentaire'] },
  { n: '03', t: 'Exploitation', l: ['Mise à disposition de personnel', 'Réglage, dépannage, maintenance', 'Accompagnement technique ponctuel'] },
];

const COMPETENCES = [
  ['Études & ingénierie', 'PID, plans iso, 3D, notes de calcul, plans, AutoCAD'],
  ['Génie civil', 'Fondations, terrassement, béton armé, plateformes, micropieux, longrines'],
  ['Mécanique / piping', 'Soudure, tests de pression, CND, montage de structures métalliques'],
  ['Électricité', 'BT/HT, armoires, tirage de câbles, essais, normes'],
  ['Instrumentation', 'Capteurs, calibration, tests de boucle, 4-20 mA'],
  ['Automatisme', 'Cause & effet, supervision, FAT/SAT, Grafcet'],
  ['Mise en service', 'Coordination, tests, essais, supervision, PV'],
  ['HSE', 'Analyse de risques, permis de travail, audits, habilitations'],
  ['RH technique', 'Recrutement, encadrement, formation, gestion de personnel'],
  ['Management de projet industriel', 'Cahier des charges, sous-traitants, planification, résolution de problèmes techniques'],
];

const card = (m) => `<article class="card corp-card"><img src="${PH(m.img)}" alt="${esc(m.alt)}" loading="lazy"><div class="corp-card-body"><h3>${esc(m.t)}</h3><p class="muted small">${esc(m.d)}</p></div></article>`;

export default async function render(ctx, root) {
  ctx.setTitle('');
  const C = CONFIG.CONTACT;
  root.innerHTML = `
  <section class="hero corp-hero" style="--hero-img:url('../assets/img/photo/fpso.jpg')">
    <div class="container corp-hero-inner">
      <p class="eyebrow">Prestataire de services industriels · Libreville</p>
      <h1>Des équipes et une expertise technique pour vos sites industriels</h1>
      <p class="hero-lead">MOURESS accompagne les industriels du pétrole &amp; gaz, des mines, de l’énergie et des infrastructures : placement de personnel, supervision de travaux, engineering, mise en service et assistance technique, de la construction à l’exploitation.</p>
      <div class="btn-row">
        <a class="btn btn-primary btn-lg" href="#/?s=contact">Demander un devis</a>
        <a class="btn btn-lg hero-btn-2" href="#/?s=services">Nos services</a>
        <a class="btn btn-lg hero-btn-2" href="#/training">${icon('award', 18)} MOURESS Training</a>
      </div>
      <ul class="corp-facts">
        <li><strong>4</strong> secteurs servis</li><li><strong>6</strong> métiers techniques</li><li><strong>3</strong> phases de projet couvertes</li>
      </ul>
    </div>
  </section>

  <section class="section" id="services">
    <div class="container">
      <div class="section-head"><p class="eyebrow dark">Nos services</p><h2>Un partenaire sur toute la vie du projet</h2>
        <p class="muted">Sous-traitance industrielle et prestations intellectuelles, pour les maîtres d’ouvrage comme pour les entreprises contractantes.</p></div>
      <div class="grid grid-3">${SERVICES.map((s) => `<article class="card step"><div class="step-ico">${icon(s.ico, 26)}</div><h3>${esc(s.t)}</h3><p class="muted">${esc(s.d)}</p></article>`).join('')}</div>
    </div>
  </section>

  <section class="section section-alt" id="metiers">
    <div class="container">
      <div class="section-head"><p class="eyebrow dark">Nos métiers techniques</p><h2>Maintenance, mécanique, tuyauterie, instrumentation, automatisme, électricité</h2></div>
      <div class="grid grid-3">${METIERS.map(card).join('')}</div>
    </div>
  </section>

  <section class="section" id="phases">
    <div class="container">
      <div class="section-head"><p class="eyebrow dark">Nos interventions</p><h2>De la construction à l’exploitation</h2></div>
      <div class="grid grid-3">${PHASES.map((p) => `<article class="card phase"><span class="phase-n">${p.n}</span><h3>${esc(p.t)}</h3><ul class="phase-list">${p.l.map((x) => `<li>${icon('check', 16)}<span>${esc(x)}</span></li>`).join('')}</ul></article>`).join('')}</div>
    </div>
  </section>

  <section class="section section-alt" id="secteurs">
    <div class="container">
      <div class="section-head"><p class="eyebrow dark">Nos secteurs</p><h2>Là où l’industrie a besoin de monde et de méthode</h2></div>
      <div class="grid grid-4 corp-sectors">${SECTEURS.map(card).join('')}</div>
    </div>
  </section>

  <section class="section" id="engineering">
    <div class="container">
      <div class="section-head"><p class="eyebrow dark">Engineering et support</p><h2>Nos compétences techniques</h2>
        <p class="muted">Études, plans, coordination des lots et pilotage de projet : la prestation intellectuelle qui sécurise le chantier.</p></div>
      <div class="table-wrap"><table class="table"><caption class="sr-only">Compétences techniques de MOURESS</caption><thead><tr><th>Domaine</th><th>Compétences clés</th></tr></thead><tbody>
        ${COMPETENCES.map(([a, b]) => `<tr><td><strong>${esc(a)}</strong></td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>
      <article class="card corp-ref"><span class="badge badge-info">Référence</span>
        <h3>Construction d’une centrale thermique et d’une unité de valorisation d’énergie</h3>
        <p class="muted">Site de gaz, énergie et pétrole-gaz. Rôle de chef de projet et coordination de plusieurs lots : génie civil, métallerie, piping, électricité, instrumentation, automatisme et contrôle-commande, HSE, levage.</p></article>
    </div>
  </section>

  <section class="section section-navy" id="training">
    <div class="container corp-training">
      <div><p class="eyebrow">Un service de MOURESS</p><h2>MOURESS Training</h2>
        <p class="lead-light">Des tests d’aptitude et des parcours de formation pour évaluer vos candidats avant de les recruter et faire monter vos équipes en compétence : cours, entraînement, examen chronométré, attestation vérifiable. Pétrole &amp; gaz, mines, énergie, industrie et fonctions support.</p>
        <div class="btn-row"><a class="btn btn-primary btn-lg" href="#/training">Découvrir MOURESS Training ${icon('arrow', 18)}</a><a class="btn btn-lg hero-btn-2" href="#/formation">Voir les profils</a></div></div>
      <ul class="corp-training-list"><li>${icon('book', 20)}<span>Cours et entraînement par thème</span></li><li>${icon('clock', 20)}<span>Examen de 20 questions, chronométré</span></li><li>${icon('award', 20)}<span>Attestation vérifiable</span></li><li>${icon('chart', 20)}<span>Suivi des recrutements et des équipes</span></li></ul>
    </div>
  </section>

  <section class="section" id="contact">
    <div class="container contact">
      <div><p class="eyebrow dark">Contact</p><h2>Parlons de votre projet</h2>
        <p class="muted">Besoin de personnel, d’une supervision, d’une étude ou d’une mise en service : décrivez-nous votre besoin, nous répondons rapidement.</p>
        <ul class="contact-list">
          <li>${icon('pin', 20)}<span>${esc(C.address)}</span></li>
          <li>${icon('phone', 20)}<a href="${esc(C.phoneHref)}">${esc(C.phone)}</a></li>
        </ul>
        <div class="btn-row"><a class="btn btn-whatsapp btn-lg" href="${esc(C.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp', 20)} Écrire sur WhatsApp</a><a class="btn btn-outline btn-lg" href="${esc(C.phoneHref)}">${icon('phone', 20)} Appeler</a></div></div>
      <form class="card contact-card" id="cform" novalidate>
        <h3>Envoyer votre demande</h3>
        <div class="field"><label for="c-n">Nom et société</label><input id="c-n" type="text" autocomplete="organization"></div>
        <div class="field"><label for="c-b">Votre besoin</label><textarea id="c-b" rows="4" placeholder="Ex. 6 techniciens instrumentistes pour un arrêt de 3 mois à Port-Gentil"></textarea></div>
        <p class="field-error" id="c-e" role="alert"></p>
        <button class="btn btn-primary" type="submit">${icon('whatsapp', 18)} Envoyer par WhatsApp</button>
        <p class="xs muted">Votre message s’ouvre dans WhatsApp, prêt à être envoyé.</p>
      </form>
    </div>
  </section>`;

  root.querySelector('#cform').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = root.querySelector('#c-n').value.trim(); const b = root.querySelector('#c-b').value.trim();
    if (b.length < 5) { root.querySelector('#c-e').textContent = 'Décrivez brièvement votre besoin.'; return; }
    root.querySelector('#c-e').textContent = '';
    window.open(`${C.whatsapp}?text=${encodeURIComponent(`Bonjour MOURESS, ${n ? n + ' : ' : ''}${b}`)}`, '_blank', 'noopener');
  });

  const s = ctx.query.get('s');
  if (s) requestAnimationFrame(() => root.querySelector('#' + CSS.escape(s))?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
