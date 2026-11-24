// Le branchement commun des Edge Functions : construit Stripe et Supabase à partir des SECRETS de la fonction, et répond « erreur serveur » (sans détail) si quelque chose casse.
// Les secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, SITE_URLS, COMPTES_TEST, PAIEMENT_OUVERT) se règlent dans Supabase → Edge Functions → Secrets (voir ABONNEMENT.md).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.

import { clientStripe } from './stripe.js';
import { creerAuth, creerDb } from './supabase.js';

/** `gerer(req, ctx)` : l'une des fonctions de traitement.js. Retourne le gestionnaire à donner à Deno.serve. */
export function servir(gerer) {
  return async (req) => {
    try {
      const env = Deno.env.toObject();
      const url = env.SUPABASE_URL;
      const cleService = env.SUPABASE_SERVICE_ROLE_KEY;
      return await gerer(req, { env, stripe: clientStripe({ cle: env.STRIPE_SECRET_KEY }), db: creerDb({ url, cleService }), auth: creerAuth({ url, cleService }) });
    } catch (e) {
      console.error('erreur', e?.message ?? e); // le message d'une erreur ne contient jamais de clé ; on n'affiche rien d'autre
      return new Response(JSON.stringify({ erreur: 'serveur' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  };
}
