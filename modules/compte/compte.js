// Page « Compte » (essai) : connexion par code à 6 chiffres reçu par e-mail, sans mot de passe. Facultatif : l'appli marche sans compte.
// Étape 0 du plan : vérifier que la connexion tient dans l'appli installée sur l'iPhone (la session doit survivre à la fermeture de l'appli).

import * as compte from '../../js/compte.js';
import { echapper } from '../../js/utils.js';
import { toast, confirmer } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, champ, alerte } from '../../js/composants.js';

const RENVOI_SECONDES = 60;
const modeAffichage = () => (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches ? "appli installée (écran d'accueil)" : 'navigateur (Safari)');
const heure = (ms) => new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const depuis = (ms) => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? "moins d'une minute" : m < 120 ? `${m} min` : `${Math.round(m / 60)} h`; };

export async function rendre(zone) {
  zone.classList.add('page-large');
  const entete = `
    <a class="pg-lien fi-retour" href="#/profil">${icone('arrow-left', { taille: 18 })} Profil</a>
    <header class="pg-entete"><h1 tabindex="-1">Compte</h1>
      <p>Un compte est <strong>facultatif</strong> : tout Carnet Patte marche sans, avec vos données sur cet appareil. Cet écran est un essai de connexion, sans mot de passe.</p></header>`;
  if (!compte.estConfigure()) {
    zone.innerHTML = `<div class="cp pg cm-page">${entete}${alerte({ type: 'info', titre: 'Pas encore activé', texte: "Les comptes ne sont pas encore activés sur ce site. Vos données restent sur cet appareil, comme d'habitude." })}</div>`;
    return;
  }
  zone.innerHTML = `<div class="cp pg cm-page">${entete}<div data-cadre class="cm-cadre"><p class="cp-doux" role="status">Vérification de la session…</p></div></div>`;
  const cadre = zone.querySelector('[data-cadre]');
  let courant = null;
  try { courant = await compte.utilisateur(); } catch (e) { courant = null; }
  if (!zone.isConnected) return;
  if (courant) vueConnecte(cadre, zone, courant); else vueEmail(cadre, zone);
}

function vueEmail(cadre, zone, emailInitial = '') {
  cadre.innerHTML = `
    <form class="cp-carte cm-form" novalidate data-etape="email">
      <h2>Se connecter</h2>
      <p class="cp-doux">Saisissez votre adresse e-mail : vous recevrez un code à 6 chiffres. Pas de mot de passe. Un compte est créé à la première connexion. Seule votre adresse e-mail est conservée : <a href="#/confidentialite">confidentialité</a>.</p>
      ${champ({ id: 'cm-email', label: 'Adresse e-mail', type: 'email', valeur: emailInitial, requis: true, attrs: { name: 'email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false' } })}
      <div class="cm-actions">${bouton({ texte: 'Recevoir un code', type: 'submit', icone: 'check' })}</div>
    </form>`;
  const form = cadre.querySelector('form');
  const champEmail = form.querySelector('#cm-email');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = champEmail.value.trim();
    erreurSous(champEmail, '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { erreurSous(champEmail, 'Saisissez une adresse e-mail valide (ex. : nom@exemple.fr).'); champEmail.focus(); return; }
    const valider = form.querySelector('[type=submit]');
    valider.disabled = true;
    try {
      await compte.envoyerCode(email);
      vueCode(cadre, zone, email);
    } catch (err) {
      valider.disabled = false;
      erreurSous(champEmail, compte.messageErreur(err));
      champEmail.focus();
    }
  });
}

function vueCode(cadre, zone, email) {
  cadre.innerHTML = `
    <form class="cp-carte cm-form" novalidate data-etape="code">
      <h2>Saisissez le code</h2>
      <p>Un code à 6 chiffres vient d'être envoyé à <strong>${echapper(email)}</strong>. Il arrive en quelques secondes (pensez aux indésirables).</p>
      ${champ({ id: 'cm-code', label: 'Code à 6 chiffres', valeur: '', requis: true, attrs: { name: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, pattern: '[0-9]{6}', autocapitalize: 'none' } })}
      <div class="cm-actions">
        ${bouton({ texte: 'Valider', type: 'submit', icone: 'check' })}
        ${bouton({ texte: 'Renvoyer le code', variante: 'secondaire', desactive: true, attrs: { 'data-renvoyer': true } })}
        ${bouton({ texte: "Changer d'adresse", variante: 'discret', attrs: { 'data-changer': true } })}
      </div>
    </form>`;
  const form = cadre.querySelector('form');
  const champCode = form.querySelector('#cm-code');
  const renvoyer = form.querySelector('[data-renvoyer]');
  champCode.focus();
  let reste = RENVOI_SECONDES;
  const minuteur = setInterval(() => {
    if (!form.isConnected) { clearInterval(minuteur); return; }
    reste -= 1;
    renvoyer.disabled = reste > 0;
    renvoyer.querySelector('span').textContent = reste > 0 ? `Renvoyer le code (${reste} s)` : 'Renvoyer le code';
  }, 1000);
  renvoyer.querySelector('span').textContent = `Renvoyer le code (${reste} s)`;
  renvoyer.addEventListener('click', async () => {
    renvoyer.disabled = true; reste = RENVOI_SECONDES;
    try { await compte.envoyerCode(email); toast('Nouveau code envoyé'); } catch (err) { erreurSous(champCode, compte.messageErreur(err)); }
  });
  form.querySelector('[data-changer]').addEventListener('click', () => { clearInterval(minuteur); vueEmail(cadre, zone, email); });
  champCode.addEventListener('input', () => { champCode.value = champCode.value.replace(/\D/g, '').slice(0, 6); erreurSous(champCode, ''); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = champCode.value.trim();
    erreurSous(champCode, '');
    if (!/^\d{6}$/.test(code)) { erreurSous(champCode, 'Le code a 6 chiffres.'); champCode.focus(); return; }
    const valider = form.querySelector('[type=submit]');
    valider.disabled = true;
    try {
      await compte.verifierCode(email, code);
      clearInterval(minuteur);
      toast('Connecté');
      vueConnecte(cadre, zone, await compte.utilisateur());
    } catch (err) {
      valider.disabled = false;
      erreurSous(champCode, compte.messageErreur(err));
      champCode.focus();
    }
  });
}

function vueConnecte(cadre, zone, u) {
  cadre.innerHTML = `
    <section class="cp-carte cm-form" data-etape="connecte" aria-labelledby="cm-connecte">
      <h2 id="cm-connecte">Connecté</h2>
      <p>Vous êtes connecté avec <strong data-email>${echapper(u.email)}</strong>.</p>
      <p class="cp-doux">Se connecter ne change rien d'autre : vos animaux restent sur cet appareil, et rien n'est envoyé. La sauvegarde et la synchronisation seront réservées à la formule Premium.</p>
      <div class="cm-actions">${bouton({ texte: 'Se déconnecter', variante: 'secondaire', icone: 'x', attrs: { 'data-deconnecter': true } })}</div>
    </section>
    <section class="cp-carte cm-form" aria-labelledby="cm-premium" data-premium>
      <h2 id="cm-premium">Premium : sauvegarde cloud et synchronisation</h2>
      <p>Retrouver vos animaux sur plusieurs appareils, avec une sauvegarde automatique : <strong>pas encore disponible</strong>. Cette option sera réservée à la formule Premium. Le reste de l'appli reste gratuit.</p>
      <p class="cp-doux" data-formule role="status">Formule : vérification…</p>
      <p class="cp-doux" data-attente-etat role="status"></p>
      <div class="cm-actions">${bouton({ texte: "Me prévenir à l'ouverture", icone: 'bell', desactive: true, attrs: { 'data-attente': true } })}</div>
    </section>
    <section class="cp-carte cm-form" aria-labelledby="cm-donnees" data-donnees>
      <h2 id="cm-donnees">Vos données et votre vie privée</h2>
      <p>Le serveur ne garde que votre adresse e-mail, la date de création du compte, votre formule et votre éventuelle inscription à la liste d'attente. <a href="#/confidentialite">Lire la politique de confidentialité</a>.</p>
      <div class="cm-actions">
        ${bouton({ texte: 'Télécharger les données de mon compte', variante: 'secondaire', icone: 'download', attrs: { 'data-exporter-compte': true } })}
        ${bouton({ texte: 'Supprimer mon compte', variante: 'danger', icone: 'trash-2', attrs: { 'data-supprimer-compte': true } })}
      </div>
      <p class="cp-doux">Supprimer le compte efface définitivement ces informations sur le serveur. Vos animaux, sur cet appareil, ne sont pas touchés.</p>
    </section>
    <section class="cp-carte cm-essai" aria-labelledby="cm-essai-titre" data-essai>
      <h2 id="cm-essai-titre">Essai : la connexion tient-elle ?</h2>
      <dl class="ap-dl">
        <div><dt>Ouvert dans</dt><dd data-mode>${echapper(modeAffichage())}</dd></div>
        <div><dt>Connecté depuis</dt><dd data-depuis>${u.connecteLe ? `${echapper(heure(u.connecteLe))} (il y a ${echapper(depuis(u.connecteLe))})` : 'inconnu'}</dd></div>
        <div><dt>Session valable jusqu'au</dt><dd data-expire>${u.expireLe ? echapper(heure(u.expireLe)) : 'inconnu'} <span class="cp-doux">(elle se renouvelle toute seule)</span></dd></div>
      </dl>
      <p class="cp-doux">À tester : fermez l'appli complètement, rouvrez-la 1 minute plus tard, puis le lendemain : vous devez toujours être connecté, sans redemander de code.</p>
    </section>`;
  cadre.querySelector('[data-deconnecter]').addEventListener('click', async () => {
    await compte.deconnecter();
    toast('Déconnecté de cet appareil');
    vueEmail(cadre, zone);
  });
  brancherPremium(cadre);
  brancherDonnees(cadre, zone);
}

/** Formule et liste d'attente Premium (lues au serveur : hors connexion, on l'explique sans bloquer le reste de la page). */
async function brancherPremium(cadre) {
  const formule = cadre.querySelector('[data-formule]');
  const etat = cadre.querySelector('[data-attente-etat]');
  const btn = cadre.querySelector('[data-attente]');
  const texteBouton = (t) => { btn.querySelector('span').textContent = t; };
  let inscrit = false;
  try {
    const [p, attente] = await Promise.all([compte.profil(), compte.surListeAttente()]);
    if (!cadre.isConnected) return;
    inscrit = attente;
    formule.textContent = `Formule : ${p.plan === 'premium' ? 'Premium' : 'Gratuite'}`;
  } catch (err) {
    if (!cadre.isConnected) return;
    formule.textContent = 'Formule : non disponible pour le moment';
    etat.textContent = compte.messageErreur(err);
    return;
  }
  const afficher = () => { etat.textContent = inscrit ? "Vous êtes sur la liste d'attente : un e-mail vous sera envoyé à l'ouverture, sans engagement." : ''; texteBouton(inscrit ? "Me retirer de la liste d'attente" : "Me prévenir à l'ouverture"); btn.disabled = false; };
  afficher();
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try { await compte.changerListeAttente(!inscrit); inscrit = !inscrit; toast(inscrit ? "Inscrit sur la liste d'attente" : "Retiré de la liste d'attente"); } catch (err) { etat.textContent = compte.messageErreur(err); }
    btn.disabled = false; afficher();
  });
}

/** Export des données du compte (fichier JSON) et suppression du compte. */
function brancherDonnees(cadre, zone) {
  cadre.querySelector('[data-exporter-compte]').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const donnees = await compte.exporterMesDonnees();
      const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = `carnet-patte-compte-${new Date().toISOString().slice(0, 10)}.json`;
      lien.click();
      setTimeout(() => URL.revokeObjectURL(lien.href), 60000);
      toast('Données du compte téléchargées');
    } catch (err) { toast(compte.messageErreur(err), 'erreur'); }
    b.disabled = false;
  });
  cadre.querySelector('[data-supprimer-compte]').addEventListener('click', async (e) => {
    const b = e.currentTarget; // à garder avant le « await » : l'événement n'a plus de cible ensuite
    if (!await confirmer('Supprimer définitivement votre compte ? Votre adresse e-mail et vos inscriptions seront effacées du serveur, sans retour possible. Vos animaux, sur cet appareil, ne sont pas touchés.', 'Supprimer mon compte')) return;
    b.disabled = true;
    try {
      await compte.supprimerMonCompte();
      toast('Compte supprimé');
      vueEmail(cadre, zone);
    } catch (err) { b.disabled = false; toast(compte.messageErreur(err), 'erreur'); }
  });
}

/** Message d'erreur sous un champ, relié au champ pour les lecteurs d'écran. */
function erreurSous(input, message) {
  const bloc = input.closest('.cp-champ');
  bloc.querySelector('.cp-champ__erreur')?.remove();
  if (!message) { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); return; }
  const id = `${input.id}-erreur`;
  bloc.insertAdjacentHTML('beforeend', `<p class="cp-champ__erreur" id="${id}">${icone('circle-alert', { taille: 16 })}<span>${echapper(message)}</span></p>`);
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', id);
}
