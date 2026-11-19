// Formation en entonnoir : secteur › (métiers techniques | fonctions support & QHSE) › niveau › postes.
// Aucune liste en dur : secteurs, branches et niveaux viennent de data/profiles.json.
import { getProfilesData, domainOf, branchOf, levelOf, postes, getAvailability, rememberFunnel } from '../data.js';
import { esc } from '../util.js';
import { icon, badge, pageHead } from '../ui.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plural = (n) => `${n} poste${n > 1 ? 's' : ''}`;

const bigCard = ({ href, ico, title, desc, count, meta }) => `<a class="card card-link funnel-card" href="${esc(href)}">
  <span class="funnel-ico">${icon(ico || 'briefcase', 28)}</span>
  <span class="funnel-body"><strong class="funnel-title">${esc(title)}</strong>${desc ? `<span class="muted small">${esc(desc)}</span>` : ''}<span class="funnel-meta">${badge(meta || plural(count))}</span></span>
  <span class="funnel-go">${icon('arrow', 22)}</span></a>`;

function posteCard(data, p, avail, domain) {
  const a = avail ? avail[p.id] : undefined;
  const status = a === undefined ? '' : a ? `<span class="badge badge-ok">${a.modules} modules · ${a.questions} questions</span>` : '<span class="badge badge-warn">Bientôt disponible</span>';
  return `<a class="card card-link pcard" href="#/profil/${esc(p.id)}" data-remember="${esc(p.id)}" data-domain="${esc(domain || '')}">
    <div class="pcard-top"><span class="badge badge-info">${esc(levelOf(data, p.level)?.name || '')}</span>${status}</div>
    <h3>${esc(p.name)}</h3><p class="muted small">${esc(p.desc)}</p>
    <div class="pcard-foot"><span class="xs muted">${esc(branchOf(data, p.branch)?.name || '')}</span><span class="funnel-go sm">${icon('arrow', 18)}</span></div></a>`;
}

export default async function render(ctx, root) {
  const data = await getProfilesData();
  if (!ctx.alive()) return;
  const { d, b, l } = ctx.params;

  // Anciens liens #/formation?secteur=… : redirection vers le secteur correspondant.
  if (!d && ctx.query.get('secteur')) {
    const p = data.profiles.find((x) => x.sector === ctx.query.get('secteur'));
    if (p?.domains?.[0]) { ctx.go(`/formation/${p.domains[0]}`); return; }
  }

  const avail = await getAvailability();
  const remember = (el) => el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-remember]');
    if (c && c.dataset.domain) rememberFunnel(c.dataset.remember, c.dataset.domain);
  });
  const notFound = async () => (await import('./notfound.js')).default(ctx, root);

  /* Étape 1 : secteurs (+ recherche) */
  if (!d) {
    ctx.setTitle('Secteur et profil');
    root.innerHTML = `<div class="container page">
      ${pageHead({ crumbs: [{ label: 'Formation' }], title: 'Choisissez votre secteur et votre profil', text: 'Cours, entraînement par thème puis examen. Votre progression est mémorisée sur cet appareil.' })}
      <div class="card search-card" role="search"><div class="field"><label for="f-q">Vous connaissez déjà le poste ? Recherchez-le</label>
        <input id="f-q" type="search" placeholder="Ex. soudeur, SYSCOHADA, forage…" value="${esc(ctx.query.get('q') || '')}" autocomplete="off"></div></div>
      <div id="out"></div></div>`;
    const out = root.querySelector('#out');
    const draw = () => {
      const q = norm(root.querySelector('#f-q').value.trim());
      if (!q) {
        const groups = data.groups || [];
        const items = [];
        for (const dm of data.domains || []) {
          const g = groups.find((x) => x.id === dm.group);
          if (g) { if (!items.some((i) => i.id === g.id)) items.push({ id: g.id, name: g.name, icon: g.icon, desc: g.desc, count: new Set((data.domains || []).filter((x) => x.group === g.id).flatMap((x) => postes(data, { domain: x.id }).map((p) => p.id))).size }); }
          else items.push({ id: dm.id, name: dm.name, icon: dm.icon, desc: dm.desc, count: postes(data, { domain: dm.id }).length });
        }
        out.innerHTML = `<div class="grid grid-2 funnel-grid">${items.map((i) => bigCard({ href: `#/formation/${i.id}`, ico: i.icon, title: i.name, desc: i.desc, count: i.count })).join('')}</div>`;
        return;
      }
      const list = data.profiles.filter((p) => norm(`${p.name} ${p.desc} ${(p.domains || []).map((x) => domainOf(data, x)?.name).join(' ')}`).includes(q));
      out.innerHTML = `<p class="muted small" aria-live="polite">${plural(list.length)} trouvé${list.length > 1 ? 's' : ''}</p>
        <div class="grid grid-3">${list.map((p) => posteCard(data, p, avail, p.domains?.[0])).join('') || '<div class="card"><h3>Aucun poste ne correspond</h3><p class="muted">Essayez un autre mot, ou choisissez un secteur.</p></div>'}</div>`;
    };
    root.querySelector('#f-q').addEventListener('input', draw);
    remember(root);
    draw();
    return;
  }

  const home = { label: 'Formation', href: '#/formation' };

  /* Étape 2 (pétrole & gaz) : amont ou aval */
  const grp = (data.groups || []).find((g) => g.id === d);
  if (grp) {
    ctx.setTitle(grp.name);
    const cards = (data.domains || []).filter((x) => x.group === grp.id).map((x) => bigCard({ href: `#/formation/${x.id}`, ico: x.icon, title: x.name.replace(grp.name + ' : ', ''), desc: x.desc, count: postes(data, { domain: x.id }).length })).join('')
      + (grp.shared || []).map((id) => data.profiles.find((pp) => pp.id === id)).filter(Boolean).map((pp) => bigCard({ href: `#/profil/${pp.id}`, ico: 'book', title: pp.cardTitle || pp.name, desc: pp.cardDesc || pp.desc, meta: 'Amont et aval' })).join('');
    root.innerHTML = `<div class="container page">${pageHead({ crumbs: [home, { label: grp.name }], back: '#/formation', eyebrow: 'Étape 2', title: grp.name, text: 'Amont ou aval ?' })}<div class="grid grid-2 funnel-grid">${cards}</div></div>`;
    return;
  }

  const dm = domainOf(data, d);
  if (!dm) return notFound();
  const pg = (data.groups || []).find((g) => g.id === dm.group);
  const home2 = pg ? [home, { label: pg.name, href: `#/formation/${pg.id}` }] : [home];
  const back1 = pg ? `#/formation/${pg.id}` : '#/formation';

  /* Étape 2 : branche */
  if (!b) {
    ctx.setTitle(dm.name);
    const cards = (data.branches || []).filter((br) => !br.sharedOnly).map((br) => ({ br, n: postes(data, { domain: d, branch: br.id }).length })).filter((x) => x.n)
      .map(({ br, n }) => bigCard({ href: `#/formation/${d}/${br.id}`, ico: br.id === 'support' ? 'briefcase' : br.id === 'reglementation' ? 'book' : 'wrench', title: br.name, desc: br.desc, count: n })).join('');
    root.innerHTML = `<div class="container page">${pageHead({ crumbs: [...home2, { label: dm.name }], back: back1, eyebrow: 'Type de métier', title: dm.name, text: 'Quel type de métier ?' })}
      <div class="grid grid-2 funnel-grid">${cards}</div></div>`;
    return;
  }

  const br = branchOf(data, b);
  if (!br) return notFound();
  const c2 = [...home2, { label: dm.name, href: `#/formation/${d}` }];

  /* Fonctions support : pas de niveau, on liste directement les fonctions */
  if (br.noLevel) {
    const fl = postes(data, { domain: d, branch: b });
    ctx.setTitle(`${dm.name} · ${br.name}`);
    root.innerHTML = `<div class="container page">${pageHead({ crumbs: [...c2, { label: br.name }], back: `#/formation/${d}`, eyebrow: 'Fonctions', title: `${dm.name} › ${br.name}`, text: `${plural(fl.length)}. Choisissez la fonction à travailler ou à tester.` })}<div class="grid grid-3">${fl.map((p) => posteCard(data, p, avail, d)).join('')}</div></div>`;
    remember(root);
    return;
  }

  /* Étape 3 : niveau */
  if (!l) {
    ctx.setTitle(`${dm.name} · ${br.name}`);
    const cards = (data.levels || []).map((lv) => ({ lv, n: postes(data, { domain: d, branch: b, level: lv.id }).length })).filter((x) => x.n)
      .map(({ lv, n }) => bigCard({ href: `#/formation/${d}/${b}/${lv.id}`, ico: 'users', title: lv.name, count: n })).join('');
    root.innerHTML = `<div class="container page">${pageHead({ crumbs: [...c2, { label: br.name }], back: `#/formation/${d}`, eyebrow: 'Niveau', title: `${dm.name} › ${br.name}`, text: 'Choisissez le niveau du poste.' })}
      <div class="grid grid-2 funnel-grid">${cards}</div></div>`;
    return;
  }

  /* Étape 4 : postes */
  const lv = levelOf(data, l);
  if (!lv) return notFound();
  const list = postes(data, { domain: d, branch: b, level: l });
  ctx.setTitle(`${dm.name} · ${lv.name}`);
  root.innerHTML = `<div class="container page">${pageHead({ crumbs: [...c2, { label: br.name, href: `#/formation/${d}/${b}` }, { label: lv.name }], back: `#/formation/${d}/${b}`, eyebrow: 'Postes', title: `${dm.name} › ${br.name} › ${lv.name}`, text: `${plural(list.length)}. Choisissez le profil à travailler ou à tester.` })}
    <div class="grid grid-3">${list.map((p) => posteCard(data, p, avail, d)).join('') || '<div class="card"><p class="muted">Aucun poste à ce niveau pour le moment.</p></div>'}</div></div>`;
  remember(root);
}
