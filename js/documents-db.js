// Documents des animaux (photos, PDF : carnet de vaccination, ordonnance, analyse…), gardés dans IndexedDB.
// Pourquoi pas localStorage : il est limité à environ 5 Mo ; IndexedDB accepte des fichiers entiers.
// Tout reste sur l'appareil, rien n'est envoyé sur un serveur, et cela marche hors connexion.
//
// Un document : { id, animalId, titre, date: 'AAAA-MM-JJ', type, mime, nom, taille, blob, ajouteLe }.
// Les photos sont réduites avant d'être gardées (reduireImage) ; les PDF sont gardés tels quels.

import { uid } from './utils.js';

const NOM_BASE = 'carnetpatte-documents';
const STORE = 'documents';
export const TAILLE_MAX_PDF = 15 * 1024 * 1024; // octets
export const SEUIL_GROS_EXPORT = 25 * 1024 * 1024; // au-delà, on prévient que la sauvegarde est volumineuse

export const TYPES_DOCUMENT = [
  { id: 'vaccination', nom: 'Carnet de vaccination' },
  { id: 'ordonnance', nom: 'Ordonnance' },
  { id: 'analyse', nom: 'Analyse' },
  { id: 'identification', nom: 'Identification (puce, passeport)' },
  { id: 'autre', nom: 'Autre document' },
];
export const nomTypeDocument = (id) => (TYPES_DOCUMENT.find((t) => t.id === id) ?? TYPES_DOCUMENT[TYPES_DOCUMENT.length - 1]).nom;
const MIMES_ACCEPTES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

/** Prévient la synchronisation cloud (js/synchro.js) qu'un document a changé sur cet appareil. */
const signaler = () => { try { dispatchEvent(new Event('documents-modifies')); } catch { /* pas grave */ } };

let promesseBase = null;
function base() {
  promesseBase ??= new Promise((ok, ko) => {
    if (!('indexedDB' in globalThis)) { ko(new Error("Ce navigateur ne permet pas d'enregistrer des documents.")); return; }
    const requete = indexedDB.open(NOM_BASE, 1);
    requete.onupgradeneeded = () => {
      const magasin = requete.result.createObjectStore(STORE, { keyPath: 'id' });
      magasin.createIndex('animalId', 'animalId');
    };
    requete.onsuccess = () => ok(requete.result);
    requete.onerror = () => ko(new Error("Les documents n'ont pas pu être ouverts (stockage bloqué ?)."));
  }).catch((e) => { promesseBase = null; throw e; });
  return promesseBase;
}

/** Exécute une opération dans une transaction et attend sa fin. `faire(magasin)` retourne la requête dont on veut le résultat. */
async function transaction(mode, faire) {
  const db = await base();
  return new Promise((ok, ko) => {
    const t = db.transaction(STORE, mode);
    let resultat;
    const r = faire(t.objectStore(STORE));
    if (r) r.onsuccess = () => { resultat = r.result; };
    t.oncomplete = () => ok(resultat);
    t.onerror = () => ko(t.error ?? new Error('Erreur de stockage'));
    t.onabort = () => ko(t.error ?? new Error("L'espace de stockage est peut-être plein."));
  });
}

/** Documents d'un animal, du plus récent au plus ancien (sans exposer de gros calculs : le blob reste dans l'objet). */
export async function listerDocuments(animalId) {
  const tous = await transaction('readonly', (m) => (animalId ? m.index('animalId').getAll(animalId) : m.getAll()));
  return tous.sort((a, b) => b.date.localeCompare(a.date) || b.ajouteLe.localeCompare(a.ajouteLe));
}

export const lireDocument = (id) => transaction('readonly', (m) => m.get(id));

/** Enregistre un document. `blob` : le fichier déjà prêt (photo réduite ou PDF). */
export async function ajouterDocument({ animalId, titre, date, type, blob, nom }) {
  const doc = { id: uid(), animalId, titre, date, type, mime: blob.type, nom: nom || '', taille: blob.size, blob, ajouteLe: new Date().toISOString() };
  await transaction('readwrite', (m) => m.put(doc));
  demanderStockageDurable();
  signaler();
  return doc;
}

/** Enregistre un document tel quel (venu du cloud, avec son identifiant) : sans événement, l'appelant sait ce qu'il fait. */
export async function enregistrerDocument(doc) {
  await transaction('readwrite', (m) => m.put(doc));
  demanderStockageDurable();
  return doc;
}

/** Change le titre, la date ou le type d'un document (le fichier lui-même ne change pas). */
export async function modifierDocument(id, { titre, date, type }) {
  const doc = await lireDocument(id);
  if (!doc) return null;
  const nouveau = { ...doc, titre: String(titre).trim().slice(0, 120) || doc.titre, date: /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date : doc.date, type: TYPES_DOCUMENT.some((t) => t.id === type) ? type : doc.type };
  await transaction('readwrite', (m) => m.put(nouveau));
  signaler();
  return nouveau;
}

export const supprimerDocument = (id) => transaction('readwrite', (m) => m.delete(id)).then((r) => { signaler(); return r; });

export async function supprimerDocumentsAnimal(animalId) {
  const db = await base();
  await new Promise((ok, ko) => {
    const t = db.transaction(STORE, 'readwrite');
    const curseur = t.objectStore(STORE).index('animalId').openKeyCursor(IDBKeyRange.only(animalId));
    curseur.onsuccess = () => { const c = curseur.result; if (c) { t.objectStore(STORE).delete(c.primaryKey); c.continue(); } };
    t.oncomplete = ok; t.onerror = () => ko(t.error); t.onabort = () => ko(t.error);
  });
  signaler();
}

export const toutEffacerDocuments = () => transaction('readwrite', (m) => m.clear());

/** Espace pris par les documents : { octets, nombre } (somme des tailles gardées). */
export async function espaceDocuments() {
  const tous = await transaction('readonly', (m) => m.getAll());
  return { octets: tous.reduce((n, d) => n + (d.taille ?? 0), 0), nombre: tous.length };
}

/** Espace utilisé et disponible sur l'appareil, selon le navigateur ({ usage, quota } ou null). */
export async function espaceAppareil() {
  try { const { usage, quota } = await navigator.storage.estimate(); return usage != null && quota ? { usage, quota } : null; } catch { return null; }
}

// Demande au navigateur de ne pas effacer ces documents quand l'appareil manque de place (iPhone compris, quand c'est permis)
function demanderStockageDurable() { try { navigator.storage?.persist?.(); } catch { /* pas grave */ } }

// ----- Photos : réduites automatiquement -----

/**
 * Réduit une photo (côté le plus long : 1600 px au plus, JPEG qualité 0,8) et retourne un Blob.
 * Une petite image déjà légère est gardée telle quelle. Lève une erreur claire si l'image est illisible.
 */
export async function reduireImage(fichier, { max = 1600, qualite = 0.8 } = {}) {
  let image;
  try {
    image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    throw new Error("Cette image n'a pas pu être lue. Essayez avec une photo JPEG ou PNG.");
  }
  const echelle = Math.min(1, max / Math.max(image.width, image.height));
  if (echelle === 1 && fichier.size <= 1.5 * 1024 * 1024 && MIMES_ACCEPTES.has(fichier.type)) { image.close?.(); return fichier; }
  const toile = document.createElement('canvas');
  toile.width = Math.max(1, Math.round(image.width * echelle));
  toile.height = Math.max(1, Math.round(image.height * echelle));
  const c = toile.getContext('2d');
  c.fillStyle = '#fff'; // le JPEG n'a pas de transparence
  c.fillRect(0, 0, toile.width, toile.height);
  c.drawImage(image, 0, 0, toile.width, toile.height);
  image.close?.();
  const blob = await new Promise((ok) => toile.toBlob(ok, 'image/jpeg', qualite));
  if (!blob) throw new Error("Cette image n'a pas pu être réduite.");
  return blob;
}

/** Prépare un fichier choisi : photo réduite ou PDF vérifié. Lève une erreur claire sinon. */
export async function preparerFichier(fichier) {
  if (fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name)) {
    if (fichier.size > TAILLE_MAX_PDF) throw new Error(`Ce PDF est trop lourd (${(fichier.size / 1048576).toFixed(1).replace('.', ',')} Mo). La limite est de 15 Mo.`);
    return fichier.type === 'application/pdf' ? fichier : new Blob([fichier], { type: 'application/pdf' });
  }
  if (fichier.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(fichier.name)) return reduireImage(fichier);
  throw new Error('Choisissez une photo ou un fichier PDF.');
}

// ----- Sauvegarde : export et import des documents (en texte, pour tenir dans le fichier JSON) -----

const versBase64 = (blob) => new Promise((ok, ko) => {
  const lecteur = new FileReader();
  lecteur.onload = () => ok(String(lecteur.result).split(',')[1] ?? '');
  lecteur.onerror = () => ko(lecteur.error);
  lecteur.readAsDataURL(blob);
});
function depuisBase64(texte, mime) {
  const binaire = atob(texte);
  const octetsTab = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octetsTab[i] = binaire.charCodeAt(i);
  return new Blob([octetsTab], { type: mime });
}

export async function exporterDocuments() {
  const tous = await listerDocuments();
  const sortie = [];
  for (const d of tous) sortie.push({ id: d.id, animalId: d.animalId, titre: d.titre, date: d.date, type: d.type, mime: d.mime, nom: d.nom, taille: d.taille, ajouteLe: d.ajouteLe, donnees: await versBase64(d.blob) });
  return sortie;
}

/** Remplace tous les documents par ceux d'un export. `animauxValides` : identifiants des animaux qui existent (les autres documents sont ignorés). */
export async function importerDocuments(liste, animauxValides) {
  const garder = (Array.isArray(liste) ? liste : []).filter((d) => d && typeof d.id === 'string' && typeof d.donnees === 'string' && MIMES_ACCEPTES.has(d.mime)
    && typeof d.animalId === 'string' && animauxValides.has(d.animalId) && /^\d{4}-\d{2}-\d{2}$/.test(d.date ?? ''));
  const docs = [];
  for (const d of garder) {
    let blob;
    try { blob = depuisBase64(d.donnees, d.mime); } catch { continue; } // données abîmées : ce document est ignoré, pas tout le fichier
    docs.push({ id: d.id, animalId: d.animalId, titre: String(d.titre ?? '').slice(0, 120) || 'Document', date: d.date, type: TYPES_DOCUMENT.some((t) => t.id === d.type) ? d.type : 'autre',
      mime: d.mime, nom: String(d.nom ?? '').slice(0, 200), taille: blob.size, blob, ajouteLe: typeof d.ajouteLe === 'string' ? d.ajouteLe : new Date().toISOString() });
  }
  await transaction('readwrite', (m) => { m.clear(); docs.forEach((d) => m.put(d)); });
  return { gardes: docs.length, ignores: (Array.isArray(liste) ? liste.length : 0) - docs.length };
}

// Quand un animal est supprimé, ses documents le sont aussi ; « Tout effacer » vide tout (voir js/storage.js)
addEventListener('animal-supprime', (e) => { supprimerDocumentsAnimal(e.detail.id).catch(() => {}); });
addEventListener('donnees-effacees', () => { toutEffacerDocuments().catch(() => {}); });
