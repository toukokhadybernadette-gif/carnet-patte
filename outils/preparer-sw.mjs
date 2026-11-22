// Prépare sw.js pour la publication : y écrit la version et la liste des fichiers de l'appli à mettre en cache.
// Usage (Action « Publier le site ») : node outils/preparer-sw.mjs <dossier du site> <version>
// Utilisé aussi par tests/test-installable.mjs (fonction preparerSw).
// La version change à chaque publication (identifiant du commit) : c'est elle qui fait détecter la mise à jour par les appareils.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHIERS_RACINE = ['index.html', 'manifest.webmanifest'];
const DOSSIERS = ['css', 'js', 'modules', 'assets'];
const EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.png', '.svg', '.woff2', '.webmanifest']);
const A_EXCLURE = [/\/demarrage-[^/]+\.png$/]; // écrans de démarrage iPhone : lus par iOS, pas par l'appli

function parcourir(base, dossier, sortie) {
  for (const e of fs.readdirSync(path.join(base, dossier), { withFileTypes: true })) {
    const rel = `${dossier}/${e.name}`;
    if (e.isDirectory()) parcourir(base, rel, sortie);
    else if (EXTENSIONS.has(path.extname(e.name)) && !A_EXCLURE.some((re) => re.test(rel))) sortie.push(rel);
  }
}

/** Liste des fichiers à mettre en cache (chemins relatifs, triés), lue dans `base`. */
export function listerFichiers(base = RACINE) {
  const liste = FICHIERS_RACINE.filter((f) => fs.existsSync(path.join(base, f)));
  for (const d of DOSSIERS) if (fs.existsSync(path.join(base, d))) parcourir(base, d, liste);
  return liste.sort();
}

/** Le texte de sw.js avec la version et la liste de fichiers. */
export function preparerSw(version, base = RACINE) {
  if (!/^[A-Za-z0-9._-]+$/.test(version) || version === 'dev') throw new Error(`Version invalide : ${version}`);
  const texte = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8')
    .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
    .replace('/*FICHIERS*/[]/*FIN*/', JSON.stringify(listerFichiers(base)));
  if (texte.includes('/*FICHIERS*/') || !texte.includes(`const VERSION = '${version}';`)) throw new Error('sw.js : marqueurs introuvables');
  return texte;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dossier, version] = process.argv.slice(2);
  if (!dossier || !version) { console.error('Usage : node outils/preparer-sw.mjs <dossier du site> <version>'); process.exit(2); }
  const base = path.resolve(dossier);
  fs.writeFileSync(path.join(base, 'sw.js'), preparerSw(version, base));
  console.log(`sw.js prêt : version ${version}, ${listerFichiers(base).length} fichiers en cache.`);
}
