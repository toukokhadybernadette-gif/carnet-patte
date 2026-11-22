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
//  - Imposer une vieille version : une nouvelle version s'installe en attente, la page affiche « Nouvelle version disponible »
//    et ne la prend qu'après un clic sur « Mettre à jour » (message SKIP_WAITING).
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

self.addEventListener('install', (evenement) => {
  if (MODE_DEV) { self.skipWaiting(); return; }
  evenement.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    // cache: 'reload' : on prend les fichiers sur le serveur, jamais dans le cache HTTP du navigateur (c'est ce qui bloquait de vieilles versions)
    await Promise.all(FICHIERS.map(async (f) => {
      const reponse = await fetch(new Request(new URL(f, racine), { cache: 'reload' }));
      if (!reponse.ok) throw new Error(`${f} : HTTP ${reponse.status}`); // un fichier manquant annule l'installation : jamais de version à moitié en cache
      await cache.put(new URL(f, racine), reponse);
    }));
    // Première installation : rien à remplacer, on prend la main tout de suite. Sinon on attend le clic sur « Mettre à jour ».
    if (!self.registration.active) self.skipWaiting();
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
    const cache = await caches.open(CACHE_APP);
    // La racine de l'appli (/) donne la page ; une autre page du site (demenagement.html, ou /demenagement sans « .html » comme sur Cloudflare Pages) donne SA page
    const navigation = requete.mode === 'navigate';
    const chemin = url.pathname.replace(/\/$/, '');
    let copie = await cache.match(navigation && chemin === racine.pathname.replace(/\/$/, '') ? page : requete, { ignoreSearch: true });
    if (!copie && navigation && !/\.[a-z0-9]+$/i.test(chemin)) copie = await cache.match(new URL(`${chemin}.html`, url.origin), { ignoreSearch: true });
    if (copie) return copie;
    try {
      const reponse = await fetch(requete);
      if (reponse.ok && reponse.type === 'basic') cache.put(requete, reponse.clone()); // un fichier de l'appli absent de la liste est gardé à son premier usage
      return reponse;
    } catch (e) {
      if (requete.mode === 'navigate') return (await cache.match(page)) ?? Response.error();
      throw e;
    }
  })());
});
