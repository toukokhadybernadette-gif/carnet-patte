// « Conseil du moment » : un conseil par mois, adapté à la saison (page d'accueil).
// Ce fichier est fait pour être RELU et CORRIGÉ à la main : un conseil = un titre, un texte court et prudent, une source.
// Règles de rédaction : jamais de dose, de diagnostic ni de traitement ; on dit quoi surveiller et quand appeler ;
// la phrase « En cas de doute, appelez votre vétérinaire. » est ajoutée à chaque conseil par l'affichage (js/conseils.js > conseilDuMois).
// `source` : l'organisme qui traite du sujet. `verifiee: true` = existence de l'organisme et du sujet contrôlée ;
// les textes ci-dessous sont des synthèses prudentes, pas des citations.

export const PHRASE_VETERINAIRE = 'En cas de doute, appelez votre vétérinaire.';

export const CONSEILS = [
  { mois: 1, icone: 'shield-alert', titre: 'Froid : attention à l\'antigel',
    texte: 'Les produits antigel (liquide de refroidissement) ont un goût sucré qui peut attirer chiens et chats, et ils sont très dangereux s\'ils sont avalés. Rangez-les hors de portée et essuyez toute flaque au garage ou sur le parking. Une ingestion, même suspectée, est une urgence.',
    source: 'Centres antipoison vétérinaires (CNITV, CAPAE-Ouest)', verifiee: true },
  { mois: 2, icone: 'stethoscope', titre: 'Les dents aussi comptent',
    texte: 'Mauvaise haleine, tartre, gencives rouges ou animal qui mange moins volontiers : ces signes méritent d\'être signalés. Profitez de la prochaine visite pour demander un contrôle des dents ; si votre animal semble avoir mal, consultez sans attendre.',
    source: 'WSAVA, lignes directrices sur la santé dentaire (à confirmer)', verifiee: false },
  { mois: 3, icone: 'triangle-alert', titre: 'Chenilles processionnaires',
    texte: 'À la fin de l\'hiver, les chenilles processionnaires du pin descendent des arbres en file. Leurs poils urticants peuvent provoquer de graves lésions (langue, bouche, yeux). Évitez les zones de pins et ne laissez pas votre animal les renifler ou les lécher. En cas de contact : urgence, ne frottez pas, consultez sans attendre.',
    source: 'ANSES (agence sanitaire), fiches sur la chenille processionnaire du pin', verifiee: true },
  { mois: 4, icone: 'bug', titre: 'Tiques et puces reprennent',
    texte: 'Avec les beaux jours, tiques et puces deviennent très actives. Demandez à votre vétérinaire le traitement antiparasitaire adapté à votre animal et regardez son pelage après les promenades en herbes hautes ou en forêt. Une tique fixée, ou un animal abattu, qui mange moins ou a de la fièvre après une promenade : consultez.',
    source: 'ESCCAP France (parasites des animaux de compagnie)', verifiee: true },
  { mois: 5, icone: 'heart', titre: 'Lys et fleurs : prudence avec les chats',
    texte: 'Les lys sont particulièrement dangereux pour les chats : même un peu de pollen léché sur le pelage ou l\'eau du vase peut être grave. Évitez-les dans les bouquets et les jardins fréquentés par un chat. Vomissements ou abattement après contact : consultez rapidement.',
    source: 'Centres antipoison vétérinaires (CNITV, CAPAE-Ouest) ; ASPCA Animal Poison Control (à confirmer)', verifiee: false },
  { mois: 6, icone: 'search', titre: 'Épillets : un danger discret',
    texte: 'Les épillets (graines de graminées sèches) peuvent se glisser dans les oreilles, entre les doigts, sous les paupières ou dans le nez. Après chaque balade en herbes sèches, vérifiez ces endroits. Secouements de tête répétés, éternuements violents ou léchage insistant d\'une patte : consultez.',
    source: 'Pratique vétérinaire courante (pas de source unique à citer ; à confirmer)', verifiee: false },
  { mois: 7, icone: 'shield-alert', titre: 'Chaleur : eau, ombre et jamais en voiture',
    texte: 'Ne laissez jamais un animal dans une voiture, même vitres entrouvertes et même peu de temps. Proposez de l\'eau fraîche en permanence, de l\'ombre, et promenez-vous tôt le matin ou tard le soir. Halètement intense, bave épaisse, faiblesse ou malaise : c\'est une urgence, mettez l\'animal au frais et appelez sans attendre.',
    source: 'Recommandations de prévention canicule des autorités sanitaires et des vétérinaires (à confirmer)', verifiee: false },
  { mois: 8, icone: 'fish', titre: 'Baignade : méfiance avec les eaux stagnantes',
    texte: 'Dans les eaux calmes et chaudes, des algues microscopiques (cyanobactéries) peuvent rendre l\'eau dangereuse à boire ou à lécher. Si un panneau d\'interdiction est affiché, ou si l\'eau est verdâtre, ne laissez pas votre animal s\'y baigner. Rincez-le après la baignade et consultez s\'il vomit ou est abattu.',
    source: 'ANSES, fiches sur les cyanobactéries (à confirmer)', verifiee: false },
  { mois: 9, icone: 'triangle-alert', titre: 'Vendanges : raisins interdits',
    texte: 'Raisins frais et raisins secs peuvent être dangereux pour les chiens, même en petite quantité. Ne les laissez pas traîner (vignes, gâteaux, mélanges de fruits secs). Si votre chien en a mangé, appelez sans attendre : ne cherchez pas à attendre l\'apparition de signes.',
    source: 'Centres antipoison vétérinaires (CNITV, CAPAE-Ouest) ; ASPCA (à confirmer)', verifiee: false },
  { mois: 10, icone: 'trees', titre: 'Champignons en forêt',
    texte: 'À l\'automne, certains champignons sauvages sont toxiques pour les chiens. Gardez votre chien près de vous en forêt et empêchez-le d\'en manger. Si vous pensez qu\'il en a mangé, gardez un échantillon du champignon et appelez immédiatement.',
    source: 'Centres antipoison vétérinaires (CNITV, CAPAE-Ouest)', verifiee: true },
  { mois: 11, icone: 'calendar', titre: 'Avant l\'hiver : le point sur le carnet',
    texte: 'C\'est le bon moment pour vérifier dans le carnet les vaccins et traitements antiparasitaires à renouveler. Les dates de rappel de l\'appli sont là pour ça : notez la date du prochain soin lors de la visite.',
    source: 'Conseil d\'usage de l\'appli, à valider avec votre vétérinaire', verifiee: false },
  { mois: 12, icone: 'shield-alert', titre: 'Fêtes : chocolat et plantes d\'hiver',
    texte: 'Le chocolat (surtout noir) est toxique pour les chiens et les chats : gardez bonbons, papillotes et boîtes hors de portée, y compris sous le sapin. Houx, gui et poinsettia peuvent aussi poser problème. Si votre animal en a avalé, appelez sans attendre, en précisant ce qu\'il a mangé et en quelle quantité approximative.',
    source: 'Centres antipoison vétérinaires (CNITV, CAPAE-Ouest)', verifiee: true },
];

/** Le conseil du mois de `date` (par défaut : aujourd'hui). */
export function conseilDuMois(date = new Date()) {
  return CONSEILS.find((c) => c.mois === date.getMonth() + 1) ?? CONSEILS[0];
}
