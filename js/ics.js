// Fabrique un fichier calendrier (.ics, RFC 5545) à partir de rappels. Tout se passe sur l'appareil : rien n'est envoyé nulle part.
// Cette partie ne connaît ni l'écran ni les données : elle reçoit des rappels déjà prêts (voir modules/animaux/calendrier.js).
//
// Un rappel : { id, titre, description, date: 'AAAA-MM-JJ' }.
// Événement sur toute la journée, avec deux alertes : la veille à 18 h et le jour même à 9 h.
// (Pour un événement « toute la journée », l'alerte se règle par rapport à minuit de ce jour : -6 h = 18 h la veille, +9 h = 9 h le jour même.)
// L'identifiant (UID) ne dépend que du rappel : ajouter deux fois le même rappel met à jour l'événement au lieu de le doubler.

import { ajouterJours } from './utils.js';

const CRLF = '\r\n';
const octets = new TextEncoder();

/** Protège un texte : \ ; , et les retours à la ligne ont un sens spécial dans un .ics. */
export function echapperIcs(texte) {
  return String(texte ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** Coupe une ligne à 75 octets (accents compris, sans couper un caractère en deux) ; les lignes suivantes commencent par une espace. */
export function plierLigne(ligne) {
  if (octets.encode(ligne).length <= 75) return ligne;
  const morceaux = [];
  let courant = '';
  let taille = 0;
  let limite = 75;
  for (const c of ligne) {
    const n = octets.encode(c).length;
    if (taille + n > limite) { morceaux.push(courant); courant = ''; taille = 0; limite = 74; } // 74 : l'espace de tête compte aussi
    courant += c;
    taille += n;
  }
  morceaux.push(courant);
  return morceaux.join(`${CRLF} `);
}

const compact = (iso) => iso.replaceAll('-', '');
const p2 = (n) => String(n).padStart(2, '0');
/** Instant en UTC : 20261121T093000Z */
const horodatage = (d) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;

const alerte = (declencheur, texte) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${echapperIcs(texte)}`, `TRIGGER:${declencheur}`, 'END:VALARM'];

/** Identifiant stable d'un rappel (le même à chaque téléchargement). */
export const uidRappel = (id) => `rappel-${String(id).replace(/[^A-Za-z0-9_-]/g, '')}@carnet-patte`;

/** Le texte complet du fichier .ics pour une liste de rappels. `maintenant` (une Date) ne sert qu'aux tests. */
export function creerIcs(rappels, maintenant = new Date()) {
  const stamp = horodatage(maintenant);
  const sequence = Math.floor(maintenant.getTime() / 60000); // monte à chaque téléchargement : le calendrier remplace l'ancienne version au lieu de la doubler
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Carnet Patte//Rappels//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const r of rappels) {
    lignes.push(
      'BEGIN:VEVENT',
      `UID:${uidRappel(r.id)}`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${sequence}`,
      `DTSTART;VALUE=DATE:${compact(r.date)}`,
      `DTEND;VALUE=DATE:${compact(ajouterJours(r.date, 1))}`,
      `SUMMARY:${echapperIcs(r.titre)}`,
      `DESCRIPTION:${echapperIcs(r.description)}`,
      'TRANSP:TRANSPARENT',
      ...alerte('-PT6H', r.titre),
      ...alerte('PT9H', r.titre),
      'END:VEVENT',
    );
  }
  lignes.push('END:VCALENDAR');
  return lignes.map(plierLigne).join(CRLF) + CRLF;
}

/** Fait télécharger (ou ouvrir) le fichier sur l'appareil. */
export function telechargerIcs(nomFichier, texte) {
  const url = URL.createObjectURL(new Blob([texte], { type: 'text/calendar;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.hidden = true;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
