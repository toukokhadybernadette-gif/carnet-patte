// Connexion à Supabase (comptes facultatifs). Voir SUPABASE.md pour créer le projet et trouver ces deux valeurs.
//
// Les DEUX valeurs ci-dessous sont PUBLIQUES par conception : l'adresse du projet et la clé « publishable » (anciennement « anon »).
// Elles ne donnent aucun accès aux données d'un utilisateur : c'est la sécurité côté base (règles RLS) qui protège chaque compte.
// JAMAIS ici : la clé « secret » / « service_role », le mot de passe de la base, la clé secrète Stripe. Un test refuse de publier si l'une d'elles apparaît.
//
// Tant que ces valeurs sont vides, l'appli ne montre aucune fonction de compte et ne contacte jamais Supabase.

export const SUPABASE = {
  url: 'https://tiqtmoyxxqzabgaaiwfa.supabase.co', // projet Carnet Patte, région West EU (Irlande)
  cle: 'sb_publishable_W0z_kMkg1J3TueNECEzEeg_oJQSDUZ1',
};
