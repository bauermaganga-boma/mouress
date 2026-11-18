import { CONFIG } from '../../config.js';
import { getProfilesData, domainOf, levelOf, postes } from '../data.js';
import { passPrice } from '../pass.js';
import { esc, fmtMoney } from '../util.js';
import { icon, sectorIcon } from '../ui.js';

const STEPS = [
  { n: 1, ico: 'target', t: 'Choisissez un profil', d: 'Opérateur, technicien, superviseur, ingénieur, support : sélectionnez le profil du poste, le nombre de questions et la date limite.' },
  { n: 2, ico: 'link', t: 'Envoyez le lien', d: 'Chaque candidat reçoit un lien personnel par WhatsApp ou e-mail. Aucun compte à créer, il passe le test depuis son téléphone.' },
  { n: 3, ico: 'chart', t: 'Décidez sur des faits', d: 'Score global, résultat par thème, temps passé et statut : tout est dans votre tableau de bord, exportable en CSV.' },
];

const MOURESS = [
  { ico: 'bolt', t: 'Prestation technique EIA', d: 'Études, réalisation, mise en service et maintenance en électricité, instrumentation et automatisme.' },
  { ico: 'users', t: 'Placement de personnel et assistance technique', d: 'Des profils techniques qualifiés, évalués avant d’être placés.' },
  { ico: 'book', t: 'Formation professionnelle', d: 'Des parcours adaptés aux réalités de vos installations et de vos équipes.' },
];

export default async function render(ctx, root) {
  ctx.setTitle('');
  const data = await getProfilesData();
  if (!ctx.alive()) return;
  const featured = [];
  for (const dm of data.domains || []) { const p = data.profiles.find((x) => (x.domains || []).includes(dm.id)); if (p && !featured.includes(p)) featured.push(p); }
  for (const p of data.profiles) { if (featured.length >= 8) break; if (!featured.includes(p)) featured.push(p); }
  const C = CONFIG.CONTACT;

  root.innerHTML = `
  <section class="hero">
    <div class="container hero-inner">
      <div class="hero-copy">
        <p class="eyebrow">MOURESS Training</p>
        <h1>Testez, formez, recrutez vos équipes techniques</h1>
        <p class="hero-lead">Des tests d’aptitude et des parcours de formation pour le pétrole &amp; gaz, les mines, l’industrie et leurs fonctions support. Cours, entraînement, examen chronométré, attestation vérifiable.</p>
        <div class="btn-row">
          <a class="btn btn-primary btn-lg" href="#/inscription">Créer un compte entreprise</a>
          <a class="btn btn-lg hero-btn-2" href="#/formation">Découvrir la formation</a>
        </div>
        <p class="hero-note">${icon('check', 16)} Compte démo disponible &nbsp; ${icon('check', 16)} Paiement par carte ou Airtel Money &nbsp; ${icon('check', 16)} Fonctionne sur téléphone</p>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="mock mock-a"><span class="mock-label">Candidat</span><strong>Jean-Pierre M.</strong><span class="mock-sub">Opérateur de production</span>
          <div class="mock-score"><span>82 %</span><em>Réussi</em></div>
          <div class="mock-bars"><i style="width:90%"></i><i style="width:78%"></i><i style="width:84%"></i><i style="width:70%"></i></div></div>
        <div class="mock mock-b"><span class="mock-label">Session</span><strong>4 candidats</strong><span class="mock-sub">3 terminés · 1 en cours</span></div>
        <div class="mock mock-c">${icon('award', 26)}<span>MRS-2026-K7M2QX</span></div>
      </div>
    </div>
  </section>

  <section class="section" id="comment">
    <div class="container">
      <div class="section-head"><p class="eyebrow dark">Pour les RH</p><h2>Évaluer vos candidats en trois étapes</h2></div>
      <div class="grid grid-3">${STEPS.map((s) => `<article class="card step"><div class="step-n">${s.n}</div><div class="step-ico">${icon(s.ico, 26)}</div><h3>${s.t}</h3><p class="muted">${s.d}</p></article>`).join('')}</div>
      <div class="path">
        <p class="label">Côté candidat, un parcours comme pour le code de la route</p>
        <ol class="path-list"><li>${icon('book', 18)} Cours</li><li>${icon('target', 18)} Entraînement</li><li>${icon('clock', 18)} Examen chronométré</li><li>${icon('award', 18)} Attestation</li></ol>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="secteurs">
    <div class="container">
      <div class="section-head"><p class="eyebrow dark">Secteurs et profils</p><h2>${data.profiles.length} profils métiers, du technicien à l’ingénieur</h2>
        <p class="muted">Chaque profil comprend des modules de cours, des questions illustrées par thème et un examen équilibré.</p></div>
      <div class="grid grid-3 sectors">${(data.domains || []).map((d) => {
        const n = postes(data, { domain: d.id }).length;
        return `<a class="card card-link sector-card" href="#/formation/${esc(d.id)}"><div class="sector-ico">${icon(d.icon || 'briefcase', 28)}</div><h3>${esc(d.name)}</h3><p class="muted small">${esc(d.desc)}</p><span class="badge">${n} poste${n > 1 ? 's' : ''}</span></a>`;
      }).join('')}</div>
      <h3 class="sub-h">Profils les plus demandés</h3>
      <div class="grid grid-4">${featured.map((p) => `<a class="card card-link profile-mini" href="#/profil/${esc(p.id)}"><span class="badge badge-info">${esc(levelOf(data, p.level)?.name || '')}</span><h4>${esc(p.name)}</h4><p class="muted xs">${esc(domainOf(data, p.domains?.[0])?.name || '')}</p></a>`).join('')}</div>
      <p class="center" style="margin-top:var(--sp-5)"><a class="btn btn-outline" href="#/formation">Voir les ${data.profiles.length} profils ${icon('arrow', 16)}</a></p>
    </div>
  </section>

  <section class="section" id="offre">
    <div class="container">
      <div class="section-head"><p class="eyebrow dark">Offre entreprise</p><h2>1 Pass = 1 personne</h2>
        <p class="muted">Vous payez par personne et par poste, sans abonnement. Tarifs provisoires, selon le niveau du poste.</p></div>
      <div class="grid grid-2 packs">
        <article class="card pack"><h3>Technicien</h3><p class="pack-price">${esc(fmtMoney(passPrice('tech')))}</p><p class="muted small">Opérateur, technicien, superviseur (tarif technicien pour l’instant)</p></article>
        <article class="card pack pack-featured"><h3>Ingénieur / Cadre</h3><p class="pack-price">${esc(fmtMoney(passPrice('ing')))}</p><p class="muted small">Ingénieur, cadre, chef de site et management</p></article>
      </div>
      <div class="card included"><h3>Ce que comprend chaque Pass</h3>
        <ul class="incl-list"><li>${icon('book', 18)} Formation : modules de cours du poste</li><li>${icon('target', 18)} Entraînement illimité, avec corrections expliquées</li>
        <li>${icon('clock', 18)} Examen de ${CONFIG.EXAM_QUESTIONS} questions, ${CONFIG.ATTEMPTS_PER_PASS} tentatives</li><li>${icon('award', 18)} Attestation vérifiable en cas de réussite</li><li>${icon('chart', 18)} Résultat par thème transmis à votre entreprise</li></ul>
        <div class="btn-row"><a class="btn btn-primary btn-lg" href="#/inscription">Créer un compte entreprise</a><a class="btn btn-outline btn-lg" href="${esc(C.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp', 18)} Parler à un conseiller</a></div></div>
    </div>
  </section>

  <section class="section section-navy" id="mouress">
    <div class="container">
      <div class="section-head"><p class="eyebrow">Qui est MOURESS</p><h2>Une entreprise technique qui évalue comme elle recrute</h2>
        <p class="lead-light">MOURESS accompagne les opérateurs de l’industrie gabonaise et sous-régionale. Nos tests viennent du terrain : ce sont les questions que nous poserions à un technicien avant de l’envoyer sur site.</p></div>
      <div class="grid grid-3">${MOURESS.map((m) => `<article class="card card-dark"><div class="step-ico dark">${icon(m.ico, 26)}</div><h3>${m.t}</h3><p>${m.d}</p></article>`).join('')}</div>
      <p class="sectors-line"><strong>Secteurs :</strong> pétrole &amp; gaz · mines · industrie · BTP · énergie</p>
    </div>
  </section>

  <section class="section" id="contact">
    <div class="container contact">
      <div><p class="eyebrow dark">Contact</p><h2>Parlons de vos besoins</h2>
        <p class="muted">Un test sur mesure, un devis de volume, une démonstration : nous répondons rapidement.</p>
        <ul class="contact-list">
          <li>${icon('pin', 20)}<span>${esc(C.address)}</span></li>
          <li>${icon('phone', 20)}<a href="${esc(C.phoneHref)}">${esc(C.phone)}</a></li>
        </ul>
        <div class="btn-row"><a class="btn btn-whatsapp btn-lg" href="${esc(C.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp', 20)} Écrire sur WhatsApp</a>
        <a class="btn btn-outline btn-lg" href="${esc(C.phoneHref)}">${icon('phone', 20)} Appeler</a></div></div>
      <div class="card contact-card"><h3>Essayez la démo RH</h3><p class="muted">Une entreprise fictive avec des sessions et des candidats est prête : connectez-vous en un clic pour explorer le tableau de bord.</p>
        <a class="btn btn-primary" href="#/connexion">Accéder à la démo ${icon('arrow', 16)}</a></div>
    </div>
  </section>`;
}
