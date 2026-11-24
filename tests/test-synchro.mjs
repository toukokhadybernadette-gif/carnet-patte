// Test « synchro » : sauvegarde cloud et synchronisation entre appareils (Premium), étape 3 des comptes.
// Aucun vrai serveur Supabase n'est appelé : un FAUX serveur local applique les MÊMES règles que supabase/etape3.sql (Premium obligatoire pour écrire,
// dernière modification gagnante par élément, heure de réception posée par le serveur, quota, fichiers d'un dossier par utilisateur, suppression du compte
// refusée s'il reste des fichiers). L'« autre appareil » est simulé en écrivant directement dans ce faux serveur.
// Vérifie : un compte gratuit n'envoie RIEN (et le serveur refuse) ; première connexion (choix expliqués, jamais d'effacement) ; envoi après modification avec
// regroupement ; hors ligne puis retour du réseau ; fusion élément par élément ; stèles ; horloges (le serveur décide) ; photos et documents en fichiers ;
// quota ; indicateur d'état ; « Tout effacer » met en pause sans rien supprimer dans le cloud ; export et suppression du compte (fichiers compris) ;
// le script SQL (RLS, droits, bucket privé, quota, purge à 90 jours, aucun déclencheur sur storage.objects).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';

const [S, , TAG] = process.argv.slice(2);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9351) });

const U = '11111111-2222-3333-4444-555555555555';
const CLE = 'sb_publishable_cle_de_test_0123456789';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const session = (email, expiresIn = 3600) => {
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const user = { id: U, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, email, exp, aud: 'authenticated', role: 'authenticated' })}.signature`, token_type: 'bearer', expires_in: expiresIn, expires_at: exp, refresh_token: `refresh-${Date.now()}`, user };
};

// ----- Faux serveur : mêmes règles que supabase/etape3.sql -----
const journal = [];
const srv = {
  plan: 'gratuit', supprime: false, quota: 60 * 1024, // quota réduit pour le test (100 Mo en vrai)
  t: Date.now() + 3 * 86_400_000, // l'horloge du SERVEUR avance de 3 jours sur celle de l'appareil : l'appli ne doit jamais s'y fier
  elements: new Map(), docs: new Map(), fichiers: new Map(),
};
const heureServeur = () => { srv.t += 7; return new Date(srv.t).toISOString().replace('Z', '000+00:00'); };
const refus = { status: 403, corps: { code: '42501', message: 'new row violates row-level security policy for table' } };
/** Écriture d'un élément, avec les règles du déclencheur : plus ancien ou identique = ignoré, heure de réception du serveur, stèle vidée. */
function ecrireElement(r, { verifierPlan = true } = {}) {
  if (verifierPlan && srv.plan !== 'premium') return refus;
  const cle = `${r.collection}/${r.item_id}`;
  const ancien = srv.elements.get(cle);
  if (ancien && Date.parse(r.modifie_le) <= Date.parse(ancien.modifie_le)) return null;
  srv.elements.set(cle, { collection: r.collection, item_id: r.item_id, donnees: r.supprime ? {} : r.donnees, modifie_le: r.modifie_le, recu_le: heureServeur(), supprime: !!r.supprime });
  return null;
}
function ecrireDoc(r, { verifierPlan = true } = {}) {
  if (verifierPlan && srv.plan !== 'premium') return refus;
  const ancien = srv.docs.get(r.id);
  if (ancien && Date.parse(r.modifie_le) <= Date.parse(ancien.modifie_le)) return null;
  const autres = [...srv.docs.values()].filter((d) => !d.supprime && d.id !== r.id).reduce((n, d) => n + d.taille, 0);
  if (!r.supprime && autres + r.taille > srv.quota) return { status: 400, corps: { code: 'P0001', message: 'quota_depasse', hint: 'Le quota de 100 Mo est atteint.' } };
  srv.docs.set(r.id, { ...ancien, ...r, taille: r.supprime ? 0 : r.taille, recu_le: heureServeur(), ajoute_le: ancien?.ajoute_le ?? r.ajoute_le ?? new Date().toISOString() });
  return null;
}
/** L'autre appareil (ordinateur) : écrit directement dans le serveur, sans règle de formule. */
const autre = {
  element: (collection, item_id, donnees, modifie_le, supprime = false) => ecrireElement({ collection, item_id, donnees, modifie_le: new Date(modifie_le).toISOString(), supprime }, { verifierPlan: false }),
  fichier: (id, octets, mime = 'image/jpeg') => srv.fichiers.set(`${U}/${id}`, { octets: Buffer.from(octets), mime }),
  doc: (r) => ecrireDoc({ genre: 'document', ...r, modifie_le: new Date(r.modifie_le).toISOString() }, { verifierPlan: false }),
};
const filtrer = (lignes, params) => {
  let r = lignes;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'offset'].includes(k)) continue;
    const [op, ...reste] = v.split('.'); const val = reste.join('.');
    r = r.filter((x) => {
      const a = x[k];
      if (op === 'eq') return String(a) === val || (k === 'user_id' && val === U);
      if (op === 'neq') return String(a) !== val;
      if (op === 'gt') return Date.parse(a) > Date.parse(val);
      return true;
    });
  }
  const ordre = params.get('order');
  if (ordre) { const [col, sens] = ordre.split('.'); r = [...r].sort((a, b) => (Date.parse(a[col]) - Date.parse(b[col])) * (sens === 'desc' ? -1 : 1)); }
  return params.has('limit') ? r.slice(0, +params.get('limit')) : r;
};
/** Extrait le fichier d'un envoi multipart (c'est ainsi que la bibliothèque envoie un Blob). */
function fichierMultipart(buf, typeContenu) {
  const frontiere = /boundary=(.+)$/.exec(typeContenu ?? '')?.[1];
  if (!frontiere) return { octets: buf, mime: typeContenu };
  const txt = buf.toString('latin1');
  const debut = txt.indexOf('filename=');
  const tete = txt.indexOf('\r\n\r\n', debut) + 4;
  const fin2 = txt.indexOf(`\r\n--${frontiere}`, tete);
  const mime = /Content-Type: ([^\r]+)/.exec(txt.slice(debut, tete))?.[1] ?? 'application/octet-stream';
  return { octets: buf.subarray(tete, fin2), mime };
}
const faux = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS', 'Access-Control-Expose-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  const morceaux = []; req.on('data', (d) => morceaux.push(d));
  req.on('end', () => {
    const brut = Buffer.concat(morceaux);
    const typeContenu = req.headers['content-type'] ?? '';
    let b = {}; if (/json/.test(typeContenu)) { try { b = JSON.parse(brut.toString() || '{}'); } catch { /* corps vide */ } }
    journal.push({ methode: req.method, chemin: url.pathname + url.search, corps: b, taille: brut.length, apikey: req.headers.apikey, autorisation: req.headers.authorization, t: Date.now() });
    const json = (code, o, plus = {}) => res.writeHead(code, { ...cors, 'Content-Type': 'application/json', ...plus }).end(JSON.stringify(o));
    const vide = (code = 204) => res.writeHead(code, cors).end();
    const p = url.pathname;
    if (p === '/auth/v1/otp') return json(200, {});
    if (p === '/auth/v1/verify') return b.token === '123456' ? json(200, session(b.email)) : json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    if (p === '/auth/v1/token') return json(200, session('ok@exemple.fr'));
    if (p === '/auth/v1/user') return json(200, session('ok@exemple.fr').user);
    if (p === '/auth/v1/logout') return vide();
    if (p === '/rest/v1/profils') return json(200, [{ plan: srv.plan, cree_le: '2026-11-23T10:00:00Z' }]);
    if (p === '/rest/v1/liste_attente_premium') return req.method === 'GET' ? json(200, []) : vide(req.method === 'POST' ? 201 : 204);
    if (p === '/rest/v1/rpc/supprimer_mon_compte') {
      if ([...srv.fichiers.keys()].some((k) => k.startsWith(`${U}/`))) return json(400, { code: 'P0001', message: 'fichiers_restants' });
      srv.supprime = true; srv.elements.clear(); srv.docs.clear(); return vide();
    }
    // ----- Tables elements et documents_cloud -----
    const table = p === '/rest/v1/elements' ? srv.elements : p === '/rest/v1/documents_cloud' ? srv.docs : null;
    if (table) {
      const estEl = table === srv.elements;
      const ecrire = estEl ? ecrireElement : ecrireDoc;
      const lignes = [...table.values()];
      if (req.method === 'GET' || req.method === 'HEAD') {
        const r = filtrer(lignes, url.searchParams);
        const entetes = { 'content-range': r.length ? `0-${r.length - 1}/${r.length}` : '*/0' };
        return req.method === 'HEAD' ? res.writeHead(200, { ...cors, ...entetes }).end() : json(200, r, entetes);
      }
      if (req.method === 'POST') {
        for (const r of (Array.isArray(b) ? b : [b])) { const e = ecrire(r); if (e) return json(e.status, e.corps); }
        return vide(201);
      }
      if (req.method === 'PATCH') {
        const cible = filtrer(lignes, url.searchParams);
        for (const l of cible) { const e = ecrire({ ...l, ...b, modifie_le: b.modifie_le ?? l.modifie_le }); if (e) return json(e.status, e.corps); }
        return vide();
      }
    }
    // ----- Stockage de fichiers -----
    const m = /^\/storage\/v1\/object\/(?:list\/)?(?:sign\/)?documents\/?(.*)$/.exec(p);
    if (m) {
      const chemin = decodeURIComponent(m[1]);
      if (p.startsWith('/storage/v1/object/list/')) {
        const prefixe = `${b.prefix}/`;
        return json(200, [...srv.fichiers.keys()].filter((k) => k.startsWith(prefixe)).map((k) => ({ name: k.slice(prefixe.length), id: `id-${k}` })));
      }
      if (p.startsWith('/storage/v1/object/sign/')) return json(200, { signedURL: `/object/sign/documents/${chemin}?token=test` });
      if (req.method === 'POST') {
        const d = srv.docs.get(chemin.split('/')[1]);
        if (srv.plan !== 'premium' || !d || d.supprime || !chemin.startsWith(`${U}/`)) return json(403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
        if (srv.fichiers.has(chemin)) return json(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
        srv.fichiers.set(chemin, fichierMultipart(brut, typeContenu));
        return json(200, { Key: `documents/${chemin}`, Id: 'x' });
      }
      if (req.method === 'GET') {
        const f = srv.fichiers.get(chemin);
        return f ? res.writeHead(200, { ...cors, 'Content-Type': f.mime }).end(f.octets) : json(404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      }
    }
    if (req.method === 'DELETE' && p === '/storage/v1/object/documents') { for (const x of b.prefixes ?? []) srv.fichiers.delete(x); return json(200, []); }
    json(404, { msg: `inconnu : ${req.method} ${p}` });
  });
});
await new Promise((ok) => faux.listen(0, '127.0.0.1', ok));
const URL_FAUX = `http://127.0.0.1:${faux.address().port}`;

// ----- Serveur du site (sert la config du faux serveur, jamais le vrai projet) -----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const site = http.createServer((req, res) => {
  let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (chemin === '/') chemin = '/index.html';
  if (chemin === '/js/supabase-config.js') { res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }).end(`export const SUPABASE = ${JSON.stringify({ url: URL_FAUX, cle: CLE })};`); return; }
  const f = path.join(RACINE, chemin);
  if (!f.startsWith(RACINE) || f.startsWith(path.join(RACINE, 'tests')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => site.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${site.address().port}`;
await send('Network.enable');
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(1800);
await taille(375, 812);

// ----- Outils -----
const PHOTO = `data:image/jpeg;base64,${Buffer.from('FAKE-JPEG-OCTETS-0123456789').toString('base64')}`;
const saisir = (sel, v) => ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const soumettre = async (sel = 'form') => { await ev(`document.querySelector(${JSON.stringify(sel)}).requestSubmit()`); await dort(900); };
const attendre = async (cond, max = 9000) => { const debut = Date.now(); while (Date.now() - debut < max) { if (await cond()) return true; await dort(250); } return false; };
const posts = (table) => journal.filter((j) => j.methode === 'POST' && j.chemin.startsWith(`/rest/v1/${table}`));
const lignesEnvoyees = (depuis = 0) => journal.slice(depuis).filter((j) => j.methode === 'POST' && j.chemin.startsWith('/rest/v1/elements')).flatMap((j) => (Array.isArray(j.corps) ? j.corps : [j.corps]));
const storageJs = (code) => ev(`import('/js/storage.js').then((m) => { ${code} })`);
const synchro = (code) => ev(`import('/js/synchro.js').then(async (m) => { ${code} })`);
const etatSynchro = () => ev(`document.getElementById('synchro-indicateur')?.dataset.etat ?? null`);
const dialogue = () => ev(`document.querySelector('dialog[open]')?.innerText ?? ''`);
const repondre = async (oui) => { await ev(`document.querySelector('dialog[open] [${oui ? 'data-oui' : 'data-non'}]').click()`); await dort(500); };
const noms = () => ev(`import('/js/storage.js').then((m) => m.lister('animaux').map((a) => a.nom).sort().join(','))`);
const seConnecter = async () => {
  await aller('#/compte'); await dort(500);
  await saisir('#cm-email', 'ok@exemple.fr'); await soumettre();
  await saisir('#cm-code', '123456'); await soumettre(); await dort(1200);
};

const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z', profil: { prenom: '' },
  animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: 'Berger', naissance: '2023-08-01', photo: PHOTO }, { id: 'b', nom: 'Pixel', espece: 'chat', especeAutre: '', race: '', naissance: '2022-01-01', photo: '' }],
  soins: [{ id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: jour(-60), notes: 'note un', rappel: jour(5), rappelFait: false }, { id: 's2', animalId: 'b', type: 'vaccin', titre: '', date: jour(-30), notes: 'note deux', rappel: '', rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'a', date: jour(-10), poids: 24.5 }] };
await importer(fichier);

// ===== 1. Compte gratuit : rien ne part, et le serveur refuse même en bidouillant =====
log('--- 1. Compte gratuit ---');
await seConnecter();
verifier(await ev(`!!document.querySelector('[data-etape=connecte]')`) && (await texte('[data-formule]')) === 'Formule : Gratuite', 'connecté, formule Gratuite');
await dort(800);
verifier(await ev(`document.querySelector('[data-cloud]').hidden`) && !(await ev(`document.querySelector('[data-premium]').hidden`)), 'gratuit : pas de section « Sauvegarde cloud », la liste d’attente Premium reste proposée');
verifier(!journal.some((j) => /\/rest\/v1\/(elements|documents_cloud)|\/storage\//.test(j.chemin)) && !(await ev(`!!document.getElementById('synchro-indicateur')`)), 'aucune requête vers les tables cloud ni le stockage, aucun indicateur (rien n’est activé)');
const bidouille = await ev(`import('/js/compte.js').then(async (c) => { const cl = await c.clientSupabase(); const r = await cl.from('elements').upsert({ user_id: '${U}', collection: 'animaux', item_id: 'x', donnees: {}, modifie_le: new Date().toISOString() }); return r.error?.code ?? null; })`);
verifier(bidouille === '42501' && srv.elements.size === 0, `en contournant l’appli, le serveur refuse l’écriture d’un compte gratuit (code ${bidouille}) : RLS « Premium requis »`);
await synchro(`m.activer('${U}'); await new Promise((r) => setTimeout(r, 2500));`);
verifier(await etatSynchro() === 'gratuit' && posts('elements').length === 1 && srv.elements.size === 0, 'même si on force l’activation sur un compte gratuit : état « Formule gratuite », rien n’est enregistré côté serveur');
await synchro(`m.desactiver(); localStorage.removeItem('carnetpatte.synchro');`);

// ===== 2. Premium : première connexion, choix expliqués, rien n'est effacé =====
log('--- 2. Premium : première activation ---');
srv.plan = 'premium';
const nbRequetes = journal.length;
await send('Page.reload'); await dort(2000);
await aller('#/compte'); await dort(1800);
const d1 = await dialogue();
verifier(!(await ev(`document.querySelector('[data-cloud]').hidden`)) && (await texte('[data-cloud]')).includes('Premium'), 'Premium : la section « Sauvegarde cloud et synchronisation » apparaît');
verifier(d1.includes('Sauvegarder votre carnet') && d1.includes('Le cloud est vide') && d1.includes('5 élément') && d1.includes('Rien n\'est supprimé'), `première connexion, cloud vide : « ${d1.replace(/\s+/g, ' ').slice(0, 130)}… » (on explique, on demande)`);
await repondre(false);
verifier(srv.elements.size === 0 && posts('elements').length === 1 && await ev(`!document.getElementById('synchro-indicateur') || document.getElementById('synchro-indicateur').hidden`), 'Annuler : rien n’est envoyé, la sauvegarde n’est pas activée');
await ev(`document.querySelector('[data-cloud-activer]').click()`); await dort(900);
verifier((await dialogue()).includes('Sauvegarder votre carnet'), 'le bouton « Activer sur cet appareil » repose la question');
const avantEnvoi = journal.length;
await repondre(true);
verifier(await attendre(() => srv.elements.size >= 4 && srv.docs.size >= 1 && etatSynchro().then((e) => e === 'ok')), 'après confirmation : le carnet est envoyé (animaux, soins, pesée, photo)');
const cles = [...srv.elements.keys()].sort().join(',');
verifier(cles === 'animaux/a,animaux/b,pesees/p1,soins/s1,soins/s2', `un enregistrement par élément : ${cles}`);
const animalCloud = srv.elements.get('animaux/a').donnees;
verifier(animalCloud.nom === 'Moka' && !('photo' in animalCloud) && /^ph-a-[a-z0-9]+$/.test(animalCloud.photoRef), `la photo n’est PAS dans les données (base64) : l’animal porte seulement une référence « ${animalCloud.photoRef} »`);
verifier(!JSON.stringify(journal.slice(avantEnvoi).filter((j) => /\/rest\//.test(j.chemin)).map((j) => j.corps)).includes('data:image'), 'aucune photo en base64 dans les requêtes vers les tables');
const refA = animalCloud.photoRef;
verifier(srv.fichiers.has(`${U}/${refA}`) && srv.fichiers.get(`${U}/${refA}`).octets.toString() === 'FAKE-JPEG-OCTETS-0123456789' && srv.docs.get(refA)?.genre === 'photo', 'la photo est un fichier du bucket (dossier de l’utilisateur), déclarée dans documents_cloud');
verifier(lignesEnvoyees(avantEnvoi).every((l) => l.user_id === U && /^\d{4}-\d\d-\d\dT/.test(l.modifie_le)) && !JSON.stringify(journal.slice(avantEnvoi)).includes('recu_le":'), 'l’appli n’envoie jamais d’heure de réception (recu_le) : c’est le serveur qui la pose');
verifier(await etatSynchro() === 'ok' && (await texte('#synchro-indicateur')) === 'Sauvegardé', 'indicateur discret : « Sauvegardé »');
await controler('Compte (Premium, cloud) à 375 px'); await axe('#contenu', 'compte : sauvegarde cloud'); await ecran('synchro-compte');
verifier((await texte('[data-cloud-espace-texte]')).includes('Espace cloud utilisé') && (await texte('[data-cloud-etat]')).includes('Sauvegardé'), 'la page Compte montre l’état et l’espace utilisé');

// ===== 3. Envoi après modification : regroupé, un seul élément =====
log('--- 3. Sauvegarde automatique ---');
const avantModif = journal.length;
await storageJs(`m.modifier('soins', 's1', { notes: 'note un modifiée' });`);
await storageJs(`m.modifier('soins', 's1', { notes: 'note un modifiée deux fois' });`);
await dort(1200);
verifier(lignesEnvoyees(avantModif).length === 0, 'avant le délai de regroupement (3 s) : rien n’est encore envoyé');
verifier(await attendre(() => srv.elements.get('soins/s1').donnees.notes === 'note un modifiée deux fois'), 'après le petit délai : la modification est sauvegardée');
const envoyees = lignesEnvoyees(avantModif);
verifier(envoyees.length === 1 && envoyees[0].item_id === 's1', `seul l’élément modifié est envoyé (${envoyees.length} ligne), pas tout le carnet`);
await attendre(async () => (await etatSynchro()) === 'ok');

// ===== 4. Hors ligne =====
log('--- 4. Hors ligne ---');
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await dort(500);
const avantHors = journal.length;
await storageJs(`m.modifier('animaux', 'b', { nom: 'Pixel (hors ligne)' });`);
await dort(4500);
verifier(await noms() === 'Moka,Pixel (hors ligne)', 'hors ligne, l’appli reste utilisable : la modification est enregistrée sur l’appareil');
verifier(await etatSynchro() === 'attente' && (await texte('#synchro-indicateur')) === 'En attente (hors ligne)', 'indicateur : « En attente (hors ligne) »');
verifier(journal.length === avantHors, 'aucune requête tentée sans réseau');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await ev(`window.dispatchEvent(new Event('online'))`);
verifier(await attendre(() => srv.elements.get('animaux/b').donnees.nom === 'Pixel (hors ligne)') && await attendre(async () => (await etatSynchro()) === 'ok'), 'au retour du réseau : la modification part toute seule, indicateur « Sauvegardé »');

// ===== 5. Autre appareil : la dernière modification gagne, élément par élément =====
log('--- 5. Synchronisation entre appareils ---');
const maintenant = Date.now();
// L'ordinateur modifie la pesée p1 et ajoute un soin s3 ; ici on modifie un AUTRE élément (le nom de Moka) avant de recevoir
await storageJs(`m.modifier('animaux', 'a', { nom: 'Moka (téléphone)' });`);
autre.element('pesees', 'p1', { id: 'p1', animalId: 'a', date: jour(-10), poids: 25.1 }, maintenant);
autre.element('soins', 's3', { id: 's3', animalId: 'b', type: 'antiparasitaire', titre: '', date: jour(-1), notes: 'ajouté sur l’ordinateur', rappel: '', rappelFait: false }, maintenant + 10);
const avantRecu = journal.length;
await synchro(`await m.synchroniser();`);
const apres = await ev(`import('/js/storage.js').then((m) => JSON.stringify({ p: m.trouver('pesees', 'p1')?.poids, s3: m.trouver('soins', 's3')?.notes, a: m.trouver('animaux', 'a')?.nom }))`);
verifier(apres === JSON.stringify({ p: 25.1, s3: 'ajouté sur l’ordinateur', a: 'Moka (téléphone)' }), `deux appareils, deux éléments différents : rien n’est perdu (${apres})`);
const requeteRecu = journal.slice(avantRecu).find((j) => j.methode === 'GET' && j.chemin.startsWith('/rest/v1/elements'));
const gt = decodeURIComponent(/recu_le=gt\.([^&]+)/.exec(requeteRecu?.chemin ?? '')?.[1] ?? '');
verifier(gt && Math.abs(Date.parse(gt) - srv.t) < 3 * 60_000 && Math.abs(Date.parse(gt) - Date.now()) > 86_400_000, `« modifié depuis » se fait sur l’heure du SERVEUR (${gt.slice(0, 19)}), pas sur l’horloge de l’appareil (serveur en avance de 3 jours)`);
// Même élément : la plus récente gagne
autre.element('soins', 's2', { id: 's2', animalId: 'b', type: 'vaccin', titre: '', date: jour(-30), notes: 'ordinateur, plus ANCIEN', rappel: '', rappelFait: false }, maintenant - 3_600_000);
await storageJs(`m.modifier('soins', 's2', { notes: 'téléphone, plus récent' });`);
await synchro(`await m.synchroniser();`);
verifier(srv.elements.get('soins/s2').donnees.notes === 'téléphone, plus récent' && await ev(`import('/js/storage.js').then((m) => m.trouver('soins', 's2').notes)`) === 'téléphone, plus récent', 'même élément modifié des deux côtés : la modification la plus récente gagne (l’ancienne du serveur est ignorée)');
autre.element('soins', 's2', { id: 's2', animalId: 'b', type: 'vaccin', titre: '', date: jour(-30), notes: 'ordinateur, plus RÉCENT', rappel: '', rappelFait: false }, Date.now() + 60_000);
await synchro(`await m.synchroniser();`);
verifier(await ev(`import('/js/storage.js').then((m) => m.trouver('soins', 's2').notes)`) === 'ordinateur, plus RÉCENT', 'et dans l’autre sens : la modification plus récente de l’ordinateur remplace celle du téléphone');
const avantRepush = journal.length;
await synchro(`await m.synchroniser();`);
verifier(lignesEnvoyees(avantRepush).length === 0, 'ce qui vient d’être reçu n’est pas renvoyé (pas de boucle)');
// Suppressions : stèles
autre.element('soins', 's3', {}, Date.now() + 120_000, true);
await synchro(`await m.synchroniser();`);
verifier(await ev(`import('/js/storage.js').then((m) => m.trouver('soins', 's3'))`) === null, 'suppression faite sur l’ordinateur : l’élément disparaît ici aussi');
await storageJs(`m.supprimer('pesees', 'p1');`);
await synchro(`await m.synchroniser();`);
const stele = srv.elements.get('pesees/p1');
verifier(stele.supprime && JSON.stringify(stele.donnees) === '{}', `suppression ici : une stèle sans contenu est enregistrée (les autres appareils supprimeront aussi) ${JSON.stringify(stele)}`);
// Photo venue de l'ordinateur
const photoAutre = `data:image/jpeg;base64,${Buffer.from('AUTRE-PHOTO-DE-PIXEL').toString('base64')}`;
autre.fichier('ph-b-ordi', 'AUTRE-PHOTO-DE-PIXEL'); autre.doc({ id: 'ph-b-ordi', genre: 'photo', animal_id: 'b', mime: 'image/jpeg', taille: 20, modifie_le: Date.now() });
autre.element('animaux', 'b', { id: 'b', nom: 'Pixel (ordinateur)', espece: 'chat', especeAutre: '', race: '', naissance: '2022-01-01', photoRef: 'ph-b-ordi' }, Date.now() + 180_000);
const avantPhoto = journal.length;
await synchro(`await m.synchroniser();`);
verifier(await ev(`import('/js/storage.js').then((m) => m.trouver('animaux', 'b')?.photo)`) === photoAutre && await noms() === 'Moka (téléphone),Pixel (ordinateur)', 'la photo d’un animal venue de l’ordinateur est téléchargée et affichée ici');
await synchro(`await m.synchroniser();`);
verifier(lignesEnvoyees(avantPhoto).length === 0 && posts('documents_cloud').length === 1, `une photo reçue n’est pas renvoyée (${JSON.stringify(lignesEnvoyees(avantPhoto).map((l) => l.collection + '/' + l.item_id))} ; ${posts('documents_cloud').length} déclarations de fichiers)`);

// ===== 6. Documents : fichiers, quota =====
log('--- 6. Documents et quota ---');
await ev(`window.__pdf = async (n) => { const d = await import('/js/documents-db.js'); return d.ajouterDocument({ animalId: 'a', titre: 'Carnet ' + n, date: '2026-02-02', type: 'vaccination', blob: new Blob([new Uint8Array(n)], { type: 'application/pdf' }), nom: 'c.pdf' }); }`);
const doc1 = await ev(`window.__pdf(20000).then((d) => d.id)`);
verifier(await attendre(() => srv.fichiers.has(`${U}/${doc1}`)) && srv.docs.get(doc1).taille === 20000 && srv.docs.get(doc1).genre === 'document' && srv.docs.get(doc1).titre === 'Carnet 20000', 'un document ajouté est envoyé comme fichier (bucket privé) avec ses informations');
const upload = journal.filter((j) => j.methode === 'POST' && j.chemin.startsWith(`/storage/v1/object/documents/${U}/${doc1}`));
verifier(upload.length === 1 && upload[0].autorisation?.startsWith('Bearer '), 'envoi dans le dossier de l’utilisateur, avec le jeton de sa session');
await attendre(async () => (await etatSynchro()) === 'ok');
const doc2 = await ev(`window.__pdf(30000).then((d) => d.id)`);
await attendre(() => srv.fichiers.has(`${U}/${doc2}`));
const doc3 = await ev(`window.__pdf(15000).then((d) => d.id)`);
verifier(await attendre(async () => (await etatSynchro()) === 'quota') && !srv.fichiers.has(`${U}/${doc3}`), 'quota dépassé : le document de trop n’est pas envoyé');
const msgQuota = await ev(`document.getElementById('synchro-indicateur').title`);
verifier(msgQuota.includes('plein') && msgQuota.includes('100 Mo') && msgQuota.includes('Le reste est sauvegardé'), `message clair : « ${msgQuota} »`);
verifier(await ev(`import('/js/documents-db.js').then((d) => d.lireDocument('${doc3}')).then((d) => !!d)`), 'le document reste intact sur l’appareil');
await storageJs(`m.modifier('soins', 's1', { notes: 'après le quota' });`);
verifier(await attendre(() => srv.elements.get('soins/s1').donnees.notes === 'après le quota'), 'les données (hors fichiers) continuent d’être sauvegardées malgré le quota');
await ev(`import('/js/documents-db.js').then((d) => d.supprimerDocument('${doc2}'))`);
verifier(await attendre(() => srv.docs.get(doc2)?.supprime && !srv.fichiers.has(`${U}/${doc2}`)), 'supprimer un document retire aussi son fichier du cloud (stèle sans taille)');
verifier(await attendre(() => srv.fichiers.has(`${U}/${doc3}`)), 'la place libérée permet d’envoyer le document en attente');
// Document venu de l'ordinateur
autre.fichier('doc-ordi', 'PDF-DE-ORDI', 'application/pdf'); autre.doc({ id: 'doc-ordi', animal_id: 'a', titre: 'Ordonnance (ordi)', date: '2026-03-03', type: 'ordonnance', mime: 'application/pdf', nom: 'o.pdf', taille: 11, modifie_le: Date.now() + 200_000 });
await synchro(`await m.synchroniser();`);
const docOrdi = await ev(`import('/js/documents-db.js').then((d) => d.lireDocument('doc-ordi')).then(async (x) => x ? { titre: x.titre, texte: await x.blob.text() } : null)`);
verifier(docOrdi?.titre === 'Ordonnance (ordi)' && docOrdi.texte === 'PDF-DE-ORDI', 'un document ajouté sur l’ordinateur est téléchargé ici, fichier compris');

// ===== 7. « Tout effacer » met en pause et ne supprime RIEN dans le cloud =====
log('--- 7. Effacer ici ≠ effacer le cloud ---');
const nbEl = srv.elements.size; const nbSupp = [...srv.elements.values()].filter((e) => e.supprime).length;
const avantEff = journal.length;
await storageJs(`m.toutEffacer();`);
await dort(4500);
verifier(await etatSynchro() === 'suspendu' && lignesEnvoyees(avantEff).length === 0 && srv.elements.size === nbEl && [...srv.elements.values()].filter((e) => e.supprime).length === nbSupp, 'après « Tout effacer » : synchronisation en pause, aucune suppression envoyée, le cloud est intact');
await aller('#/compte'); await dort(1000);
verifier((await texte('[data-cloud-etat]')).includes('en pause') && (await texte('[data-cloud-etat]')).includes('Rien n\'a été supprimé dans le cloud'), 'la page Compte explique la pause');
await ev(`document.querySelector('[data-cloud-activer]').click()`); await dort(1200);
const d2 = await dialogue();
verifier(d2.includes('Récupérer votre carnet') && d2.includes('cet appareil est vide') && d2.includes('Rien n\'est supprimé'), `reprise sur un appareil vide : on propose de récupérer le carnet du cloud (« ${d2.replace(/\s+/g, ' ').slice(0, 90)}… »)`);
await repondre(true);
verifier(await attendre(async () => (await etatSynchro()) === 'ok' && (await noms()) !== ''), 'récupération du carnet depuis le cloud');
const recup = await ev(`import('/js/storage.js').then(async (m) => { const d = await import('/js/documents-db.js'); const docs = await d.listerDocuments(); return JSON.stringify({ animaux: m.lister('animaux').map((a) => a.nom + (a.photo ? '+photo' : '')).sort(), soins: m.lister('soins').map((s) => s.id).sort(), pesees: m.lister('pesees').length, docs: docs.map((x) => x.id).sort() }); })`);
const attendu = JSON.parse(recup);
verifier(attendu.animaux.join() === 'Moka (téléphone)+photo,Pixel (ordinateur)+photo' && attendu.soins.join() === 's1,s2' && attendu.pesees === 0 && attendu.docs.includes('doc-ordi') && attendu.docs.includes(doc1) && attendu.docs.includes(doc3) && !attendu.docs.includes(doc2), `carnet retrouvé : animaux avec photos, soins, documents (${recup.slice(0, 150)}…), sans ce qui a été supprimé ${JSON.stringify([...srv.fichiers.keys()].map((k) => k.slice(37)))} ${JSON.stringify(srv.elements.get('animaux/b'))}`);
const avantRetour = journal.length;
await dort(4500);
verifier(lignesEnvoyees(avantRetour).length === 0, 'ce qui vient d’être récupéré n’est pas renvoyé');

// ===== 8. Fusion : appareil avec ses données + cloud plein =====
log('--- 8. Fusion ---');
await synchro(`m.desactiver();`);
await storageJs(`m.ajouter('animaux', { nom: 'Ajouté hors synchro', espece: 'lapin', especeAutre: '', race: '', naissance: '2024-01-01', photo: '' });`);
autre.element('animaux', 'c', { id: 'c', nom: 'Venu du cloud', espece: 'chat', especeAutre: '', race: '', naissance: '2021-05-05' }, Date.now() + 300_000);
await aller('#/compte'); await dort(800);
await ev(`document.querySelector('[data-cloud-activer]').click()`); await dort(1200);
const d3 = await dialogue();
verifier(d3.includes('Fusionner les deux carnets') && d3.includes('tout est conservé, rien n\'est supprimé') && d3.includes('la plus récente'), `appareil avec données et cloud plein : fusion expliquée (« ${d3.replace(/\s+/g, ' ').slice(0, 80)}… »)`);
await repondre(true);
await attendre(async () => (await etatSynchro()) === 'ok');
verifier(await attendre(async () => (await noms()).includes('Venu du cloud') && (await noms()).includes('Ajouté hors synchro')), 'après fusion : les animaux des deux côtés sont présents ici');
verifier(await attendre(() => [...srv.elements.values()].some((e) => e.donnees?.nom === 'Ajouté hors synchro')), 'et ceux de cet appareil sont aussi dans le cloud (rien n’a été supprimé)');

// ===== 9. Export du compte et suppression =====
log('--- 9. Export et suppression du compte ---');
await aller('#/compte'); await dort(800);
await ev(`window.__fichier = null; URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__fichier = t; }); return 'blob:test'; }; HTMLAnchorElement.prototype.click = function () { window.__nom = this.download; };`);
await ev(`document.querySelector('[data-exporter-compte]').click()`); await dort(1500);
const exp = JSON.parse((await ev(`window.__fichier`)) ?? 'null');
verifier(exp?.donneesCloud?.elements?.some((e) => e.collection === 'animaux' && e.donnees.nom === 'Venu du cloud') && exp.donneesCloud.documents.some((d) => d.id === 'doc-ordi' && /^http/.test(d.lienTelechargement)), 'l’export du compte inclut les données cloud (animaux…) et la liste des documents avec leurs liens de téléchargement');
verifier(!JSON.stringify(exp).includes('FAKE-JPEG') && !/data:image/.test(JSON.stringify(exp)), 'sans copier les fichiers eux-mêmes dans le JSON');
const nbFichiers = [...srv.fichiers.keys()].length;
verifier(nbFichiers >= 4, `avant suppression : ${nbFichiers} fichiers dans le cloud`);
const avantSuppr = journal.length;
await ev(`document.querySelector('[data-supprimer-compte]').click()`); await dort(500);
verifier((await dialogue()).includes('sauvegarde cloud') && (await dialogue()).includes('données et fichiers'), 'la confirmation parle de la sauvegarde cloud et des fichiers');
await repondre(true); await dort(1500);
const sequence = journal.slice(avantSuppr).filter((j) => /storage\/v1\/object|rpc\/supprimer_mon_compte/.test(j.chemin)).map((j) => `${j.methode} ${j.chemin.replace(/\/[0-9a-f-]{36}.*/, '')}`);
const iRetrait = sequence.findIndex((s) => s.startsWith('DELETE /storage/v1/object/documents'));
const iRpc = sequence.findIndex((s) => s.includes('rpc/supprimer_mon_compte'));
verifier(iRetrait >= 0 && iRpc > iRetrait, `les fichiers sont supprimés par l’API Storage AVANT le compte (${sequence.join(' → ')})`);
verifier(srv.supprime && srv.fichiers.size === 0 && srv.elements.size === 0 && srv.docs.size === 0, 'après suppression : aucun fichier orphelin, aucune ligne dans le cloud');
verifier(await ev(`localStorage.getItem('carnetpatte.synchro')`) === null && await ev(`!!document.querySelector('#cm-email')`), 'la synchronisation est désactivée sur l’appareil et on revient à l’écran de connexion');
verifier((await noms()).includes('Venu du cloud'), 'les animaux de l’appareil ne sont pas touchés');
// Si des fichiers résistent, le serveur refuse de supprimer le compte (et l'appli le dit)
srv.supprime = false; srv.fichiers.set(`${U}/orphelin`, { octets: Buffer.from('x'), mime: 'application/pdf' });
const refuse = await ev(`import('/js/compte.js').then(async (c) => { const cl = await c.clientSupabase(); const r = await cl.rpc('supprimer_mon_compte'); return r.error?.message ?? null; })`);
verifier(refuse === 'fichiers_restants' && !srv.supprime, 'le serveur REFUSE de supprimer le compte s’il reste des fichiers (aucun orphelin possible)');

// ===== 10. Le site : rien de lourd sans activation, aucun secret =====
log('--- 10. Site et script SQL ---');
const synchroJs = fs.readFileSync(path.join(RACINE, 'js/synchro.js'), 'utf8');
verifier(/PERIODE_MS = 60_000/.test(synchroJs) && /visibilitychange/.test(synchroJs) && /'online'/.test(synchroJs) && /DELAI_MS = 3000/.test(synchroJs), 'consultation toutes les 60 s, au retour au premier plan et au retour du réseau ; regroupement de 3 s');
verifier(!/Date\.now\(\)[^;\n]*recu_le|recu_le[^;\n]*Date\.now\(\)/.test(synchroJs.replace(/\/\/.*$/gm, '')), 'le code ne compare jamais recu_le à l’horloge de l’appareil');
const secrets = [synchroJs, fs.readFileSync(path.join(RACINE, 'js/compte.js'), 'utf8')].some((t) => /service_role|sb_secret_/.test(t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
verifier(!secrets, 'aucune clé secrète dans le code de synchronisation');
const sql = fs.readFileSync(path.join(RACINE, 'supabase/etape3.sql'), 'utf8').replace(/--.*$/gm, '');
verifier(['elements', 'documents_cloud'].every((t) => new RegExp(`alter table public[.]${t} +enable row level security`).test(sql)), 'etape3.sql : RLS activée sur elements et documents_cloud');
const politiques = [...sql.matchAll(/create policy[\s\S]*?;/g)].map((x) => x[0]);
verifier(politiques.length === 9 && politiques.every((x) => /to authenticated/.test(x)) && !/\bto anon\b|grant[^;]*\banon\b/i.test(sql), `${politiques.length} règles, toutes réservées aux comptes connectés ; rien pour « anon »`);
const ecritures = politiques.filter((x) => /for (insert|update)/.test(x) && /public\.(elements|documents_cloud)|storage\.objects/.test(x));
verifier(ecritures.length === 5 && ecritures.every((x) => /peut_ecrire_cloud\(\)/.test(x)), 'toute écriture (tables et fichiers) exige le plan Premium : peut_ecrire_cloud()');
verifier(/revoke all on public\.elements\s+from anon, authenticated/.test(sql) && /grant select, insert, update on public\.elements\s+to authenticated/.test(sql) && !/grant[^;]*delete[^;]*public\./i.test(sql), 'droits explicites : ni « delete » ni rien pour anon sur les tables (suppression = stèle)');
verifier(/recu_le\s+timestamptz not null default clock_timestamp\(\)/.test(sql) && /new\.recu_le := clock_timestamp\(\)/.test(sql) && /new\.modifie_le <= old\.modifie_le then return null/.test(sql), 'recu_le posé par le serveur à chaque écriture ; une écriture plus ancienne est ignorée (dernière modification gagnante)');
verifier(/values \('documents', 'documents', false,/.test(sql) && /file_size_limit/.test(sql), 'bucket « documents » privé, avec limite par fichier');
verifier(/\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/.test(sql), 'fichiers : un dossier par utilisateur, accès limité au sien');
verifier(/104857600/.test(sql) && /quota_depasse/.test(sql) && !/create trigger[^;]*on storage\.objects/i.test(sql), 'quota de 100 Mo appliqué sur documents_cloud ; aucun déclencheur sur storage.objects (non permis sur Supabase)');
verifier(/interval '90 days'/.test(sql) && /cron\.schedule/.test(sql) && !/delete\s+from\s+storage\.objects/i.test(sql), 'purge des stèles de plus de 90 jours (tâche horaire) ; aucune suppression de fichiers en SQL (elle ne retire pas les vrais fichiers)');
verifier(/from storage\.objects where bucket_id = 'documents' and name like uid::text/.test(sql) && /fichiers_restants/.test(sql), 'supprimer_mon_compte refuse de continuer s’il reste des fichiers');
verifier(/revoke execute on function public\.entretien_cloud\(\) from public, anon, authenticated/.test(sql) && /revoke execute on function public\.peut_ecrire_cloud\(\) from public, anon/.test(sql) && !/service_role|sb_secret_/i.test(sql), 'fonctions d’entretien non appelables depuis l’appli ; aucune clé secrète');
for (const f of ['premium-on.sql', 'premium-off.sql', 'verifier-etape3.sql']) verifier(fs.existsSync(path.join(RACINE, 'supabase', f)) && !/@gmail|@outlook|@hotmail/i.test(fs.readFileSync(path.join(RACINE, 'supabase', f), 'utf8')), `supabase/${f} présent, sans adresse e-mail personnelle`);

faux.close(); site.close(); faux.closeAllConnections(); site.closeAllConnections();
fin(true);
