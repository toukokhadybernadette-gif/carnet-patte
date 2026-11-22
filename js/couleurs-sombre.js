// MODE SOMBRE : mêmes variables que le mode clair (js/couleurs-theme.js), calculées pour un fond sombre.
// Utilisé par outils/generer-themes.mjs (qui écrit css/themes-sombre.css pour les 12 thèmes) ET par js/theme.js (couleur personnalisée).
// Posé par js/theme.js sur <html data-mode="dark">.
// Les boutons gardent un fond kaki assez foncé pour du texte BLANC (>= 5:1) ; les titres et liens passent en version CLAIRE de la teinte.
// Les couleurs d'urgence, de types de soin et d'animaux ont leurs versions sombres (URGENCE_SOMBRE), identiques dans tous les thèmes.

import { hsl, hex, lire, contraste, poser, rgba, BLANC, assez } from './couleurs-theme.js';

/** Couleurs d'urgence, de types de soin et d'animaux en mode sombre : fond foncé + texte clair (contrôlées à la génération). */
export const URGENCE_SOMBRE = {
  '--cp-terre': '#F4A896', '--cp-terre-pale': '#4A2219', '--cp-terre-survol': '#F8C2B5',
  '--cp-ambre': '#F2C873', '--cp-ambre-pale': '#46340F',
  '--cp-succes': '#5CC08E', '--cp-succes-pale': '#14382A', '--cp-succes-texte': '#97E3BC',
  '--cp-type-vaccin-fond': '#1E3558', '--cp-type-vaccin-texte': '#A9CBF7',
  '--cp-type-vermifuge-fond': '#15402C', '--cp-type-vermifuge-texte': '#93DFB8',
  '--cp-type-antiparasitaire-fond': '#4A2C12', '--cp-type-antiparasitaire-texte': '#F7BE92',
  '--cp-type-veto-fond': '#36274F', '--cp-type-veto-texte': '#D0B8F4',
  '--cp-type-autre-fond': '#2D3433', '--cp-type-autre-texte': '#C9D1CE',
  '--cp-an-ardoise-fond': '#22364A', '--cp-an-ardoise-texte': '#B9D3EC', '--cp-an-ardoise-trait': '#7FAEDB',
  '--cp-an-turquoise-fond': '#12403F', '--cp-an-turquoise-texte': '#A4E3DF', '--cp-an-turquoise-trait': '#4FC1BB',
  '--cp-an-indigo-fond': '#2B2B55', '--cp-an-indigo-texte': '#C8C8F6', '--cp-an-indigo-trait': '#9090EC',
  '--cp-an-magenta-fond': '#4A1F3A', '--cp-an-magenta-texte': '#F4C0E0', '--cp-an-magenta-trait': '#E57FC0',
  '--cp-an-brun-fond': '#3F2E1E', '--cp-an-brun-texte': '#EBD3B8', '--cp-an-brun-trait': '#CB9A60',
  '--cp-an-rose-fond': '#4A2430', '--cp-an-rose-texte': '#F7C3CE', '--cp-an-rose-trait': '#EA8399',
  '--cp-an-olive-fond': '#373A1A', '--cp-an-olive-texte': '#D9DCA6', '--cp-an-olive-trait': '#ABB157',
  '--cp-an-gris-fond': '#2D353C', '--cp-an-gris-texte': '#C9D3DB', '--cp-an-gris-trait': '#96A8B6',
};

/** Les paires texte / fond des couleurs d'urgence, de types de soin et d'animaux en sombre. */
export function controleUrgenceSombre() {
  const v = (k) => lire(URGENCE_SOMBRE[k]);
  const r = [];
  const paire = (nom, a, b, mini = 4.5) => r.push({ nom: `sombre : ${nom}`, ratio: contraste(v(a), v(b)), mini });
  paire('rouge (texte) / fond du badge', '--cp-terre', '--cp-terre-pale');
  paire('ambre (texte) / fond du badge', '--cp-ambre', '--cp-ambre-pale');
  paire('vert (texte) / fond du badge', '--cp-succes-texte', '--cp-succes-pale');
  for (const t of ['vaccin', 'vermifuge', 'antiparasitaire', 'veto', 'autre']) paire(`type de soin ${t}`, `--cp-type-${t}-texte`, `--cp-type-${t}-fond`);
  for (const a of ['ardoise', 'turquoise', 'indigo', 'magenta', 'brun', 'rose', 'olive', 'gris']) paire(`animal ${a} (initiales)`, `--cp-an-${a}-texte`, `--cp-an-${a}-fond`);
  return r;
}

/** Palette sombre d'un thème { h, s } (mêmes noms que palette()). */
export function paletteSombre(t) {
  const { h } = t;
  const s = Math.max(0, Math.min(85, t.s));
  const f = t.fixe;
  const lForet = f ? null : assez(h, s, Math.min(44, t.l ?? 44), BLANC, 5.2);
  const foret = f ? lire(f.foret) : hsl(h, s, lForet);
  const survol = f ? lire(f.survol) : hsl(h, s, Math.max(lForet - 4, 6));
  const actif = f ? lire(f.actif) : hsl(h, s, Math.max(lForet - 8, 5));
  const bord = f ? lire(f.bord) : hsl(h, s, Math.max(lForet - 6, 5));
  const fond = hsl(h, 22, 8.5);
  const carte = hsl(h, 20, 12.5);
  const surface2 = hsl(h, 18, 17);
  const degrade = hsl(h, Math.min(45, Math.round(s * 0.8) + 5), 14);
  const vertClair = hsl(h, Math.min(40, Math.round(s * 0.5) + 6), 20);
  const sauge = hsl(h, Math.round(s * 0.5), 40);
  const bulles = [hsl(h, Math.min(50, s + 6), 21), hsl((h + 28) % 360, Math.min(40, s), 19), hsl((h + 330) % 360, Math.min(36, s), 20)];
  return {
    foret, survol, actif, bord, fond, carte, surface2, degrade, vertClair, sauge, bulles,
    foretTexte: hsl(h, Math.min(s + 8, 80), 79), focus: hsl(h, Math.min(s + 8, 80), 70),
    texte: hsl(h, 20, 94), texteDoux: hsl(h, 12, 75), placeholder: hsl(h, 8, 66),
    bordure: hsl(h, 14, 25), bordureForte: hsl(h, 12, 36), bordureChamp: hsl(h, 10, 60),
    champ: hsl(h, 18, 15),
    neutre: hsl(h, 16, 19), neutreSurvol: hsl(h, 16, 24), neutreActif: hsl(h, 16, 28), contour: hsl(h, 10, 42), pilule: hsl(h, 16, 18),
    desactiveFond: hsl(h, 10, 19), desactiveTexte: hsl(h, 6, 64),
    navActif: hsl(h, 22, 9),
  };
}

/** Variables CSS d'un thème en mode sombre : mêmes noms que variablesTheme(), et leurs versions « sans flou ». */
export function variablesThemeSombre(t) {
  const p = paletteSombre(t);
  const H = hex;
  const vars = {
    '--cp-foret': H(p.foret), '--cp-foret-texte': H(p.foretTexte), '--cp-sauge': H(p.sauge), '--cp-vert-clair': H(p.vertClair),
    '--cp-foret-survol': H(p.survol), '--cp-foret-actif': H(p.actif),
    '--cp-info': H(p.foretTexte), '--cp-info-pale': H(p.vertClair), '--cp-focus': H(p.focus),
    '--cc-fond': H(p.foret), '--cc-fond-survol': H(p.survol), '--cc-bord': H(p.bord), '--cc-actif': H(p.actif),
    '--cp-fond': H(p.fond), '--cp-carte': H(p.carte), '--cp-surface-2': H(p.surface2), '--cp-degrade': H(p.degrade),
    '--cp-texte': H(p.texte), '--cp-texte-doux': H(p.texteDoux), '--cp-placeholder': H(p.placeholder),
    '--cp-bordure': H(p.bordure), '--cp-bordure-forte': H(p.bordureForte), '--cp-bordure-champ': H(p.bordureChamp),
    '--cp-fond-survol': H(p.neutreSurvol), '--cp-desactive-fond': H(p.desactiveFond), '--cp-desactive-texte': H(p.desactiveTexte),
    '--cp-neutre-bouton': H(p.neutre), '--cp-neutre-survol': H(p.neutreSurvol), '--cp-neutre-actif': H(p.neutreActif),
    '--cp-contour': H(p.contour), '--cp-pilule': H(p.pilule), '--cp-champ-fond': rgba(p.champ, 0.97),
    '--cp-ombre-rgb': '0, 0, 0',
    '--cp-ombre-s': '0 1px 2px rgba(0, 0, 0, .35)', '--cp-ombre-m': '0 4px 14px rgba(0, 0, 0, .4)', '--cp-ombre-l': '0 16px 40px rgba(0, 0, 0, .55)',
    '--cp-verre-fond': rgba(p.carte, 0.62), '--cp-verre-fond-fort': rgba(p.carte, 0.82), '--cp-verre-bordure': 'rgba(255, 255, 255, .1)',
    '--cp-verre-ombre': 'inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 1px rgba(0, 0, 0, .25), 0 10px 30px rgba(0, 0, 0, .35)',
    '--cp-verre-barre-haut': rgba(p.fond, 0.7), '--cp-verre-barre-laterale': rgba(p.fond, 0.6), '--cp-verre-barre-bas': rgba(p.fond, 0.75),
    '--cp-verre-fenetre': rgba(p.carte, 0.9), '--cp-verre-menu': rgba(p.carte, 0.97),
    '--cp-sauge-verre': rgba(p.sauge, 0.24), '--cp-sauge-verre-fort': rgba(p.sauge, 0.4), '--cp-sauge-verre-bord': 'rgba(255, 255, 255, .12)', '--cp-sauge-verre-ombre': 'inset 0 1px 0 rgba(255, 255, 255, .08)',
    '--cp-nav-fond': rgba(p.foret, 0.93), '--cp-nav-actif': H(p.navActif),
    '--cp-voile': 'rgba(0, 0, 0, .6)',
    '--cp-bulle-1': rgba(p.bulles[0], 0.6), '--cp-bulle-2': rgba(p.bulles[1], 0.55), '--cp-bulle-3': rgba(p.bulles[2], 0.55),
  };
  const solide = {
    '--cp-verre-fond': H(poser(p.carte, 0.97, p.fond)), '--cp-verre-fond-fort': H(p.carte), '--cp-sauge-verre': H(p.vertClair), '--cp-sauge-verre-fort': H(poser(p.sauge, 0.5, p.vertClair)),
    '--cp-verre-barre-haut': H(p.fond), '--cp-verre-barre-laterale': H(p.surface2), '--cp-verre-barre-bas': H(p.fond), '--cp-verre-fenetre': H(p.carte), '--cp-verre-menu': H(p.carte),
  };
  const apercu = { pastille: H(p.foret), degrade: H(p.degrade), fond: H(p.fond) };
  return { vars, solide, apercu };
}

/** Contrôle de contraste du mode sombre pour un thème : mêmes paires que controle(), adaptées au fond sombre. */
export function controleSombre(t) {
  const p = paletteSombre(t);
  const fonds = { fond: p.fond, carte: p.carte, 'surface-2': p.surface2, 'vert-clair': p.vertClair, 'dégradé du haut': p.degrade, 'bouton neutre': p.neutre, pastille: p.pilule, champ: p.champ };
  p.bulles.forEach((b, i) => { fonds[`verre sur bulle ${i + 1}`] = poser(p.carte, 0.62, poser(b, 0.6, p.fond)); });
  const resultats = [];
  const verifier = (nom, a, b, mini = 4.5) => resultats.push({ nom: `sombre : ${nom}`, ratio: contraste(a, b), mini });
  for (const [nf, fond] of Object.entries(fonds)) {
    verifier(`texte / ${nf}`, p.texte, fond);
    verifier(`texte doux / ${nf}`, p.texteDoux, fond);
    verifier(`couleur du thème en texte (titres, liens) / ${nf}`, p.foretTexte, fond);
  }
  verifier('blanc / bouton principal', BLANC, p.foret);
  verifier('blanc / bouton principal survolé', BLANC, p.survol);
  verifier('blanc / bouton principal enfoncé', BLANC, p.actif);
  verifier('blanc / barre du bas', BLANC, poser(p.foret, 0.93, p.fond));
  verifier('blanc / barre du bas sur bulle', BLANC, poser(p.foret, 0.93, poser(p.bulles[0], 0.6, p.fond)));
  verifier('onglet actif de la barre du bas', p.foretTexte, p.navActif);
  verifier('indication des champs / champ', p.placeholder, p.champ);
  verifier('texte / champ', p.texte, p.champ);
  verifier('texte désactivé / fond désactivé', p.desactiveTexte, p.desactiveFond);
  verifier("rouge d'urgence / bouton neutre (numéros du module Toxique)", lire(URGENCE_SOMBRE['--cp-terre']), p.neutre);
  verifier("rouge d'urgence / carte", lire(URGENCE_SOMBRE['--cp-terre']), p.carte);
  verifier('contour des champs / champ (3:1)', p.bordureChamp, p.champ, 3);
  verifier('anneau de focus / fond (3:1)', p.focus, p.fond, 3);
  verifier('anneau de focus / carte (3:1)', p.focus, p.carte, 3);
  return resultats;
}
