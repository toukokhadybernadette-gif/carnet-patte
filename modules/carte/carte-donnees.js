// Carte Patte : la logique, sans interface.
//   - les lieux viennent d'abord de fichiers préparés à l'avance (donnees/lieux/<département>.json, France métropolitaine) : instantané, et la position ne quitte pas l'appareil ;
//   - sinon (hors métropole, ou fichiers indisponibles) des serveurs Overpass publics, plus lents et parfois saturés ;
//   - les catégories de lieux (couleur, icône, étiquettes OpenStreetMap) ;
//   - la requête Overpass et la lecture de sa réponse ;
//   - les distances, adresses, téléphones et horaires ;
//   - la recherche d'une ville (Nominatim) ;
//   - les règles d'usage des serveurs OpenStreetMap : UNE recherche à la fois, une pause entre deux requêtes,
//     et les résultats gardés quelques heures (localStorage, à part des données des animaux : ni exporté ni importé).
// Données © contributeurs d'OpenStreetMap (licence ODbL). Elles sont parfois incomplètes : on n'invente jamais rien.

/**
 * Serveurs Overpass, essayés dans l'ordre : on passe au suivant à la moindre erreur (502 « at capacity », 403, coupure, délai dépassé…).
 * Le serveur principal est souvent saturé : quand il accepte la requête il peut mettre 30 à 45 s, d'où son long délai.
 * `overpass.openstreetmap.fr` n'est PAS dans la liste : il répond « service réservé à des usages autorisés » (403 sans en-tête CORS).
 * Pas de serveur hébergé hors d'Europe (vie privée, RGPD) : la zone de recherche et l'adresse IP ne doivent partir que vers des serveurs OpenStreetMap ou européens.
 */
export const SERVEURS_OVERPASS = [
  { nom: 'overpass-api.de', url: 'https://overpass-api.de/api/interpreter', delaiMs: 55000 },
  { nom: 'overpass.kumi.systems', url: 'https://overpass.kumi.systems/api/interpreter', delaiMs: 15000 },
  { nom: 'overpass.private.coffee', url: 'https://overpass.private.coffee/api/interpreter', delaiMs: 15000 },
];
export const ADRESSE_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const RAYONS_KM = [2, 5, 10];
export const RAYON_DEFAUT_KM = 5;

const ECART_REQUETES_MS = 1500;      // pause minimale entre deux requêtes vers OpenStreetMap
const DUREE_CACHE_MS = 6 * 3600e3;   // les lieux trouvés sont gardés 6 heures
const ZONES_GARDEES = 4;             // nombre de zones gardées en mémoire
const MARGE_M = 1000;                // on cherche un peu plus large que le rayon demandé (la zone est arrondie à 1 km) puis on filtre
const GRILLE = 100;                  // arrondi à 0,01° (environ 1 km)
const CLE_CACHE = 'carnetpatte.carteCache';

/** Les couleurs sont assez foncées pour que l'icône blanche soit lisible (contraste d'au moins 4,5:1). */
export const CATEGORIES = [
  { id: 'veto', nom: 'Vétérinaires', un: 'Vétérinaire', icone: 'stethoscope', couleur: '#1D5FA8', filtres: [['amenity', 'veterinary']] },
  { id: 'parc', nom: 'Parcs à chiens', un: 'Parc à chiens', icone: 'dog', couleur: '#2E7D32', filtres: [['leisure', 'dog_park']] },
  { id: 'animalerie', nom: 'Animaleries', un: 'Animalerie', icone: 'store', couleur: '#9A5700', filtres: [['shop', 'pet'], ['shop', 'pet_supply']] },
  { id: 'toiletteur', nom: 'Toiletteurs', un: 'Toiletteur', icone: 'scissors', couleur: '#7B3FA0', filtres: [['shop', 'pet_grooming']] },
  { id: 'refuge', nom: 'Refuges', un: 'Refuge', icone: 'house-heart', couleur: '#B0306A', filtres: [['amenity', 'animal_shelter']] },
];
export const categorie = (id) => CATEGORIES.find((c) => c.id === id);

export const MESSAGE_DONNEES = 'Données OpenStreetMap, parfois incomplètes. En urgence, appelez votre vétérinaire.';

export const MESSAGES = {
  'hors-ligne': 'Pas de connexion internet. Vérifiez votre réseau, puis réessayez.',
  reseau: 'Impossible de joindre OpenStreetMap. Vérifiez votre connexion, puis réessayez.',
  serveur: 'Le serveur OpenStreetMap ne répond pas correctement pour le moment. Réessayez dans un instant.',
  occupe: 'Le serveur OpenStreetMap est très sollicité. Patientez une minute, puis réessayez.',
  'trop-long': 'La recherche prend trop de temps. Réessayez, ou choisissez un rayon plus petit.',
  'ville-introuvable': "Aucune ville ni aucun code postal ne correspond. Vérifiez l'orthographe.",
  'ville-vide': 'Entrez une ville ou un code postal.',
  'donnees-locales': "Les lieux préparés à l'avance ne sont pas disponibles.",
};

/** `detail` : la vraie raison technique (code HTTP, message du navigateur…). `essais` : un détail par serveur essayé. */
export class ErreurCarte extends Error {
  constructor(code, detail = '', essais = []) { super(MESSAGES[code] ?? MESSAGES.serveur); this.code = code; this.detail = detail; this.essais = essais; }
}

/** La vraie raison dans la console, pour pouvoir diagnostiquer (Safari : Réglages > Safari > Avancé > Inspecteur web). */
function diagnostiquer(serveur, e) {
  console.warn(`[Carte Patte] ${serveur} : ${e?.detail || e?.message || e}`);
}

// ===== Distances et mise en forme =====

/** Distance à vol d'oiseau en mètres (formule de haversine). */
export function distance(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function formaterDistance(m) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

const nettoyer = (texte, max = 200) => String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function adresse(t) {
  const rue = [nettoyer(t['addr:housenumber'], 20), nettoyer(t['addr:street'])].filter(Boolean).join(' ');
  const ville = [nettoyer(t['addr:postcode'], 12), nettoyer(t['addr:city'])].filter(Boolean).join(' ');
  return [rue, ville].filter(Boolean).join(', ') || nettoyer(t['addr:full']);
}

/** Premier numéro de téléphone indiqué : { affiche, lien } ou null. Le lien ne garde que les chiffres et le « + ». */
export function telephone(t) {
  const brut = nettoyer(t.phone || t['contact:phone'] || t.mobile || t['contact:mobile'], 60).split(/[;,/]/)[0].trim();
  const lien = brut.replace(/[\s.()-]/g, '');
  return /^\+?\d{6,15}$/.test(lien) ? { affiche: brut, lien } : null;
}

const JOURS = { Mo: 'lun', Tu: 'mar', We: 'mer', Th: 'jeu', Fr: 'ven', Sa: 'sam', Su: 'dim', PH: 'jours fériés', SH: 'vacances scolaires' };

/** Horaires tels qu'indiqués dans OpenStreetMap, jours traduits. « Ouvert 24h/24 » seulement si la donnée dit exactement 24/7. */
export function horaires(brut) {
  // OpenStreetMap met ses commentaires entre guillemets ("sur rendez-vous") : on garde le texte, sans les guillemets
  const t = nettoyer(String(brut ?? '').replace(/["\u201C\u201D\u00AB\u00BB]/g, ''), 300);
  if (!t) return null;
  if (t === '24/7') return { texte: 'Ouvert 24h/24, 7 j/7', h24: true };
  const texte = t.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b/g, (j) => JOURS[j]).replace(/\b(off|closed)\b/g, 'fermé').replace(/\s*;\s*/g, ' ; ');
  return { texte, h24: false };
}

/** Adresse du site web, seulement si c'est une vraie adresse http(s) (jamais de courriel ni de lien « javascript: »). */
export function siteWeb(t) {
  let brut = nettoyer(t.website || t['contact:website'] || t.url, 200);
  if (brut && !/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(brut)) brut = `https://${brut}`;
  return /^https?:\/\/[^\s<>"']+$/i.test(brut) && !brut.split('/')[2].includes('@') ? brut : '';
}

const apple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

/** Lien d'itinéraire : Plans sur iPhone et Mac, Google Maps ailleurs. */
export function lienItineraire(lieu) {
  return apple()
    ? `https://maps.apple.com/?daddr=${lieu.lat},${lieu.lon}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lieu.lat},${lieu.lon}`;
}

/** Page du lieu sur OpenStreetMap (pour le corriger ou le compléter). L'identifiant est vérifié : jamais de texte libre dans l'adresse. */
export function lienOsm(lieu) {
  return /^(node|way|relation)\/\d+$/.test(lieu.id) ? `https://www.openstreetmap.org/${lieu.id}` : 'https://www.openstreetmap.org/';
}

// ===== Requête Overpass et lecture de la réponse =====

export function requeteOverpass(lat, lon, rayonM) {
  const lignes = CATEGORIES.flatMap((c) => c.filtres.map(([cle, valeur]) => `nwr["${cle}"="${valeur}"](around:${Math.round(rayonM)},${lat},${lon});`));
  return `[out:json][timeout:25];(${lignes.join('')});out center tags 400;`;
}

/** Transforme la réponse Overpass en lieux simples. Les éléments sans position ou hors catégories sont ignorés. */
export function analyser(json) {
  const vus = new Set();
  const lieux = [];
  for (const el of json?.elements ?? []) {
    const t = el?.tags ?? {};
    const cat = CATEGORIES.find((c) => c.filtres.some(([cle, valeur]) => t[cle] === valeur));
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const id = `${el.type}/${el.id}`;
    if (!cat || !Number.isFinite(lat) || !Number.isFinite(lon) || vus.has(id)) continue;
    vus.add(id);
    const nom = nettoyer(t.name || t.operator || t.brand, 160);
    lieux.push({
      id, cat: cat.id, lat, lon,
      nom,
      adresse: adresse(t),
      tel: telephone(t),
      horaires: nettoyer(t.opening_hours, 300),
      site: siteWeb(t),
      rue: nom ? '' : nettoyer(t['addr:street'], 80),
    });
  }
  return lieux;
}

// ===== Cache : les lieux trouvés, quelques heures =====

function lireZones() {
  try {
    const o = JSON.parse(localStorage.getItem(CLE_CACHE));
    return Array.isArray(o?.zones) ? o.zones : [];
  } catch { return []; }
}

export function lireCache(cle, rayonM, maintenant = Date.now()) {
  const z = lireZones().find((x) => x.cle === cle && x.rayon >= rayonM && maintenant - x.t < DUREE_CACHE_MS);
  return z ? z.lieux : null;
}

export function ecrireCache(cle, rayonM, lieux, maintenant = Date.now()) {
  const zones = lireZones().filter((x) => x.cle !== cle && maintenant - x.t < DUREE_CACHE_MS);
  zones.unshift({ cle, rayon: rayonM, t: maintenant, lieux });
  try { localStorage.setItem(CLE_CACHE, JSON.stringify({ zones: zones.slice(0, ZONES_GARDEES) })); } catch { /* stockage plein ou bloqué : on s'en passe */ }
}

// ===== Une recherche à la fois, avec une pause entre deux requêtes =====

let occupe = false;
let dernierAppel = 0;
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Lance la tâche si aucune autre recherche n'est en cours ; sinon renvoie `false` sans rien faire. */
export async function exclusif(tache) {
  if (occupe) return false;
  occupe = true;
  try { await tache(); } finally { occupe = false; }
  return true;
}
export const rechercheEnCours = () => occupe;

async function appeler(url, options, delaiMs) {
  if (navigator.onLine === false) throw new ErreurCarte('hors-ligne');
  const attente = dernierAppel + ECART_REQUETES_MS - Date.now();
  if (attente > 0) await pause(attente);
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delaiMs);
  let reponse;
  try {
    reponse = await fetch(url, { ...options, signal: controle.signal });
  } catch (e) {
    // Le navigateur ne distingue pas une coupure réseau d'un refus CORS : on le dit tel quel
    const abandon = e?.name === 'AbortError';
    throw new ErreurCarte(abandon ? 'trop-long' : 'reseau', abandon ? `aucune réponse après ${delaiMs / 1000} s` : `${e?.name ?? 'Erreur'} : ${e?.message ?? ''} (réseau coupé, serveur injoignable ou requête refusée par le navigateur)`);
  } finally {
    clearTimeout(minuteur);
    dernierAppel = Date.now();
  }
  if (!reponse.ok) {
    const debut = (await reponse.text().catch(() => '')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new ErreurCarte(reponse.status === 429 ? 'occupe' : 'serveur', `HTTP ${reponse.status}${reponse.statusText ? ` ${reponse.statusText}` : ''}${debut ? ` — ${debut}` : ''}`);
  }
  try { return await reponse.json(); } catch (e) { throw new ErreurCarte('serveur', `réponse illisible (pas du JSON) : ${e?.message ?? ''}`); }
}

// Le serveur qui a répondu en dernier est essayé en premier pendant 10 minutes (inutile d'attendre un serveur en panne à chaque recherche)
let bonServeur = { index: 0, t: 0 };
const MEMOIRE_SERVEUR_MS = 10 * 60e3;

/** Interroge Overpass : serveur préféré d'abord, puis l'autre. Lève une erreur avec le détail de CHAQUE essai si tous échouent. */
async function interrogerOverpass(corps, progression) {
  const prefere = Date.now() - bonServeur.t < MEMOIRE_SERVEUR_MS ? bonServeur.index : 0;
  const ordre = SERVEURS_OVERPASS.map((_, i) => i).sort((a, b) => (a === prefere ? -1 : b === prefere ? 1 : a - b));
  const essais = [];
  let derniere;
  for (const [rang, i] of ordre.entries()) {
    const s = SERVEURS_OVERPASS[i];
    progression?.({ rang, total: ordre.length, nom: s.nom });
    try {
      const json = await appeler(s.url, { method: 'POST', body: new URLSearchParams({ data: corps }) }, s.delaiMs);
      if (!Array.isArray(json?.elements)) throw new ErreurCarte('serveur', 'réponse sans liste « elements »');
      // Overpass répond parfois 200 avec une « remarque » d'erreur et rien d'autre : ce n'est pas « aucun lieu »
      if (!json.elements.length && /error|timed out|too busy/i.test(String(json.remark ?? ''))) throw new ErreurCarte('serveur', `remarque d'Overpass : ${String(json.remark).slice(0, 120)}`);
      bonServeur = { index: i, t: Date.now() };
      return json;
    } catch (e) {
      if (!(e instanceof ErreurCarte)) throw e;
      diagnostiquer(s.nom, e);
      essais.push({ serveur: s.nom, raison: e.detail || e.message });
      derniere = e;
      if (e.code === 'hors-ligne') break; // inutile d'essayer l'autre serveur sans connexion
    }
  }
  throw new ErreurCarte(derniere.code, derniere.detail, essais);
}

// ===== Lieux préparés à l'avance : donnees/lieux/ (voir outils/extraire-lieux.py, mis à jour chaque mois par une Pull Request) =====

const DOSSIER_LIEUX = new URL('../../donnees/lieux/', import.meta.url);
const CODES_CATEGORIES = { v: 'veto', p: 'parc', a: 'animalerie', t: 'toiletteur', r: 'refuge' };
const TYPES_OSM = { n: 'node', w: 'way', r: 'relation' };
let promesseIndex = null;
const promessesFichiers = new Map();

async function lireJsonLocal(nom) {
  let reponse;
  try { reponse = await fetch(new URL(nom, DOSSIER_LIEUX)); } catch (e) { throw new ErreurCarte('donnees-locales', `${nom} : ${e?.name ?? 'Erreur'} : ${e?.message ?? ''}`); }
  if (!reponse.ok) throw new ErreurCarte('donnees-locales', `${nom} : HTTP ${reponse.status}${reponse.statusText ? ` ${reponse.statusText}` : ''}`);
  try { return await reponse.json(); } catch (e) { throw new ErreurCarte('donnees-locales', `${nom} : JSON illisible (${e?.message ?? ''})`); }
}

function chargerIndex() {
  promesseIndex ??= lireJsonLocal('index.json').then((index) => {
    if (index?.v !== 1 || !index.departements || !Array.isArray(index.france)) throw new ErreurCarte('donnees-locales', 'index.json : format inattendu');
    return index;
  }).catch((e) => { promesseIndex = null; throw e; });
  return promesseIndex;
}

function chargerDepartement(code) {
  if (!promessesFichiers.has(code)) {
    promessesFichiers.set(code, lireJsonLocal(`${code}.json`).then((f) => {
      if (f?.v !== 1 || !Array.isArray(f.lieux)) throw new ErreurCarte('donnees-locales', `${code}.json : format inattendu`);
      return f.lieux;
    }).catch((e) => { promessesFichiers.delete(code); throw e; }));
  }
  return promessesFichiers.get(code);
}

/** Point dans un polygone (anneau de [lon, lat]). */
function dansAnneau(lon, lat, anneau) {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
export const dansFrance = (index, p) => index.france.some((anneau) => dansAnneau(p.lon, p.lat, anneau));

/** Le cercle de recherche est-il entièrement couvert ? (huit points sur le cercle) Sinon on est près d'une frontière ou d'une côte. */
export function cercleCouvert(index, centre, rayonKm) {
  const dLat = rayonKm / 111.32;
  const dLon = rayonKm / (111.32 * Math.cos((centre.lat * Math.PI) / 180));
  return Array.from({ length: 8 }, (_, k) => (k * Math.PI) / 4)
    .every((a) => dansFrance(index, { lat: centre.lat + dLat * Math.sin(a), lon: centre.lon + dLon * Math.cos(a) }));
}

/** Une ligne de fichier [id, catégorie, lat, lon, nom, adresse, tél., horaires, site, rue, source de l'adresse] devient un lieu ; null si elle est invalide. */
export function lieuDepuisLigne(ligne) {
  if (!Array.isArray(ligne)) return null;
  const [id, c, lat, lon, nom = '', adr = '', tel = '', hor = '', site = '', rue = '', src = ''] = ligne;
  const cat = CODES_CATEGORIES[c];
  if (typeof id !== 'string' || !/^[nwr]\d+$/.test(id) || !cat || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: `${TYPES_OSM[id[0]]}/${id.slice(1)}`, cat, lat, lon,
    nom: nettoyer(nom, 160), adresse: nettoyer(adr), tel: telephone({ phone: nettoyer(tel, 60) }), horaires: nettoyer(hor, 300),
    site: /^https?:\/\/[^\s<>"']+$/i.test(site) ? String(site).slice(0, 200) : '',
    rue: nom ? '' : nettoyer(rue, 80),
    ban: src === 'b',   // adresse venue de la Base Adresse Nationale (adresse officielle la plus proche), pas d'OpenStreetMap
  };
}

/**
 * Les lieux depuis les fichiers du site. Renvoie null si le point est hors de la France métropolitaine (on passe alors à Overpass).
 * Lève une ErreurCarte si les fichiers sont illisibles (on passe aussi à Overpass).
 */
async function lieuxLocaux(centre, rayonKm) {
  const index = await chargerIndex();
  if (!dansFrance(index, centre)) return null;
  const dLat = rayonKm / 111.32;
  const dLon = rayonKm / (111.32 * Math.cos((centre.lat * Math.PI) / 180));
  const codes = Object.entries(index.departements)
    .filter(([, d]) => d.bbox[0] <= centre.lat + dLat && d.bbox[2] >= centre.lat - dLat && d.bbox[1] <= centre.lon + dLon && d.bbox[3] >= centre.lon - dLon)
    .map(([code]) => code);
  const fichiers = await Promise.all(codes.map(chargerDepartement));
  const lieux = fichiers.flat().map(lieuDepuisLigne).filter(Boolean)
    .map((l) => ({ ...l, d: distance(centre, l) }))
    .filter((l) => l.d <= rayonKm * 1000)
    .sort((a, b) => a.d - b.d);
  return { lieux, depuisCache: false, source: 'locale', extrait: String(index.extrait ?? ''), partiel: !cercleCouvert(index, centre, rayonKm) };
}

/**
 * Les lieux autour d'un point : depuis les fichiers du site (France métropolitaine), sinon depuis le cache récent, sinon depuis Overpass.
 * Renvoie { lieux (avec `d`, la distance en mètres, triés du plus proche au plus loin, dans le rayon demandé), depuisCache }.
 */
export async function lieuxAutour(centre, rayonKm, progression) {
  // 1. Les fichiers préparés à l'avance (France métropolitaine) : instantané, aucune requête vers OpenStreetMap
  let raisonLocale = '';
  try {
    const local = await lieuxLocaux(centre, rayonKm);
    if (local) return local;
  } catch (e) {
    raisonLocale = e?.detail || e?.message || String(e);
    console.info(`[Carte Patte] lieux préparés à l'avance indisponibles, passage à Overpass : ${raisonLocale}`);
  }
  // 2. Sinon Overpass (hors métropole, ou fichiers indisponibles) : cache de quelques heures, puis serveurs publics
  const arrondi = (x) => Math.round(x * GRILLE) / GRILLE;
  const lat = arrondi(centre.lat);
  const lon = arrondi(centre.lon);
  const cle = `${lat},${lon}`;
  const rayonRequeteM = rayonKm * 1000 + MARGE_M;
  let lieux = lireCache(cle, rayonRequeteM);
  const depuisCache = lieux !== null;
  if (!depuisCache) {
    try {
      lieux = analyser(await interrogerOverpass(requeteOverpass(lat, lon, rayonRequeteM), progression));
    } catch (e) {
      if (e instanceof ErreurCarte && raisonLocale) e.essais.unshift({ serveur: "lieux préparés à l'avance", raison: raisonLocale });
      throw e;
    }
    ecrireCache(cle, rayonRequeteM, lieux);
  }
  const proches = lieux
    .map((l) => ({ ...l, d: distance(centre, l) }))
    .filter((l) => l.d <= rayonKm * 1000)
    .sort((a, b) => a.d - b.d);
  return { lieux: proches, depuisCache, source: 'overpass', extrait: '', partiel: false };
}

// ===== Recherche d'une ville ou d'un code postal (Nominatim) =====

const villesVues = new Map(); // gardées seulement le temps de la visite

export async function trouverVille(texte) {
  const q = nettoyer(texte, 100);
  if (q.length < 2) throw new ErreurCarte('ville-vide');
  const memo = villesVues.get(q.toLowerCase());
  if (memo) return memo;
  // Cinq chiffres seuls : un code postal français (sinon « 75001 » pourrait tomber sur une ville d'un autre pays)
  const parametres = /^\d{5}$/.test(q)
    ? { postalcode: q, country: 'France' }
    : { q };
  let json;
  try {
    json = await appeler(`${ADRESSE_NOMINATIM}?${new URLSearchParams({ ...parametres, format: 'jsonv2', limit: '1', 'accept-language': 'fr' })}`, {}, 15000);
  } catch (e) {
    if (e instanceof ErreurCarte) { diagnostiquer('nominatim.openstreetmap.org', e); throw new ErreurCarte(e.code, e.detail, [{ serveur: 'nominatim.openstreetmap.org', raison: e.detail || e.message }]); }
    throw e;
  }
  const r = Array.isArray(json) ? json[0] : null;
  const lat = Number(r?.lat);
  const lon = Number(r?.lon);
  if (!r || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new ErreurCarte('ville-introuvable');
  const ville = { lat, lon, nom: nettoyer(r.display_name || q, 200).split(',').slice(0, 2).join(',').trim() || q };
  villesVues.set(q.toLowerCase(), ville);
  return ville;
}
