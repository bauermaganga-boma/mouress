// Chargement des données de contenu (profils, cours, questions).

let profilesPromise = null;
const contentCache = new Map();

export function getProfilesData() {
  if (!profilesPromise) {
    profilesPromise = fetch('data/profiles.json').then((r) => {
      if (!r.ok) throw new Error('profiles.json introuvable');
      return r.json();
    }).catch((e) => { profilesPromise = null; throw e; });
  }
  return profilesPromise;
}

export async function getProfile(id) {
  const d = await getProfilesData();
  return d.profiles.find((p) => p.id === id) || null;
}

/** Renvoie le contenu du profil, ou null s'il n'existe pas encore (« Contenu bientôt disponible »). */
export function loadContent(id) {
  if (!/^[\w-]+$/.test(id)) return Promise.resolve(null);
  if (!contentCache.has(id)) {
    contentCache.set(id, fetch(`data/content/${id}.json`).then(async (r) => {
      if (!r.ok) return null;
      try {
        const j = await r.json();
        if (!j || !Array.isArray(j.questions)) return null;
        j.modules = Array.isArray(j.modules) ? j.modules : [];
        j.questions = j.questions.filter((q) => q && Array.isArray(q.choices) && q.choices.length >= 2 && Number.isInteger(q.answer));
        return j;
      } catch { return null; }
    }).catch(() => null));
  }
  return contentCache.get(id);
}

export function themesOf(content) {
  const map = new Map();
  for (const q of content.questions) map.set(q.theme, (map.get(q.theme) || 0) + 1);
  return [...map].map(([name, count]) => ({ name, count }));
}

/** Chemin d'image sûr : uniquement relatif à assets/img/, caractères restreints. */
export function imgSrc(p) {
  if (typeof p !== 'string' || !/^[a-z0-9][a-z0-9\-_/]*\.(svg|jpg|jpeg|png|webp)$/i.test(p) || p.includes('..')) return null;
  return `assets/img/${p}`;
}

export function sectorOf(data, id) { return (data.sectors || []).find((s) => s.id === id); }
export function levelOf(data, id) { return data.levels.find((l) => l.id === id); }

// ---------- Entonnoir « secteur › branche › niveau › poste » (tout vient de profiles.json) ----------
export const domainOf = (data, id) => (data.domains || []).find((d) => d.id === id);
export const branchOf = (data, id) => (data.branches || []).find((b) => b.id === id);

export function postes(data, { domain, branch, level } = {}) {
  return data.profiles.filter((p) => (!domain || (p.domains || []).includes(domain)) && (!branch || p.branch === branch) && (!level || p.level === level));
}

/** Disponibilité des contenus (content-index.json généré par tools/build-index.mjs). null si absent. */
let availP = null;
export function getAvailability() {
  if (!availP) availP = fetch('content-index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return availP;
}

/** Mémorise le chemin d'entonnoir suivi, pour le fil d'Ariane de la fiche profil. */
export function rememberFunnel(profileId, domain) {
  try { const m = JSON.parse(sessionStorage.getItem('mrs.funnel') || '{}'); m[profileId] = domain; sessionStorage.setItem('mrs.funnel', JSON.stringify(m)); } catch { /* ignore */ }
}
export function funnelDomainFor(data, profile) {
  try {
    const d = JSON.parse(sessionStorage.getItem('mrs.funnel') || '{}')[profile.id];
    if (d && (profile.domains || []).includes(d)) return d;
  } catch { /* ignore */ }
  return (profile.domains || [])[0] || null;
}
