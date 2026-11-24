// Parler à Supabase depuis une Edge Function, avec `fetch` seulement (comme stripe.js : aucune dépendance).
// La clé « service_role » (SUPABASE_SERVICE_ROLE_KEY) est fournie AUTOMATIQUEMENT aux Edge Functions par Supabase : on ne la copie nulle part.
// Elle contourne les règles RLS : elle n'est utilisée qu'ici, côté serveur, pour les tables que l'appli ne peut ni lire ni écrire (abonnements, évenements Stripe).

const ACTIFS = ['trialing', 'active', 'past_due', 'unpaid', 'paused'];
export const abonnementActif = (a) => !!a && ACTIFS.includes(a.statut);

/** La personne connectée, d'après son jeton de session (en-tête « Authorization: Bearer … »). null si le jeton est absent ou invalide. */
export function creerAuth({ url, cleService, fetchImpl = globalThis.fetch }) {
  return {
    async utilisateur(entete) {
      const jeton = /^Bearer\s+(.+)$/i.exec(entete ?? '')?.[1];
      if (!jeton) return null;
      const r = await fetchImpl(`${url}/auth/v1/user`, { headers: { apikey: cleService, Authorization: `Bearer ${jeton}` } });
      if (!r.ok) return null;
      const u = await r.json().catch(() => null);
      return u?.id ? { id: u.id, email: u.email ?? '' } : null;
    },
  };
}

/** L'accès aux tables serveur (abonnements) et à la fonction SQL qui applique un changement de formule. */
export function creerDb({ url, cleService, fetchImpl = globalThis.fetch }) {
  const entetes = { apikey: cleService, Authorization: `Bearer ${cleService}`, 'Content-Type': 'application/json' };
  const appel = async (chemin, options = {}) => {
    const r = await fetchImpl(`${url}/rest/v1/${chemin}`, { ...options, headers: { ...entetes, ...(options.headers ?? {}) } });
    const texte = await r.text();
    if (!r.ok) throw new Error(`Supabase ${r.status} : ${texte.slice(0, 200)}`);
    return texte ? JSON.parse(texte) : null;
  };
  return {
    async abonnementDe(userId) {
      const l = await appel(`abonnements?user_id=eq.${encodeURIComponent(userId)}&select=*`);
      return l?.[0] ?? null;
    },
    async abonnementDuClient(clientId) {
      const l = await appel(`abonnements?stripe_customer_id=eq.${encodeURIComponent(clientId)}&select=*`);
      return l?.[0] ?? null;
    },
    /** Garde le client Stripe de la personne, et la preuve de son consentement (accès immédiat, perte du droit de rétractation). */
    async enregistrerClient({ userId, clientId, consentementTexte, consentementLe }) {
      await appel('abonnements?on_conflict=user_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: userId, stripe_customer_id: clientId, consentement_texte: consentementTexte, consentement_le: consentementLe, maj_le: new Date().toISOString() }),
      });
    },
    async marquerAnnule(userId) {
      await appel(`abonnements?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ statut: 'canceled', resiliation_prevue: false, paiement_echoue: false, maj_le: new Date().toISOString() }),
      });
    },
    /** Applique l'état d'un abonnement ET met à jour la formule, en une seule opération SQL (supabase/etape4.sql). Retourne 'applique' | 'doublon' | 'inconnu'. */
    async appliquer(p) {
      return appel('rpc/appliquer_abonnement', {
        method: 'POST',
        body: JSON.stringify({ p_evenement: p.evenementId, p_type: p.type, p_user: p.userId, p_client: p.clientId, p_abonnement: p.abonnementId, p_statut: p.statut, p_fin: p.finPeriode, p_resiliation: p.resiliationPrevue, p_echec: p.paiementEchoue }),
      });
    },
  };
}
