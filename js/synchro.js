// Sauvegarde cloud et synchronisation entre appareils (réservées au Premium). Tables, règles et quota : supabase/etape3.sql.
//
// L'appli reste 100 % utilisable hors ligne : tout s'écrit d'abord SUR L'APPAREIL (js/storage.js, js/documents-db.js), comme avant.
// Ce fichier ne fait que RECOPIER ce qui a changé, quand c'est possible, et récupérer ce que les autres appareils ont changé.
// Il n'est chargé que si la sauvegarde cloud a été activée sur cet appareil (voir js/app.js) : sans compte Premium, rien n'est téléchargé ni envoyé.
//
// Principes :
//  * « La dernière modification gagne », ÉLÉMENT par élément (un animal, un soin, une pesée, une fiche de garde, un document…) : modifier deux choses
//    différentes sur deux appareils ne perd rien. Le serveur ignore lui-même toute écriture plus ancienne que celle qu'il détient.
//  * Pour savoir « ce qui a changé depuis », on se fie à l'heure de réception posée PAR LE SERVEUR (recu_le), jamais à l'horloge de l'appareil.
//    L'heure de l'appareil (modifie_le) ne sert qu'à départager deux modifications du même élément.
//  * Une suppression laisse une « stèle » (supprime = true) pour que les autres appareils suppriment aussi ; le serveur les purge après 90 jours.
//  * Les photos d'animaux ne sont PAS dans les données (base64) : ce sont des fichiers du bucket privé, comme les documents.
//  * Jamais d'effacement sans confirmation : activer la synchro sur un appareil FUSIONNE (ajoute) ; effacer ou importer sur cet appareil la met en pause.

import * as compte from './compte.js';
import * as storage from './storage.js';
import * as docs from './documents-db.js';

const CLE = 'carnetpatte.synchro';
const MARGE_MS = 10_000; // on redemande les 10 dernières secondes : une écriture validée en retard n'est jamais ratée (les doublons sont sans effet)
const DELAI_MS = 3000; // regroupe les modifications rapprochées en un seul envoi
const PERIODE_MS = 60_000; // consultation des autres appareils, tant que l'appli est ouverte
const LOT = 200;
const BUCKET = 'documents';
export const QUOTA_OCTETS = 100 * 1024 * 1024;
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// ----- Réglage gardé sur l'appareil : { userId, actif, curE, curD, meta, refuse, suspendu } -----

const lireReglage = () => { try { return JSON.parse(localStorage.getItem(CLE)) ?? {}; } catch { return {}; } };
let reglage = lireReglage();
function ecrireReglage() { try { localStorage.setItem(CLE, JSON.stringify(reglage)); } catch { /* stockage bloqué : la synchro repartira de zéro à la prochaine ouverture */ } }
const meta = () => (reglage.meta ??= {});

/** { actif, userId, suspendu, refuse } : la sauvegarde cloud est-elle activée sur cet appareil ? */
export const reglages = () => ({ actif: !!reglage.actif, userId: reglage.userId ?? null, suspendu: !!reglage.suspendu, refuse: !!reglage.refuse });

// ----- Outils -----

/** Empreinte courte et stable d'un texte (pour savoir si un élément a changé, sans garder son contenu). */
function empreinte(texte) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i++) { const c = texte.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((c) => [c, x[c]])) : x));
const sain = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
const refPhoto = (animalId, dataUrl) => `ph-${sain(animalId)}-${empreinte(dataUrl)}`;
const typeDataUrl = (d) => /^data:([a-z/+-]+);base64,/.exec(d)?.[1] ?? '';

function dataUrlVersBlob(dataUrl) {
  const [tete, corps] = dataUrl.split(',');
  const binaire = atob(corps);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type: /^data:([^;]+)/.exec(tete)?.[1] ?? 'image/jpeg' });
}
const blobVersDataUrl = (blob) => new Promise((ok, ko) => { const l = new FileReader(); l.onload = () => ok(String(l.result)); l.onerror = () => ko(l.error); l.readAsDataURL(blob); });

// ----- État affiché (indicateur discret) -----

const LIBELLES = { ok: 'Sauvegardé', attente: 'En attente (hors ligne)', erreur: 'Erreur', encours: 'Sauvegarde…', quota: 'Espace cloud plein', gratuit: 'Formule gratuite', suspendu: 'Synchronisation en pause', inactif: '' };
let etatCourant = { etat: 'inactif', message: '' };
export const etat = () => etatCourant;
function changerEtat(nom, message = '') {
  etatCourant = { etat: nom, message };
  window.dispatchEvent(new CustomEvent('synchro-etat', { detail: etatCourant }));
  const ind = document.getElementById('synchro-indicateur');
  if (ind) {
    ind.dataset.etat = nom; ind.hidden = nom === 'inactif';
    ind.setAttribute('aria-label', `Sauvegarde cloud : ${LIBELLES[nom]}${message ? ` (${message})` : ''}`);
    ind.title = message || LIBELLES[nom];
    ind.querySelector('[data-libelle]').textContent = LIBELLES[nom];
  }
}
export const libelleEtat = (nom) => LIBELLES[nom] ?? '';

function monterIndicateur() {
  if (document.getElementById('synchro-indicateur')) return;
  const zone = document.querySelector('.app-haut__actions') ?? document.getElementById('barre-haut');
  if (!zone) return;
  zone.insertAdjacentHTML('afterbegin', '<a class="sy-etat" id="synchro-indicateur" href="#/compte" role="status" hidden data-etat="inactif"><span class="sy-etat__point" aria-hidden="true"></span><span class="sy-etat__texte" data-libelle></span></a>');
}

// ----- Erreurs -----

const horsLigne = (e) => !navigator.onLine || compte.estHorsLigne(e);
const contient = (e, re) => re.test(`${e?.message ?? ''} ${e?.code ?? ''} ${e?.error ?? ''} ${e?.hint ?? ''}`);
class ErreurQuota extends Error { constructor() { super('quota_depasse'); this.quota = true; } }
function verifier(error) {
  if (!error) return;
  if (contient(error, /quota_depasse|limite_documents|exceeded the maximum|Payload too large|413/i)) throw new ErreurQuota();
  throw error;
}

// ----- Ce qui est synchronisé : un instantané des données de l'appareil -----

/** Map « collection/id » → contenu. Les animaux d'exemple et ce qui les concerne ne sont jamais envoyés. Les photos deviennent des références. */
function lireInstantane() {
  const s = storage.instantane();
  const elements = new Map();
  const photos = new Map(); // référence → { animalId, dataUrl }
  const exemples = new Set(s.animaux.filter((a) => a.exemple).map((a) => a.id));
  for (const c of ['animaux', 'soins', 'pesees', 'oeufs', 'stocks']) {
    for (const e of s[c]) {
      if (typeof e?.id !== 'string') continue;
      if (c === 'animaux' ? e.exemple : exemples.has(e.animalId)) continue;
      if (c !== 'animaux') { elements.set(`${c}/${e.id}`, e); continue; }
      const { photo, photoRef: _ignore, ...reste } = e;
      if (typeof photo === 'string' && IMAGES.has(typeDataUrl(photo))) {
        const ref = refPhoto(e.id, photo);
        reste.photoRef = ref;
        photos.set(ref, { animalId: e.id, dataUrl: photo });
      }
      elements.set(`animaux/${e.id}`, reste);
    }
  }
  for (const [id, f] of Object.entries(s.fichesGarde)) if (!exemples.has(id)) elements.set(`fichesGarde/${id}`, f);
  if (s.profil.prenom || meta()['profil/profil']) elements.set('profil/profil', s.profil);
  return { elements, photos };
}

/** Compare l'appareil à ce qui est déjà noté : marque « à envoyer » ce qui est nouveau, modifié ou supprimé. */
function releverChangements(maintenant = Date.now()) {
  const m = meta();
  const { elements, photos } = lireInstantane();
  for (const [cle, d] of elements) {
    const h = empreinte(stable(d));
    const n = m[cle];
    if (!n || n.s || n.h !== h) m[cle] = { h, m: maintenant, e: 0 };
  }
  for (const cle of Object.keys(m)) {
    if (cle.startsWith('doc/') || cle.startsWith('ph/')) continue;
    if (!elements.has(cle) && !m[cle].s) m[cle] = { h: '', m: maintenant, e: 0, s: 1 };
  }
  for (const ref of photos.keys()) { const cle = `ph/${ref}`; if (!m[cle] || m[cle].s) m[cle] = { m: maintenant, e: 0, f: 0, u: 1 }; } // u : fichier envoyé D'ICI
  // Seules les photos envoyées d'ici, et qui ne servent plus à aucun animal ici, sont retirées du cloud : jamais celle qu'un autre appareil utilise peut-être
  for (const cle of Object.keys(m)) if (cle.startsWith('ph/') && m[cle].u && !photos.has(cle.slice(3)) && !m[cle].s) m[cle] = { ...m[cle], s: 1, m: maintenant, e: 0 };
  for (const cle of Object.keys(m)) if (m[cle].s && m[cle].e && maintenant - m[cle].m > 100 * 86_400_000) delete m[cle]; // vieilles stèles déjà purgées par le serveur
  return { elements, photos };
}

const empreinteDoc = (d) => empreinte(stable({ a: d.animalId, t: d.titre, d: d.date, y: d.type, z: d.taille, n: d.nom, m: d.mime }));
async function releverDocuments(maintenant = Date.now()) {
  const m = meta();
  const locaux = await docs.listerDocuments();
  const ids = new Set();
  for (const d of locaux) {
    const cle = `doc/${d.id}`; ids.add(cle);
    const h = empreinteDoc(d);
    if (!m[cle]) m[cle] = { h, m: maintenant, e: 0, f: 0 };
    else if (m[cle].s || m[cle].h !== h) m[cle] = { ...m[cle], s: 0, h, m: maintenant, e: 0 };
  }
  for (const cle of Object.keys(m)) if (cle.startsWith('doc/') && !ids.has(cle) && !m[cle].s) m[cle] = { ...m[cle], s: 1, m: maintenant, e: 0 };
  return locaux;
}

const nbAEnvoyer = () => Object.values(meta()).filter((x) => !x.e).length;

// ----- Recevoir -----

async function tirer(c, u) {
  const m = meta();
  // 1. Éléments (animaux, soins, pesées, fiches de garde, prénom…)
  let depuis = reglage.curE ? new Date(Date.parse(reglage.curE) - MARGE_MS).toISOString() : null;
  for (;;) {
    let q = c.from('elements').select('collection,item_id,donnees,modifie_le,recu_le,supprime').order('recu_le', { ascending: true }).limit(500);
    if (depuis) q = q.gt('recu_le', depuis);
    const { data, error } = await q;
    verifier(error);
    if (data.length) {
      appliquerElements(data);
      if (!reglage.curE || data.at(-1).recu_le > reglage.curE) reglage.curE = data.at(-1).recu_le;
      depuis = data.at(-1).recu_le;
    }
    if (data.length < 500) break;
  }
  ecrireReglage();
  // 2. Documents : on les reçoit après les animaux
  depuis = reglage.curD ? new Date(Date.parse(reglage.curD) - MARGE_MS).toISOString() : null;
  for (;;) {
    let q = c.from('documents_cloud').select('id,genre,animal_id,titre,date,type,mime,nom,taille,ajoute_le,modifie_le,recu_le,supprime').order('recu_le', { ascending: true }).limit(200);
    if (depuis) q = q.gt('recu_le', depuis);
    const { data, error } = await q;
    verifier(error);
    for (const r of data) await appliquerDocument(c, u, r);
    if (data.length) {
      if (!reglage.curD || data.at(-1).recu_le > reglage.curD) reglage.curD = data.at(-1).recu_le;
      depuis = data.at(-1).recu_le;
      ecrireReglage();
    }
    if (data.length < 200) break;
  }
  // 3. Photos d'animaux annoncées par un autre appareil et pas encore téléchargées (reprise après une coupure incluse)
  for (const [cle, n] of Object.entries(m)) {
    if (!n.pr || n.s || !cle.startsWith('animaux/')) continue;
    const id = cle.slice(8);
    const local = storage.trouver('animaux', id);
    if (!local) continue;
    const actuelle = typeof local.photo === 'string' && local.photo ? refPhoto(id, local.photo) : '';
    if (actuelle !== n.pr) await telechargerPhoto(c, u, id, n.pr);
  }
}

function appliquerElements(lignes) {
  const m = meta();
  const ops = [];
  const cles = [];
  for (const r of lignes) {
    const cle = `${r.collection}/${r.item_id}`;
    const t = Date.parse(r.modifie_le);
    const n = m[cle];
    if (n && t < n.m) continue; // ma version est plus récente : elle partira (ou le serveur l'a déjà)
    if (n && t === n.m) { n.e = 1; continue; } // c'est ma propre écriture qui revient
    if (r.supprime) { ops.push({ collection: r.collection, id: r.item_id, supprimer: true }); m[cle] = { h: '', m: t, e: 1, s: 1 }; continue; }
    const donnees = { ...r.donnees };
    let pr;
    if (r.collection === 'animaux') {
      pr = typeof donnees.photoRef === 'string' ? donnees.photoRef : undefined;
      delete donnees.photoRef;
      const ancienne = storage.trouver('animaux', r.item_id)?.photo;
      donnees.photo = pr && typeof ancienne === 'string' ? ancienne : ''; // l'ancienne photo reste affichée jusqu'à l'arrivée de la nouvelle (ou si c'est la même)
    }
    ops.push({ collection: r.collection, id: r.item_id, donnees });
    m[cle] = { h: '', m: t, e: 1, pr };
    cles.push(cle);
  }
  if (!ops.length) return;
  appliquant = true;
  try { storage.appliquerDistant(ops); } finally { appliquant = false; }
  const { elements } = lireInstantane();
  for (const cle of cles) { const d = elements.get(cle); if (d) m[cle].h = empreinte(stable(d)); } // ce qui est maintenant sur l'appareil = ce qu'on a reçu : rien à renvoyer
}

async function telechargerPhoto(c, u, animalId, ref) {
  const { data, error } = await c.storage.from(BUCKET).download(`${u}/${ref}`);
  if (error || !data) { if (compte.estHorsLigne(error)) throw error; return; } // fichier absent : on réessaiera au prochain tour
  if (!IMAGES.has(data.type)) return; // jamais autre chose qu'une image comme photo d'animal
  const dataUrl = await blobVersDataUrl(data);
  const local = storage.trouver('animaux', animalId);
  if (!local) return;
  appliquant = true;
  try { storage.appliquerDistant([{ collection: 'animaux', id: animalId, donnees: { ...local, photo: dataUrl } }]); } finally { appliquant = false; }
  const m = meta();
  m[`ph/${ref}`] = { m: Date.now(), e: 1, f: 1 }; // déjà dans le cloud : à ne pas renvoyer
  m[`ph/${refPhoto(animalId, dataUrl)}`] = { m: Date.now(), e: 1, f: 1 }; // (même fichier, nom calculé ici)
  if (m[`animaux/${animalId}`]) delete m[`animaux/${animalId}`].pr; // reçue : plus rien à télécharger
  const { elements } = lireInstantane();
  const d = elements.get(`animaux/${animalId}`);
  if (d && m[`animaux/${animalId}`]) m[`animaux/${animalId}`].h = empreinte(stable(d));
}

async function appliquerDocument(c, u, r) {
  const m = meta();
  if (r.genre === 'photo') return; // les photos d'animaux se téléchargent à la demande (voir telechargerPhoto)
  const cle = `doc/${r.id}`;
  const t = Date.parse(r.modifie_le);
  const n = m[cle];
  if (n && t < n.m) return;
  if (n && t === n.m) { n.e = 1; return; }
  if (r.supprime) {
    appliquant = true; try { await docs.supprimerDocument(r.id); } finally { appliquant = false; }
    m[cle] = { m: t, e: 1, s: 1, f: 0 };
    return;
  }
  if (!MIMES.has(r.mime) || typeof r.animal_id !== 'string') return; // un fichier qui n'est ni une image ni un PDF n'entre jamais dans l'appli
  const meme = {
    id: r.id, animalId: r.animal_id, titre: String(r.titre || 'Document').slice(0, 120), mime: r.mime, nom: String(r.nom ?? '').slice(0, 200),
    date: /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? r.date : new Date().toISOString().slice(0, 10),
    type: docs.TYPES_DOCUMENT.some((t) => t.id === r.type) ? r.type : 'autre',
  };
  const local = await docs.lireDocument(r.id);
  let blob = local?.blob;
  if (!blob) {
    const { data, error } = await c.storage.from(BUCKET).download(`${u}/${r.id}`);
    if (error || !data) { if (compte.estHorsLigne(error)) throw error; return; } // fichier pas encore disponible : au prochain tour
    blob = data;
  }
  const doc = { ...meme, taille: blob.size, blob, ajouteLe: r.ajoute_le ?? new Date().toISOString() };
  appliquant = true; try { await docs.enregistrerDocument(doc); } finally { appliquant = false; }
  m[cle] = { h: empreinteDoc(doc), m: t, e: 1, f: 1 };
}

// ----- Envoyer -----

async function pousser(c, u) {
  const m = meta();
  const { elements, photos } = releverChangements();
  await releverDocuments();
  let quotaAtteint = false;

  // 1. Photos d'animaux et documents d'abord (une référence ne doit pas arriver avant son fichier)
  for (const [cle, n] of Object.entries(m)) {
    if (n.e || !cle.startsWith('ph/')) continue;
    const ref = cle.slice(3);
    try {
      if (n.s) { await retirerFichier(c, u, ref); await marquerStele(c, u, ref); m[cle] = { ...n, e: 1 }; continue; }
      const p = photos.get(ref);
      if (!p) continue;
      const blob = dataUrlVersBlob(p.dataUrl);
      await declarer(c, u, { id: ref, genre: 'photo', animal_id: p.animalId, mime: blob.type, taille: blob.size, modifie_le: new Date(n.m).toISOString() });
      await deposer(c, u, ref, blob);
      m[cle] = { ...n, e: 1, f: 1, u: 1 };
    } catch (e) { if (e.quota) quotaAtteint = true; else throw e; }
  }
  for (const [cle, n] of Object.entries(m)) {
    if (n.e || !cle.startsWith('doc/')) continue;
    const id = cle.slice(4);
    try {
      if (n.s) {
        if (n.f) { await marquerStele(c, u, id); await retirerFichier(c, u, id); }
        m[cle] = { ...n, e: 1 };
        continue;
      }
      const d = await docs.lireDocument(id);
      if (!d) continue;
      await declarer(c, u, { id, genre: 'document', animal_id: d.animalId, titre: d.titre, date: d.date, type: d.type, mime: d.mime, nom: d.nom, taille: d.taille, ajoute_le: d.ajouteLe, modifie_le: new Date(n.m).toISOString() });
      if (!n.f) await deposer(c, u, id, d.blob);
      m[cle] = { ...n, e: 1, f: 1 };
    } catch (e) { if (e.quota) quotaAtteint = true; else throw e; }
  }

  // 2. Éléments, par lots
  const lignes = [];
  for (const [cle, n] of Object.entries(m)) {
    if (n.e || cle.startsWith('doc/') || cle.startsWith('ph/')) continue;
    const [collection, ...reste] = cle.split('/');
    const itemId = reste.join('/');
    const d = elements.get(cle);
    if (!n.s && !d) continue;
    lignes.push({ cle, envoye: n.m, ligne: { user_id: u, collection, item_id: itemId, donnees: n.s ? {} : d, modifie_le: new Date(n.m).toISOString(), supprime: !!n.s } });
  }
  for (let i = 0; i < lignes.length; i += LOT) {
    const lot = lignes.slice(i, i + LOT);
    const { error } = await c.from('elements').upsert(lot.map((x) => x.ligne), { onConflict: 'user_id,collection,item_id' });
    verifier(error);
    for (const x of lot) if (m[x.cle]?.m === x.envoye) m[x.cle].e = 1;
  }
  ecrireReglage();
  if (quotaAtteint) throw new ErreurQuota();
}

async function declarer(c, u, ligne) {
  const { error } = await c.from('documents_cloud').upsert({ user_id: u, ...ligne }, { onConflict: 'user_id,id' });
  verifier(error);
}
async function deposer(c, u, id, blob) {
  const { error } = await c.storage.from(BUCKET).upload(`${u}/${id}`, blob, { contentType: blob.type, upsert: false });
  if (error && !/already exists|Duplicate|resource already/i.test(`${error.message} ${error.error ?? ''} ${error.statusCode ?? ''}`)) verifier(error);
}
async function retirerFichier(c, u, id) {
  const { error } = await c.storage.from(BUCKET).remove([`${u}/${id}`]);
  verifier(error);
}
async function marquerStele(c, u, id) {
  const { error } = await c.from('documents_cloud').update({ supprime: true, modifie_le: new Date().toISOString() }).eq('user_id', u).eq('id', id);
  verifier(error);
}

// ----- Un tour complet : recevoir puis envoyer -----

let enCours = null;
let encore = false;
let appliquant = false; // vrai pendant qu'on écrit ce qui vient du cloud : ce n'est pas une modification de l'utilisateur
let dernierTour = 0;
let minuteur = null;

/** Un tour de synchronisation. Ne lève jamais d'erreur : l'état affiché dit ce qui s'est passé. */
export function synchroniser() {
  if (enCours) { encore = true; return enCours; }
  enCours = tour().finally(() => { enCours = null; if (encore) { encore = false; setTimeout(synchroniser, 500); } });
  return enCours;
}

async function tour() {
  if (!reglage.actif) return;
  if (storage.etatDonnees()) { changerEtat('erreur', 'Données illisibles sur cet appareil : rien n\'est envoyé.'); return; } // jamais de sauvegarde d'un carnet qu'on n'a pas pu lire
  if (!navigator.onLine) { changerEtat('attente', 'Hors ligne : les modifications partiront au retour du réseau.'); return; }
  changerEtat('encours');
  dernierTour = Date.now();
  try {
    const u = await compte.utilisateur();
    if (!u || u.id !== reglage.userId) { changerEtat('inactif'); return; } // déconnecté, ou autre compte : on ne mélange jamais deux comptes
    const c = await compte.clientSupabase();
    const p = await compte.profil();
    if (p.plan !== 'premium') { changerEtat('gratuit', 'Réservé au Premium : rien n\'est envoyé.'); return; }
    releverChangements(); await releverDocuments(); // d'abord noter ce que l'utilisateur vient de modifier : rien de ce qui arrive du cloud ne doit l'écraser
    await tirer(c, u.id);
    await pousser(c, u.id);
    reglage.dernier = Date.now();
    ecrireReglage();
    changerEtat('ok');
    window.dispatchEvent(new Event('synchro-terminee'));
  } catch (e) {
    ecrireReglage();
    if (e?.quota) changerEtat('quota', "L'espace cloud de 100 Mo est plein : supprimez des documents pour envoyer les suivants. Le reste est sauvegardé.");
    else if (contient(e, /42501|row-level security|permission denied/i)) changerEtat('gratuit', 'Réservé au Premium : rien n\'est envoyé.');
    else if (horsLigne(e)) changerEtat('attente', 'Pas de réseau : les modifications partiront au retour du réseau.');
    else changerEtat('erreur', 'La sauvegarde a échoué. Elle sera retentée automatiquement.');
  }
}

function planifier(delai = DELAI_MS) {
  if (!reglage.actif) return;
  clearTimeout(minuteur);
  if (!navigator.onLine) { changerEtat('attente', 'Hors ligne : les modifications partiront au retour du réseau.'); return; }
  minuteur = setTimeout(synchroniser, delai);
}

// ----- Démarrage et écoute -----

let ecoute = false;
/** À appeler au lancement de l'appli quand la sauvegarde cloud est activée sur cet appareil. */
export function demarrer() {
  if (!reglage.actif) return;
  monterIndicateur();
  changerEtat(navigator.onLine ? 'encours' : 'attente');
  if (!ecoute) {
    ecoute = true;
    window.addEventListener('donnees-modifiees', () => { if (!appliquant) planifier(); });
    window.addEventListener('documents-modifies', () => { if (!appliquant) planifier(); });
    window.addEventListener('online', () => planifier(500));
    window.addEventListener('offline', () => { if (reglage.actif) changerEtat('attente', 'Hors ligne : les modifications partiront au retour du réseau.'); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - dernierTour > 15_000) planifier(300); });
    window.addEventListener('donnees-remplacees', () => suspendre());
    window.addEventListener('compte-modifie', () => { if (reglage.actif) planifier(500); });
    setInterval(() => { if (reglage.actif && document.visibilityState === 'visible' && navigator.onLine) synchroniser(); }, PERIODE_MS);
  }
  planifier(1500);
}

/** Effacer ou importer ICI ne doit jamais effacer le cloud : on met la synchronisation en pause, l'utilisateur la relance quand il veut. */
function suspendre() {
  if (!reglage.actif) return;
  clearTimeout(minuteur);
  reglage = { userId: reglage.userId, actif: false, suspendu: true, meta: {} };
  ecrireReglage();
  changerEtat('suspendu', 'Vous avez effacé ou importé des données sur cet appareil : la sauvegarde cloud est en pause. Rien n\'a été supprimé dans le cloud.');
}

// ----- Activer, désactiver, première connexion -----

/** Compare cet appareil et le cloud, pour proposer le bon choix. { cas: 'rien' | 'recuperer' | 'envoyer' | 'fusionner', local, cloud } */
export async function analyserPremiereConnexion() {
  const c = await compte.clientSupabase();
  const [a, b] = await Promise.all([
    c.from('elements').select('item_id', { count: 'exact', head: true }).eq('supprime', false).neq('collection', 'profil'),
    c.from('documents_cloud').select('id', { count: 'exact', head: true }).eq('supprime', false),
  ]);
  verifier(a.error); verifier(b.error);
  const cloud = (a.count ?? 0) + (b.count ?? 0);
  const { elements } = lireInstantane();
  const local = [...elements.keys()].filter((k) => !k.startsWith('profil/')).length + (await docs.listerDocuments()).length;
  const cas = !local && !cloud ? 'rien' : !local ? 'recuperer' : !cloud ? 'envoyer' : 'fusionner';
  return { cas, local, cloud };
}

/** Active la sauvegarde cloud sur cet appareil pour ce compte (le choix a déjà été confirmé par l'utilisateur) et lance un premier tour. */
export async function activer(userId) {
  clearTimeout(minuteur);
  reglage = { userId, actif: true, curE: null, curD: null, meta: {} };
  ecrireReglage();
  demarrer();
  return synchroniser();
}

/** Arrête la sauvegarde cloud sur CET appareil. Rien n'est supprimé, ni ici ni dans le cloud. */
export function desactiver() {
  clearTimeout(minuteur);
  reglage = { userId: reglage.userId, actif: false, refuse: reglage.refuse };
  ecrireReglage();
  changerEtat('inactif');
  window.dispatchEvent(new Event('synchro-changee'));
}

/** L'utilisateur a refusé la proposition d'activation : on ne la repose pas automatiquement. */
export function refuserProposition(userId) { reglage = { ...reglage, userId: reglage.userId ?? userId, refuse: true }; ecrireReglage(); }

/** Espace utilisé dans le cloud : { octets, max } (somme des tailles déclarées des fichiers gardés). */
export async function espaceCloud() {
  const c = await compte.clientSupabase();
  const { data, error } = await c.from('documents_cloud').select('taille').eq('supprime', false);
  verifier(error);
  return { octets: data.reduce((n, d) => n + (d.taille ?? 0), 0), max: QUOTA_OCTETS, nombre: data.length };
}

// ----- Suppression du compte et export : les fichiers du cloud aussi -----

/**
 * Supprime TOUS les fichiers de cette personne dans le bucket (par l'API Storage : les supprimer en SQL ne retire pas les vrais fichiers),
 * puis vérifie qu'il n'en reste aucun. À appeler AVANT supprimer_mon_compte(), qui refuse de continuer s'il reste un fichier.
 */
export async function supprimerFichiersCloud(userId) {
  const c = await compte.clientSupabase();
  for (let tour = 0; tour < 20; tour++) {
    const { data, error } = await c.storage.from(BUCKET).list(userId, { limit: 1000 });
    if (error) { if (/not found|bucket/i.test(`${error.message} ${error.error ?? ''}`) && !horsLigne(error)) return 0; throw error; } // pas de bucket : rien à supprimer
    const fichiers = (data ?? []).filter((f) => f.name && f.id !== null);
    if (!fichiers.length) return tour;
    const { error: e2 } = await c.storage.from(BUCKET).remove(fichiers.map((f) => `${userId}/${f.name}`));
    if (e2) throw e2;
  }
  throw new Error('fichiers_restants');
}

/** Tout ce que le cloud détient sur ce compte (droit d'accès et de portabilité) : éléments, liste des documents, liens de téléchargement valables 24 h. */
export async function exporterCloud(userId) {
  const c = await compte.clientSupabase();
  const [el, dc] = await Promise.all([
    c.from('elements').select('collection,item_id,donnees,modifie_le,recu_le,supprime').order('recu_le'),
    c.from('documents_cloud').select('id,genre,animal_id,titre,date,type,mime,nom,taille,ajoute_le,modifie_le,supprime').order('recu_le'),
  ]);
  verifier(el.error); verifier(dc.error);
  const documents = [];
  for (const d of dc.data.filter((x) => !x.supprime)) {
    const { data } = await c.storage.from(BUCKET).createSignedUrl(`${userId}/${d.id}`, 86_400);
    documents.push({ ...d, lienTelechargement: data?.signedUrl ?? null });
  }
  return {
    elements: el.data.filter((x) => !x.supprime).map((x) => ({ collection: x.collection, id: x.item_id, modifieLe: x.modifie_le, donnees: x.donnees })),
    documents,
    remarque: 'Les liens de téléchargement des documents et photos sont valables 24 heures. Les suppressions récentes ne sont pas listées.',
  };
}
