// Thème de couleur de l'appli : 12 thèmes prêts (css/themes.css, généré par outils/generer-themes.mjs) + une « couleur personnalisée ».
// Le choix est mémorisé sur CET appareil seulement (localStorage), à part des données des animaux : il n'est donc ni exporté ni effacé avec elles.
// Au chargement, un petit script dans index.html pose déjà le thème avant l'affichage (pas de flash de couleur) ; ce module fait le reste.
//
// Couleur personnalisée : le nuancier donne une couleur ; js/couleurs-theme.js en garde la teinte et la saturation et assombrit le bouton au besoin
// pour que le texte blanc dessus ait au moins 6,2:1 ; tout le reste de la palette est calculé comme pour les autres thèmes (texte >= 4,5:1).
// Les variables calculées sont posées sur <html> (style en ligne) et gardées dans localStorage pour le prochain chargement.

import { themeDepuisCouleur, variablesTheme, estHex } from './couleurs-theme.js';
import { variablesThemeSombre } from './couleurs-sombre.js';

// ----- Mode clair / sombre / automatique (suit l'appareil) -----
// Le mode est posé sur <html data-mode="light|dark"> ; css/themes-sombre.css (12 thèmes) et css/sombre.css font le reste.
export const MODES = [
  { id: 'clair', nom: 'Clair' },
  { id: 'sombre', nom: 'Sombre' },
  { id: 'auto', nom: 'Automatique' },
];
export const MODE_DEFAUT = 'clair';
export const CLE_MODE = 'carnetpatte.mode';
export const CLE_PERSO_VARIABLES_SOMBRE = 'carnetpatte.themePersoVarsSombre'; // variables de la couleur personnalisée en mode sombre (lues par le script de index.html)

export const THEMES = [
  { id: 'kaki', nom: 'Kaki' },
  { id: 'bleu-ciel', nom: 'Bleu ciel' },
  { id: 'sauge', nom: 'Sauge' },
  { id: 'terracotta', nom: 'Terracotta' },
  { id: 'lavande', nom: 'Lavande' },
  { id: 'sable', nom: 'Sable' },
  { id: 'rose-poudre', nom: 'Rose poudré' },
  { id: 'corail', nom: 'Corail' },
  { id: 'menthe', nom: 'Menthe' },
  { id: 'turquoise', nom: 'Turquoise' },
  { id: 'bleu-nuit', nom: 'Bleu nuit' },
  { id: 'moutarde', nom: 'Moutarde' },
];
export const THEME_DEFAUT = 'kaki';
export const PERSO = 'perso';
export const COULEUR_PERSO_DEFAUT = '#7A4FA3';
export const CLE_THEME = 'carnetpatte.theme';
export const CLE_PERSO = 'carnetpatte.themePerso';           // la couleur choisie dans le nuancier (#RRGGBB)
export const CLE_PERSO_VARIABLES = 'carnetpatte.themePersoVars'; // les variables calculées (lues par le script de index.html)

const connu = (id) => id === PERSO || THEMES.some((t) => t.id === id);
const lire = (cle) => { try { return localStorage.getItem(cle); } catch { return null; } };
const ecrire = (cle, valeur) => { try { localStorage.setItem(cle, valeur); } catch { /* stockage bloqué : le thème vaut pour cette visite */ } };

/** Thème mémorisé sur l'appareil (le défaut si rien, ou si le stockage est bloqué). */
export function themeMemorise() {
  const id = lire(CLE_THEME);
  if (id === PERSO) return estHex(lire(CLE_PERSO)) ? PERSO : THEME_DEFAUT;
  return connu(id) ? id : THEME_DEFAUT;
}

/** Couleur choisie dans le nuancier (mémorisée), ou la couleur proposée au départ. */
export function couleurPerso() {
  const c = lire(CLE_PERSO);
  return estHex(c) ? c.toUpperCase() : COULEUR_PERSO_DEFAUT;
}

/**
 * Variables posées en ligne par la couleur personnalisée (à retirer en changeant de thème). On retire TOUTES les variables de couleur connues,
 * pas seulement celles de cette visite : le script de index.html a pu en poser avant l'affichage (couleur personnalisée mémorisée).
 */
const NOMS_VARIABLES = Object.keys(variablesTheme({ h: 0, s: 0 }).vars);
const retirerVariablesPerso = () => { for (const nom of NOMS_VARIABLES) document.documentElement.style.removeProperty(nom); };

const requeteSombre = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);
const modeConnu = (id) => MODES.some((m) => m.id === id);

/** Mode choisi et mémorisé sur l'appareil : 'clair', 'sombre' ou 'auto'. */
export function modeMemorise() {
  const id = lire(CLE_MODE);
  return modeConnu(id) ? id : MODE_DEFAUT;
}

/** Le mode sombre est-il actif maintenant ? (choix « Sombre », ou « Automatique » avec un appareil en mode sombre) */
export function sombreActif(mode = modeMemorise()) {
  return mode === 'sombre' || (mode === 'auto' && Boolean(requeteSombre()?.matches));
}

/** Variables calculées de la couleur personnalisée pour le mode actuel (sans flou si le navigateur ne sait pas le faire). */
function variablesPerso(couleur) {
  const { theme } = themeDepuisCouleur(couleur);
  const sansFlou = typeof CSS !== 'undefined' && !CSS.supports('backdrop-filter', 'blur(1px)') && !CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
  const clair = variablesTheme(theme);
  const sombre = variablesThemeSombre(theme);
  return { clair: { ...clair.vars, ...(sansFlou ? clair.solide : {}) }, sombre: { ...sombre.vars, ...(sansFlou ? sombre.solide : {}) }, apercu: clair.apercu };
}

/**
 * Applique le mode (clair, sombre ou automatique). Si le thème est « couleur personnalisée », ses variables sont recalculées pour le mode.
 * `memoriser: false` pour un simple essai.
 */
export function appliquerMode(mode, { memoriser = true } = {}) {
  const m = modeConnu(mode) ? mode : MODE_DEFAUT;
  const sombre = sombreActif(m);
  document.documentElement.dataset.mode = sombre ? 'dark' : 'light';
  if (document.documentElement.dataset.theme === PERSO) {
    const v = variablesPerso(couleurPerso());
    retirerVariablesPerso();
    for (const [nom, valeur] of Object.entries(sombre ? v.sombre : v.clair)) document.documentElement.style.setProperty(nom, valeur);
  }
  majBarreEtat();
  if (memoriser) ecrire(CLE_MODE, m);
  return m;
}

const majBarreEtat = () => {
  // la barre d'état de l'iPhone prend la couleur du dégradé du haut
  const fond = getComputedStyle(document.documentElement).getPropertyValue('--cp-degrade').trim();
  if (fond) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fond);
};

/** Applique un des 12 thèmes tout de suite (aperçu immédiat). `memoriser: false` pour un simple essai. */
export function appliquerTheme(id, { memoriser = true } = {}) {
  const theme = connu(id) && id !== PERSO ? id : THEME_DEFAUT;
  retirerVariablesPerso();
  document.documentElement.dataset.theme = theme;
  majBarreEtat();
  if (memoriser) ecrire(CLE_THEME, theme);
  return theme;
}

/**
 * Applique la couleur personnalisée. Retourne { choisie, utilisee, ajustee, variables } :
 * `utilisee` est la couleur réellement donnée aux boutons, `ajustee` dit si elle a dû être assombrie pour rester lisible.
 */
export function appliquerPerso(couleur, { memoriser = true } = {}) {
  const choisie = (estHex(couleur) ? couleur : COULEUR_PERSO_DEFAUT).toUpperCase();
  const { utilisee, ajustee } = themeDepuisCouleur(choisie);
  const v = variablesPerso(choisie);
  const toutes = sombreActif() ? v.sombre : v.clair;
  retirerVariablesPerso();
  for (const [nom, valeur] of Object.entries(toutes)) document.documentElement.style.setProperty(nom, valeur);
  document.documentElement.dataset.theme = PERSO;
  majBarreEtat();
  // Les deux jeux de variables sont gardés : le script de index.html choisit le bon avant l'affichage (clair ou sombre), sans flash
  if (memoriser) { ecrire(CLE_THEME, PERSO); ecrire(CLE_PERSO, choisie); ecrire(CLE_PERSO_VARIABLES, JSON.stringify(v.clair)); ecrire(CLE_PERSO_VARIABLES_SOMBRE, JSON.stringify(v.sombre)); }
  return { choisie, utilisee, ajustee, apercu: v.apercu, variables: toutes };
}

export function themeActuel() {
  const id = document.documentElement.dataset.theme;
  return connu(id) ? id : THEME_DEFAUT;
}

export function initialiserTheme() {
  addEventListener('load', majBarreEtat, { once: true }); // les feuilles de style sont sûrement chargées à ce moment-là
  document.documentElement.dataset.mode = sombreActif() ? 'dark' : 'light';
  const id = themeMemorise();
  if (id === PERSO) appliquerPerso(couleurPerso(), { memoriser: false });
  else appliquerTheme(id, { memoriser: false });
  // « Automatique » : le mode suit l'appareil, y compris quand il change pendant que l'appli est ouverte (coucher du soleil, réglage de l'iPhone)
  requeteSombre()?.addEventListener?.('change', () => { if (modeMemorise() === 'auto') appliquerMode('auto', { memoriser: false }); });
}
