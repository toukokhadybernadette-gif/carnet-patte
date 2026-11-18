// Illustrations d'espèces dessinées en SVG pour Carnet Patte : elles remplacent les initiales quand un animal n'a pas de photo.
// Style : formes simples et douces, aplats de couleur, sur une grille de 100 × 100, têtes vues de face (de profil pour la poule et le canard).
// Les couleurs des animaux (pelage, bec…) sont fixes ; le fond du rond vient de la couleur de l'animal ou du thème (voir css/composants.css).
//
// POUR AJOUTER UNE ESPÈCE : ajouter une entrée ci-dessous (même grille 100 × 100), puis, si son icône Lucide a un autre nom que l'identifiant
// de l'espèce, une ligne dans ICONE_VERS_ESPECE. L'aperçu de toutes les illustrations est dans la page #/composants.

const OEIL = (x, y, r = 3.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2B2118"/><circle cx="${+(x + r * 0.35).toFixed(2)}" cy="${+(y - r * 0.35).toFixed(2)}" r="${+(r * 0.34).toFixed(2)}" fill="#fff"/>`;
const TRAIT = (d, c = '#3B2A1E', w = 2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const JOUES = (y, c = '#F2A7A0') => `<ellipse cx="30" cy="${y}" rx="5" ry="3.4" fill="${c}" opacity=".55"/><ellipse cx="70" cy="${y}" rx="5" ry="3.4" fill="${c}" opacity=".55"/>`;

export const ILLUSTRATIONS = {
  chien: `
    <path d="M24 28C10 30 4 52 11 70c7 4 16-4 19-20z" fill="#8A5A2E"/><path d="M76 28c14 2 20 24 13 42-7 4-16-4-19-20z" fill="#8A5A2E"/>
    <ellipse cx="50" cy="52" rx="28" ry="30" fill="#C9975B"/>
    <path d="M50 24c-6 8-6 16 0 22 6-6 6-14 0-22z" fill="#E7C28F" opacity=".7"/>
    <ellipse cx="50" cy="64" rx="16" ry="13" fill="#F4E5CE"/>
    ${OEIL(38, 46)}${OEIL(62, 46)}
    <ellipse cx="50" cy="58" rx="6.5" ry="4.6" fill="#3B2A1E"/>
    ${TRAIT('M50 62.5v4.5M50 67c-4 4-8.5 3-9.5-.5M50 67c4 4 8.5 3 9.5-.5')}
    <path d="M45 70c1 6 9 6 10 0z" fill="#EE8B8B"/>`,
  chat: `
    <path d="M22 46 23 12l24 17z" fill="#9CA6B2"/><path d="M78 46 77 12 53 29z" fill="#9CA6B2"/>
    <path d="M28 36l1-14 11 8z" fill="#F4B6B6"/><path d="M72 36l-1-14-11 8z" fill="#F4B6B6"/>
    <ellipse cx="50" cy="56" rx="30" ry="26" fill="#9CA6B2"/>
    ${TRAIT('M50 32v7M42 33.5l1.5 6M58 33.5l-1.5 6', '#7C8794', 2.4)}
    <ellipse cx="38" cy="52" rx="5.2" ry="5.8" fill="#EBC45A"/><ellipse cx="62" cy="52" rx="5.2" ry="5.8" fill="#EBC45A"/>
    <ellipse cx="38" cy="52" rx="1.9" ry="4.6" fill="#2B2118"/><ellipse cx="62" cy="52" rx="1.9" ry="4.6" fill="#2B2118"/>
    <path d="M46 60.5h8l-4 4.2z" fill="#E58A8A"/>
    ${TRAIT('M50 64.7v3M50 67.7c-3 3-6.5 2.5-8-.5M50 67.7c3 3 6.5 2.5 8-.5')}
    ${TRAIT('M12 58l14 2.5M12 66l14-1.5M88 58 74 60.5M88 66l-14-1.5', '#F4F1EC', 1.6)}`,
  lapin: `
    <ellipse cx="35" cy="24" rx="8.5" ry="21" fill="#F4EFE9" transform="rotate(-8 35 24)"/><ellipse cx="65" cy="24" rx="8.5" ry="21" fill="#F4EFE9" transform="rotate(8 65 24)"/>
    <ellipse cx="35.5" cy="26" rx="4" ry="14.5" fill="#F4B6B6" transform="rotate(-8 35 24)"/><ellipse cx="64.5" cy="26" rx="4" ry="14.5" fill="#F4B6B6" transform="rotate(8 65 24)"/>
    <ellipse cx="50" cy="63" rx="29" ry="25" fill="#F4EFE9"/><path d="M21 66c2 14 14 22 29 22s27-8 29-22" fill="none" stroke="#E4DACD" stroke-width="2"/>
    ${OEIL(39, 58)}${OEIL(61, 58)}${JOUES(68)}
    <path d="M45.5 65.5h9l-4.5 4.5z" fill="#E58A8A"/>${TRAIT('M50 70v3M50 73c-3 3-6.5 2.5-8-.5M50 73c3 3 6.5 2.5 8-.5')}`,
  oiseau: `
    <path d="M18 62c-2-24 14-40 32-40s34 16 32 40c-2 18-16 28-32 28S20 80 18 62z" fill="#6DB7C9"/>
    <path d="M32 78c4 8 10 11 18 11s14-3 18-11c-6 3-12 4-18 4s-12-1-18-4z" fill="#4E9DB3"/>
    <path d="M30 36c4-10 12-14 20-14s16 4 20 14c-8-5-14-6-20-6s-12 1-20 6z" fill="#F4E27A"/>
    <ellipse cx="50" cy="62" rx="20" ry="22" fill="#EAF4F6"/>
    ${OEIL(38, 46, 3.6)}${OEIL(62, 46, 3.6)}
    <path d="M42 54c0-5 4-8 8-8s8 3 8 8c0 6-4 10-8 10s-8-4-8-10z" fill="#F2A33A"/><path d="M45 56c2 2 8 2 10 0" fill="none" stroke="#C97F1A" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="29" cy="56" rx="5" ry="3.6" fill="#8EA8E8" opacity=".8"/><ellipse cx="71" cy="56" rx="5" ry="3.6" fill="#8EA8E8" opacity=".8"/>`,
  'cochon-inde': `
    <ellipse cx="22" cy="42" rx="9" ry="8.5" fill="#E8A9A0"/><ellipse cx="78" cy="42" rx="9" ry="8.5" fill="#E8A9A0"/>
    <ellipse cx="50" cy="58" rx="32" ry="28" fill="#C98A4B"/>
    <path d="M50 30c-9 6-12 18-9 32h18c3-14 0-26-9-32z" fill="#F6EEE2"/>
    <path d="M18 62c3 14 15 24 32 24s29-10 32-24c-6 6-18 10-32 10S24 68 18 62z" fill="#F6EEE2" opacity=".85"/>
    ${OEIL(36, 54)}${OEIL(64, 54)}
    <ellipse cx="50" cy="64" rx="5" ry="3.8" fill="#C97F78"/>${TRAIT('M50 68v3M50 71c-3 3-6 2.5-7.5-.5M50 71c3 3 6 2.5 7.5-.5')}`,
  hamster: `
    <circle cx="26" cy="32" r="10" fill="#C99A62"/><circle cx="74" cy="32" r="10" fill="#C99A62"/><circle cx="26" cy="33" r="5.5" fill="#F2B5B0"/><circle cx="74" cy="33" r="5.5" fill="#F2B5B0"/>
    <ellipse cx="50" cy="58" rx="35" ry="29" fill="#D9AD76"/>
    <path d="M50 29c-8 6-10 14-8 22h16c2-8 0-16-8-22z" fill="#B98750" opacity=".55"/>
    <ellipse cx="32" cy="68" rx="16" ry="13" fill="#F8EEDD"/><ellipse cx="68" cy="68" rx="16" ry="13" fill="#F8EEDD"/><ellipse cx="50" cy="66" rx="12" ry="10" fill="#F8EEDD"/>
    ${OEIL(38, 52)}${OEIL(62, 52)}
    <ellipse cx="50" cy="61" rx="4.4" ry="3.2" fill="#D97F86"/>${TRAIT('M50 64v2.5M50 66.5c-2.5 2.5-5.5 2-6.5-.5M50 66.5c2.5 2.5 5.5 2 6.5-.5')}`,
  furet: `
    <circle cx="24" cy="36" r="9" fill="#B79C7A"/><circle cx="76" cy="36" r="9" fill="#B79C7A"/><circle cx="24" cy="37" r="4.6" fill="#F2B5B0"/><circle cx="76" cy="37" r="4.6" fill="#F2B5B0"/>
    <ellipse cx="50" cy="56" rx="30" ry="27" fill="#EBDCC1"/>
    <path d="M22 46c8-6 18-7 28-7s20 1 28 7c-2 10-8 15-16 15-5 0-8-2-12-2s-7 2-12 2c-8 0-14-5-16-15z" fill="#7A5A40"/>
    <ellipse cx="50" cy="68" rx="13" ry="10" fill="#F7EEDC"/>
    ${OEIL(38, 49)}${OEIL(62, 49)}
    <path d="M45 62h10l-5 5z" fill="#D97F86"/>${TRAIT('M50 67v3M50 70c-3 3-6 2.5-7.5-.5M50 70c3 3 6 2.5 7.5-.5')}`,
  poule: `
    <path d="M34 24c-4-9 2-15 8-11 2-7 10-8 12-1 6-3 12 3 9 10z" fill="#D9453F"/>
    <path d="M16 62c0-22 12-38 32-38 18 0 32 12 34 32 2 22-14 36-34 36-18 0-32-12-32-30z" fill="#FBF8F2"/>
    <path d="M56 70c8-8 22-8 28-2-2 14-12 24-28 24-6 0-10-2-14-5 8-2 12-8 14-17z" fill="#EDE6DA"/>
    <path d="M8 56l14-5v12z" fill="#F2A33A"/><path d="M26 66c-2 8 2 13 6 12 3-1 3-6 0-10z" fill="#D9453F"/>
    ${OEIL(40, 48, 3.6)}<ellipse cx="34" cy="58" rx="5" ry="3.4" fill="#F2A7A0" opacity=".6"/>`,
  canard: `
    <path d="M16 56c0-22 14-36 34-36s34 14 34 36c0 20-14 34-34 34S16 76 16 56z" fill="#F2CD55"/>
    <path d="M50 88c-14 0-26-8-32-22 8 8 18 10 32 10s24-2 32-10c-6 14-18 22-32 22z" fill="#E3B63B"/>
    <path d="M6 54c0-5 9-8 22-7 10 1 16 4 16 8s-6 8-16 9C15 66 6 61 6 54z" fill="#F08A2D"/><path d="M12 54c8 3 18 3 28 0" fill="none" stroke="#C86B14" stroke-width="1.6" stroke-linecap="round"/>
    ${OEIL(48, 40, 3.8)}<ellipse cx="62" cy="54" rx="6" ry="4" fill="#F2A7A0" opacity=".55"/>`,
  chevre: `
    <path d="M36 22C28 14 22 6 22 4c8 0 18 6 22 16z" fill="#B5A78E"/><path d="M64 22C72 14 78 6 78 4c-8 0-18 6-22 16z" fill="#B5A78E"/>
    <path d="M26 38 6 36c0 9 8 14 20 12z" fill="#EDE4D4"/><path d="M74 38l20-2c0 9-8 14-20 12z" fill="#EDE4D4"/>
    <path d="M28 30c0-8 10-12 22-12s22 4 22 12c0 12-4 24-6 38-1 10-6 18-16 18s-15-8-16-18c-2-14-6-26-6-38z" fill="#F4ECDD"/>
    <path d="M44 84c0 6 3 10 6 10s6-4 6-10c-3 2-9 2-12 0z" fill="#CBBFA8"/>
    ${OEIL(40, 46)}${OEIL(60, 46)}
    <ellipse cx="50" cy="66" rx="9" ry="6.5" fill="#E9D8BE"/>${TRAIT('M45 64.5v1.5M55 64.5v1.5', '#3B2A1E', 2.2)}${TRAIT('M50 70c-2 2-5 1.5-5.5-.5M50 70c2 2 5 1.5 5.5-.5')}`,
  mouton: `
    <g fill="#F5F1EA" stroke="#E2DACC" stroke-width="1.5">
      <circle cx="26" cy="38" r="12"/><circle cx="40" cy="26" r="13"/><circle cx="60" cy="26" r="13"/><circle cx="74" cy="38" r="12"/>
      <circle cx="20" cy="54" r="11"/><circle cx="80" cy="54" r="11"/><circle cx="34" cy="40" r="12"/><circle cx="66" cy="40" r="12"/><circle cx="50" cy="34" r="14"/>
    </g>
    <ellipse cx="22" cy="58" rx="9" ry="5" fill="#4A3F3A" transform="rotate(20 22 58)"/><ellipse cx="78" cy="58" rx="9" ry="5" fill="#4A3F3A" transform="rotate(-20 78 58)"/>
    <path d="M30 50c0-6 9-10 20-10s20 4 20 10c0 10-4 26-8 32-3 4-8 6-12 6s-9-2-12-6c-4-6-8-22-8-32z" fill="#5A4D47"/>
    <ellipse cx="50" cy="40" rx="15" ry="7" fill="#F5F1EA"/>
    ${OEIL(40, 56)}${OEIL(60, 56)}<ellipse cx="50" cy="72" rx="6.5" ry="4.4" fill="#D79A9A"/>${TRAIT('M50 76v2.5M50 78.5c-2.5 2.5-5.5 2-6.5-.5M50 78.5c2.5 2.5 5.5 2 6.5-.5', '#2B2118', 1.8)}`,
  cheval: `
    <path d="M32 32 28 8l16 12z" fill="#9B6537"/><path d="M68 32 72 8 56 20z" fill="#9B6537"/>
    <path d="M34 22c4-8 12-10 16-10s12 2 16 10c3 10 0 22-2 34-1 9-1 17-4 26-1 4-5 8-10 8s-9-4-10-8c-3-9-3-17-4-26-2-12-5-24-2-34z" fill="#A8703F"/>
    <path d="M38 18c4-6 8-8 12-8s8 2 12 8c-6-2-12-3-12-3s-6 1-12 3z" fill="#4A3322"/><path d="M34 22c-4 10-5 24-3 38 2-12 5-22 8-30z" fill="#4A3322"/><path d="M66 22c4 10 5 24 3 38-2-12-5-22-8-30z" fill="#4A3322"/>
    <path d="M46 30h8l-1 24c0 4-1 6-3 6s-3-2-3-6z" fill="#F6EEE2"/>
    <ellipse cx="50" cy="80" rx="12" ry="9" fill="#C28B58"/><ellipse cx="44.5" cy="82" rx="2.6" ry="3.4" fill="#3B2A1E"/><ellipse cx="55.5" cy="82" rx="2.6" ry="3.4" fill="#3B2A1E"/>
    ${OEIL(38, 48, 3.2)}${OEIL(62, 48, 3.2)}`,
  ane: `
    <path d="M36 38C28 24 24 12 28 4c10 4 18 16 20 32z" fill="#8E8E96"/><path d="M64 38c8-14 12-26 8-34-10 4-18 16-20 32z" fill="#8E8E96"/>
    <path d="M32 6c3 4 8 14 10 26-6-4-10-14-10-26z" fill="#E7B7B7"/><path d="M68 6c-3 4-8 14-10 26 6-4 10-14 10-26z" fill="#E7B7B7"/>
    <path d="M32 40c0-8 8-12 18-12s18 4 18 12c0 12-2 24-3 34-1 10-6 16-15 16s-14-6-15-16c-1-10-3-22-3-34z" fill="#9A9AA2"/>
    <path d="M40 30c4-4 16-4 20 0-6 0-14 0-20 0z" fill="#6E6E76"/>
    <ellipse cx="50" cy="76" rx="15" ry="12" fill="#EFE9DF"/><ellipse cx="43.5" cy="76" rx="2.4" ry="3.2" fill="#3B2A1E"/><ellipse cx="56.5" cy="76" rx="2.4" ry="3.2" fill="#3B2A1E"/>
    <ellipse cx="38" cy="52" rx="7" ry="5" fill="#EFE9DF"/><ellipse cx="62" cy="52" rx="7" ry="5" fill="#EFE9DF"/>
    ${OEIL(38, 52, 3.2)}${OEIL(62, 52, 3.2)}`,
  vache: `
    <path d="M28 26c-6-2-10-8-10-14 6 0 12 4 14 10z" fill="#EFE6D2"/><path d="M72 26c6-2 10-8 10-14-6 0-12 4-14 10z" fill="#EFE6D2"/>
    <ellipse cx="14" cy="40" rx="11" ry="6.5" fill="#2F2925" transform="rotate(-18 14 40)"/><ellipse cx="86" cy="40" rx="11" ry="6.5" fill="#2F2925" transform="rotate(18 86 40)"/>
    <path d="M26 30c0-8 10-12 24-12s24 4 24 12c0 10-3 24-4 34-1 12-8 24-20 24S31 76 30 64c-1-10-4-24-4-34z" fill="#FBF8F2"/>
    <path d="M26 30c0-8 8-12 16-12 2 8-2 16-8 22-5-2-8-6-8-10z" fill="#2F2925"/>
    <ellipse cx="50" cy="74" rx="18" ry="13" fill="#F2B5B0"/><ellipse cx="43" cy="75" rx="3" ry="4" fill="#B5605E"/><ellipse cx="57" cy="75" rx="3" ry="4" fill="#B5605E"/>
    ${OEIL(38, 50)}${OEIL(62, 50)}`,
  cochon: `
    <path d="M20 38 16 12l24 12z" fill="#F0A1A1"/><path d="M80 38l4-26-24 12z" fill="#F0A1A1"/>
    <ellipse cx="50" cy="56" rx="33" ry="30" fill="#F7B9B4"/>
    ${OEIL(36, 46)}${OEIL(64, 46)}${JOUES(58, '#EE8F8F')}
    <ellipse cx="50" cy="64" rx="15" ry="11" fill="#F29C9C"/><ellipse cx="44" cy="64" rx="2.8" ry="3.8" fill="#B25A5A"/><ellipse cx="56" cy="64" rx="2.8" ry="3.8" fill="#B25A5A"/>
    ${TRAIT('M42 78c5 4 11 4 16 0', '#B25A5A', 2)}`,
  tortue: `
    <ellipse cx="50" cy="20" rx="12" ry="13" fill="#9BC47F"/>${OEIL(45, 18, 2.6)}${OEIL(55, 18, 2.6)}${TRAIT('M46 26c2 2 6 2 8 0', '#4C7A3C', 1.6)}
    <ellipse cx="20" cy="46" rx="9" ry="12" fill="#9BC47F" transform="rotate(-35 20 46)"/><ellipse cx="80" cy="46" rx="9" ry="12" fill="#9BC47F" transform="rotate(35 80 46)"/>
    <ellipse cx="26" cy="80" rx="9" ry="11" fill="#9BC47F" transform="rotate(30 26 80)"/><ellipse cx="74" cy="80" rx="9" ry="11" fill="#9BC47F" transform="rotate(-30 74 80)"/>
    <ellipse cx="50" cy="58" rx="29" ry="31" fill="#6FA05B"/><ellipse cx="50" cy="58" rx="22" ry="24" fill="none" stroke="#4C7A3C" stroke-width="2"/>
    <path d="M50 36v44M28 52l44 0M31 70l38-24M31 46l38 24" fill="none" stroke="#4C7A3C" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
    <path d="M50 46l9 6-3 10H44l-3-10z" fill="#8CBB74"/>`,
  poisson: `
    <path d="M70 50 94 28v44z" fill="#F08A2D"/><path d="M70 50 88 38v24z" fill="#F6A85A"/>
    <path d="M44 20c6-4 14-4 18 2-6 0-12 2-16 6z" fill="#F08A2D"/>
    <ellipse cx="46" cy="52" rx="35" ry="25" fill="#F7A23B"/>
    <path d="M22 52c0 10 10 20 24 20-8-8-8-32 0-40-14 0-24 10-24 20z" fill="#FBC57C" opacity=".6"/>
    <path d="M52 34c-6 8-6 28 0 36M64 38c-4 6-4 20 0 26" fill="none" stroke="#E2831E" stroke-width="2" stroke-linecap="round"/>
    ${OEIL(28, 46, 4)}${TRAIT('M14 56c3 3 7 3 9 1', '#B96214', 1.8)}
    <ellipse cx="44" cy="70" rx="8" ry="4" fill="#F08A2D" transform="rotate(25 44 70)"/>`,
  autre: `
    <g style="fill:var(--cp-sauge)">
      <ellipse cx="50" cy="66" rx="19" ry="16"/>
      <ellipse cx="26" cy="46" rx="8.5" ry="11" transform="rotate(-20 26 46)"/><ellipse cx="42" cy="32" rx="8.5" ry="11.5" transform="rotate(-6 42 32)"/>
      <ellipse cx="58" cy="32" rx="8.5" ry="11.5" transform="rotate(6 58 32)"/><ellipse cx="74" cy="46" rx="8.5" ry="11" transform="rotate(20 74 46)"/>
    </g>`,
};

/** Icône de l'espèce (js/icons.js, commun.js) → illustration. */
const ICONE_VERS_ESPECE = { dog: 'chien', cat: 'chat', rabbit: 'lapin', bird: 'oiseau', turtle: 'tortue', fish: 'poisson', 'paw-print': 'autre' };

/** Clé d'illustration pour un identifiant d'espèce OU un nom d'icône ; '' si on n'en a pas (ex. l'icône « user » du profil). */
export function cleIllustration(espece) {
  const cle = ICONE_VERS_ESPECE[espece] ?? espece;
  return ILLUSTRATIONS[cle] ? cle : '';
}

/** SVG inline d'une espèce (décor : caché aux lecteurs d'écran). Chaîne vide si l'espèce n'a pas d'illustration. */
export function illustration(espece, { classe = '' } = {}) {
  const cle = cleIllustration(espece);
  if (!cle) return '';
  return `<svg class="cp-illu cp-illu--${cle}${classe ? ` ${classe}` : ''}" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">${ILLUSTRATIONS[cle]}</svg>`;
}
