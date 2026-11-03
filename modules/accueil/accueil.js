// Accueil : bienvenue, résumé des animaux, raccourcis, rappels et activité récente.
// Cette page LIT les données (animaux, soins, pesées) mais ne les modifie jamais.

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { echapper, aujourdhui, formatDate, formatPoids } from '../../js/utils.js';
import { badge, carteStat, carteAnimal, vide, bouton } from '../../js/composants.js';
import { calculerRappels } from '../animaux/rappels.js';
import { infosEspece, nomEspece, infosType } from '../animaux/commun.js';

const VARIANTE_RAPPEL = { retard: 'alerte', semaine: 'attention', 'plus-tard': 'succes' };

function ligne({ icone: i, titre, meta, fin = '', href }) {
  const corps = `
    <span class="cp-liste__icone">${icone(i, { taille: 20 })}</span>
    <div class="cp-liste__corps"><span class="cp-liste__titre">${echapper(titre)}</span><span class="cp-liste__meta">${echapper(meta)}</span></div>
    ${fin ? `<div class="cp-liste__fin">${fin}</div>` : ''}`;
  return href
    ? `<li><a class="cp-liste__ligne cp-liste__ligne--lien" href="${href}">${corps}</a></li>`
    : `<li class="cp-liste__ligne">${corps}</li>`;
}

const tuile = ({ icone: i, titre, texte, href, bientot }) => `
  <a class="cp-carte pg-tuile" href="${href}">
    <span class="pg-tuile__icone">${icone(i, { taille: 22 })}</span>
    <span class="pg-tuile__titre">${echapper(titre)}</span>
    ${bientot ? badge({ texte: 'Bientôt', variante: 'bientot' }) : `<p class="pg-tuile__texte">${echapper(texte)}</p>`}
  </a>`;

export function rendre(zone) {
  zone.classList.add('page-large');

  const animaux = storage.lister('animaux');
  const parId = new Map(animaux.map((a) => [a.id, a]));
  const rappels = calculerRappels();
  const enRetard = rappels.filter((r) => r.statut.classe === 'retard');
  const retardParAnimal = new Map();
  enRetard.forEach((r) => retardParAnimal.set(r.animal.id, (retardParAnimal.get(r.animal.id) ?? 0) + 1));
  const prochain = rappels[0];

  // Activité récente : derniers soins et dernières pesées déjà passés
  const auj = aujourdhui();
  const activite = [
    ...storage.lister('soins').filter((s) => s.date && s.date <= auj && parId.has(s.animalId)).map((s) => {
      const type = infosType(s.type);
      return { date: s.date, icone: type.icone, titre: [type.nom, s.titre].filter(Boolean).join(' — '), animal: parId.get(s.animalId) };
    }),
    ...storage.lister('pesees').filter((p) => p.date && p.date <= auj && parId.has(p.animalId)).map((p) => (
      { date: p.date, icone: 'scale', titre: `Pesée : ${formatPoids(p.poidsKg)}`, animal: parId.get(p.animalId) })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const blocAnimaux = animaux.length
    ? `<div class="pg-animaux">${animaux.slice(0, 4).map((a) => carteAnimal({
        nom: a.nom, espece: nomEspece(a), details: a.race, icone: infosEspece(a).icone, photo: a.photo?.startsWith('data:image/') ? a.photo : '',
        href: `#/animaux/${encodeURIComponent(a.id)}`,
        badges: retardParAnimal.has(a.id) ? badge({ texte: `${retardParAnimal.get(a.id)} rappel${retardParAnimal.get(a.id) > 1 ? 's' : ''} en retard`, variante: 'alerte', icone: 'bell-ring' }) : '',
      })).join('')}</div>`
    : `<div class="cp-carte">${vide({ icone: 'paw-print', titre: 'Aucun animal pour l\'instant', texte: 'Ajoutez votre premier compagnon pour suivre sa santé.', action: bouton({ texte: 'Ajouter un animal', icone: 'plus', href: '#/animaux' }) })}</div>`;

  const blocRappels = rappels.length
    ? `<ul class="cp-liste">${rappels.slice(0, 3).map((r) => ligne({
        icone: infosType(r.soin.type).icone,
        titre: [infosType(r.soin.type).nom, r.soin.titre].filter(Boolean).join(' — '),
        meta: `${r.animal.nom} · ${formatDate(r.soin.rappel)}`,
        fin: badge({ texte: r.statut.texte, variante: VARIANTE_RAPPEL[r.statut.classe] }),
        href: '#/animaux/rappels',
      })).join('')}</ul>`
    : `<div class="cp-carte">${vide({ icone: 'circle-check', titre: 'Aucun rappel en attente', texte: 'Ajoutez une date de rappel quand vous notez un soin.' })}</div>`;

  const blocActivite = activite.length
    ? `<ul class="cp-liste">${activite.map((x) => ligne({
        icone: x.icone, titre: x.titre, meta: `${x.animal.nom} · ${formatDate(x.date)}`,
        href: `#/animaux/${encodeURIComponent(x.animal.id)}`,
      })).join('')}</ul>`
    : `<div class="cp-carte">${vide({ icone: 'calendar', titre: 'Pas encore d\'activité', texte: 'Vos derniers soins et pesées apparaîtront ici.' })}</div>`;

  zone.innerHTML = `
    <div class="cp pg">
      <header class="pg-entete">
        <h1>Bonjour</h1>
        <p>Voici un aperçu de vos animaux et de ce qui vous attend.</p>
      </header>

      <section class="pg-section" aria-label="Résumé">
        <div class="pg-stats">
          ${carteStat({ libelle: animaux.length > 1 ? 'Animaux suivis' : 'Animal suivi', valeur: animaux.length, icone: 'paw-print' })}
          ${carteStat({ libelle: 'Rappels en retard', valeur: enRetard.length, icone: 'bell' })}
          ${carteStat({ libelle: prochain ? `Prochain rappel · ${prochain.animal.nom}` : 'Prochain rappel', valeur: prochain ? prochain.statut.texte : 'Aucun', icone: 'calendar' })}
        </div>
      </section>

      <section class="pg-section" aria-labelledby="ac-raccourcis">
        <div class="pg-section__tete"><h2 id="ac-raccourcis">Raccourcis</h2></div>
        <div class="pg-raccourcis">
          ${tuile({ icone: 'paw-print', titre: 'Mes animaux', texte: 'Fiches, soins et pesées', href: '#/animaux' })}
          ${tuile({ icone: 'bell', titre: 'Rappels', texte: enRetard.length ? `${enRetard.length} en retard` : 'Soins à prévoir', href: '#/animaux/rappels' })}
          ${tuile({ icone: 'users', titre: 'Communauté', href: '#/communaute', bientot: true })}
          ${tuile({ icone: 'briefcase-business', titre: 'Professionnels', href: '#/pro', bientot: true })}
          ${tuile({ icone: 'save', titre: 'Sauvegarde', texte: 'Exporter mes données', href: '#/donnees' })}
          ${tuile({ icone: 'compass', titre: 'Autres modules', texte: 'Ce qui arrive bientôt', href: '#/bientot' })}
        </div>
      </section>

      <section class="pg-section" aria-labelledby="ac-animaux">
        <div class="pg-section__tete">
          <h2 id="ac-animaux">Mes animaux</h2>
          ${animaux.length ? `<a class="pg-lien" href="#/animaux">Tout voir ${icone('chevron-right', { taille: 16 })}</a>` : ''}
        </div>
        ${blocAnimaux}
      </section>

      <div class="pg-colonnes">
        <section class="pg-section" aria-labelledby="ac-rappels">
          <div class="pg-section__tete">
            <h2 id="ac-rappels">Rappels</h2>
            ${rappels.length ? `<a class="pg-lien" href="#/animaux/rappels">Tout voir ${icone('chevron-right', { taille: 16 })}</a>` : ''}
          </div>
          ${blocRappels}
        </section>
        <section class="pg-section" aria-labelledby="ac-activite">
          <div class="pg-section__tete"><h2 id="ac-activite">Activité récente</h2></div>
          ${blocActivite}
        </section>
      </div>
    </div>`;
}
