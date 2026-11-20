// Secteurs d'activité de l'entreprise : un secteur regroupe des domaines (ex. Pétrole & gaz = amont + aval).
// Une fois le secteur choisi, les postes proposés restent dans ce secteur. Tout vient de data/profiles.json.

/** Liste des secteurs : les groupes (Pétrole & gaz) puis les domaines qui n'appartiennent à aucun groupe. */
export function sectorList(data) {
  const groups = (data.groups || []).map((g) => ({ id: g.id, name: g.name, icon: g.icon || 'factory', desc: g.desc || '', domains: (data.domains || []).filter((d) => d.group === g.id).map((d) => d.id), shared: g.shared || [] }));
  const alone = (data.domains || []).filter((d) => !d.group).map((d) => ({ id: d.id, name: d.name, icon: d.icon || 'factory', desc: d.desc || '', domains: [d.id], shared: [] }));
  return [...groups, ...alone];
}
export const sectorById = (data, id) => sectorList(data).find((s) => s.id === id) || null;

/** Postes d'un secteur (tous les postes si aucun secteur n'est choisi). */
export function sectorProfiles(data, sectorId) {
  const s = sectorById(data, sectorId);
  if (!s) return data.profiles;
  return data.profiles.filter((p) => s.shared.includes(p.id) || (p.domains || []).some((d) => s.domains.includes(d)));
}
export function sectorDomains(data, sectorId) {
  const s = sectorById(data, sectorId);
  return s ? (data.domains || []).filter((d) => s.domains.includes(d.id)) : (data.domains || []);
}
