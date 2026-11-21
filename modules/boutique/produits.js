// La sélection Carnet Patte : des accessoires du quotidien, avec un lien vers un site marchand. Carnet Patte ne vend rien.
//
// RÈGLES (testées par tests/test-boutique.mjs) :
//   - AUCUN médicament, antiparasitaire, vermifuge, complément ou autre produit de santé ;
//   - aucun prix écrit (le bouton dit « Voir le prix ») ; ni note, ni avis, ni étoiles ;
//   - chaque `lien` est une page vérifiée du site marchand (en général une catégorie, parfois une fiche produit) ;
//   - `pourquoi` : une phrase de conseil général, jamais une promesse sur une marque.
//
// POUR AJOUTER UN PRODUIT : copier une ligne, changer l'`id` (unique), le nom, la `categorie` (un besoin de BESOINS), les `especes`
//   (des identifiants de modules/toxique/donnees.js : chien, chat, lapin, rongeur, oiseau, poule, cheval), le `pourquoi`, le `marchand` et le `lien`.
// LIENS AFFILIÉS : quand vous aurez un compte d'affiliation, écrivez l'adresse affiliée dans `lienAffilie` : elle sera utilisée à la place de `lien`,
//   et la mention change toute seule (voir mentionCourante) : « Sélection indépendante… » tant qu'aucun lien affilié n'existe, « Liens affiliés… » dès le premier.
// `saison` (facultatif) : 'ete' ou 'hiver' : sur la fiche d'un animal, le produit n'est proposé que dans la bonne saison (la page Boutique les montre toujours).
// `remplace` (facultatif) : les identifiants des fiches « Toxique ? » dont ce produit est une alternative sûre (ex. friandises pour chien pour « chocolat »).

export const MENTION_AFFILIATION = 'Liens affiliés : Carnet Patte peut toucher une petite commission si vous achetez, sans surcoût pour vous. Nos choix restent indépendants.';
export const MENTION_INDEPENDANTE = "Sélection indépendante : Carnet Patte ne touche aucune commission sur ces liens pour l'instant.";

/** Les besoins (rangement « Pour quoi ? »). */
export const BESOINS = [
  { id: 'arrivee', nom: "Arrivée d'un chiot ou d'un chaton", court: 'Arrivée', icone: 'house-heart' },
  { id: 'jouets', nom: 'Jouets', court: 'Jouets', icone: 'heart' },
  { id: 'couchage', nom: 'Couchage et habitat', court: 'Couchage', icone: 'house' },
  { id: 'transport', nom: 'Promenade et transport', court: 'Transport', icone: 'compass' },
  { id: 'gamelles', nom: 'Alimentation et gamelles', court: 'Gamelles', icone: 'utensils' },
  { id: 'hygiene', nom: 'Hygiène et litière', court: 'Hygiène', icone: 'spray-can' },
  { id: 'saison', nom: 'Été et hiver', court: 'Été / hiver', icone: 'leaf' },
];

export const MARCHANDS = ['Animalis', 'Maxi Zoo', 'Zooplus'];

const P = (id, nom, categorie, especes, pourquoi, marchand, lien, extra = {}) => ({ id, nom, categorie, especes, pourquoi, marchand, lien, lienAffilie: '', ...extra });

export const PRODUITS = [
  // ----- Chien -----
  P('chien-chiot', "Kit d'arrivée du chiot", 'arrivee', ['chien'],
    "Gamelles, couchage, collier, jouets de dentition : l'essentiel à avoir prêt avant son arrivée, pour que les premiers jours se passent au calme.",
    'Animalis', 'https://www.animalis.com/chiens/boutique-du-chiot/'),
  P('chien-harnais', 'Harnais de promenade', 'transport', ['chien'],
    "Il répartit la traction sur le torse plutôt que sur le cou : plus confortable pour un chien qui tire ou un chiot qui apprend la laisse.",
    'Animalis', 'https://www.animalis.com/chiens/sellerie/harnais/'),
  P('chien-laisse', 'Laisse et collier réglables', 'transport', ['chien'],
    "Un ensemble réglable suit la croissance du chiot. Le collier doit laisser passer deux doigts sans glisser par-dessus les oreilles.",
    'Zooplus', 'https://www.zooplus.fr/shop/chiens/laisses_colliers_chien'),
  P('chien-caisse', 'Caisse de transport', 'transport', ['chien'],
    "Rigide ou pliante, elle sécurise les trajets en voiture et peut devenir un coin tranquille à la maison si le chien s'y habitue en douceur.",
    'Animalis', 'https://www.animalis.com/chiens/transport/caisses-et-sacs-de-transport/'),
  P('chien-coussin', 'Coussin ou panier confortable', 'couchage', ['chien'],
    "Un chien dort souvent plus de douze heures par jour : un couchage à sa taille, lavable, dans un endroit calme lui fait du bien.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/chien/couchages-pour-chien/coussins-pour-chien/'),
  P('chien-kong', 'Jouet à mâcher en caoutchouc à garnir (Kong Classic)', 'jouets', ['chien'],
    "Il se garnit de friandises ou de pâtée : il occupe le chien longtemps, utile contre l'ennui et pour un chiot qui mordille.",
    'Animalis', 'https://www.animalis.com/kong-jouet-classic-en-caoutchouc-pour-chien-PM600199_M.html'),
  P('chien-jouets', "Balles, cordes et jouets d'extérieur", 'jouets', ['chien'],
    "Rapporter ou tirer à deux renforce le lien et dépense de l'énergie. Choisissez une taille trop grosse pour être avalée.",
    'Animalis', 'https://www.animalis.com/chiens/jouets/'),
  P('chien-gamelles', 'Gamelles et fontaines à eau', 'gamelles', ['chien'],
    "De l'eau fraîche toujours accessible ; une gamelle antidérapante évite qu'elle ne glisse pendant le repas.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/chien/gamelles-abreuvoirs/'),
  P('chien-friandises', "Friandises d'entraînement", 'gamelles', ['chien'],
    "De petites récompenses faites pour le chien, à donner avec modération : elles permettent de récompenser sans risque, à la place du chocolat ou des restes de table.",
    'Zooplus', 'https://www.zooplus.fr/shop/chiens/friandises_chien',
    { remplace: ['chocolat', 'raisin', 'macadamia', 'noix', 'xylitol', 'oignon', 'avocat'] }),
  P('chien-manteau', 'Manteau imperméable', 'saison', ['chien'],
    "Utile pour un chien à poil ras, âgé ou frileux par temps froid et humide. Un chien à poil épais n'en a généralement pas besoin.",
    'Zooplus', 'https://www.zooplus.fr/shop/chiens/manteau_bottes_gilet_sauvetage_lunettes_reflecteur', { saison: 'hiver' }),
  P('chien-chaleur', 'Tapis rafraîchissant', 'saison', ['chien'],
    "Une surface fraîche où se coucher quand il fait chaud. Il ne remplace ni l'ombre ni l'eau, et un chien ne reste jamais enfermé dans une voiture.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/chien/couchages-pour-chien/tapis-rafraichissant-pour-chien/', { saison: 'ete' }),
  P('chien-piscine', 'Piscine pour chien', 'saison', ['chien'],
    "Un petit bassin où se rafraîchir les pattes en été, toujours sous surveillance ; l'eau se renouvelle chaque jour.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/chien/jouet-pour-chien/piscines-pour-chien/', { saison: 'ete' }),

  // ----- Chat -----
  P('chat-chaton', "Kit d'arrivée du chaton", 'arrivee', ['chat'],
    "Litière, gamelles, couchage, jouets : l'essentiel à avoir prêt avant son arrivée, pour qu'il trouve vite ses repères.",
    'Animalis', 'https://www.animalis.com/chats/boutique-du-chaton/'),
  P('chat-arbre', 'Arbre à chat', 'jouets', ['chat'],
    "Grimper, se percher, griffer : il répond à plusieurs besoins naturels du chat, surtout en appartement.",
    'Zooplus', 'https://www.zooplus.fr/shop/chats/arbre_a_chat'),
  P('chat-griffoir', 'Griffoir', 'jouets', ['chat'],
    "Griffer est un comportement naturel (entretien des griffes, marquage) : un griffoir stable, assez haut pour s'étirer, protège le canapé.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/chat/griffoirs/'),
  P('chat-jouets', 'Cannes à pêche, souris et balles', 'jouets', ['chat'],
    "De courtes séances de jeu chaque jour imitent la chasse et dépensent l'énergie d'un chat d'appartement.",
    'Zooplus', 'https://www.zooplus.fr/shop/chats/jouets_chat'),
  P('chat-catnip', "Jouets à l'herbe à chat (catnip)", 'jouets', ['chat'],
    "Beaucoup de chats les adorent : une alternative amusante aux plantes d'intérieur qu'ils auraient envie de grignoter.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/chat/jouetspourchat/jouets-valeriane-catnip/',
    { remplace: ['lys', 'poinsettia', 'aloe', 'dieffenbachia', 'pothos', 'kalanchoe', 'jade', 'tulipe', 'narcisse', 'muguet', 'azalee', 'cyclamen'] }),
  P('chat-panier', 'Panier ou coussin douillet', 'couchage', ['chat'],
    "Un endroit chaud, en hauteur ou abrité, où il se sent en sécurité. Il l'adoptera plus vite posé dans un coin calme.",
    'Animalis', 'https://www.animalis.com/chats/couchage/panier-coussin-chat/'),
  P('chat-caisse', 'Caisse de transport', 'transport', ['chat'],
    "Indispensable pour aller chez le vétérinaire : rigide et fermée, avec une couverture, elle rassure le chat si elle reste à la maison en permanence.",
    'Animalis', 'https://www.animalis.com/chats/paniers-et-transports/cage-transport/'),
  P('chat-harnais', 'Harnais et laisse pour chat', 'transport', ['chat'],
    "Pour sortir en sécurité (jardin, voyage) : un harnais bien ajusté, à habituer progressivement à la maison avant la première sortie.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/chat/transport/harnais-laisses/'),
  P('chat-fontaine', 'Fontaine à eau', 'gamelles', ['chat'],
    "Beaucoup de chats préfèrent l'eau qui bouge : une fontaine peut les inciter à boire davantage.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/chat/gamelle-pour-chat-abreuvoirs/fontaines/'),
  P('chat-friandises', 'Friandises pour chat', 'gamelles', ['chat'],
    "De petites récompenses faites pour le chat, à donner avec modération, à la place des aliments humains qui peuvent le rendre malade.",
    'Zooplus', 'https://www.zooplus.fr/shop/chats/friandises_chat',
    { remplace: ['chocolat', 'raisin', 'oignon', 'macadamia', 'xylitol', 'avocat'] }),
  P('chat-litiere', 'Litière', 'hygiene', ['chat'],
    "Choisissez une litière non parfumée et gardez la même : les chats sont sensibles aux changements d'odeur et de texture.",
    'Zooplus', 'https://www.zooplus.fr/shop/chats/litiere_chat'),
  P('chat-bac', 'Bac à litière', 'hygiene', ['chat'],
    "Un bac plus grand que le chat, nettoyé chaque jour, dans un endroit calme et loin de la gamelle.",
    'Animalis', 'https://www.animalis.com/chats/hygiene-et-soins/caisse-litiere/'),


  // ----- Lapin et rongeurs -----
  P('rongeurs-cage', 'Cage ou clapier spacieux', 'couchage', ['lapin', 'rongeur'],
    "Plus c'est grand, mieux c'est : un lapin doit pouvoir bondir et se dresser, un rongeur creuser et se cacher.",
    'Animalis', 'https://www.animalis.com/rongeurs-co/cages-et-accessoires/cages/'),
  P('rongeurs-enclos', "Enclos ou parc d'exercice", 'couchage', ['lapin', 'rongeur'],
    "Un espace où courir en dehors de la cage, à l'abri des prédateurs et des fuites, fait partie de la vie d'un lapin.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/petisanimaux/maisonettes-petitsanimaux/enclos/'),
  P('rongeurs-gamelles', 'Râtelier à foin, gamelle et biberon', 'gamelles', ['lapin', 'rongeur'],
    "Le foin doit être disponible en permanence : un râtelier le garde propre et au sec, un biberon garde l'eau propre.",
    'Animalis', 'https://www.animalis.com/rongeurs-co/cages-et-accessoires/accessoires-alimentaires/'),
  P('rongeurs-jouets', 'Jouets à ronger et tunnels', 'jouets', ['lapin', 'rongeur'],
    "Les dents des lapins et de beaucoup de rongeurs poussent toute leur vie : du bois à ronger et des cachettes les occupent.",
    'Zooplus', 'https://www.zooplus.fr/shop/rongeurs/jouet_rongeur'),
  P('rongeurs-litiere', 'Litière végétale', 'hygiene', ['lapin', 'rongeur'],
    "Préférez une litière végétale peu poussiéreuse : la poussière fatigue les voies respiratoires des petits animaux.",
    'Animalis', 'https://www.animalis.com/rongeurs-co/hygiene-et-soins/litieres/'),
  P('rongeurs-transport', 'Caisse de transport pour petit animal', 'transport', ['lapin', 'rongeur'],
    "Pour le trajet jusqu'au vétérinaire : une caisse fermée, ventilée, avec un peu de foin, à l'abri du soleil et des courants d'air.",
    'Zooplus', 'https://www.zooplus.fr/shop/rongeurs/cage_transport_rongeurs'),

  // ----- Oiseaux -----
  P('oiseau-cage', 'Cage ou volière', 'couchage', ['oiseau'],
    "Elle doit permettre d'ouvrir les ailes et de faire quelques battements : choisissez-la plus grande que ce que vous pensez nécessaire.",
    'Animalis', 'https://www.animalis.com/oiseaux/cages-et-accessoires/cages/'),
  P('oiseau-jouets', 'Perchoirs et jouets', 'jouets', ['oiseau'],
    "Des perchoirs de diamètres variés et des jouets à déchiqueter occupent des oiseaux qui s'ennuient vite.",
    'Zooplus', 'https://www.zooplus.fr/shop/oiseaux/jouets_oiseaux'),
  P('oiseau-mangeoires', 'Mangeoires et abreuvoirs', 'gamelles', ['oiseau'],
    "Les mangeoires fermées limitent les salissures et les graines éparpillées ; l'eau se change tous les jours.",
    'Animalis', 'https://www.animalis.com/oiseaux/cages-et-accessoires/accessoires-alimentaires/'),
  P('oiseau-fond', 'Sable et fond de cage', 'hygiene', ['oiseau'],
    "Un fond propre se remplace souvent : c'est la première chose à vérifier chaque jour.",
    'Animalis', 'https://www.animalis.com/oiseaux/hygiene-et-soins/sable-et-fond-de-cages/'),

  // ----- Poules -----
  P('poule-poulailler', 'Poulailler et enclos', 'couchage', ['poule'],
    "Il doit protéger des prédateurs la nuit (renard, rapaces) et offrir un perchoir et des pondoirs au sec.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/jardin-etang/poulets-ferme/etable-enclos/'),
  P('poule-mangeoires', 'Mangeoires, abreuvoirs et accessoires', 'gamelles', ['poule'],
    "Surélevés, ils restent propres et évitent que les poules ne grattent la nourriture ; l'eau doit rester fraîche toute l'année.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/jardin-etang/poulets-ferme/accessoires/'),
  P('poule-litiere', 'Litière et paille', 'hygiene', ['poule'],
    "Une litière sèche et changée régulièrement garde le poulailler sain et limite les mauvaises odeurs.",
    'Maxi Zoo', 'https://www.maxizoo.fr/c/jardin-etang/poulets-ferme/litiere-paille/'),
];

/** Le lien à ouvrir : le lien affilié s'il est rempli, sinon le lien normal. */
export const lienFinal = (p) => String(p.lienAffilie ?? '').trim() || p.lien;

/** Vrai dès qu'UN lien affilié est rempli, où que ce soit dans la sélection. */
export const selectionAffiliee = () => PRODUITS.some((p) => String(p.lienAffilie ?? '').trim() !== '');

/**
 * La mention à afficher, automatique : tant qu'aucun `lienAffilie` n'est rempli, « Sélection indépendante… » ;
 * dès qu'un seul l'est, la mention d'affiliation, sur la page Boutique ET dans tous les blocs de liens (règle volontairement prudente : un seul lien affilié suffit).
 */
export const mentionCourante = () => (selectionAffiliee() ? MENTION_AFFILIATION : MENTION_INDEPENDANTE);

/** Le groupe de l'espèce d'un animal (Rongeurs = cochon d'Inde + hamster), comme dans « Toxique ? » : null si aucun produit ne la concerne. */
export function produitsPourEspece(groupeId) {
  return PRODUITS.filter((p) => p.especes.includes(groupeId));
}
