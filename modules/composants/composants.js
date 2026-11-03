// Page de référence « #/composants » : présente chaque composant du système de design et ses états.
// Elle ne touche à aucune donnée : tout ce qui est affiché ici est de la mise en forme.
// Adresse : #/composants   (pas encore dans le menu : la navigation sera refaite à l'étape 4)

import { icone, NOMS_ICONES } from '../../js/icons.js';
import { NOMS_ICONES_ESPECES } from '../../js/icons-especes.js';
import {
  bouton, badge, statut, compteur, champ, selecteur, caseACocher, interrupteur, choix, avatar,
  carteAnimal, carteStat, carteProduit, alerte, vide, squelette,
  notifier, ouvrirModale, confirmer, activerOnglets, activerFiltres,
} from '../../js/composants.js';
import { ESPECES } from '../animaux/commun.js';

const SECTIONS = [
  ['fondations', 'Fondations'], ['especes', "Icônes d'espèces"], ['boutons', 'Boutons'], ['champs', 'Formulaires'], ['cartes', 'Cartes'],
  ['badges', 'Badges'], ['modales', 'Modales'], ['notifications', 'Notifications'], ['filtres', 'Filtres et onglets'],
  ['navigation', 'Navigation'], ['tableaux', 'Tableaux et listes'], ['chargement', 'Chargement et vide'],
];

const COULEURS = [
  ['Vert forêt', '--cp-foret', '#243D35', 'Texte, titres, bouton principal', '#fff'],
  ['Vert sauge', '--cp-sauge', '#A8BFA5', 'Bordures, illustrations', '#243D35'],
  ['Blanc cassé', '--cp-fond', '#F6F5F0', 'Fond de l\'application', '#243D35'],
  ['Vert clair', '--cp-vert-clair', '#D9E6D5', 'Sélections, badges calmes', '#243D35'],
  ['Beige chaud', '--cp-beige', '#D7A879', 'Accents (jamais en texte sur fond clair)', '#243D35'],
  ['Terre cuite', '--cp-terre', '#9A4330', 'Retard, erreur, danger', '#fff'],
  ['Ambre', '--cp-ambre', '#7A4F0F', 'Attention, bientôt', '#fff'],
  ['Succès', '--cp-succes-texte', '#1F5A3F', 'Confirmation', '#fff'],
  ['Information', '--cp-info', '#2B5560', 'Information', '#fff'],
];

const section = (id, titre, intro, corps) => `
  <section class="cp-ref__section" id="cp-${id}" aria-labelledby="cp-${id}-titre">
    <header><h2 id="cp-${id}-titre">${titre}</h2><p>${intro}</p></header>
    ${corps}
  </section>`;

const groupe = (titre, contenu, classeBac = '') => `
  <div class="cp-ref__groupe"><h3>${titre}</h3><div class="cp-ref__bac ${classeBac}">${contenu}</div></div>`;

const cas = (legende, html, large = false) => `<div class="cp-ref__cas${large ? ' cp-ref__cas--large' : ''}">${html}<small>${legende}</small></div>`;

// ----- Sections -----

function fondations() {
  const couleurs = COULEURS.map(([nom, variable, hex, role, texte]) => `
    <div class="cp-ref__couleur">
      <div class="cp-ref__echantillon" style="background:var(${variable});color:${texte}">${nom}</div>
      <span class="cp-ref__code">${hex} · ${variable}</span><span class="cp-doux">${role}</span>
    </div>`).join('');
  const types = `
    <div class="cp-ref__cas cp-ref__cas--large">
      <h1>Titre 1 : Manrope Bold 34 px</h1><h2>Titre 2 : Manrope Bold 26 px</h2><h3>Titre 3 : Manrope Bold 20 px</h3>
      <p>Texte courant : Inter Regular 16 px, interligne 1,5. Les accents français (é è à ç œ) sont pris en charge.</p>
      <p class="cp-doux">Texte secondaire : Inter 14 px, gris vert (5,6:1 sur blanc).</p>
      <span style="font-weight:500">Boutons et libellés : Inter Medium 16 px</span>
    </div>`;
  const rayons = [['Carte', '--cp-rayon-carte', '20 px'], ['Bouton', '--cp-rayon-bouton', '14 px'], ['Champ', '--cp-rayon-champ', '12 px'], ['Pastille', '--cp-rayon-pastille', '999 px']]
    .map(([n, v, px]) => cas(`${n} · ${px}`, `<div class="cp-ref__rayon" style="border-radius:var(${v})"></div>`)).join('');
  const ombres = [['Légère', '--cp-ombre-s'], ['Moyenne', '--cp-ombre-m'], ['Forte (modales)', '--cp-ombre-l']]
    .map(([n, v]) => cas(n, `<div class="cp-ref__ombre" style="box-shadow:var(${v})"></div>`)).join('');
  const icones = NOMS_ICONES.map((n) => `<div class="cp-ref__icone">${icone(n, { taille: 24 })}<span>${n}</span></div>`).join('');
  return section('fondations', 'Fondations',
    'Couleurs, typographie, formes et icônes. Tout vient de <code>css/tokens.css</code> et <code>js/icons.js</code> : on ne met jamais de valeur « en dur » dans un composant.',
    `${groupe('Palette', `<div class="cp-ref__pastilles" style="width:100%">${couleurs}</div>`)}
     ${groupe('Typographie', types)}
     ${groupe('Rayons', rayons)}
     ${groupe('Ombres (très légères)', ombres, 'cp-ref__bac--fond')}
     ${groupe(`Icônes (${NOMS_ICONES.length}, trait fin 1,75)`, `<div class="cp-ref__icones" style="width:100%">${icones}</div>`)}`);
}

function especes() {
  const carte = (e) => {
    const sur = NOMS_ICONES_ESPECES.includes(e.icone);
    return `
      <div class="cp-ref__espece">
        <span class="cp-avatar cp-avatar--grand">${icone(e.icone, { taille: 44 })}</span>
        <strong>${e.nom}</strong>
        <span class="cp-ref__code">${e.id}</span>
        <span class="cp-ref__tailles">${icone(e.icone, { taille: 16 })}${icone(e.icone, { taille: 24 })}${icone(e.icone, { taille: 32 })}</span>
        ${badge({ texte: sur ? 'Sur mesure' : e.icone === 'paw-print' ? 'Patte (générique)' : 'Lucide', variante: sur ? 'succes' : 'neutre' })}
      </div>`;
  };
  return section('especes', "Icônes d'espèces",
    `Les ${ESPECES.length} espèces proposées : ${NOMS_ICONES_ESPECES.length} icônes dessinées sur mesure (<code>js/icons-especes.js</code>), dans le même style que Lucide, et ${ESPECES.length - NOMS_ICONES_ESPECES.length - 1} icônes Lucide. La patte, symbole de Carnet Patte, sert pour « Autre » et pour toute espèce inconnue.`,
    `<div class="cp-ref__groupe"><h3>Planche de contact</h3><div class="cp-ref__bac cp-ref__bac--fond"><div class="cp-ref__especes">${ESPECES.map(carte).join('')}</div></div></div>
     ${groupe('Dans leur contexte', `
        ${cas('Pastilles de choix', choix({ nom: 'ref-esp', legende: 'Espèce', options: ESPECES.map((e) => ({ valeur: e.id, texte: e.nom, icone: e.icone })), valeur: 'cheval' }), true)}
        ${cas("Carte d'animal", carteAnimal({ nom: 'Pomme', espece: 'Cheval', details: 'Comtois', icone: 'cheval', badges: badge({ texte: 'À jour', variante: 'succes' }) }), true)}
        ${cas('Espèce inconnue : la patte', carteAnimal({ nom: 'Inconnu', espece: 'Espèce inconnue', icone: 'espece-qui-n-existe-pas' }), true)}`, 'cp-ref__bac--grille')}
     <div class="cp-ref__groupe"><h3>Ajouter une espèce</h3>
       ${alerte({ type: 'info', titre: 'Deux étapes', texte: "Dessiner l'icône dans js/icons-especes.js (grille 24 × 24, sans remplissage, trait arrondi), puis ajouter une ligne dans ESPECES (modules/animaux/commun.js) avec le même identifiant. Rien d'autre à modifier : les listes, les cartes et les avatars la prennent en compte." })}
     </div>`);
}

function boutons() {
  const variantes = [['principal', 'Principal'], ['secondaire', 'Secondaire'], ['discret', 'Discret'], ['danger', 'Danger']];
  const etats = variantes.map(([v, nom]) => `
    <div class="cp-ref__cas">
      ${bouton({ texte: nom, variante: v, icone: 'paw-print' })}
      ${bouton({ texte: 'Survolé', variante: v, attrs: { class: `cp-btn cp-btn--${v} is-survol`, tabindex: '-1' } })}
      ${bouton({ texte: 'Clavier', variante: v, attrs: { class: `cp-btn cp-btn--${v} is-focus`, tabindex: '-1' } })}
      ${bouton({ texte: 'Désactivé', variante: v, desactive: true })}
      ${bouton({ texte: 'Chargement', variante: v, chargement: true })}
    </div>`).join('');
  return section('boutons', 'Boutons',
    'Quatre variantes, cinq états. Hauteur minimale de 44 px pour le doigt. Un bouton « icône seule » a toujours un nom accessible (<code>titre</code>).',
    `<div class="cp-ref__groupe"><h3>Variantes et états</h3><div class="cp-ref__bac cp-ref__bac--grille">${etats}</div></div>
     ${groupe('Tailles et formes', `
       ${cas('Normal', bouton({ texte: 'Ajouter un animal', icone: 'plus' }))}
       ${cas('Petit', bouton({ texte: 'Modifier', variante: 'secondaire', icone: 'pencil', taille: 's' }))}
       ${cas('Icône seule', bouton({ variante: 'secondaire', seul: true, icone: 'trash-2', titre: 'Supprimer' }))}
       ${cas('Icône seule petite', bouton({ variante: 'discret', seul: true, taille: 's', icone: 'pencil', titre: 'Modifier' }))}
       ${cas('Lien en forme de bouton', bouton({ texte: 'Retour', variante: 'secondaire', icone: 'arrow-left', href: '#/composants' }))}
       ${cas('Bascule (sélectionné)', bouton({ texte: 'Favori', variante: 'secondaire', icone: 'heart', attrs: { 'aria-pressed': 'true' } }))}
       ${cas('Pleine largeur (mobile)', bouton({ texte: 'Enregistrer', bloc: true }), true)}`)}`);
}

function champs() {
  const especes = ESPECES.slice(0, 7).map((e) => ({ valeur: e.id, texte: e.nom, icone: e.icone }));
  return section('champs', 'Formulaires',
    'Chaque champ a une étiquette visible, un texte d\'aide et un message d\'erreur reliés au champ pour les lecteurs d\'écran. Le contour des champs respecte le contraste minimal de 3:1.',
    `<div class="cp-ref__groupe"><h3>États d'un champ de texte</h3><div class="cp-ref__bac cp-ref__bac--grille">
       ${champ({ id: 'd-normal', label: 'Nom de l\'animal', placeholder: 'Ex. : Mimi', aide: 'Facultatif : 40 caractères maximum.' })}
       ${champ({ id: 'd-rempli', label: 'Rempli', valeur: 'Moka' })}
       ${champ({ id: 'd-survol', label: 'Survolé', valeur: 'Moka', attrs: { class: 'cp-input is-survol', tabindex: '-1' } })}
       ${champ({ id: 'd-focus', label: 'Sélectionné (clavier)', valeur: 'Moka', attrs: { class: 'cp-input is-focus', tabindex: '-1' } })}
       ${champ({ id: 'd-erreur', label: 'En erreur', valeur: '', requis: true, erreur: 'Le nom est obligatoire.' })}
       ${champ({ id: 'd-desactive', label: 'Désactivé', valeur: 'Non modifiable', desactive: true })}
       ${champ({ id: 'd-charge', label: 'En chargement', valeur: 'Vérification…', chargement: true })}
       ${champ({ id: 'd-recherche', label: 'Avec icône', type: 'search', icone: 'search', placeholder: 'Rechercher…' })}
       ${champ({ id: 'd-note', label: 'Zone de texte', type: 'textarea', placeholder: 'Notes sur le soin…' })}
     </div></div>
     <div class="cp-ref__groupe"><h3>Listes, cases et interrupteurs</h3><div class="cp-ref__bac cp-ref__bac--grille">
       ${selecteur({ id: 'd-sel', label: 'Type de soin', options: [{ valeur: 'vaccin', texte: 'Vaccin' }, { valeur: 'vermifuge', texte: 'Vermifuge' }, { valeur: 'veto', texte: 'Visite véto' }], valeur: 'vaccin' })}
       ${selecteur({ id: 'd-sel-err', label: 'Liste en erreur', options: [{ valeur: '', texte: 'Choisir…' }], erreur: 'Choisissez une valeur.' })}
       ${selecteur({ id: 'd-sel-off', label: 'Liste désactivée', options: [{ valeur: 'a', texte: 'Non modifiable' }], desactive: true })}
       <div class="cp-formulaire">
         ${caseACocher({ id: 'd-case1', label: 'Case cochée', coche: true })}
         ${caseACocher({ id: 'd-case2', label: 'Case vide' })}
         ${caseACocher({ id: 'd-case3', label: 'Case désactivée', desactive: true })}
       </div>
       <div class="cp-formulaire">
         ${interrupteur({ id: 'd-sw1', label: 'Rappels par e-mail', actif: true })}
         ${interrupteur({ id: 'd-sw2', label: 'Newsletter' })}
         ${interrupteur({ id: 'd-sw3', label: 'Option indisponible', desactive: true })}
       </div>
     </div></div>
     ${groupe('Sélecteur de choix (ex. espèce)', choix({ nom: 'd-espece', legende: 'Espèce', options: especes, valeur: 'chat' }), '')}
     ${groupe('Formulaire complet', `<form class="cp-formulaire" style="width:100%;max-width:440px" novalidate>
        ${champ({ id: 'f-nom', label: 'Nom', requis: true, placeholder: 'Ex. : Mimi' })}
        ${selecteur({ id: 'f-esp', label: 'Espèce', options: ESPECES.map((e) => ({ valeur: e.id, texte: e.nom })) })}
        ${champ({ id: 'f-nais', label: 'Date de naissance', type: 'date', aide: 'Facultatif.' })}
        <div id="f-retour"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap">
          ${bouton({ texte: 'Annuler', variante: 'secondaire' })}
          ${bouton({ texte: 'Enregistrer', type: 'submit', attrs: { id: 'f-envoi' } })}
        </div></form>`)}`);
}

function cartes() {
  return section('cartes', 'Cartes',
    'Cartes d\'animaux, de statistiques et de produits. Les cartes cliquables se soulèvent légèrement au survol. <strong>Les produits ci-dessous sont des modèles de mise en forme : aucun produit, vendeur ni prix réel.</strong>',
    `${groupe('Carte d\'animal', `
       ${cas('Normale', carteAnimal({ nom: 'Mimi', espece: 'Chat', details: 'Européen', icone: 'cat', badges: badge({ texte: 'À jour', variante: 'succes' }) }), true)}
       ${cas('Cliquable + alerte', carteAnimal({ nom: 'Moka', espece: 'Chien', details: 'Labrador', icone: 'dog', href: '#/composants', badges: badge({ texte: '1 rappel en retard', variante: 'alerte', icone: 'bell-ring' }) }), true)}
       ${cas('Sélectionnée', carteAnimal({ nom: 'Noisette', espece: 'Lapin', icone: 'rabbit', selectionnee: true }), true)}
       ${cas('Survolée', carteAnimal({ nom: 'Noisette', espece: 'Lapin', icone: 'rabbit', badges: badge({ texte: 'Dans 5 j', variante: 'attention' }) }).replace('class="cp-carte ', 'class="cp-carte is-survol '), true)}`, 'cp-ref__bac--grille cp-ref__bac--fond')}
     ${groupe('Carte de statistique', `
       ${cas('Avec hausse', carteStat({ libelle: 'Animaux suivis', valeur: 12, icone: 'paw-print', variation: { texte: '+2 ce mois-ci', sens: 'hausse' } }), true)}
       ${cas('Avec baisse', carteStat({ libelle: 'Rappels en retard', valeur: 3, icone: 'bell', variation: { texte: '-1 depuis hier', sens: 'baisse' } }), true)}
       ${cas('Simple', carteStat({ libelle: 'Prochain rendez-vous', valeur: 'Demain', icone: 'calendar' }), true)}`, 'cp-ref__bac--grille cp-ref__bac--fond')}
     ${groupe('Carte de produit (modèle)', `
       ${cas('Normale', carteProduit({ nom: 'Nom du produit', vendeur: 'Nom de la boutique', prix: '00,00 €', etiquette: 'Modèle' }), true)}
       ${cas('Sans étiquette', carteProduit({ nom: 'Nom du produit', vendeur: 'Nom de la boutique', prix: '00,00 €' }), true)}`, 'cp-ref__bac--grille cp-ref__bac--fond')}
     ${groupe('Carte désactivée ou à venir', `
       ${cas('Fonction à venir', `<div class="cp-carte" aria-disabled="true" style="width:280px"><h3 class="cp-carte__titre">Carte Patte</h3><p class="cp-doux">Trouver un vétérinaire près de chez vous.</p>${badge({ texte: 'Bientôt disponible', variante: 'bientot' })}</div>`)}`, 'cp-ref__bac--fond')}`);
}

function badges() {
  const liste = [['defaut', 'Par défaut'], ['succes', 'À jour'], ['info', 'Information'], ['attention', 'Dans 5 j'], ['alerte', 'En retard'], ['premium', 'Premium'], ['neutre', 'Terminé'], ['bientot', 'Bientôt disponible']];
  return section('badges', 'Badges et statuts',
    'La couleur ne porte jamais seule l\'information : un texte l\'accompagne toujours.',
    `${groupe('Badges', liste.map(([v, t]) => cas(v, badge({ texte: t, variante: v }))).join(''))}
     ${groupe('Badges avec icône', `
       ${badge({ texte: '1 rappel en retard', variante: 'alerte', icone: 'bell-ring' })}
       ${badge({ texte: 'Vacciné', variante: 'succes', icone: 'check' })}
       ${badge({ texte: 'Rappel le 1 déc.', variante: 'attention', icone: 'clock' })}`)}
     ${groupe('Points de statut', `
       ${statut({ texte: 'Neutre' })} ${statut({ texte: 'À jour', variante: 'ok' })} ${statut({ texte: 'Bientôt', variante: 'attention' })} ${statut({ texte: 'En retard', variante: 'alerte' })}`)}
     ${groupe('Compteurs', `
       ${cas('Un nombre', compteur(3, 'rappels en retard'))}
       ${cas('Dans un menu', `<a class="cp-nav-item" href="#/composants" style="width:240px">${icone('bell', { taille: 20 })}Rappels ${compteur(3, 'en retard')}</a>`)}`)}`);
}

function modales() {
  return section('modales', 'Modales et confirmations',
    'Basées sur l\'élément natif <code>&lt;dialog&gt;</code> : le focus reste dans la fenêtre, Échap la ferme et le focus revient au bouton d\'origine. Rien n\'est enregistré dans ces démonstrations.',
    groupe('Essayer', `
      ${bouton({ texte: 'Ouvrir une modale', variante: 'secondaire', attrs: { 'data-demo': 'modale' } })}
      ${bouton({ texte: 'Confirmation de suppression', variante: 'danger', icone: 'trash-2', attrs: { 'data-demo': 'confirmer' } })}
      ${bouton({ texte: 'Confirmation avec chargement', variante: 'secondaire', attrs: { 'data-demo': 'confirmer-charge' } })}`));
}

function notifications() {
  return section('notifications', 'Notifications et messages',
    'Messages en ligne (restent affichés) et notifications éphémères (disparaissent seules, avec bouton de fermeture). Les erreurs sont annoncées immédiatement aux lecteurs d\'écran.',
    `<div class="cp-ref__groupe"><h3>Messages en ligne</h3><div class="cp-formulaire">
       ${alerte({ type: 'succes', titre: 'Animal ajouté', texte: 'Mimi a bien été enregistrée.' })}
       ${alerte({ type: 'info', titre: 'Astuce', texte: 'Ajoutez une date de rappel quand vous notez un soin.' })}
       ${alerte({ type: 'attention', titre: 'Attention', texte: 'Cette action remplacera toutes les données actuelles.' })}
       ${alerte({ type: 'erreur', titre: 'Erreur', texte: 'Impossible d\'enregistrer : l\'espace du navigateur est plein.' })}
     </div></div>
     ${groupe('Notifications éphémères', `
       ${bouton({ texte: 'Succès', variante: 'secondaire', icone: 'circle-check', attrs: { 'data-notif': 'succes' } })}
       ${bouton({ texte: 'Information', variante: 'secondaire', icone: 'info', attrs: { 'data-notif': 'info' } })}
       ${bouton({ texte: 'Erreur', variante: 'secondaire', icone: 'circle-alert', attrs: { 'data-notif': 'erreur' } })}`)}`);
}

function filtres() {
  const filtresEspeces = [['chien', 'Chiens', 'dog', 4], ['chat', 'Chats', 'cat', 7], ['lapin', 'Lapins', 'rabbit', 2], ['oiseau', 'Oiseaux', 'bird', 0]];
  return section('filtres', 'Filtres et onglets',
    'Les filtres sont des boutons à bascule (<code>aria-pressed</code>). Les onglets se parcourent aux flèches du clavier, avec Début et Fin.',
    `${groupe('Filtres par espèce', `<div class="cp-filtres" id="demo-filtres" role="group" aria-label="Filtrer par espèce" style="width:100%">
        ${filtresEspeces.map(([v, t, i, n], k) => `<button type="button" class="cp-filtre" data-valeur="${v}" aria-pressed="${k === 1}"${n === 0 ? ' disabled' : ''}>${icone(i, { taille: 16 })}${t}<span class="cp-filtre__nombre">${n}</span></button>`).join('')}
        <button type="button" class="cp-filtre is-survol" aria-pressed="false" tabindex="-1">Survolé</button>
      </div><p class="cp-doux" style="width:100%;margin:0">Sélection : <span id="demo-filtres-etat">Chats</span> (le filtre « Oiseaux » est désactivé : aucun résultat)</p>`)}
     ${groupe('Barre de recherche et filtres', `<div class="cp-barre-outils" style="width:100%">
        <div class="cp-champ__zone">${icone('search', { taille: 20 })}<input class="cp-input" type="search" placeholder="Rechercher un animal…" aria-label="Rechercher un animal"></div>
        <div style="min-width:180px">${selecteur({ id: 'bo-tri', label: 'Trier par', options: [{ valeur: 'nom', texte: 'Nom' }, { valeur: 'age', texte: 'Âge' }] })}</div>
        ${bouton({ texte: 'Filtres', variante: 'secondaire', icone: 'list-filter' })}</div>`)}
     <div class="cp-ref__groupe"><h3>Onglets</h3><div class="cp-ref__bac" style="display:block" id="demo-onglets">
        <div class="cp-onglets" role="tablist" aria-label="Fiche de l'animal">
          <button type="button" class="cp-onglet" role="tab" id="o-sante" aria-controls="p-sante" aria-selected="true">${icone('stethoscope', { taille: 18 })}Santé</button>
          <button type="button" class="cp-onglet" role="tab" id="o-poids" aria-controls="p-poids" aria-selected="false">${icone('scale', { taille: 18 })}Poids</button>
          <button type="button" class="cp-onglet" role="tab" id="o-histo" aria-controls="p-histo" aria-selected="false">${icone('calendar', { taille: 18 })}Historique</button>
          <button type="button" class="cp-onglet" role="tab" id="o-docs" aria-controls="p-docs" aria-selected="false" disabled>${icone('image', { taille: 18 })}Documents</button>
        </div>
        <div class="cp-onglet-panneau" role="tabpanel" id="p-sante" aria-labelledby="o-sante" tabindex="0"><p>Vaccins, vermifuges et visites chez le vétérinaire.</p></div>
        <div class="cp-onglet-panneau" role="tabpanel" id="p-poids" aria-labelledby="o-poids" tabindex="0" hidden><p>Courbe et historique des pesées.</p></div>
        <div class="cp-onglet-panneau" role="tabpanel" id="p-histo" aria-labelledby="o-histo" tabindex="0" hidden><p>Tous les événements, du plus récent au plus ancien.</p></div>
        <div class="cp-onglet-panneau" role="tabpanel" id="p-docs" aria-labelledby="o-docs" tabindex="0" hidden><p>Bientôt disponible.</p></div>
      </div></div>`);
}

function navigation() {
  const item = (nom, i, courant = false, extra = '') => `<li><a class="cp-nav-item" href="#/composants"${courant ? ' aria-current="page"' : ''}>${icone(i, { taille: 20 })}${nom}${extra}</a></li>`;
  const bas = (nom, i, courant = false) => `<a class="cp-nav-bas__item" href="#/composants"${courant ? ' aria-current="page"' : ''}><span class="cp-nav-bas__icone">${icone(i, { taille: 22 })}</span>${nom}</a>`;
  return section('navigation', 'Éléments de navigation',
    '<strong>Modèles seulement</strong> : la navigation de l\'application n\'est pas encore remplacée (étape 4). Les liens ci-dessous ne mènent nulle part.',
    `<div class="cp-ref__nav-demo">
       <div><h3 style="margin-bottom:12px">Barre latérale</h3><ul class="cp-nav-liste">
         ${item('Accueil', 'house')}${item('Mes animaux', 'paw-print', true)}${item('Rappels', 'bell', false, compteur(3, 'en retard'))}
         ${item('Carte Patte', 'map-pin', false, badge({ texte: 'Bientôt', variante: 'bientot' }))}
         <li><a class="cp-nav-item" href="#/composants" aria-disabled="true" tabindex="-1">${icone('store', { taille: 20 })}Boutique (désactivé)</a></li>
       </ul></div>
       <div><h3 style="margin-bottom:12px">Barre du bas (mobile)</h3><nav class="cp-nav-bas" aria-label="Exemple de barre du bas">
         ${bas('Accueil', 'house')}${bas('Animaux', 'paw-print', true)}${bas('Carte', 'map-pin')}${bas('Boutique', 'shopping-bag')}${bas('Profil', 'user')}</nav>
         <p class="cp-doux" style="margin-top:12px">Cinq entrées, zone tactile d'au moins 56 px de haut.</p></div>
       <div><h3 style="margin-bottom:12px">Fil d'Ariane</h3><nav aria-label="Fil d'Ariane"><ol class="cp-fil">
         <li><a href="#/composants">Accueil</a>${icone('chevron-right', { taille: 14 })}</li><li><a href="#/composants">Mes animaux</a>${icone('chevron-right', { taille: 14 })}</li><li><span aria-current="page">Mimi</span></li></ol></nav>
         <h3 style="margin:20px 0 12px">Pagination</h3><nav aria-label="Pagination"><ul class="cp-pagination">
           <li>${bouton({ variante: 'secondaire', seul: true, taille: 's', icone: 'chevron-left', titre: 'Page précédente', desactive: true })}</li>
           <li>${bouton({ texte: '1', variante: 'principal', taille: 's', attrs: { 'aria-current': 'page', 'aria-label': 'Page 1' } })}</li>
           <li>${bouton({ texte: '2', variante: 'discret', taille: 's', attrs: { 'aria-label': 'Page 2' } })}</li>
           <li>${bouton({ texte: '3', variante: 'discret', taille: 's', attrs: { 'aria-label': 'Page 3' } })}</li>
           <li>${bouton({ variante: 'secondaire', seul: true, taille: 's', icone: 'chevron-right', titre: 'Page suivante' })}</li></ul></nav></div>
     </div>`);
}

function tableaux() {
  const ligne = (nom, esp, i, rappel, etat, v, selectionne = false) => `
    <tr${selectionne ? ' aria-selected="true"' : ''}>
      <td class="cp-tableau__nom">${avatar({ icone: i })}${nom}</td>
      <td data-label="Espèce">${esp}</td><td data-label="Prochain rappel">${rappel}</td><td data-label="Statut">${badge({ texte: etat, variante: v })}</td>
      <td class="cp-tableau__actions">${bouton({ variante: 'discret', seul: true, taille: 's', icone: 'pencil', titre: `Modifier ${nom}` })}${bouton({ variante: 'discret', seul: true, taille: 's', icone: 'trash-2', titre: `Supprimer ${nom}` })}</td>
    </tr>`;
  const li = (i, titre, meta, fin) => `<li class="cp-liste__ligne"><span class="cp-liste__icone">${icone(i, { taille: 20 })}</span><div class="cp-liste__corps"><span class="cp-liste__titre">${titre}</span><span class="cp-liste__meta">${meta}</span></div><div class="cp-liste__fin">${fin}</div></li>`;
  return section('tableaux', 'Tableaux et listes',
    'Le tableau est un vrai <code>&lt;table&gt;</code> (lisible par les lecteurs d\'écran). Sur téléphone, chaque ligne devient une fiche : aucun défilement horizontal. Données d\'exemple.',
    `<div class="cp-ref__groupe"><h3>Tableau</h3><div class="cp-tableau-enveloppe"><table class="cp-tableau">
        <caption>Animaux suivis (exemple)</caption>
        <thead><tr><th scope="col">Animal</th><th scope="col">Espèce</th><th scope="col">Prochain rappel</th><th scope="col">Statut</th><th scope="col"><span class="cp-sr">Actions</span></th></tr></thead>
        <tbody>
          ${ligne('Mimi', 'Chat', 'cat', '8 nov. 2026', 'Dans 5 j', 'attention')}
          ${ligne('Moka', 'Chien', 'dog', '24 oct. 2026', 'En retard', 'alerte', true)}
          ${ligne('Noisette', 'Lapin', 'rabbit', '7 janv. 2027', 'À jour', 'succes')}
        </tbody></table></div></div>
     <div class="cp-ref__groupe"><h3>Liste</h3><ul class="cp-liste">
        ${li('syringe', 'Vaccin CHPPiL + rage', 'Moka · 3 déc. 2026', badge({ texte: 'Dans 30 j', variante: 'succes' }))}
        ${li('pill', 'Vermifuge', 'Moka · 24 oct. 2026', badge({ texte: 'En retard', variante: 'alerte' }) + bouton({ texte: 'Fait', icone: 'check', taille: 's' }))}
        <li><a class="cp-liste__ligne cp-liste__ligne--lien" href="#/composants"><span class="cp-liste__icone">${icone('scale', { taille: 20 })}</span><div class="cp-liste__corps"><span class="cp-liste__titre">Ligne cliquable</span><span class="cp-liste__meta">Toute la ligne est un lien</span></div>${icone('chevron-right', { taille: 20 })}</a></li>
      </ul></div>`);
}

function chargement() {
  return section('chargement', 'Chargement et états vides',
    'Pendant un chargement, des squelettes gardent la mise en page stable. Avec « réduire les animations », ils deviennent fixes. Un état vide explique quoi faire ensuite.',
    `${groupe('Squelettes', `
       ${cas('Carte d\'animal', `<div class="cp-carte cp-carte-animal" style="width:300px" aria-busy="true" role="status"><span class="cp-sr">Chargement…</span>${squelette({ largeur: '56px', hauteur: '56px', rond: true })}<div style="flex:1;display:grid;gap:10px">${squelette({ largeur: '60%', hauteur: '18px' })}${squelette({ largeur: '90%' })}</div></div>`)}
       ${cas('Liste', `<div class="cp-carte" style="width:300px;display:grid;gap:14px" aria-busy="true" role="status"><span class="cp-sr">Chargement…</span>${squelette({ hauteur: '16px' })}${squelette({ largeur: '80%', hauteur: '16px' })}${squelette({ largeur: '65%', hauteur: '16px' })}</div>`)}
       ${cas('Roue', `<span class="cp-spinner" role="status" aria-label="Chargement"></span>`)}`, 'cp-ref__bac--fond cp-ref__bac--haut')}
     ${groupe('États vides', `
       ${cas('Aucun animal', `<div class="cp-carte" style="width:320px">${vide({ icone: 'paw-print', titre: 'Aucun animal pour l\'instant', texte: 'Ajoutez votre premier compagnon pour suivre sa santé.', action: bouton({ texte: 'Ajouter un animal', icone: 'plus' }) })}</div>`)}
       ${cas('Aucun résultat', `<div class="cp-carte" style="width:320px">${vide({ icone: 'search', titre: 'Aucun résultat', texte: 'Essayez avec d\'autres mots ou retirez un filtre.', action: bouton({ texte: 'Effacer les filtres', variante: 'secondaire' }) })}</div>`)}`, 'cp-ref__bac--fond cp-ref__bac--haut')}`);
}

// ----- Page -----

export function rendre(zone, segments) {
  zone.innerHTML = `
    <div class="cp cp-ref">
      <div class="cp-ref__entete">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge({ texte: 'Page interne', variante: 'neutre' })}${badge({ texte: 'Étape 3', variante: 'info' })}</div>
        <h1>Système de composants</h1>
        <p class="cp-doux" style="max-width:70ch;margin:0">Référence visuelle de Carnet Patte : chaque composant, avec ses états (normal, survolé, sélectionné, désactivé, chargement, erreur). Cette page ne modifie aucune donnée.</p>
      </div>
      <nav class="cp-ref__sommaire" aria-label="Sections de la page">
        ${SECTIONS.map(([id, nom]) => `<button type="button" class="cp-filtre" data-vers="cp-${id}">${nom}</button>`).join('')}
      </nav>
      ${fondations()}${especes()}${boutons()}${champs()}${cartes()}${badges()}${modales()}${notifications()}${filtres()}${navigation()}${tableaux()}${chargement()}
    </div>`;

  const racine = zone.querySelector('.cp');
  const reduire = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sommaire : défile jusqu'à la section sans changer l'adresse (qui sert au routeur)
  racine.querySelector('.cp-ref__sommaire').addEventListener('click', (e) => {
    const b = e.target.closest('[data-vers]');
    if (!b) return;
    const cible = document.getElementById(b.dataset.vers);
    cible.scrollIntoView({ behavior: reduire ? 'auto' : 'smooth', block: 'start' });
    cible.querySelector('h2').setAttribute('tabindex', '-1');
    cible.querySelector('h2').focus({ preventScroll: true });
  });

  // Démonstrations interactives
  racine.addEventListener('click', async (e) => {
    const demo = e.target.closest('[data-demo]')?.dataset.demo;
    const notif = e.target.closest('[data-notif]')?.dataset.notif;
    const favori = e.target.closest('[data-favori]');
    if (favori) {
      const actif = favori.getAttribute('aria-pressed') !== 'true';
      favori.setAttribute('aria-pressed', String(actif));
      notifier(actif ? 'Ajouté aux favoris (démonstration)' : 'Retiré des favoris (démonstration)', { type: 'info' });
    }
    if (notif) {
      notifier({ succes: 'Modifications enregistrées.', info: 'Vos rappels sont synchronisés.', erreur: 'Une erreur est survenue. Réessayez.' }[notif], { type: notif });
    }
    if (demo === 'modale') {
      ouvrirModale({
        titre: 'Nouvel animal',
        contenu: `<div class="cp-formulaire">${champ({ id: 'm-nom', label: 'Nom', placeholder: 'Ex. : Mimi' })}${selecteur({ id: 'm-esp', label: 'Espèce', options: ESPECES.map((x) => ({ valeur: x.id, texte: x.nom })) })}</div>`,
        pied: `${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-fermer': true } })}${bouton({ texte: 'Enregistrer', attrs: { 'data-fermer': true } })}`,
      });
    }
    if (demo === 'confirmer') {
      const ok = await confirmer({ titre: 'Supprimer cet animal ?', message: 'Ses soins et ses pesées seront aussi supprimés. Cette action est définitive.', libelle: 'Supprimer' });
      notifier(ok ? 'Suppression confirmée (démonstration : rien n\'a été supprimé).' : 'Suppression annulée.', { type: ok ? 'info' : 'info' });
    }
    if (demo === 'confirmer-charge') {
      const ok = await confirmer({ titre: 'Envoyer la sauvegarde ?', message: 'Le bouton passe en chargement pendant l\'opération.', libelle: 'Envoyer', danger: false, action: () => new Promise((r) => setTimeout(r, 1500)) });
      if (ok) notifier('Opération terminée (démonstration).');
    }
  });

  activerOnglets(racine.querySelector('#demo-onglets'));
  activerFiltres(racine.querySelector('#demo-filtres'), (actifs) => {
    racine.querySelector('#demo-filtres-etat').textContent = actifs.length ? actifs.join(', ') : 'aucun';
  });

  // Formulaire complet : validation simple pour montrer l'état d'erreur et le chargement
  const form = racine.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const champNom = form.querySelector('#f-nom');
    const retour = form.querySelector('#f-retour');
    const envoi = form.querySelector('#f-envoi');
    form.querySelector('#f-nom-erreur')?.remove();
    champNom.removeAttribute('aria-invalid');
    champNom.removeAttribute('aria-describedby');
    retour.innerHTML = '';
    if (!champNom.value.trim()) {
      champNom.setAttribute('aria-invalid', 'true');
      champNom.setAttribute('aria-describedby', 'f-nom-erreur');
      champNom.insertAdjacentHTML('afterend', `<p class="cp-champ__erreur" id="f-nom-erreur">${icone('circle-alert', { taille: 16 })}<span>Le nom est obligatoire.</span></p>`);
      champNom.focus();
      return;
    }
    envoi.setAttribute('aria-busy', 'true');
    await new Promise((r) => setTimeout(r, 900));
    envoi.removeAttribute('aria-busy');
    retour.innerHTML = alerte({ type: 'succes', texte: 'Formulaire valide (démonstration : rien n\'est enregistré).' });
  });

  // Adresse #/composants/<section> : ouvre directement une section
  if (segments[0]) {
    requestAnimationFrame(() => document.getElementById(`cp-${segments[0]}`)?.scrollIntoView({ block: 'start' }));
  }
}
