// Carte Patte : les lieux utiles aux animaux autour de soi, d'après OpenStreetMap.
//   - la position vient du bouton « Autour de moi » (demandée seulement après un toucher) ou d'une ville / d'un code postal ;
//   - une seule recherche à la fois ; la logique (requêtes, cache, limiteur) est dans carte-donnees.js ;
//   - la carte est Leaflet 1.9.4, hébergé dans assets/leaflet/ et chargé seulement quand on ouvre cette page.
// La position n'est jamais enregistrée : elle ne vit que dans la mémoire de la page (etat.centre) et disparaît au rechargement.

import { echapper, formatDateLongue } from '../../js/utils.js';
import { icone } from '../../js/icons.js';
import { bouton, alerte, vide, champ, choix } from '../../js/composants.js';
import * as D from './carte-donnees.js';

// Ce qui est affiché est gardé le temps de la visite : revenir sur la page ne relance aucune requête.
const etat = {
  centre: null,                     // { lat, lon, nom } — en mémoire seulement
  rayon: D.RAYON_DEFAUT_KM,
  actives: new Set(D.CATEGORIES.map((c) => c.id)),
  lieux: [],                        // lieux du rayon, triés par distance
  depuisCache: false,
  source: null,                     // { type: 'locale' | 'overpass', depuisCache, extrait, partiel } : d'où viennent les lieux affichés
  selection: null,                  // id du lieu dont la fiche est ouverte
  nbListe: 20,
  erreur: null,                     // { texte, reessayer }
  occupe: false,
  rayonEnAttente: false,
};
let vueCarte = null;                // { map, marqueurs, parId, cercle, centre } : la carte Leaflet de la page affichée
let chargementLeaflet = null;
let jeton = 0;                      // change à chaque affichage de la page : les réponses qui arrivent trop tard sont ignorées
let pageActive = null;              // { afficher, majCarte, focusVille, progression } de la page actuellement affichée
let minuteurLent = 0;

const SEUIL_BEAUCOUP = 300;           // au-delà, on propose un rayon plus petit

function chargerScript(src) {
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => ko(new Error(src));
    document.head.append(s);
  });
}

/** Leaflet 1.9.4 puis Leaflet.markercluster 1.5.3 (regroupement des marqueurs en bulles), tous deux hébergés dans assets/. Sans le plugin, la carte marche quand même (marqueurs seuls). */
function chargerLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  chargementLeaflet ??= (async () => {
    for (const href of ['assets/leaflet/leaflet.css', 'assets/leaflet-markercluster/MarkerCluster.css']) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = href;
      document.head.append(css);
    }
    await chargerScript('assets/leaflet/leaflet.js');
    try { await chargerScript('assets/leaflet-markercluster/leaflet.markercluster.js'); } catch (e) { console.warn('[Carte Patte] regroupement des marqueurs indisponible :', e.message); }
    return window.L;
  })().catch((e) => { chargementLeaflet = null; throw e; });
  return chargementLeaflet;
}

const puce = (c) => `<span class="ca-puce" style="--ca-c:${c.couleur}" aria-hidden="true">${icone(c.icone, { taille: 16 })}</span>`;
/** Le nom du lieu ; sans nom : la catégorie et la rue la plus proche si elle est connue (« Vétérinaire · rue des Lilas »), sinon « Vétérinaire (sans nom) ». */
const nomLieu = (l) => l.nom || (l.rue ? `${D.categorie(l.cat).un} · ${l.rue}` : `${D.categorie(l.cat).un} (sans nom)`);
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoteSite = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const dateFr = (iso) => { const j = String(iso).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(j) ? formatDateLongue(j) : 'date inconnue'; };

export function rendre(zone) {
  jeton++;
  const moi = jeton;
  if (vueCarte) { try { vueCarte.map.remove(); } catch { /* la page précédente a déjà disparu */ } vueCarte = null; }
  zone.classList.add('page-large');

  zone.innerHTML = `
    <div class="cp pg pg--carte">
      <header class="pg-entete">
        <h1 tabindex="-1">Carte Patte</h1>
        <p>Vétérinaires, parcs à chiens, animaleries, toiletteurs et refuges près de chez vous.</p>
      </header>

      <div class="ca-avertissement">${alerte({ type: 'attention', texte: D.MESSAGE_DONNEES })}</div>

      <section class="cp-carte ca-outils" aria-labelledby="ca-ou">
        <h2 id="ca-ou" class="ca-titre">Où chercher ?</h2>
        <div class="ca-position">
          ${bouton({ texte: 'Autour de moi', icone: 'map-pin', attrs: { id: 'ca-loc', class: 'cp-btn cp-btn--principal ca-loc' } })}
          <form class="ca-ville" id="ca-form" role="search" novalidate>
            ${champ({ id: 'ca-ville', label: 'Ville ou code postal', placeholder: 'Rennes ou 35000', icone: 'search', attrs: { autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'search' } })}
            ${bouton({ texte: 'Chercher', type: 'submit', variante: 'secondaire', attrs: { class: 'cp-btn cp-btn--secondaire ca-chercher', id: 'ca-chercher' } })}
          </form>
        </div>
        ${choix({ nom: 'ca-rayon', legende: 'Rayon de recherche', options: D.RAYONS_KM.map((km) => ({ valeur: String(km), texte: `${km} km` })), valeur: String(etat.rayon), classe: 'ca-rayons' })}
        <p class="ca-info">${icone('shield-check', { taille: 16 })}<span>Vie privée : en France métropolitaine, les lieux viennent de fichiers du site, donc votre position ne quitte pas votre appareil. Ailleurs, la zone approximative (1 km) est envoyée à un serveur public OpenStreetMap, et les lieux trouvés sont gardés quelques heures sur cet appareil. Votre position n'est pas enregistrée.</span></p>
      </section>

      <section class="pg-section ca-resultats" aria-labelledby="ca-res" id="ca-resultats">
        <h2 id="ca-res" class="cp-sr">Résultats</h2>
        <p class="ca-statut" id="ca-statut" role="status"></p>
        <p class="ca-source" id="ca-source" hidden></p>
        <div id="ca-erreur"></div>
        <div id="ca-suggestion" hidden></div>
        <div class="cp-filtres ca-filtres" id="ca-filtres" role="group" aria-label="Types de lieux" hidden>
          ${D.CATEGORIES.map((c) => `<button type="button" class="cp-filtre ca-filtre" style="--ca-c:${c.couleur}" aria-pressed="${etat.actives.has(c.id)}" data-cat="${c.id}">${puce(c)}${echapper(c.nom)} <span class="cp-filtre__nombre" data-nombre="${c.id}"></span></button>`).join('')}
        </div>
        <div id="ca-vide" class="cp-carte">${vide({ niveau: 3, icone: 'map-pin', titre: 'Où êtes-vous ?', texte: 'Touchez « Autour de moi », ou entrez une ville ou un code postal : les lieux utiles apparaîtront sur la carte.' })}</div>
        <div id="ca-zone" hidden>
          <div class="ca-carte" id="ca-carte" role="region" aria-label="Carte des lieux"></div>
        </div>
        <article class="cp-carte ca-fiche" id="ca-fiche" tabindex="-1" aria-label="Fiche du lieu" hidden></article>
        <ul class="ca-liste" id="ca-liste"></ul>
        <div class="ca-plus" id="ca-plus" hidden>${bouton({ texte: 'Afficher plus de lieux', variante: 'secondaire', attrs: { id: 'ca-plus-bouton', class: 'cp-btn cp-btn--secondaire' } })}</div>
        <footer class="ca-licence" id="ca-licence">
          <p>Lieux et fond de carte : © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">contributeurs d'OpenStreetMap</a>, données sous <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">licence ODbL</a>. Les fichiers de lieux préparés à l'avance sont publiés sous la même licence : <a href="donnees/lieux/LICENCE.txt" target="_blank" rel="noopener noreferrer">voir la licence et la source</a>.</p>
        </footer>
      </section>
    </div>`;

  const $ = (id) => zone.querySelector(`#${id}`);
  const elStatut = $('ca-statut');
  const elSource = $('ca-source');
  const elErreur = $('ca-erreur');
  const elSuggestion = $('ca-suggestion');
  const elFiltres = $('ca-filtres');
  const elVide = $('ca-vide');
  const elZone = $('ca-zone');
  const elFiche = $('ca-fiche');
  const elListe = $('ca-liste');
  const elPlus = $('ca-plus');
  const elVille = $('ca-ville');
  const elLoc = $('ca-loc');
  const elChercher = $('ca-chercher');
  const vivante = () => moi === jeton && zone.isConnected;

  const visibles = () => etat.lieux.filter((l) => etat.actives.has(l.cat));

  // ----- Affichage -----

  function afficherStatut() {
    clearTimeout(minuteurLent);
    let texte = '';
    if (etat.occupe) texte = 'Recherche en cours…';
    else if (etat.centre) {
      const n = etat.lieux.length;
      if (!n) texte = `Aucun lieu trouvé dans ${etat.rayon} km autour de ${etat.centre.nom}. OpenStreetMap est parfois incomplet : essayez un rayon plus grand.`;
      else if (!visibles().length) texte = 'Aucun type de lieu sélectionné : touchez un type ci-dessus pour afficher les lieux.';
      else texte = `${pluriel(visibles().length, 'lieu', 'lieux')} dans ${etat.rayon} km autour de ${etat.centre.nom}, du plus proche au plus loin.`;
    }
    elStatut.textContent = texte;
    elStatut.hidden = !texte;
    const s = etat.source;
    let source = '';
    if (s && etat.centre && !etat.occupe) {
      if (s.type === 'locale') source = `Lieux : extrait d'OpenStreetMap du ${dateFr(s.extrait)}, préparé à l'avance et mis à jour chaque mois.${s.partiel ? " Près d'une frontière ou d'une côte : les lieux situés de l'autre côté ne sont pas inclus." : ''}`;
      else source = s.depuisCache ? "Lieux : serveur Overpass d'OpenStreetMap (résultats gardés quelques heures sur cet appareil)." : "Lieux : serveur Overpass d'OpenStreetMap, en direct.";
    }
    elSource.textContent = source;
    elSource.hidden = !source;
    zone.querySelector('#ca-resultats').setAttribute('aria-busy', String(etat.occupe));
    for (const b of [elLoc, elChercher]) b.setAttribute('aria-disabled', String(etat.occupe));
  }

  function afficherErreur() {
    if (!etat.erreur) { elErreur.innerHTML = ''; return; }
    const essais = etat.erreur.essais ?? [];
    const details = essais.length ? `<details class="ca-details"><summary>Détails techniques</summary><ul>${essais.map((x) => `<li><strong>${echapper(x.serveur)}</strong> : ${echapper(x.raison)}</li>`).join('')}</ul></details>` : '';
    elErreur.innerHTML = `<div class="ca-erreur">${alerte({ type: 'erreur', titre: 'La recherche a échoué', texte: etat.erreur.texte })}${details}${etat.erreur.reessayer ? bouton({ texte: 'Réessayer', icone: 'search', attrs: { id: 'ca-reessayer', class: 'cp-btn cp-btn--principal' } }) : ''}</div>`;
  }

  function afficherFiltres() {
    elFiltres.hidden = !etat.centre;
    for (const c of D.CATEGORIES) {
      zone.querySelector(`[data-nombre="${c.id}"]`).textContent = String(etat.lieux.filter((l) => l.cat === c.id).length);
      zone.querySelector(`.ca-filtre[data-cat="${c.id}"]`).setAttribute('aria-pressed', String(etat.actives.has(c.id)));
    }
  }

  function ligneLieu(l) {
    const c = D.categorie(l.cat);
    return `
      <li><button type="button" class="cp-carte ca-lieu" data-id="${echapper(l.id)}"${l.id === etat.selection ? ' aria-current="true"' : ''}>
        ${puce(c)}
        <span class="ca-lieu__corps">
          <span class="ca-lieu__nom">${echapper(nomLieu(l))}</span>
          <span class="ca-lieu__meta">${echapper(c.un)} · ${D.formaterDistance(l.d)}</span>
          ${l.adresse && !(l.rue && l.adresse === l.rue) ? `<span class="ca-lieu__adresse">${echapper(l.adresse)}</span>` : ''}
        </span>
        <span class="ca-lieu__fleche" aria-hidden="true">${icone('chevron-right', { taille: 18 })}</span>
      </button></li>`;
  }

  function afficherListe() {
    const tous = visibles();
    elListe.innerHTML = tous.slice(0, etat.nbListe).map(ligneLieu).join('');
    elPlus.hidden = tous.length <= etat.nbListe;
  }

  function ficheHtml(l) {
    const c = D.categorie(l.cat);
    const h = D.horaires(l.horaires);
    return `
      <header class="ca-fiche__tete">
        ${puce(c)}
        <div class="ca-fiche__titre">
          <h3 tabindex="-1">${echapper(nomLieu(l))}</h3>
          <p class="ca-fiche__meta">${echapper(c.un)} · à ${D.formaterDistance(l.d)}</p>
        </div>
        ${bouton({ seul: true, variante: 'discret', icone: 'x', titre: 'Fermer la fiche', attrs: { id: 'ca-fermer', class: 'cp-btn cp-btn--discret cp-btn--icone', 'aria-label': 'Fermer la fiche' } })}
      </header>
      <ul class="ca-fiche__infos">
        <li>${icone('map-pin', { taille: 18 })}<span>${l.adresse ? echapper(l.adresse) : l.rue ? `Près de : ${echapper(l.rue)}<span class="ca-note"> (rue la plus proche d'après OpenStreetMap, à confirmer)</span>` : '<span class="ca-absent">Adresse non indiquée</span>'}</span></li>
        <li>${icone('phone', { taille: 18 })}<span>${l.tel ? echapper(l.tel.affiche) : '<span class="ca-absent">Téléphone non indiqué</span>'}</span></li>
        ${l.site ? `<li>${icone('globe', { taille: 18 })}<span><a href="${echapper(l.site)}" target="_blank" rel="noopener noreferrer">Site web<span class="ca-note"> (${echapper(hoteSite(l.site))})</span><span class="cp-sr"> — s'ouvre dans un nouvel onglet</span></a></span></li>` : ''}
        <li>${icone('clock', { taille: 18 })}<span>${h ? `${echapper(h.texte)}<span class="ca-note"> (horaires indiqués dans OpenStreetMap, à confirmer)</span>` : '<span class="ca-absent">Horaires non indiqués</span>'}</span></li>
      </ul>
      <div class="ca-fiche__actions">
        ${bouton({ texte: 'Itinéraire', icone: 'compass', href: D.lienItineraire(l), attrs: { target: '_blank', rel: 'noopener noreferrer', class: 'cp-btn cp-btn--principal', 'aria-label': `Itinéraire vers ${nomLieu(l)} (ouvre une application de cartes)` } })}
        ${l.tel ? bouton({ texte: 'Appeler', icone: 'phone', variante: 'secondaire', href: `tel:${l.tel.lien}`, attrs: { class: 'cp-btn cp-btn--secondaire', 'aria-label': `Appeler ${nomLieu(l)}` } }) : ''}
      </div>
      <p class="ca-fiche__osm"><a href="${D.lienOsm(l)}" target="_blank" rel="noopener noreferrer">Corriger ou compléter ce lieu sur OpenStreetMap</a></p>`;
  }

  function afficherFiche() {
    const l = etat.lieux.find((x) => x.id === etat.selection);
    elFiche.hidden = !l;
    elFiche.innerHTML = l ? ficheHtml(l) : '';
    if (l) elFiche.setAttribute('aria-label', `Fiche : ${nomLieu(l)}`);
    elListe.querySelectorAll('.ca-lieu').forEach((b) => { if (b.dataset.id === etat.selection) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    vueCarte?.parId.forEach((m, id) => m.getElement()?.classList.toggle('is-selection', id === etat.selection));
  }

  /** Plus de 300 lieux dans le rayon : on propose le plus grand rayon plus petit qui en garde 300 au plus (au pire 2 km). */
  function afficherSuggestion() {
    const n = etat.lieux.length;
    const plusPetits = [...D.RAYONS_KM].filter((r) => r < etat.rayon).sort((a, b) => b - a);
    const propose = plusPetits.find((r) => etat.lieux.filter((l) => l.d <= r * 1000).length <= SEUIL_BEAUCOUP) ?? D.RAYONS_KM[0];
    const montrer = !!etat.centre && !etat.occupe && n > SEUIL_BEAUCOUP && plusPetits.length > 0;
    elSuggestion.hidden = !montrer;
    elSuggestion.innerHTML = montrer
      ? `<div class="ca-suggestion">${alerte({ type: 'info', texte: `Beaucoup de lieux ici (${n}) : passer à ${propose} km ?` })}${bouton({ texte: `Passer à ${propose} km`, icone: 'search', variante: 'secondaire', attrs: { id: 'ca-suggestion-bouton', 'data-rayon': String(propose), class: 'cp-btn cp-btn--secondaire' } })}</div>`
      : '';
  }

  function afficher() {
    afficherStatut();
    afficherErreur();
    afficherSuggestion();
    afficherFiltres();
    elVide.hidden = !!etat.centre;
    elZone.hidden = !etat.centre;
    afficherListe();
    afficherFiche();
  }

  // ----- La carte Leaflet -----

  const iconesParCategorie = new Map();
  function iconeMarqueur(L, l) {
    if (!iconesParCategorie.has(l.cat)) {
      const c = D.categorie(l.cat);
      iconesParCategorie.set(l.cat, L.divIcon({ className: 'ca-marqueur', html: `<span style="background:${c.couleur}">${icone(c.icone, { taille: 18 })}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] }));
    }
    return iconesParCategorie.get(l.cat);
  }

  /** Les marqueurs proches se regroupent en bulles avec le nombre de lieux ; une bulle s'ouvre au toucher (zoom) ou en zoomant la carte. */
  function groupeDeMarqueurs(L) {
    if (!L.markerClusterGroup) return L.layerGroup();
    return L.markerClusterGroup({
      showCoverageOnHover: false, zoomToBoundsOnClick: true, spiderfyOnMaxZoom: true, maxClusterRadius: 50, chunkedLoading: true, animate: !reduit(),
      iconCreateFunction: (groupe) => {
        const n = groupe.getChildCount();
        const taille = n < 10 ? 'petit' : n < 50 ? 'moyen' : 'grand';
        return L.divIcon({ className: `ca-groupe ca-groupe--${taille}`, iconSize: [44, 44],
          html: `<span class="ca-groupe__n" aria-hidden="true">${n}</span><span class="cp-sr">${n} lieux regroupés, touchez pour zoomer</span>` });
      },
    });
  }

  async function majCarte(recentrer) {
    if (!etat.centre) return;
    let L;
    try { L = await chargerLeaflet(); } catch {
      if (vivante()) elZone.innerHTML = `<p class="ca-absent ca-carte-absente">${icone('triangle-alert', { taille: 18 })}La carte n'a pas pu se charger. La liste ci-dessous reste disponible.</p>`;
      return;
    }
    if (!vivante()) return;
    if (!vueCarte) {
      const map = L.map($('ca-carte'), { scrollWheelZoom: false, zoomControl: true });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      vueCarte = { map, marqueurs: groupeDeMarqueurs(L).addTo(map), parId: new Map(), cercle: null, centre: null };
      recentrer = true;
    }
    const v = vueCarte;
    v.map.invalidateSize();
    if (recentrer) {
      v.cercle?.remove();
      v.centre?.remove();
      const pos = [etat.centre.lat, etat.centre.lon];
      // La vue d'abord (le cercle de recherche en a besoin pour se dessiner), puis le cercle et le point de départ
      v.map.fitBounds(L.latLng(pos).toBounds(etat.rayon * 2000), { padding: [12, 12], animate: false });
      v.cercle = L.circle(pos, { radius: etat.rayon * 1000, className: 'ca-cercle', weight: 2, dashArray: '6 6', fillOpacity: 0.06, interactive: false }).addTo(v.map);
      v.centre = L.marker(pos, { icon: L.divIcon({ className: 'ca-centre', html: '<span></span>', iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: false, keyboard: false }).addTo(v.map);
    }
    v.marqueurs.clearLayers();
    v.parId.clear();
    const marqueurs = [];
    for (const l of visibles()) {
      const m = L.marker([l.lat, l.lon], { icon: iconeMarqueur(L, l), title: nomLieu(l), alt: nomLieu(l), keyboard: true, riseOnHover: true });
      m.on('click', () => choisir(l.id));
      // un marqueur qui sort d'une bulle (zoom) retrouve sa mise en évidence s'il est le lieu choisi
      m.on('add', () => m.getElement()?.classList.toggle('is-selection', l.id === etat.selection));
      marqueurs.push(m);
      v.parId.set(l.id, m);
    }
    if (v.marqueurs.addLayers) v.marqueurs.addLayers(marqueurs); else marqueurs.forEach((m) => v.marqueurs.addLayer(m));
    afficherFiche();
  }

  /** Pendant une recherche : dit quel serveur on essaie, et prévient quand il est lent (le serveur principal peut mettre 30 à 45 s). */
  function progression({ rang, total }) {
    clearTimeout(minuteurLent);
    const base = rang === 0 ? 'Recherche en cours…' : `Recherche en cours… le serveur précédent n'a pas répondu, essai du serveur ${rang + 1} sur ${total}.`;
    elStatut.hidden = false;
    elStatut.textContent = base;
    minuteurLent = setTimeout(() => { elStatut.textContent = `${base} Le serveur est lent, merci de patienter (jusqu'à une minute).`; }, 8000);
  }

  // ----- Choisir un lieu : la fiche s'ouvre sous la carte -----

  /**
   * Le lieu choisi est peut-être caché dans une bulle : on zoome sur lui jusqu'à ce qu'il en sorte (et on déplie la bulle s'il reste collé à d'autres).
   * (Pas de zoomToShowLayer du plugin : il laisse un écouteur en attente si les marqueurs sont remplacés entre-temps, et il plante à chaque déplacement.)
   */
  function faireApparaitre(m, l) {
    if (!vueCarte) return;
    const { map, marqueurs } = vueCarte;
    const pos = [l.lat, l.lon];
    if (!m || !marqueurs.getVisibleParent || !marqueurs.hasLayer(m)) { map.panTo(pos, { animate: !reduit() }); return; }
    const deplier = () => {
      if (vueCarte?.map !== map || !marqueurs.hasLayer(m)) return;
      const parent = marqueurs.getVisibleParent(m);
      if (parent && parent !== m && parent.spiderfy) parent.spiderfy();
      afficherFiche();
    };
    if (marqueurs.getVisibleParent(m) === m && map.getBounds().contains(m.getLatLng())) { map.panTo(pos, { animate: !reduit() }); return; }
    const zoom = Math.max(map.getZoom(), 16);
    if (map.getZoom() >= zoom && map.distance(map.getCenter(), pos) < 2) { deplier(); return; } // déjà centré dessus : seule une bulle collée peut encore le cacher
    map.once('moveend', () => setTimeout(deplier, 400)); // le temps que la bulle se défasse
    map.setView(pos, zoom, { animate: !reduit() });
  }

  function choisir(id) {
    const l = etat.lieux.find((x) => x.id === id);
    if (!l) return;
    etat.selection = id;
    afficherFiche();
    faireApparaitre(vueCarte?.parId.get(id), l);
    elFiche.focus({ preventScroll: true });
    elFiche.scrollIntoView({ block: 'nearest', behavior: reduit() ? 'auto' : 'smooth' });
  }

  function fermerFiche() {
    const id = etat.selection;
    etat.selection = null;
    afficherFiche();
    (elListe.querySelector(`.ca-lieu[data-id="${CSS.escape(id)}"]`) ?? zone.querySelector('.ca-carte'))?.focus({ preventScroll: true });
  }

  // ----- Recherche : une à la fois, jamais en parallèle -----

  /** `trouverCentre` renvoie le point de départ (position, ville ou centre déjà connu). */
  async function chercher(trouverCentre) {
    const lancee = await D.exclusif(async () => {
      etat.occupe = true;
      etat.erreur = null;
      afficher();
      try {
        const centre = await trouverCentre();
        const resultat = await D.lieuxAutour(centre, etat.rayon, (p) => pageActive?.progression(p));
        etat.centre = centre;
        etat.lieux = resultat.lieux;
        etat.depuisCache = resultat.depuisCache;
        etat.source = { type: resultat.source, depuisCache: resultat.depuisCache, extrait: resultat.extrait, partiel: resultat.partiel };
        etat.selection = null;
        etat.nbListe = 20;
        etat.rayonEnAttente = false;
      } catch (e) {
        const code = e?.code;
        const texte = e instanceof D.ErreurCarte ? e.message : D.MESSAGES.serveur;
        etat.erreur = { texte, essais: e?.essais ?? [], reessayer: code && code.startsWith('ville-') ? null : () => chercher(trouverCentre), ville: !!code?.startsWith('ville-') };
      } finally {
        etat.occupe = false;
      }
    });
    // La réponse arrive peut-être après un changement de page : c'est la page affichée maintenant qui se met à jour
    const page = pageActive;
    if (!lancee || !page) return;
    page.afficher();
    if (etat.erreur?.ville) page.focusVille();
    await page.majCarte(true);
    // Le rayon a été changé pendant la recherche : on relance une fois, avec le centre déjà trouvé
    if (etat.rayonEnAttente && etat.centre) { etat.rayonEnAttente = false; const c = etat.centre; chercher(async () => c); }
  }

  let localisationEnCours = false;
  function localiser() {
    if (etat.occupe || localisationEnCours) return;
    const echec = (texte, reessayer) => {
      localisationEnCours = false;
      if (!vivante()) return;
      etat.erreur = { texte, reessayer };
      afficher();
      if (!reessayer) elVille.focus();
    };
    if (!('geolocation' in navigator)) { echec("Votre appareil ne permet pas la localisation. Entrez une ville ou un code postal ci-dessus."); return; }
    localisationEnCours = true;
    etat.erreur = null;
    elStatut.hidden = false;
    elStatut.textContent = 'Localisation en cours… acceptez la demande de votre appareil.';
    navigator.geolocation.getCurrentPosition(
      (p) => {
        localisationEnCours = false;
        if (!vivante()) return;
        const centre = { lat: p.coords.latitude, lon: p.coords.longitude, nom: 'votre position' };
        chercher(async () => centre);
      },
      (e) => {
        if (e.code === 1) echec("La localisation est refusée pour ce site. Pas de souci : entrez une ville ou un code postal ci-dessus.");
        else if (e.code === 3) echec('La localisation met trop de temps. Réessayez, ou entrez une ville ou un code postal.', localiser);
        else echec('Votre position est introuvable pour le moment. Réessayez, ou entrez une ville ou un code postal.', localiser);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }

  // ----- Écouteurs -----

  elLoc.addEventListener('click', localiser);
  $('ca-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (etat.occupe) return;
    const texte = elVille.value;
    elVille.blur(); // cache le clavier de l'iPhone pour voir les résultats
    chercher(() => D.trouverVille(texte));
  });
  zone.querySelector('.ca-rayons').addEventListener('change', (e) => {
    etat.rayon = Number(e.target.value);
    if (!etat.centre) return;
    if (etat.occupe) { etat.rayonEnAttente = true; return; }
    const c = etat.centre;
    chercher(async () => c);
  });
  elFiltres.addEventListener('click', (e) => {
    const b = e.target.closest('.ca-filtre');
    if (!b) return;
    const id = b.dataset.cat;
    if (etat.actives.has(id)) etat.actives.delete(id); else etat.actives.add(id);
    if (etat.selection && !etat.lieux.some((l) => l.id === etat.selection && etat.actives.has(l.cat))) etat.selection = null;
    etat.nbListe = 20;
    afficherStatut();
    afficherFiltres();
    afficherListe();
    afficherFiche();
    majCarte(false);
  });
  elSuggestion.addEventListener('click', (e) => {
    const b = e.target.closest('#ca-suggestion-bouton');
    const radio = b && zone.querySelector(`input[name=ca-rayon][value="${b.dataset.rayon}"]`);
    if (!radio) return;
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  });
  elListe.addEventListener('click', (e) => { const b = e.target.closest('.ca-lieu'); if (b) choisir(b.dataset.id); });
  elFiche.addEventListener('click', (e) => { if (e.target.closest('#ca-fermer')) fermerFiche(); });
  zone.querySelector('#ca-plus-bouton').addEventListener('click', () => {
    const avant = etat.nbListe;
    etat.nbListe += 20;
    afficherListe();
    elListe.children[avant]?.querySelector('.ca-lieu')?.focus();
  });
  elErreur.addEventListener('click', (e) => { if (e.target.closest('#ca-reessayer')) etat.erreur?.reessayer?.(); });

  pageActive = { afficher, majCarte, progression, focusVille: () => elVille.focus() };
  afficher();
  if (etat.centre) majCarte(true);
}
