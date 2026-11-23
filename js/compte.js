// Compte facultatif (Supabase) : connexion par code à 6 chiffres reçu par e-mail, sans mot de passe.
// L'appli reste 100 % utilisable SANS compte : rien de ce fichier ne se charge tant qu'on n'ouvre pas la page « Compte », et la bibliothèque
// Supabase (assets/supabase/, licence MIT) n'est téléchargée qu'à ce moment-là. Les données des animaux ne sont ni lues ni envoyées ici.
//
// Étape 0 : connexion, session conservée, déconnexion. Étape 2 : profil, liste d'attente Premium, export des données du compte, suppression du compte
// (tables et règles : supabase/etape2.sql). La synchronisation des animaux (Premium) viendra ensuite : aujourd'hui, AUCUNE donnée d'animal ne part de l'appareil.

import { SUPABASE } from './supabase-config.js';

let config = SUPABASE;
let promesseClient = null;
const CLE_SESSION = 'carnetpatte.compte'; // où le navigateur garde la session (localStorage de l'appareil)
const CLE_ESSAI = 'carnetpatte.compteEssai'; // quand la connexion a eu lieu (pour l'essai de faisabilité sur iPhone)

/** Remplace la configuration (pour les tests, avec un faux serveur). */
export function utiliserConfig(c) { config = c; promesseClient = null; }

/** Les deux valeurs sont-elles renseignées ? (adresse https://….supabase.co, ou un serveur local de test) */
export const estConfigure = () => /^(https:\/\/[a-z0-9-]+\.supabase\.co|http:\/\/(127\.0\.0\.1|localhost):\d+)$/i.test(config.url ?? '') && (config.cle ?? '').length >= 20;

function chargerBibliotheque() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = new URL('../assets/supabase/supabase.js', import.meta.url).href;
    s.onload = () => (globalThis.supabase?.createClient ? ok(globalThis.supabase) : ko(new Error('bibliothèque illisible')));
    s.onerror = () => ko(new Error('hors connexion'));
    document.head.append(s);
  });
}

/** Le client Supabase (créé à la demande). Lève une erreur si le compte n'est pas configuré. */
async function client() {
  if (!estConfigure()) throw new Error('non configuré');
  promesseClient ??= chargerBibliotheque().then((lib) => lib.createClient(config.url, config.cle, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: CLE_SESSION },
  })).catch((e) => { promesseClient = null; throw e; });
  return promesseClient;
}

/** Une erreur de Supabase ou du réseau, en français et sans jargon. */
export function messageErreur(e) {
  const code = String(e?.code ?? e?.error_code ?? '');
  const texte = String(e?.message ?? e?.msg ?? '');
  const statut = Number(e?.status ?? 0);
  if (/hors connexion|fetch|network|AuthRetryableFetchError|Failed to load/i.test(`${e?.name} ${texte}`) || statut === 0 && /fetch/i.test(texte)) return "Pas de connexion à internet : se connecter à un compte en a besoin. L'appli reste utilisable sans compte.";
  if (statut === 429 || /rate_limit|rate limit/i.test(`${code} ${texte}`)) return 'Trop de codes demandés. Patientez quelques minutes, puis réessayez.';
  if (/otp_expired|expired|invalid/i.test(`${code} ${texte}`) && !/email address|format/i.test(texte)) return 'Code incorrect ou expiré. Vérifiez les 6 chiffres, ou demandez un nouveau code.';
  if (/validation_failed|email address|format/i.test(`${code} ${texte}`)) return 'Cette adresse e-mail ne semble pas valide.';
  if (/non configuré/.test(texte)) return "Les comptes ne sont pas encore activés sur ce site.";
  if (/PGRST20[245]|42P01|42883|schema cache|does not exist/i.test(`${code} ${texte}`)) return "Cette fonction du compte n'est pas encore prête côté serveur. Réessayez plus tard.";
  return "Une erreur est survenue. Réessayez dans un instant.";
}

/** Envoie un code à 6 chiffres à cette adresse (crée le compte à la première connexion). */
export async function envoyerCode(email) {
  const { error } = await (await client()).auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

/** Vérifie le code ; en cas de succès la session est gardée sur l'appareil. */
export async function verifierCode(email, code) {
  const { data, error } = await (await client()).auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw error;
  try { localStorage.setItem(CLE_ESSAI, JSON.stringify({ le: Date.now() })); } catch { /* stockage bloqué : l'essai de persistance n'aura pas son horodatage */ }
  window.dispatchEvent(new Event('compte-modifie'));
  return data.session;
}

/** { email, id, expireLe (ms), connecteLe (ms ou null) } ou null. Ne contacte pas internet si la session est valide sur l'appareil. */
export async function utilisateur() {
  if (!estConfigure() || !localStorage.getItem(CLE_SESSION)) return null; // jamais connecté : on ne charge même pas la bibliothèque
  const { data } = await (await client()).auth.getSession();
  const s = data?.session;
  if (!s) return null;
  let connecteLe = null;
  try { connecteLe = JSON.parse(localStorage.getItem(CLE_ESSAI))?.le ?? null; } catch { /* absent */ }
  return { email: s.user.email, id: s.user.id, expireLe: (s.expires_at ?? 0) * 1000, connecteLe, creeLe: s.user.created_at ?? null, derniereConnexion: s.user.last_sign_in_at ?? null };
}

/** Se déconnecte de CET appareil (les données des animaux ne sont pas touchées). */
export async function deconnecter() {
  try { await (await client()).auth.signOut({ scope: 'local' }); } catch { /* hors connexion : on efface quand même la session locale */ }
  try { localStorage.removeItem(CLE_SESSION); localStorage.removeItem(CLE_ESSAI); } catch { /* stockage bloqué */ }
  window.dispatchEvent(new Event('compte-modifie'));
}

async function moi() {
  const u = await utilisateur();
  if (!u) throw new Error('non connecté');
  return u;
}

/** Le profil du compte : { plan: 'gratuit' | 'premium', creeLe } (ligne créée par le serveur à la création du compte). */
export async function profil() {
  await moi();
  const { data, error } = await (await client()).from('profils').select('plan, cree_le').maybeSingle();
  if (error) throw error;
  return { plan: data?.plan ?? 'gratuit', creeLe: data?.cree_le ?? null };
}

/** Cette personne est-elle sur la liste d'attente Premium ? */
export async function surListeAttente() {
  const u = await moi();
  const { data, error } = await (await client()).from('liste_attente_premium').select('user_id').eq('user_id', u.id).maybeSingle();
  if (error) throw error;
  return !!data;
}

/** S'inscrit (ou se retire) de la liste d'attente Premium : la sauvegarde cloud et la synchro n'existent pas encore. */
export async function changerListeAttente(inscrire) {
  const u = await moi();
  const table = (await client()).from('liste_attente_premium');
  const { error } = inscrire ? await table.upsert({ user_id: u.id }, { onConflict: 'user_id', ignoreDuplicates: true }) : await table.delete().eq('user_id', u.id);
  if (error) throw error;
}

/** Toutes les données que le serveur détient sur ce compte (droit d'accès et de portabilité). Les animaux n'y sont pas : ils ne quittent pas l'appareil. */
export async function exporterMesDonnees() {
  const u = await moi();
  const [p, attente] = await Promise.all([profil(), surListeAttente()]);
  return {
    exporteLe: new Date().toISOString(),
    compte: { identifiant: u.id, email: u.email, creeLe: u.creeLe, derniereConnexion: u.derniereConnexion },
    profil: { formule: p.plan, creeLe: p.creeLe },
    listeAttentePremium: attente,
    remarque: "Vos animaux, soins, pesées et documents ne sont pas stockés sur nos serveurs : ils restent sur votre appareil (menu Sauvegarde pour les exporter).",
  };
}

/** Supprime DÉFINITIVEMENT le compte et ses données sur le serveur, puis la session de cet appareil. Les animaux de l'appareil ne sont pas touchés. */
export async function supprimerMonCompte() {
  await moi();
  const { error } = await (await client()).rpc('supprimer_mon_compte');
  if (error) throw error;
  await deconnecter();
}
