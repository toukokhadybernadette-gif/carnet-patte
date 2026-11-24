// Test « compte » : connexion facultative par code à 6 chiffres reçu par e-mail (étape 0 des comptes).
// Aucun vrai serveur Supabase n'est appelé : un FAUX serveur local imite l'API d'authentification (envoi du code, vérification, renouvellement, déconnexion).
// Vérifie : invisible tant que non configuré (aucun téléchargement, aucune requête), parcours complet (e-mail → code → connecté → rechargement → renouvellement
// de la session → déconnexion), messages d'erreur en français, hors connexion, données des animaux jamais touchées ni envoyées, aucune clé secrète dans le site,
// bibliothèque absente du cache hors ligne, écrans de 375 et 390 px sans chevauchement, accessibilité.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';
import { listerFichiers } from '../outils/preparer-sw.mjs';

const [S, , TAG] = process.argv.slice(2);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

// ----- Faux serveur d'authentification (imite GoTrue de Supabase) -----
const journal = [];
const etat = { plan: 'gratuit', attente: false, supprime: false };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const session = (email, expiresIn = 3600) => {
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const user = { id: '11111111-2222-3333-4444-555555555555', aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email, exp, aud: 'authenticated', role: 'authenticated' })}.signature`, token_type: 'bearer', expires_in: expiresIn, expires_at: exp, refresh_token: `refresh-${Date.now()}`, user };
};
const faux = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  let corps = ''; req.on('data', (d) => { corps += d; });
  req.on('end', () => {
    let b = {}; try { b = JSON.parse(corps || '{}'); } catch { /* corps vide */ }
    journal.push({ methode: req.method, chemin: url.pathname + url.search, corps: b, apikey: req.headers.apikey, autorisation: req.headers.authorization });
    const json = (code, o) => res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(o));
    if (url.pathname === '/auth/v1/otp') {
      if (b.email === 'limite@exemple.fr') return json(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' });
      if (b.email === 'format@exemple.fr') return json(400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
      return json(200, {});
    }
    if (url.pathname === '/auth/v1/verify') return b.token === '123456' ? json(200, session(b.email)) : json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    if (url.pathname === '/auth/v1/token') return json(200, session('ok@exemple.fr'));
    if (url.pathname === '/auth/v1/user') return json(200, session('ok@exemple.fr').user);
    if (url.pathname === '/auth/v1/logout') { res.writeHead(204, cors).end(); return; }
    // Tables et fonction de l'étape 2 (supabase/etape2.sql) : profil, liste d'attente Premium, suppression du compte
    if (url.pathname === '/rest/v1/profils' && req.method === 'GET') return json(200, [{ plan: etat.plan, cree_le: '2026-11-23T10:00:00Z' }]);
    if (url.pathname === '/rest/v1/liste_attente_premium') {
      if (req.method === 'GET') return json(200, etat.attente ? [{ user_id: '11111111-2222-3333-4444-555555555555' }] : []);
      if (req.method === 'POST') { etat.attente = true; res.writeHead(201, cors).end(); return; }
      if (req.method === 'DELETE') { etat.attente = false; res.writeHead(204, cors).end(); return; }
    }
    if (url.pathname.startsWith('/storage/v1/object/list/')) return json(200, []); // aucun fichier cloud (compte gratuit)
    if (url.pathname === '/rest/v1/rpc/supprimer_mon_compte') { etat.supprime = true; res.writeHead(204, cors).end(); return; }
    json(404, { msg: 'inconnu' });
  });
});
await new Promise((ok) => faux.listen(0, '127.0.0.1', ok));
const URL_FAUX = `http://127.0.0.1:${faux.address().port}`;
const CLE = 'sb_publishable_cle_de_test_0123456789';

// ----- Serveur du site -----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
let configServie = 'vide'; // le vrai js/supabase-config.js est rempli : le site du test sert SA config (vide au début, puis le faux serveur), jamais le vrai projet
const site = http.createServer((req, res) => {
  let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (chemin === '/') chemin = '/index.html';
  if (chemin === '/js/supabase-config.js') { res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }).end(`export const SUPABASE = ${JSON.stringify(configServie === 'vide' ? { url: '', cle: '' } : { url: URL_FAUX, cle: CLE })};`); return; }
  const f = path.join(RACINE, chemin);
  if (!f.startsWith(RACINE) || f.startsWith(path.join(RACINE, 'tests')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => site.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${site.address().port}`;
await send('Network.enable');
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(1800);
await taille(375, 812);

const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Moka-secret-42', espece: 'chien', especeAutre: '', race: 'Berger', naissance: '2023-08-01', photo: '' }],
  soins: [{ id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: jour(-60), notes: 'NOTE-PRIVEE-UNIQUE', rappel: jour(5), rappelFait: false }], pesees: [] };
await importer(fichier);
const avant = await donnees();
const ressources = () => ev(`performance.getEntriesByType('resource').map((r) => r.name)`);
const saisir = (sel, v) => ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const soumettre = async (sel = 'form') => { await ev(`document.querySelector(${JSON.stringify(sel)}).requestSubmit()`); await dort(900); };
const stockage = () => ev(`localStorage.getItem('carnetpatte.compte')`);

// ===== 1. Non configuré : invisible, rien ne se charge =====
log('--- 1. Non configuré ---');
await aller('#/profil'); await dort(400);
verifier(await ev(`!document.querySelector('a[href="#/compte"]')`), 'Profil : aucune ligne « Compte » tant que js/supabase-config.js est vide');
await aller('#/compte'); await dort(400);
verifier((await texte('#contenu')).includes('Pas encore activé') && await ev(`!document.querySelector('form')`), 'la page Compte dit que les comptes ne sont pas encore activés (aucun formulaire)');
for (const h of ['#/accueil', '#/animaux', '#/animaux/rappels', '#/profil', '#/carte']) await aller(h);
verifier(!(await ressources()).some((u) => /assets\/supabase\/|\.supabase\.co/i.test(u)), 'aucune bibliothèque ni requête Supabase téléchargée en utilisant l’appli');
const config = fs.readFileSync(path.join(RACINE, 'js/supabase-config.js'), 'utf8');
verifier(/url: '',/.test(config) && /cle: '',/.test(config) || /sb_publishable_|anon/.test(config) || /url: 'https:\/\/[a-z0-9]+\.supabase\.co'/.test(config), 'js/supabase-config.js : vide, ou seulement l’adresse du projet et la clé publishable');

// ===== 2. Aucune clé secrète dans le site ; bibliothèque hors du cache hors ligne =====
log('--- 2. Sécurité du site ---');
const fichiersSite = []; const parcourir = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) parcourir(p); else if (/\.(js|html|css|json|webmanifest|mjs)$/.test(e.name)) fichiersSite.push(p); } };
for (const d of ['js', 'modules', 'css']) parcourir(path.join(RACINE, d));
for (const f of ['index.html', 'demenagement.html', 'sw.js', 'manifest.webmanifest']) fichiersSite.push(path.join(RACINE, f));
const sansCommentaires = (f) => { const t = fs.readFileSync(f, 'utf8'); return f.endsWith('.js') ? t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') : t; }; // les commentaires disent « jamais de clé service_role » : on ne lit que le code
const secrets = fichiersSite.filter((f) => /service_role|sb_secret_|sk_live_|sk_test_|whsec_|postgres(ql)?:\/\/|SUPABASE_SERVICE/i.test(sansCommentaires(f))).map((f) => path.relative(RACINE, f));
verifier(secrets.length === 0, `aucune clé secrète (service_role, sb_secret_, Stripe, mot de passe de base) dans ${fichiersSite.length} fichiers du site${secrets.length ? ' → ' + secrets.join(', ') : ''}`);
const liste = listerFichiers();
verifier(!liste.some((f) => f.startsWith('assets/supabase/')) && fs.existsSync(path.join(RACINE, 'assets/supabase/supabase.js')) && fs.existsSync(path.join(RACINE, 'assets/supabase/LICENSE-supabase-js.txt')), 'la bibliothèque (220 Ko, licence MIT jointe) n’est PAS dans le cache hors ligne : elle ne se télécharge qu’à la demande');

// Le script SQL de l'étape 2 (à coller dans Supabase) : RLS partout, droits explicites, rien pour « anon »
const sql = fs.readFileSync(path.join(RACINE, 'supabase/etape2.sql'), 'utf8').replace(/--.*$/gm, '');
const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
verifier(tables.length >= 2 && tables.every((t) => new RegExp(`alter table public[.]${t} +enable row level security`).test(sql)), `supabase/etape2.sql : RLS activée sur chaque table (${tables.join(', ')})`);
const politiques = [...sql.matchAll(/create policy[\s\S]*?;/g)].map((m) => m[0]);
verifier(politiques.length >= 4 && politiques.every((p) => /to authenticated/.test(p) && /\(select auth\.uid\(\)\) = (id|user_id)/.test(p)), `${politiques.length} règles : toutes réservées aux comptes connectés et limitées aux lignes de la personne (auth.uid())`);
verifier(!/\bto anon\b|grant[^;]*\banon\b/i.test(sql) && tables.every((t) => new RegExp(`revoke all on public[.]${t} +from anon, authenticated`).test(sql)), 'droits explicites : tout est retiré à « anon », rien ne lui est donné');
verifier(!/grant[^;]*(update|truncate|references|trigger)[^;]*on public\.(profils|liste_attente_premium)/i.test(sql) && !/for (update|all)/i.test(sql), 'aucun droit de modification sur le profil : personne ne peut se donner Premium depuis l’appli');
verifier(/security definer set search_path = ''/.test(sql) && /revoke execute on function public\.supprimer_mon_compte\(\) from public, anon/.test(sql) && /grant\s+execute on function public\.supprimer_mon_compte\(\) to authenticated/.test(sql) && /auth\.uid\(\)/.test(sql.split('supprimer_mon_compte')[1]), 'supprimer_mon_compte : fonction sécurisée, réservée aux comptes connectés, ne supprime que SON compte');
verifier(!/service_role|sb_secret_/i.test(sql), 'aucune clé secrète dans le script SQL');

// ===== 3. Configuré (faux serveur) : visible, parcours complet =====
log('--- 3. Parcours de connexion ---');
configServie = 'faux'; await send('Page.reload'); await dort(2000); // la page relit la config servie (maintenant le faux serveur)
await aller('#/profil'); await dort(400);
verifier(await ev(`[...document.querySelectorAll('a[href="#/compte"]')].some((a) => a.textContent.includes('Compte'))`), 'Profil : la ligne « Compte » apparaît quand c’est configuré');
await aller('#/compte'); await dort(500);
verifier((await texte('h1')) === 'Compte' && (await texte('#contenu')).includes('facultatif') && await ev(`!!document.querySelector('#cm-email')`), 'page Compte : « facultatif », champ e-mail');
verifier(!(await ressources()).some((u) => /supabase\.js/.test(u)), 'ouvrir la page sans être connecté ne télécharge toujours rien (jamais connecté)');
verifier(await ev(`document.querySelector('#cm-email').autocomplete`) === 'email' && await ev(`document.querySelector('#cm-email').type`) === 'email', 'champ e-mail : clavier e-mail, saisie automatique');
await controler('Compte (e-mail) à 375 px'); await axe('#contenu', 'compte : e-mail'); await ecran('compte-email');
await saisir('#cm-email', 'pas-une-adresse'); await soumettre();
verifier((await texte('#cm-email-erreur')).includes('adresse e-mail valide') && journal.length === 0, 'adresse invalide : message clair, aucune requête envoyée');
await saisir('#cm-email', 'limite@exemple.fr'); await soumettre();
verifier((await texte('#cm-email-erreur')).includes('Trop de codes demandés'), `trop de demandes : « ${await texte('#cm-email-erreur')} »`);
await saisir('#cm-email', 'format@exemple.fr'); await soumettre();
verifier((await texte('#cm-email-erreur')).includes('ne semble pas valide'), 'refus du serveur sur le format : message clair');
verifier((await ressources()).some((u) => /assets\/supabase\/supabase\.js/.test(u)), 'la bibliothèque est téléchargée au moment de la première demande de code');
await saisir('#cm-email', 'ok@exemple.fr'); await soumettre();
verifier(await ev(`!!document.querySelector('#cm-code')`) && (await texte('#contenu')).includes('ok@exemple.fr'), 'code demandé : l’écran du code rappelle l’adresse');
const otp = journal.filter((j) => j.chemin.startsWith('/auth/v1/otp')).at(-1);
verifier(otp.corps.email === 'ok@exemple.fr' && otp.apikey === CLE && otp.corps.create_user === true, `requête d’envoi du code : e-mail, clé publique, création du compte à la première connexion (${JSON.stringify({ email: otp.corps.email, create_user: otp.corps.create_user })})`);
verifier(await ev(`document.querySelector('#cm-code').autocomplete`) === 'one-time-code' && await ev(`document.querySelector('#cm-code').inputMode`) === 'numeric' && await ev(`document.querySelector('#cm-code').maxLength`) === 6, 'champ du code : clavier numérique, « code reçu par SMS/e-mail » proposé par l’iPhone, 6 caractères');
verifier(await ev(`document.querySelector('[data-renvoyer]').disabled`) && /Renvoyer le code \(\d+ s\)/.test(await texte('[data-renvoyer]')), 'renvoi du code : bloqué 60 s (compte à rebours)');
await controler('Compte (code) à 375 px'); await axe('#contenu', 'compte : code'); await ecran('compte-code');
await saisir('#cm-code', '12ab34');
verifier(await ev(`document.querySelector('#cm-code').value`) === '1234', 'seuls les chiffres sont gardés');
const nbAvant = journal.length;
await soumettre();
verifier((await texte('#cm-code-erreur')).includes('6 chiffres') && journal.length === nbAvant, 'code incomplet : message, aucune requête');
await saisir('#cm-code', '000000'); await soumettre();
verifier((await texte('#cm-code-erreur')).includes('Code incorrect ou expiré') && await ev(`document.querySelector('#cm-code').getAttribute('aria-invalid')`) === 'true', `mauvais code : « ${await texte('#cm-code-erreur')} »`);
await saisir('#cm-code', '123456'); await soumettre(); await dort(600);
verifier(await ev(`!!document.querySelector('[data-etape=connecte]')`) && (await texte('[data-email]')) === 'ok@exemple.fr', 'bon code : connecté avec ok@exemple.fr');
const verif = journal.filter((j) => j.chemin.startsWith('/auth/v1/verify')).at(-1);
verifier(verif.corps.token === '123456' && verif.corps.type === 'email' && verif.corps.email === 'ok@exemple.fr', 'vérification : code + e-mail, type « email »');
const garde = JSON.parse(await stockage());
verifier(garde?.access_token && garde?.refresh_token && garde?.user?.email === 'ok@exemple.fr', 'la session est gardée sur l’appareil (stockage local)');
verifier(await ev(`!document.querySelector('[data-essai]')`) && !/essai/i.test(await texte('#contenu')), 'plus aucun bloc ni mot « essai » sur la page Compte');
await controler('Compte (connecté) à 375 px'); await axe('#contenu', 'compte : connecté'); await ecran('compte-connecte');
await taille(390, 844); await controler('Compte (connecté) à 390 px'); await taille(375, 812);

// ===== 3b. Premium (liste d'attente), export, confidentialité =====
log('--- 3b. Premium, vos données, confidentialité ---');
await dort(600);
verifier((await texte('[data-formule]')) === 'Formule : Gratuite' && (await texte('[data-premium]')).includes('pas encore disponible'), 'Premium : « pas encore disponible », formule Gratuite lue au serveur');
verifier((await texte('[data-attente]')) === "Me prévenir à l'ouverture" && await ev(`!document.querySelector('[data-attente]').disabled`), 'bouton « Me prévenir à l’ouverture »');
await ev(`document.querySelector('[data-attente]').click()`); await dort(700);
verifier(etat.attente && (await texte('[data-attente-etat]')).includes("liste d'attente") && (await texte('[data-attente]')).includes('retirer'), 'inscription à la liste d’attente enregistrée, bouton « Me retirer »');
const reqAttente = journal.find((j) => j.methode === 'POST' && j.chemin.startsWith('/rest/v1/liste_attente_premium'));
verifier(reqAttente?.corps?.user_id === '11111111-2222-3333-4444-555555555555' && reqAttente.apikey === CLE && /^Bearer /.test(reqAttente.autorisation ?? ''), 'la requête ne porte que l’identifiant du compte, avec la clé publique et le jeton de la session');
await ev(`document.querySelector('[data-attente]').click()`); await dort(700);
verifier(!etat.attente && (await texte('[data-attente]')) === "Me prévenir à l'ouverture", 'retrait de la liste d’attente');
await ev(`window.__fichier = null; URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__fichier = t; }); return 'blob:test'; }; HTMLAnchorElement.prototype.click = function () { window.__nom = this.download; };`);
await ev(`document.querySelector('[data-exporter-compte]').click()`); await dort(900);
const exportCompte = JSON.parse((await ev(`window.__fichier`)) ?? 'null');
const nomExport = await ev(`window.__nom`);
verifier(exportCompte?.compte?.email === 'ok@exemple.fr' && exportCompte.profil.formule === 'gratuit' && exportCompte.listeAttentePremium === false && /^carnet-patte-compte-\d{4}-\d\d-\d\d\.json$/.test(nomExport), `export des données du compte : e-mail, formule, liste d’attente (${nomExport})`);
verifier(!/Moka|Berger|NOTE-PRIVEE/.test(JSON.stringify(exportCompte)) && exportCompte.remarque.includes('restent sur votre appareil'), 'l’export du compte ne contient aucune donnée d’animal et le dit');
await controler('Compte (Premium, données) à 375 px'); await axe('#contenu', 'compte : premium et données'); await ecran('compte-premium');
await aller('#/confidentialite'); await dort(400);
const conf = await texte('#contenu');
verifier((await texte('h1')) === 'Confidentialité' && ['adresse e-mail', 'Supabase', 'Resend', 'Cloudflare', 'CNIL', "liste d'attente", 'supprimer votre compte'].every((m) => conf.includes(m)), 'page Confidentialité : données conservées, prestataires, droits, CNIL');
verifier(conf.includes('Jamais') && conf.includes('vos animaux, soins, pesées, documents, photos ou votre position') && conf.includes('contact@carnetpatte.com'), 'elle affirme que les animaux ne quittent jamais l’appareil, et donne le contact');
verifier(await ev(`!!document.querySelector('a[href="#/compte"]') && !!document.querySelector('a[href="#/mentions"]')`), 'liens vers la page Compte et les mentions légales');
await controler('Confidentialité à 375 px'); await axe('#contenu', 'confidentialité'); await ecran('confidentialite');
await aller('#/apropos'); await dort(300);
verifier(await ev(`!!document.querySelector('a[href="#/confidentialite"]')`), 'À propos : lien vers la Confidentialité');
await aller('#/compte'); await dort(700);

// ===== 4. Session conservée, renouvelée, déconnexion =====
log('--- 4. Session ---');
await send('Page.reload'); await dort(2000);
const nbVerif = journal.filter((j) => j.chemin.startsWith('/auth/v1/verify')).length;
await aller('#/compte'); await dort(900);
await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(900);
verifier(await ev(`!!document.querySelector('[data-etape=connecte]')`) && (await texte('[data-email]')) === 'ok@exemple.fr' && journal.filter((j) => j.chemin.startsWith('/auth/v1/verify')).length === nbVerif, 'après rechargement : toujours connecté, sans redemander de code');
// session périmée : renouvelée toute seule avec le jeton de renouvellement
await ev(`(() => { const s = JSON.parse(localStorage.getItem('carnetpatte.compte')); s.expires_at = Math.floor(Date.now() / 1000) - 60; localStorage.setItem('carnetpatte.compte', JSON.stringify(s)); })()`);
await send('Page.reload'); await dort(2000);
await aller('#/compte'); await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(1200);
const renouv = journal.filter((j) => j.chemin.includes('grant_type=refresh_token')).length;
verifier(renouv >= 1 && await ev(`!!document.querySelector('[data-etape=connecte]')`), `session périmée : renouvelée toute seule (${renouv} renouvellement), toujours connecté`);
// Hors connexion : la session locale suffit pour afficher « connecté »
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(800);
verifier(await ev(`!!document.querySelector('[data-etape=connecte]')`) && await donnees() === avant, 'hors connexion : la page s’affiche, les données des animaux sont intactes');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const nbLogout = journal.filter((j) => j.chemin.startsWith('/auth/v1/logout')).length;
await ev(`document.querySelector('[data-deconnecter]').click()`); await dort(900);
verifier(journal.filter((j) => j.chemin.startsWith('/auth/v1/logout')).length === nbLogout + 1 && await stockage() === null && await ev(`!!document.querySelector('#cm-email')`), 'déconnexion : le serveur est prévenu, la session est effacée de l’appareil, retour au formulaire');
verifier(await donnees() === avant, 'les données des animaux sont les mêmes après connexion et déconnexion');

// ===== 5. Hors connexion avant la première connexion =====
log('--- 5. Pas d’internet ---');
await send('Page.reload'); await dort(2000);
await aller('#/compte'); await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(700);
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await saisir('#cm-email', 'ok@exemple.fr'); await soumettre(); await dort(500);
const hors = await texte('#cm-email-erreur');
verifier(/Pas de connexion à internet/.test(hors) && hors.includes('utilisable sans compte'), `sans internet : « ${hors} »`);
verifier(await donnees() === avant && await ev(`document.querySelectorAll('a').length > 3`), 'le reste de l’appli n’est pas gêné');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

// ===== 6. Rien d'autre n'est envoyé =====
log('--- 6. Confidentialité ---');
const tout = JSON.stringify(journal);
verifier(!/Moka-secret-42|NOTE-PRIVEE-UNIQUE|Berger/.test(tout), `les ${journal.length} requêtes envoyées au serveur d’authentification ne contiennent AUCUNE donnée d’animal (seulement e-mail et code)`);
verifier(journal.every((j) => !j.autorisation || !/service_role/.test(j.autorisation)) && journal.filter((j) => j.apikey).every((j) => j.apikey === CLE), 'seule la clé publique est utilisée');

// ===== 7. Suppression du compte =====
log('--- 7. Suppression du compte ---');
await send('Page.reload'); await dort(2000);
await aller('#/compte'); await dort(700);
await saisir('#cm-email', 'ok@exemple.fr'); await soumettre();
await saisir('#cm-code', '123456'); await soumettre(); await dort(800);
verifier(await ev(`!!document.querySelector('[data-supprimer-compte]')`), 'reconnecté : bouton « Supprimer mon compte »');
await ev(`document.querySelector('[data-supprimer-compte]').click()`); await dort(500);
verifier(await ev(`!!document.querySelector('dialog[open]')`) && (await texte('dialog[open]')).includes('définitivement') && (await texte('dialog[open]')).includes('sur cet appareil'), 'une confirmation explique : définitif, et les animaux de l’appareil ne sont pas touchés');
await ev(`document.querySelector('dialog[open] [data-non]').click()`); await dort(400);
verifier(!etat.supprime && await ev(`!!document.querySelector('[data-etape=connecte]')`), '« Annuler » : rien n’est supprimé');
await ev(`document.querySelector('[data-supprimer-compte]').click()`); await dort(500);
await ev(`document.querySelector('dialog[open] [data-oui]').click()`); await dort(1000);
const rpc = journal.find((j) => j.chemin.startsWith('/rest/v1/rpc/supprimer_mon_compte'));
verifier(etat.supprime && rpc?.methode === 'POST' && /^Bearer /.test(rpc.autorisation ?? ''), 'la suppression appelle la fonction du serveur avec le jeton de la session');
verifier(await stockage() === null && await ev(`!!document.querySelector('#cm-email')`), 'session effacée de l’appareil, retour à l’écran de connexion');
verifier(await donnees() === avant, 'les animaux de l’appareil sont intacts après la suppression du compte');

// Aller-retour export / import des données
const exp1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp1)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (x) => { const o = JSON.parse(x); delete o.exporteLe; return JSON.stringify(o); };
faux.close(); site.close(); faux.closeAllConnections(); site.closeAllConnections();
fin(net(exp1) === net(exp2));
