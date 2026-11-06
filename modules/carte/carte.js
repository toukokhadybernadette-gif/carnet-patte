// Carte Patte : page de présentation (module pas encore développé).
import { rendrePresentation } from '../../js/presentation.js';

export function rendre(zone) {
  rendrePresentation(zone, {
    icone: 'map-pin',
    titre: 'Carte Patte',
    intro: 'Une carte pour retrouver facilement les lieux utiles à vos animaux, près de chez vous.',
    fonctions: [
      { icone: 'stethoscope', titre: 'Vétérinaires', texte: 'Trouver un cabinet vétérinaire à proximité.' },
      { icone: 'store', titre: 'Animaleries', texte: 'Repérer les animaleries autour de vous.' },
      { icone: 'trees', titre: 'Parcs et plages', texte: 'Savoir où les animaux sont acceptés.' },
      { icone: 'scissors', titre: 'Toilettage', texte: 'Chercher un salon de toilettage.' },
      { icone: 'house-heart', titre: 'Pensions', texte: 'Comparer des solutions de garde pour les vacances.' },
      { icone: 'calendar', titre: 'Événements', texte: 'Découvrir les rendez-vous organisés près de chez vous.' },
    ],
  });
}
