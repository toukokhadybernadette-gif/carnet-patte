// Test « abonnement » : abonnement Premium à 2,99 €/mois avec Stripe (mode test). Aucun vrai Stripe ni vrai Supabase n'est appelé.
// 1) Le code serveur RÉEL (supabase/functions/_shared/*.js : client Stripe, signature des webhooks, règles de formule, les 4 fonctions) tourne ici avec de faux Stripe et
//    Supabase (deux `fetch` qui imitent leurs API) et de VRAIES signatures : signature fausse ou périmée, rejeu, transitions premium / gratuit, consentement, garde-fou des
//    comptes de test, annulation à la suppression du compte.
// 2) Le parcours complet dans le navigateur : bouton « Passer Premium » (case obligatoire), page de paiement (fausse), webhook signé, activation, portail, résiliation,
//    paiement échoué, retour au gratuit sans rien perdre (récupération en lecture seule), suppression du compte qui annule d'abord l'abonnement, CGV et Confidentialité.
// 3) Le script SQL, la configuration des fonctions, et l'absence de toute clé secrète ou adresse personnelle dans le dépôt.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';
import { clientStripe, encoderFormulaire, verifierSignature, hmacHex, ErreurStripe } from '../supabase/functions/_shared/stripe.js';
import { etatAbonnement, gererCheckout, gererPortail, gererAnnulation, traiterWebhook, paiementDisponible, TEXTE_CONSENTEMENT } from '../supabase/functions/_shared/traitement.js';
import { creerAuth, creerDb, abonnementActif } from '../supabase/functions/_shared/supabase.js';

const [S, , TAG] = process.argv.slice(2);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9353) });

// Fausses clés : assemblées pour ne ressembler à AUCUNE vraie clé (le dépôt est public, un test refuse toute clé Stripe)
const CLE_STRIPE = ['cle', 'stripe', 'fausse', 'pour', 'les', 'tests'].join('_');
const WHSEC = ['secret', 'webhook', 'faux', 'pour', 'les', 'tests'].join('_');
const CLE_SERVICE = ['cle', 'service', 'fausse'].join('_');
const U = '11111111-2222-3333-4444-555555555555';
const AUTRE = '99999999-8888-7777-6666-555555555555';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (id, email) => `${b64({ alg: 'HS256' })}.${b64({ sub: id, email, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aud: 'authenticated' })}.signature`;
const JSONR = (statut, o) => new Response(JSON.stringify(o), { status: statut, headers: { 'Content-Type': 'application/json' } });

// ============================ Le monde imité : Stripe et Supabase ============================
function creerMonde(urlStripe = 'https://checkout.stripe.test') {
  const m = {
    profils: new Map([[U, 'gratuit'], [AUTRE, 'gratuit']]),
    utilisateurs: new Map([[U, 'ok@exemple.fr'], [AUTRE, 'autre@exemple.fr']]),
    abonnements: new Map(), evenements: new Set(), supprime: false,
    stripe: { abos: new Map(), sessions: [], portails: [], appels: [], n: 0, echecSuppression: 0, erreur500: false },
  };
  /** Un faux `fetch` pour l'API REST de Stripe. */
  m.stripeFetch = async (url, options = {}) => {
    const chemin = new URL(url).pathname; const methode = options.method ?? 'GET';
    const params = Object.fromEntries(new URLSearchParams(methode === 'GET' || methode === 'DELETE' ? new URL(url).search : options.body ?? ''));
    m.stripe.appels.push({ methode, chemin, params, autorisation: options.headers?.Authorization });
    if (options.headers?.Authorization !== `Bearer ${CLE_STRIPE}`) return JSONR(401, { error: { message: 'Invalid API Key' } });
    if (m.stripe.erreur500 && methode === 'GET') return JSONR(500, { error: { message: 'boum' } });
    if (methode === 'POST' && chemin === '/v1/customers') { const id = `cus_${++m.stripe.n}`; return JSONR(200, { id, email: params.email }); }
    if (methode === 'POST' && chemin === '/v1/checkout/sessions') { const id = `cs_test_${++m.stripe.n}`; m.stripe.sessions.push({ id, params }); return JSONR(200, { id, url: `${urlStripe}/pay/${id}` }); }
    if (methode === 'POST' && chemin === '/v1/billing_portal/sessions') { const id = `bps_${++m.stripe.n}`; m.stripe.portails.push({ id, params }); return JSONR(200, { id, url: `${urlStripe}/portail/${id}` }); }
    const sub = /^\/v1\/subscriptions\/(.+)$/.exec(chemin)?.[1];
    if (sub && methode === 'GET') return m.stripe.abos.has(sub) ? JSONR(200, m.stripe.abos.get(sub)) : JSONR(404, { error: { code: 'resource_missing', message: 'No such subscription' } });
    if (sub && methode === 'DELETE') {
      if (m.stripe.echecSuppression > 0) { m.stripe.echecSuppression--; return JSONR(500, { error: { message: 'Stripe indisponible' } }); }
      if (!m.stripe.abos.has(sub)) return JSONR(404, { error: { code: 'resource_missing', message: 'No such subscription' } });
      m.stripe.abos.get(sub).status = 'canceled'; return JSONR(200, m.stripe.abos.get(sub));
    }
    return JSONR(404, { error: { message: `inconnu : ${methode} ${chemin}` } });
  };
  /** Un faux `fetch` pour Supabase : authentification, table abonnements, et appliquer_abonnement (mêmes règles que supabase/etape4.sql). */
  m.supabaseFetch = async (url, options = {}) => {
    const u = new URL(url); const methode = options.method ?? 'GET';
    if (u.pathname === '/auth/v1/user') {
      const t = /^Bearer (.+)$/.exec(options.headers?.Authorization ?? '')?.[1];
      let p; try { p = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); } catch { return JSONR(401, {}); }
      return m.utilisateurs.has(p.sub) && t.endsWith('.signature') ? JSONR(200, { id: p.sub, email: m.utilisateurs.get(p.sub) }) : JSONR(401, {});
    }
    if (options.headers?.apikey !== CLE_SERVICE) return JSONR(401, { message: 'clé de service absente' });
    const corps = options.body ? JSON.parse(options.body) : null;
    if (u.pathname === '/rest/v1/abonnements') {
      const filtre = (r) => [...u.searchParams].every(([k, v]) => !/^(select|on_conflict)$/.test(k) && v.startsWith('eq.') ? String(r[k]) === v.slice(3) : true);
      if (methode === 'GET') return JSONR(200, [...m.abonnements.values()].filter(filtre));
      if (methode === 'POST') { m.abonnements.set(corps.user_id, { statut: 'aucun', ...(m.abonnements.get(corps.user_id) ?? {}), ...corps }); return new Response(null, { status: 201 }); }
      if (methode === 'PATCH') { for (const r of [...m.abonnements.values()].filter(filtre)) Object.assign(r, corps); return new Response(null, { status: 204 }); }
    }
    if (u.pathname === '/rest/v1/rpc/appliquer_abonnement') {
      if (m.evenements.has(corps.p_evenement)) return JSONR(200, 'doublon');
      m.evenements.add(corps.p_evenement);
      if (!m.utilisateurs.has(corps.p_user)) return JSONR(200, 'inconnu');
      const ancien = m.abonnements.get(corps.p_user) ?? {};
      m.abonnements.set(corps.p_user, { ...ancien, user_id: corps.p_user, stripe_customer_id: corps.p_client, stripe_subscription_id: corps.p_abonnement, statut: corps.p_statut, fin_periode: corps.p_fin, resiliation_prevue: corps.p_resiliation, paiement_echoue: corps.p_echec });
      m.profils.set(corps.p_user, ['active', 'trialing', 'past_due'].includes(corps.p_statut) ? 'premium' : 'gratuit');
      return JSONR(200, 'applique');
    }
    return JSONR(404, { message: `inconnu : ${methode} ${u.pathname}` });
  };
  return m;
}
const outilsServeur = (monde, env) => ({
  env,
  stripe: clientStripe({ cle: CLE_STRIPE, fetchImpl: monde.stripeFetch }),
  db: creerDb({ url: 'https://projet.supabase.test', cleService: CLE_SERVICE, fetchImpl: monde.supabaseFetch }),
  auth: creerAuth({ url: 'https://projet.supabase.test', cleService: CLE_SERVICE, fetchImpl: monde.supabaseFetch }),
});
const requete = (corps, entetes = {}, methode = 'POST') => new Request('https://fonction.test/', { method: methode, headers: { 'content-type': 'application/json', ...entetes }, ...(methode === 'GET' ? {} : { body: typeof corps === 'string' ? corps : JSON.stringify(corps ?? {}) }) });
const avecJeton = (id = U, email = 'ok@exemple.fr') => ({ authorization: `Bearer ${jeton(id, email)}` });
const lire = async (r) => ({ statut: r.status, corps: await r.json().catch(() => null) });
/** Un webhook signé comme Stripe le signe (horodatage + HMAC-SHA256 du texte exact). */
async function webhook(monde, env, evenement, { secret = WHSEC, t = Math.floor(Date.now() / 1000), corps = JSON.stringify(evenement), signature } = {}) {
  const sig = signature ?? await hmacHex(secret, `${t}.${corps}`);
  const r = await traiterWebhook(new Request('https://fonction.test/', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body: corps }), outilsServeur(monde, env));
  return lire(r);
}
let idEv = 0;
const evenement = (type, objet) => ({ id: `evt_${++idEv}`, type, data: { object: objet } });
const abo = (id, extra = {}) => ({ id, customer: 'cus_1', status: 'active', cancel_at_period_end: false, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, ...extra });

// ============================ 1. Code serveur : Stripe et signatures ============================
log('--- 1. Client Stripe et signature des webhooks ---');
verifier(encoderFormulaire({ mode: 'subscription', line_items: [{ price: 'price_1', quantity: 1 }], metadata: { user_id: 'u' }, vide: undefined, nul: null }).join('&') === 'mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Buser_id%5D=u', 'les paramètres imbriqués sont encodés comme Stripe l’attend (line_items[0][price]=…)');
const mondeA = creerMonde();
const stripeA = clientStripe({ cle: CLE_STRIPE, fetchImpl: mondeA.stripeFetch });
const client1 = await stripeA.appeler('POST', '/v1/customers', { email: 'x@exemple.fr', metadata: { user_id: U } });
verifier(client1.id === 'cus_1' && mondeA.stripe.appels[0].autorisation === `Bearer ${CLE_STRIPE}` && mondeA.stripe.appels[0].params['metadata[user_id]'] === U, 'appel Stripe : clé en « Bearer », corps de formulaire');
const mauvais = await clientStripe({ cle: 'autre', fetchImpl: mondeA.stripeFetch }).appeler('GET', '/v1/subscriptions/x').catch((e) => e);
verifier(mauvais instanceof ErreurStripe && mauvais.statut === 401, 'erreur de Stripe : exception claire (statut 401)');
verifier((() => { try { clientStripe({ cle: '' }); return false; } catch { return true; } })(), 'sans clé Stripe configurée : la fonction refuse de démarrer');
const maintenant = Math.floor(Date.now() / 1000);
const texteCorps = '{"id":"evt_x","type":"invoice.paid"}';
const bonne = await hmacHex(WHSEC, `${maintenant}.${texteCorps}`);
const refuse = async (opts) => { try { await verifierSignature({ corps: texteCorps, secret: WHSEC, maintenant, ...opts }); return false; } catch (e) { return e.message; } };
verifier(await verifierSignature({ corps: texteCorps, entete: `t=${maintenant},v1=${bonne}`, secret: WHSEC, maintenant }) === true, 'signature valide : acceptée');
verifier(await verifierSignature({ corps: texteCorps, entete: `t=${maintenant},v1=${'0'.repeat(64)},v1=${bonne}`, secret: WHSEC, maintenant }) === true, 'plusieurs signatures v1 (rotation du secret) : acceptée si l’une est bonne');
verifier(await refuse({ entete: `t=${maintenant},v1=${'0'.repeat(64)}` }) === 'signature incorrecte', 'signature fausse : refusée');
verifier(await refuse({ entete: `t=${maintenant},v1=${bonne}`, corps: `${texteCorps} ` }) === 'signature incorrecte', 'corps modifié d’un seul caractère : refusé');
verifier(await refuse({ entete: `t=${maintenant},v1=${bonne}`, secret: 'autre_secret' }) === 'signature incorrecte', 'mauvais secret : refusé');
verifier(await refuse({ entete: `t=${maintenant - 3600},v1=${await hmacHex(WHSEC, `${maintenant - 3600}.${texteCorps}`)}` }) === 'signature périmée', 'signature vieille d’une heure (rejeu) : refusée');
verifier(await refuse({ entete: undefined }) === 'signature absente' && await refuse({ entete: 'n’importe quoi' }) === 'signature illisible', 'en-tête absent ou illisible : refusé');

// ============================ 2. Règles : état Stripe → formule ============================
log('--- 2. Règles de passage Premium / gratuit ---');
const cas = [
  ['active', {}, 'premium', false, false], ['trialing', {}, 'premium', false, false],
  ['active', { cancel_at_period_end: true }, 'premium', true, false],
  ['past_due', {}, 'premium', false, true], ['canceled', {}, 'gratuit', false, false],
  ['unpaid', {}, 'gratuit', false, false], ['incomplete', {}, 'gratuit', false, false], ['incomplete_expired', {}, 'gratuit', false, false], ['paused', {}, 'gratuit', false, false],
];
for (const [statut, extra, plan, resil, echec] of cas) {
  const e = etatAbonnement({ status: statut, current_period_end: 1893456000, ...extra });
  verifier(e.plan === plan && e.resiliationPrevue === resil && e.paiementEchoue === echec, `statut « ${statut}${extra.cancel_at_period_end ? ' + résiliation prévue' : ''} » → ${plan}${resil ? ', résiliation prévue (Premium jusqu’à la fin de la période)' : ''}${echec ? ', paiement échoué' : ''}`);
}
verifier(etatAbonnement({ status: 'active', items: { data: [{ current_period_end: 1893456000 }] } }).finPeriode === '2030-01-01T00:00:00.000Z', 'fin de période : lue aussi sur la ligne d’abonnement (API récente de Stripe)');
verifier(etatAbonnement(undefined).plan === 'gratuit', 'abonnement introuvable : gratuit');
verifier(abonnementActif({ statut: 'active' }) && abonnementActif({ statut: 'past_due' }) && !abonnementActif({ statut: 'canceled' }) && !abonnementActif({ statut: 'aucun' }) && !abonnementActif(null), 'abonnement « en cours » : actif, en retard ; pas résilié, pas jamais souscrit');

// ============================ 3. Le webhook : le seul chemin vers Premium ============================
log('--- 3. Webhook ---');
const env = { STRIPE_SECRET_KEY: CLE_STRIPE, STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_PRICE_ID: 'price_test_123', SITE_URLS: 'https://carnetpatte.com', COMPTES_TEST: 'ok@exemple.fr', PAIEMENT_OUVERT: '' };
const mondeW = creerMonde();
mondeW.abonnements.set(U, { user_id: U, stripe_customer_id: 'cus_1', statut: 'aucun' }); // créé par stripe-checkout avant le paiement
mondeW.stripe.abos.set('sub_1', abo('sub_1'));
const session = (extra = {}) => ({ id: 'cs_1', mode: 'subscription', customer: 'cus_1', subscription: 'sub_1', client_reference_id: U, payment_status: 'paid', ...extra });
let r = await webhook(mondeW, env, evenement('checkout.session.completed', session()), { signature: '0'.repeat(64) });
verifier(r.statut === 400 && mondeW.profils.get(U) === 'gratuit' && mondeW.evenements.size === 0, 'signature fausse : 400, rien n’est lu, la formule ne bouge pas');
r = await webhook(mondeW, env, evenement('checkout.session.completed', session()), { t: maintenant - 4000 });
verifier(r.statut === 400 && mondeW.profils.get(U) === 'gratuit', 'signature périmée : 400');
r = await lire(await traiterWebhook(new Request('https://fonction.test/', { method: 'POST', body: '{}' }), outilsServeur(mondeW, env)));
verifier(r.statut === 400 && mondeW.profils.get(U) === 'gratuit', 'sans en-tête de signature : 400 (un faux « paiement réussi » envoyé à la main ne donne rien)');
r = await lire(await traiterWebhook(new Request('https://fonction.test/', { method: 'GET' }), outilsServeur(mondeW, env)));
verifier(r.statut === 405, 'autre méthode que POST : 405');
r = await webhook(mondeW, env, evenement('checkout.session.completed', session({ client_reference_id: AUTRE })));
verifier(r.statut === 200 && r.corps.resultat === 'inconnu' && mondeW.profils.get(AUTRE) === 'gratuit' && mondeW.profils.get(U) === 'gratuit', 'session signée mais pour un autre compte que celui du client Stripe : ignorée (aucun compte ne passe Premium)');
r = await webhook(mondeW, env, evenement('checkout.session.completed', session({ customer: 'cus_inconnu' })));
verifier(r.corps.resultat === 'inconnu' && mondeW.profils.get(U) === 'gratuit', 'client Stripe inconnu : ignoré');
r = await webhook(mondeW, env, evenement('checkout.session.completed', session({ mode: 'payment' })));
verifier(r.corps.resultat === 'ignore', 'paiement unique (pas un abonnement) : ignoré');
const evPaye = evenement('checkout.session.completed', session());
r = await webhook(mondeW, env, evPaye);
verifier(r.statut === 200 && r.corps.resultat === 'applique' && mondeW.profils.get(U) === 'premium' && mondeW.abonnements.get(U).statut === 'active' && mondeW.abonnements.get(U).stripe_subscription_id === 'sub_1', 'paiement réussi (signature valide) → plan « premium », abonnement « active » enregistré');
r = await webhook(mondeW, env, evPaye);
verifier(r.corps.resultat === 'doublon', 'le même événement rejoué : « doublon », rien n’est refait');
mondeW.stripe.abos.set('sub_1', abo('sub_1', { cancel_at_period_end: true }));
r = await webhook(mondeW, env, evenement('customer.subscription.updated', abo('sub_1', { cancel_at_period_end: true })));
verifier(mondeW.profils.get(U) === 'premium' && mondeW.abonnements.get(U).resiliation_prevue === true && !!mondeW.abonnements.get(U).fin_periode, 'résiliation : reste Premium jusqu’à la fin de la période payée, résiliation prévue et date de fin gardées');
mondeW.stripe.abos.set('sub_1', abo('sub_1', { status: 'past_due' }));
r = await webhook(mondeW, env, evenement('invoice.payment_failed', { customer: 'cus_1', subscription: 'sub_1' }));
verifier(mondeW.profils.get(U) === 'premium' && mondeW.abonnements.get(U).paiement_echoue === true && mondeW.abonnements.get(U).statut === 'past_due', 'paiement échoué : toujours Premium, avec le drapeau « paiement échoué » (message dans l’appli)');
mondeW.stripe.abos.set('sub_1', abo('sub_1'));
r = await webhook(mondeW, env, evenement('invoice.paid', { customer: 'cus_1', parent: { subscription_details: { subscription: 'sub_1' } } }));
verifier(mondeW.abonnements.get(U).paiement_echoue === false && mondeW.abonnements.get(U).statut === 'active' && mondeW.profils.get(U) === 'premium', 'paiement régularisé (facture payée, API récente) : le drapeau disparaît');
mondeW.stripe.abos.set('sub_1', abo('sub_1', { status: 'canceled' }));
r = await webhook(mondeW, env, evenement('customer.subscription.deleted', abo('sub_1', { status: 'canceled' })));
verifier(mondeW.profils.get(U) === 'gratuit' && mondeW.abonnements.get(U).statut === 'canceled', 'fin de l’abonnement (résilié, ou impayé non régularisé) → plan « gratuit »');
// Ordre inversé : on relit TOUJOURS Stripe, donc un vieil événement arrivé en retard ne rétablit pas Premium
r = await webhook(mondeW, env, evenement('customer.subscription.updated', abo('sub_1', { status: 'active' })));
verifier(mondeW.profils.get(U) === 'gratuit', 'événement « actif » arrivé APRÈS l’annulation : sans effet (l’état réel est relu chez Stripe)');
mondeW.stripe.abos.delete('sub_1');
r = await webhook(mondeW, env, evenement('customer.subscription.updated', abo('sub_1')));
verifier(mondeW.profils.get(U) === 'gratuit', 'abonnement introuvable chez Stripe : gratuit');
r = await webhook(mondeW, env, evenement('customer.created', { id: 'cus_9' }));
verifier(r.statut === 200 && r.corps.resultat === 'ignore', 'événement non suivi : accusé de réception, ignoré');
r = await webhook(mondeW, env, evenement('invoice.paid', { customer: 'cus_inconnu', subscription: 'sub_x' }));
verifier(r.statut === 200 && r.corps.resultat === 'inconnu', 'client inconnu (compte supprimé) : accusé de réception, ignoré');
mondeW.stripe.erreur500 = true;
const echecStripe = await webhook(mondeW, env, evenement('customer.subscription.updated', abo('sub_1'))).catch((e) => e);
verifier(echecStripe instanceof Error, 'Stripe en panne pendant le traitement : la fonction échoue (500), Stripe réessaiera plus tard');
mondeW.stripe.erreur500 = false;
verifier(!mondeW.stripe.appels.some((a) => a.methode === 'POST' && /subscriptions/.test(a.chemin)), 'le webhook ne modifie jamais rien chez Stripe : il lit seulement');

// ============================ 4. stripe-checkout ============================
log('--- 4. stripe-checkout ---');
const mondeC = creerMonde(); const sc = outilsServeur(mondeC, env);
const checkout = async (corps, entetes, e = sc) => lire(await gererCheckout(requete(corps, entetes), e));
verifier((await checkout({}, {})).statut === 401 && (await checkout({}, { authorization: 'Bearer n.importe.quoi' })).statut === 401, 'sans connexion, ou avec un jeton invalide : 401');
verifier((await gererCheckout(requete(null, {}, 'OPTIONS'), sc)).status === 204, 'requête de pré-vérification du navigateur (CORS) : 204');
verifier((await checkout({ action: 'disponible' }, avecJeton())).corps.disponible === true && (await checkout({ action: 'disponible' }, avecJeton(AUTRE, 'autre@exemple.fr'))).corps.disponible === false, 'garde-fou : le paiement n’est « disponible » que pour les comptes de COMPTES_TEST (adresse comparée sans tenir compte des majuscules)');
verifier(paiementDisponible({ COMPTES_TEST: 'Ok@Exemple.fr, un@autre.fr' }, 'ok@exemple.fr') && !paiementDisponible({ COMPTES_TEST: '' }, 'ok@exemple.fr') && paiementDisponible({ PAIEMENT_OUVERT: 'oui' }, 'quiconque@exemple.fr') && !paiementDisponible({ PAIEMENT_OUVERT: 'non' }, 'quiconque@exemple.fr'), 'PAIEMENT_OUVERT=oui ouvre le paiement à tout le monde ; sinon seulement la liste des comptes de test');
const avantAppels = mondeC.stripe.appels.length;
let c = await checkout({ consentement: true, origine: 'https://carnetpatte.com' }, avecJeton(AUTRE, 'autre@exemple.fr'));
verifier(c.statut === 403 && c.corps.erreur === 'non_disponible' && mondeC.stripe.appels.length === avantAppels, 'un compte qui n’est pas dans la liste de test ne peut PAS payer (403), Stripe n’est même pas appelé : personne ne peut s’offrir Premium avec la carte 4242');
c = await checkout({ consentement: false, origine: 'https://carnetpatte.com' }, avecJeton());
verifier(c.statut === 400 && c.corps.erreur === 'consentement_requis' && mondeC.stripe.appels.length === avantAppels, 'sans la case cochée : refusé côté serveur aussi, rien n’est créé chez Stripe');
c = await checkout({ origine: 'https://carnetpatte.com' }, avecJeton());
verifier(c.corps.erreur === 'consentement_requis', 'consentement absent : refusé');
c = await checkout({ consentement: true, origine: 'https://pirate.example' }, avecJeton());
verifier(c.statut === 400 && c.corps.erreur === 'origine_refusee' && mondeC.stripe.appels.length === avantAppels, 'adresse de retour non autorisée : refusée (on ne renvoie jamais vers un site inconnu)');
c = await checkout({ consentement: true, origine: 'https://carnetpatte.com' }, avecJeton(), { ...sc, env: { ...env, STRIPE_PRICE_ID: '' } });
verifier(c.statut === 500 && c.corps.erreur === 'configuration', 'secret STRIPE_PRICE_ID manquant : erreur de configuration claire');
c = await checkout({ consentement: true, origine: 'https://carnetpatte.com/' }, avecJeton());
const sess = mondeC.stripe.sessions.at(-1)?.params ?? {};
verifier(c.statut === 200 && /^https:\/\/checkout\.stripe\.test\/pay\/cs_test_/.test(c.corps.url), 'tout est en règle : la fonction renvoie l’adresse de la page de paiement Stripe');
verifier(mondeC.stripe.appels.find((a) => a.chemin === '/v1/customers').params['metadata[user_id]'] === U && mondeC.stripe.appels.find((a) => a.chemin === '/v1/customers').params.email === 'ok@exemple.fr', 'un client Stripe est créé pour ce compte (avec son identifiant en métadonnée)');
verifier(sess.mode === 'subscription' && sess['line_items[0][price]'] === 'price_test_123' && sess['line_items[0][quantity]'] === '1' && sess.client_reference_id === U && sess.customer === 'cus_1', 'session Checkout : abonnement, prix du secret STRIPE_PRICE_ID, client et compte liés');
verifier(sess.success_url === 'https://carnetpatte.com/?paiement=ok#/compte' && sess.cancel_url === 'https://carnetpatte.com/?paiement=annule#/compte' && sess.locale === 'fr', 'adresses de retour (succès et annulation) sur carnetpatte.com, page en français');
verifier(/conditions générales de vente\]\(https:\/\/carnetpatte\.com\/#\/cgv\)/.test(sess['custom_text[submit][message]']) && /2,99 € TTC par mois/.test(sess['custom_text[submit][message]']) && /droit de rétractation de 14 jours/.test(sess['custom_text[submit][message]']), 'sur la page Stripe, au-dessus du bouton : prix, lien vers les CGV et rappel de la renonciation au droit de rétractation');
const ligneAbo = mondeC.abonnements.get(U);
verifier(ligneAbo.stripe_customer_id === 'cus_1' && ligneAbo.consentement_texte === TEXTE_CONSENTEMENT && /^\d{4}-\d\d-\d\dT/.test(ligneAbo.consentement_le), 'preuve du consentement gardée : texte exact et date');
verifier(!JSON.stringify(c.corps).includes(CLE_STRIPE) && !JSON.stringify(c.corps).includes(CLE_SERVICE), 'la réponse ne contient aucune clé secrète');
await checkout({ consentement: true, origine: 'https://carnetpatte.com' }, avecJeton());
verifier(mondeC.stripe.appels.filter((a) => a.chemin === '/v1/customers').length === 1, 'un deuxième essai réutilise le même client Stripe (pas de doublon)');
mondeC.abonnements.get(U).statut = 'active';
c = await checkout({ consentement: true, origine: 'https://carnetpatte.com' }, avecJeton());
verifier(c.statut === 409 && c.corps.erreur === 'deja_abonne', 'déjà abonné : on ne peut pas payer deux fois (409)');

// ============================ 5. stripe-portail ============================
log('--- 5. stripe-portail ---');
const mondeP = creerMonde(); const sp = outilsServeur(mondeP, { ...env, COMPTES_TEST: '' }); // même hors liste de test : un abonné doit toujours pouvoir gérer et résilier
const portail = async (corps, entetes) => lire(await gererPortail(requete(corps, entetes), sp));
verifier((await portail({ origine: 'https://carnetpatte.com' }, {})).statut === 401, 'portail : connexion obligatoire');
verifier((await portail({ origine: 'https://carnetpatte.com' }, avecJeton())).statut === 404, 'pas d’abonnement : 404 « pas_abonne »');
mondeP.abonnements.set(U, { user_id: U, stripe_customer_id: 'cus_7', stripe_subscription_id: 'sub_7', statut: 'active' });
verifier((await portail({ origine: 'https://pirate.example' }, avecJeton())).corps.erreur === 'origine_refusee', 'portail : adresse de retour non autorisée refusée');
let p = await portail({ origine: 'https://carnetpatte.com', action: 'gerer' }, avecJeton());
let ps = mondeP.stripe.portails.at(-1).params;
verifier(p.statut === 200 && /\/portail\//.test(p.corps.url) && ps.customer === 'cus_7' && ps.return_url === 'https://carnetpatte.com/#/compte' && !('flow_data[type]' in ps), '« Gérer mon abonnement » : portail Stripe du client, retour sur la page Compte');
p = await portail({ origine: 'https://carnetpatte.com', action: 'resilier' }, avecJeton());
ps = mondeP.stripe.portails.at(-1).params;
verifier(ps['flow_data[type]'] === 'subscription_cancel' && ps['flow_data[subscription_cancel][subscription]'] === 'sub_7', '« Résilier mon abonnement » : ouvre directement l’écran de résiliation du portail (quelques clics)');

// ============================ 6. abonnement-annuler (suppression du compte) ============================
log('--- 6. Annulation à la suppression du compte ---');
const mondeX = creerMonde(); const sx = outilsServeur(mondeX, env);
const annuler = async (entetes = avecJeton()) => lire(await gererAnnulation(requete({}, entetes), sx));
verifier((await annuler({})).statut === 401, 'annulation : connexion obligatoire');
let a = await annuler();
verifier(a.statut === 200 && mondeX.stripe.appels.length === 0, 'sans abonnement : « ok », Stripe n’est pas appelé');
mondeX.abonnements.set(U, { user_id: U, stripe_customer_id: 'cus_5', stripe_subscription_id: 'sub_5', statut: 'active' });
mondeX.stripe.abos.set('sub_5', abo('sub_5'));
mondeX.stripe.echecSuppression = 1;
a = await annuler();
verifier(a.statut === 502 && a.corps.erreur === 'annulation_impossible' && mondeX.stripe.abos.get('sub_5').status === 'active' && mondeX.abonnements.get(U).statut === 'active', 'Stripe en panne : erreur 502, l’abonnement reste actif ET marqué actif (le compte ne doit pas être supprimé)');
a = await annuler();
const del = mondeX.stripe.appels.filter((x) => x.methode === 'DELETE').at(-1);
verifier(a.statut === 200 && mondeX.stripe.abos.get('sub_5').status === 'canceled' && mondeX.abonnements.get(U).statut === 'canceled' && del.params.prorate === 'false', 'annulation réussie : abonnement annulé tout de suite chez Stripe, noté « canceled »');
mondeX.abonnements.set(U, { user_id: U, stripe_customer_id: 'cus_5', stripe_subscription_id: 'sub_disparu', statut: 'active' });
a = await annuler();
verifier(a.statut === 200 && mondeX.abonnements.get(U).statut === 'canceled', 'abonnement déjà disparu chez Stripe (404) : considéré annulé');

// ============================ 7. Le site, le serveur de test et le parcours dans le navigateur ============================
log('--- 7. Parcours dans l’appli ---');
const monde = creerMonde();
monde.elementsCloud = []; // pour la récupération en lecture seule
const journal = [];
const WH = { env: null };
let URL_FAUX = ''; let BASE = '';
const envAppli = () => ({ ...env, SITE_URLS: BASE, COMPTES_TEST: '', PAIEMENT_OUVERT: '' });
let reglagesEnv = envAppli;
const heureSession = (email, expiresIn = 3600) => {
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  const user = { id: U, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  return { access_token: jeton(U, email), token_type: 'bearer', expires_in: expiresIn, expires_at: exp, refresh_token: `refresh-${Date.now()}`, user };
};
async function livrerWebhook(type, objet) {
  const ev = evenement(type, objet);
  const corps = JSON.stringify(ev); const t = Math.floor(Date.now() / 1000);
  const r = await traiterWebhook(new Request('https://fonction.test/', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${await hmacHex(WHSEC, `${t}.${corps}`)}` }, body: corps }), outilsServeur(monde, reglagesEnv()));
  return r.status;
}
const faux = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS', 'Access-Control-Expose-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  const morceaux = []; req.on('data', (d) => morceaux.push(d));
  req.on('end', async () => {
    const brut = Buffer.concat(morceaux).toString();
    let b = {}; try { b = JSON.parse(brut || '{}'); } catch { /* formulaire */ }
    journal.push({ methode: req.method, chemin: url.pathname + url.search, corps: b, t: Date.now(), autorisation: req.headers.authorization });
    const json = (code, o, plus = {}) => res.writeHead(code, { ...cors, 'Content-Type': 'application/json', ...plus }).end(JSON.stringify(o));
    const vide = (code = 204) => res.writeHead(code, cors).end();
    const p = url.pathname;
    try {
      // ----- Authentification -----
      if (p === '/auth/v1/otp') return json(200, {});
      if (p === '/auth/v1/verify') return b.token === '123456' ? json(200, heureSession(b.email)) : json(403, { error_code: 'otp_expired', msg: 'invalide' });
      if (p === '/auth/v1/token') return json(200, heureSession('ok@exemple.fr'));
      if (p === '/auth/v1/user') return json(200, heureSession('ok@exemple.fr').user);
      if (p === '/auth/v1/logout') return vide();
      // ----- Tables et fonctions SQL de l'appli -----
      if (p === '/rest/v1/profils') return json(200, [{ plan: monde.profils.get(U), cree_le: '2026-11-23T10:00:00Z' }]);
      if (p === '/rest/v1/liste_attente_premium') return req.method === 'GET' ? json(200, []) : vide(req.method === 'POST' ? 201 : 204);
      if (p === '/rest/v1/rpc/mon_abonnement') { const a2 = monde.abonnements.get(U); return json(200, a2 && a2.statut !== 'aucun' ? { statut: a2.statut, fin_periode: a2.fin_periode ?? null, resiliation_prevue: !!a2.resiliation_prevue, paiement_echoue: !!a2.paiement_echoue } : null); }
      if (p === '/rest/v1/rpc/supprimer_mon_compte') {
        if (monde.abonnements.get(U) && abonnementActif(monde.abonnements.get(U))) return json(400, { code: 'P0001', message: 'abonnement_actif' });
        monde.supprime = true; return vide();
      }
      if (p === '/rest/v1/elements' || p === '/rest/v1/documents_cloud') {
        const lignes = p === '/rest/v1/elements' ? monde.elementsCloud : [];
        const r = lignes.filter((l) => [...url.searchParams].every(([k, v]) => k === 'collection' && v.startsWith('neq.') ? l.collection !== v.slice(4) : k === 'supprime' ? String(l.supprime) === v.slice(3) : true));
        const entetes = { 'content-range': r.length ? `0-${r.length - 1}/${r.length}` : '*/0' };
        if (req.method === 'HEAD') return res.writeHead(200, { ...cors, ...entetes }).end();
        if (req.method === 'GET') return json(200, r, entetes);
        journal.push({ methode: 'ECRITURE-INTERDITE', chemin: p }); return json(403, { code: '42501' });
      }
      if (p.startsWith('/storage/v1/object/list/')) return json(200, []);
      // ----- Edge Functions : le VRAI code, avec de faux Stripe et Supabase -----
      const fn = /^\/functions\/v1\/(stripe-checkout|stripe-portail|abonnement-annuler)$/.exec(p)?.[1];
      if (fn) {
        const gerer = { 'stripe-checkout': gererCheckout, 'stripe-portail': gererPortail, 'abonnement-annuler': gererAnnulation }[fn];
        const reponse = await gerer(new Request('https://fonction.test/', { method: req.method, headers: { 'content-type': 'application/json', authorization: req.headers.authorization ?? '', origin: req.headers.origin ?? '' }, ...(req.method === 'POST' ? { body: brut } : {}) }), outilsServeur(monde, reglagesEnv()));
        const corps = await reponse.text();
        return res.writeHead(reponse.status, { ...cors, 'Content-Type': 'application/json' }).end(corps);
      }
      // ----- Fausse page de paiement et faux portail Stripe -----
      const pay = /^\/stripe\/pay\/([\w]+)$/.exec(p)?.[1];
      if (pay && req.method === 'GET') {
        const s = monde.stripe.sessions.find((x) => x.id === pay);
        return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html><meta charset="utf-8"><title>Stripe Checkout (faux)</title><h1 id="titre">Paiement sécurisé (faux Stripe)</h1><p id="message">${s?.params['custom_text[submit][message]'] ?? ''}</p><form method="post" action="/stripe/pay/${pay}/payer"><button id="payer">Payer avec 4242 4242 4242 4242</button></form>`);
      }
      const payer = /^\/stripe\/pay\/([\w]+)\/payer$/.exec(p)?.[1];
      if (payer && req.method === 'POST') {
        const s = monde.stripe.sessions.find((x) => x.id === payer);
        const sid = 'sub_nav';
        monde.stripe.abos.set(sid, abo(sid, { customer: s.params.customer }));
        await livrerWebhook('checkout.session.completed', { id: s.id, mode: 'subscription', customer: s.params.customer, subscription: sid, client_reference_id: s.params.client_reference_id, payment_status: 'paid' });
        return res.writeHead(302, { Location: s.params.success_url }).end();
      }
      const port = /^\/stripe\/portail\/([\w]+)$/.exec(p)?.[1];
      if (port && req.method === 'GET') {
        const s = monde.stripe.portails.find((x) => x.id === port);
        const resilier = s?.params['flow_data[type]'] === 'subscription_cancel';
        return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html><meta charset="utf-8"><title>Portail Stripe (faux)</title><h1 id="titre">${resilier ? 'Résilier l’abonnement' : 'Gérer l’abonnement'}</h1><form method="post" action="/stripe/portail/${port}/${resilier ? 'resilier' : 'retour'}"><button id="valider">${resilier ? 'Confirmer la résiliation' : 'Retour'}</button></form>`);
      }
      const portAction = /^\/stripe\/portail\/([\w]+)\/(resilier|retour)$/.exec(p);
      if (portAction && req.method === 'POST') {
        const s = monde.stripe.portails.find((x) => x.id === portAction[1]);
        if (portAction[2] === 'resilier') {
          const sub = monde.abonnements.get(U).stripe_subscription_id;
          monde.stripe.abos.get(sub).cancel_at_period_end = true;
          await livrerWebhook('customer.subscription.updated', monde.stripe.abos.get(sub));
        }
        return res.writeHead(302, { Location: s.params.return_url }).end();
      }
      json(404, { msg: `inconnu : ${req.method} ${p}` });
    } catch (e) { json(500, { msg: String(e?.stack ?? e) }); }
  });
});
await new Promise((ok) => faux.listen(0, '127.0.0.1', ok));
URL_FAUX = `http://127.0.0.1:${faux.address().port}`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const CLE_PUBLIQUE = 'sb_publishable_cle_de_test_0123456789';
const site = http.createServer((req, res) => {
  let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (chemin === '/') chemin = '/index.html';
  if (chemin === '/js/supabase-config.js') { res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }).end(`export const SUPABASE = ${JSON.stringify({ url: URL_FAUX, cle: CLE_PUBLIQUE })};`); return; }
  const f = path.join(RACINE, chemin);
  if (!f.startsWith(RACINE) || f.startsWith(path.join(RACINE, 'tests')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => site.listen(0, '127.0.0.1', ok));
BASE = `http://127.0.0.1:${site.address().port}`;
monde.stripe.urlBase = URL_FAUX;
// Le faux Stripe renvoie des pages sur le faux serveur : on relie les deux mondes
monde.stripeFetch = ((original) => async (url, options) => { const r = await original(url, options); if (r.ok && /\/v1\/(checkout\/sessions|billing_portal\/sessions)$/.test(new URL(url).pathname) && options?.method === 'POST') { const o = await r.json(); return JSONR(200, { ...o, url: o.url.replace('https://checkout.stripe.test', `${URL_FAUX}/stripe`) }); } return r; })(monde.stripeFetch);
await send('Network.enable');
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(1800);
await taille(375, 812);

const saisir = (sel, v) => ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const soumettre = async (sel = 'form') => { await ev(`document.querySelector(${JSON.stringify(sel)}).requestSubmit()`); await dort(900); };
const attendre = async (cond, max = 12000) => { const debut = Date.now(); while (Date.now() - debut < max) { if (await cond()) return true; await dort(250); } return false; };
const dialogue = () => ev(`document.querySelector('dialog[open]')?.innerText ?? ''`);
const repondre = async (oui) => { await ev(`document.querySelector('dialog[open] [${oui ? 'data-oui' : 'data-non'}]').click()`); await dort(500); };
const visible = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; })()`);
const appelsFonction = (nom) => journal.filter((j) => j.chemin === `/functions/v1/${nom}` && j.methode === 'POST');
const voir = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`).then(() => dort(300));
const ouvrirCompte = async () => { await aller('#/profil'); await aller('#/compte'); await dort(1800); };
await importer({ version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z', animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: '', naissance: '2023-01-01', photo: '' }], soins: [], pesees: [] });
await aller('#/compte'); await dort(500);
await saisir('#cm-email', 'ok@exemple.fr'); await soumettre();
await saisir('#cm-code', '123456'); await soumettre(); await dort(1500);

// ----- 7a. Le paiement n'est pas ouvert à tout le monde -----
verifier(await ev(`!!document.querySelector('[data-etape=connecte]')`) && !(await visible('[data-achat]')) && !(await visible('[data-abonnement]')), 'compte non autorisé (pendant les tests) : aucune carte « Passer Premium » : le public ne voit rien');
verifier(await visible('[data-premium]') && (await texte('[data-premium]')).includes('pas encore disponible') && await ev(`!!document.querySelector('[data-attente]')`), 'la liste d’attente « Me prévenir à l’ouverture » reste en place');
verifier(appelsFonction('stripe-checkout').length >= 1 && appelsFonction('stripe-checkout').every((j) => j.corps.action === 'disponible'), 'l’appli demande seulement « le paiement est-il disponible ? » : aucune session Stripe n’est créée');
// ----- 7b. Compte autorisé : la carte de paiement -----
reglagesEnv = () => ({ ...envAppli(), COMPTES_TEST: 'ok@exemple.fr' });
await ouvrirCompte();
verifier(await visible('[data-achat]'), 'compte autorisé : la carte « Passer Premium » apparaît');
verifier(!(await visible('[data-premium]')) && (await texte('[data-achat-formule]')) === 'Votre formule : Gratuite.', 'la carte « Premium : pas encore disponible » (liste d’attente) laisse la place à la carte de paiement ; la formule actuelle y est rappelée');
const achat = await texte('[data-achat]');
verifier(achat.includes('2,99 € TTC par mois') && achat.includes('sans engagement') && achat.includes('Stripe') && /ne voit jamais votre numéro de carte/.test(achat), 'prix TTC, sans engagement, « Carnet Patte ne voit jamais votre numéro de carte »');
verifier(await ev(`document.querySelector('[data-achat] .cm-case span').textContent`) === TEXTE_CONSENTEMENT && !(await ev(`document.querySelector('[data-consentement]').checked`)), `case à cocher, décochée au départ : « ${TEXTE_CONSENTEMENT} »`);
verifier(await ev(`document.querySelector('[data-payer]').disabled`) && (await texte('[data-payer]')) === 'Passer Premium – 2,99 €/mois', 'bouton « Passer Premium – 2,99 €/mois » grisé tant que la case n’est pas cochée');
verifier(await ev(`document.querySelector('[data-achat] a[href="#/cgv"]')?.textContent.includes('conditions générales de vente')`), 'lien vers les CGV depuis la carte de paiement');
await ev(`document.querySelector('[data-payer]').click()`); await dort(500);
verifier(appelsFonction('stripe-checkout').every((j) => j.corps.consentement === undefined) && !(await ev(`location.href`)).includes('/stripe/'), 'cliquer le bouton grisé ne fait rien : aucune requête de paiement');
const sansCase = await ev(`import('/js/compte.js').then((c) => c.adresseDePaiement(false).then(() => 'ok', (e) => c.messageErreur(e)))`);
verifier(sansCase === 'Cochez la case pour continuer.' && monde.stripe.sessions.length === 0, 'même en appelant directement le serveur sans la case : refusé (« Cochez la case pour continuer. »), aucune session créée');
await controler('Compte : carte de paiement à 375 px'); await axe('#contenu', 'compte : passer premium'); await voir('[data-achat]'); await ecran('abonnement-achat');
// ----- 7c. Le paiement -----
await ev(`document.querySelector('[data-consentement]').click()`); await dort(200);
verifier(!(await ev(`document.querySelector('[data-payer]').disabled`)), 'case cochée : le bouton s’active');
await ev(`document.querySelector('[data-payer]').click()`); await dort(1500);
verifier((await ev(`location.href`)).startsWith(`${URL_FAUX}/stripe/pay/cs_test_`) && (await texte('#titre')).includes('Paiement sécurisé'), 'l’appli ouvre la page de paiement (ici un faux Stripe)');
const appelCheckout = appelsFonction('stripe-checkout').at(-1);
verifier(appelCheckout.corps.consentement === true && appelCheckout.corps.origine === BASE && /^Bearer /.test(appelCheckout.autorisation ?? '') && !JSON.stringify(journal).includes(CLE_STRIPE), 'la demande porte le consentement, l’adresse du site et le jeton de session ; aucune clé secrète ne circule');
verifier((await texte('#message')).includes('conditions générales de vente') && (await texte('#message')).includes('droit de rétractation'), 'la page de paiement affiche le rappel (CGV et rétractation) au-dessus du bouton');
verifier(monde.profils.get(U) === 'gratuit', 'avant le paiement : toujours gratuit');
await ev(`document.querySelector('#payer').click()`);
verifier(await attendre(async () => (await ev(`location.href`)).startsWith(BASE) && await visible('[data-abonnement]')), 'après le paiement : retour dans l’appli, l’abonnement apparaît (Premium activé par le webhook)');
verifier(monde.profils.get(U) === 'premium' && monde.abonnements.get(U).statut === 'active', 'le webhook signé a passé le compte en Premium (c’est le seul chemin)');
verifier(await ev(`location.search`) === '' && await ev(`location.hash`) === '#/compte', 'l’adresse est nettoyée (plus de ?paiement=ok)');
verifier(!(await visible('[data-achat]')) && await visible('[data-cloud]') && !(await visible('[data-premium]')), 'Premium : la carte de paiement et la liste d’attente disparaissent, la sauvegarde cloud apparaît');
await dort(1500); if ((await dialogue()).includes('Sauvegarder votre carnet')) await repondre(false); // la proposition d'activer la sauvegarde cloud s'ouvre toute seule : on la refuse pour la suite du test
const gestion = await texte('[data-abonnement]');
verifier(gestion.includes('Abonnement actif : 2,99 € par mois') && /Prochain paiement le \d/.test(gestion), `état : « ${(await texte('[data-abonnement-texte]')).slice(0, 80)} »`);
verifier((await texte('[data-portail=gerer]')) === 'Gérer mon abonnement et mes factures' && (await texte('[data-portail=resilier]')) === 'Résilier mon abonnement', 'boutons « Gérer mon abonnement et mes factures » et « Résilier mon abonnement »');
const posResilier = await ev(`(() => { const b = document.querySelector('[data-portail=resilier]').getBoundingClientRect(); const c = document.querySelector('[data-cloud]').getBoundingClientRect(); const e = document.querySelector('[data-abonnement]').getBoundingClientRect(); return { dansLaCarte: b.top >= e.top && b.bottom <= e.bottom, avantLesDonnees: e.top < document.querySelector('[data-donnees]').getBoundingClientRect().top, h: b.height, l: b.width }; })()`);
verifier(posResilier.dansLaCarte && posResilier.h >= 40 && posResilier.avantLesDonnees, `« Résilier mon abonnement » est facile à trouver : bouton de ${Math.round(posResilier.l)} x ${Math.round(posResilier.h)} px dans la carte de l’abonnement, au-dessus des données et de la suppression`);
await controler('Compte : abonnement actif à 375 px'); await axe('#contenu', 'compte : abonnement'); await voir('[data-abonnement]'); await ecran('abonnement-actif');
// ----- 7d. Résiliation par le portail -----
await ev(`document.querySelector('[data-portail=resilier]').click()`); await dort(1500);
verifier((await ev(`location.href`)).includes('/stripe/portail/') && (await texte('#titre')) === 'Résilier l’abonnement', '« Résilier mon abonnement » ouvre directement l’écran de résiliation du portail');
verifier(monde.stripe.portails.at(-1).params['flow_data[type]'] === 'subscription_cancel', 'la demande au portail est bien une résiliation');
await ev(`document.querySelector('#valider').click()`);
verifier(await attendre(async () => (await ev(`location.href`)).startsWith(BASE) && (await texte('[data-abonnement-texte]')).includes('Abonnement résilié')), 'retour dans l’appli après la résiliation');
const resilie = await texte('[data-abonnement-texte]');
verifier(/Vous gardez Premium jusqu'au \d+ \S+ \d{4}/.test(resilie) && resilie.includes('formule gratuite') && resilie.includes('rien n\'est supprimé'), `résilié : « ${resilie} »`);
verifier(monde.profils.get(U) === 'premium' && await visible('[data-cloud]'), 'résilié : toujours Premium jusqu’à la fin de la période payée (la sauvegarde continue)');
// ----- 7e. Paiement échoué, puis retour au gratuit -----
monde.stripe.abos.get('sub_nav').cancel_at_period_end = false;
monde.stripe.abos.get('sub_nav').status = 'past_due';
await livrerWebhook('invoice.payment_failed', { customer: 'cus_1', subscription: 'sub_nav' });
await ouvrirCompte();
const alerteEchec = await texte('[data-abonnement-alerte]');
verifier(monde.profils.get(U) === 'premium' && alerteEchec.includes('Votre dernier paiement a échoué') && alerteEchec.includes('Mettez à jour votre carte') && alerteEchec.includes('rien n\'est supprimé'), 'paiement échoué : message dans l’appli, toujours Premium (Stripe réessaie)');
await voir('[data-abonnement]'); await ecran('abonnement-echec');
// Retour au gratuit (non régularisé) : rien n'est supprimé, lecture seule et récupération
monde.elementsCloud.push({ collection: 'animaux', item_id: 'cloud1', donnees: { id: 'cloud1', nom: 'Du cloud', espece: 'chat', especeAutre: '', race: '', naissance: '2022-02-02' }, modifie_le: '2026-11-01T10:00:00.000Z', recu_le: '2026-11-01T10:00:00.123456+00:00', supprime: false },
  { collection: 'animaux', item_id: 'a', donnees: { id: 'a', nom: 'Moka (ancienne version du cloud)', espece: 'chien', especeAutre: '', race: '', naissance: '2023-01-01' }, modifie_le: '2026-10-01T10:00:00.000Z', recu_le: '2026-10-01T10:00:00.123456+00:00', supprime: false });
monde.stripe.abos.get('sub_nav').status = 'canceled';
await livrerWebhook('customer.subscription.deleted', monde.stripe.abos.get('sub_nav'));
await ouvrirCompte();
verifier(monde.profils.get(U) === 'gratuit' && !(await visible('[data-abonnement]')) && !(await visible('[data-cloud]')), 'abonnement terminé : formule gratuite, la sauvegarde cloud s’arrête');
verifier(await visible('[data-achat]') && await visible('[data-lecture-seule]'), 'on peut se réabonner (carte « Passer Premium ») ; et la sauvegarde conservée est proposée en lecture seule');
const lecture = await texte('[data-lecture-seule]');
verifier(lecture.includes('rien n\'a été supprimé') && lecture.includes('lecture seule') && lecture.includes('Télécharger les données de mon compte') && await ev(`!!document.querySelector('[data-exporter-compte]')`), 'texte clair : rien n’est supprimé, lecture seule, l’export des données reste possible');
await controler('Compte : retour au gratuit à 375 px'); await axe('#contenu', 'compte : gratuit avec sauvegarde conservée'); await voir('[data-lecture-seule]'); await ecran('abonnement-lecture-seule');
const reglageAvant = await ev(`localStorage.getItem('carnetpatte.synchro')`);
await ev(`document.querySelector('[data-recuperer]').click()`); await dort(1500);
verifier((await dialogue()).includes('Récupérer votre carnet') && (await dialogue()).includes('ni remplacé ni supprimé') && (await dialogue()).includes('reste arrêtée'), 'confirmation : ce qui est déjà ici n’est ni remplacé ni supprimé ; la sauvegarde reste arrêtée');
await repondre(true); await dort(2500);
const noms = await ev(`import('/js/storage.js').then((m) => m.lister('animaux').map((a) => a.nom).sort().join('|'))`);
verifier(noms === 'Du cloud|Moka', `récupération : l’animal manquant est ajouté, celui qui existe déjà n’est PAS remplacé par la vieille version du cloud (${noms})`);
verifier(await ev(`localStorage.getItem('carnetpatte.synchro')`) === reglageAvant && !journal.some((j) => j.methode === 'ECRITURE-INTERDITE') && monde.profils.get(U) === 'gratuit', 'la synchronisation n’est PAS activée, rien n’est écrit dans le cloud, le compte reste gratuit');
verifier((await texte('[data-lecture-etat]')).includes('1 élément(s) ajouté(s)'), `message : « ${await texte('[data-lecture-etat]')} »`);
// Export : toujours possible en gratuit
await ev(`window.__fichier = null; URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__fichier = t; }); return 'blob:test'; }; HTMLAnchorElement.prototype.click = function () { window.__nom = this.download; };`);
await ev(`document.querySelector('[data-exporter-compte]').click()`); await dort(1500);
const exp = JSON.parse((await ev(`window.__fichier`)) ?? 'null');
verifier(exp?.donneesCloud?.elements?.some((e) => e.donnees.nom === 'Du cloud'), 'compte gratuit : l’export du compte contient toujours les données du cloud');

// ----- 7f. Suppression du compte : l'abonnement est annulé D'ABORD -----
log('--- 7f. Suppression du compte et abonnement ---');
monde.abonnements.set(U, { user_id: U, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_sup', statut: 'active', resiliation_prevue: false, paiement_echoue: false, fin_periode: new Date(Date.now() + 20 * 86400000).toISOString() });
monde.stripe.abos.set('sub_sup', abo('sub_sup'));
monde.profils.set(U, 'premium');
monde.stripe.echecSuppression = 1;
await ouvrirCompte();
const avantSuppr = journal.length;
await ev(`document.querySelector('[data-supprimer-compte]').click()`); await dort(500);
verifier((await dialogue()).includes('abonnement (annulé chez Stripe') && (await dialogue()).includes('sans nouveau prélèvement'), 'la confirmation annonce que l’abonnement est annulé, sans nouveau prélèvement');
await repondre(true); await dort(2000);
verifier(!monde.supprime && !journal.slice(avantSuppr).some((j) => j.chemin === '/rest/v1/rpc/supprimer_mon_compte') && (await texte('.cp-notifs')).includes('PAS été supprimé'), 'Stripe en panne : le compte n’est PAS supprimé (le serveur n’est même pas appelé), message clair : on ne laisse jamais un abonnement facturer un compte supprimé');
await ev(`document.querySelector('[data-supprimer-compte]').click()`); await dort(500);
await repondre(true); await dort(2500);
const suite = journal.slice(avantSuppr).filter((j) => /functions\/v1\/abonnement-annuler|rpc\/supprimer_mon_compte|storage\/v1\/object\/list/.test(j.chemin) && j.methode === 'POST').map((j) => j.chemin.split('/').pop());
verifier(monde.supprime && monde.stripe.abos.get('sub_sup').status === 'canceled' && suite.indexOf('abonnement-annuler') >= 0 && suite.indexOf('abonnement-annuler') < suite.indexOf('supprimer_mon_compte'), `l’abonnement est annulé chez Stripe AVANT la suppression du compte (${suite.join(' → ')})`);
// Sans l'appli : le serveur refuse de supprimer un compte dont l'abonnement est encore actif
monde.supprime = false; monde.abonnements.set(U, { ...monde.abonnements.get(U), statut: 'active' });
const direct = await ev(`import('/js/compte.js').then(async (c) => { const cl = await c.clientSupabase(); const r = await cl.rpc('supprimer_mon_compte'); return r.error?.message ?? null; })`);
verifier(direct === 'abonnement_actif' && !monde.supprime, 'en contournant l’appli (appel direct) : le serveur REFUSE de supprimer un compte dont l’abonnement est actif');

// ----- 7g. Pages légales -----
log('--- 7g. CGV, mentions légales, confidentialité ---');
await aller('#/cgv'); await dort(500);
const cgv = await texte('#contenu');
verifier((await texte('h1')) === 'Conditions générales de vente', 'page « Conditions générales de vente »');
verifier(cgv.includes('2,99 € TTC par mois') && cgv.includes('TVA non applicable, art. 293 B du CGI'), 'prix TTC et « TVA non applicable, art. 293 B du CGI »');
verifier(/mensuel, sans engagement/.test(cgv) && /résilier à tout moment, en quelques clics/.test(cgv) && /fin de la période mensuelle en cours/.test(cgv) && /Rien n'est supprimé/.test(cgv) && cgv.includes('Après la résiliation'), 'durée mensuelle sans engagement, résiliation, et ce qui se passe après (gratuit, rien supprimé)');
verifier(cgv.includes('Droit de rétractation') && cgv.includes('14 jours') && cgv.includes(TEXTE_CONSENTEMENT) && /L\. 221-18/.test(cgv) && /L\. 221-28/.test(cgv), 'droit de rétractation : 14 jours, la case à cocher citée mot pour mot, articles du Code de la consommation');
verifier(/Touko Khady Bernadette/.test(cgv) && /Entrepreneur individuel \(EI\)/.test(cgv) && /13121199700013/.test(cgv) && /contact@carnetpatte\.com/.test(cgv), 'le vendeur : nom, EI, SIRET, contact');
verifier((await texte('[data-champ=adresse]')) === '[à compléter]' && (await texte('[data-champ=mediateur]')) === '[à compléter]' && (await ev(`document.querySelectorAll('.ap-note').length`)) === 2 && cgv.includes('médiateur de la consommation'), 'adresse et médiateur : « [à compléter] » avec l’avertissement (obligatoires avant l’ouverture du paiement)');
verifier(await ev(`!!document.querySelector('a[href="#/mentions"]') && !!document.querySelector('a[href="#/confidentialite"]')`), 'liens vers les mentions légales et la confidentialité');
await controler('CGV à 375 px'); await axe('#contenu', 'CGV'); await ecran('cgv');
await ev(`import('/modules/apropos/apropos.js').then((m) => m.rendreCgv(document.querySelector('#contenu > div'), { nom: 'Jeanne <b>Martin</b>', statut: 'EI', siret: '12345678900012', email: 'contact@exemple.fr', adresse: '1 rue des Lilas, 35000 Rennes', mediateur: 'Médiateur X, www.mediateur.example' }))`);
verifier(await ev(`document.querySelectorAll('.ap-note').length`) === 0 && (await texte('[data-champ=adresse]')).includes('1 rue des Lilas') && (await texte('[data-champ=mediateur]')).includes('Médiateur X') && await ev(`!document.querySelector('[data-champ=nom] b')`), 'adresse et médiateur renseignés : les avertissements disparaissent, le texte saisi est protégé');
await aller('#/mentions'); await dort(500);
verifier(await ev(`!!document.querySelector('[aria-labelledby=ml-cgv] a[href="#/cgv"]')`) && (await texte('[data-champ=adresse]')) === '[à compléter]', 'mentions légales : lien vers les CGV, champ adresse prévu (« [à compléter] »)');
await aller('#/confidentialite'); await dort(500);
const conf = await texte('#contenu');
verifier(conf.includes('Stripe') && conf.includes('Abonnement Premium et paiement') && /ne voit et ne garde jamais votre numéro de carte/.test(conf) && conf.includes('annulé chez Stripe') && conf.includes('10 ans') && await ev(`!!document.querySelector('a[href="#/cgv"]')`), 'confidentialité : Stripe traite le paiement, jamais le numéro de carte, ce qui est gardé, durée, annulation à la suppression du compte, lien vers les CGV');
await controler('Confidentialité à 375 px'); await axe('#contenu', 'confidentialité');

// ============================ 8. Script SQL, fonctions, secrets ============================
log('--- 8. SQL, configuration, secrets ---');
const sql = fs.readFileSync(path.join(RACINE, 'supabase/etape4.sql'), 'utf8').replace(/--.*$/gm, '');
verifier(['abonnements', 'evenements_stripe'].every((t) => new RegExp(`alter table public[.]${t} +enable row level security`).test(sql)) && !/create policy/i.test(sql), 'etape4.sql : RLS activée sur les deux tables, AUCUNE règle (personne n’y accède, hors service_role)');
verifier(/revoke all on public\.abonnements\s+from public, anon, authenticated/.test(sql) && /revoke all on public\.evenements_stripe\s+from public, anon, authenticated/.test(sql) && !/grant[^;]*\b(anon|authenticated)\b[^;]*on public\.(abonnements|evenements_stripe)/i.test(sql) && /grant select, insert, update on public\.abonnements\s+to service_role/.test(sql), 'droits explicites : rien pour anon ni authenticated sur ces tables ; service_role reçoit les siens (« Grant API access automatically » est décoché)');
verifier(/revoke execute on function public\.appliquer_abonnement\([^)]*\) from public, anon, authenticated/.test(sql) && /grant\s+execute on function public\.appliquer_abonnement\([^)]*\) to service_role/.test(sql) && !/grant\s+execute on function public\.appliquer_abonnement\([^)]*\) to authenticated/.test(sql), 'appliquer_abonnement : exécutable par service_role SEULEMENT');
verifier((sql.match(/update public\.profils set plan/g) ?? []).length === 1 && /update public\.profils set plan = case when p_statut in \('active', 'trialing', 'past_due'\) then 'premium' else 'gratuit' end where id = p_user/.test(sql), 'la formule ne change qu’à un seul endroit du SQL : appliquer_abonnement (active, essai, en retard = premium ; le reste = gratuit)');
verifier(/insert into public\.evenements_stripe[^;]*on conflict \(id\) do nothing/.test(sql) && /return 'doublon'/.test(sql), 'un événement Stripe n’est jamais traité deux fois (idempotence, dans la même transaction)');
verifier(/to_jsonb\(a\)/.test(sql) && !/stripe_(customer|subscription)_id[^;]*from public\.abonnements where user_id = \(select auth\.uid\(\)\)/.test(sql.split('mon_abonnement')[1]?.split('$$;')[0] ?? ''), 'mon_abonnement ne renvoie jamais les identifiants Stripe (seulement l’état)');
verifier(/'abonnement_actif'/.test(sql) && /statut in \('trialing', 'active', 'past_due', 'unpaid', 'paused'\)/.test(sql) && /'fichiers_restants'/.test(sql), 'supprimer_mon_compte refuse tant que l’abonnement est actif, et garde le contrôle des fichiers de l’étape 3');
verifier(!/service_role_key|sk_(test|live)_|whsec_/i.test(sql), 'aucune clé dans le script SQL');
const config = fs.readFileSync(path.join(RACINE, 'supabase/config.toml'), 'utf8');
verifier(['stripe-webhook', 'stripe-checkout', 'stripe-portail', 'abonnement-annuler'].every((f) => new RegExp(`\\[functions\\.${f}\\]\\s+verify_jwt = false`).test(config)) && fs.existsSync(path.join(RACINE, 'supabase/functions/stripe-webhook/index.ts')), 'config.toml : les 4 fonctions (le webhook de Stripe n’envoie pas de jeton Supabase ; les autres vérifient le jeton elles-mêmes)');
for (const f of ['stripe-webhook', 'stripe-checkout', 'stripe-portail', 'abonnement-annuler']) verifier(/Deno\.serve\(servir\(/.test(fs.readFileSync(path.join(RACINE, `supabase/functions/${f}/index.ts`), 'utf8')), `fonction ${f} : branchée sur le code testé ici`);
verifier(fs.existsSync(path.join(RACINE, 'supabase/verifier-etape4.sql')) && /where schemaname = 'public' and tablename in \('abonnements', 'evenements_stripe'\)/.test(fs.readFileSync(path.join(RACINE, 'supabase/verifier-etape4.sql'), 'utf8')), 'verifier-etape4.sql présent');
// Aucune clé secrète et aucune adresse personnelle dans le dépôt (il est public)
const suivis = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RACINE, encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
  .filter((f) => !/^(tests\/sortie|donnees\/|assets\/)/.test(f) && /\.(js|mjs|ts|json|md|sql|toml|html|css|yml|yaml|txt|webmanifest)$/.test(f));
const motifs = /(sk|rk|pk)_(test|live)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}|sbp_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|postgres(ql)?:\/\/[^\s'"]+:[^\s'"]+@/;
const fuites = suivis.filter((f) => motifs.test(fs.readFileSync(path.join(RACINE, f), 'utf8'))).map((f) => f);
verifier(fuites.length === 0, `aucune clé secrète (Stripe sk_/whsec_, Supabase, mot de passe de base) dans les ${suivis.length} fichiers du dépôt${fuites.length ? ` → ${fuites.join(', ')}` : ''}`);
const perso = suivis.filter((f) => /^(supabase\/|ABONNEMENT\.md|js\/|modules\/)/.test(f) && /gmail\.com|outlook\.|hotmail\./i.test(fs.readFileSync(path.join(RACINE, f), 'utf8')));
verifier(perso.length === 0, `aucune adresse e-mail personnelle dans l’abonnement (supabase/, ABONNEMENT.md, js/, modules/) : COMPTES_TEST se règle dans Supabase${perso.length ? ` → ${perso.join(', ')}` : ''}`);
const gi = fs.readFileSync(path.join(RACINE, '.gitignore'), 'utf8');
verifier(/^\.env$/m.test(gi) && /^\*\.env$/m.test(gi) && /^stripe\.env$/m.test(gi), '.gitignore : les fichiers .env (secrets) ne peuvent pas être publiés par erreur');
const guide = fs.readFileSync(path.join(RACINE, 'ABONNEMENT.md'), 'utf8');
const section = guide.split('## Avant le passage en réel')[1] ?? '';
verifier(['Adresse du vendeur', 'Médiateur de la consommation', 'CGV relues', 'Supabase Pro', 'Activation du compte Stripe', 'SIRET, IBAN, pièce d\'identité', 'PAIEMENT_OUVERT=oui'].every((m) => section.includes(m)) && (section.match(/- \[ \]/g) ?? []).length >= 9, 'ABONNEMENT.md : checklist « Avant le passage en réel » (adresse, médiateur, CGV relues, Supabase Pro, activation Stripe avec SIRET, IBAN et pièce d’identité, PAIEMENT_OUVERT=oui…)');
verifier(['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'SITE_URLS', 'COMPTES_TEST', 'checkout.session.completed', 'invoice.payment_failed', 'customer.subscription.deleted', '4242 4242 4242 4242', 'art. 293 B du CGI', 'Cancel subscriptions'].every((m) => guide.includes(m)), 'ABONNEMENT.md : produit, prix, portail, secrets, webhook (5 événements), carte de test, mentions de facture');

faux.close(); site.close(); faux.closeAllConnections(); site.closeAllConnections();
fin(true);
