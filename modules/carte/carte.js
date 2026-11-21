// Carte Patte : les lieux utiles aux animaux autour de soi, d'après OpenStreetMap.
//   - la position vient du bouton « Autour de moi » (demandée seulement après un toucher) ou d'une ville / d'un code postal ;
//   - une seule recherche à la fois ; la logique (requêtes, cache, limiteur) est dans carte-donnees.js ;
//   - la carte est Leaflet 1.9.4, hébergé dans assets/leaflet/ et chargé seulement quand on ouvre cette page.
// La position n'est jamais enregistrée : elle ne vit que dans la mémoire de la page (etat.centre) et disparaît au rechargement.

import { echapper } from '../../js/utils.js';
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

function chargerLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  chargementLeaflet ??= new Promise((ok, ko) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'assets/leaflet/leaflet.css';
    const js = document.createElement('script');
    js.src = 'assets/leaflet/leaflet.js';
    js.onload = () => ok(window.L);
    js.onerror = () => { chargementLeaflet = null; ko(new Error('Leaflet')); };
    document.head.append(css, js);
  });
  return chargementLeaflet;
}

const puce = (c) => `<span class="ca-puce" style="--ca-c:${c.couleur}" aria-hidden="true">${icone(c.icone, { taille: 16 })}</span>`;
const nomLieu = (l) => l.nom || `${D.categorie(l.cat).un} (sans nom)`;
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        <p class="ca-info">${icone('shield-check', { taille: 16 })}<span>Vie privée : votre position sert seulement à la recherche, sur des serveurs publics OpenStreetMap (Overpass), et n'est pas enregistrée. Seuls les lieux trouvés, avec la zone approximative, sont gardés quelques heures sur cet appareil.</span></p>
      </section>

      <section class="pg-section ca-resultats" aria-labelledby="ca-res" id="ca-resultats">
        <h2 id="ca-res" class="cp-sr">Résultats</h2>
        <p class="ca-statut" id="ca-statut" role="status"></p>
        <div id="ca-erreur"></div>
        <div class="cp-filtres ca-filtres" id="ca-filtres" role="group" aria-label="Types de lieux" hidden>
          ${D.CATEGORIES.map((c) => `<button type="button" class="cp-filtre ca-filtre" aria-pressed="${etat.actives.has(c.id)}" data-cat="${c.id}">${puce(c)}${echapper(c.nom)} <span class="cp-filtre__nombre" data-nombre="${c.id}"></span></button>`).join('')}
        </div>
        <div id="ca-vide" class="cp-carte">${vide({ niveau: 3, icone: 'map-pin', titre: 'Où êtes-vous ?', texte: 'Touchez « Autour de moi », ou entrez une ville ou un code postal : les lieux utiles apparaîtront sur la carte.' })}</div>
        <div id="ca-zone" hidden>
          <div class="ca-carte" id="ca-carte" role="region" aria-label="Carte des lieux"></div>
        </div>
        <article class="cp-carte ca-fiche" id="ca-fiche" tabindex="-1" aria-label="Fiche du lieu" hidden></article>
        <ul class="ca-liste" id="ca-liste"></ul>
        <div class="ca-plus" id="ca-plus" hidden>${bouton({ texte: 'Afficher plus de lieux', variante: 'secondaire', attrs: { id: 'ca-plus-bouton', class: 'cp-btn cp-btn--secondaire' } })}</div>
      </section>
    </div>`;

  const $ = (id) => zone.querySelector(`#${id}`);
  const elStatut = $('ca-statut');
  const elErreur = $('ca-erreur');
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
          ${l.adresse ? `<span class="ca-lieu__adresse">${echapper(l.adresse)}</span>` : ''}
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
        <li>${icone('map-pin', { taille: 18 })}<span>${l.adresse ? echapper(l.adresse) : '<span class="ca-absent">Adresse non indiquée</span>'}</span></li>
        <li>${icone('phone', { taille: 18 })}<span>${l.tel ? echapper(l.tel.affiche) : '<span class="ca-absent">Téléphone non indiqué</span>'}</span></li>
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

  function afficher() {
    afficherStatut();
    afficherErreur();
    afficherFiltres();
    elVide.hidden = !!etat.centre;
    elZone.hidden = !etat.centre;
    afficherListe();
    afficherFiche();
  }

  // ----- La carte Leaflet -----

  function iconeMarqueur(L, l) {
    const c = D.categorie(l.cat);
    return L.divIcon({ className: 'ca-marqueur', html: `<span style="background:${c.couleur}">${icone(c.icone, { taille: 18 })}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
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
      vueCarte = { map, marqueurs: L.layerGroup().addTo(map), parId: new Map(), cercle: null, centre: null };
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
    for (const l of visibles()) {
      const m = L.marker([l.lat, l.lon], { icon: iconeMarqueur(L, l), title: nomLieu(l), alt: nomLieu(l), keyboard: true, riseOnHover: true });
      m.on('click', () => choisir(l.id));
      v.marqueurs.addLayer(m);
      v.parId.set(l.id, m);
    }
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

  function choisir(id) {
    const l = etat.lieux.find((x) => x.id === id);
    if (!l) return;
    etat.selection = id;
    afficherFiche();
    vueCarte?.map.panTo([l.lat, l.lon], { animate: !reduit() });
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
        const { lieux, depuisCache } = await D.lieuxAutour(centre, etat.rayon, (p) => pageActive?.progression(p));
        etat.centre = centre;
        etat.lieux = lieux;
        etat.depuisCache = depuisCache;
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
