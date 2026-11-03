// Espace professionnel : page de présentation (module pas encore développé).
import { rendrePresentation } from '../../js/presentation.js';

export function rendre(zone) {
  rendrePresentation(zone, {
    icone: 'briefcase-business',
    titre: 'Professionnels',
    intro: 'Des outils pour les éleveurs, vendeurs et professionnels du secteur animalier. Ils demanderont un compte, qui n\'est pas encore disponible.',
    fonctions: [
      { icone: 'layout-dashboard', titre: 'Tableau de bord', texte: 'Vue d\'ensemble de votre activité.' },
      { icone: 'users', titre: 'Clients', texte: 'Suivre vos clients et leurs animaux.' },
      { icone: 'paw-print', titre: 'Animaux', texte: 'Gérer les animaux dont vous avez la charge.' },
      { icone: 'calendar', titre: 'Rendez-vous', texte: 'Organiser votre agenda.' },
      { icone: 'wheat', titre: 'Élevage', texte: 'Suivre vos portées, groupes et lots.' },
      { icone: 'trending-up', titre: 'Statistiques', texte: 'Mesurer l\'évolution de votre activité.' },
    ],
  });
}
