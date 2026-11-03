// SEUL fichier qui lit et écrit les données.
//
// Aujourd'hui : tout est enregistré dans le navigateur (localStorage).
// Plus tard (comptes + base en ligne) : on réécrira ce fichier pour parler à un serveur,
// et les modules qui l'utilisent n'auront presque rien à changer.
//
// Forme des données :
//   { version, exemplesAjoutes, animaux: [], soins: [], pesees: [] }

import { uid } from './utils.js';

const CLE = 'carnetpatte.v1';
const VERSION = 1;
const COLLECTIONS = ['animaux', 'soins', 'pesees'];

let donnees = charger();

function vide() {
  return { version: VERSION, exemplesAjoutes: false, animaux: [], soins: [], pesees: [] };
}

function normaliser(obj) {
  const base = vide();
  for (const c of COLLECTIONS) base[c] = Array.isArray(obj?.[c]) ? obj[c] : [];
  base.exemplesAjoutes = Boolean(obj?.exemplesAjoutes);
  return base;
}

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? normaliser(JSON.parse(brut)) : vide();
  } catch {
    return vide();
  }
}

function sauver() {
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

// ----- Drapeau "les animaux d'exemple ont déjà été ajoutés" -----

export function exemplesDejaAjoutes() {
  return donnees.exemplesAjoutes;
}

export function marquerExemplesAjoutes() {
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
  donnees = normaliser(obj);
  donnees.exemplesAjoutes = true; // pas de ré-ajout d'exemples après une importation
  sauver();
}

export function toutEffacer() {
  donnees = vide();
  donnees.exemplesAjoutes = true;
  sauver();
}
