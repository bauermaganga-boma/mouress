import { CONFIG } from '../../config.js';
import { esc, isEmail } from '../util.js';
import { icon } from '../ui.js';

function safeNext(n) { return n && /^\/(rh|mon-espace|formation)/.test(n) ? n : '/rh'; }

export async function login(ctx, root) {
  ctx.setTitle('Connexion entreprise');
  if (ctx.user) { ctx.go('/rh'); return; }
  const next = safeNext(ctx.query.get('next'));
  const D = CONFIG.DEMO_ACCOUNT;
  const demo = ctx.store.kind === 'local';
  root.innerHTML = `<div class="container page auth-wrap">
    <div class="card auth-card"><h1 class="h1-md">Connexion entreprise</h1>
      <p class="muted">Espace réservé aux entreprises : Pass, sessions de test, résultats, facturation.</p>
      <form id="lf" novalidate>
        <div class="field"><label for="l-email">E-mail professionnel</label><input id="l-email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="l-pass">Mot de passe</label><input id="l-pass" type="password" autocomplete="current-password" required></div>
        <div class="field-error" id="l-err" role="alert"></div>
        <button class="btn btn-primary btn-block" type="submit">Se connecter</button>
      </form>
      <p class="small center" style="margin-top:var(--sp-4)">Pas encore de compte ? <a href="#/inscription">Créer un compte entreprise</a></p></div>
    ${demo ? `<aside class="card demo-box"><span class="badge badge-warn">MODE DÉMO</span><h2 class="h3-sm">Compte de démonstration</h2>
      <p class="small muted">Une « Entreprise Démo » avec des sessions de recrutement, une équipe en montée en compétences et des candidats fictifs.</p>
      <dl class="dl"><div><dt>E-mail</dt><dd><code>${esc(D.email)}</code></dd></div><div><dt>Mot de passe</dt><dd><code>${esc(D.password)}</code></dd></div></dl>
      <div class="btn-row"><button type="button" class="btn btn-navy" id="demo-fill">Remplir les champs</button><button type="button" class="btn btn-primary" id="demo-go">${icon('login', 16)} Entrer en démo</button></div></aside>` : ''}
  </div>`;
  const email = root.querySelector('#l-email'); const pass = root.querySelector('#l-pass'); const err = root.querySelector('#l-err');
  const submit = async () => {
    err.textContent = '';
    if (!isEmail(email.value) || !pass.value) { err.textContent = 'Saisissez votre e-mail et votre mot de passe.'; return; }
    try { await ctx.store.signIn(email.value, pass.value); await ctx.refreshUser(); ctx.toast('Connexion réussie.'); ctx.go(next); } catch (e) { err.textContent = e.message; }
  };
  root.querySelector('#lf').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  root.querySelector('#demo-fill')?.addEventListener('click', () => { email.value = D.email; pass.value = D.password; pass.focus(); });
  root.querySelector('#demo-go')?.addEventListener('click', () => { email.value = D.email; pass.value = D.password; submit(); });
}

export async function signup(ctx, root) {
  ctx.setTitle('Créer un compte entreprise');
  if (ctx.user) { ctx.go('/rh'); return; }
  root.innerHTML = `<div class="container page auth-wrap"><div class="card auth-card"><h1 class="h1-md">Créer un compte entreprise</h1>
    <p class="muted">Quelques minutes suffisent : vous achetez ensuite un Pass par personne invitée.</p>
    <form id="sf" novalidate>
      <div class="field"><label for="s-co">Nom de l’entreprise</label><input id="s-co" type="text" autocomplete="organization" required></div>
      <div class="field"><label for="s-name">Votre nom</label><input id="s-name" type="text" autocomplete="name" required></div>
      <div class="field"><label for="s-email">E-mail professionnel</label><input id="s-email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="s-pass">Mot de passe</label><input id="s-pass" type="password" autocomplete="new-password" minlength="8" required><span class="hint">8 caractères minimum.</span></div>
      <div class="field-error" id="s-err" role="alert"></div>
      <button class="btn btn-primary btn-block" type="submit">Créer mon compte</button></form>
    <p class="xs muted" style="margin-top:var(--sp-4)">${ctx.store.kind === 'local' ? 'Mode démo : le compte est stocké uniquement dans ce navigateur. ' : ''}Déjà inscrit ? <a href="#/connexion">Se connecter</a></p></div></div>`;
  root.querySelector('#sf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (id) => root.querySelector(id).value.trim();
    const err = root.querySelector('#s-err');
    err.textContent = '';
    if (v('#s-co').length < 2 || v('#s-name').length < 2) { err.textContent = 'Renseignez le nom de l’entreprise et votre nom.'; return; }
    if (!isEmail(v('#s-email'))) { err.textContent = 'Adresse e-mail invalide.'; return; }
    if (root.querySelector('#s-pass').value.length < 8) { err.textContent = 'Le mot de passe doit contenir au moins 8 caractères.'; return; }
    try {
      await ctx.store.signUp({ companyName: v('#s-co'), name: v('#s-name'), email: v('#s-email'), password: root.querySelector('#s-pass').value });
      await ctx.refreshUser(); ctx.toast('Compte créé. Bienvenue !'); ctx.go('/rh');
    } catch (ex) { err.textContent = ex.message; }
  });
}
