// Fiche d'un animal : en-tête, chiffres clés, et quatre onglets (Santé, Poids, Historique, Documents).

import * as storage from '../../js/storage.js';
import { echapper, age, formatDate, formatDateCourte, formatDateNumerique, formatPoids, aujourdhui } from '../../js/utils.js';
import { confirmer, toast } from '../../js/ui.js';
import { rafraichir } from '../../js/router.js';
import { icone } from '../../js/icons.js';
import { bouton, badge, vide, activerOnglets, avatar, couleurAnimal, bulleInfo } from '../../js/composants.js';
import { infosEspece, nomEspece, infosType, classeType, statutRappel, badgeEcheance, nomCourtSoin, titreSoin } from './commun.js';
import { calculerRappels } from './rappels.js';
import { formulaireAnimal, choisirCouleur } from './animaux.js';
import * as soins from './soins.js';
import * as pesees from './pesees.js';
import * as documents from './documents.js';
import { listerDocuments } from '../../js/documents-db.js';
import { blocPourAnimal } from '../boutique/blocs.js';
import { estGroupe, pondeuse, libelleEffectif, effectifDe, statsPonte, etatStock, texteJours, rendrePonte, rendreAlimentation, formulaireGroupe } from '../ferme/ferme.js';

// Onglet affiché : mémorisé pendant la visite, pour ne pas revenir à « Santé » après une modification
let memoire = { id: null, onglet: 'sante' };
const ONGLETS = [
  { id: 'sante', nom: 'Santé', icone: 'stethoscope' },
  { id: 'poids', nom: 'Poids', icone: 'scale' },
  { id: 'historique', nom: 'Historique', icone: 'calendar' },
  { id: 'documents', nom: 'Documents', icone: 'image' },
];
// Un groupe (basse-cour) n'a pas de pesées : il a, selon l'espèce, un suivi de ponte, et toujours un stock de nourriture
const ONGLET_PONTE = { id: 'ponte', nom: 'Ponte', icone: 'trending-up' };
const ONGLET_ALIMENTATION = { id: 'alimentation', nom: 'Repas', icone: 'wheat' }; // « Repas » : assez court pour tenir avec les autres onglets
const ongletsPour = (animal) => !estGroupe(animal) ? ONGLETS
  : [ONGLETS[0], ...(pondeuse(animal) ? [ONGLET_PONTE] : []), ONGLET_ALIMENTATION, ONGLETS[2], ONGLETS[3]];
const num = (n, d = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });

const PAS_HISTORIQUE = 30; // nombre d'événements affichés à la fois
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Longueur du plus long mot d'un nom : la taille du titre s'adapte pour qu'un mot ne soit jamais coupé au milieu (voir css/refonte.css). */
const motLong = (nom) => Math.max(1, ...String(nom).split(/[s-]+/).map((m) => m.length));

function avatarGrand(animal) {
  const photo = typeof animal.photo === 'string' && animal.photo.startsWith('data:image/') ? animal.photo : '';
  const rond = avatar({ grand: true, photo, nom: animal.nom, id: animal.id, couleur: couleurAnimal(animal), icone: infosEspece(animal).icone }).replace('class="cp-avatar', 'class="cp-avatar fi-avatar');
  // Un clic sur l'avatar ouvre le choix de la couleur (le crayon montre qu'on peut le modifier)
  return `<button type="button" class="fi-avatar-bouton" data-act="couleur" aria-label="Changer la couleur de ${echapper(animal.nom)}" title="Changer la couleur">${rond}<span class="fi-avatar-bouton__crayon" aria-hidden="true">${icone('palette', { taille: 14 })}</span></button>`;
}

// ----- Données de l'animal (toujours filtrées sur son identifiant) -----

const soinsDe = (animal) => storage.lister('soins').filter((s) => s.animalId === animal.id);
const peseesDe = (animal) => storage.lister('pesees').filter((p) => p.animalId === animal.id)
  .sort((a, b) => a.date.localeCompare(b.date));

// ----- Chiffres clés -----

/** Une info clé de la fiche : une bulle de verre (voir bulleInfo dans js/composants.js). */
function carteChiffre({ libelle, icone: nomIcone, valeur, sous, videTexte, ton = '', aide = '' }) {
  return bulleInfo({ libelle, icone: nomIcone, valeur, detail: valeur ? sous : aide, vide: videTexte, ton, classe: 'fi-chiffre' });
}

/** Chiffres d'un groupe : effectif, ponte (ou nourriture), prochain rappel. */
function chiffresGroupe(animal) {
  const n = effectifDe(animal);
  const cEffectif = carteChiffre({ libelle: 'Effectif', icone: 'users', valeur: String(n), sous: libelleEffectif(animal) });
  let cSuite;
  if (pondeuse(animal)) {
    const s = statsPonte(animal);
    cSuite = carteChiffre({ libelle: 'Ponte (30 jours)', icone: 'trending-up', valeur: s.moyenne === null ? '' : `${num(s.moyenne)} œuf${s.moyenne >= 2 ? 's' : ''}/jour`,
      sous: s.aujourdhui === null ? '' : `Aujourd'hui : ${s.aujourdhui}`, videTexte: 'Aucune saisie', aide: "Onglet Ponte" });
  } else {
    const stocks = storage.lister('stocks').filter((x) => x.animalId === animal.id).map((x) => ({ x, e: etatStock(x) })).sort((a, b) => (a.e.jours ?? 1e9) - (b.e.jours ?? 1e9));
    const premier = stocks[0];
    cSuite = carteChiffre({ libelle: 'Nourriture', icone: 'wheat', valeur: premier ? `${num(premier.e.restant)} kg` : '', sous: premier ? texteJours(premier.e) : '', ton: premier?.e.alerte ? 'retard' : '',
      videTexte: 'Aucun stock', aide: "Onglet Repas" });
  }
  return cEffectif + cSuite + carteRappel(animal);
}

/** Rappel le plus urgent ; « Prochain » seulement s'il n'est pas en retard. */
function carteRappel(animal) {
  const prochain = calculerRappels().find((r) => r.animal.id === animal.id);
  const enRetard = prochain?.statut.classe === 'retard';
  return carteChiffre({
    libelle: enRetard ? 'Rappel le plus urgent' : 'Prochain rappel', icone: enRetard ? 'bell-ring' : 'bell',
    valeur: prochain ? prochain.statut.texte : '',
    sous: prochain ? `${formatDateCourte(prochain.soin.rappel)} · ${nomCourtSoin(prochain.soin)}` : '', // la date d'abord : elle reste visible même si le nom du soin est long
    ton: prochain ? (prochain.statut.classe === 'retard' ? 'retard' : prochain.statut.classe === 'semaine' ? 'semaine' : '') : '',
    videTexte: 'Aucun rappel', aide: 'Programmez-en un depuis un soin',
  });
}

function chiffresHtml(animal) {
  if (estGroupe(animal)) return chiffresGroupe(animal);
  // Âge
  const ageTexte = animal.naissance ? age(animal.naissance) : '';
  const cAge = carteChiffre({
    libelle: 'Âge', icone: 'cake', valeur: ageTexte,
    sous: ageTexte ? `Né le ${formatDateNumerique(animal.naissance)}` : '',
    videTexte: 'Âge inconnu', aide: 'Ajoutez-le avec « Modifier »',
  });

  // Dernier poids
  const liste = peseesDe(animal);
  const derniere = liste[liste.length - 1];
  let sousPoids = '';
  if (derniere) {
    const precedente = liste[liste.length - 2];
    if (precedente) {
      const diff = Math.round((derniere.poidsKg - precedente.poidsKg) * 1000) / 1000;
      sousPoids = diff === 0 ? `Inchangé depuis le ${formatDateCourte(precedente.date)}` : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('fr-FR')} kg depuis le ${formatDateCourte(precedente.date)}`;
    } else sousPoids = `Pesé le ${formatDateCourte(derniere.date)}`;
  }
  const cPoids = carteChiffre({
    libelle: 'Dernier poids', icone: 'scale', valeur: derniere ? formatPoids(derniere.poidsKg) : '', sous: sousPoids,
    videTexte: 'Aucune pesée', aide: "Ajoutez-en une (onglet Poids)",
  });

  return cAge + cPoids + carteRappel(animal);
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
    ev.push({ date: s.date, rang: 2, icone: type.icone, titre: titreSoin(s), detail: s.notes || '', type: s.type });
    const statut = statutRappel(s);
    if (statut) {
      ev.push({ date: s.rappel, rang: 3, icone: 'bell', titre: `Rappel : ${titreSoin(s)}`, detail: '',
        badge: badgeEcheance(statut), type: s.type });
    }
  }
  const liste = peseesDe(animal);
  liste.forEach((p, i) => {
    let detail = '';
    if (i > 0) {
      const diff = Math.round((p.poidsKg - liste[i - 1].poidsKg) * 1000) / 1000;
      if (diff !== 0) detail = `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('fr-FR')} kg`;
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
          <li class="fi-histo__ligne${e.type ? ` ${classeType(e.type)}` : ''}">
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

  const onglets = ongletsPour(animal);
  if (memoire.id !== animal.id) memoire = { id: animal.id, onglet: 'sante' };
  if (soinCible || !onglets.some((o) => o.id === memoire.onglet)) memoire.onglet = 'sante';

  const details = (estGroupe(animal) ? [`Groupe · ${libelleEffectif(animal)}`] : [nomEspece(animal), animal.race]).filter(Boolean).map(echapper).join(' · ');
  const idOnglet = (o) => `fi-onglet-${o}`;
  const idPanneau = (o) => `fi-panneau-${o}`;

  zone.innerHTML = `
    <div class="cp pg fi-page cp-an-${couleurAnimal(animal)}">
      <a class="pg-lien fi-retour" href="#/animaux">${icone('arrow-left', { taille: 18 })} Mes animaux</a>

      <section class="cp-carte fi-entete" aria-label="Identité de l'animal">
        ${avatarGrand(animal)}
        <div class="fi-entete__texte">
          <h1 style="--mot-long: ${motLong(animal.nom)}">${echapper(animal.nom)}</h1>
          <p class="fi-entete__espece">${details}</p>
          <p class="fi-entete__naissance">${estGroupe(animal) ? 'Suivi de groupe : soins, rappels, ponte et nourriture' : animal.naissance ? `Né(e) le ${formatDate(animal.naissance)} · ${age(animal.naissance)}` : 'Date de naissance inconnue'}</p>
        </div>
        <div class="fi-entete__actions">
          ${bouton({ texte: 'Modifier', variante: 'secondaire', icone: 'pencil', attrs: { 'data-act': 'modifier' } })}
          ${bouton({ texte: 'Supprimer', variante: 'secondaire', icone: 'trash-2', attrs: { 'data-act': 'supprimer', class: 'cp-btn cp-btn--secondaire fi-danger' } })}
        </div>
      </section>

      ${estGroupe(animal) ? '' : `<div class="fi-garde">${bouton({ texte: 'Fiche de garde', icone: 'clipboard-list', variante: 'secondaire', href: `#/animaux/${encodeURIComponent(animal.id)}/garde` })}<span class="cp-doux">Repas, soins, habitudes et contacts, pour votre pet-sitter.</span></div>`}

      <section class="fi-chiffres bulles" aria-label="Chiffres clés" data-chiffres>${chiffresHtml(animal)}</section>

      <div class="fi-onglets" data-onglets>
        <div class="cp-onglets" role="tablist" aria-label="Fiche de ${echapper(animal.nom)}">
          ${onglets.map((o) => `
            <button type="button" class="cp-onglet" role="tab" id="${idOnglet(o.id)}" aria-controls="${idPanneau(o.id)}"
              aria-selected="${o.id === memoire.onglet}" data-onglet="${o.id}">${icone(o.icone, { taille: 18 })}<span>${o.nom}</span></button>`).join('')}
        </div>
        <div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('sante')}" aria-labelledby="${idOnglet('sante')}" tabindex="0"><div id="zone-soins"></div></div>
        ${estGroupe(animal) ? `
        ${pondeuse(animal) ? `<div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('ponte')}" aria-labelledby="${idOnglet('ponte')}" tabindex="0" hidden><div id="zone-ponte"></div></div>` : ''}
        <div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('alimentation')}" aria-labelledby="${idOnglet('alimentation')}" tabindex="0" hidden><div id="zone-alimentation"></div></div>`
          : `<div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('poids')}" aria-labelledby="${idOnglet('poids')}" tabindex="0" hidden><div id="zone-pesees"></div></div>`}
        <div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('historique')}" aria-labelledby="${idOnglet('historique')}" tabindex="0" hidden>
          <section class="cp-carte fi-historique"><h2>Historique</h2><div data-historique></div></section>
        </div>
        <div class="cp-onglet-panneau" role="tabpanel" id="${idPanneau('documents')}" aria-labelledby="${idOnglet('documents')}" tabindex="0" hidden>
          <div id="zone-documents"></div>
        </div>
      </div>

      ${blocPourAnimal(animal)}
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
  if (estGroupe(animal)) {
    if (pondeuse(animal)) rendrePonte(zone.querySelector('#zone-ponte'), animal);
    rendreAlimentation(zone.querySelector('#zone-alimentation'), animal);
  } else {
    pesees.rendre(zone.querySelector('#zone-pesees'), animal);
  }
  documents.rendre(zone.querySelector('#zone-documents'), animal);

  // Onglets
  const racineOnglets = zone.querySelector('[data-onglets]');
  activerOnglets(racineOnglets);
  // Si les onglets ne tiennent pas (très petit écran), la rangée défile : un fondu à droite montre qu'il y a une suite
  const listeOnglets = racineOnglets.querySelector('[role="tablist"]');
  const majSuite = () => listeOnglets.classList.toggle('a-suite', listeOnglets.scrollWidth - listeOnglets.clientWidth - listeOnglets.scrollLeft > 4);
  listeOnglets.addEventListener('scroll', majSuite, { passive: true });
  new ResizeObserver(majSuite).observe(listeOnglets); // disparaît avec la page : rien à nettoyer
  majSuite();
  racineOnglets.querySelector('[role="tablist"]').addEventListener('click', (e) => {
    const o = e.target.closest('[data-onglet]');
    if (o) { memoire.onglet = o.dataset.onglet; o.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }
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
  for (const z of ['#zone-soins', '#zone-pesees', '#zone-ponte', '#zone-alimentation']) { const el = zone.querySelector(z); if (el) observateur.observe(el, { childList: true }); }
  zoneHistorique.addEventListener('click', (e) => {
    if (!e.target.closest('[data-plus]')) return;
    limite += PAS_HISTORIQUE;
    zoneHistorique.innerHTML = historiqueHtml(animal, limite);
  });

  // Modifier / Supprimer
  zone.querySelector('.fi-entete').addEventListener('click', async (e) => {
    const declencheur = e.target.closest('[data-act]');
    if (!declencheur) return;
    if (declencheur.dataset.act === 'couleur') {
      choisirCouleur(animal, rafraichir);
    } else if (declencheur.dataset.act === 'modifier') {
      if (estGroupe(animal)) formulaireGroupe(animal, rafraichir); else formulaireAnimal(animal, rafraichir);
    } else if (declencheur.dataset.act === 'supprimer') {
      // Comportement inchangé : storage.supprimer retire l'animal ET ses soins et pesées. On le dit précisément.
      const nbSoins = soinsDe(animal).length;
      const nbPesees = peseesDe(animal).length;
      const nbOeufs = storage.lister('oeufs').filter((o) => o.animalId === animal.id).length;
      const nbStocks = storage.lister('stocks').filter((o) => o.animalId === animal.id).length;
      const nbDocs = await listerDocuments(animal.id).then((l) => l.length, () => 0);
      const liees = [nbSoins && pluriel(nbSoins, 'soin'), nbPesees && pluriel(nbPesees, 'pesée'), nbDocs && pluriel(nbDocs, 'document'), nbOeufs && `${nbOeufs} saisie${nbOeufs > 1 ? 's' : ''} d'œufs`, nbStocks && pluriel(nbStocks, 'stock')].filter(Boolean).join(', ');
      const message = `Supprimer ${animal.nom} ? ${liees ? `Seront aussi supprimés : ${liees}.` : 'Aucun soin ni pesée ne lui est associé.'} Cette action est définitive.`;
      if (await confirmer(message)) {
        storage.supprimer('animaux', animal.id);
        toast(`${animal.nom} a été supprimé`);
        location.hash = '#/animaux';
      }
    }
  });
}
