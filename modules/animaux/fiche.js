// Fiche d'un animal : en-tête, chiffres clés, et quatre onglets (Santé, Poids, Historique, Documents).

import * as storage from '../../js/storage.js';
import { echapper, age, formatDate, formatPoids, aujourdhui } from '../../js/utils.js';
import { confirmer, toast } from '../../js/ui.js';
import { rafraichir } from '../../js/router.js';
import { icone } from '../../js/icons.js';
import { bouton, badge, vide, activerOnglets } from '../../js/composants.js';
import { infosEspece, nomEspece, infosType, statutRappel } from './commun.js';
import { calculerRappels } from './rappels.js';
import { formulaireAnimal } from './animaux.js';
import * as soins from './soins.js';
import * as pesees from './pesees.js';

// Onglet affiché : mémorisé pendant la visite, pour ne pas revenir à « Santé » après une modification
let memoire = { id: null, onglet: 'sante' };
const ONGLETS = [
  { id: 'sante', nom: 'Santé', icone: 'stethoscope' },
  { id: 'poids', nom: 'Poids', icone: 'scale' },
  { id: 'historique', nom: 'Historique', icone: 'calendar' },
  { id: 'documents', nom: 'Documents', icone: 'image' },
];

const PAS_HISTORIQUE = 30; // nombre d'événements affichés à la fois
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function avatarGrand(animal) {
  const contenu = typeof animal.photo === 'string' && animal.photo.startsWith('data:image/')
    ? `<img src="${echapper(animal.photo)}" alt="">`
    : icone(infosEspece(animal).icone, { taille: 56 });
  return `<span class="cp-avatar fi-avatar" aria-hidden="true">${contenu}</span>`;
}

// ----- Données de l'animal (toujours filtrées sur son identifiant) -----

const soinsDe = (animal) => storage.lister('soins').filter((s) => s.animalId === animal.id);
const peseesDe = (animal) => storage.lister('pesees').filter((p) => p.animalId === animal.id)
  .sort((a, b) => a.date.localeCompare(b.date));

// ----- Chiffres clés -----

function carteChiffre({ libelle, icone: nomIcone, valeur, sous, videTexte, ton = '', aide = '' }) {
  return `
    <div class="cp-carte cp-stat fi-chiffre${ton ? ` fi-chiffre--${ton}` : ''}" role="group" aria-label="${echapper(libelle)}">
      <div class="cp-stat__tete"><span>${echapper(libelle)}</span><span class="cp-stat__icone">${icone(nomIcone, { taille: 20 })}</span></div>
      ${valeur
        ? `<span class="cp-stat__valeur">${echapper(valeur)}</span>`
        : `<span class="fi-chiffre__vide">${echapper(videTexte)}</span>`}
      ${sous ? `<span class="fi-chiffre__sous">${echapper(sous)}</span>` : ''}
      ${!valeur && aide ? `<span class="fi-chiffre__sous">${echapper(aide)}</span>` : ''}
    </div>`;
}

function chiffresHtml(animal) {
  // Âge
  const ageTexte = animal.naissance ? age(animal.naissance) : '';
  const cAge = carteChiffre({
    libelle: 'Âge', icone: 'calendar', valeur: ageTexte,
    sous: ageTexte ? `Né(e) le ${formatDate(animal.naissance)}` : '',
    videTexte: 'Non renseigné', aide: 'Ajoutez la date de naissance avec « Modifier ».',
  });

  // Dernier poids
  const liste = peseesDe(animal);
  const derniere = liste[liste.length - 1];
  let sousPoids = '';
  if (derniere) {
    sousPoids = `Le ${formatDate(derniere.date)}`;
    const precedente = liste[liste.length - 2];
    if (precedente) {
      const diff = Math.round((derniere.poidsKg - precedente.poidsKg) * 1000) / 1000;
      if (diff !== 0) sousPoids += ` · ${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('fr-FR')} kg`;
    }
  }
  const cPoids = carteChiffre({
    libelle: 'Dernier poids', icone: 'scale', valeur: derniere ? formatPoids(derniere.poidsKg) : '', sous: sousPoids,
    videTexte: 'Aucune pesée', aide: "Ajoutez-en une dans l'onglet Poids.",
  });

  // Prochain rappel : le plus urgent (calculerRappels trie du plus en retard au plus lointain)
  const prochain = calculerRappels().find((r) => r.animal.id === animal.id);
  const type = prochain && infosType(prochain.soin.type);
  const cRappel = carteChiffre({
    libelle: 'Prochain rappel', icone: prochain && prochain.statut.classe === 'retard' ? 'bell-ring' : 'bell',
    valeur: prochain ? prochain.statut.texte : '',
    sous: prochain ? `${[type.nom, prochain.soin.titre].filter(Boolean).join(' — ')} · ${formatDate(prochain.soin.rappel)}` : '',
    ton: prochain ? (prochain.statut.classe === 'retard' ? 'retard' : prochain.statut.classe === 'semaine' ? 'semaine' : '') : '',
    videTexte: 'Aucun rappel prévu', aide: 'Programmez-en un depuis un soin.',
  });
  return cAge + cPoids + cRappel;
}

// ----- Historique (lecture seule) -----

/** Tous les événements de l'animal, du plus récent au plus ancien. */
function evenements(animal) {
  const ev = [];
  const aujourd = aujourdhui();
  if (animal.naissance && animal.naissance <= aujourd) {
    ev.push({ date: animal.naissance, rang: 0, icone: 'heart', titre: 'Naissance', detail: '' });
  }
  for (const s of soinsDe(animal)) {
    const type = infosType(s.type);
    ev.push({ date: s.date, rang: 2, icone: type.icone, titre: [type.nom, s.titre].filter(Boolean).join(' — '), detail: s.notes || '' });
    const statut = statutRappel(s);
    if (statut) {
      const variante = { retard: 'alerte', semaine: 'attention', 'plus-tard': 'succes' }[statut.classe];
      ev.push({ date: s.rappel, rang: 3, icone: 'bell', titre: `Rappel : ${[type.nom, s.titre].filter(Boolean).join(' — ')}`, detail: '',
        badge: badge({ texte: statut.texte, variante }) });
    }
  }
  const liste = peseesDe(animal);
  liste.forEach((p, i) => {
    let detail = '';
    if (i > 0) {
      const diff = Math.round((p.poidsKg - liste[i - 1].poidsKg) * 1000) / 1000;
      if (diff !== 0) detail = `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('fr-FR')} kg depuis la pesée précédente`;
    }
    ev.push({ date: p.date, rang: 1, icone: 'scale', titre: `Pesée : ${formatPoids(p.poidsKg)}`, detail });
  });
  return ev.sort((a, b) => b.date.localeCompare(a.date) || b.rang - a.rang);
}

function historiqueHtml(animal, limite) {
  const tous = evenements(animal);
  if (!tous.length) {
    return vide({ niveau: 3, icone: 'calendar', titre: 'Rien dans l\'historique pour l\'instant',
      texte: 'Les soins, les pesées et la date de naissance apparaîtront ici, du plus récent au plus ancien.' });
  }
  const visibles = tous.slice(0, limite);
  const parAnnee = new Map();
  for (const e of visibles) {
    const annee = e.date.slice(0, 4);
    if (!parAnnee.has(annee)) parAnnee.set(annee, []);
    parAnnee.get(annee).push(e);
  }
  const groupes = [...parAnnee].map(([annee, liste]) => `
    <section class="fi-annee">
      <h3 class="fi-annee__titre">${annee}</h3>
      <ol class="fi-histo">
        ${liste.map((e) => `
          <li class="fi-histo__ligne">
            <span class="fi-histo__icone">${icone(e.icone, { taille: 18 })}</span>
            <div class="fi-histo__corps">
              <div class="fi-histo__titre"><strong>${echapper(e.titre)}</strong>${e.badge ?? ''}</div>
              <time class="fi-histo__date" datetime="${e.date}">${formatDate(e.date)}</time>
              ${e.detail ? `<span class="fi-histo__detail">${echapper(e.detail)}</span>` : ''}
            </div>
          </li>`).join('')}
      </ol>
    </section>`).join('');
  const reste = tous.length - visibles.length;
  return `
    <p class="fi-histo__resume">${pluriel(tous.length, 'événement')} · du plus récent au plus ancien</p>
    ${groupes}
    ${reste > 0 ? `<div class="fi-histo__plus">${bouton({ texte: `Afficher les ${Math.min(reste, PAS_HISTORIQUE)} suivants (${reste} restants)`, variante: 'secondaire', attrs: { 'data-plus': true } })}</div>` : ''}`;
}

// ----- Page -----

/** `soinCible` (facultatif) : identifiant d'un soin à mettre en évidence dans l'onglet Santé. */
export function rendre(zone, id, soinCible = '') {
  zone.classList.add('page-large');
  const animal = storage.trouver('animaux', id);
  if (!animal) {
    zone.innerHTML = `
      <div class="cp pg">${vide({
        niveau: 1, icone: 'circle-help', titre: "Cet animal n'existe pas (ou plus).",
        texte: 'Il a peut-être été supprimé.',
        action: bouton({ texte: 'Retour à mes animaux', icone: 'arrow-left', href: '#/animaux' }),
      })}</div>`;
    return;
  }

  if (memoire.id !== animal.id) memoire = { id: animal.id, onglet: 'sante' };
  if (soinCible) memoire.onglet = 'sante';

  const details = [nomEspece(animal), animal.race].filter(Boolean).map(echapper).join(' · ');
  const idOnglet = (o) => `fi-onglet-${o}`;
  const idPanneau = (o) => `fi-panneau-${o}`;

  zone.innerHTML = `
    <div class="cp pg fi-page">
      <a class="pg-lien fi-retour" href="#/animaux">${icone('arrow-left', { taille: 18 })} Mes animaux</a>

      <section class="cp-carte fi-entete" aria-label="Identité de l'animal">
        ${avatarGrand(animal)}
        <div class="fi-entete__texte">
          <h1>${echapper(animal.nom)}</h1>
          <p class="fi-entete__espece">${details}</p>
          <p class="fi-entete__naissance">${animal.naissance ? `Né(e) le ${formatDate(animal.naissance)} · ${age(animal.naissance)}` : 'Date de naissance inconnue'}</p>
        </div>
        <div class="fi-entete__actions">
          ${bouton({ texte: 'Modifier', variante: 'secondaire', icone: 'pencil', attrs: { 'data-act': 'modifier' } })}
          ${bouton({ texte: 'Supprimer', variante: 'secondaire', icone: 'trash-2', attrs: { 'data-act': 'supprimer', class: 'cp-btn cp-btn--secondaire fi-danger' } })}
        </div>
      </section>

      <section class="fi-chiffres" aria-label="Chiffres clés" data-chiffres>${chiffresHtml(animal)}</section>

      <div class="fi-onglets" data-onglets>
        <div class="cp-onglets" role="tablist" aria-label="Fiche de ${echapper(animal.nom)}">
          ${ONGLETS.map((o) => `
            <button type="button" class="cp-onglet" role="tab" id="${idOnglet(o.id)}" aria-controls="${idPanneau(o.id)}"
              aria-selected="${o.id === memoire.onglet}" data-onglet="${o.id}">${icone(o.icone, { taille: 18 })}<span>${o.nom}</span></button>`).join('')}
        </div>
        <div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('sante')}" aria-labelledby="${idOnglet('sante')}" tabindex="0"><div id="zone-soins"></div></div>
        <div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('poids')}" aria-labelledby="${idOnglet('poids')}" tabindex="0" hidden><div id="zone-pesees"></div></div>
        <div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('historique')}" aria-labelledby="${idOnglet('historique')}" tabindex="0" hidden>
          <section class="cp-carte fi-historique"><h2>Historique</h2><div data-historique></div></section>
        </div>
        <div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('documents')}" aria-labelledby="${idOnglet('documents')}" tabindex="0" hidden>
          <section class="cp-carte">${vide({
            niveau: 2, icone: 'image', titre: 'Documents',
            texte: "Cette section n'est pas encore disponible.",
            action: badge({ texte: 'Bientôt disponible', variante: 'bientot' }),
          })}</section>
        </div>
      </div>
    </div>`;

  soins.rendre(zone.querySelector('#zone-soins'), animal);
  if (soinCible) {
    // Seuls les soins de CET animal sont dans #zone-soins : un soin d'un autre animal n'est jamais trouvé ici
    const carte = zone.querySelector(`#zone-soins [data-soin="${CSS.escape(soinCible)}"]`);
    if (carte) {
      carte.classList.add('sn-carte--cible');
      carte.tabIndex = -1;
      // après le retour en haut de page fait par le routeur lors d'un changement d'adresse
      setTimeout(() => {
        carte.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        carte.focus({ preventScroll: true });
      });
    } else {
      toast("Ce soin n'existe plus dans la fiche de cet animal.", 'info');
    }
  }
  pesees.rendre(zone.querySelector('#zone-pesees'), animal);

  // Onglets
  const racineOnglets = zone.querySelector('[data-onglets]');
  activerOnglets(racineOnglets);
  racineOnglets.querySelector('[role="tablist"]').addEventListener('click', (e) => {
    const o = e.target.closest('[data-onglet]');
    if (o) memoire.onglet = o.dataset.onglet;
  });
  racineOnglets.querySelector('[role="tablist"]').addEventListener('keydown', () => {
    // les flèches changent d'onglet : on relit celui qui est sélectionné une fois le changement fait
    setTimeout(() => { memoire.onglet = racineOnglets.querySelector('[role="tab"][aria-selected="true"]').dataset.onglet; });
  });

  // Historique et chiffres clés : recalculés à chaque fois que les soins ou les pesées se réaffichent
  let limite = PAS_HISTORIQUE;
  const zoneHistorique = zone.querySelector('[data-historique]');
  const majDerivees = () => {
    zone.querySelector('[data-chiffres]').innerHTML = chiffresHtml(animal);
    zoneHistorique.innerHTML = historiqueHtml(animal, limite);
  };
  majDerivees();
  const observateur = new MutationObserver(majDerivees);
  for (const z of ['#zone-soins', '#zone-pesees']) observateur.observe(zone.querySelector(z), { childList: true });
  zoneHistorique.addEventListener('click', (e) => {
    if (!e.target.closest('[data-plus]')) return;
    limite += PAS_HISTORIQUE;
    zoneHistorique.innerHTML = historiqueHtml(animal, limite);
  });

  // Modifier / Supprimer
  zone.querySelector('.fi-entete').addEventListener('click', async (e) => {
    const declencheur = e.target.closest('[data-act]');
    if (!declencheur) return;
    if (declencheur.dataset.act === 'modifier') {
      formulaireAnimal(animal, rafraichir);
    } else if (declencheur.dataset.act === 'supprimer') {
      // Comportement inchangé : storage.supprimer retire l'animal ET ses soins et pesées. On le dit précisément.
      const nbSoins = soinsDe(animal).length;
      const nbPesees = peseesDe(animal).length;
      const liees = [nbSoins && pluriel(nbSoins, 'soin'), nbPesees && pluriel(nbPesees, 'pesée')].filter(Boolean).join(' et ');
      const message = `Supprimer ${animal.nom} ? ${liees ? `Seront aussi supprimés : ${liees}.` : 'Aucun soin ni pesée ne lui est associé.'} Cette action est définitive.`;
      if (await confirmer(message)) {
        storage.supprimer('animaux', animal.id);
        toast(`${animal.nom} a été supprimé`);
        location.hash = '#/animaux';
      }
    }
  });
}
