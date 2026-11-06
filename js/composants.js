// Composants réutilisables de Carnet Patte (étape 3 de la refonte).
// Les styles sont dans css/composants.css (classes « cp-… ») et n'utilisent que css/tokens.css.
// Les icônes viennent de js/icons.js.
//
// Deux familles de fonctions :
//   - des constructeurs qui renvoient du HTML : bouton(), badge(), champ(), carteAnimal()…
//   - des comportements : notifier(), ouvrirModale(), confirmer(), activerOnglets(), activerFiltres()
//
// Les modules existants n'utilisent pas encore ce fichier : ils migreront un par un dans les prochaines étapes.

import { echapper } from './utils.js';
import { icone } from './icons.js';

/** Transforme { a: 'x', b: true, c: false } en ' a="x" b'. Les valeurs sont échappées. */
function attributs(objet = {}) {
  return Object.entries(objet)
    .filter(([, v]) => v !== false && v != null)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${echapper(String(v))}"`))
    .join('');
}

// =========================================================
// Constructeurs HTML
// =========================================================

/**
 * Bouton. variante : principal | secondaire | discret | danger.
 * Un bouton « icône seule » (seul: true) exige un `titre` : c'est son nom pour les lecteurs d'écran.
 * `href` le transforme en lien. `chargement` affiche une roue et bloque le clic.
 */
export function bouton({ texte = '', variante = 'principal', icone: nomIcone, taille, seul = false, desactive = false,
  chargement = false, type = 'button', bloc = false, titre, href, attrs = {} } = {}) {
  const classes = ['cp-btn', `cp-btn--${variante}`, taille === 's' && 'cp-btn--s', seul && 'cp-btn--icone', bloc && 'cp-btn--bloc']
    .filter(Boolean).join(' ');
  const pictogramme = nomIcone ? icone(nomIcone, { taille: taille === 's' ? 16 : 18 }) : '';
  const contenu = seul ? pictogramme : `${pictogramme}${texte ? `<span>${echapper(texte)}</span>` : ''}`;
  const commun = { class: classes, 'aria-label': seul ? titre : false, 'aria-busy': chargement ? 'true' : false, ...attrs };
  if (href) {
    return `<a${attributs({ ...commun, href, 'aria-disabled': desactive ? 'true' : false })}>${contenu}</a>`;
  }
  return `<button${attributs({ ...commun, type, disabled: desactive })}>${contenu}</button>`;
}

/** Badge de statut. variante : defaut | succes | info | attention | alerte | premium | neutre | bientot. */
export function badge({ texte, variante = 'defaut', icone: nomIcone } = {}) {
  const classe = variante === 'defaut' ? 'cp-badge' : `cp-badge cp-badge--${variante}`;
  return `<span class="${classe}">${nomIcone ? icone(nomIcone, { taille: 14 }) : ''}${echapper(texte)}</span>`;
}

/** Point de statut + texte. variante : defaut | ok | attention | alerte. */
export function statut({ texte, variante = 'defaut' } = {}) {
  return `<span class="cp-statut${variante === 'defaut' ? '' : ` cp-statut--${variante}`}">${echapper(texte)}</span>`;
}

/** Pastille de compteur. Le texte caché précise le sens pour les lecteurs d'écran. */
export function compteur(nombre, libelle = '') {
  return `<span class="cp-compteur">${nombre}${libelle ? `<span class="cp-sr"> ${echapper(libelle)}</span>` : ''}</span>`;
}

/**
 * Champ de formulaire complet : étiquette, champ, aide et message d'erreur reliés pour les lecteurs d'écran.
 * type : text | email | search | password | number | date | textarea.
 */
export function champ({ id, label, type = 'text', valeur = '', placeholder = '', aide = '', erreur = '', icone: nomIcone,
  desactive = false, chargement = false, requis = false, attrs = {} }) {
  const decrit = [aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ');
  const commun = {
    id, name: id, class: type === 'textarea' ? 'cp-textarea' : 'cp-input', placeholder, disabled: desactive, required: requis,
    'aria-invalid': erreur ? 'true' : false, 'aria-describedby': decrit || false, ...attrs,
  };
  const controle = type === 'textarea'
    ? `<textarea${attributs(commun)}>${echapper(valeur)}</textarea>`
    : `<input${attributs({ ...commun, type, value: valeur })}>`;
  const zone = nomIcone ? `<div class="cp-champ__zone">${icone(nomIcone, { taille: 20 })}${controle}</div>` : controle;
  return `
    <div class="cp-champ"${chargement ? ' aria-busy="true"' : ''}>
      <label class="cp-champ__label" for="${echapper(id)}">${echapper(label)}${requis ? ' <span aria-hidden="true">*</span>' : ''}</label>
      ${zone}
      ${aide ? `<p class="cp-champ__aide" id="${echapper(id)}-aide">${echapper(aide)}</p>` : ''}
      ${erreur ? `<p class="cp-champ__erreur" id="${echapper(id)}-erreur">${icone('circle-alert', { taille: 16 })}<span>${echapper(erreur)}</span></p>` : ''}
    </div>`;
}

/** Liste déroulante. options : [{ valeur, texte }] */
export function selecteur({ id, label, options = [], valeur = '', aide = '', erreur = '', desactive = false }) {
  const decrit = [aide && `${id}-aide`, erreur && `${id}-erreur`].filter(Boolean).join(' ');
  const liste = options.map((o) => `<option value="${echapper(o.valeur)}"${o.valeur === valeur ? ' selected' : ''}>${echapper(o.texte)}</option>`).join('');
  return `
    <div class="cp-champ">
      <label class="cp-champ__label" for="${echapper(id)}">${echapper(label)}</label>
      <select${attributs({ id, name: id, class: 'cp-select', disabled: desactive, 'aria-invalid': erreur ? 'true' : false, 'aria-describedby': decrit || false })}>${liste}</select>
      ${aide ? `<p class="cp-champ__aide" id="${echapper(id)}-aide">${echapper(aide)}</p>` : ''}
      ${erreur ? `<p class="cp-champ__erreur" id="${echapper(id)}-erreur">${icone('circle-alert', { taille: 16 })}<span>${echapper(erreur)}</span></p>` : ''}
    </div>`;
}

export function caseACocher({ id, label, coche = false, desactive = false, type = 'checkbox', nom }) {
  return `<label class="cp-case"><input${attributs({ type, id, name: nom || id, checked: coche, disabled: desactive })}><span>${echapper(label)}</span></label>`;
}

/** Interrupteur (activé / désactivé). Utilise role="switch". */
export function interrupteur({ id, label, actif = false, desactive = false }) {
  return `<label class="cp-interrupteur"><span>${echapper(label)}</span>
    <input${attributs({ type: 'checkbox', role: 'switch', id, name: id, checked: actif, disabled: desactive })}><span class="cp-interrupteur__piste" aria-hidden="true"></span></label>`;
}

/** Groupe de choix en pastilles (boutons radio). options : [{ valeur, texte, icone?, classe? }]. `classe` : variante (ex. cp-choix--especes). */
export function choix({ nom, legende, options = [], valeur = '', desactive = false, classe = '' }) {
  const items = options.map((o) => `
    <label class="cp-choix__option${o.classe ? ` ${o.classe}` : ''}"><input${attributs({ type: 'radio', name: nom, value: o.valeur, checked: o.valeur === valeur, disabled: desactive })}>
      <span>${o.icone ? icone(o.icone, { taille: 18 }) : ''}${echapper(o.texte)}</span></label>`).join('');
  return `<fieldset class="cp-choix${classe ? ` ${classe}` : ''}"><legend>${echapper(legende)}</legend>${items}</fieldset>`;
}

/** Les 8 couleurs proposées pour un animal (jetons --cp-an-… dans css/tokens.css). `id` est enregistré dans l'animal (champ facultatif `couleur`). */
export const PALETTE_ANIMAUX = [
  { id: 'ardoise', nom: 'Bleu ardoise' }, { id: 'turquoise', nom: 'Turquoise' }, { id: 'indigo', nom: 'Indigo' }, { id: 'magenta', nom: 'Magenta' },
  { id: 'brun', nom: 'Brun' }, { id: 'rose', nom: 'Rose poudré' }, { id: 'olive', nom: 'Olive' }, { id: 'gris', nom: 'Gris-bleu' },
];

/** Numéro de couleur (1 à 8) d'un identifiant : stable d'une visite à l'autre, différent d'un animal à l'autre. */
export const couleurAvatar = (id = '') => 1 + [...String(id)].reduce((somme, c) => (somme * 31 + c.charCodeAt(0)) % 8, 0);

/** Couleur choisie pour l'animal si elle est valide, sinon couleur automatique d'après son identifiant. Retourne l'`id` de PALETTE_ANIMAUX. */
export function couleurAnimal(animal) {
  const choisie = PALETTE_ANIMAUX.find((c) => c.id === animal?.couleur);
  return (choisie ?? PALETTE_ANIMAUX[couleurAvatar(animal?.id ?? animal?.nom ?? '') - 1]).id;
}

/** « Moka » → « MO », « Jean Pierre » → « JP » */
export function initiales(nom = '') {
  const mots = String(nom).trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '';
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : mots[0].slice(0, 2)).toUpperCase();
}

/**
 * Avatar rond : la photo si elle existe ; sinon les initiales sur une couleur propre à l'animal (`nom` et `id`) ;
 * sinon, sans nom, une icône. `taille` : petit | normal | grand.
 */
export function avatar({ icone: nomIcone = 'paw-print', photo = '', grand = false, petit = false, nom = '', id = '', couleur = '' } = {}) {
  const taille = grand ? ' cp-avatar--grand' : petit ? ' cp-avatar--petit' : '';
  const teinte = ` cp-an-${PALETTE_ANIMAUX.some((c) => c.id === couleur) ? couleur : PALETTE_ANIMAUX[couleurAvatar(id || nom) - 1].id}`;
  if (photo) return `<span class="cp-avatar${teinte}${taille}" aria-hidden="true"><img src="${echapper(photo)}" alt=""></span>`;
  if (nom) return `<span class="cp-avatar${teinte}${taille}" aria-hidden="true">${echapper(initiales(nom))}</span>`;
  return `<span class="cp-avatar${taille}" aria-hidden="true">${icone(nomIcone, { taille: grand ? 32 : 20 })}</span>`;
}

/** Carte d'animal. `href` la rend cliquable. badges : texte HTML déjà construit avec badge(). */
export function carteAnimal({ nom, espece, details = '', icone: nomIcone, photo, badges = '', href, selectionnee = false, id = '', couleur = '' }) {
  const corps = `
    ${avatar({ icone: nomIcone, photo, nom, id, couleur })}
    <div class="cp-carte-animal__texte">
      <span class="cp-carte-animal__nom">${echapper(nom)}</span>
      <span class="cp-carte-animal__meta">${echapper([espece, details].filter(Boolean).join(' · '))}</span>
      ${badges ? `<div class="cp-carte-animal__badges">${badges}</div>` : ''}
    </div>`;
  const classes = `cp-carte cp-carte-animal${selectionnee ? ' cp-carte--selectionnee' : ''}`;
  return href ? `<a class="${classes}" href="${echapper(href)}">${corps}</a>` : `<div class="${classes}">${corps}</div>`;
}

/** Carte de statistique. variation : { texte, sens: 'hausse' | 'baisse' } (facultatif). detail : ligne de précision sous la valeur (facultatif). */
export function carteStat({ libelle, valeur, icone: nomIcone = 'paw-print', variation, detail = '' }) {
  const v = variation
    ? `<span class="cp-stat__variation${variation.sens === 'baisse' ? ' cp-stat__variation--baisse' : ''}">${icone(variation.sens === 'baisse' ? 'trending-down' : 'trending-up', { taille: 16 })}${echapper(variation.texte)}</span>`
    : '';
  return `
    <div class="cp-carte cp-stat">
      <div class="cp-stat__tete"><span>${echapper(libelle)}</span><span class="cp-stat__icone">${icone(nomIcone, { taille: 20 })}</span></div>
      <span class="cp-stat__valeur">${echapper(String(valeur))}</span>
      ${detail ? `<span class="cp-stat__detail">${echapper(detail)}</span>` : ''}
      ${v}
    </div>`;
}

/** Carte de produit : mise en forme seulement. L'image est un emplacement tant qu'il n'y a pas de vraie photo. */
export function carteProduit({ nom, vendeur = '', prix = '', etiquette = '', image = '' }) {
  const visuel = image ? `<img src="${echapper(image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : icone('image', { taille: 48 });
  return `
    <article class="cp-carte cp-produit">
      <div class="cp-produit__image">
        ${visuel}
        ${etiquette ? badge({ texte: etiquette, variante: 'neutre' }) : ''}
        <span class="cp-produit__favori">${bouton({ variante: 'secondaire', seul: true, taille: 's', icone: 'heart', titre: `Ajouter ${nom} aux favoris`, attrs: { 'aria-pressed': 'false', 'data-favori': true } })}</span>
      </div>
      <div class="cp-produit__corps">
        ${vendeur ? `<span class="cp-produit__vendeur">${echapper(vendeur)}</span>` : ''}
        <h3 class="cp-produit__nom">${echapper(nom)}</h3>
        <span class="cp-produit__prix">${echapper(prix)}</span>
      </div>
    </article>`;
}

/** Message en ligne. type : succes | info | attention | erreur. Les erreurs sont annoncées tout de suite (role="alert"). */
export function alerte({ type = 'info', titre = '', texte }) {
  const nomIcone = { succes: 'circle-check', info: 'info', attention: 'triangle-alert', erreur: 'circle-alert' }[type];
  return `
    <div class="cp-alerte cp-alerte--${type}" role="${type === 'erreur' ? 'alert' : 'status'}">
      ${icone(nomIcone, { taille: 20 })}
      <div class="cp-alerte__texte">${titre ? `<strong class="cp-alerte__titre">${echapper(titre)}</strong>` : ''}${echapper(texte)}</div>
    </div>`;
}

/** État vide : icône, titre, texte et éventuellement un bouton (HTML déjà construit avec bouton()). `niveau` : niveau du titre (h2, h3…). */
export function vide({ icone: nomIcone = 'paw-print', titre, texte = '', action = '', niveau = 3 }) {
  return `
    <div class="cp-vide">
      <span class="cp-vide__icone">${icone(nomIcone, { taille: 32 })}</span>
      <h${niveau} class="cp-vide__titre">${echapper(titre)}</h${niveau}>
      ${texte ? `<p>${echapper(texte)}</p>` : ''}
      ${action}
    </div>`;
}

/** Bloc grisé qui brille pendant un chargement. Les dimensions se règlent en CSS (largeur, hauteur). */
export function squelette({ largeur = '100%', hauteur = '14px', rond = false } = {}) {
  return `<span class="cp-squelette${rond ? ' cp-squelette--rond' : ''}" style="width:${largeur};height:${hauteur}" aria-hidden="true"></span>`;
}

// =========================================================
// Comportements
// =========================================================

let zoneNotifs = null;

/**
 * Notification éphémère. type : succes | info | erreur.
 * Les messages sont annoncés par les lecteurs d'écran ; l'utilisateur peut les fermer.
 * Les erreurs restent plus longtemps (8 s au lieu de 4 s).
 */
export function notifier(message, { type = 'succes', duree } = {}) {
  if (!zoneNotifs || !zoneNotifs.isConnected) {
    zoneNotifs = document.createElement('div');
    zoneNotifs.className = 'cp cp-notifs';
    document.body.append(zoneNotifs);
  }
  const nomIcone = { succes: 'circle-check', info: 'info', erreur: 'circle-alert' }[type] ?? 'info';
  const el = document.createElement('div');
  el.className = `cp-notif cp-notif--${type}`;
  el.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
  el.innerHTML = `${icone(nomIcone, { taille: 20 })}<span class="cp-notif__texte">${echapper(message)}</span>
    <button type="button" class="cp-notif__fermer" aria-label="Fermer la notification">${icone('x', { taille: 16 })}</button>`;
  // Si une fenêtre modale est ouverte, elle masque le reste de la page : la notification doit s'afficher dans elle
  const modaleOuverte = [...document.querySelectorAll('dialog[open]')].pop();
  const parent = modaleOuverte ?? document.body;
  if (zoneNotifs.parentElement !== parent) {
    parent.append(zoneNotifs);
    if (modaleOuverte) modaleOuverte.addEventListener('close', () => { if (zoneNotifs.parentElement === modaleOuverte) document.body.append(zoneNotifs); }, { once: true });
  }
  zoneNotifs.append(el);
  const fermer = () => el.remove();
  el.querySelector('button').addEventListener('click', fermer);
  setTimeout(fermer, duree ?? (type === 'erreur' ? 8000 : 4000));
  return el;
}

/**
 * Fenêtre modale accessible (élément <dialog> natif : le focus reste dans la fenêtre,
 * Échap la ferme, et le focus revient au bouton qui l'a ouverte).
 * `ouvert(dialog)` est appelé une fois la fenêtre affichée, pour brancher les boutons.
 */
export function ouvrirModale({ titre, contenu = '', pied = '', ouvert, icone: iconeHtml = '' } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = 'cp-modale';
  const idTitre = `cp-modale-titre-${Math.random().toString(36).slice(2, 8)}`;
  dlg.setAttribute('aria-labelledby', idTitre);
  dlg.innerHTML = `
    <div class="cp-modale__tete">
      <h2 class="cp-modale__titre" id="${idTitre}">${echapper(titre)}</h2>
      ${bouton({ variante: 'discret', seul: true, taille: 's', icone: 'x', titre: 'Fermer', attrs: { 'data-fermer': true } })}
    </div>
    <div class="cp-modale__corps">${iconeHtml}${contenu}</div>
    ${pied ? `<div class="cp-modale__pied">${pied}</div>` : ''}`;
  document.body.append(dlg);
  dlg.querySelectorAll('[data-fermer]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
  if (ouvert) ouvert(dlg);
  // Focus : sur écran tactile on ne fait rien (le clavier virtuel ne doit pas s'ouvrir tout seul) ;
  // sinon le premier champ du formulaire, plutôt que la croix de fermeture choisie par défaut par le navigateur.
  if (!dlg.contains(dlg.querySelector('[autofocus]')) && !matchMedia('(pointer: coarse)').matches) {
    dlg.querySelector('.cp-modale__corps :is(input:not([type=hidden],[type=file]), select, textarea)')?.focus();
  }
  return dlg;
}

/**
 * Fenêtre de confirmation. Retourne une promesse : true si l'utilisateur confirme.
 * `action` (facultatif) est une fonction asynchrone exécutée à la confirmation :
 * le bouton passe alors en chargement jusqu'à la fin, puis la fenêtre se ferme.
 */
export function confirmer({ titre, message, libelle = 'Confirmer', danger = true, action } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const dlg = ouvrirModale({
      titre,
      icone: danger ? `<span class="cp-modale__icone">${icone('triangle-alert', { taille: 24 })}</span>` : '',
      contenu: `<p>${echapper(message)}</p>`,
      pied: `${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-non': true } })}
             ${bouton({ texte: libelle, variante: danger ? 'danger' : 'principal', attrs: { 'data-oui': true } })}`,
      ouvert: (d) => {
        d.querySelector('[data-non]').addEventListener('click', () => d.close());
        d.querySelector('[data-non]').focus(); // le choix sans danger est sélectionné d'office
        d.querySelector('[data-oui]').addEventListener('click', async (e) => {
          const b = e.currentTarget;
          if (b.getAttribute('aria-busy') === 'true') return; // déjà en cours : on ignore le deuxième clic
          if (action) {
            b.setAttribute('aria-busy', 'true');
            d.querySelector('[data-non]').disabled = true;
            try { await action(); } finally { b.removeAttribute('aria-busy'); }
          }
          ok = true;
          d.close();
        });
      },
    });
    dlg.addEventListener('close', () => resolve(ok));
  });
}

/**
 * Onglets accessibles. Structure attendue dans `racine` :
 *   [role=tablist] > [role=tab][aria-controls=idPanneau]   et   [role=tabpanel][id=idPanneau]
 * Flèches gauche/droite, Début et Fin changent d'onglet ; seul l'onglet actif est dans l'ordre de tabulation.
 */
export function activerOnglets(racine) {
  const onglets = [...racine.querySelectorAll('[role="tab"]')];
  // Trait sous l'onglet actif : il glisse d'un onglet à l'autre (décor, caché aux lecteurs d'écran)
  const bande = racine.querySelector('[role="tablist"]');
  const trait = document.createElement('span');
  trait.className = 'cp-onglets__trait';
  trait.setAttribute('aria-hidden', 'true');
  bande.append(trait);
  let courant = null;
  const placer = (o) => {
    trait.style.setProperty('--x', `${o.offsetLeft}px`);
    trait.style.setProperty('--l', `${o.offsetWidth}px`);
  };
  new ResizeObserver(() => { if (courant) placer(courant); }).observe(bande); // la largeur change (téléphone, rotation…)

  const activer = (cible, donnerFocus = false, animer = false) => {
    courant = cible;
    onglets.forEach((o) => {
      const actif = o === cible;
      o.setAttribute('aria-selected', String(actif));
      o.tabIndex = actif ? 0 : -1;
      const panneau = racine.querySelector(`#${o.getAttribute('aria-controls')}`);
      if (panneau) {
        panneau.hidden = !actif;
        // le panneau apparaît en fondu quand l'utilisateur change d'onglet (pas au premier affichage de la page)
        if (actif && animer) {
          panneau.classList.remove('cp-entree');
          void panneau.offsetWidth; // relance l'animation si on revient sur le même onglet
          panneau.classList.add('cp-entree');
          panneau.addEventListener('animationend', () => panneau.classList.remove('cp-entree'), { once: true });
        }
      }
    });
    placer(cible);
    if (donnerFocus) cible.focus();
  };
  onglets.forEach((o, i) => {
    o.addEventListener('click', () => activer(o, false, true));
    o.addEventListener('keydown', (e) => {
      const actifs = onglets.filter((x) => !x.disabled);
      const pos = actifs.indexOf(o);
      let suivant = null;
      if (e.key === 'ArrowRight') suivant = actifs[(pos + 1) % actifs.length];
      else if (e.key === 'ArrowLeft') suivant = actifs[(pos - 1 + actifs.length) % actifs.length];
      else if (e.key === 'Home') suivant = actifs[0];
      else if (e.key === 'End') suivant = actifs[actifs.length - 1];
      if (suivant) { e.preventDefault(); activer(suivant, true, true); }
    });
  });
  activer(onglets.find((o) => o.getAttribute('aria-selected') === 'true') ?? onglets[0]);
  requestAnimationFrame(() => trait.classList.add('is-pret')); // pas de glissement au tout premier placement
}

/** Boutons-filtres à bascule : chaque clic inverse aria-pressed. `quandChange(valeursActives)` est facultatif. */
export function activerFiltres(racine, quandChange) {
  racine.addEventListener('click', (e) => {
    const f = e.target.closest('.cp-filtre[aria-pressed]');
    if (!f || f.disabled) return;
    f.setAttribute('aria-pressed', String(f.getAttribute('aria-pressed') !== 'true'));
    if (quandChange) quandChange([...racine.querySelectorAll('.cp-filtre[aria-pressed="true"]')].map((x) => x.dataset.valeur));
  });
}
