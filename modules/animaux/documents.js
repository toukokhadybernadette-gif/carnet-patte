// Onglet « Documents » de la fiche : photos et PDF (carnet de vaccination, ordonnance, analyse…), gardés sur l'appareil (IndexedDB).
// Rien n'est envoyé sur un serveur ; l'onglet marche hors connexion.

import * as docs from '../../js/documents-db.js';
import { echapper, aujourdhui, formatDate, formatTaille } from '../../js/utils.js';
import { modale, confirmer, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, badge, champ, selecteur, vide } from '../../js/composants.js';
import { erreurChamp } from './commun.js';

const estImage = (d) => d.mime.startsWith('image/');
const sansExtension = (nom) => nom.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[_]+/g, ' ').trim();

/** Adresses temporaires des aperçus : libérées à chaque réaffichage pour ne pas garder la mémoire. */
let adresses = [];
const adresseDe = (blob) => { const u = URL.createObjectURL(blob); adresses.push(u); return u; };

function carteHtml(d) {
  const vignette = estImage(d)
    ? `<img class="dc-vignette__img" src="${adresseDe(d.blob)}" alt="" loading="lazy">`
    : `<span class="dc-vignette__pdf" aria-hidden="true">${icone('file-text', { taille: 28 })}<b>PDF</b></span>`;
  return `
    <li class="cp-carte dc-carte" data-doc="${echapper(d.id)}">
      <span class="dc-vignette">${vignette}</span>
      <div class="dc-carte__corps">
        <strong class="dc-carte__titre">${echapper(d.titre)}</strong>
        <span class="dc-carte__type">${badge({ texte: docs.nomTypeDocument(d.type), variante: 'info' })}</span>
        <span class="dc-carte__meta"><time datetime="${d.date}">${formatDate(d.date)}</time> · ${formatTaille(d.taille)}</span>
      </div>
      <div class="dc-carte__actions">
        ${bouton({ texte: 'Ouvrir', variante: 'secondaire', taille: 's', icone: 'eye', attrs: { 'data-act': 'ouvrir', 'data-id': d.id, 'aria-label': `Ouvrir ${d.titre}` } })}
        ${bouton({ variante: 'secondaire', taille: 's', seul: true, icone: 'download', titre: `Télécharger ${d.titre}`, attrs: { 'data-act': 'telecharger', 'data-id': d.id } })}
        ${bouton({ variante: 'secondaire', taille: 's', seul: true, icone: 'trash-2', titre: `Supprimer ${d.titre}`, attrs: { 'data-act': 'supprimer', 'data-id': d.id } })}
      </div>
    </li>`;
}

function telecharger(d) {
  const lien = document.createElement('a');
  lien.href = adresseDe(d.blob);
  lien.download = `${d.titre.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'document'}.${d.mime === 'application/pdf' ? 'pdf' : d.mime === 'image/png' ? 'png' : 'jpg'}`;
  lien.hidden = true;
  document.body.append(lien);
  lien.click();
  lien.remove();
}

function ouvrir(d) {
  if (!estImage(d)) {
    const fenetre = window.open(adresseDe(d.blob), '_blank');
    if (!fenetre) telecharger(d); // fenêtre bloquée : on télécharge à la place
    return;
  }
  modale(d.titre, `<img class="dc-grande" src="${adresseDe(d.blob)}" alt="${echapper(d.titre)}"><p class="cp-doux">${echapper(docs.nomTypeDocument(d.type))} · ${formatDate(d.date)}</p>`);
}

/** Fenêtre « Ajouter un document ». */
function formulaire(animal, apres) {
  const html = `
    <form class="cp-formulaire dc-form" novalidate>
      ${champ({ id: 'doc-fichier', label: 'Photo ou PDF', type: 'file', aide: 'Photo (réduite automatiquement) ou PDF de 15 Mo au plus.', attrs: { accept: 'image/*,application/pdf', name: 'fichier' } })}
      ${champ({ id: 'doc-titre', label: 'Titre', placeholder: 'Ex. : Carnet de vaccination 2026', requis: true, attrs: { maxlength: 120, autocomplete: 'off' } })}
      ${champ({ id: 'doc-date', label: 'Date du document', type: 'date', valeur: aujourdhui(), attrs: { max: aujourdhui() } })}
      ${selecteur({ id: 'doc-type', label: 'Type', options: docs.TYPES_DOCUMENT.map((t) => ({ valeur: t.id, texte: t.nom })), valeur: 'vaccination' })}
      <p class="cp-doux">Le document reste sur cet appareil. Rien n'est envoyé sur internet.</p>
      <div class="dc-form__actions">
        ${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}
        ${bouton({ texte: 'Ajouter', type: 'submit', icone: 'check' })}
      </div>
    </form>`;
  modale(`Ajouter un document pour ${animal.nom}`, html, (dlg) => {
    const form = dlg.querySelector('form');
    const champFichier = form.querySelector('#doc-fichier');
    const champTitre = form.querySelector('#doc-titre');
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    champFichier.addEventListener('change', () => {
      erreurChamp(champFichier, '');
      const f = champFichier.files[0];
      if (f && !champTitre.value.trim()) champTitre.value = sansExtension(f.name).slice(0, 120);
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = champFichier.files[0];
      const titre = champTitre.value.trim();
      const date = form.querySelector('#doc-date').value || aujourdhui();
      form.querySelectorAll('[aria-invalid]').forEach((c) => erreurChamp(c, ''));
      const problemes = [];
      if (!f) problemes.push([champFichier, 'Choisissez une photo ou un PDF.']);
      if (!titre) problemes.push([champTitre, 'Donnez un titre au document.']);
      if (date > aujourdhui()) problemes.push([form.querySelector('#doc-date'), 'La date ne peut pas être dans le futur.']);
      if (problemes.length) { problemes.forEach(([c, m]) => erreurChamp(c, m)); problemes[0][0].focus(); return; }
      const valider = form.querySelector('[type=submit]');
      valider.disabled = true;
      try {
        const blob = await docs.preparerFichier(f);
        await docs.ajouterDocument({ animalId: animal.id, titre, date, type: form.querySelector('#doc-type').value, blob, nom: f.name });
        dlg.close();
        toast('Document ajouté');
        apres();
      } catch (err) {
        valider.disabled = false;
        erreurChamp(champFichier, err.message || "Le document n'a pas pu être enregistré.");
        champFichier.focus();
      }
    });
  });
}

/** Affiche l'onglet dans `zone`. Se réaffiche tout seul après chaque modification. */
export async function rendre(zone, animal) {
  adresses.forEach((u) => URL.revokeObjectURL(u));
  adresses = [];
  const section = document.createElement('section');
  section.className = 'dc';
  zone.replaceChildren(section);
  const rerendre = () => rendre(zone, animal);

  let liste = []; let espace = { octets: 0, nombre: 0 }; let appareil = null; let erreur = '';
  try { [liste, espace, appareil] = await Promise.all([docs.listerDocuments(animal.id), docs.espaceDocuments(), docs.espaceAppareil()]); } catch (e) { erreur = e.message; }
  if (!zone.isConnected) return;

  const texteEspace = `Espace utilisé par les documents : ${formatTaille(espace.octets)} (${espace.nombre} document${espace.nombre > 1 ? 's' : ''}, tous animaux confondus)`
    + (appareil ? ` · ${formatTaille(appareil.usage)} utilisés au total sur ${formatTaille(appareil.quota)} disponibles pour l'appli.` : '.');
  section.innerHTML = `
    <div class="sn-entete">
      <h2>Documents</h2>
      ${bouton({ texte: 'Ajouter un document', icone: 'plus', taille: 's', desactive: Boolean(erreur), attrs: { 'data-act': 'ajouter' } })}
    </div>
    ${erreur ? `<p class="cp-alerte cp-alerte--erreur" role="alert">${echapper(erreur)}</p>` : `<p class="cp-doux dc-espace" data-espace role="status">${echapper(texteEspace)}</p>`}
    ${liste.length
      ? `<ul class="dc-liste" aria-label="Documents de ${echapper(animal.nom)}">${liste.map(carteHtml).join('')}</ul>`
      : `<div class="cp-carte">${vide({ niveau: 3, icone: 'image', titre: 'Aucun document pour l\'instant',
        texte: 'Ajoutez une photo ou un PDF : carnet de vaccination, ordonnance, analyse… Ils restent sur cet appareil.',
        action: erreur ? '' : bouton({ texte: 'Ajouter un document', icone: 'plus', attrs: { 'data-act': 'ajouter' } }) })}</div>`}`;

  section.addEventListener('click', async (e) => {
    const declencheur = e.target.closest('[data-act]');
    if (!declencheur) return;
    if (declencheur.dataset.act === 'ajouter') { formulaire(animal, rerendre); return; }
    const d = liste.find((x) => x.id === declencheur.dataset.id);
    if (!d) return;
    if (declencheur.dataset.act === 'ouvrir') ouvrir(d);
    else if (declencheur.dataset.act === 'telecharger') telecharger(d);
    else if (declencheur.dataset.act === 'supprimer' && await confirmer(`Supprimer « ${d.titre} » ? Le fichier sera effacé de cet appareil.`)) {
      await docs.supprimerDocument(d.id);
      toast('Document supprimé');
      rerendre();
    }
  });
}
