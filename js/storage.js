// SEUL fichier qui lit et écrit les données.
//
// Aujourd'hui : tout est enregistré dans le navigateur (localStorage).
// Plus tard (comptes + base en ligne) : on réécrira ce fichier pour parler à un serveur,
// et les modules qui l'utilisent n'auront presque rien à changer.
//
// Forme des données :
//   { version, exemplesAjoutes, profil: { prenom }, animaux: [], soins: [], pesees: [], oeufs: [], stocks: [], fichesGarde: { [idAnimal]: { … } } }
// `fichesGarde` est FACULTATIF aussi (un export plus ancien, sans ce champ, s'importe normalement).
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
// Collections FACULTATIVES (ferme / basse-cour) : un export plus ancien, qui n'en a pas, s'importe normalement
const COLLECTIONS_FERME = ['oeufs', 'stocks'];
const CLE_SECOURS = `${CLE}.secours`;
// Champs d'une fiche de garde (tous facultatifs, du texte) ; voir modules/animaux/garde.js
// Les champs de texte déjà saisis gardent leur nom : une fiche enregistrée avant les nouveautés s'ouvre à l'identique (rien à migrer, rien perdu).
// Nouveautés : aime, nePasFaire (habitudes), puce, tatouage (identification), gardeDu, gardeAu (dates de garde, AAAA-MM-JJ).
export const CHAMPS_GARDE = ['aliment', 'quantite', 'horaires', 'interdits', 'soinsGarde', 'promenades', 'litiere', 'sommeil', 'jouets', 'peurs', 'regles',
  'proprietaireNom', 'proprietaireTel', 'secoursNom', 'secoursTel', 'vetoNom', 'vetoTel', 'infos',
  'aime', 'nePasFaire', 'puce', 'tatouage', 'gardeDu', 'gardeAu'];
const CHAMPS_DATE_GARDE = ['gardeDu', 'gardeAu'];
export const TACHES_SUIVI = ['repas', 'eau', 'promenade', 'medicament']; // la petite liste du jour cochable
export const TRAITEMENTS_MAX = 8;
const GARDE_MAX = 2000; // caractères par champ
const TRAITEMENT_MAX = 120; // caractères par case d'un traitement (médicament, dose, horaires)
const SUIVI_JOURS_MAX = 45; // on ne garde que les derniers jours cochés
const estDate = (t) => /^\d{4}-\d{2}-\d{2}$/.test(t ?? '') && !Number.isNaN(Date.parse(t));

// Non nul quand les données enregistrées n'ont pas pu être lues : { raison, brut, cleSecours }
let probleme = null;

let donnees = charger();

/** Profil lu dans un fichier ou dans le navigateur : toujours { prenom: texte }, quel que soit ce qui est enregistré. */
function profilValide(p) {
  const prenom = typeof p?.prenom === 'string' ? p.prenom.replace(/\s+/g, ' ').trim().slice(0, PRENOM_MAX) : '';
  return { prenom };
}

/** Traitements en cours : [{ nom, dose, horaires }], les lignes entièrement vides sont ignorées. */
function traitementsValides(liste) {
  if (!Array.isArray(liste)) return [];
  const net = (t) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, TRAITEMENT_MAX) : '');
  return liste.map((t) => ({ nom: net(t?.nom), dose: net(t?.dose), horaires: net(t?.horaires) })).filter((t) => t.nom || t.dose || t.horaires).slice(0, TRAITEMENTS_MAX);
}

/** Suivi du jour : { 'AAAA-MM-JJ': ['repas', 'eau', …] }, seulement les jours et les tâches connus ; les plus anciens jours sont oubliés. */
function suiviValide(suivi) {
  const sortie = {};
  if (!suivi || typeof suivi !== 'object' || Array.isArray(suivi)) return sortie;
  for (const jour of Object.keys(suivi).filter(estDate).sort().slice(-SUIVI_JOURS_MAX)) {
    const taches = TACHES_SUIVI.filter((t) => Array.isArray(suivi[jour]) && suivi[jour].includes(t));
    if (taches.length) sortie[jour] = taches;
  }
  return sortie;
}

/** Fiches de garde lues dans un fichier : { idAnimal: { champ: texte, traitements: [...], suivi: {...} } }, seuls les champs connus et non vides sont gardés. */
function fichesValides(f) {
  const sortie = {};
  if (!f || typeof f !== 'object' || Array.isArray(f)) return sortie;
  for (const [id, fiche] of Object.entries(f)) {
    if (!fiche || typeof fiche !== 'object') continue;
    const propre = {};
    for (const c of CHAMPS_GARDE) {
      if (typeof fiche[c] !== 'string' || !fiche[c].trim()) continue;
      if (CHAMPS_DATE_GARDE.includes(c) && !estDate(fiche[c].trim())) continue;
      propre[c] = fiche[c].trim().slice(0, GARDE_MAX);
    }
    const traitements = traitementsValides(fiche.traitements);
    if (traitements.length) propre.traitements = traitements;
    const suivi = suiviValide(fiche.suivi);
    if (Object.keys(suivi).length) propre.suivi = suivi;
    if (Object.keys(propre).length) sortie[id] = propre;
  }
  return sortie;
}

function vide() {
  return { version: VERSION, exemplesAjoutes: false, profil: profilValide(), animaux: [], soins: [], pesees: [], oeufs: [], stocks: [], fichesGarde: {} };
}

function normaliser(obj) {
  const base = vide();
  for (const c of [...COLLECTIONS, ...COLLECTIONS_FERME]) base[c] = Array.isArray(obj?.[c]) ? obj[c] : [];
  base.exemplesAjoutes = Boolean(obj?.exemplesAjoutes);
  base.profil = profilValide(obj?.profil);
  base.fichesGarde = fichesValides(obj?.fichesGarde);
  for (const id of Object.keys(base.fichesGarde)) if (!base.animaux.some((x) => x?.id === id)) delete base.fichesGarde[id]; // fiche d'un animal absent du fichier : ignorée
  return base;
}

/** null si le texte est un jeu de données lisible ; sinon la raison : 'illisible' | 'invalide' | 'recente'. */
function diagnostiquer(brut) {
  let obj;
  try { obj = JSON.parse(brut); } catch { return 'illisible'; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'invalide';
  if ([...COLLECTIONS, ...COLLECTIONS_FERME].some((c) => c in obj && !Array.isArray(obj[c]))) return 'invalide';
  if ('fichesGarde' in obj && (!obj.fichesGarde || typeof obj.fichesGarde !== 'object' || Array.isArray(obj.fichesGarde))) return 'invalide';
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
    donnees.oeufs = donnees.oeufs.filter((o) => o.animalId !== id);
    donnees.stocks = donnees.stocks.filter((s) => s.animalId !== id);
    delete donnees.fichesGarde[id];
    window.dispatchEvent(new CustomEvent('animal-supprime', { detail: { id } })); // ses documents (js/documents-db.js) partent aussi
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

// ----- Fiche de garde (pet-sitters) : une par animal, tous les champs facultatifs -----

/** La fiche d'un animal : tous les champs de texte (vides s'ils ne sont pas remplis), `traitements` (liste) et `suivi` (jours cochés). */
export function lireFicheGarde(animalId) {
  const source = donnees.fichesGarde[animalId];
  const fiche = {};
  for (const c of CHAMPS_GARDE) fiche[c] = source?.[c] ?? '';
  fiche.traitements = (source?.traitements ?? []).map((t) => ({ ...t }));
  fiche.suivi = Object.fromEntries(Object.entries(source?.suivi ?? {}).map(([j, t]) => [j, [...t]]));
  return fiche;
}

/** Enregistre la fiche (remplace l'ancienne). Une fiche entièrement vide est supprimée. */
export function enregistrerFicheGarde(animalId, champs) {
  const propre = fichesValides({ [animalId]: champs })[animalId];
  if (propre) donnees.fichesGarde[animalId] = propre; else delete donnees.fichesGarde[animalId];
  sauver();
  return lireFicheGarde(animalId);
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
  window.dispatchEvent(new Event('donnees-remplacees')); // la synchronisation cloud (js/synchro.js) se met en pause : un import ne supprime rien dans le cloud
}

export function toutEffacer() {
  try { localStorage.removeItem('carnetpatte.carteCache'); } catch { /* stockage bloqué */ } // lieux gardés par la Carte Patte
  probleme = null;
  donnees = vide();
  donnees.exemplesAjoutes = true;
  sauver();
  window.dispatchEvent(new Event('donnees-effacees')); // les documents (js/documents-db.js) sont effacés aussi
  window.dispatchEvent(new Event('donnees-remplacees')); // idem : la synchronisation cloud se met en pause
}

// ----- Synchronisation cloud (js/synchro.js) : lecture d'ensemble et application des changements venus d'un autre appareil -----

/** Copie de tout ce qui peut être synchronisé : { animaux, soins, pesees, oeufs, stocks, fichesGarde, profil }. */
export function instantane() {
  const copie = {};
  for (const c of [...COLLECTIONS, ...COLLECTIONS_FERME]) copie[c] = donnees[c].map((e) => ({ ...e }));
  copie.fichesGarde = Object.fromEntries(Object.entries(donnees.fichesGarde).map(([id, f]) => [id, { ...f }]));
  copie.profil = { ...donnees.profil };
  return copie;
}

/**
 * Applique des changements venus du cloud, SANS cascade (chaque élément arrive avec sa propre stèle) et sans effacer le reste.
 * `operations` : [{ collection, id, donnees }] pour ajouter ou remplacer, [{ collection, id, supprimer: true }] pour retirer.
 * 'profil' : seul le prénom ; 'fichesGarde' : la fiche de l'animal `id`. Un élément qui n'a pas la forme attendue est ignoré.
 */
export function appliquerDistant(operations) {
  if (probleme) return 0; // jamais d'écriture par-dessus des données illisibles
  let n = 0;
  for (const op of operations) {
    const { collection: c, id } = op;
    if (c === 'profil') { if (!op.supprimer) { donnees.profil = profilValide(op.donnees); n++; } continue; }
    if (c === 'fichesGarde') {
      const propre = op.supprimer ? null : fichesValides({ [id]: op.donnees })[id];
      if (propre) donnees.fichesGarde[id] = propre; else delete donnees.fichesGarde[id];
      n++; continue;
    }
    if (![...COLLECTIONS, ...COLLECTIONS_FERME].includes(c) || typeof id !== 'string') continue;
    donnees[c] = donnees[c].filter((e) => e.id !== id);
    if (!op.supprimer && op.donnees && typeof op.donnees === 'object') donnees[c].push({ ...op.donnees, id });
    n++;
  }
  if (n) { donnees.exemplesAjoutes = true; sauver(); }
  return n;
}
