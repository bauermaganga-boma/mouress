// Organisation de l'entreprise : secteur d'activité, département et responsable (manager) de chaque collaborateur.
// Le « service » reste le champ « équipe » de la fiche collaborateur. Stockage local, comme le reste du mode démo.
const KEY = 'mrs.org.v1';
const empty = () => ({ sectors: {}, org: {}, demo: {} });
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.org ? { ...empty(), ...v } : empty(); } catch { return empty(); } };
const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage plein ou indisponible */ } };
const clean = (s, n = 80) => String(s ?? '').trim().slice(0, n);

export const orgMethods = {
  async getCompanySector(companyId) { return read().sectors[companyId] || ''; },
  async setCompanySector(companyId, sectorId) { const d = read(); d.sectors[companyId] = clean(sectorId, 40); write(d); },
  /** Département et responsable d'un collaborateur : { dept, managerId }. */
  async getOrg(employeeId) { return read().org[employeeId] || { dept: '', managerId: '' }; },
  async listOrg() { return read().org; },
  async setOrg(employeeId, { dept, managerId }) {
    const d = read(); const cur = d.org[employeeId] || { dept: '', managerId: '' };
    d.org[employeeId] = { dept: dept === undefined ? cur.dept : clean(dept), managerId: managerId === undefined ? cur.managerId : clean(managerId, 60) };
    if (!d.org[employeeId].dept && !d.org[employeeId].managerId) delete d.org[employeeId];
    write(d);
  },
  async orgDemoDone(companyId) { return !!read().demo[companyId]; },
  async markOrgDemo(companyId) { const d = read(); d.demo[companyId] = true; write(d); },
};
