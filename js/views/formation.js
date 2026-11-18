import { getProfilesData, sectorOf, levelOf } from '../data.js';
import { esc } from '../util.js';
import { icon, sectorIcon } from '../ui.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default async function render(ctx, root) {
  ctx.setTitle('Catalogue de formation');
  const data = await getProfilesData();
  if (!ctx.alive()) return;
  const f = { sector: ctx.query.get('secteur') || '', level: ctx.query.get('niveau') || '', q: ctx.query.get('q') || '' };
  const avail = new Map(); // profileId -> {modules, questions} | null

  root.innerHTML = `<div class="container page">
    <div class="page-head"><h1>Formation</h1>
      <p>Choisissez un profil : cours, entraînement par thème, puis examen. Votre progression est mémorisée sur cet appareil.</p></div>
    <div class="filters card" role="search">
      <div class="field"><label for="f-q">Rechercher un profil ou une compétence</label>
        <input id="f-q" type="search" placeholder="Ex. soudeur, SYSCOHADA, forage…" value="${esc(f.q)}" autocomplete="off"></div>
      <div class="filter-group"><span class="label" id="lbl-sec">Secteur</span><div class="chips" role="group" aria-labelledby="lbl-sec" id="chips-sec"></div></div>
      <div class="filter-group"><span class="label" id="lbl-lvl">Niveau</span><div class="chips" role="group" aria-labelledby="lbl-lvl" id="chips-lvl"></div></div>
    </div>
    <p class="muted small" id="count" aria-live="polite"></p>
    <div class="grid grid-3" id="list"></div></div>`;

  const chips = (id, items, key) => {
    const el = root.querySelector(id);
    el.innerHTML = [{ id: '', name: 'Tous' }, ...items].map((i) => `<button type="button" class="chip" data-key="${key}" data-v="${esc(i.id)}" aria-pressed="${f[key] === i.id}">${esc(i.short || i.name)}</button>`).join('');
  };
  const drawChips = () => { chips('#chips-sec', data.sectors, 'sector'); chips('#chips-lvl', data.levels, 'level'); };

  const card = (p) => {
    const a = avail.get(p.id);
    const s = sectorOf(data, p.sector);
    const status = a === undefined ? '' : a ? `<span class="badge badge-ok">${a.modules} modules · ${a.questions} questions</span>` : '<span class="badge badge-warn">Bientôt disponible</span>';
    return `<a class="card card-link pcard" href="#/profil/${esc(p.id)}">
      <div class="pcard-top"><span class="pcard-ico">${sectorIcon(s, 22)}</span><span class="badge badge-info">${esc(levelOf(data, p.level)?.name || '')}</span></div>
      <h3>${esc(p.name)}</h3><p class="muted small">${esc(p.desc)}</p>
      <div class="pcard-foot"><span class="xs muted">${esc(s?.name || '')}</span>${status}</div></a>`;
  };

  const draw = () => {
    const q = norm(f.q);
    const list = data.profiles.filter((p) => (!f.sector || p.sector === f.sector) && (!f.level || p.level === f.level)
      && (!q || norm(p.name + ' ' + p.desc + ' ' + (sectorOf(data, p.sector)?.name || '')).includes(q)));
    root.querySelector('#count').textContent = `${list.length} profil${list.length > 1 ? 's' : ''}`;
    root.querySelector('#list').innerHTML = list.length ? list.map(card).join('')
      : `<div class="card" style="grid-column:1/-1"><h3>Aucun profil ne correspond</h3><p class="muted">Modifiez la recherche ou retirez un filtre.</p></div>`;
  };

  drawChips(); draw();
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    f[b.dataset.key] = b.dataset.v;
    drawChips(); draw();
  });
  root.querySelector('#f-q').addEventListener('input', (e) => { f.q = e.target.value; draw(); });

  // Disponibilité du contenu : lue dans content-index.json (généré par tools/build-index.mjs), sans sonder chaque fichier.
  fetch('content-index.json').then((r) => (r.ok ? r.json() : null)).then((idx) => {
    if (!idx || !ctx.alive()) return;
    for (const p of data.profiles) avail.set(p.id, idx[p.id] || null);
    draw();
  }).catch(() => {});
}
