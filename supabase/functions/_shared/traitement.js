// La logique des quatre Edge Functions de l'abonnement Premium (Stripe, mode test d'abord). Chaque fonction reçoit une requête et ce dont elle a besoin
// (`ctx` : env = secrets, stripe, db, auth) : le même code tourne dans Supabase (Deno) et dans les tests (Node), avec de faux Stripe et Supabase.
//
// Principe de sécurité : le passage en Premium ne se fait QUE dans traiterWebhook, après vérification de la signature Stripe, par l'opération SQL
// appliquer_abonnement (réservée au service_role). L'appli ne peut jamais se donner Premium, ni par une requête, ni en contournant l'interface.
// Après un événement, on RELIT l'abonnement chez Stripe : l'ordre d'arrivée des événements n'a plus d'importance, et un événement falsifié ne sert à rien.

import { verifierSignature } from './stripe.js';
import { abonnementActif } from './supabase.js';

/** Le texte demandé avant le paiement (case à cocher) ; il est gardé comme preuve avec la date. Doit rester identique à js/compte.js. */
export const TEXTE_CONSENTEMENT = "Je demande l'accès immédiat au Premium et je reconnais perdre mon droit de rétractation de 14 jours";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reponse = (statut, corps) => new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json', ...CORS } });
const erreur = (statut, code) => reponse(statut, { erreur: code });

// ----- Règles : l'état d'un abonnement Stripe → la formule de l'appli -----

/**
 * { plan, statut, finPeriode, resiliationPrevue, paiementEchoue } d'après l'objet « subscription » de Stripe.
 *  active / trialing : Premium. past_due (paiement échoué, Stripe réessaie) : Premium avec le message « paiement échoué ».
 *  Tout le reste (annulé, impayé, jamais finalisé…) : gratuit. Une résiliation prévue reste Premium jusqu'à la fin de la période payée :
 *  Stripe envoie ensuite « canceled », et la formule repasse à gratuit.
 */
export function etatAbonnement(sub, { echecFacture = false } = {}) {
  const statut = sub?.status ?? 'canceled';
  const actif = statut === 'active' || statut === 'trialing';
  const retard = statut === 'past_due';
  const fin = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null; // l'API récente met la date sur la ligne d'abonnement
  return {
    plan: actif || retard ? 'premium' : 'gratuit',
    statut,
    finPeriode: fin ? new Date(fin * 1000).toISOString() : null,
    resiliationPrevue: (actif || retard) && (Boolean(sub?.cancel_at_period_end) || sub?.cancel_at != null),
    paiementEchoue: retard || (echecFacture && (actif || retard)),
  };
}

// ----- Origine autorisée (pour les adresses de retour de Stripe) -----

const listeEnv = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
function origineAutorisee(req, corps, env) {
  const demandee = String(corps?.origine ?? req.headers.get('origin') ?? '').replace(/\/+$/, '');
  return listeEnv(env.SITE_URLS).map((s) => s.replace(/\/+$/, '')).includes(demandee) ? demandee : null;
}

/** Le paiement est-il ouvert à cette personne ? Pendant les tests : seulement les adresses de COMPTES_TEST ; plus tard : tout le monde (PAIEMENT_OUVERT=oui). */
export function paiementDisponible(env, email) {
  return env.PAIEMENT_OUVERT === 'oui' || listeEnv(env.COMPTES_TEST).map((e) => e.toLowerCase()).includes(String(email ?? '').toLowerCase());
}

async function lireCorps(req) {
  try { return await req.json(); } catch { return {}; }
}

// ----- stripe-checkout : « Passer Premium » -----

export async function gererCheckout(req, ctx) {
  const { env, stripe, db, auth } = ctx;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return erreur(405, 'methode');
  const utilisateur = await auth.utilisateur(req.headers.get('authorization'));
  if (!utilisateur) return erreur(401, 'non_connecte');
  const corps = await lireCorps(req);
  const disponible = paiementDisponible(env, utilisateur.email);
  if (corps.action === 'disponible') return reponse(200, { disponible });
  if (!disponible) return erreur(403, 'non_disponible');
  if (corps.consentement !== true) return erreur(400, 'consentement_requis');
  const origine = origineAutorisee(req, corps, env);
  if (!origine) return erreur(400, 'origine_refusee');
  if (!env.STRIPE_PRICE_ID) return erreur(500, 'configuration');

  const existant = await db.abonnementDe(utilisateur.id);
  if (abonnementActif(existant)) return erreur(409, 'deja_abonne');
  let clientId = existant?.stripe_customer_id;
  if (!clientId) {
    const client = await stripe.appeler('POST', '/v1/customers', { email: utilisateur.email, metadata: { user_id: utilisateur.id } });
    clientId = client.id;
  }
  await db.enregistrerClient({ userId: utilisateur.id, clientId, consentementTexte: TEXTE_CONSENTEMENT, consentementLe: new Date().toISOString() });
  const session = await stripe.appeler('POST', '/v1/checkout/sessions', {
    mode: 'subscription',
    customer: clientId,
    client_reference_id: utilisateur.id,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origine}/?paiement=ok#/compte`,
    cancel_url: `${origine}/?paiement=annule#/compte`,
    locale: 'fr',
    billing_address_collection: 'auto',
    subscription_data: { metadata: { user_id: utilisateur.id } },
    custom_text: { submit: { message: `Abonnement Premium Carnet Patte : 2,99 € TTC par mois, sans engagement, résiliable à tout moment. En payant, vous acceptez les [conditions générales de vente](${origine}/#/cgv) et vous demandez l'accès immédiat au Premium en reconnaissant perdre votre droit de rétractation de 14 jours.` } },
  });
  return reponse(200, { url: session.url });
}

// ----- stripe-portail : gérer l'abonnement, changer de carte, factures, résilier -----

export async function gererPortail(req, ctx) {
  const { env, stripe, db, auth } = ctx;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return erreur(405, 'methode');
  const utilisateur = await auth.utilisateur(req.headers.get('authorization'));
  if (!utilisateur) return erreur(401, 'non_connecte');
  const corps = await lireCorps(req);
  const origine = origineAutorisee(req, corps, env);
  if (!origine) return erreur(400, 'origine_refusee');
  const abonnement = await db.abonnementDe(utilisateur.id);
  if (!abonnement?.stripe_customer_id) return erreur(404, 'pas_abonne');
  const params = { customer: abonnement.stripe_customer_id, return_url: `${origine}/#/compte`, ...(env.STRIPE_PORTAL_CONFIG ? { configuration: env.STRIPE_PORTAL_CONFIG } : {}) };
  // « Résilier mon abonnement » ouvre directement l'écran de résiliation du portail : quelques clics
  if (corps.action === 'resilier' && abonnement.stripe_subscription_id) params.flow_data = { type: 'subscription_cancel', subscription_cancel: { subscription: abonnement.stripe_subscription_id } };
  const session = await stripe.appeler('POST', '/v1/billing_portal/sessions', params);
  return reponse(200, { url: session.url });
}

// ----- abonnement-annuler : appelée AVANT la suppression du compte -----

export async function gererAnnulation(req, ctx) {
  const { stripe, db, auth } = ctx;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return erreur(405, 'methode');
  const utilisateur = await auth.utilisateur(req.headers.get('authorization'));
  if (!utilisateur) return erreur(401, 'non_connecte');
  const abonnement = await db.abonnementDe(utilisateur.id);
  if (abonnement?.stripe_subscription_id && abonnementActif(abonnement)) {
    try {
      await stripe.appeler('DELETE', `/v1/subscriptions/${abonnement.stripe_subscription_id}`, { prorate: false, invoice_now: false }); // annulé tout de suite : plus aucun prélèvement
    } catch (e) {
      if (!(e.statut === 404 || e.code === 'resource_missing')) return erreur(502, 'annulation_impossible'); // le compte ne doit PAS être supprimé tant que Stripe n'a pas confirmé
    }
    await db.marquerAnnule(utilisateur.id);
  }
  return reponse(200, { ok: true });
}

// ----- stripe-webhook : le seul chemin vers Premium -----

const EVENEMENTS = new Set(['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed']);

export async function traiterWebhook(req, ctx) {
  const { env, stripe, db } = ctx;
  if (req.method !== 'POST') return erreur(405, 'methode');
  const corps = await req.text(); // le texte EXACT : la signature porte dessus
  try {
    await verifierSignature({ corps, entete: req.headers.get('stripe-signature'), secret: env.STRIPE_WEBHOOK_SECRET, maintenant: ctx.maintenant });
  } catch {
    return erreur(400, 'signature'); // faux, absent, périmé : rien n'est lu, rien n'est modifié
  }
  let evenement;
  try { evenement = JSON.parse(corps); } catch { return erreur(400, 'corps'); }
  if (!EVENEMENTS.has(evenement.type)) return reponse(200, { recu: true, resultat: 'ignore' });

  const objet = evenement.data?.object ?? {};
  let userId; let clientId; let abonnementId;
  if (evenement.type === 'checkout.session.completed') {
    if (objet.mode !== 'subscription') return reponse(200, { recu: true, resultat: 'ignore' });
    clientId = objet.customer; abonnementId = objet.subscription; userId = objet.client_reference_id;
    const ligne = clientId ? await db.abonnementDuClient(clientId) : null;
    if (!UUID.test(userId ?? '') || !abonnementId || ligne?.user_id !== userId) return reponse(200, { recu: true, resultat: 'inconnu' }); // pas une de nos sessions
  } else {
    clientId = objet.customer;
    abonnementId = evenement.type.startsWith('customer.subscription') ? objet.id : (objet.subscription ?? objet.parent?.subscription_details?.subscription);
    const ligne = clientId ? await db.abonnementDuClient(clientId) : null;
    if (!ligne || !abonnementId) return reponse(200, { recu: true, resultat: 'inconnu' }); // client inconnu ou compte supprimé : rien à faire
    userId = ligne.user_id;
  }

  let sub;
  try {
    sub = await stripe.appeler('GET', `/v1/subscriptions/${abonnementId}`);
  } catch (e) {
    if (e.statut !== 404 && e.code !== 'resource_missing') throw e; // erreur de Stripe : on répond 500, Stripe réessaiera
    sub = { status: 'canceled' };
  }
  const etat = etatAbonnement(sub, { echecFacture: evenement.type === 'invoice.payment_failed' });
  const resultat = await db.appliquer({ evenementId: evenement.id, type: evenement.type, userId, clientId, abonnementId, ...etat });
  return reponse(200, { recu: true, resultat });
}
