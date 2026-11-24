// Stripe, sans bibliothèque : l'API REST de Stripe avec `fetch`, et la vérification de la signature des webhooks.
// Aucune dépendance : le même code tourne dans une Edge Function Supabase (Deno) et dans les tests (Node), avec de vraies signatures.
// La clé secrète (sk_test_… / sk_live_…) et le secret du webhook (whsec_…) viennent des SECRETS Supabase : jamais d'ici, jamais du dépôt (qui est public).

export class ErreurStripe extends Error {
  constructor(statut, corps) {
    super(corps?.error?.message ?? `Stripe : erreur ${statut}`);
    this.statut = statut;
    this.code = corps?.error?.code ?? '';
    this.type = corps?.error?.type ?? '';
  }
}

/** Les paramètres d'une requête Stripe : objets et listes imbriqués → « a[b][0][c]=valeur » (format des formulaires de Stripe). */
export function encoderFormulaire(valeur, prefixe = '', sortie = []) {
  if (valeur === undefined || valeur === null) return sortie;
  if (Array.isArray(valeur)) valeur.forEach((v, i) => encoderFormulaire(v, `${prefixe}[${i}]`, sortie));
  else if (typeof valeur === 'object') for (const [k, v] of Object.entries(valeur)) encoderFormulaire(v, prefixe ? `${prefixe}[${k}]` : k, sortie);
  else sortie.push(`${encodeURIComponent(prefixe)}=${encodeURIComponent(String(valeur))}`);
  return sortie;
}

/** Un client pour l'API Stripe. `cle` : la clé secrète. `fetchImpl` : pour les tests. */
export function clientStripe({ cle, fetchImpl = globalThis.fetch, base = 'https://api.stripe.com' }) {
  if (!cle) throw new Error('clé Stripe absente');
  return {
    async appeler(methode, chemin, params = {}) {
      const corps = encoderFormulaire(params).join('&');
      const get = methode === 'GET' || methode === 'DELETE';
      const reponse = await fetchImpl(`${base}${chemin}${get && corps ? `?${corps}` : ''}`, {
        method: methode,
        headers: { Authorization: `Bearer ${cle}`, ...(get ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }) },
        ...(get ? {} : { body: corps }),
      });
      const json = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new ErreurStripe(reponse.status, json);
      return json;
    },
  };
}

const encodeur = new TextEncoder();
const hex = (octets) => [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, '0')).join('');

/** HMAC-SHA256 (hexadécimal) d'un texte avec un secret. */
export async function hmacHex(secret, texte) {
  const cle = await crypto.subtle.importKey('raw', encodeur.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', cle, encodeur.encode(texte)));
}

/** Comparaison en temps constant (une signature ne doit pas se deviner caractère par caractère). */
function egal(a, b) {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i++) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
}

/**
 * Vérifie l'en-tête « Stripe-Signature » (t=horodatage, v1=signature) : HMAC-SHA256 de « horodatage.corps » avec le secret du webhook.
 * Refuse si la signature est fausse, absente, ou si l'horodatage est trop ancien (rejeu). Retourne true ou lève une erreur.
 * `corps` : le texte EXACT reçu (sans le relire ni le reformater).
 */
export async function verifierSignature({ corps, entete, secret, tolerance = 300, maintenant = Math.floor(Date.now() / 1000) }) {
  if (!secret) throw new Error('secret du webhook absent');
  if (!entete) throw new Error('signature absente');
  const morceaux = entete.split(',').map((p) => p.trim().split('='));
  const t = Number(morceaux.find(([k]) => k === 't')?.[1]);
  const signatures = morceaux.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !signatures.length) throw new Error('signature illisible');
  if (Math.abs(maintenant - t) > tolerance) throw new Error('signature périmée');
  const attendue = await hmacHex(secret, `${t}.${corps}`);
  if (!signatures.some((s) => egal(s, attendue))) throw new Error('signature incorrecte');
  return true;
}
