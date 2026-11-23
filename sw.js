// Service worker de Carnet Patte : fait marcher l'appli hors connexion.
//
// CE QU'IL FAIT
//  - À l'installation, il met l'appli entière en cache (liste FICHIERS) sous le nom de sa VERSION.
//  - Il répond ensuite depuis ce cache (pages, styles, scripts, icônes, données « Toxique ? »).
//  - Les fichiers de lieux (donnees/lieux/) sont gardés au fur et à mesure qu'on les consulte, et rafraîchis quand on est en ligne.
//  - Tout ce qui vient d'un autre site (tuiles de carte, recherche de ville, serveurs Overpass…) lui échappe : le navigateur s'en occupe.
//
// CE QU'IL NE FAIT JAMAIS
//  - Toucher aux données des animaux : elles sont dans le localStorage de la page, que ce fichier ne peut ni lire ni écrire.
//    Il ne met en cache que des fichiers de l'appli (GET, même site), jamais une réponse venue d'ailleurs.
//  - Imposer une vieille version : une nouvelle version prend la main tout de suite (skipWaiting + clients.claim), efface les anciens caches,
//    et la page propose « Recharger » (js/pwa.js) sans jamais recharger toute seule.
//  - Servir ou garder une réponse REDIRIGÉE : le navigateur refuse une navigation servie avec une réponse issue d'une redirection
//    (ERR_FAILED, vu dans Chrome sur iPhone après une mise à jour : Cloudflare redirige /index.html vers / et /demenagement.html vers /demenagement).
//    Toute réponse est donc recopiée « propre » (propre()) avant d'être gardée ou servie, et en cas de souci le réseau prend le relais.
//
// VERSION et FICHIERS sont remplacés à la publication par outils/preparer-sw.mjs (l'Action « Publier le site »).
// Tel quel (VERSION = 'dev', pendant le développement avec Live Server), le service worker ne met RIEN en cache : on voit toujours les fichiers à jour.

const VERSION = 'dev';
const FICHIERS = /*FICHIERS*/[]/*FIN*/;

const MODE_DEV = VERSION === 'dev';
const PREFIXE = 'carnetpatte-app-';
const CACHE_APP = `${PREFIXE}${VERSION}`;
const CACHE_LIEUX = 'carnetpatte-lieux'; // survit aux mises à jour : les lieux déjà consultés restent disponibles
const LIEUX_MAX = 40;
const racine = new URL('./', self.registration.scope);
const page = new URL('index.html', racine).href;

/** Copie « propre » d'une réponse : sans trace de redirection (redirected = false), que le navigateur accepte pour une navigation. */
async function propre(reponse) {
  if (!reponse.redirected) return reponse;
  return new Response(await reponse.blob(), { status: reponse.status, statusText: reponse.statusText, headers: reponse.headers });
}

self.addEventListener('install', (evenement) => {
  self.skipWaiting(); // la nouvelle version prend la main dès qu'elle est prête ; la page propose de recharger
  if (MODE_DEV) return;
  evenement.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    // cache: 'reload' : on prend les fichiers sur le serveur, jamais dans le cache HTTP du navigateur (c'est ce qui bloquait de vieilles versions)
    await Promise.all(FICHIERS.map(async (f) => {
      const reponse = await fetch(new Request(new URL(f, racine), { cache: 'reload' }));
      if (!reponse.ok) throw new Error(`${f} : HTTP ${reponse.status}`); // un fichier manquant annule l'installation : jamais de version à moitié en cache
      await cache.put(new URL(f, racine), await propre(reponse));
    }));
  })());
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith(PREFIXE) && nom !== CACHE_APP) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evenement) => {
  if (evenement.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function limiter(cache) {
  const cles = await cache.keys();
  for (const cle of cles.slice(0, Math.max(0, cles.length - LIEUX_MAX))) await cache.delete(cle);
}

/** Fichiers de lieux : on sert la copie gardée et on la rafraîchit en arrière-plan ; sans copie, réseau ; hors connexion sans copie, erreur (la Carte l'explique). */
async function lieux(requete) {
  const cache = await caches.open(CACHE_LIEUX);
  const copie = await cache.match(requete);
  const reseau = fetch(requete).then(async (reponse) => {
    if (reponse.ok) { await cache.put(requete, reponse.clone()); await limiter(cache); }
    return reponse;
  });
  if (copie) { reseau.catch(() => {}); return copie; }
  return reseau;
}

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (MODE_DEV || requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(racine.href)) return; // autres sites : hors de portée du cache

  if (url.pathname.includes('/donnees/lieux/')) { evenement.respondWith(lieux(requete)); return; }

  evenement.respondWith((async () => {
    const navigation = requete.mode === 'navigate';
    try {
      const cache = await caches.open(CACHE_APP);
      // La racine de l'appli (/) donne la page ; une autre page du site (demenagement.html, ou /demenagement sans « .html » comme sur Cloudflare Pages) donne SA page
      const chemin = url.pathname.replace(/\/$/, '');
      let copie = await cache.match(navigation && chemin === racine.pathname.replace(/\/$/, '') ? page : requete, { ignoreSearch: true });
      if (!copie && navigation && !/\.[a-z0-9]+$/i.test(chemin)) copie = await cache.match(new URL(`${chemin}.html`, url.origin), { ignoreSearch: true });
      if (copie) return await propre(copie); // jamais une réponse redirigée servie depuis le cache
    } catch { /* cache illisible : on retombe sur le réseau */ }
    try {
      const reponse = await fetch(requete);
      if (reponse.ok && reponse.type === 'basic' && !reponse.redirected) caches.open(CACHE_APP).then((c) => c.put(requete, reponse.clone())).catch(() => {}); // un fichier de l'appli absent de la liste est gardé à son premier usage
      return reponse;
    } catch (e) {
      if (navigation) { const secours = await caches.match(page).catch(() => null); return secours ? await propre(secours) : Response.error(); }
      throw e;
    }
  })());
});
