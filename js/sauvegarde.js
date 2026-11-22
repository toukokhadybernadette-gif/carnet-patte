// Sauvegarde complète : les données (localStorage, js/storage.js) + les documents (IndexedDB, js/documents-db.js) dans UN fichier JSON.
// Les fichiers d'export plus anciens, sans documents, s'importent normalement.

import * as storage from './storage.js';
import * as docs from './documents-db.js';

/** Le texte du fichier d'export : données + documents (en texte base64). */
export async function exporterTout() {
  const objet = JSON.parse(storage.exporter());
  objet.documents = await docs.exporterDocuments();
  return JSON.stringify(objet);
}

/**
 * Remplace TOUT par le contenu d'un fichier d'export. Lève une erreur claire si le fichier est invalide
 * (dans ce cas rien n'est modifié : les documents ne sont touchés qu'après la validation des données).
 * Retourne { documents, ignores }.
 */
export async function importerTout(texte) {
  storage.importer(texte); // valide et remplace les données ; lève une erreur sinon
  const objet = JSON.parse(texte);
  const animaux = new Set(storage.lister('animaux').map((a) => a.id));
  const { gardes, ignores } = await docs.importerDocuments(objet.documents, animaux);
  return { documents: gardes, ignores };
}

/** Taille approximative de la sauvegarde (en octets), sans la fabriquer : données + documents (le base64 pèse un tiers de plus). */
export async function estimerSauvegarde() {
  const { octets, nombre } = await docs.espaceDocuments();
  return { octets: new Blob([storage.exporter()]).size + Math.ceil(octets * 4 / 3), documents: nombre, octetsDocuments: octets };
}

/** Efface les données ET les documents, et attend la fin (storage.toutEffacer() lance déjà l'effacement des documents). */
export async function toutEffacerTout() {
  storage.toutEffacer();
  await docs.toutEffacerDocuments();
}
