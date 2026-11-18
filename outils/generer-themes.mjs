// Génère css/themes.css : les 12 thèmes de couleur de l'appli.
// Usage : node outils/generer-themes.mjs      (écrit css/themes.css et affiche le contrôle de contraste)
//
// Chaque thème est décrit par UNE teinte (h) et une saturation (s) : tout le reste (fond très clair, dégradé du haut, cartes de verre,
// boutons, ombres teintées, bulles du décor) en est déduit par les mêmes formules (js/couleurs-theme.js), donc tous les thèmes ont le même rendu.
// Le script MESURE le contraste de chaque paire texte/fond importante et s'arrête avec une erreur si l'une passe sous 4,5:1 (3:1 pour les contours de champs).
// Il contrôle aussi la couleur personnalisée sur une grille de plus de 1 000 couleurs de départ (toutes teintes, saturations et clartés).
// Les couleurs d'URGENCE (rouge, ambre, vert) et celles des TYPES DE SOIN ne sont pas ici : elles restent dans css/tokens.css, identiques dans tous les thèmes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hsl, hex, controle, variablesTheme, themeDepuisCouleur } from '../js/couleurs-theme.js';

export { palette, controle, contraste } from '../js/couleurs-theme.js';

export const THEMES = [
  { id: 'kaki', nom: 'Kaki', h: 68, s: 31, fixe: { foret: '#5B6334', foretTexte: '#454E25', survol: '#4B5229', actif: '#3C4220', bord: '#474E26' } },
  { id: 'bleu-ciel', nom: 'Bleu ciel', h: 203, s: 62 },
  { id: 'sauge', nom: 'Sauge', h: 142, s: 24 },
  { id: 'terracotta', nom: 'Terracotta', h: 22, s: 52 },
  { id: 'lavande', nom: 'Lavande', h: 262, s: 30 },
  { id: 'sable', nom: 'Sable', h: 36, s: 40 },
  { id: 'rose-poudre', nom: 'Rose poudré', h: 345, s: 40 },
  { id: 'corail', nom: 'Corail', h: 8, s: 62 },
  { id: 'menthe', nom: 'Menthe', h: 158, s: 42 },
  { id: 'turquoise', nom: 'Turquoise', h: 180, s: 62 },
  { id: 'bleu-nuit', nom: 'Bleu nuit', h: 228, s: 48 },
  { id: 'moutarde', nom: 'Moutarde', h: 44, s: 72 },
];

function bloc(t) {
  const { vars, solide, apercu } = variablesTheme(t);
  const lignes = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  const sel = t.id === 'kaki' ? ':root, :root[data-theme="kaki"]' : `:root[data-theme="${t.id}"]`;
  const selSans = t.id === 'kaki' ? ':root' : sel;
  const sans = `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {\n  ${selSans} {\n${Object.entries(solide).map(([k, v]) => `    ${k}: ${v};`).join('\n')}\n  }\n}`;
  const pastille = `.pf-theme--${t.id} { --pastille: ${apercu.pastille}; --pf-degrade: ${apercu.degrade}; --pf-fond: ${apercu.fond}; } /* aperçu du thème dans Profil */`;
  return `/* ----- ${t.nom} ----- */\n${sel} {\n${lignes}\n}\n${sans}\n${pastille}\n`;
}

// ----- Programme principal -----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ICI = path.dirname(fileURLToPath(import.meta.url));
  const entete = `/* ===== Thèmes de couleur de l'appli : FICHIER GÉNÉRÉ — ne pas modifier à la main =====
   Source : outils/generer-themes.mjs (node outils/generer-themes.mjs). 12 thèmes : kaki (par défaut), bleu ciel, sauge, terracotta, lavande, sable,
   rose poudré, corail, menthe, turquoise, bleu nuit, moutarde. Un 13e choix, « Couleur personnalisée », est calculé dans le navigateur (js/theme.js)
   avec les mêmes formules (js/couleurs-theme.js).
   Le thème est posé par js/theme.js sur <html data-theme="…">. Chaque thème redéfinit les mêmes variables ; rien d'autre ne change.
   Ne changent JAMAIS avec le thème (voir css/tokens.css) : les couleurs d'urgence (rouge, ambre, vert) et celles des types de soin et des animaux.
   Contraste texte/fond mesuré à la génération : au moins 4,5:1 pour chaque paire importante de chaque thème. */

`;
  let css = entete;
  let echecs = 0;
  for (const t of THEMES) {
    css += `${bloc(t)}\n`;
    const r = controle(t);
    const mauvais = r.filter((x) => x.ratio < x.mini);
    const pire = r.reduce((m, x) => (x.ratio / x.mini < m.ratio / m.mini ? x : m));
    console.log(`${t.nom.padEnd(12)} ${r.length} paires, ${mauvais.length} sous le seuil · la plus juste : « ${pire.nom} » ${pire.ratio.toFixed(2)}:1`);
    for (const m of mauvais) { console.log(`   ÉCHEC ${m.nom} : ${m.ratio.toFixed(2)}:1 (minimum ${m.mini}:1)`); echecs++; }
  }
  // Couleur personnalisée : grille de couleurs de départ
  let n = 0; let pireP = { ratio: 99 };
  for (let h = 0; h < 360; h += 10) for (const s of [0, 20, 50, 80, 100]) for (const l of [3, 15, 30, 50, 70, 90, 98]) {
    const choisie = hex(hsl(h, s, l));
    const { theme } = themeDepuisCouleur(choisie);
    for (const x of controle(theme)) {
      n++;
      if (x.ratio / x.mini < pireP.ratio / (pireP.mini ?? 1)) pireP = { ...x, choisie };
      if (x.ratio < x.mini) { echecs++; if (echecs < 15) console.log(`   ÉCHEC couleur personnalisée ${choisie} : ${x.nom} ${x.ratio.toFixed(2)}:1`); }
    }
  }
  console.log(`Couleur perso ${n} contrôles sur ${36 * 5 * 7} couleurs de départ · la plus juste : « ${pireP.nom} » ${pireP.ratio.toFixed(2)}:1 (départ ${pireP.choisie})`);
  fs.writeFileSync(path.join(ICI, '..', 'css', 'themes.css'), css.trimEnd() + '\n');
  if (echecs) { console.error(`\n${echecs} paire(s) sous le seuil.`); process.exit(1); }
  console.log('\ncss/themes.css écrit.');
}
