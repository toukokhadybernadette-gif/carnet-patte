// SEUL fichier qui lit et écrit les données.
//
// Aujourd'hui : tout est enregistré dans le navigateur (localStorage).
// Plus tard (comptes + base en ligne) : on réécrira ce fichier pour parler à un serveur,
// et les modules qui l'utilisent n'auront presque rien à changer.
//
// Forme des données :
//   { version, exemplesAjoutes, profil: { prenom }, animaux: [], soins: [], pesees: [] }
// `profil` est FACULTATIF : un export plus ancien, sans ce champ, s'importe normalement (le prénom reste vide).
//
// RÈGLE DE SÉCURITÉ : des données déjà enregistrées mais illisibles (JSON abîmé, mauvaise forme, version plus récente)
// ne sont JAMAIS remplacées. Le chargement garde alors le texte brut, en fait une copie de secours (autre clé),
// et bloque toute écriture tant que l'utilisateur n'a pas choisi (voir js/secours.js).

import { uid } from './utils.js';

const CLE = 'carnetpatte.v1';
const VERSION = 1;
const PRENOM_MAX = 40; // doit être déclaré AVANT charger() : elle s'exécute dès le chargement du fichier
const COLLECTIONS = ['animaux', 'soins', 'pesees'];
const CLE_SECOURS = `${CLE}.secours`;

// Non nul quand les données enregistrées n'ont pas pu être lues : { raison, brut, cleSecours }
let probleme = null;

let donnees = charger();

/** Profil lu dans un fichier ou dans le navigateur : toujours { prenom: texte }, quel que soit ce qui est enregistré. */
function profilValide(p) {
  const prenom = typeof p?.prenom === 'string' ? p.prenom.replace(/\s+/g, ' ').trim().slice(0, PRENOM_MAX) : '';
  return { prenom };
}

function vide() {
  return { version: VERSION, exemplesAjoutes: false, profil: profilValide(), animaux: [], soins: [], pesees: [] };
}

function normaliser(obj) {
  const base = vide();
  for (const c of COLLECTIONS) base[c] = Array.isArray(obj?.[c]) ? obj[c] : [];
  base.exemplesAjoutes = Boolean(obj?.exemplesAjoutes);
  base.profil = profilValide(obj?.profil);
  return base;
}

/** null si le texte est un jeu de données lisible ; sinon la raison : 'illisible' | 'invalide' | 'recente'. */
function diagnostiquer(brut) {
  let obj;
  try { obj = JSON.parse(brut); } catch { return 'illisible'; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'invalide';
  if (COLLECTIONS.some((c) => c in obj && !Array.isArray(obj[c]))) return 'invalide';
  if (typeof obj.version === 'number' && obj.version > VERSION) return 'recente'; // une version plus récente de l'appli l'a écrit
  return null;
}

/** Copie le texte brut dans une autre clé (une seule copie par contenu). Retourne la clé, ou null si l'espace manque. */
function copierSecours(brut) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(CLE_SECOURS) && localStorage.getItem(k) === brut) return k;
    }
    const cle = `${CLE_SECOURS}.${new Date().toISOString()}`;
    localStorage.setItem(cle, brut);
    return cle;
  } catch {
    return null;
  }
}

function charger() {
  let brut;
  try {
    brut = localStorage.getItem(CLE);
  } catch {
    return vide(); // stockage du navigateur inaccessible : rien à protéger, rien à lire
  }
  if (!brut) return vide(); // première visite
  const raison = diagnostiquer(brut);
  if (raison) {
    probleme = { raison, brut, cleSecours: copierSecours(brut) };
    return vide(); // en mémoire seulement : sauver() n'écrit rien tant que `probleme` est actif
  }
  return normaliser(JSON.parse(brut));
}

function sauver() {
  if (probleme) return; // données illisibles : on n'écrit RIEN par-dessus
  try {
    localStorage.setItem(CLE, JSON.stringify(donnees));
  } catch {
    alert("Impossible d'enregistrer : l'espace du navigateur est plein ou bloqué. Essayez avec des photos plus petites ou faites un export.");
  }
  // Prévient l'appli (ex. pour mettre à jour la pastille des rappels dans le menu)
  window.dispatchEvent(new Event('donnees-modifiees'));
}

// ----- Lecture / écriture d'éléments -----

export function lister(collection) {
  return [...donnees[collection]];
}

export function trouver(collection, id) {
  return donnees[collection].find((e) => e.id === id) ?? null;
}

export function ajouter(collection, element) {
  const nouveau = { id: uid(), ...element };
  donnees[collection].push(nouveau);
  sauver();
  return nouveau;
}

export function modifier(collection, id, changements) {
  const element = trouver(collection, id);
  if (!element) return null;
  Object.assign(element, changements);
  sauver();
  return element;
}

export function supprimer(collection, id) {
  donnees[collection] = donnees[collection].filter((e) => e.id !== id);
  // Supprimer un animal supprime aussi ses soins et ses pesées
  if (collection === 'animaux') {
    donnees.soins = donnees.soins.filter((s) => s.animalId !== id);
    donnees.pesees = donnees.pesees.filter((p) => p.animalId !== id);
  }
  sauver();
}

// ----- Profil (facultatif) -----

/** { prenom } — le prénom est une chaîne vide tant que l'utilisateur n'en a pas saisi. */
export function lireProfil() {
  return { ...donnees.profil };
}

export function modifierProfil(changements) {
  donnees.profil = profilValide({ ...donnees.profil, ...changements });
  sauver();
  return lireProfil();
}

// ----- Drapeau "les animaux d'exemple ont déjà été ajoutés" -----

export function exemplesDejaAjoutes() {
  return probleme ? true : donnees.exemplesAjoutes; // jamais d'exemples par-dessus des données qu'on n'a pas pu lire
}

export function marquerExemplesAjoutes() {
  donnees.exemplesAjoutes = true;
  sauver();
}

// ----- Données illisibles (voir js/secours.js) -----

/** null si tout va bien ; sinon { raison, cleSecours } (cleSecours est null si la copie de secours a échoué). */
export function etatDonnees() {
  return probleme ? { raison: probleme.raison, cleSecours: probleme.cleSecours } : null;
}

/** Le texte exact enregistré dans le navigateur, tel qu'il a été trouvé (pour le télécharger). */
export function donneesBrutes() {
  return probleme?.brut ?? '';
}

/** Choix de l'utilisateur : repartir de zéro. La copie de secours reste dans le navigateur. */
export function repartirDeZero() {
  probleme = null;
  donnees = vide();
  donnees.exemplesAjoutes = true;
  sauver();
}

// ----- Sauvegarde : export / import / effacement -----

export function exporter() {
  return JSON.stringify({ ...donnees, exporteLe: new Date().toISOString() }, null, 2);
}

/** Remplace toutes les données par celles d'un fichier d'export. Lève une erreur si invalide. */
export function importer(texte) {
  let obj;
  try {
    obj = JSON.parse(texte);
  } catch {
    throw new Error("Ce fichier n'est pas un export valide (JSON illisible).");
  }
  const valide = obj && typeof obj === 'object' && COLLECTIONS.every((c) => Array.isArray(obj[c]));
  if (!valide) throw new Error("Ce fichier ne ressemble pas à un export de Carnet Patte.");
  probleme = null; // l'utilisateur a choisi un fichier valide : il remplace les données illisibles (une copie de secours existe déjà)
  donnees = normaliser(obj);
  donnees.exemplesAjoutes = true; // pas de ré-ajout d'exemples après une importation
  sauver();
}

export function toutEffacer() {
  probleme = null;
  donnees = vide();
  donnees.exemplesAjoutes = true;
  sauver();
}
