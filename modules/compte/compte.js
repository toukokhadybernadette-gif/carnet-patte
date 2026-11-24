// Page « Compte » : connexion par code à 6 chiffres reçu par e-mail, sans mot de passe. Facultatif : l'appli marche sans compte.

import * as compte from '../../js/compte.js';
import { echapper } from '../../js/utils.js';
import { toast, confirmer } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, champ, alerte, confirmer as demander } from '../../js/composants.js';

const RENVOI_SECONDES = 60;

export async function rendre(zone) {
  zone.classList.add('page-large');
  const entete = `
    <a class="pg-lien fi-retour" href="#/profil">${icone('arrow-left', { taille: 18 })} Profil</a>
    <header class="pg-entete"><h1 tabindex="-1">Compte</h1>
      <p>Un compte est <strong>facultatif</strong> : tout Carnet Patte marche sans, avec vos données sur cet appareil. La connexion se fait par un code reçu par e-mail, sans mot de passe.</p></header>`;
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
      <p class="cp-doux" data-connecte-texte>Vos animaux restent d'abord sur cet appareil.</p>
      <div class="cm-actions">${bouton({ texte: 'Se déconnecter', variante: 'secondaire', icone: 'x', attrs: { 'data-deconnecter': true } })}</div>
    </section>
    <section class="cp-carte cm-form" aria-labelledby="cm-premium" data-premium>
      <h2 id="cm-premium">Premium : sauvegarde cloud et synchronisation</h2>
      <p>Retrouver vos animaux sur plusieurs appareils, avec une sauvegarde automatique : <strong>pas encore disponible</strong>. Cette option sera réservée à la formule Premium. Le reste de l'appli reste gratuit.</p>
      <p class="cp-doux" data-formule role="status">Formule : vérification…</p>
      <p class="cp-doux" data-attente-etat role="status"></p>
      <div class="cm-actions">${bouton({ texte: "Me prévenir à l'ouverture", icone: 'bell', desactive: true, attrs: { 'data-attente': true } })}</div>
    </section>
    <section class="cp-carte cm-form" aria-labelledby="cm-cloud" data-cloud hidden>
      <h2 id="cm-cloud">Sauvegarde cloud et synchronisation</h2>
      <p>Formule : <strong>Premium</strong>. Votre carnet (animaux, soins, pesées, documents, photos) est copié dans un espace privé en Europe et retrouvé sur vos autres appareils. L'appli reste utilisable hors ligne : tout s'enregistre d'abord sur l'appareil.</p>
      <p data-cloud-etat role="status">Vérification…</p>
      <div class="cm-espace" data-cloud-espace hidden>
        <p class="cp-doux" data-cloud-espace-texte></p>
        <progress max="100" value="0" aria-label="Espace cloud utilisé"></progress>
      </div>
      <div class="cm-actions">
        ${bouton({ texte: 'Activer sur cet appareil', icone: 'check', attrs: { 'data-cloud-activer': true, hidden: true } })}
        ${bouton({ texte: 'Synchroniser maintenant', variante: 'secondaire', icone: 'save', attrs: { 'data-cloud-synchro': true } })}
        ${bouton({ texte: 'Désactiver sur cet appareil', variante: 'discret', attrs: { 'data-cloud-desactiver': true } })}
      </div>
      <ul class="cm-legende" aria-label="Signification du point de couleur en haut de l'écran">
        <li data-etat="ok"><span class="sy-etat__point" aria-hidden="true"></span>Point vert : sauvegardé</li>
        <li data-etat="attente"><span class="sy-etat__point" aria-hidden="true"></span>Point marron : en attente (hors ligne, espace plein ou en pause)</li>
        <li data-etat="erreur"><span class="sy-etat__point" aria-hidden="true"></span>Point rouge : erreur, la sauvegarde sera retentée</li>
      </ul>
      <p class="cp-doux">Désactiver arrête les envois depuis cet appareil, sans rien supprimer. Supprimer votre compte efface aussi tout le cloud. <a href="#/confidentialite">Confidentialité</a>.</p>
    </section>
    <section class="cp-carte cm-form" aria-labelledby="cm-donnees" data-donnees>
      <h2 id="cm-donnees">Vos données et votre vie privée</h2>
      <p>Avec un compte gratuit, le serveur ne garde que votre adresse e-mail, la date de création du compte, votre formule et votre éventuelle inscription à la liste d'attente. Avec la sauvegarde cloud du Premium, il garde aussi votre carnet. <a href="#/confidentialite">Lire la politique de confidentialité</a>.</p>
      <div class="cm-actions">
        ${bouton({ texte: 'Télécharger les données de mon compte', variante: 'secondaire', icone: 'download', attrs: { 'data-exporter-compte': true } })}
        ${bouton({ texte: 'Supprimer mon compte', variante: 'danger', icone: 'trash-2', attrs: { 'data-supprimer-compte': true } })}
      </div>
      <p class="cp-doux">Supprimer le compte efface définitivement ces informations sur le serveur, sauvegarde cloud et fichiers compris. Vos animaux, sur cet appareil, ne sont pas touchés.</p>
    </section>`;
  cadre.querySelector('[data-deconnecter]').addEventListener('click', async () => {
    await compte.deconnecter();
    toast('Déconnecté de cet appareil');
    vueEmail(cadre, zone);
  });
  brancherPremium(cadre);
  brancherDonnees(cadre, zone);
}

/** Le texte du bloc « Connecté » : il dit ce qui est VRAIMENT envoyé, selon la formule et l'activation de la sauvegarde cloud. */
const texteConnecte = (cadre, t) => { const el = cadre.querySelector('[data-connecte-texte]'); if (el) el.textContent = t; };

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
    if (p.plan === 'premium') { cadre.querySelector('[data-premium]').hidden = true; brancherCloud(cadre); return; } // Premium : la liste d'attente n'a plus lieu d'être
    texteConnecte(cadre, "Se connecter ne change rien d'autre : vos animaux restent sur cet appareil, et rien n'est envoyé. La sauvegarde cloud et la synchronisation sont réservées à la formule Premium (pas encore ouverte au public).");
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

const mo = (octets) => `${(octets / 1048576).toFixed(1).replace('.', ',')} Mo`;

/** Sauvegarde cloud (Premium) : état, espace utilisé, activation avec choix, désactivation. Rien n'est effacé sans confirmation. */
async function brancherCloud(cadre) {
  const bloc = cadre.querySelector('[data-cloud]');
  const etatEl = bloc.querySelector('[data-cloud-etat]');
  const btnActiver = bloc.querySelector('[data-cloud-activer]');
  const btnSynchro = bloc.querySelector('[data-cloud-synchro]');
  const btnDesactiver = bloc.querySelector('[data-cloud-desactiver]');
  const espace = bloc.querySelector('[data-cloud-espace]');
  let u; let synchro; let espaceLu = false;
  try { u = await compte.utilisateur(); synchro = await import('../../js/synchro.js'); } catch { return; }
  if (!u || !cadre.isConnected) return;
  bloc.hidden = false;

  const afficher = () => {
    if (!cadre.isConnected) { window.removeEventListener('synchro-etat', afficher); window.removeEventListener('synchro-changee', afficher); return; }
    const r = synchro.reglages();
    const actif = r.actif && r.userId === u.id;
    texteConnecte(cadre, actif
      ? "La sauvegarde cloud est activée sur cet appareil : votre carnet (animaux, soins, pesées, documents, photos) est copié dans votre espace privé et synchronisé avec vos autres appareils."
      : "Vous êtes Premium. Pour l'instant, vos animaux restent sur cet appareil et rien n'est envoyé : activez la sauvegarde cloud ci-dessous pour les retrouver sur vos autres appareils.");
    btnActiver.hidden = actif; btnSynchro.hidden = !actif; btnDesactiver.hidden = !actif;
    if (actif) {
      const e = synchro.etat(); etatEl.textContent = `${synchro.libelleEtat(e.etat) || 'Sauvegarde cloud activée'}${e.message ? ` : ${e.message}` : ''}`;
      if (!espaceLu) { espaceLu = true; majEspace(); }
    }
    else { espace.hidden = true; etatEl.textContent = r.suspendu ? "La sauvegarde cloud est en pause sur cet appareil (vous avez effacé ou importé des données). Rien n'a été supprimé dans le cloud : vous pouvez la reprendre." : "La sauvegarde cloud n'est pas activée sur cet appareil."; }
  };
  const majEspace = async () => {
    try {
      const { octets, max } = await synchro.espaceCloud();
      if (!cadre.isConnected) return;
      espace.hidden = false;
      espace.querySelector('[data-cloud-espace-texte]').textContent = `Espace cloud utilisé : ${mo(octets)} sur ${mo(max)}`;
      espace.querySelector('progress').value = Math.min(100, Math.round((octets / max) * 100));
    } catch { espace.hidden = true; }
  };
  window.addEventListener('synchro-etat', afficher);
  window.addEventListener('synchro-changee', afficher);
  window.addEventListener('synchro-terminee', majEspace);

  /** Compare l'appareil et le cloud, explique, et n'active qu'après un « oui ». */
  async function activerAvecChoix() {
    btnActiver.disabled = true;
    try {
      const { cas, local, cloud, exemples } = await synchro.analyserPremiereConnexion();
      const exemplesTexte = exemples && cloud ? ` Les ${exemples} animaux d'exemple de cet appareil seront retirés, pour ne pas se mélanger à votre carnet.` : '';
      const autreCompte = synchro.reglages().userId && synchro.reglages().userId !== u.id ? ' Cet appareil était relié à un autre compte : ses données seront ajoutées à celui-ci.' : '';
      const textes = {
        rien: ['Activer la sauvegarde cloud ?', 'Cet appareil et le cloud sont vides. Dès que vous ajouterez des animaux, ils seront sauvegardés et retrouvés sur vos autres appareils.', 'Activer'],
        recuperer: ['Récupérer votre carnet ?', `Votre carnet du cloud contient ${cloud} élément(s) et cet appareil est vide. Il sera copié ici.${exemplesTexte} Rien d'autre n'est supprimé.`, 'Récupérer mon carnet'],
        envoyer: ['Sauvegarder votre carnet ?', `Le cloud est vide et cet appareil contient ${local} élément(s). Ils seront envoyés dans le cloud.${autreCompte} Rien n'est supprimé.`, 'Envoyer mon carnet'],
        fusionner: ['Fusionner les deux carnets ?', `Cet appareil contient ${local} élément(s) et le cloud ${cloud}. Les deux sont fusionnés : tout est conservé, rien n'est supprimé. Si un même élément a été modifié des deux côtés, la modification la plus récente est gardée.${exemplesTexte}${autreCompte}`, 'Fusionner'],
      }[cas];
      const ok = await demander({ titre: textes[0], message: textes[1], libelle: textes[2], danger: false });
      if (!ok) { synchro.refuserProposition(u.id); afficher(); return; }
      if (exemples && cloud) synchro.retirerExemples();
      await synchro.activer(u.id);
      toast('Sauvegarde cloud activée');
    } catch (err) { toast(compte.messageErreur(err), 'erreur'); } finally { btnActiver.disabled = false; afficher(); }
  }
  btnActiver.addEventListener('click', activerAvecChoix);
  btnSynchro.addEventListener('click', async () => { btnSynchro.disabled = true; await synchro.synchroniser(); btnSynchro.disabled = false; afficher(); });
  btnDesactiver.addEventListener('click', () => { synchro.desactiver(); toast('Sauvegarde cloud désactivée sur cet appareil', 'info'); afficher(); });
  afficher();
  // Première visite d'un compte Premium sur cet appareil : on propose tout de suite (une seule fois ; « Annuler » ne repose pas la question)
  const r = synchro.reglages();
  if (!(r.actif && r.userId === u.id) && !r.suspendu && !r.refuse) activerAvecChoix();
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
    if (!await confirmer('Supprimer définitivement votre compte ? Votre adresse e-mail, vos inscriptions et, pour un compte Premium, toute votre sauvegarde cloud (données et fichiers) seront effacées du serveur, sans retour possible. Vos animaux, sur cet appareil, ne sont pas touchés.', 'Supprimer mon compte')) return;
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
