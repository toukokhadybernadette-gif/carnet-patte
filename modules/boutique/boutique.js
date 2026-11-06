// Boutique : page de présentation (module pas encore développé).
import { rendrePresentation } from '../../js/presentation.js';

export function rendre(zone) {
  rendrePresentation(zone, {
    icone: 'shopping-bag',
    titre: 'Boutique',
    intro: 'Une place de marché pour trouver ce dont vos animaux ont besoin. Elle demandera un compte, qui n\'est pas encore disponible.',
    fonctions: [
      { icone: 'search', titre: 'Recherche et catégories', texte: 'Retrouver un produit par mot-clé ou par rayon.' },
      { icone: 'shopping-bag', titre: 'Produits', texte: 'Des fiches claires avec photos, prix et description.' },
      { icone: 'store', titre: 'Boutiques', texte: 'Découvrir les boutiques de particuliers et de professionnels.' },
      { icone: 'heart', titre: 'Favoris', texte: 'Garder de côté les produits qui vous plaisent.' },
      { icone: 'shopping-cart', titre: 'Panier', texte: 'Regrouper vos achats avant de commander.' },
    ],
  });
}
