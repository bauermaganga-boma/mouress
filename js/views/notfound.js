export default function render(ctx, root) {
  ctx.setTitle('Page introuvable');
  root.innerHTML = `<div class="container-narrow page center"><h1>Page introuvable</h1>
    <p class="muted">Ce lien n’existe pas ou n’est plus valide.</p>
    <div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="#/">Accueil</a><a class="btn btn-outline" href="#/formation">Catalogue de formation</a></div></div>`;
}
