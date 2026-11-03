// Communauté : page de présentation (module pas encore développé).
import { rendrePresentation } from '../../js/presentation.js';

export function rendre(zone) {
  rendrePresentation(zone, {
    icone: 'users',
    titre: 'Communauté',
    intro: 'Un espace pour échanger entre passionnés d\'animaux. Il demandera un compte, qui n\'est pas encore disponible.',
    fonctions: [
      { icone: 'message-circle', titre: 'Publications', texte: 'Partager des nouvelles, des photos et des conseils.' },
      { icone: 'users', titre: 'Groupes', texte: 'Rejoindre des groupes par espèce, par race ou par région.' },
      { icone: 'calendar', titre: 'Événements', texte: 'Organiser ou retrouver des rendez-vous.' },
      { icone: 'heart-handshake', titre: 'Rencontres', texte: 'Faire se rencontrer des animaux et leurs maîtres.' },
      { icone: 'shield-check', titre: 'Modération', texte: 'Un espace respectueux, avec des règles claires.' },
    ],
  });
}
