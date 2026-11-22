// Test « calendrier » : le bouton « Ajouter au calendrier » crée un fichier .ics valide, sur l'appareil, sans rien envoyer.
// Vérifie : contenu du .ics (structure, titre, dates, alertes, accents, caractères spéciaux, lignes longues), identifiant stable,
// plusieurs rappels (« Tout ajouter »), boutons sur la page Rappels, la fiche de l'animal et l'Accueil, phrase d'aide, données intactes.
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';

const [S, URL, TAG] = process.argv.slice(2);
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

const compact = (iso) => iso.replaceAll('-', '');
const lendemain = (iso) => { const [a, m, j] = iso.split('-').map(Number); const d = new Date(a, m - 1, j + 1); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; };

await send('Network.enable');
const requetes = [];
await send('Page.navigate', { url: URL }); await dort(1800);
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [
    { id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: '', naissance: '', photo: '' },
    { id: 'b', nom: 'Noël-Éléonore', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [
    { id: 's-verm', animalId: 'a', type: 'vermifuge', titre: '', date: jour(-80), notes: 'NOTE-PRIVEE-A-NE-PAS-EXPORTER', rappel: jour(3), rappelFait: false },
    { id: 's-rage', animalId: 'b', type: 'vaccin', titre: 'Rage', date: jour(-300), notes: '', rappel: jour(10), rappelFait: false },
    { id: 's-spec', animalId: 'b', type: 'antiparasitaire', titre: 'Pipette ; anti-puces, été \\ spécial', date: jour(-20), notes: '', rappel: jour(40), rappelFait: false },
    { id: 's-long', animalId: 'a', type: 'veto', titre: 'Contrôle annuel chez la vétérinaire de la clinique des Écureuils à Saint-Étienne-du-Rouvray', date: jour(-5), notes: '', rappel: jour(100), rappelFait: false },
    { id: 's-retard', animalId: 'a', type: 'vaccin', titre: 'CHPL', date: jour(-400), notes: '', rappel: jour(-6), rappelFait: false },
    { id: 's-fait', animalId: 'a', type: 'vaccin', titre: 'Ancien', date: jour(-400), notes: '', rappel: jour(-60), rappelFait: true },
    { id: 's-sans', animalId: 'a', type: 'veto', titre: 'Sans rappel', date: jour(-3), notes: '', rappel: '', rappelFait: false },
    { id: 's-orphelin', animalId: 'disparu', type: 'vaccin', titre: 'Orphelin', date: jour(-10), notes: '', rappel: jour(5), rappelFait: false }],
  pesees: [] };
await importer(fichier);
const avant = await donnees();

// Capture des fichiers .ics créés par la page (le texte envoyé à URL.createObjectURL) et de tout ce qui sort vers le réseau
await ev(`(() => { window.__ics = []; const o = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { b.text().then((t) => window.__ics.push({ type: b.type, texte: t })); return o(b); };
  window.__reseau = []; const f = window.fetch.bind(window); window.fetch = (...a) => { window.__reseau.push(String(a[0]?.url ?? a[0])); return f(...a); };
  const x = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { window.__reseau.push(String(u)); return x.apply(this, arguments); };
  const sb = navigator.sendBeacon?.bind(navigator); if (sb) navigator.sendBeacon = (u, d) => { window.__reseau.push(String(u)); return sb(u, d); }; })()`);
const dernier = async (attendu) => { for (let i = 0; i < 30; i++) { const n = await ev(`window.__ics.length`); if (n >= attendu) break; await dort(100); } return ev(`window.__ics[window.__ics.length - 1]`); };
const clic = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);

// Lit un .ics : lignes dépliées, séparées par CRLF
const lire = (ics) => {
  const brut = ics.texte;
  const lignesBrutes = brut.split('\r\n');
  const lignes = lignesBrutes.slice(0, -1).reduce((acc, l) => { if (l.startsWith(' ')) acc[acc.length - 1] += l.slice(1); else acc.push(l); return acc; }, []);
  const evenements = []; let cour = null;
  for (const l of lignes) { if (l === 'BEGIN:VEVENT') cour = []; else if (l === 'END:VEVENT') { evenements.push(cour); cour = null; } else if (cour) cour.push(l); }
  return { brut, lignesBrutes, lignes, evenements, valeur: (e, cle) => (e.find((l) => l.startsWith(`${cle}:`) || l.startsWith(`${cle};`)) ?? '').replace(/^[^:]*:/, '') };
};

// ===== 1. Boutons présents au bon endroit =====
log('--- 1. Boutons ---');
await aller('#/animaux/rappels');
verifier(await ev(`document.querySelectorAll('.rp-carte [data-cal]').length`) === 5, 'page Rappels : un bouton « Ajouter au calendrier » sur chacun des 5 rappels en attente (pas sur « Effectués », ni sans rappel, ni sans animal)');
verifier(await ev(`[...document.querySelectorAll('.rp-carte [data-cal]')].every(b => b.textContent.trim() === 'Ajouter au calendrier')`), 'le texte du bouton est « Ajouter au calendrier »');
verifier(await ev(`document.querySelector('[data-cal="s-verm"]').getAttribute('aria-label')`) === 'Ajouter au calendrier : Vermifuge — Moka', 'nom accessible : « Ajouter au calendrier : Vermifuge — Moka »');
verifier(await texte('[data-cal-tout]') === 'Tout ajouter au calendrier', 'bouton « Tout ajouter au calendrier » sur la page Rappels');
verifier((await texte('.rp-calendrier')).includes('Si vous changez la date dans Carnet Patte, ajoutez à nouveau le rappel au calendrier.'), 'phrase d’aide sur les doublons affichée');
verifier((await texte('.rp-calendrier')).includes('rien n\'est envoyé'), 'la page dit que rien n’est envoyé');
await ecran('rappels'); await axe('#contenu', 'rappels');
await aller('#/animaux/a');
verifier(await ev(`!!document.querySelector('[data-cal="s-verm"]') && !!document.querySelector('[data-cal="s-retard"]') && !document.querySelector('[data-cal="s-fait"]') && !document.querySelector('[data-cal="s-sans"]')`), 'fiche de l’animal (soins) : bouton sur les rappels en attente seulement');
verifier((await texte('.sn')).includes('ajoutez à nouveau le rappel au calendrier'), 'fiche : phrase d’aide affichée');
await aller('#/accueil');
verifier(await ev(`document.querySelectorAll('.ac-afaire [data-cal]').length >= 1`), 'Accueil : carte « À faire » avec son bouton');
await ecran('accueil'); await axe('#contenu', 'accueil');
const bouton1 = await ev(`(() => { const b = document.querySelector('.ac-afaire [data-cal]'); return b.dataset.cal; })()`);
log('rappel de la carte À faire de l’Accueil :', bouton1);

// ===== 2. Contenu d'un fichier (rappel de Moka) =====
log('--- 2. Un rappel : Vermifuge — Moka ---');
await aller('#/animaux/rappels');
await send('Network.setCacheDisabled', { cacheDisabled: false });
await clic('[data-cal="s-verm"]');
let ics = await dernier(1);
verifier(ics?.type === 'text/calendar;charset=utf-8', `type du fichier : ${ics?.type}`);
let f = lire(ics);
verifier(f.lignes[0] === 'BEGIN:VCALENDAR' && f.lignes.at(-1) === 'END:VCALENDAR' && f.brut.endsWith('\r\n'), 'structure : BEGIN:VCALENDAR … END:VCALENDAR, lignes terminées par CRLF');
verifier(!/[^\r]\n/.test(f.brut.replace(/\r\n/g, '')) && !f.brut.replace(/\r\n/g, '').includes('\n'), 'aucun saut de ligne isolé');
verifier(f.lignes.includes('VERSION:2.0') && f.lignes.some((l) => l.startsWith('PRODID:')) && f.lignes.includes('CALSCALE:GREGORIAN'), 'VERSION:2.0, PRODID, CALSCALE');
verifier(f.evenements.length === 1, '1 événement');
const e1 = f.evenements[0];
verifier(f.valeur(e1, 'SUMMARY') === 'Vermifuge — Moka', `titre : « ${f.valeur(e1, 'SUMMARY')} »`);
verifier(f.valeur(e1, 'DTSTART') === compact(jour(3)) && e1.some((l) => l === `DTSTART;VALUE=DATE:${compact(jour(3))}`), `début : toute la journée du ${jour(3)} (DTSTART;VALUE=DATE:${compact(jour(3))})`);
verifier(e1.includes(`DTEND;VALUE=DATE:${lendemain(jour(3))}`), `fin : le lendemain (${lendemain(jour(3))}), événement d’une journée`);
verifier(!e1.some((l) => /^DTSTART.*T\d{6}/.test(l)), 'aucune heure dans le début (journée entière)');
verifier(e1.includes('UID:rappel-s-verm@carnet-patte'), 'identifiant stable : UID:rappel-s-verm@carnet-patte');
verifier(e1.some((l) => /^DTSTAMP:\d{8}T\d{6}Z$/.test(l)), 'DTSTAMP valide (UTC)');
const alertes = f.lignes.join('\n').match(/BEGIN:VALARM[\s\S]*?END:VALARM/g) ?? [];
verifier(alertes.length === 2, `2 alertes (${alertes.length})`);
verifier(alertes.every((a) => a.includes('ACTION:DISPLAY') && /DESCRIPTION:/.test(a)), 'alertes en notification, avec un texte (obligatoire)');
verifier(alertes.some((a) => a.includes('TRIGGER:-PT6H')), 'alerte la veille à 18 h (6 h avant minuit : TRIGGER:-PT6H)');
verifier(alertes.some((a) => a.includes('TRIGGER:PT9H')), 'alerte le jour même à 9 h (TRIGGER:PT9H)');
const description = f.valeur(e1, 'DESCRIPTION');
verifier(description.includes('Soin : Vermifuge') && description.includes('Animal : Moka'), 'note : nom du soin et de l’animal');
verifier(!f.brut.includes('NOTE-PRIVEE'), 'les notes privées du soin ne sont jamais écrites dans le fichier');
verifier(f.lignesBrutes.every((l) => Buffer.byteLength(l, 'utf8') <= 75), 'aucune ligne de plus de 75 octets');
verifier(f.brut.includes('—') && !f.brut.includes('�'), 'le tiret long et les accents sont conservés (UTF-8)');
const uid1 = f.valeur(e1, 'UID'); const seq1 = f.valeur(e1, 'SEQUENCE');
verifier(Number(seq1) > 0, `SEQUENCE présent (${seq1}) : un nouvel ajout remplace l’ancien`);
await dort(100);
await clic('[data-cal="s-verm"]');
ics = await dernier(2);
const e1bis = lire(ics).evenements[0];
verifier(lire(ics).valeur(e1bis, 'UID') === uid1, 'même identifiant à chaque téléchargement : le calendrier met à jour au lieu de doubler');
verifier((await texte('.cp-notifs')).includes('Si vous changez la date dans Carnet Patte'), 'message après l’ajout : rappel de la phrase sur la date');

// ===== 3. Accents, caractères spéciaux, lignes longues =====
log('--- 3. Accents, caractères spéciaux, ligne longue ---');
await clic('[data-cal="s-spec"]');
f = lire(await dernier(3));
const es = f.evenements[0];
verifier(f.valeur(es, 'SUMMARY') === 'Pipette \\; anti-puces\\, été \\\\ spécial — Noël-Éléonore', `; , \\ échappés et accents gardés : « ${f.valeur(es, 'SUMMARY')} »`);
await clic('[data-cal="s-long"]');
f = lire(await dernier(4));
verifier(f.lignesBrutes.some((l) => l.startsWith(' ')) && f.lignesBrutes.every((l) => Buffer.byteLength(l, 'utf8') <= 75), 'titre très long : ligne repliée (suite commençant par une espace), 75 octets au plus');
verifier(f.valeur(f.evenements[0], 'SUMMARY') === 'Contrôle annuel chez la vétérinaire de la clinique des Écureuils à Saint-Étienne-du-Rouvray — Moka', 'après dépliage, le titre long est exact (aucun accent coupé en deux)');

// ===== 3 bis. Rappel EN RETARD : l'événement est créé DEMAIN, avec « (en retard) » =====
log('--- 3 bis. Rappel en retard ---');
const demain = (() => { const d = new Date(); d.setDate(d.getDate() + 1); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; })();
await clic('[data-cal="s-retard"]');
f = lire(await dernier(5));
const er = f.evenements[0];
verifier(f.valeur(er, 'SUMMARY') === 'CHPL — Moka (en retard)', `titre : « ${f.valeur(er, 'SUMMARY')} »`);
verifier(er.includes(`DTSTART;VALUE=DATE:${demain}`) && er.includes(`DTEND;VALUE=DATE:${lendemain(jour(1))}`), `placé demain (${demain}), pas dans le passé (rappel prévu le ${jour(-6)})`);
verifier(f.valeur(er, 'DESCRIPTION').includes('(en retard)') && f.valeur(er, 'DESCRIPTION').includes('Rappel prévu le'), 'la note rappelle la date prévue et « (en retard) »');
verifier((f.lignes.join('\n').match(/BEGIN:VALARM/g) ?? []).length === 2 && f.lignes.join('\n').includes('TRIGGER:-PT6H') && f.lignes.join('\n').includes('TRIGGER:PT9H'), 'les deux alertes sont gardées (la veille à 18 h, le jour même à 9 h)');
verifier(f.valeur(er, 'UID') === 'rappel-s-retard@carnet-patte', 'identifiant stable');
verifier(await ev(`document.querySelector('[data-cal="s-retard"]').getAttribute('aria-label')`) === 'Ajouter au calendrier : CHPL — Moka (en retard)', 'le nom du bouton annonce « (en retard) »');
verifier(await ev(`document.querySelector('[data-cal="s-verm"]').getAttribute('aria-label')`) === 'Ajouter au calendrier : Vermifuge — Moka', 'un rappel à venir n’a pas de « (en retard) »');

// ===== 4. Plusieurs rappels : « Tout ajouter » =====
log('--- 4. Tout ajouter ---');
await clic('[data-cal-tout]');
f = lire(await dernier(6));
verifier(f.evenements.length === 4, `4 rappels à venir dans un seul fichier (${f.evenements.length}) : ni le retard, ni le rappel effectué, ni l’animal disparu`);
const dates = f.evenements.map((e) => f.valeur(e, 'DTSTART'));
verifier(JSON.stringify(dates) === JSON.stringify([jour(3), jour(10), jour(40), jour(100)].map(compact)), `rappels rangés par date : ${dates}`);
const uids = f.evenements.map((e) => f.valeur(e, 'UID'));
verifier(new Set(uids).size === 4 && uids.includes('rappel-s-verm@carnet-patte') && uids.includes('rappel-s-rage@carnet-patte'), 'un identifiant différent par rappel, les mêmes que pour les fichiers individuels');
verifier(f.lignes.filter((l) => l === 'BEGIN:VCALENDAR').length === 1 && f.lignes.filter((l) => l === 'BEGIN:VALARM').length === 8, 'un seul calendrier, 2 alertes par événement');
verifier(f.evenements.map((e) => f.valeur(e, 'SUMMARY')).join('|') === 'Vermifuge — Moka|Rage — Noël-Éléonore|Pipette \\; anti-puces\\, été \\\\ spécial — Noël-Éléonore|Contrôle annuel chez la vétérinaire de la clinique des Écureuils à Saint-Étienne-du-Rouvray — Moka', 'titres « Soin — Animal »');

// ===== 5. Cas limites de js/ics.js =====
log('--- 5. Cas limites ---');
const lim = await ev(`import('/js/ics.js').then(({ creerIcs }) => creerIcs([{ id: 'x/y 1', titre: 'Fin d’année', description: 'a\\nb', date: '2026-12-31' }], new Date(Date.UTC(2026, 10, 22, 9, 5, 7))))`);
verifier(lim.includes('DTSTART;VALUE=DATE:20261231') && lim.includes('DTEND;VALUE=DATE:20270101'), 'fin d’année : 31/12/2026 se termine le 01/01/2027');
verifier(lim.includes('DTSTAMP:20261122T090507Z') && lim.includes('UID:rappel-xy1@carnet-patte'), 'DTSTAMP en UTC ; identifiant sans caractères douteux');
verifier(lim.includes('DESCRIPTION:a\\nb'), 'retour à la ligne écrit \\n');
const bissextile = await ev(`import('/js/ics.js').then(({ creerIcs }) => creerIcs([{ id: 'b', titre: 't', description: 'd', date: '2028-02-28' }, { id: 'c', titre: 't', description: 'd', date: '2028-02-29' }]))`);
verifier(bissextile.includes('DTEND;VALUE=DATE:20280229') && bissextile.includes('DTEND;VALUE=DATE:20280301'), 'année bissextile : 28/02 → 29/02, 29/02 → 01/03');

// ===== 6. Rien ne part vers un serveur ; données intactes =====
log('--- 6. Confidentialité ---');
const reseau = await ev(`window.__reseau`);
verifier(reseau.length === 0, `aucune requête réseau pendant les créations de fichiers (${JSON.stringify(reseau)})`);
verifier(await donnees() === avant, 'données des animaux identiques après tous les téléchargements');
verifier(await ev(`import('/modules/animaux/calendrier.js').then(m => m.ajouterUn('inexistant'))`) === false, 'rappel inconnu : rien n’est créé, pas d’erreur');
await ev(`window.__ics.length = 0`);
await importer({ ...fichier, soins: fichier.soins.filter((s) => s.id === 's-retard') });
await ev(`import('/js/router.js').then(r=>r.rafraichir())`); await dort(500);
verifier(await ev(`!document.querySelector('[data-cal-tout]')`), 'aucun rappel à venir : pas de bouton « Tout ajouter »');

// Aller-retour export / import
await importer(fichier);
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
fin(net(exp) === net(exp2));
