// Fiche de garde : ce qu'il faut savoir pour garder un animal (pet-sitter, famille, voisin).
// Deux pages : le formulaire en sections repliables (#/animaux/<id>/garde) et l'aperçu (#/animaux/<id>/garde/apercu)
// avec « Télécharger en PDF » et « Partager ». Tout reste sur l'appareil (et dans le cloud pour un compte Premium qui l'a activé) ;
// l'aperçu et le PDF n'affichent que ce qui est rempli, sauf les urgences (centres antipoison) qui y sont toujours.
//
// Le contenu (modeleFiche) est le même pour l'écran et pour le PDF (js/pdf-fiche.js).

import * as storage from '../../js/storage.js';
import { echapper, age, formatDate, formatPoids, aujourdhui, ajouterJours, joursEntre } from '../../js/utils.js';
import { toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, champ, alerte, avatar, couleurAnimal, vide, confirmer } from '../../js/composants.js';
import { creerPdfFiche } from '../../js/pdf-fiche.js';
import { CENTRES_ANTIPOISON } from '../toxique/donnees.js';
import { infosEspece, nomEspece, statutRappel, nomCourtSoin } from './commun.js';
import { formulaireSoin } from './soins.js';

export { creerPdfFiche };
export const AVERTISSEMENT_PARTAGE = "Vérifiez les infos. N'ajoutez pas de code d'alarme ou de clés.";
/** Phrase à afficher avec les centres antipoison (ils ne répondent pas toute la nuit). */
export const HORS_HORAIRES = 'En dehors de ces horaires : appelez votre vétérinaire ou une clinique vétérinaire de garde.';

export const TACHES = [
  { id: 'repas', nom: 'Repas', icone: 'utensils' },
  { id: 'eau', nom: 'Eau fraîche', icone: 'droplet' },
  { id: 'promenade', nom: 'Promenade', icone: 'paw-print' },
  { id: 'medicament', nom: 'Médicament', icone: 'pill' },
];

const SECTIONS = [
  { id: 'dates', titre: 'Dates de garde', icone: 'calendar', champs: [
    { cle: 'gardeDu', label: 'Du', type: 'date' }, { cle: 'gardeAu', label: 'Au', type: 'date' } ] },
  { id: 'repas', titre: 'Repas', icone: 'utensils', champs: [
    { cle: 'aliment', label: 'Aliment', placeholder: 'Ex. : croquettes Sensible, saumon' },
    { cle: 'quantite', label: 'Quantité', placeholder: 'Ex. : 150 g par repas' },
    { cle: 'horaires', label: 'Horaires des repas', placeholder: 'Ex. : 8 h et 18 h' },
    { cle: 'interdits', label: 'Interdits', long: true, placeholder: 'Ex. : pas de restes de table, pas de chocolat' } ] },
  { id: 'sante', titre: 'Santé et traitements', icone: 'stethoscope', special: 'sante', champs: [
    { cle: 'puce', label: 'Numéro de puce (transpondeur)', placeholder: 'Ex. : 250 26 00 00 00 00 00', attrs: { inputmode: 'numeric', autocomplete: 'off' } },
    { cle: 'tatouage', label: 'Tatouage', placeholder: 'Ex. : ABC 123', attrs: { autocomplete: 'off' } },
    { cle: 'soinsGarde', label: 'Autres soins ou précautions', long: true, placeholder: 'Ex. : nettoyer les oreilles le dimanche' } ] },
  { id: 'habitudes', titre: 'Habitudes', icone: 'heart', champs: [
    { cle: 'promenades', label: 'Promenades et sorties', long: true, placeholder: 'Ex. : deux sorties de 30 minutes, toujours en laisse' },
    { cle: 'litiere', label: 'Litière et besoins', placeholder: 'Ex. : litière à nettoyer chaque jour' },
    { cle: 'sommeil', label: 'Sommeil', placeholder: 'Ex. : dort dans son panier, dans le salon' },
    { cle: 'aime', label: 'Ce qu\'il aime', long: true, placeholder: 'Ex. : les câlins, jouer à la balle, les carottes' },
    { cle: 'jouets', label: 'Jouets préférés', placeholder: 'Ex. : la balle jaune, la corde' },
    { cle: 'peurs', label: 'Peurs et sensibilités', long: true, placeholder: 'Ex. : a peur de l\'aspirateur et des orages' },
    { cle: 'nePasFaire', label: 'Ce qu\'il ne faut pas faire', long: true, placeholder: 'Ex. : ne pas le laisser seul dans le jardin, ne pas lui donner d\'os' },
    { cle: 'regles', label: 'Règles de la maison', long: true, placeholder: 'Ex. : pas sur le canapé, pas de friandises en plus' } ] },
  { id: 'contacts', titre: 'Contacts', icone: 'phone', champs: [
    { cle: 'proprietaireNom', label: 'Propriétaire (nom)', autocomplete: 'name' }, { cle: 'proprietaireTel', label: 'Propriétaire (téléphone)', type: 'tel', autocomplete: 'tel' },
    { cle: 'vetoNom', label: 'Vétérinaire habituel (nom ou clinique)' }, { cle: 'vetoTel', label: 'Vétérinaire habituel (téléphone)', type: 'tel' },
    { cle: 'secoursNom', label: 'Personne à prévenir en urgence (nom)' }, { cle: 'secoursTel', label: 'Personne à prévenir en urgence (téléphone)', type: 'tel' } ] },
  { id: 'pratique', titre: 'Infos pratiques', icone: 'info', champs: [
    { cle: 'infos', label: 'Autres informations utiles', long: true, placeholder: 'Ex. : où sont les croquettes, les sacs, la laisse' } ] },
];

const lienTel = (t) => `tel:${String(t).replace(/[^\d+]/g, '')}`;

// ----- Le contenu de la fiche (le même pour l'écran et pour le PDF) -----

/**
 * État des vaccins d'un animal, d'après ses soins : le dernier vaccin et le prochain rappel.
 * { etat: 'a-jour' | 'retard' | 'inconnu', texte, dernier: { nom, date } | null, prochain: { nom, date, retard } | null }
 */
export function etatVaccins(animal) {
  const vaccins = storage.lister('soins').filter((s) => s.animalId === animal.id && s.type === 'vaccin');
  if (!vaccins.length) return { etat: 'inconnu', texte: 'Aucun vaccin enregistré dans Carnet Patte', dernier: null, prochain: null };
  const dernierSoin = [...vaccins].sort((a, b) => b.date.localeCompare(a.date))[0];
  const aRenouveler = vaccins.filter((s) => statutRappel(s)).sort((a, b) => a.rappel.localeCompare(b.rappel))[0];
  const dernier = { nom: nomCourtSoin(dernierSoin), date: dernierSoin.date };
  const prochain = aRenouveler ? { nom: nomCourtSoin(aRenouveler), date: aRenouveler.rappel, retard: statutRappel(aRenouveler).classe === 'retard' } : null;
  const etat = prochain?.retard ? 'retard' : 'a-jour';
  const texte = `Dernier : ${dernier.nom}, le ${formatDate(dernier.date)}${prochain ? ` · ${prochain.retard ? 'À renouveler' : 'Prochain rappel'} : ${prochain.nom}, le ${formatDate(prochain.date)}` : ' · aucun rappel prévu'}`;
  return { etat, texte, dernier, prochain };
}

/** Tout ce que la fiche affiche : identité, dates de garde, vaccins, santé, sections remplies seulement, urgences. */
export function modeleFiche(animal, fiche) {
  const pesees = storage.lister('pesees').filter((p) => p.animalId === animal.id).sort((a, b) => a.date.localeCompare(b.date));
  const dernierPoids = pesees[pesees.length - 1];
  const details = [nomEspece(animal), animal.race, animal.naissance ? age(animal.naissance) : ''].filter(Boolean);
  const contacts = [['Vétérinaire habituel', 'veto'], ['Personne à prévenir en urgence', 'secours'], ['Propriétaire', 'proprietaire']]
    .map(([libelle, c]) => ({ libelle, nom: fiche[`${c}Nom`], tel: fiche[`${c}Tel`] })).filter((l) => l.nom || l.tel);
  const lignes = (s) => s.champs.filter((c) => fiche[c.cle] && !['puce', 'tatouage'].includes(c.cle) && !['dates', 'contacts'].includes(s.id)).map((c) => ({ libelle: c.label, valeur: fiche[c.cle] }));
  const sections = SECTIONS.filter((s) => !['dates', 'contacts', 'sante'].includes(s.id)).map((s) => ({ id: s.id, titre: s.titre, icone: s.icone, lignes: lignes(s) }))
    .filter((s) => s.lignes.length);
  const autresSoins = fiche.soinsGarde ? [{ libelle: 'Autres soins ou précautions', valeur: fiche.soinsGarde }] : [];
  const identification = [['Puce (transpondeur)', fiche.puce], ['Tatouage', fiche.tatouage]].filter(([, v]) => v).map(([libelle, valeur]) => ({ libelle, valeur }));
  const du = fiche.gardeDu; const au = fiche.gardeAu && (!du || fiche.gardeAu >= du) ? fiche.gardeAu : '';
  const jours = du && au ? Array.from({ length: Math.min(45, joursEntre(du, au) + 1) }, (_, i) => ajouterJours(du, i)) : [];
  const libelleGarde = du && au ? `Garde du ${formatDate(du)} au ${formatDate(au)}` : du ? `Garde à partir du ${formatDate(du)}` : au ? `Garde jusqu'au ${formatDate(au)}` : '';
  return {
    nom: animal.nom,
    details,
    poids: dernierPoids ? `${formatPoids(dernierPoids.poidsKg)} (pesé le ${formatDate(dernierPoids.date)})` : '',
    garde: { du, au, libelle: libelleGarde, jours },
    vaccins: etatVaccins(animal),
    traitements: fiche.traitements ?? [],
    identification,
    autresSoins,
    sections,
    urgences: { contacts, antipoison: CENTRES_ANTIPOISON.map((c) => ({ nom: c.nom, tel: c.tel, horaires: c.horaires, lien: c.lien })), horsHoraires: HORS_HORAIRES },
    suivi: fiche.suivi ?? {},
    date: aujourdhui(),
  };
}

// ----- PDF -----

const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'animal';
const nomFichierPdf = (animal) => `fiche-de-garde-${slug(animal.nom)}.pdf`;

function telechargerPdf(octets, nom) {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }));
  lien.download = nom;
  lien.hidden = true;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 60000);
}

/** Le PDF de la fiche pour cet animal et cette fiche, aux couleurs du thème et avec la photo. */
const pdfDe = (animal, fiche) => creerPdfFiche(modeleFiche(animal, fiche), { photo: animal.photo, taches: TACHES });

// ----- Pages -----

const lienFiche = (animal) => `#/animaux/${encodeURIComponent(animal.id)}`;
const lienGarde = (animal) => `${lienFiche(animal)}/garde`;
const photoDe = (animal) => (typeof animal.photo === 'string' && animal.photo.startsWith('data:image/') ? animal.photo : '');

function introuvable(zone) {
  zone.innerHTML = `<div class="cp pg">${vide({ niveau: 1, icone: 'circle-help', titre: "Cet animal n'existe pas (ou plus).", texte: 'Il a peut-être été supprimé.',
    action: bouton({ texte: 'Retour à mes animaux', icone: 'arrow-left', href: '#/animaux' }) })}</div>`;
}

/** Grande photo ronde de l'animal (ou son illustration), au-dessus du nom. */
const grandeBulle = (animal) => `<span class="gd-photo">${avatar({ grand: true, photo: photoDe(animal), nom: animal.nom, id: animal.id, couleur: couleurAnimal(animal), icone: infosEspece(animal).icone })}</span>`;

/** Bloc « Vaccins » : le dernier, le prochain rappel, ou un bouton pour en ajouter. */
function blocVaccins(m, { modifiable = false } = {}) {
  const v = m.vaccins;
  const picto = { 'a-jour': 'circle-check', retard: 'bell-ring', inconnu: 'circle-help' }[v.etat];
  if (!v.dernier) {
    return `<div class="gd-vaccins gd-vaccins--inconnu">${icone(picto, { taille: 20 })}<div><strong>Vaccins</strong><p>${echapper(v.texte)}</p>
      ${bouton({ texte: 'Ajouter un vaccin', variante: 'secondaire', taille: 's', icone: 'syringe', attrs: { 'data-act': 'ajouter-vaccin' } })}</div></div>`;
  }
  return `<div class="gd-vaccins gd-vaccins--${v.etat}">${icone(picto, { taille: 20 })}<div><strong>Vaccins</strong>
    <p>Dernier vaccin : <strong>${echapper(v.dernier.nom)}</strong>, le ${formatDate(v.dernier.date)}</p>
    <p>${v.prochain ? `${v.prochain.retard ? 'À renouveler' : 'Prochain rappel'} : <strong>${echapper(v.prochain.nom)}</strong>, le ${formatDate(v.prochain.date)}` : 'Aucun rappel de vaccin prévu'}</p>
    ${modifiable ? bouton({ texte: 'Ajouter un vaccin', variante: 'discret', taille: 's', icone: 'syringe', attrs: { 'data-act': 'ajouter-vaccin' } }) : ''}</div></div>`;
}

function formulaire(zone, animal) {
  const fiche = storage.lireFicheGarde(animal.id);
  const nbRemplis = (s, f) => s.champs.filter((c) => f[c.cle]).length + (s.special === 'sante' ? f.traitements.length : 0);
  const champHtml = (c) => champ({ id: `gd-${c.cle}`, label: c.label, type: c.long ? 'textarea' : (c.type ?? 'text'), valeur: fiche[c.cle], placeholder: c.placeholder ?? '',
    attrs: { name: c.cle, maxlength: 2000, ...(c.long ? { rows: 3 } : {}), ...(c.autocomplete ? { autocomplete: c.autocomplete } : {}), ...(c.attrs ?? {}) } });
  const ligneTraitement = (t, i) => `
    <div class="gd-trait" data-trait role="group" aria-label="Traitement ${i + 1}">
      ${champ({ id: `gd-t${i}-nom`, label: 'Médicament', valeur: t.nom, placeholder: 'Ex. : Apoquel', attrs: { name: false, 'data-t': 'nom', maxlength: 120 } })}
      ${champ({ id: `gd-t${i}-dose`, label: 'Dose', valeur: t.dose, placeholder: 'Ex. : 1 comprimé', attrs: { name: false, 'data-t': 'dose', maxlength: 120 } })}
      ${champ({ id: `gd-t${i}-horaires`, label: 'Horaires', valeur: t.horaires, placeholder: 'Ex. : le soir, pendant le repas', attrs: { name: false, 'data-t': 'horaires', maxlength: 120 } })}
      ${bouton({ texte: 'Retirer', variante: 'discret', taille: 's', icone: 'trash-2', attrs: { 'data-retirer-trait': i, 'aria-label': `Retirer le traitement ${i + 1}` } })}
    </div>`;
  const santeHtml = `
    <div data-vaccins></div>
    <div class="gd-traitements">
      <h2 class="gd-sous-titre">Traitements en cours</h2>
      <div data-liste-traitements>${fiche.traitements.map(ligneTraitement).join('')}</div>
      <p class="cp-doux" data-aucun-trait ${fiche.traitements.length ? 'hidden' : ''}>Aucun traitement en cours.</p>
      ${bouton({ texte: 'Ajouter un traitement', variante: 'secondaire', taille: 's', icone: 'plus', attrs: { 'data-ajouter-trait': true } })}
    </div>`;
  zone.innerHTML = `
    <div class="cp pg gd-page cp-an-${couleurAnimal(animal)}">
      <a class="pg-lien fi-retour" href="${lienFiche(animal)}">${icone('arrow-left', { taille: 18 })} Fiche de ${echapper(animal.nom)}</a>
      <header class="gd-hero">
        ${grandeBulle(animal)}
        <div class="gd-hero__texte"><h1 tabindex="-1">Fiche de garde de ${echapper(animal.nom)}</h1>
        <p>Pour la personne qui garde ${echapper(animal.nom)}. Tout est facultatif : remplissez seulement ce qui est utile. Elle reste sur cet appareil${storageCloudActif() ? ' et dans votre sauvegarde cloud' : ''}.</p></div>
      </header>
      <form class="gd-form" novalidate>
        ${SECTIONS.map((s, i) => `
        <details class="gd-section"${i === 0 || nbRemplis(s, fiche) ? ' open' : ''} data-section="${s.id}">
          <summary class="gd-section__titre"><span class="gd-section__icone" aria-hidden="true">${icone(s.icone, { taille: 20 })}</span><span>${s.titre}</span><span class="gd-section__nb" data-nb>${nbRemplis(s, fiche) ? `${nbRemplis(s, fiche)} rempli${nbRemplis(s, fiche) > 1 ? 's' : ''}` : ''}</span><span class="gd-section__fleche" aria-hidden="true">${icone('chevron-down', { taille: 18 })}</span></summary>
          <div class="gd-section__corps">
            ${s.special === 'sante' ? santeHtml : ''}
            ${s.champs.map(champHtml).join('')}
            ${s.id === 'dates' ? '<p class="cp-doux gd-date-erreur" data-date-erreur role="alert" hidden>La fin de la garde ne peut pas être avant son début.</p>' : ''}
          </div>
        </details>`).join('')}
        <p class="cp-doux gd-statut" data-statut role="status">Enregistré sur cet appareil à chaque modification.</p>
        <div class="gd-actions">
          ${bouton({ texte: 'Enregistrer', type: 'submit', icone: 'check' })}
          ${bouton({ texte: 'Voir l\'aperçu', variante: 'secondaire', icone: 'eye', href: `${lienGarde(animal)}/apercu`, attrs: { 'data-apercu': true } })}
        </div>
      </form>
    </div>`;
  const form = zone.querySelector('form');
  const liste = zone.querySelector('[data-liste-traitements]');
  const lireTraitements = () => [...zone.querySelectorAll('[data-trait]')].map((r) => ({ nom: r.querySelector('[data-t=nom]').value, dose: r.querySelector('[data-t=dose]').value, horaires: r.querySelector('[data-t=horaires]').value }));
  const lireChamps = () => Object.fromEntries(new FormData(form).entries());
  const majVaccins = () => { zone.querySelector('[data-vaccins]').innerHTML = blocVaccins(modeleFiche(animal, storage.lireFicheGarde(animal.id)), { modifiable: true }); };
  const majCompteurs = () => {
    const f = storage.lireFicheGarde(animal.id);
    zone.querySelectorAll('[data-section]').forEach((d) => {
      const s = SECTIONS.find((x) => x.id === d.dataset.section);
      const n = nbRemplis(s, f);
      d.querySelector('[data-nb]').textContent = n ? `${n} rempli${n > 1 ? 's' : ''}` : '';
    });
  };
  const enregistrer = () => {
    const champs = lireChamps();
    const erreurDates = champs.gardeDu && champs.gardeAu && champs.gardeAu < champs.gardeDu;
    zone.querySelector('[data-date-erreur]').hidden = !erreurDates;
    if (erreurDates) champs.gardeAu = ''; // la date de fin incohérente n'est pas gardée tant qu'elle n'est pas corrigée
    const actuelle = storage.lireFicheGarde(animal.id);
    storage.enregistrerFicheGarde(animal.id, { ...champs, traitements: lireTraitements(), suivi: actuelle.suivi }); // le suivi du jour n'est jamais perdu en modifiant la fiche
    majCompteurs();
  };
  const ajouterLigne = (t = { nom: '', dose: '', horaires: '' }) => {
    liste.insertAdjacentHTML('beforeend', ligneTraitement(t, liste.querySelectorAll('[data-trait]').length));
    zone.querySelector('[data-aucun-trait]').hidden = true;
  };
  const rebatirTraitements = (items) => {
    liste.innerHTML = items.map(ligneTraitement).join('');
    zone.querySelector('[data-aucun-trait]').hidden = items.length > 0;
  };
  majVaccins();
  form.addEventListener('change', () => { enregistrer(); zone.querySelector('[data-statut]').textContent = 'Enregistré.'; });
  form.addEventListener('submit', (e) => { e.preventDefault(); enregistrer(); toast('Fiche de garde enregistrée'); });
  zone.querySelector('[data-apercu]').addEventListener('click', enregistrer); // l'aperçu montre toujours la dernière saisie
  zone.querySelector('[data-ajouter-trait]').addEventListener('click', () => {
    if (liste.querySelectorAll('[data-trait]').length >= storage.TRAITEMENTS_MAX) { toast(`${storage.TRAITEMENTS_MAX} traitements au maximum.`, 'info'); return; }
    ajouterLigne(); liste.querySelector('[data-trait]:last-child [data-t=nom]').focus();
  });
  zone.addEventListener('click', (e) => {
    const retirer = e.target.closest('[data-retirer-trait]');
    if (retirer) {
      const restants = lireTraitements().filter((_, i) => i !== Number(retirer.dataset.retirerTrait));
      rebatirTraitements(restants); enregistrer(); toast('Traitement retiré', 'info');
    } else if (e.target.closest('[data-act="ajouter-vaccin"]')) {
      enregistrer();
      formulaireSoin(animal, null, () => { majVaccins(); toast('Vaccin ajouté'); }); // ouvre le formulaire de soin, déjà sur « Vaccin »
    }
  });
}

/** La carte « Suivi du jour » : repas, eau, promenade, médicament, à cocher pour chaque jour de la garde. */
function carteSuivi(m) {
  const auj = aujourdhui();
  const jours = m.garde.jours.length ? m.garde.jours : [auj];
  const choisi = jours.includes(auj) ? auj : jours[0];
  return `
    <section class="gd-carte gd-carte--suivi" aria-labelledby="gd-t-suivi" data-suivi>
      <h2 id="gd-t-suivi"><span class="gd-carte__icone" aria-hidden="true">${icone('clipboard-list', { taille: 20 })}</span>Suivi du jour</h2>
      ${jours.length > 1 ? `<div class="gd-jours" role="group" aria-label="Jour de la garde">${jours.map((j) => `<button type="button" class="gd-jour${j === choisi ? ' gd-jour--choisi' : ''}" data-jour="${j}" aria-pressed="${j === choisi}">${formatDate(j).replace(/\s\d{4}$/, '')}</button>`).join('')}</div>` : ''}
      <p class="gd-suivi__date" data-suivi-date>${formatDate(choisi)}</p>
      <div class="gd-taches" data-taches>${TACHES.map((t) => `<label class="gd-tache"><input type="checkbox" data-tache="${t.id}"><span class="gd-tache__case" aria-hidden="true">${icone('check', { taille: 16 })}</span><span>${t.nom}</span></label>`).join('')}</div>
    </section>`;
}

function apercu(zone, animal) {
  const fiche = storage.lireFicheGarde(animal.id);
  const m = modeleFiche(animal, fiche);
  const u = m.urgences;
  const lienContact = (c) => `${c.nom ? `${echapper(c.nom)}${c.tel ? ' · ' : ''}` : ''}${c.tel ? `<a href="${lienTel(c.tel)}">${echapper(c.tel)}</a>` : ''}`;
  const blocSante = `
    <section class="gd-carte" aria-labelledby="gd-t-sante"><h2 id="gd-t-sante"><span class="gd-carte__icone" aria-hidden="true">${icone('stethoscope', { taille: 20 })}</span>Santé</h2>
      ${blocVaccins(m)}
      ${m.traitements.length ? `<h3 class="gd-sous-titre">Traitements en cours</h3><ul class="gd-trait-liste">${m.traitements.map((t) => `<li><strong>${echapper(t.nom || 'Traitement')}</strong>${t.dose ? ` · ${echapper(t.dose)}` : ''}${t.horaires ? `<span class="cp-doux"> · ${echapper(t.horaires)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${m.identification.length || m.autresSoins.length ? `<dl class="gd-liste">${[...m.identification, ...m.autresSoins].map((l) => `<div><dt>${echapper(l.libelle)}</dt><dd>${echapper(l.valeur)}</dd></div>`).join('')}</dl>` : ''}
    </section>`;
  const sectionHtml = (s) => `
    <section class="gd-carte" aria-labelledby="gd-t-${s.id}"><h2 id="gd-t-${s.id}"><span class="gd-carte__icone" aria-hidden="true">${icone(s.icone, { taille: 20 })}</span>${s.titre}</h2>
      <dl class="gd-liste">${s.lignes.map((l) => `<div><dt>${echapper(l.libelle)}</dt><dd>${echapper(l.valeur)}</dd></div>`).join('')}</dl></section>`;
  zone.innerHTML = `
    <div class="cp pg gd-page cp-an-${couleurAnimal(animal)}">
      <a class="pg-lien fi-retour" href="${lienGarde(animal)}">${icone('arrow-left', { taille: 18 })} Modifier la fiche</a>
      <article class="gd-feuille" aria-label="Fiche de garde de ${echapper(animal.nom)}" data-feuille>
        <header class="gd-hero gd-hero--feuille">
          ${grandeBulle(animal)}
          <div class="gd-hero__texte">
            <p class="gd-surtitre">Fiche de garde</p>
            <h1 tabindex="-1">${echapper(m.nom)}</h1>
            <p>${m.details.map(echapper).join(' · ')}</p>
            ${m.poids ? `<p>Poids : ${echapper(m.poids)}</p>` : ''}
            ${m.garde.libelle ? `<p class="gd-garde-pastille">${icone('calendar', { taille: 16 })}<span>${echapper(m.garde.libelle)}</span></p>` : ''}
          </div>
        </header>

        <section class="gd-carte gd-carte--urgence" aria-labelledby="gd-t-urgences">
          <h2 id="gd-t-urgences"><span class="gd-carte__icone" aria-hidden="true">${icone('triangle-alert', { taille: 20 })}</span>Urgences</h2>
          ${u.contacts.length ? `<dl class="gd-liste">${u.contacts.map((c) => `<div><dt>${echapper(c.libelle)}</dt><dd>${lienContact(c)}</dd></div>`).join('')}</dl>` : '<p class="cp-doux">Aucun contact renseigné : ajoutez votre vétérinaire et une personne à prévenir dans la fiche.</p>'}
          <h3 class="gd-sous-titre">En cas d'ingestion ou d'intoxication</h3>
          <p>Appelez votre vétérinaire ou un centre antipoison vétérinaire :</p>
          <ul class="gd-poison">${u.antipoison.map((c) => `<li><strong>${echapper(c.nom)}</strong><a href="${c.lien}">${echapper(c.tel)}</a><span class="cp-doux">${echapper(c.horaires)}</span></li>`).join('')}</ul>
          <p class="gd-hors-horaires">${echapper(u.horsHoraires)}</p>
        </section>

        <div class="gd-grille">
          ${blocSante}
          ${m.sections.map(sectionHtml).join('')}
          ${carteSuivi(m)}
        </div>
        <p class="gd-feuille__pied cp-doux">Fiche créée avec Carnet Patte · carnetpatte.com · le ${formatDate(m.date)}</p>
      </article>

      ${alerte({ type: 'attention', titre: 'Avant de partager', texte: AVERTISSEMENT_PARTAGE })}
      <div class="gd-actions">
        ${bouton({ texte: 'Télécharger en PDF', icone: 'download', attrs: { 'data-act': 'pdf' } })}
        ${bouton({ texte: 'Partager', variante: 'secondaire', icone: 'external-link', attrs: { 'data-act': 'partager' } })}
      </div>
    </div>`;

  // Suivi du jour : cases cochées pour le jour choisi, enregistrées tout de suite
  let jour = zone.querySelector('[data-jour][aria-pressed="true"]')?.dataset.jour ?? aujourdhui();
  const afficherJour = () => {
    const f = storage.lireFicheGarde(animal.id);
    zone.querySelector('[data-suivi-date]').textContent = formatDate(jour);
    zone.querySelectorAll('[data-tache]').forEach((c) => { c.checked = (f.suivi[jour] ?? []).includes(c.dataset.tache); });
    zone.querySelectorAll('[data-jour]').forEach((b) => { const choisi = b.dataset.jour === jour; b.classList.toggle('gd-jour--choisi', choisi); b.setAttribute('aria-pressed', String(choisi)); });
  };
  afficherJour();
  zone.addEventListener('change', (e) => {
    const c = e.target.closest('[data-tache]');
    if (!c) return;
    const f = storage.lireFicheGarde(animal.id);
    const faites = new Set(f.suivi[jour] ?? []);
    if (c.checked) faites.add(c.dataset.tache); else faites.delete(c.dataset.tache);
    storage.enregistrerFicheGarde(animal.id, { ...f, suivi: { ...f.suivi, [jour]: [...faites] } });
  });

  zone.addEventListener('click', async (e) => {
    const j = e.target.closest('[data-jour]');
    if (j) { jour = j.dataset.jour; afficherJour(); return; }
    const declencheur = e.target.closest('[data-act]');
    if (!declencheur) return;
    if (declencheur.dataset.act === 'ajouter-vaccin') { formulaireSoin(animal, null, () => apercu(zone, animal)); return; }
    const ficheActuelle = storage.lireFicheGarde(animal.id);
    if (declencheur.dataset.act === 'pdf') {
      telechargerPdf(await pdfDe(animal, ficheActuelle), nomFichierPdf(animal));
      toast('PDF créé sur votre appareil');
    } else if (declencheur.dataset.act === 'partager') {
      if (!await confirmer({ titre: 'Avant de partager', message: AVERTISSEMENT_PARTAGE, libelle: 'Partager', danger: false })) return;
      const octets = await pdfDe(animal, ficheActuelle);
      const fichier = new File([octets], nomFichierPdf(animal), { type: 'application/pdf' });
      try {
        if (navigator.canShare?.({ files: [fichier] })) await navigator.share({ files: [fichier], title: `Fiche de garde de ${animal.nom}` });
        else { telechargerPdf(octets, fichier.name); toast("Le partage direct n'est pas disponible sur cet appareil : le PDF a été téléchargé."); }
      } catch (err) {
        if (err?.name !== 'AbortError') toast("Le partage n'a pas pu se faire.", 'erreur'); // AbortError : l'utilisateur a fermé la feuille de partage
      }
    }
  });
}

/** La sauvegarde cloud (Premium) est-elle activée sur cet appareil ? Lecture légère : rien n'est chargé. */
function storageCloudActif() {
  try { return !!JSON.parse(localStorage.getItem('carnetpatte.synchro'))?.actif; } catch { return false; }
}

/** Route : #/animaux/<id>/garde (formulaire) et #/animaux/<id>/garde/apercu. */
export function rendre(zone, id, vue = '') {
  zone.classList.add('page-large');
  const animal = storage.trouver('animaux', id);
  if (!animal) { introuvable(zone); return; }
  if (vue === 'apercu') apercu(zone, animal); else formulaire(zone, animal);
}
