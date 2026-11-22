// Fiche de garde : ce qu'il faut savoir pour garder un animal (pet-sitter, famille, voisin).
// Deux pages : le formulaire en sections repliables (#/animaux/<id>/garde) et l'aperçu (#/animaux/<id>/garde/apercu)
// avec « Télécharger en PDF » et « Partager ». Tout reste sur l'appareil ; rien n'est envoyé sur un serveur.
// Les champs sont facultatifs : l'aperçu et le PDF n'affichent que les sections remplies.

import * as storage from '../../js/storage.js';
import { echapper, age, formatDate, formatPoids, aujourdhui } from '../../js/utils.js';
import { toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, champ, alerte, avatar, couleurAnimal, vide, confirmer } from '../../js/composants.js';
import { Pdf } from '../../js/pdf.js';
import { CENTRES_ANTIPOISON } from '../toxique/donnees.js';
import { infosEspece, nomEspece, statutRappel, nomCourtSoin } from './commun.js';

export const AVERTISSEMENT_PARTAGE = "Vérifiez les infos. N'ajoutez pas de code d'alarme ou de clés.";

const SECTIONS = [
  { id: 'repas', titre: 'Repas', icone: 'utensils', champs: [
    { cle: 'aliment', label: 'Aliment', placeholder: 'Ex. : croquettes Sensible, saumon' },
    { cle: 'quantite', label: 'Quantité', placeholder: 'Ex. : 150 g par repas' },
    { cle: 'horaires', label: 'Horaires des repas', placeholder: 'Ex. : 8 h et 18 h' },
    { cle: 'interdits', label: 'Interdits', long: true, placeholder: 'Ex. : pas de restes de table, pas de chocolat' } ] },
  { id: 'soins', titre: 'Soins pendant la garde', icone: 'pill', champs: [
    { cle: 'soinsGarde', label: 'Soins ou traitements à donner', long: true, placeholder: 'Ex. : un comprimé chaque soir dans une friandise' } ] },
  { id: 'habitudes', titre: 'Habitudes', icone: 'heart', champs: [
    { cle: 'promenades', label: 'Promenades et sorties', long: true, placeholder: 'Ex. : deux sorties de 30 minutes, toujours en laisse' },
    { cle: 'litiere', label: 'Litière et besoins', placeholder: 'Ex. : litière à nettoyer chaque jour' },
    { cle: 'sommeil', label: 'Sommeil', placeholder: 'Ex. : dort dans son panier, dans le salon' },
    { cle: 'jouets', label: 'Jouets préférés', placeholder: 'Ex. : la balle jaune, la corde' },
    { cle: 'peurs', label: 'Peurs et sensibilités', long: true, placeholder: 'Ex. : a peur de l\'aspirateur et des orages' },
    { cle: 'regles', label: 'Règles de la maison', long: true, placeholder: 'Ex. : pas sur le canapé, pas de friandises en plus' } ] },
  { id: 'contacts', titre: 'Contacts', icone: 'phone', champs: [
    { cle: 'proprietaireNom', label: 'Propriétaire (nom)', autocomplete: 'name' }, { cle: 'proprietaireTel', label: 'Propriétaire (téléphone)', type: 'tel', autocomplete: 'tel' },
    { cle: 'secoursNom', label: 'Personne de secours (nom)' }, { cle: 'secoursTel', label: 'Personne de secours (téléphone)', type: 'tel' },
    { cle: 'vetoNom', label: 'Vétérinaire (nom ou clinique)' }, { cle: 'vetoTel', label: 'Vétérinaire (téléphone)', type: 'tel' } ] },
  { id: 'pratique', titre: 'Infos pratiques', icone: 'info', champs: [
    { cle: 'infos', label: 'Autres informations utiles', long: true, placeholder: 'Ex. : où sont les croquettes, les sacs, la laisse' } ] },
];

const lienTel = (t) => `tel:${String(t).replace(/[^\d+]/g, '')}`;

// ----- Le contenu de la fiche (le même pour l'écran et pour le PDF) -----

/** État des vaccins d'un animal : { etat: 'a-jour' | 'retard' | 'inconnu', texte }. */
export function etatVaccins(animal) {
  const vaccins = storage.lister('soins').filter((s) => s.animalId === animal.id && s.type === 'vaccin');
  if (!vaccins.length) return { etat: 'inconnu', texte: 'Non renseigné dans Carnet Patte' };
  const enRetard = vaccins.map((s) => ({ s, statut: statutRappel(s) })).filter((x) => x.statut?.classe === 'retard');
  if (enRetard.length) return { etat: 'retard', texte: `À renouveler : ${nomCourtSoin(enRetard[0].s)} (rappel prévu le ${formatDate(enRetard[0].s.rappel)})` };
  const dernier = [...vaccins].sort((a, b) => b.date.localeCompare(a.date))[0];
  const prochain = vaccins.filter((s) => statutRappel(s)).sort((a, b) => a.rappel.localeCompare(b.rappel))[0];
  return { etat: 'a-jour', texte: `À jour · dernier : ${nomCourtSoin(dernier)} le ${formatDate(dernier.date)}${prochain ? ` · prochain rappel le ${formatDate(prochain.rappel)}` : ''}` };
}

/** Tout ce que la fiche affiche : identité, vaccins, sections remplies seulement, centres antipoison. */
export function modeleFiche(animal, fiche) {
  const pesees = storage.lister('pesees').filter((p) => p.animalId === animal.id).sort((a, b) => a.date.localeCompare(b.date));
  const dernierPoids = pesees[pesees.length - 1];
  const details = [nomEspece(animal), animal.race, animal.naissance ? age(animal.naissance) : ''].filter(Boolean);
  const contact = (nom, tel) => ({ valeur: [nom, tel].filter(Boolean).join(' · '), nom, tel });
  const lignesContacts = [['Propriétaire', 'proprietaire'], ['Personne de secours', 'secours'], ['Vétérinaire', 'veto']]
    .map(([libelle, c]) => ({ libelle, ...contact(fiche[`${c}Nom`], fiche[`${c}Tel`]) })).filter((l) => l.valeur);
  const sections = SECTIONS.map((s) => ({
    id: s.id, titre: s.titre,
    lignes: s.id === 'contacts' ? lignesContacts : s.champs.filter((c) => fiche[c.cle]).map((c) => ({ libelle: c.label, valeur: fiche[c.cle] })),
  })).filter((s) => s.lignes.length);
  return {
    nom: animal.nom,
    details,
    poids: dernierPoids ? `${formatPoids(dernierPoids.poidsKg)} (pesé le ${formatDate(dernierPoids.date)})` : '',
    vaccins: etatVaccins(animal),
    sections,
    antipoison: CENTRES_ANTIPOISON.map((c) => ({ nom: c.nom, tel: c.tel, horaires: c.horaires, lien: c.lien })),
    date: aujourdhui(),
  };
}

// ----- PDF -----

/** Photo de l'animal prête pour le PDF : { octets, largeur, hauteur } (JPEG), ou null. */
async function photoPourPdf(animal) {
  if (typeof animal.photo !== 'string' || !animal.photo.startsWith('data:image/')) return null;
  try {
    const image = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = animal.photo; });
    let url = animal.photo;
    if (!url.startsWith('data:image/jpeg')) { // le PDF n'accepte ici que du JPEG : on convertit
      const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(image, 0, 0);
      url = c.toDataURL('image/jpeg', 0.85);
    }
    const binaire = atob(url.split(',')[1]);
    return { octets: Uint8Array.from(binaire, (c) => c.charCodeAt(0)), largeur: image.naturalWidth, hauteur: image.naturalHeight };
  } catch { return null; }
}

/** Le PDF de la fiche (Uint8Array). */
export async function creerPdfFiche(animal, fiche) {
  const m = modeleFiche(animal, fiche);
  const pdf = new Pdf({ titre: `Fiche de garde - ${m.nom}`, pied: 'Fiche de garde · Carnet Patte' });
  pdf.entete({ surtitre: 'Fiche de garde', nom: m.nom,
    lignes: [m.details.join(' · '), m.poids && `Poids : ${m.poids}`, `Vaccins : ${m.vaccins.texte}`].filter(Boolean), photo: await photoPourPdf(animal) });
  if (!m.sections.length) pdf.paragraphe('Aucune information supplémentaire n\'a été remplie.', { couleur: [0.4, 0.4, 0.4] });
  for (const s of m.sections) {
    pdf.section(s.titre);
    for (const l of s.lignes) pdf.paire(l.libelle, l.valeur);
  }
  pdf.section('En cas d\'ingestion ou d\'intoxication');
  pdf.paragraphe('Appelez votre vétérinaire ou un centre antipoison vétérinaire :', { x: 52 });
  for (const c of m.antipoison) pdf.paragraphe(`${c.nom} : ${c.tel} (${c.horaires})`, { gras: true, x: 52 });
  pdf.espace(10);
  pdf.paragraphe(`Fiche établie le ${formatDate(m.date)} avec Carnet Patte.`, { taille: 9, couleur: [0.45, 0.45, 0.45] });
  return pdf.octets();
}

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

// ----- Pages -----

const lienFiche = (animal) => `#/animaux/${encodeURIComponent(animal.id)}`;
const lienGarde = (animal) => `${lienFiche(animal)}/garde`;

function introuvable(zone) {
  zone.innerHTML = `<div class="cp pg">${vide({ niveau: 1, icone: 'circle-help', titre: "Cet animal n'existe pas (ou plus).", texte: 'Il a peut-être été supprimé.',
    action: bouton({ texte: 'Retour à mes animaux', icone: 'arrow-left', href: '#/animaux' }) })}</div>`;
}

function formulaire(zone, animal) {
  const fiche = storage.lireFicheGarde(animal.id);
  const remplis = (s) => s.champs.filter((c) => fiche[c.cle]).length;
  zone.innerHTML = `
    <div class="cp pg gd-page cp-an-${couleurAnimal(animal)}">
      <a class="pg-lien fi-retour" href="${lienFiche(animal)}">${icone('arrow-left', { taille: 18 })} Fiche de ${echapper(animal.nom)}</a>
      <header class="pg-entete"><h1 tabindex="-1">Fiche de garde de ${echapper(animal.nom)}</h1>
        <p>Pour la personne qui garde ${echapper(animal.nom)}. Tout est facultatif : remplissez seulement ce qui est utile. Elle reste sur cet appareil.</p></header>
      <form class="gd-form" novalidate>
        ${SECTIONS.map((s, i) => `
        <details class="cp-carte gd-section"${i === 0 || remplis(s) ? ' open' : ''} data-section="${s.id}">
          <summary class="gd-section__titre"><span class="gd-section__icone" aria-hidden="true">${icone(s.icone, { taille: 20 })}</span><span>${s.titre}</span><span class="gd-section__nb" data-nb>${remplis(s) ? `${remplis(s)} rempli${remplis(s) > 1 ? 's' : ''}` : ''}</span><span class="gd-section__fleche" aria-hidden="true">${icone('chevron-down', { taille: 18 })}</span></summary>
          <div class="gd-section__corps">
            ${s.champs.map((c) => champ({ id: `gd-${c.cle}`, label: c.label, type: c.long ? 'textarea' : (c.type ?? 'text'), valeur: fiche[c.cle], placeholder: c.placeholder ?? '',
              attrs: { name: c.cle, maxlength: 2000, ...(c.long ? { rows: 3 } : {}), ...(c.autocomplete ? { autocomplete: c.autocomplete } : {}) } })).join('')}
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
  const lireChamps = () => Object.fromEntries(new FormData(form).entries());
  const enregistrer = () => {
    storage.enregistrerFicheGarde(animal.id, lireChamps());
    const f = storage.lireFicheGarde(animal.id);
    zone.querySelectorAll('[data-section]').forEach((d) => {
      const s = SECTIONS.find((x) => x.id === d.dataset.section);
      const n = s.champs.filter((c) => f[c.cle]).length;
      d.querySelector('[data-nb]').textContent = n ? `${n} rempli${n > 1 ? 's' : ''}` : '';
    });
  };
  form.addEventListener('change', () => { enregistrer(); zone.querySelector('[data-statut]').textContent = 'Enregistré.'; });
  form.addEventListener('submit', (e) => { e.preventDefault(); enregistrer(); toast('Fiche de garde enregistrée'); });
  zone.querySelector('[data-apercu]').addEventListener('click', enregistrer); // l'aperçu montre toujours la dernière saisie
}

function apercu(zone, animal) {
  const fiche = storage.lireFicheGarde(animal.id);
  const m = modeleFiche(animal, fiche);
  const photo = typeof animal.photo === 'string' && animal.photo.startsWith('data:image/') ? animal.photo : '';
  const ligneVaccin = { 'a-jour': 'circle-check', retard: 'bell-ring', inconnu: 'circle-help' }[m.vaccins.etat];
  zone.innerHTML = `
    <div class="cp pg gd-page cp-an-${couleurAnimal(animal)}">
      <a class="pg-lien fi-retour" href="${lienGarde(animal)}">${icone('arrow-left', { taille: 18 })} Modifier la fiche</a>
      <header class="pg-entete"><h1 tabindex="-1">Aperçu de la fiche de garde</h1><p>Voici ce que verra la personne qui garde ${echapper(animal.nom)}. Seules les sections remplies apparaissent.</p></header>

      <article class="cp-carte gd-feuille" aria-label="Fiche de garde de ${echapper(animal.nom)}" data-feuille>
        <header class="gd-feuille__tete">
          ${avatar({ grand: true, photo, nom: animal.nom, id: animal.id, couleur: couleurAnimal(animal), icone: infosEspece(animal).icone })}
          <div class="gd-feuille__id">
            <h2>${echapper(m.nom)}</h2>
            <p>${m.details.map(echapper).join(' · ')}</p>
            ${m.poids ? `<p>Poids : ${echapper(m.poids)}</p>` : ''}
          </div>
        </header>
        <p class="gd-vaccins gd-vaccins--${m.vaccins.etat}">${icone(ligneVaccin, { taille: 18 })}<span><strong>Vaccins :</strong> ${echapper(m.vaccins.texte)}</span></p>
        ${m.sections.length ? m.sections.map((s) => `
        <section class="gd-bloc" aria-labelledby="gd-t-${s.id}">
          <h3 id="gd-t-${s.id}">${s.titre}</h3>
          <dl class="gd-liste">${s.lignes.map((l) => `<div><dt>${echapper(l.libelle)}</dt><dd>${l.tel ? `${l.nom ? `${echapper(l.nom)} · ` : ''}<a href="${lienTel(l.tel)}">${echapper(l.tel)}</a>` : echapper(l.valeur)}</dd></div>`).join('')}</dl>
        </section>`).join('') : `<p class="cp-doux gd-vide">Aucune information supplémentaire remplie pour l'instant.</p>`}
        <section class="gd-bloc gd-bloc--poison" aria-labelledby="gd-t-poison">
          <h3 id="gd-t-poison">En cas d'ingestion ou d'intoxication</h3>
          <p>Appelez votre vétérinaire ou un centre antipoison vétérinaire :</p>
          <ul class="gd-liste gd-poison">${m.antipoison.map((c) => `<li><strong>${echapper(c.nom)}</strong><a href="${c.lien}">${echapper(c.tel)}</a><span class="cp-doux">${echapper(c.horaires)}</span></li>`).join('')}</ul>
        </section>
        <p class="gd-feuille__pied cp-doux">Fiche établie le ${formatDate(m.date)} avec Carnet Patte.</p>
      </article>

      ${alerte({ type: 'attention', titre: 'Avant de partager', texte: AVERTISSEMENT_PARTAGE })}
      <div class="gd-actions">
        ${bouton({ texte: 'Télécharger en PDF', icone: 'download', attrs: { 'data-act': 'pdf' } })}
        ${bouton({ texte: 'Partager', variante: 'secondaire', icone: 'external-link', attrs: { 'data-act': 'partager' } })}
      </div>
    </div>`;

  zone.addEventListener('click', async (e) => {
    const declencheur = e.target.closest('[data-act]');
    if (!declencheur) return;
    const ficheActuelle = storage.lireFicheGarde(animal.id);
    if (declencheur.dataset.act === 'pdf') {
      telechargerPdf(await creerPdfFiche(animal, ficheActuelle), nomFichierPdf(animal));
      toast('PDF créé sur votre appareil');
    } else if (declencheur.dataset.act === 'partager') {
      if (!await confirmer({ titre: 'Avant de partager', message: AVERTISSEMENT_PARTAGE, libelle: 'Partager', danger: false })) return;
      const octets = await creerPdfFiche(animal, ficheActuelle);
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

/** Route : #/animaux/<id>/garde (formulaire) et #/animaux/<id>/garde/apercu. */
export function rendre(zone, id, vue = '') {
  zone.classList.add('page-large');
  const animal = storage.trouver('animaux', id);
  if (!animal) { introuvable(zone); return; }
  if (vue === 'apercu') apercu(zone, animal); else formulaire(zone, animal);
}
