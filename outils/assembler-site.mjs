// Assemble le site à publier dans un dossier (par défaut « _site ») : SEULEMENT ce qui sert au site, sans tests, outils, README ni captures.
// Utilisé par Cloudflare Pages (commande de build) ET par l'Action GitHub Pages (ancienne adresse) : un seul endroit pour savoir quoi publier.
// Usage : node outils/assembler-site.mjs [--sortie=_site] [--version=identifiant]
// La version écrite dans sw.js est, dans l'ordre : --version, CF_PAGES_COMMIT_SHA (Cloudflare), GITHUB_SHA (GitHub), sinon la date.
// Elle change à chaque publication : c'est elle qui fait apparaître la bannière « Nouvelle version disponible » sur les appareils.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparerSw, listerFichiers } from './preparer-sw.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FICHIERS = ['index.html', 'demenagement.html', 'manifest.webmanifest', 'sw.js', '_headers'];
export const DOSSIERS = ['assets', 'css', 'js', 'modules', 'donnees'];

function copier(source, cible) {
  fs.cpSync(source, cible, { recursive: true, filter: (f) => !/(^|[\\/])(\.DS_Store|Thumbs\.db|desktop\.ini)$/.test(f) });
}

/** Assemble le site dans `sortie` et retourne { version, fichiers (liste mise en cache hors ligne) }. */
export function assembler({ sortie = path.join(RACINE, '_site'), version } = {}) {
  const v = (version || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || `local-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 12)}`).slice(0, 12);
  fs.rmSync(sortie, { recursive: true, force: true });
  fs.mkdirSync(sortie, { recursive: true });
  for (const f of FICHIERS) copier(path.join(RACINE, f), path.join(sortie, f));
  for (const d of DOSSIERS) copier(path.join(RACINE, d), path.join(sortie, d));
  fs.writeFileSync(path.join(sortie, '.nojekyll'), ''); // GitHub Pages : ne pas transformer le dossier (sans effet ailleurs)
  fs.writeFileSync(path.join(sortie, 'sw.js'), preparerSw(v, sortie));
  return { version: v, fichiers: listerFichiers(sortie) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (nom) => (process.argv.find((a) => a.startsWith(`--${nom}=`)) ?? '').split('=').slice(1).join('=');
  const sortie = path.resolve(arg('sortie') || path.join(RACINE, '_site'));
  const r = assembler({ sortie, version: arg('version') });
  console.log(`Site assemblé dans ${sortie} : version ${r.version}, ${r.fichiers.length} fichiers mis en cache hors ligne.`);
}
