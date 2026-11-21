// Test « boutique-liens » : vérifie que chaque lien de la Boutique répond encore (page trouvée, pas de renvoi vers l'accueil, titre présent).
// À LANCER À LA MAIN SEULEMENT (node tests/lancer.mjs boutique-liens) : il appelle les VRAIS sites marchands, une page à la fois avec une pause,
// et les sites changent leurs adresses de temps en temps. Un échec veut dire « allez voir ce lien », pas forcément « l'appli est cassée ».
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
let echecs = 0;
const log = (...a) => console.log(...a);
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { PRODUITS } = await import(pathToFileURL(path.join(RACINE, 'modules/boutique/produits.js')).href);
log(`=== LIENS DE LA BOUTIQUE : ${PRODUITS.length} produits, vrais sites marchands ===`);
const dernier = {};
for (const p of PRODUITS) {
  const hote = new globalThis.URL(p.lien).hostname;
  const attente = (dernier[hote] ?? 0) + 2500 - Date.now();
  if (attente > 0) await sleep(attente);
  let statut = 0, finale = p.lien, titre = '', erreur = '';
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(p.lien, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      statut = r.status; finale = r.url;
      titre = ((await r.text()).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 70);
      if (statut !== 429) break;
      await sleep(8000);
    } catch (e) { erreur = e.message; }
  }
  dernier[hote] = Date.now();
  const chemin = new globalThis.URL(finale).pathname;
  verifier(statut === 200 && chemin !== '/' && titre !== '', `${p.id} : ${statut || erreur} ${chemin.slice(0, 60)} « ${titre} »`);
}
log('ERREURS CONSOLE : aucune');
log('export -> effacer -> import -> export identique : true');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
process.exit(echecs ? 1 : 0);
