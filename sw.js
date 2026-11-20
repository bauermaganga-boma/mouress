// Service worker MOURESS Training.
// - Shell (HTML, CSS, JS, logos, icônes) : mis en cache à l'installation, cache-first.
// - JSON de contenu (data/*.json) et images (assets/img) : cache-first, remplis à la demande.
// - Mise à jour propre : nouvelle version = nouveau nom de cache ; l'ancienne est supprimée à l'activation ;
//   la nouvelle version attend (waiting) jusqu'à ce que l'utilisateur clique « Actualiser » (message SKIP_WAITING).
const VERSION = 'mrs-v35';
const SHELL = `${VERSION}-shell`;
const CONTENT = `${VERSION}-content`;

const SHELL_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'config.js',
  'css/tokens.css', 'css/base.css', 'css/layout.css', 'css/landing.css', 'css/formation.css', 'css/funnel.css', 'css/team.css', 'css/quiz.css', 'css/rh.css', 'css/certificate.css', 'css/mobile.css', 'css/corporate.css', 'css/nav.css', 'css/lang.css', 'css/compact.css', 'css/formations.css', 'css/pilotage.css',
  'js/app.js', 'js/util.js', 'js/i18n.js', 'js/i18n-dict.js', 'js/ui.js', 'js/data.js', 'js/store.js', 'js/seed.js', 'js/quiz.js', 'js/qview.js', 'js/examrunner.js', 'js/payments.js', 'js/certificate.js', 'js/skills.js', 'js/pass.js',
  'js/views/landing.js', 'js/views/training.js', 'js/views/formation.js', 'js/views/profil.js', 'js/views/cours.js', 'js/views/entrainement.js', 'js/views/examen.js', 'js/views/resultat.js',
  'js/views/attestation.js', 'js/views/verifier.js', 'js/views/candidat.js', 'js/views/auth.js', 'js/views/rh.js', 'js/views/rh-invite.js', 'js/views/rh-recruit.js', 'js/views/rh-teams.js', 'js/views/rh-formations.js', 'js/views/rh-pilotage.js', 'js/views/rh-poste.js', 'js/views/rh-emp-parcours.js', 'js/formations-store.js', 'js/parcours-store.js', 'js/org-store.js', 'js/sector.js', 'js/formation-suggest.js', 'js/parcours.js', 'js/share.js', 'js/views/rh-dash.js', 'js/views/espace.js', 'js/views/notfound.js',
  'vendor/qrcode.mjs', 'data/profiles.json', 'content-index.json',
  'assets/logo/mouress-logo-horizontal-couleur-pour-fond-clair.svg', 'assets/logo/mouress-logo-horizontal-couleur-pour-fond-sombre.svg',
  'assets/logo/favicon-32.png', 'assets/logo/apple-touch-icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(SHELL_FILES.map((f) => c.add(f).catch(() => {})))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // polices Google, etc. : réseau normal
  const isContent = /\/(data|assets\/img)\//.test(url.pathname);
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) {
      // Cache-first, avec rafraîchissement en arrière-plan (prochain chargement à jour ; contenus validés plus tard inclus).
      e.waitUntil(fetch(req).then((r) => { if (r.ok) return caches.open(isContent ? CONTENT : SHELL).then((c) => c.put(req, r)); }).catch(() => {}));
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res.ok) {
        const copy = res.clone();
        caches.open(isContent ? CONTENT : SHELL).then((c) => c.put(req, copy));
      }
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await caches.match('index.html')) || Response.error();
      throw err;
    }
  })());
});
