// Routeur par hash, coque de l'application (en-tête, onglets mobiles, pied de page), PWA.
import { CONFIG } from '../config.js';
import { initStore, store } from './store.js';
import { esc } from './util.js';
import { icon, logo } from './ui.js';
import { startI18n, setLang, langSwitchHTML } from './i18n.js';

const ROUTES = [
  { p: '', view: 'training' },
  { p: 'training', view: 'training' },
  { p: 'formation', view: 'formation' },
  { p: 'formation/:d', view: 'formation' },
  { p: 'formation/:d/:b', view: 'formation' },
  { p: 'formation/:d/:b/:l', view: 'formation' },
  { p: 'profil/:id', view: 'profil' },
  { p: 'cours/:id/:mod', view: 'cours' },
  { p: 'entrainement/:id', view: 'entrainement' },
  { p: 'examen/:id', view: 'examen' },
  { p: 'resultat/:id', view: 'resultat' },
  { p: 'attestation/:code', view: 'attestation' },
  { p: 'verifier', view: 'verifier' },
  { p: 't/:token', view: 'candidat' },
  { p: 'rh', view: 'rh', fn: 'dashboard', auth: true },
  { p: 'rh/inviter', view: 'rh', fn: 'invite', auth: true },
  { p: 'rh/equipe', view: 'rh', fn: 'teamHome', auth: true },
  { p: 'rh/equipe/:id', view: 'rh', fn: 'employee', auth: true },
  { p: 'rh/nouvelle-session', view: 'rh', fn: 'invite', auth: true },
  { p: 'rh/session/:id', view: 'rh', fn: 'session', auth: true },
  { p: 'rh/formation/:id', view: 'rh', fn: 'formation', auth: true },
  { p: 'rh/poste/:id', view: 'rh', fn: 'poste', auth: true },
  { p: 'p/:token', view: 'espace', fn: 'lien' },
  { p: 'rh/facturation', view: 'rh', fn: 'billing', auth: true },
  { p: 'rh/credits', view: 'rh', fn: 'billing', auth: true },
  { p: 'rh/recu/:id', view: 'rh', fn: 'receipt', auth: true },
  { p: 'connexion', view: 'auth', fn: 'login' },
  { p: 'inscription', view: 'auth', fn: 'signup' },
  { p: 'mon-espace', view: 'espace' },
];

const state = { user: null, leave: [], token: 0 };

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, q] = raw.split('?');
  return { path: '/' + path.split('/').filter(Boolean).join('/'), query: new URLSearchParams(q || ''), segs: path.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } }) };
}

function match(segs) {
  for (const r of ROUTES) {
    const ps = r.p.split('/').filter(Boolean);
    if (ps.length !== segs.length) continue;
    const params = {};
    if (ps.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = segs[i]), true) : p === segs[i]))) return { route: r, params };
  }
  return null;
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function go(path) { location.hash = '#' + path; }

async function refreshUser() {
  state.user = await store.currentUser();
  renderShell();
  return state.user;
}

// Le site est centré sur la formation : plus de page d'accueil « prestations techniques » (views/landing.js n'est plus routée).
const NAV_CORP = [];
const NAV_TRAINING = [
  { key: 'training', label: 'Accueil', href: '#/', icon: 'home' },
  { key: 'formation', label: 'Formation', href: '#/formation', icon: 'book', also: ['profil', 'cours', 'entrainement', 'examen', 'resultat'] },
  { key: 'rh', label: 'Espace entreprise', short: 'Entreprise', href: '#/rh', icon: 'building', also: ['connexion', 'inscription', 't'] },
  { key: 'mon-espace', label: 'Mon espace', short: 'Mon espace', href: '#/mon-espace', icon: 'user', also: ['attestation', 'verifier'] },
];
const isCorp = () => false;

function activeKey() {
  const { segs } = parseHash();
  if (!segs.length) return 'training';
  const hit = NAV_TRAINING.find((n) => n.key === segs[0] || (n.also || []).includes(segs[0]));
  return hit ? hit.key : null;
}

function renderShell() {
  const corp = isCorp();
  const NAV = corp ? NAV_CORP : NAV_TRAINING;
  const key = activeKey();
  const cur = (k) => (k === key ? ' aria-current="page"' : '');
  document.getElementById('site-header').innerHTML = `<div class="container bar-inner">
    <a class="brand" href="#/" aria-label="MOURESS Training — accueil">${logo('clair')}</a>
    <nav class="nav-main" aria-label="Navigation principale">${NAV.map((n) => `<a href="${n.href}"${cur(n.key)}>${n.label}</a>`).join('')}</nav>
    <div class="header-actions">${langSwitchHTML()}${corp ? `<a class="btn btn-primary btn-sm" href="#/training">${icon('award', 16)} MOURESS Training</a>` : `<a class="back-site back-ico" data-back href="${backFallback()}" aria-label="Retour" title="Retour">${icon('arrow', 18, 'flip')}</a>`}${corp ? '' : state.user
      ? `<span class="user-chip">${esc(state.user.name)}</span><button type="button" class="btn btn-light btn-sm btn-logout" data-logout aria-label="Déconnexion">${icon('login', 16)}<span class="lbl">Déconnexion</span></button>`
      : `<a class="btn btn-primary btn-sm btn-login" href="#/connexion">${icon('login', 16)} Connexion<span class="lbl-long">&nbsp;entreprise</span></a>`}</div></div>`;
  document.getElementById('tabbar').innerHTML = NAV.map((n) => `<a href="${n.href}"${cur(n.key)}>${icon(n.icon)}<span>${n.short || n.label}</span></a>`).join('');
  document.getElementById('site-footer').innerHTML = corp ? `<div class="container"><div class="footer-grid">
    <div>${logo('sombre')}<p>Prestataire de services industriels : placement de personnel, supervision, engineering, mise en service, assistance technique.</p></div>
    <div><h4>MOURESS</h4><ul><li><a href="#/?s=services">Services</a></li><li><a href="#/?s=secteurs">Secteurs</a></li><li><a href="#/training">MOURESS Training</a></li><li><a href="#/?s=contact">Contact</a></li></ul></div>
    <div><h4>Contact</h4><ul><li>${esc(CONFIG.CONTACT.address)}</li><li><a href="${CONFIG.CONTACT.phoneHref}">${esc(CONFIG.CONTACT.phone)}</a></li><li><a href="${CONFIG.CONTACT.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li></ul></div></div>
    <p class="footer-legal">© ${new Date().getFullYear()} MOURESS SAS — Libreville. · <a href="credits.html">Crédits photos</a></p></div>` : `<div class="container"><div class="footer-grid">
    <div>${logo('sombre')}<p>Tests d’aptitude et formation pour les équipes techniques et leurs fonctions support.</p></div>
    <div><h4>Plateforme</h4><ul><li><a href="#/">Accueil</a></li><li><a href="#/formation">Catalogue de formation</a></li><li><a href="#/rh">Espace entreprise</a></li><li><a href="#/mon-espace">Mon espace candidat</a></li><li><a href="#/verifier">Vérifier une attestation</a></li></ul></div>
    <div><h4>MOURESS</h4><ul><li>${esc(CONFIG.CONTACT.address)}</li><li><a href="${CONFIG.CONTACT.phoneHref}">${esc(CONFIG.CONTACT.phone)}</a></li><li><a href="${CONFIG.CONTACT.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li></ul></div></div>
    <p class="footer-legal">© ${new Date().getFullYear()} MOURESS SAS — Libreville. Les attestations MOURESS Training ne constituent pas des diplômes officiels. · <a href="credits.html">Crédits photos</a></p></div>`;
}

/** Sans historique (arrivée directe) : remonte d'un niveau dans l'URL, sinon Training. */
function backFallback() {
  const segs = (location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/').filter(Boolean);
  return segs.length > 1 ? '#/' + segs.slice(0, -1).join('/') : '#/training';
}

async function render() {
  const token = ++state.token;
  // nettoyage de la vue précédente (minuteurs, etc.)
  for (const fn of state.leave.splice(0)) { try { fn(); } catch { /* ignore */ } }
  document.body.dataset.chrome = 'full';
  const { path, query, segs } = parseHash();
  // historique interne : sert au bouton retour (niveau précédent)
  const hist = state.hist || (state.hist = []);
  if (hist.length > 1 && hist[hist.length - 2] === location.hash) hist.pop();
  else if (hist[hist.length - 1] !== location.hash) hist.push(location.hash);
  const main = document.getElementById('main');
  const m = match(segs);
  state.user = await store.currentUser();
  renderShell();
  const root = document.createElement('div');
  main.replaceChildren(root);

  const ctx = {
    path, query, params: m ? m.params : {}, store, user: state.user, root,
    alive: () => token === state.token,
    onLeave: (fn) => state.leave.push(fn),
    setTitle: (t) => { document.title = t ? `${t} · MOURESS Training` : 'MOURESS Training · Tests et formation pour vos équipes'; },
    setChrome: (c) => { document.body.dataset.chrome = c; },
    toast, go, refreshUser,
  };
  ctx.setTitle('');

  try {
    if (!m) {
      const mod = await import('./views/notfound.js');
      if (ctx.alive()) mod.default(ctx, root);
    } else if (m.route.auth && !state.user) {
      go(`/connexion?next=${encodeURIComponent(path)}`);
      return;
    } else {
      const mod = await import(`./views/${m.route.view}.js`);
      if (!ctx.alive()) return;
      const fn = m.route.fn ? mod[m.route.fn] : mod.default;
      await fn(ctx, root);
    }
  } catch (e) {
    console.error(e);
    if (ctx.alive()) {
      root.innerHTML = `<div class="container page"><div class="alert alert-ko"><strong>Une erreur est survenue.</strong> Rechargez la page ou revenez à l’<a href="#/">accueil</a>.</div></div>`;
    }
  }
  if (ctx.alive()) {
    window.scrollTo(0, 0);
    if (!query.has('keepfocus')) main.focus({ preventScroll: true });
  }
}

function setupGlobalHandlers() {
  document.addEventListener('click', async (e) => {
    const sc = e.target.closest('[data-share-copy]');
    if (sc) { const { copyText } = await import('./util.js'); toast((await copyText(sc.dataset.shareCopy)) ? 'Lien copié.' : 'Copie impossible : sélectionnez le lien manuellement.'); return; }
    const bk = e.target.closest('[data-back]');
    if (bk && state.hist && state.hist.length > 1) { e.preventDefault(); history.back(); return; }
    const lg = e.target.closest('[data-lang]');
    if (lg) { setLang(lg.dataset.lang); return; }
    const logout = e.target.closest('[data-logout]');
    if (logout) { await store.signOut(); await refreshUser(); toast('Vous êtes déconnecté.'); go('/'); return; }
    const z = e.target.closest('[data-zoom]');
    if (z) {
      const dlg = document.getElementById('lightbox');
      const img = document.getElementById('lightbox-img');
      img.src = z.dataset.zoom; img.alt = z.dataset.alt || '';
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      return;
    }
    const dlg = document.getElementById('lightbox');
    if (e.target.closest('[data-lightbox-close]') || e.target === dlg) dlg.close();
  });
  // Image manquante (catalogue d'images en cours de production) : on masque la figure sans casser la page.
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('.qfig')) e.target.closest('.qfig').classList.add('missing');
  }, true);
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const announce = (worker) => {
      if (document.getElementById('update-bar')) return;
      const bar = document.createElement('div');
      bar.id = 'update-bar';
      bar.className = 'update-bar';
      bar.setAttribute('role', 'status');
      bar.innerHTML = 'Une nouvelle version est disponible. <button type="button" class="btn btn-sm btn-primary">Actualiser</button>';
      bar.querySelector('button').addEventListener('click', () => worker.postMessage('SKIP_WAITING'));
      document.body.appendChild(bar);
    };
    if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) announce(w);
      });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  }).catch((e) => console.warn('Service worker non enregistré', e));
}

async function boot() {
  setupGlobalHandlers();
  await initStore();
  startI18n();
  window.addEventListener('hashchange', render);
  await render();
  registerSW();
}
boot();
