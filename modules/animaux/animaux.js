// Module 1 : point d'entrée. Liste des animaux + formulaire d'ajout / modification.
// Adresses gérées :
//   #/animaux            → liste
//   #/animaux/rappels    → rappels
//   #/animaux/<id>       → fiche d'un animal
//   #/animaux/<id>/soin/<idSoin> → fiche, onglet Santé, ce soin mis en évidence (lien « Voir le soin » des rappels)

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, age, redimensionnerPhoto } from '../../js/utils.js';
import { modale, confirmer, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { rafraichir } from '../../js/router.js';
import { bouton, badge, champ, choix, carteAnimal, vide, activerFiltres, PALETTE_ANIMAUX, couleurAnimal } from '../../js/composants.js';
import { ESPECES, infosEspece, nomEspece, erreurChamp } from './commun.js';
import { calculerRappels, rendre as rendreRappels } from './rappels.js';
import { rendre as rendreFiche } from './fiche.js';
import { ajouterExemples } from './exemples.js';

export function rendre(zone, segments) {
  if (segments[0] === 'rappels') return rendreRappels(zone);
  if (segments[0]) return rendreFiche(zone, segments[0], segments[1] === 'soin' ? segments[2] : '');
  rendreListe(zone);
}

// ----- Formulaire (ajout et modification) -----

/** Photo de l'animal, ou à défaut l'icône de son espèce (grand rond du formulaire). */
function apercuHtml(espece, photo, couleur) {
  const contenu = typeof photo === 'string' && photo.startsWith('data:image/')
    ? `<img src="${echapper(photo)}" alt="">`
    : icone(infosEspece({ espece }).icone, { taille: 44 });
  return `<span class="cp-avatar cp-avatar--grand cp-an-${couleur}" aria-hidden="true">${contenu}</span>`;
}

/**
 * Fenêtre « Couleur de … » : ouverte en cliquant sur l'avatar de la fiche. Un clic sur une couleur l'enregistre aussitôt
 * (champ facultatif `couleur` de l'animal ; « Automatique » le vide et rend la couleur choisie d'après l'identifiant).
 */
export function choisirCouleur(animal, apres) {
  const actuelle = PALETTE_ANIMAUX.some((c) => c.id === animal.couleur) ? animal.couleur : '';
  const options = [{ id: '', nom: 'Automatique' }, ...PALETTE_ANIMAUX];
  const html = `
    <p class="cp-doux">Cette couleur est reprise sur l'avatar de ${echapper(animal.nom)} et sur son graphique de poids.</p>
    <div class="cp-choix cp-choix--couleurs" role="group" aria-label="Couleur de ${echapper(animal.nom)}">
      ${options.map((c) => `<button type="button" class="cp-couleur${c.id ? ` cp-an-${c.id}` : ''}" data-couleur="${c.id}" aria-pressed="${c.id === actuelle}"><span>${echapper(c.nom)}</span></button>`).join('')}
    </div>`;
  modale(`Couleur de ${animal.nom}`, html, (dlg) => {
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-couleur]');
      if (!b) return;
      storage.modifier('animaux', animal.id, { couleur: b.dataset.couleur });
      dlg.close();
      toast('Couleur modifiée');
      apres();
    });
    dlg.querySelector('[aria-pressed="true"]')?.focus();
  });
}

export function formulaireAnimal(animal, apres) {
  const a = animal ?? { nom: '', espece: 'chien', especeAutre: '', race: '', naissance: '', photo: '', couleur: '' };
  const couleurInitiale = PALETTE_ANIMAUX.some((c) => c.id === a.couleur) ? a.couleur : ''; // '' = automatique
  let photo = a.photo || '';
  // Une espèce inconnue (fichier d'une version future) est présentée comme « Autre » plutôt que remplacée par « Chien »
  const especeInitiale = ESPECES.some((e) => e.id === a.espece) ? a.espece : 'autre';

  const html = `
    <form class="cp-formulaire al-form" novalidate>
      <div class="al-photo">
        <div data-apercu></div>
        <div class="al-photo__actions">
          <label class="cp-btn cp-btn--secondaire cp-btn--s">${icone('camera', { taille: 16 })}<span>Choisir une photo</span>
            <input type="file" accept="image/*" class="cp-sr" data-fichier>
          </label>
          ${bouton({ texte: 'Retirer la photo', variante: 'discret', taille: 's', attrs: { 'data-retirer': true } })}
        </div>
      </div>
      ${champ({ id: 'animal-nom', label: 'Nom', valeur: a.nom, requis: true, attrs: { name: 'nom', maxlength: 40, autocomplete: 'off' } })}
      ${choix({
        nom: 'espece', legende: 'Espèce', valeur: especeInitiale, classe: 'cp-choix--especes',
        options: ESPECES.map((e) => ({ valeur: e.id, texte: e.nom, icone: e.icone })),
      })}
      <div data-champ-autre>${champ({ id: 'animal-autre', label: "Précisez l'espèce", valeur: a.especeAutre ?? '', placeholder: 'Ex. : Perroquet, Lama…', attrs: { name: 'especeAutre', maxlength: 40 } })}</div>
      ${choix({
        nom: 'couleur', legende: 'Couleur (avatar et graphique)', valeur: couleurInitiale, classe: 'cp-choix--couleurs',
        options: [{ valeur: '', texte: 'Automatique' }, ...PALETTE_ANIMAUX.map((c) => ({ valeur: c.id, texte: c.nom, classe: `cp-an-${c.id}` }))],
      })}
      ${champ({ id: 'animal-race', label: 'Race (facultatif)', valeur: a.race ?? '', attrs: { name: 'race', maxlength: 60 } })}
      ${champ({ id: 'animal-naissance', label: 'Date de naissance (facultatif)', type: 'date', valeur: a.naissance ?? '', attrs: { name: 'naissance', max: aujourdhui() } })}
      <div class="al-form__actions">
        ${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}
        ${bouton({ texte: 'Enregistrer', type: 'submit', icone: 'check' })}
      </div>
    </form>`;

  modale(animal ? `Modifier ${animal.nom}` : 'Nouvel animal', html, (dlg) => {
    const form = dlg.querySelector('form');
    const apercu = dlg.querySelector('[data-apercu]');
    const champAutre = dlg.querySelector('[data-champ-autre]');
    const boutonRetirer = dlg.querySelector('[data-retirer]');

    const majApercu = () => {
      apercu.innerHTML = apercuHtml(form.espece.value, photo, form.couleur.value || couleurAnimal({ id: a.id ?? a.nom })); // sans choix : la couleur automatique
      boutonRetirer.hidden = !photo;
    };
    const majAutre = () => { champAutre.hidden = form.espece.value !== 'autre'; };
    majApercu(); majAutre();

    // Les pastilles d'espèce sont des boutons radio : on écoute le formulaire entier
    form.addEventListener('change', (e) => { if (e.target.name === 'espece') { majApercu(); majAutre(); } else if (e.target.name === 'couleur') majApercu(); });
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) erreurChamp(e.target, ''); });

    dlg.querySelector('[data-fichier]').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      e.target.value = ''; // permet de rechoisir la même photo après l'avoir retirée
      if (!fichier) return;
      try {
        photo = await redimensionnerPhoto(fichier);
        majApercu();
      } catch (err) {
        toast(err.message, 'erreur');
      }
    });
    boutonRetirer.addEventListener('click', () => { photo = ''; majApercu(); });
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const champs = {
        nom: f.get('nom').trim(),
        espece: f.get('espece'),
        especeAutre: f.get('espece') === 'autre' ? f.get('especeAutre').trim() : '',
        race: f.get('race').trim(),
        naissance: f.get('naissance') || '',
        photo,
        couleur: PALETTE_ANIMAUX.some((c) => c.id === f.get('couleur')) ? f.get('couleur') : '', // '' = automatique
      };
      // Vérifications, avec un message clair sous chaque champ concerné
      const problemes = [];
      if (!champs.nom) problemes.push([form.nom, 'Indiquez le nom de votre animal.']);
      if (champs.naissance && champs.naissance > aujourdhui()) problemes.push([form.naissance, 'La date de naissance ne peut pas être dans le futur.']);
      form.querySelectorAll('[aria-invalid]').forEach((c) => erreurChamp(c, ''));
      if (problemes.length) {
        problemes.forEach(([c, m]) => erreurChamp(c, m));
        problemes[0][0].focus();
        return;
      }
      if (animal) {
        storage.modifier('animaux', animal.id, champs);
      } else {
        storage.ajouter('animaux', champs);
      }
      dlg.close();
      toast(animal ? 'Animal modifié' : 'Animal ajouté');
      apres();
    });
  });
}

// ----- Liste -----

const SEUIL_RECHERCHE = 8; // en dessous, la recherche de la barre du haut suffit
const sansAccents = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function carteHtml(animal, rappels) {
  const retard = rappels.filter((r) => r.statut.classe === 'retard').length;
  const semaine = rappels.filter((r) => r.statut.classe === 'semaine').length;
  let badges = '';
  if (retard) badges = badge({ texte: `${pluriel(retard, 'rappel')} en retard`, variante: 'alerte', icone: 'bell-ring' });
  else if (semaine) badges = badge({ texte: `${pluriel(semaine, 'rappel')} cette semaine`, variante: 'attention', icone: 'bell' });
  return carteAnimal({
    nom: animal.nom,
    espece: nomEspece(animal),
    details: [animal.race, animal.naissance ? age(animal.naissance) : 'Âge inconnu'].filter(Boolean).join(' · '),
    icone: infosEspece(animal).icone,
    photo: typeof animal.photo === 'string' && animal.photo.startsWith('data:image/') ? animal.photo : '',
    badges,
    id: animal.id,
    couleur: couleurAnimal(animal),
    href: `#/animaux/${encodeURIComponent(animal.id)}`,
  });
}

/** Résumé des rappels : une petite ligne discrète avec un lien vers la page Rappels (le détail est sur cette page). */
function resumeHtml(rappels) {
  if (!rappels.length) return '';
  const retard = rappels.filter((r) => r.statut.classe === 'retard').length;
  return `
    <p class="al-rappels${retard ? ' al-rappels--retard' : ''}">
      ${icone(retard ? 'bell-ring' : 'bell', { taille: 16 })}
      <span><strong>${pluriel(rappels.length, 'rappel')} à faire</strong>${retard ? `, dont ${retard} en retard` : ''}</span>
      <a class="al-rappels__lien" href="#/animaux/rappels">Voir les rappels ${icone('chevron-right', { taille: 14 })}</a>
    </p>`;
}

function rendreListe(zone) {
  zone.classList.add('page-large');
  const animaux = storage.lister('animaux').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const rappelsParAnimal = new Map();
  const rappels = calculerRappels();
  for (const r of rappels) {
    if (!rappelsParAnimal.has(r.animal.id)) rappelsParAnimal.set(r.animal.id, []);
    rappelsParAnimal.get(r.animal.id).push(r);
  }

  const aDesExemples = animaux.some((a) => a.exemple);

  // Espèces présentes (une espèce inconnue est regroupée avec « Autre »), dans l'ordre habituel des espèces
  const compteurs = new Map();
  for (const a of animaux) compteurs.set(infosEspece(a).id, (compteurs.get(infosEspece(a).id) ?? 0) + 1);
  const especesPresentes = ESPECES.filter((e) => compteurs.has(e.id));

  const enteteHtml = `
    <header class="pg-entete al-entete">
      <div>
        <h1>Mes animaux</h1>
        <p>${animaux.length === 0 ? 'Le carnet de santé de vos compagnons, au même endroit.' : animaux.length === 1 ? '1 animal suivi' : `${animaux.length} animaux suivis`}</p>
      </div>
      ${animaux.length ? bouton({ texte: 'Ajouter un animal', icone: 'plus', attrs: { 'data-act': 'ajouter' } }) : ''}
    </header>`;

  const videHtml = vide({
    niveau: 2,
    icone: 'paw-print',
    titre: "Aucun animal pour l'instant",
    texte: 'Ajoutez votre premier compagnon pour suivre ses soins, ses pesées et ses rappels.',
    action: `${bouton({ texte: 'Ajouter mon premier animal', icone: 'plus', attrs: { 'data-act': 'ajouter' } })}
             ${bouton({ texte: "Remettre les animaux d'exemple", variante: 'discret', attrs: { 'data-act': 'remettre-exemples' } })}`,
  });

  const outilsHtml = `
    <div class="al-outils">
      ${animaux.length >= SEUIL_RECHERCHE ? `
        <div class="cp-champ__zone al-recherche">${icone('search', { taille: 20 })}
          <input type="search" class="cp-input" id="liste-recherche" placeholder="Rechercher par nom, espèce ou race" aria-label="Rechercher un animal dans la liste" autocomplete="off">
        </div>` : ''}
      ${especesPresentes.length > 1 ? `
        <div class="cp-filtres" role="group" aria-label="Filtrer par espèce">
          ${especesPresentes.map((e) => `
            <button type="button" class="cp-filtre" aria-pressed="false" data-valeur="${e.id}">
              ${icone(e.icone, { taille: 18 })}${echapper(e.nom)} <span class="cp-filtre__nombre">${compteurs.get(e.id)}</span>
            </button>`).join('')}
        </div>` : ''}
      <p class="al-resultat" data-resultat role="status" hidden></p>
    </div>`;

  const grilleHtml = `
    <div class="pg-animaux al-grille" data-grille>
      ${animaux.map((a) => carteHtml(a, rappelsParAnimal.get(a.id) ?? [])
        .replace('<a ', `<a data-espece="${infosEspece(a).id}" data-recherche="${echapper(sansAccents([a.nom, nomEspece(a), a.race].join(' ')))}" `)).join('')}
    </div>
    <div class="al-aucun" data-aucun hidden>${vide({
      niveau: 2, icone: 'search', titre: 'Aucun animal ne correspond',
      texte: 'Essayez une autre recherche ou retirez un filtre.',
      action: bouton({ texte: 'Tout afficher', variante: 'secondaire', attrs: { 'data-act': 'reinitialiser' } }),
    })}</div>`;

  zone.innerHTML = `
    <div class="cp pg">
      ${enteteHtml}
      ${animaux.length ? `
        ${resumeHtml(rappels)}
        ${aDesExemples ? `
          <div class="cp-alerte cp-alerte--info al-exemples">
            ${icone('info', { taille: 20 })}
            <div class="cp-alerte__texte">Les animaux marqués « exemple » servent à découvrir l'appli.</div>
            ${bouton({ texte: 'Supprimer les exemples', variante: 'secondaire', taille: 's', attrs: { 'data-act': 'effacer-exemples' } })}
          </div>` : ''}
        ${outilsHtml}
        ${grilleHtml}` : videHtml}
    </div>`;

  // ----- Filtres et recherche (affichage seulement : rien n'est modifié dans les données) -----
  const grille = zone.querySelector('[data-grille]');
  if (grille) {
    const champRecherche = zone.querySelector('#liste-recherche');
    const filtres = zone.querySelector('.cp-filtres');
    const resultat = zone.querySelector('[data-resultat]');
    const aucun = zone.querySelector('[data-aucun]');
    const cartes = [...grille.children];

    const appliquer = () => {
      const actifs = filtres ? [...filtres.querySelectorAll('[aria-pressed="true"]')].map((f) => f.dataset.valeur) : [];
      const mot = sansAccents(champRecherche?.value.trim() ?? '');
      let visibles = 0;
      for (const c of cartes) {
        const ok = (!actifs.length || actifs.includes(c.dataset.espece)) && (!mot || c.dataset.recherche.includes(mot));
        c.hidden = !ok;
        if (ok) visibles++;
      }
      const filtre = actifs.length > 0 || mot !== '';
      aucun.hidden = visibles > 0;
      grille.hidden = visibles === 0;
      resultat.hidden = !filtre;
      resultat.textContent = filtre ? `${visibles} sur ${animaux.length} animaux affichés` : '';
    };
    if (filtres) activerFiltres(filtres, appliquer);
    champRecherche?.addEventListener('input', appliquer);
    zone.addEventListener('click', (e) => {
      if (!e.target.closest('[data-act="reinitialiser"]')) return;
      filtres?.querySelectorAll('[aria-pressed="true"]').forEach((f) => f.setAttribute('aria-pressed', 'false'));
      if (champRecherche) champRecherche.value = '';
      appliquer();
    });
  }

  zone.addEventListener('click', async (e) => {
    const declencheur = e.target.closest('[data-act]');
    if (!declencheur) return;
    switch (declencheur.dataset.act) {
      case 'ajouter':
        formulaireAnimal(null, rafraichir);
        break;
      case 'remettre-exemples':
        ajouterExemples();
        rafraichir();
        break;
      case 'effacer-exemples':
        if (await confirmer('Supprimer les animaux d\'exemple, avec leurs soins et pesées ?')) {
          animaux.filter((a) => a.exemple).forEach((a) => storage.supprimer('animaux', a.id));
          toast('Exemples supprimés');
          rafraichir();
        }
        break;
    }
  });
}
