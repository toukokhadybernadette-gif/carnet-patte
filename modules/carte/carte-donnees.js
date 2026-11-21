// Carte Patte : la logique, sans interface.
//   - les catégories de lieux (couleur, icône, étiquettes OpenStreetMap) ;
//   - la requête Overpass et la lecture de sa réponse ;
//   - les distances, adresses, téléphones et horaires ;
//   - la recherche d'une ville (Nominatim) ;
//   - les règles d'usage des serveurs OpenStreetMap : UNE recherche à la fois, une pause entre deux requêtes,
//     et les résultats gardés quelques heures (localStorage, à part des données des animaux : ni exporté ni importé).
// Données © contributeurs d'OpenStreetMap (licence ODbL). Elles sont parfois incomplètes : on n'invente jamais rien.

export const ADRESSE_OVERPASS = 'https://overpass-api.de/api/interpreter';
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
};

export class ErreurCarte extends Error {
  constructor(code) { super(MESSAGES[code] ?? MESSAGES.serveur); this.code = code; }
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
  const t = nettoyer(brut, 300);
  if (!t) return null;
  if (t === '24/7') return { texte: 'Ouvert 24h/24, 7 j/7', h24: true };
  const texte = t.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b/g, (j) => JOURS[j]).replace(/\b(off|closed)\b/g, 'fermé').replace(/\s*;\s*/g, ' ; ');
  return { texte, h24: false };
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
    lieux.push({
      id, cat: cat.id, lat, lon,
      nom: nettoyer(t.name || t.operator || t.brand, 160),
      adresse: adresse(t),
      tel: telephone(t),
      horaires: nettoyer(t.opening_hours, 300),
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
    throw new ErreurCarte(e?.name === 'AbortError' ? 'trop-long' : 'reseau');
  } finally {
    clearTimeout(minuteur);
    dernierAppel = Date.now();
  }
  if (reponse.status === 429) throw new ErreurCarte('occupe');
  if (!reponse.ok) throw new ErreurCarte('serveur');
  try { return await reponse.json(); } catch { throw new ErreurCarte('serveur'); }
}

/**
 * Les lieux autour d'un point : depuis le cache s'il est récent, sinon depuis Overpass.
 * Renvoie { lieux (avec `d`, la distance en mètres, triés du plus proche au plus loin, dans le rayon demandé), depuisCache }.
 */
export async function lieuxAutour(centre, rayonKm) {
  const arrondi = (x) => Math.round(x * GRILLE) / GRILLE;
  const lat = arrondi(centre.lat);
  const lon = arrondi(centre.lon);
  const cle = `${lat},${lon}`;
  const rayonRequeteM = rayonKm * 1000 + MARGE_M;
  let lieux = lireCache(cle, rayonRequeteM);
  const depuisCache = lieux !== null;
  if (!depuisCache) {
    const json = await appeler(ADRESSE_OVERPASS, { method: 'POST', body: new URLSearchParams({ data: requeteOverpass(lat, lon, rayonRequeteM) }) }, 30000);
    lieux = analyser(json);
    // Overpass répond parfois 200 avec une « remarque » d'erreur et rien d'autre : ce n'est pas « aucun lieu »
    if (!lieux.length && /error|timed out|too busy/i.test(String(json?.remark ?? ''))) throw new ErreurCarte('serveur');
    ecrireCache(cle, rayonRequeteM, lieux);
  }
  const proches = lieux
    .map((l) => ({ ...l, d: distance(centre, l) }))
    .filter((l) => l.d <= rayonKm * 1000)
    .sort((a, b) => a.d - b.d);
  return { lieux: proches, depuisCache };
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
  const json = await appeler(`${ADRESSE_NOMINATIM}?${new URLSearchParams({ ...parametres, format: 'jsonv2', limit: '1', 'accept-language': 'fr' })}`, {}, 15000);
  const r = Array.isArray(json) ? json[0] : null;
  const lat = Number(r?.lat);
  const lon = Number(r?.lon);
  if (!r || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new ErreurCarte('ville-introuvable');
  const ville = { lat, lon, nom: nettoyer(r.display_name || q, 200).split(',').slice(0, 2).join(',').trim() || q };
  villesVues.set(q.toLowerCase(), ville);
  return ville;
}
