// Formations cohérentes avec un poste : propositions classées selon le secteur de l'entreprise, le niveau et l'intitulé du poste.
// Ce sont des idées de départ ; l'entreprise garde la main sur le titre, la durée, la validité et l'organisme.
const A = ['*'];
export const FORMATION_IDEAS = [
  { title: 'Habilitation électrique BR / B2V', category: 'Sécurité', hours: 21, validityMonths: 36, boost: 2, sectors: A, kw: /électri|instrument|automat|maintenan|EIA/i },
  { title: 'Travail en hauteur', category: 'Sécurité', hours: 14, validityMonths: 36, sectors: A, kw: /tuyau|soud|maintenan|mécani|inspect|grutier|HSE|échafaud|port|mine|forage/i },
  { title: 'Espaces confinés', category: 'Sécurité', hours: 14, validityMonths: 36, sectors: A, kw: /raffin|stockage|tuyau|soud|process|procédé|opérateur|corrosion|inspect/i },
  { title: 'Secourisme (SST)', category: 'Sécurité', hours: 14, validityMonths: 24, sectors: A, kw: /./ },
  { title: 'Lutte contre l’incendie', category: 'Sécurité', hours: 7, validityMonths: 12, sectors: A, kw: /opérateur|technicien|HSE|agent|contremaître|raffin|stockage/i },
  { title: 'Permis de travail et consignation', category: 'Sécurité', hours: 7, validityMonths: 24, sectors: A, kw: /opérateur|technicien|maintenan|superviseur|HSE|chef/i },
  { title: 'Sensibilisation H2S', category: 'Sécurité', hours: 7, validityMonths: 12, sectors: ['petrole-gaz'], kw: /production|forage|raffin|opérateur|salle de contrôle|puits|process|HSE/i },
  { title: 'Survie en mer (BOSIET)', category: 'Sécurité', hours: 28, validityMonths: 48, sectors: ['petrole-gaz'], kw: /offshore|forage|production|puits|plateforme|OIM/i },
  { title: 'Zones ATEX', category: 'Sécurité', hours: 14, validityMonths: 36, sectors: ['petrole-gaz', 'energie', 'industrie'], kw: /électri|instrument|process|procédé|opérateur|maintenan|HSE|raffin/i },
  { title: 'Contrôle de puits (niveau adapté au poste)', category: 'Technique', hours: 40, validityMonths: 24, sectors: ['petrole-gaz'], kw: /forage|driller|puits|wireline|workover|IWCF/i },
  { title: 'Maintenance préventive et GMAO', category: 'Technique', hours: 21, validityMonths: 0, sectors: A, kw: /maintenan|mécani|électri|instrument|turbine|compresseur/i },
  { title: 'Lecture de plans et schémas', category: 'Technique', hours: 14, validityMonths: 0, sectors: A, kw: /technicien|électri|instrument|tuyau|mécani|soud|dessin/i },
  { title: 'Conduite d’engins', category: 'Technique', hours: 21, validityMonths: 60, sectors: ['mines', 'logistique-port', 'industrie'], kw: /engin|chariot|grue|grutier|conducteur|port|manutention|logisti/i },
  { title: 'Manutention, arrimage et gestes et postures', category: 'Sécurité', hours: 7, validityMonths: 24, sectors: ['logistique-port', 'industrie'], kw: /bportb|logisti|manutention|magasin|stock|quai|docker/i },
  { title: 'Transport de matières dangereuses (ADR)', category: 'Réglementaire', hours: 21, validityMonths: 60, sectors: ['logistique-port', 'petrole-gaz'], kw: /transport de|logisti|port|stockage|chauffeur/i },
  { title: 'Sécurité minière et stabilité des terrains', category: 'Sécurité', hours: 14, validityMonths: 24, sectors: ['mines'], kw: /./ },
  { title: 'Code des hydrocarbures : bases pour les non-juristes', category: 'Réglementaire', hours: 14, validityMonths: 0, sectors: ['petrole-gaz'], kw: /juriste|fiscal|auditeur|contrat|finance|achat|RH|ressources|manager|chef|ingénieur|support|assistant/i },
  { title: 'Droit du travail et relations sociales', category: 'Réglementaire', hours: 14, validityMonths: 0, sectors: A, kw: /RH|ressources humaines|paie|juriste|manager|chef|responsable|superviseur/i },
  { title: 'Marchés publics et achats', category: 'Réglementaire', hours: 14, validityMonths: 0, sectors: A, kw: /achat|approvisionnement|logisti|juriste|contrat|gestionnaire/i },
  { title: 'Fiscalité pétrolière : redevance et partage de production', category: 'Réglementaire', hours: 14, validityMonths: 0, sectors: ['petrole-gaz'], kw: /fiscal|financ|audit|trésor|compta|contrôleur|économ/i },
  { title: 'Audit interne et contrôle des risques', category: 'Qualité / HSE', hours: 21, validityMonths: 0, sectors: A, kw: /audit|contrôle|compta|financ|qualité|risque/i },
  { title: 'Audits et inspections HSE', category: 'Qualité / HSE', hours: 14, validityMonths: 24, sectors: A, kw: /HSE|QHSE|inspect|sécurité|environnement/i },
  { title: 'Gestion des déchets et protection de l’environnement', category: 'Qualité / HSE', hours: 7, validityMonths: 36, sectors: A, kw: /HSE|QHSE|environnement|raffin|process|opérateur|mine/i },
  { title: 'Management d’équipe', category: 'Management', hours: 21, validityMonths: 0, sectors: A, kw: /superviseur|chef|manager|responsable|contremaître|directeur|cadre|OIM/i },
  { title: 'Gestion de projet', category: 'Management', hours: 28, validityMonths: 0, sectors: A, kw: /ingénieur|projet|responsable|chef|manager|cadre/i },
  { title: 'Leadership et communication', category: 'Management', hours: 14, validityMonths: 0, sectors: A, kw: /manager|directeur|chef|cadre|OIM|responsable/i },
  { title: 'Anglais technique', category: 'Langues', hours: 40, validityMonths: 0, sectors: A, kw: /offshore|ingénieur|forage|technicien|opérateur|contrat|port|international/i },
];

/** Idées classées pour un poste (8 au plus), hors celles déjà présentes (titres en minuscules). */
export function suggestFormations(profile, sectorId, existing = []) {
  const have = new Set(existing.map((t) => String(t).toLowerCase()));
  const text = `${profile?.name || ''} ${profile?.desc || ''}`;
  return FORMATION_IDEAS.map((f) => {
    const sectorOk = f.sectors.includes('*') || f.sectors.includes(sectorId);
    if (!sectorOk) return null;
    const generic = f.kw.source === '.';
    const match = !generic && f.kw.test(text);
    let score = (f.sectors.includes(sectorId) ? 2 : 1) + (match ? 3 : 0) + (generic ? 1.6 : 0) + (match ? (f.boost || 0) : 0);
    if (profile?.level && ['sup', 'mgr', 'cadre', 'ing'].includes(profile.level) && f.category === 'Management') score += 1.5;
    if (profile?.level && ['tech', 'assist', 'tous'].includes(profile.level) && f.category === 'Management') score -= 2;
    const { kw, ...rest } = f;
    return { ...rest, score, match };
  }).filter((f) => f && f.score >= 2.5 && !have.has(f.title.toLowerCase())).sort((a, b) => b.score - a.score).slice(0, 8);
}
