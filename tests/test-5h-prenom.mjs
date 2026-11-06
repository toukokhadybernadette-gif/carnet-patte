import { spawn } from 'node:child_process';
import fs from 'node:fs';
const S = process.argv[2], URL = process.argv[3], TAG = process.argv[4];
const E = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; // chemin de msedge.exe : à adapter avec la variable EDGE si besoin
const port = +(process.env.PORT||9350);
fs.rmSync(`${S}/prof-e2e-${TAG}`, { recursive: true, force: true });
const proc = spawn(E, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${S}/prof-e2e-${TAG}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (list.find(t => t.type === 'page')) break; } catch {} await sleep(250); }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const erreurs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') erreurs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) erreurs.push('CONSOLE ' + d.params.args.map(a => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') erreurs.push('LOG ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erreur'); return r.result.result.value; };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
fs.mkdirSync(`${S}/shots`, { recursive: true });
const log = (...a) => console.log(...a);
const taille = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
const aller = async (h) => { await ev(`location.hash='${h}'`); await sleep(700); };
const clip = async (nom, sel, max = 2600) => { const r = await ev(`(()=>{const e=document.querySelector('${sel}');const b=e.getBoundingClientRect();return {y:b.top+scrollY,w:innerWidth,h:b.height}})()`);
  const c = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: r.y, width: r.w, height: Math.min(r.h, max), scale: 1 } }); fs.writeFileSync(`${S}/shots/${TAG}-${nom}.png`, Buffer.from(c.result.data, 'base64')); };


const aller2 = async (h) => { if (await ev(`location.hash`) === h) { await ev(`import('/js/router.js').then(r=>r.rafraichir())`); await sleep(500); } else await aller(h); };
const touche = async (key, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }); await sleep(150); };
const ecran = async (nom) => { const c = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${S}/shots/${TAG}-${nom}.png`, Buffer.from(c.result.data, 'base64')); };
const donnees = () => ev(`JSON.parse(localStorage.getItem('carnetpatte.v1'))`);
let axeSrc = ''; for (let i = 0; i < 4 && !axeSrc; i++) { try { axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text(); } catch { await sleep(1500); } }
const axe = async (sel, nom) => { const a = await ev(`axe.run(document.querySelector('${sel}'), {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r=>({v:r.violations.map(v=>v.id+'('+v.nodes.length+') '+v.nodes[0].html.slice(0,90)),inc:r.incomplete.map(i=>i.id)}))`); log('axe', nom, ':', a.v.length ? 'VIOLATIONS ' + a.v.join(' | ') : '0 violation', a.inc.length ? '· à vérifier ' + a.inc : ''); };
const sansDebord = () => ev(`document.documentElement.scrollWidth<=innerWidth`);
const texte = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? 'ABSENT').replace(/\\s+/g,' ').trim()`);
const jour = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
await send('Page.navigate', { url: URL }); await sleep(1800); await taille(1280, 900); await aller('#/animaux'); await ev(axeSrc);

// ===== 5h : prénom facultatif, ancien export, rechargement, graphique des pesées, tailles tactiles =====
let echecs = 0;
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const ancienExport = JSON.stringify({ version: 1, exemplesAjoutes: true, exporteLe: '2025-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Pomme', espece: 'cheval', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [], pesees: [{ id: 'p1', animalId: 'a', date: '2025-01-01', poidsKg: 500 }, { id: 'p2', animalId: 'a', date: '2025-03-01', poidsKg: 510 }] }); // SANS le champ « profil »
const importer = (texte) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(texte)}))`);

log('=== ANCIEN EXPORT (sans profil) ===');
await importer(ancienExport);
verifier(await ev(`import('/js/storage.js').then(m=>JSON.stringify(m.lireProfil()))`) === '{"prenom":""}', 'importé sans erreur, prénom vide');
verifier((await donnees()).animaux.length === 1, 'animal importé');
await aller2('#/accueil');
verifier(await texte('h1') === 'Bonjour', 'Accueil sans prénom : « Bonjour » tout court');
verifier(await ev(`document.querySelector('.app-lateral [data-nav=profil]').getAttribute('aria-label')`) === 'Profil', 'lien Profil (menu) sans prénom');

log('=== PROFIL : saisie du prénom ===');
const saisir = async (valeur) => { await aller2('#/profil'); await ev(`(()=>{const f=document.querySelector('.pf-form');f.prenom.value=${JSON.stringify(valeur)};f.requestSubmit();})()`); await sleep(500); };
await saisir('  Léa   Marie ');
verifier((await donnees()).profil.prenom === 'Léa Marie', 'prénom enregistré, espaces nettoyés');
await saisir('x'.repeat(80));
verifier((await donnees()).profil.prenom.length === 40, 'prénom limité à 40 caractères');
await saisir('Léa <b>');
await aller2('#/accueil');
verifier(await texte('h1') === 'Bonjour Léa <b>' && await ev(`!document.querySelector('h1 b')`), 'Accueil : « Léa <b> » affiché comme texte (rien n est interprété)');
await saisir('Léa');
await aller2('#/accueil');
verifier(await texte('h1') === 'Bonjour Léa', 'Accueil avec prénom : « Bonjour Léa »');
verifier(await ev(`document.querySelector('.app-lateral [data-nav=profil]').getAttribute('aria-label')`) === 'Profil de Léa', 'lien Profil (menu) : « Profil de Léa »');
verifier(await texte('.app-lateral [data-nav=profil] .app-nav__texte') === 'Léa', 'barre latérale : le prénom remplace « Profil »');
await ecran('accueil-prenom');

log('=== DOUBLONS SUPPRIMÉS (étape 1) ===');
await taille(1280, 900); await aller2('#/accueil');
verifier(await ev(`!document.querySelector('#notif-lien') && !document.querySelector('#profil-lien') && document.querySelectorAll('#barre-haut a[href="#/profil"], #barre-haut a[href="#/animaux/rappels"]').length === 0`), 'barre du haut : plus de cloche ni d icône profil');
verifier(await ev(`!!document.querySelector('.app-lateral [data-nav=rappels]') && !!document.querySelector('.app-lateral [data-nav=profil]') && !!document.querySelector('#nav-bas [data-nav=rappels]') && !!document.querySelector('#nav-bas [data-nav=profil]')`), 'Rappels et Profil restent dans le menu de gauche et dans la barre du bas');
verifier(await ev(`document.querySelectorAll('.pg-tuile').length === 0 && ![...document.querySelectorAll('#contenu a')].some(a => ['Mes animaux','Rappels','Sauvegarde'].includes(a.textContent.trim()) && a.closest('.pg-raccourcis'))`), 'Accueil : plus de boutons Mes animaux / Rappels / Sauvegarde');
verifier(await ev(`!document.querySelector('.pg-bientot')`), 'Accueil : le bloc « Bientôt » n\'y est plus');
await aller2('#/profil');
verifier(await ev(`(()=>{const a=[...document.querySelectorAll('.pg-bientot a')];return a.length===5 && a.some(x=>x.getAttribute('href')==='#/boutique') && a.some(x=>x.getAttribute('href')==='#/bientot') && document.querySelector('.pg-bientot').getBoundingClientRect().height < 120})()`), 'Profil : « Bientôt sur Carnet Patte » en une petite ligne de 5 liens (modules + « Et d\'autres modules »)');
await aller2('#/accueil');
await importer(JSON.stringify({ ...JSON.parse(ancienExport), soins: [{ id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: '2025-01-01', notes: '', rappel: '2025-02-01', rappelFait: false }] }));
await aller2('#/animaux');
verifier(await ev(`(()=>{const l=document.querySelector('.al-rappels');return !!l && !l.classList.contains('cp-carte') && l.getBoundingClientRect().height < 60 && l.querySelector('a').getAttribute('href') === '#/animaux/rappels'})()`), 'Mes animaux : une petite ligne avec un lien vers Rappels (plus de gros bloc)');
log('=== ACCUEIL : avatars, actions rapides, rappels, conseil, bilan du mois ===');
const importerJeu = (animaux, soins = [], pesees = []) => importer(JSON.stringify({ version: 1, exemplesAjoutes: true, animaux, soins, pesees }));
const A = (id, nom, extra = {}) => ({ id, nom, espece: 'cheval', especeAutre: '', race: '', naissance: '', photo: '', ...extra });
const aujour = jour(0);
const unAn = jour(400);
await importerJeu([A('a', 'Pomme')], [
  { id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: aujour, notes: '', rappel: jour(-3), rappelFait: false },
  { id: 's2', animalId: 'a', type: 'vaccin', titre: 'Grippe', date: aujour, notes: '', rappel: unAn, rappelFait: false },
  { id: 's3', animalId: 'a', type: 'veto', titre: 'Dents', date: jour(-100), notes: '', rappel: '', rappelFait: false },
], [{ id: 'p1', animalId: 'a', date: aujour, poidsKg: 500 }, { id: 'p2', animalId: 'a', date: jour(-100), poidsKg: 495 }]);
await taille(1280, 900); await aller2('#/accueil');
verifier(await ev(`document.querySelectorAll('.cp-stat, .pg-animaux, #ac-activite, .pg-bientot, .pg-tuile').length === 0`), 'plus de chiffres, de grandes cartes d\'animaux, d\'activité récente ni de bloc « Bientôt »');
verifier(await texte('.ac-resume') === '1 animal · 1 rappel en retard', `résumé sur une ligne : « ${await texte('.ac-resume')} »`);
verifier(await ev(`document.querySelector('.ac-resume').getAttribute('href') === '#/animaux/rappels'`), 'le résumé mène aux rappels');
// ordre demandé : Bonjour + résumé, avatars, actions rapides, prochains rappels, conseil, ce mois-ci
const ordre = await ev(`(() => { const sels = ['h1', '.ac-resume', '.ac-stories', '.ac-actions', '#ac-rappels', '.ac-conseil', '[data-ce-mois]']; const els = sels.map(s => document.querySelector(s)); return els.every(Boolean) && els.every((e, i) => i === 0 || !!(els[i - 1].compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)); })()`);
verifier(ordre, 'ordre : Bonjour + résumé, avatars, actions rapides, prochains rappels, conseil, ce mois-ci');
// avatars
const stories = await ev(`(() => { const ul = document.querySelector('.ac-stories ul'); return { n: document.querySelectorAll('.ac-story').length, href: document.querySelector('.ac-story').getAttribute('href'), defile: getComputedStyle(ul).overflowX, rond: getComputedStyle(document.querySelector('.ac-story .cp-avatar')).borderRadius, taille: Math.round(document.querySelector('.ac-story .cp-avatar').getBoundingClientRect().width), nom: document.querySelector('.ac-story__nom').textContent }; })()`);
verifier(stories.n === 1 && stories.href === '#/animaux/a' && stories.defile === 'auto' && stories.taille <= 64 && stories.nom === 'Pomme', `rangée d'avatars ronds de ${stories.taille} px (défilement horizontal : ${stories.defile}), lien vers la fiche`);
await ev(`document.querySelector('.ac-story').click()`); await sleep(700);
verifier(await ev(`location.hash`) === '#/animaux/a' && await texte('.fi-entete h1') === 'Pomme', 'un toucher sur l\'avatar ouvre la fiche de l\'animal');
await aller2('#/accueil');
// actions rapides : 4 cercles
const actionsRapides = await ev(`[...document.querySelectorAll('.ac-action')].map(a => ({ t: a.textContent.trim(), w: Math.round(a.querySelector('.ac-action__rond').getBoundingClientRect().width), rond: getComputedStyle(a.querySelector('.ac-action__rond')).borderRadius, href: a.getAttribute('href') }))`);
verifier(actionsRapides.map((x) => x.t).join(' | ') === 'Ajouter un soin | Ajouter une pesée | Ajouter un animal | Sauvegarde', `4 actions rapides : ${actionsRapides.map((x) => x.t).join(' | ')}`);
verifier(actionsRapides.every((x) => x.w >= 44 && x.rond === '50%'), `ce sont des cercles de ${actionsRapides[0].w} px (cible tactile de 44 px minimum)`);
verifier(actionsRapides[3].href === '#/donnees', '« Sauvegarde » mène à la page Sauvegarde');
await ev(`document.querySelector('.ac-action[data-act=soin]').click()`); await sleep(600);
verifier(await ev(`!!document.querySelector('dialog form.sn-form') && document.querySelector('dialog .cp-modale__titre').textContent.includes('Pomme')`), 'un seul animal : « Ajouter un soin » ouvre directement le formulaire du soin de Pomme');
await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(300);
// ajout d'une pesée depuis l'Accueil
await ev(`document.querySelector('.ac-action[data-act=pesee]').click()`); await sleep(600);
verifier(await ev(`document.querySelector('dialog .cp-modale__titre').textContent === 'Nouvelle pesée pour Pomme'`), '« Ajouter une pesée » : fenêtre de pesée pour Pomme');
await ev(`(()=>{const f=document.querySelector('dialog form');f.poids.value='abc';f.requestSubmit();})()`); await sleep(300);
verifier(await ev(`!!document.querySelector('dialog .cp-champ__erreur') && document.querySelector('dialog form').poids.getAttribute('aria-invalid') === 'true'`) && (await donnees()).pesees.length === 2, 'poids invalide : message d\'erreur, rien n\'est enregistré');
await axe('dialog', 'fenêtre d\'ajout de pesée');
await ev(`(()=>{const f=document.querySelector('dialog form');f.poids.value='502,5';f.requestSubmit();})()`); await sleep(700);
const apresPesee = (await donnees()).pesees;
verifier(apresPesee.length === 3 && apresPesee.some((p) => p.poidsKg === 502.5 && p.animalId === 'a' && p.date === aujour) && await ev(`!document.querySelector('dialog')`), 'pesée de 502,5 kg enregistrée pour Pomme, avec la date du jour, fenêtre fermée');
// ce mois-ci
verifier(await texte('[data-ce-mois]') === 'Ce mois-ci : 2 soins faits, 2 pesées', `bilan du mois : « ${await texte('[data-ce-mois]')} » (2 soins et 2 pesées datés d'aujourd'hui ; le soin et la pesée d'il y a 100 jours ne comptent pas)`);
// rappels : année omise pour l'année en cours seulement
const metas = await ev(`[...document.querySelectorAll('section[aria-labelledby=ac-rappels] .cp-liste__meta')].map(m => m.textContent)`);
const anneeCourante = aujour.slice(0, 4);
verifier(metas.length === 2 && !metas.some((m) => m.includes(anneeCourante)) || metas.some((m) => m.includes(unAn.slice(0, 4))), `dates des rappels : ${metas.join(' | ')}`);
const rappelCourant = metas.find((m) => m.startsWith('Pomme'));
verifier(metas.filter((m) => /\d{4}/.test(m)).length === (unAn.slice(0, 4) === anneeCourante ? 0 : 1), 'l\'année est omise pour l\'année en cours et affichée pour une autre année');
const ligneHaute = await ev(`[...document.querySelectorAll('section[aria-labelledby=ac-rappels] .cp-liste__corps')].every(c => { const lh = parseFloat(getComputedStyle(c.querySelector('.cp-liste__meta')).lineHeight); return c.querySelector('.cp-liste__meta').getBoundingClientRect().height <= lh + 1; })`);
verifier(ligneHaute, 'chaque ligne « animal · date » tient sur une seule ligne');
await taille(390, 844); await aller2('#/accueil');
verifier(await ev(`[...document.querySelectorAll('.cp-liste__meta')].every(m => m.getBoundingClientRect().height <= parseFloat(getComputedStyle(m).lineHeight) + 1) && document.documentElement.scrollWidth <= innerWidth`), 'téléphone (390 px) : aucune ligne coupée, pas de défilement horizontal');
await taille(1280, 900);

log('=== CONSEIL DU MOMENT : 12 conseils, un par mois ===');
const conseils = await ev(`import('/js/conseils.js').then(m => ({ phrase: m.PHRASE_VETERINAIRE, tous: m.CONSEILS, parMois: Array.from({ length: 12 }, (_, i) => m.conseilDuMois(new Date(2026, i, 15)).titre) }))`);
verifier(conseils.tous.length === 12 && conseils.tous.map((c) => c.mois).join() === '1,2,3,4,5,6,7,8,9,10,11,12', '12 conseils, un pour chaque mois');
verifier(new Set(conseils.parMois).size === 12, 'chaque mois affiche un conseil différent');
verifier(conseils.tous.every((c) => c.titre && c.texte.length > 80 && c.source && c.icone), 'chaque conseil a un titre, un texte, une source et une icône');
verifier(conseils.tous.every((c) => !/\b\d+\s?(mg|ml|g|kg|cl|%)\b/i.test(c.texte)), 'aucun conseil ne donne de dose ni de quantité chiffrée');
verifier(conseils.tous.every((c) => /(consult|appel|urgence)/i.test(c.texte) || /valider avec votre vétérinaire/.test(c.source)), 'chaque conseil dit quand consulter ou appeler');
verifier(conseils.phrase === 'En cas de doute, appelez votre vétérinaire.', 'la phrase de prudence est celle demandée');
const mois = new Date().getMonth();
verifier(await texte('.ac-conseil__titre') === conseils.parMois[mois], `le conseil affiché est celui du mois en cours : « ${conseils.parMois[mois]} »`);
verifier((await texte('.ac-conseil')).includes('En cas de doute, appelez votre vétérinaire.') && (await texte('.ac-conseil__source')).startsWith('Source :'), 'la phrase « En cas de doute, appelez votre vétérinaire. » et la source sont affichées');
verifier(await ev(`!document.querySelector('.ac-conseil a, .ac-conseil img')`), 'le conseil ne contient que du texte (ni lien ni image)');
await axe('#app', 'Accueil complet');

log('=== ACCUEIL : plusieurs animaux, sans retard, sans animal ===');
await importerJeu([A('a', 'Pomme'), A('b', 'Bob', { espece: 'chat' })]);
await aller2('#/accueil');
verifier(await texte('.ac-resume') === '2 animaux · aucun rappel en retard', `sans retard : « ${await texte('.ac-resume')} »`);
verifier(await ev(`document.querySelectorAll('.ac-story').length`) === 2 && await texte('[data-ce-mois]') === 'Ce mois-ci : 0 soin fait, 0 pesée', 'deux avatars ; bilan du mois à zéro');
await ev(`document.querySelector('.ac-action[data-act=soin]').click()`); await sleep(600);
verifier(await ev(`document.querySelector('dialog .cp-modale__titre').textContent === 'Pour quel animal ?' && document.querySelectorAll('dialog .ac-choix__animal').length === 2`), 'deux animaux : un petit choix « Pour quel animal ? »');
await axe('dialog', 'choix de l\'animal');
await ev(`[...document.querySelectorAll('dialog .ac-choix__animal')].find(a => a.textContent.includes('Bob')).click()`); await sleep(700);
verifier(await ev(`document.querySelector('dialog .cp-modale__titre').textContent.includes('Bob') && !!document.querySelector('dialog form.sn-form')`), 'le choix de Bob ouvre le formulaire de soin de Bob');
await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(300);
await ev(`document.querySelector('.ac-action[data-act=pesee]').click()`); await sleep(600);
await ev(`[...document.querySelectorAll('dialog .ac-choix__animal')].find(a => a.textContent.includes('Bob')).click()`); await sleep(700);
verifier(await ev(`document.querySelector('dialog .cp-modale__titre').textContent === 'Nouvelle pesée pour Bob'`), 'le choix de Bob ouvre aussi la pesée de Bob');
await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(300);
await importerJeu([]);
await aller2('#/accueil');
verifier(await ev(`[...document.querySelectorAll('.ac-action')].map(a => a.textContent.trim()).join(' | ')`) === 'Ajouter un animal | Sauvegarde' && !!await ev(`document.querySelector('.cp-vide')`) && await ev(`!document.querySelector('.ac-conseil, .ac-stories, [data-ce-mois]')`), 'aucun animal : seulement « Ajouter un animal » et « Sauvegarde », message d\'accueil, pas de conseil');
await ev(`document.querySelector('.ac-action[data-act=animal]').click()`); await sleep(600);
verifier(await ev(`document.querySelector('dialog .cp-modale__titre').textContent === 'Nouvel animal'`), '« Ajouter un animal » ouvre le formulaire d\'un nouvel animal');
await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(300);
await axe('#app', 'Accueil vide');
await importer(JSON.stringify({ ...JSON.parse(ancienExport), soins: [{ id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: '2025-01-01', notes: '', rappel: '2025-02-01', rappelFait: false }] }));
await taille(390, 844); await aller2('#/accueil');
verifier(await ev(`[...document.querySelectorAll('#barre-haut a')].every(a => a.classList.contains('app-marque')) && !!document.querySelector('#recherche-bouton')`), 'téléphone : barre du haut = logo et recherche seulement');
await taille(1280, 900);

log('=== ÉTAPE B : barre du bas à 4 onglets, rappels sur téléphone ===');
await taille(390, 844); await aller2('#/accueil');
verifier(await ev(`[...document.querySelectorAll('#nav-bas [data-nav]')].map(a=>a.dataset.nav).join(',')`) === 'accueil,animaux,rappels,profil', 'barre du bas : 4 onglets (Accueil, Animaux, Rappels, Profil), plus de Boutique');
verifier(await ev(`!!document.querySelector('.app-lateral [data-nav=boutique]')`), 'la Boutique reste dans la section « Bientôt » du menu de gauche');
await aller2('#/animaux/rappels');
verifier(await ev(`!document.querySelector('.rp-chiffres')`) && await ev(`document.querySelectorAll('.rp-statuts .rp-nombre').length`) === 4, 'Rappels : plus de carrés de chiffres, les 4 boutons de filtre affichent les nombres');
const lignesRappel = await ev(`[...document.querySelectorAll('.rp-carte')].map(c => { const nom = c.querySelector('.rp-carte__nom').getBoundingClientRect(); const etat = c.querySelector('.rp-carte__etat').getBoundingClientRect(); const animal = c.querySelector('.rp-animal').getBoundingClientRect(); const date = c.querySelector('.rp-ligne').getBoundingClientRect(); const lh = parseFloat(getComputedStyle(c.querySelector('.rp-carte__nom')).lineHeight); return { nomUneLigne: nom.height <= lh + 1, etatADroite: etat.left > nom.left, animalSousNom: animal.top >= nom.bottom - 1, dateSousNom: date.top >= nom.bottom - 1, dernierCache: getComputedStyle(c.querySelector('.rp-ligne--dernier')).display === 'none' }; })`);
verifier(lignesRappel.length > 0 && lignesRappel.every((l) => l.nomUneLigne), `390 px : le nom du soin tient sur une seule ligne (${lignesRappel.length} rappels)`);
verifier(lignesRappel.every((l) => l.etatADroite && l.animalSousNom && l.dateSousNom), 'nom en haut, animal et date en dessous, badge à droite');
const dansEcran = await ev(`[...document.querySelectorAll('.rp-carte')].every(c => c.scrollWidth <= c.clientWidth + 1) && document.documentElement.scrollWidth <= innerWidth`);
verifier(dansEcran, 'aucune ligne de rappel ne déborde');
const hauteurs = await ev(`[...document.querySelectorAll('[data-fait]')].map(b => Math.round(b.getBoundingClientRect().height))`);
verifier(hauteurs.every((h) => h >= 44), `boutons « Fait » toujours de 44 px minimum (${hauteurs.join(', ')})`);
await axe('#app', 'Rappels sur téléphone');
await taille(1280, 900);

log('=== SÉCURITÉ : un prénom piégé s affiche tel quel, sans rien exécuter ===');
const dialogues = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.method === 'Page.javascriptDialogOpening') { dialogues.push(d.params.message); send('Page.handleJavaScriptDialog', { accept: true }); } });
await ev(`window.__xss = 0`);
for (const piege of ['<img src=x onerror=alert(1)>', '<img src=x onerror="window.__xss=1">', '"><svg onload=alert(1)>']) {
  await aller2('#/profil');
  await ev(`(()=>{const f=document.querySelector('.pf-form');f.prenom.value=${JSON.stringify(piege)};f.requestSubmit();})()`); await sleep(500);
  const toast = await ev(`[...document.querySelectorAll('.cp-notif__texte')].pop()?.textContent ?? 'ABSENT'`);
  verifier(toast.includes(piege), `« ${piege} » — message de confirmation (toast) : affiché comme texte`);
  const profil = await ev(`({ champ: document.querySelector('#profil-prenom').value, titre: document.querySelector('h1').textContent, avatar: document.querySelector('.pg-entete .cp-avatar').textContent })`);
  verifier(profil.champ === piege, '  page Profil : le champ contient exactement le texte saisi');
  verifier(profil.avatar.length <= 3, '  page Profil : l avatar n affiche que des initiales, en texte');
  await aller2('#/accueil');
  const accueil = await ev(`({ h1: document.querySelector('h1').textContent, avatarHaut: document.querySelector('.app-lateral [data-nav=profil] .cp-avatar')?.textContent, labelHaut: document.querySelector('#nav-bas [data-nav=profil]').getAttribute('aria-label'), lateral: document.querySelector('.app-lateral [data-nav=profil] .app-nav__texte').textContent, labelLateral: document.querySelector('.app-lateral [data-nav=profil]').getAttribute('aria-label') })`);
  verifier(accueil.h1 === 'Bonjour ' + piege.replace(/\s+/g, ' ').trim().slice(0, 40), '  Accueil : titre « Bonjour » + le texte tel quel');
  verifier(accueil.avatarHaut.length <= 3 && accueil.lateral === piege.slice(0, 40) && accueil.labelHaut === 'Profil de ' + piege.slice(0, 40) && accueil.labelLateral === accueil.labelHaut, '  avatar du haut, barre latérale et noms accessibles : texte uniquement');
  const balises = await ev(`document.querySelectorAll('img[src="x"], svg[onload], [onerror], [onload]').length`);
  verifier(balises === 0, '  aucune balise créée à partir du prénom (img, svg, onerror, onload)');
  verifier(dialogues.length === 0 && await ev(`window.__xss`) === 0, '  aucune boîte alert() ni script exécuté');
}
await saisir('Léa');

log('=== RECHARGEMENT : les données et le prénom sont conservés ===');
const avant = JSON.stringify(await donnees());
await send('Page.reload'); await sleep(1800);
verifier(JSON.stringify(await donnees()) === avant, 'après rechargement, données identiques (aucun animal d exemple rajouté)');
await ev(axeSrc); // la page vient d'être rechargée : on réinjecte le moteur d'accessibilité

log('=== EXPORT / IMPORT AVEC PRÉNOM ===');
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
verifier(JSON.parse(exp).profil.prenom === 'Léa', 'l export contient profil.prenom');
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
verifier((await donnees()).profil.prenom === '', 'tout effacer : prénom effacé');
await importer(exp);
verifier((await donnees()).profil.prenom === 'Léa', 'réimport : prénom restauré');
for (const bizarre of [{ prenom: 42 }, { prenom: null }, 'texte', null, []]) {
  await importer(JSON.stringify({ ...JSON.parse(ancienExport), profil: bizarre }));
  verifier((await donnees()).profil.prenom === '', `profil invalide ${JSON.stringify(bizarre)} : ignoré, prénom vide`);
}

log('=== NAVIGATION : section Bientôt ===');
await taille(1280, 900); await aller2('#/accueil');
verifier(await ev(`getComputedStyle(document.querySelector('.app-bientot__liste')).display`) === 'none', 'repliée par défaut sur ordinateur');
await ev(`document.querySelector('.app-bientot__titre').click()`); await sleep(200);
verifier(await ev(`document.querySelector('.app-bientot__titre').getAttribute('aria-expanded')`) === 'true' && await ev(`getComputedStyle(document.querySelector('.app-bientot__liste')).display`) !== 'none', 'dépliée au clic (aria-expanded = true)');
await ev(`document.querySelector('.app-bientot__titre').click()`); await sleep(100);
await aller2('#/boutique');
verifier(await ev(`document.querySelector('.app-bientot--ouvert')!==null`), 'dépliée d office sur la page d un module à venir');
await taille(820, 1000); await sleep(200);
verifier(await ev(`[...document.querySelectorAll('.app-lateral .app-bientot [data-nav]')].every(a=>a.getBoundingClientRect().width>0)`), 'tablette : modules à venir visibles (icônes)');
await axe('#app', 'navigation tablette'); await taille(1280, 900);
await aller2('#/accueil');
await axe('#app', 'accueil avec prénom (ordinateur)');

log('=== PESÉES : graphique et info-bulle avec le nouveau style ===');
await importer(ancienExport);
await taille(1280, 900); await aller2('#/animaux/a'); await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(300);
verifier(await ev(`!!document.querySelector('.ps-graphique') && !document.querySelector('.ps-graphique').outerHTML.includes('NaN')`), 'graphique présent, sans NaN');
const geo = await ev(`(()=>{const g=document.querySelector('.ps-graphique');const lignes=[...g.querySelectorAll('.ps-grille')].map(l=>{const r=l.getBoundingClientRect();return r.top+r.height/2});const textes=[...g.querySelectorAll('text.ps-texte')].slice(0,lignes.length).map(t=>{const r=t.getBoundingClientRect();return r.top+r.height/2});return {ecarts:lignes.map((y,i)=>Math.abs(y-textes[i])),n:lignes.length}})()`);
verifier(geo.n > 0 && Math.max(...geo.ecarts) <= 6, `graduations alignées sur leurs lignes (écart max ${Math.max(...geo.ecarts).toFixed(1)} px)`);
const cible = (i) => ev(`(()=>{const c=document.querySelectorAll('.ps-cible')[${i}];c.scrollIntoView({block:'center'});const r=c.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
const c = await cible(1);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y }); await sleep(300);
verifier(await ev(`(()=>{const b=document.querySelector('.ps-infobulle');return !b.hidden && b.textContent.includes('510')})()`), 'souris : info-bulle affichée avec la valeur');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await sleep(200);
await taille(390, 844); await sleep(300);
const c2 = await cible(0);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c2.x, y: c2.y }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
verifier(await ev(`(()=>{const b=document.querySelector('.ps-infobulle');return !b.hidden && b.textContent.includes('500')})()`), 'toucher (mobile) : info-bulle affichée avec la valeur');
await ecran('pesees-graphique-mobile');

log('=== TÉLÉPHONE : tailles tactiles et champs ===');
await importer(JSON.stringify({ ...JSON.parse(ancienExport), soins: [{ id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: '2025-01-01', notes: '', rappel: '2025-02-01', rappelFait: false }] }));
await aller2('#/animaux/rappels');
const mesures = await ev(`({fait:[...document.querySelectorAll('[data-fait]')].map(e=>Math.round(e.getBoundingClientRect().height)),une_ligne:[...document.querySelectorAll('.rp-ligne')].map(e=>e.getBoundingClientRect().height<=22)})`);
verifier(mesures.fait.length > 0 && mesures.fait.every((x) => x >= 44), `bouton « Fait » : ${mesures.fait.join(', ')} px (44 minimum)`);
verifier(mesures.une_ligne.length > 0 && mesures.une_ligne.every(Boolean), '« Prévu le… » tient sur une seule ligne');
await aller2('#/profil');
verifier(await ev(`[...document.querySelectorAll('input,select,textarea')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)`), 'champs de saisie à 16 px minimum');
verifier(await sansDebord(), 'sans défilement horizontal');

await importer(exp);
const exp1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await importer(exp1);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp1) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
