// Organisation de l'entreprise : secteur d'activité, département et responsable (manager) de chaque collaborateur.
// Le « service » reste le champ « équipe » de la fiche collaborateur. Stockage local, comme le reste du mode démo.
const KEY = 'mrs.org.v1';
const empty = () => ({ sectors: {}, org: {}, demo: {} });
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.org ? { ...empty(), ...v } : empty(); } catch { return empty(); } };
const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage plein ou indisponible */ } };
const clean = (s, n = 80) => String(s ?? '').trim().slice(0, n);
const BLANK = { dept: '', managerId: '', base: '', regime: '', workPlace: '', siteName: '', cycleStart: null, absence: null };

export const orgMethods = {
  async getCompanySector(companyId) { return read().sectors[companyId] || ''; },
  async setCompanySector(companyId, sectorId) { const d = read(); d.sectors[companyId] = clean(sectorId, 40); write(d); },
  /** Organisation et présence d'un collaborateur : département, responsable, base de rattachement, régime de rotation,
   *  lieu de travail en rotation, début de la période de présence en cours, absence en cours. */
  async getOrg(employeeId) { return { ...BLANK, ...(read().org[employeeId] || {}) }; },
  async listOrg() { return read().org; },
  async setOrg(employeeId, patch) {
    const d = read(); const cur = { ...BLANK, ...(d.org[employeeId] || {}) };
    const n = { ...cur };
    for (const k of ['dept', 'base', 'siteName']) if (patch[k] !== undefined) n[k] = clean(patch[k]);
    if (patch.managerId !== undefined) n.managerId = clean(patch.managerId, 60);
    if (patch.regime !== undefined) n.regime = ['sedentaire', '7/7', '14/14', '21/21', '28/28'].includes(patch.regime) ? patch.regime : '';
    if (patch.workPlace !== undefined) n.workPlace = patch.workPlace === 'site' ? 'site' : patch.workPlace === 'offshore' ? 'offshore' : '';
    if (patch.cycleStart !== undefined) n.cycleStart = Number(patch.cycleStart) > 0 ? Number(patch.cycleStart) : null;
    if (patch.absence !== undefined) n.absence = patch.absence && patch.absence.type && patch.absence.from && patch.absence.to ? { type: clean(patch.absence.type, 20), from: Number(patch.absence.from), to: Number(patch.absence.to) } : null;
    const empty = !n.dept && !n.managerId && !n.base && !n.siteName && !n.regime && !n.workPlace && !n.cycleStart && !n.absence;
    if (empty) delete d.org[employeeId]; else d.org[employeeId] = n;
    write(d);
  },
  async orgDemoDone(companyId) { return !!read().demo[companyId]; },
  async markOrgDemo(companyId) { const d = read(); d.demo[companyId] = true; write(d); },
};
