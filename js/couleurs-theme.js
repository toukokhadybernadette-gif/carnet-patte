// Calcul des couleurs d'un thème à partir d'UNE teinte (h) et d'une saturation (s), et contrôle de contraste.
// Utilisé par outils/generer-themes.mjs (qui écrit css/themes.css pour les 12 thèmes fixes) ET par js/theme.js (couleur personnalisée :
// la couleur choisie est ajustée ici, automatiquement, pour que le texte garde au moins 4,5:1 de contraste).
// Les couleurs d'URGENCE (rouge, ambre, vert) et des types de soin ne passent jamais par ici : elles ne changent pas avec le thème.

// ----- Couleurs -----
export const hsl = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
export const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
export const lire = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const estHex = (t) => /^#[0-9a-fA-F]{6}$/.test(String(t));
const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Couleur `dessus` (rgb + alpha) posée sur `dessous` (rgb). */
export const poser = (dessus, alpha, dessous) => dessus.map((v, i) => Math.round(v * alpha + dessous[i] * (1 - alpha)));
export const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;
export const BLANC = [255, 255, 255];
const TERRE = lire('#8E3D2B'); // terre cuite d'urgence (css/tokens.css)

/** [r, g, b] → { h (0-360), s (0-100), l (0-100) }. */
export function versHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(h * 60) % 360, s: Math.round(s * 100), l: l * 100 };
}

/** Le plus clair des `l` (en descendant de `depart`) qui donne au moins `mini`:1 contre `contre`. */
export const assez = (h, s, depart, contre, mini) => { for (let l = depart; l > 5; l -= 0.5) if (contraste(hsl(h, s, l), contre) >= mini) return l; return 5; };

/**
 * Thème décrit par { h, s } (+ `fixe` pour garder des valeurs exactes, + `l` : clarté maximale souhaitée du bouton, pour une couleur choisie).
 * Retourne toutes les couleurs, en [r, g, b].
 */
export function palette(t) {
  const { h } = t;
  const s = Math.max(0, Math.min(85, t.s));
  const f = t.fixe;
  const lForet = f ? null : assez(h, s, Math.min(40, t.l ?? 40), BLANC, 6.2);
  const foret = f ? lire(f.foret) : hsl(h, s, lForet);
  const foretTexte = f ? lire(f.foretTexte) : hsl(h, s, Math.max(lForet - 6, 8));
  const survol = f ? lire(f.survol) : hsl(h, s, Math.max(lForet - 4.5, 6));
  const actif = f ? lire(f.actif) : hsl(h, s, Math.max(lForet - 9, 5));
  const bord = f ? lire(f.bord) : hsl(h, s, Math.max(lForet - 7, 5));
  const fond = hsl(h, 34, 97);
  const carte = hsl(h, 28, 99.2);
  const surface2 = hsl(h, 26, 93);
  const degrade = hsl(h, Math.min(70, s + 25), 89);
  const vertClair = hsl(h, Math.round(s * 0.55), 92);
  const sauge = hsl(h, Math.round(s * 0.55), 72);
  const texte = hsl(h, 28, 11);
  const texteDoux = hsl(h, 9, 33);
  const placeholder = hsl(h, 6, 40);
  const ombre = hsl(h, 32, 22);
  const bulles = [hsl(h, Math.min(60, s + 14), 82), hsl((h + 28) % 360, Math.min(50, s + 6), 84), hsl((h + 330) % 360, Math.min(46, s), 85)];
  return {
    foret, foretTexte, survol, actif, bord, fond, carte, surface2, degrade, vertClair, sauge, texte, texteDoux, placeholder, ombre, bulles,
    bordure: hsl(h, 18, 88), bordureForte: hsl(h, 12, 72), bordureChamp: hsl(h, 8, 46),
    neutre: hsl(h, 24, 97), neutreSurvol: hsl(h, 22, 92), neutreActif: hsl(h, 20, 88), contour: hsl(h, 10, 66), pilule: hsl(h, 22, 96),
    desactiveFond: hsl(h, 14, 92), desactiveTexte: hsl(h, 6, 40),
  };
}

/**
 * Les variables CSS d'un thème (nom → valeur) et, à part, leurs versions « sans flou » pour les navigateurs sans backdrop-filter.
 * Ce sont exactement celles de css/themes.css.
 */
export function variablesTheme(t) {
  const p = palette(t);
  const H = hex;
  const o = p.ombre.join(', ');
  const vars = {
    '--cp-foret': H(p.foret), '--cp-foret-texte': H(p.foretTexte), '--cp-sauge': H(p.sauge), '--cp-vert-clair': H(p.vertClair),
    '--cp-foret-survol': H(p.survol), '--cp-foret-actif': H(p.actif),
    '--cp-info': H(p.foret), '--cp-info-pale': H(p.vertClair), '--cp-focus': H(p.foret),
    '--cc-fond': H(p.foret), '--cc-fond-survol': H(p.survol), '--cc-bord': H(p.bord), '--cc-actif': H(p.actif),
    '--cp-fond': H(p.fond), '--cp-carte': H(p.carte), '--cp-surface-2': H(p.surface2), '--cp-degrade': H(p.degrade),
    '--cp-texte': H(p.texte), '--cp-texte-doux': H(p.texteDoux), '--cp-placeholder': H(p.placeholder),
    '--cp-bordure': H(p.bordure), '--cp-bordure-forte': H(p.bordureForte), '--cp-bordure-champ': H(p.bordureChamp),
    '--cp-fond-survol': H(p.neutreSurvol), '--cp-desactive-fond': H(p.desactiveFond), '--cp-desactive-texte': H(p.desactiveTexte),
    '--cp-neutre-bouton': H(p.neutre), '--cp-neutre-survol': H(p.neutreSurvol), '--cp-neutre-actif': H(p.neutreActif),
    '--cp-contour': H(p.contour), '--cp-pilule': H(p.pilule), '--cp-champ-fond': rgba(BLANC, 0.97),
    '--cp-ombre-rgb': o,
    '--cp-ombre-s': `0 1px 2px rgba(${o}, .05)`, '--cp-ombre-m': `0 4px 14px rgba(${o}, .08)`, '--cp-ombre-l': `0 16px 40px rgba(${o}, .14)`,
    '--cp-verre-fond': 'rgba(255, 255, 255, .62)', '--cp-verre-fond-fort': 'rgba(255, 255, 255, .82)', '--cp-verre-bordure': 'rgba(255, 255, 255, .92)',
    '--cp-verre-ombre': `inset 0 1px 0 rgba(255, 255, 255, .9), 0 0 0 1px rgba(${o}, .05), 0 10px 30px rgba(${o}, .07)`,
    '--cp-verre-barre-haut': rgba(p.fond, 0.66), '--cp-verre-barre-laterale': rgba(p.fond, 0.55), '--cp-verre-barre-bas': rgba(p.fond, 0.7),
    '--cp-verre-fenetre': 'rgba(255, 255, 255, .86)', '--cp-verre-menu': 'rgba(255, 255, 255, .96)',
    '--cp-sauge-verre': rgba(p.sauge, 0.24), '--cp-sauge-verre-fort': rgba(p.sauge, 0.4), '--cp-sauge-verre-bord': 'rgba(255, 255, 255, .85)', '--cp-sauge-verre-ombre': 'inset 0 1px 0 rgba(255, 255, 255, .7)',
    '--cp-nav-fond': rgba(p.foret, 0.93), '--cp-nav-actif': H(p.carte),
    '--cp-voile': `rgba(${o}, .32)`,
    '--cp-bulle-1': rgba(p.bulles[0], 0.55), '--cp-bulle-2': rgba(p.bulles[1], 0.5), '--cp-bulle-3': rgba(p.bulles[2], 0.5),
  };
  const solide = {
    '--cp-verre-fond': H(poser(BLANC, 0.97, p.fond)), '--cp-verre-fond-fort': H(p.carte), '--cp-sauge-verre': H(p.vertClair), '--cp-sauge-verre-fort': H(poser(p.sauge, 0.5, p.vertClair)),
    '--cp-verre-barre-haut': H(p.fond), '--cp-verre-barre-laterale': H(p.surface2), '--cp-verre-barre-bas': H(p.fond), '--cp-verre-fenetre': H(p.carte), '--cp-verre-menu': H(p.carte),
  };
  const apercu = { pastille: H(p.foret), degrade: H(p.degrade), fond: H(p.fond) }; // pour la carte du thème dans Profil
  return { vars, solide, apercu };
}

// ----- Contrôle de contraste -----
export function controle(t) {
  const p = palette(t);
  const fonds = { fond: p.fond, carte: p.carte, 'surface-2': p.surface2, 'vert-clair': p.vertClair, 'dégradé du haut': p.degrade, 'bouton neutre': p.neutre, pastille: p.pilule };
  // pire cas du verre : une bulle de couleur (55 %) sous le verre blanc à 62 %
  p.bulles.forEach((b, i) => { fonds[`verre sur bulle ${i + 1}`] = poser(BLANC, 0.62, poser(b, 0.55, p.fond)); });
  const resultats = [];
  const verifier = (nom, a, b, mini = 4.5) => resultats.push({ nom, ratio: contraste(a, b), mini });
  for (const [nf, fond] of Object.entries(fonds)) {
    verifier(`texte / ${nf}`, p.texte, fond);
    verifier(`texte doux / ${nf}`, p.texteDoux, fond);
    verifier(`couleur du thème en texte (titres, liens) / ${nf}`, p.foretTexte, fond);
  }
  verifier('texte / pastille de verre sur bulle', p.texte, poser(p.sauge, 0.4, poser(BLANC, 0.62, poser(p.bulles[0], 0.55, p.fond))));
  verifier('blanc / bouton principal', BLANC, p.foret);
  verifier('blanc / bouton principal survolé', BLANC, p.survol);
  verifier('blanc / bouton principal enfoncé', BLANC, p.actif);
  verifier('blanc / barre du bas', BLANC, poser(p.foret, 0.93, p.fond));
  verifier('blanc / barre du bas sur bulle', BLANC, poser(p.foret, 0.93, poser(p.bulles[0], 0.55, p.fond)));
  verifier('onglet actif de la barre du bas', p.foretTexte, p.carte);
  verifier('couleur du thème / pastille claire (badge info)', p.foret, p.vertClair);
  verifier('indication des champs / champ blanc', p.placeholder, BLANC);
  verifier('texte / champ blanc', p.texte, BLANC);
  verifier('texte désactivé / fond désactivé', p.desactiveTexte, p.desactiveFond);
  verifier("terre cuite d'urgence / bouton neutre (numéros du module Toxique)", TERRE, p.neutre);
  verifier('contour des champs / champ blanc (3:1)', p.bordureChamp, BLANC, 3);
  return resultats;
}

/**
 * Couleur personnalisée : un nuancier libre donne `choisie` (#RRGGBB). On en garde la teinte et la saturation ; la clarté du bouton est
 * baissée au besoin pour que le texte blanc dessus ait au moins 6,2:1 (le reste est calculé comme pour les autres thèmes).
 * Retourne { theme, utilisee (#RRGGBB du bouton), ajustee (true si la couleur a dû être assombrie) }.
 */
export function themeDepuisCouleur(choisie) {
  const rgb = lire(choisie);
  const { h, s, l } = versHsl(rgb);
  const theme = { id: 'perso', nom: 'Couleur personnalisée', h, s, l };
  const utilisee = hex(palette(theme).foret);
  return { theme, utilisee, ajustee: contraste(BLANC, rgb) < 6.2 };
}
