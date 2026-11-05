import { spawn } from 'node:child_process';
import fs from 'node:fs';
const S = process.argv[2], URL = process.argv[3], TAG = process.argv[4];
const E = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; // chemin de msedge.exe : à adapter avec la variable EDGE si besoin
const port = +(process.env.PORT || 9343);
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
const moisPlus = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const soinsDe = async (id) => (await donnees()).soins.filter((s) => s.animalId === id);

await send('Page.navigate', { url: URL }); await sleep(1800);
await taille(1280, 900); await aller('#/animaux'); await ev(axeSrc);

const gros = []; for (let i = 0; i < 70; i++) gros.push({ id: 'g' + i, animalId: 'b', type: ['vaccin', 'vermifuge', 'antiparasitaire', 'veto', 'autre'][i % 5], titre: 'Soin n°' + i, date: jour(-10 - i * 9), notes: '', rappel: '', rappelFait: false });
const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: '', naissance: '2023-08-01', photo: '' }, { id: 'b', nom: 'Filou', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' }, { id: 'c', nom: 'Vide', espece: 'lapin', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [
    { id: 's-retard', animalId: 'a', type: 'vaccin', titre: 'Rage', date: jour(-200), notes: 'Premier rappel annuel.\nLigne 2', rappel: jour(-10), rappelFait: false },
    { id: 's-venir', animalId: 'a', type: 'vermifuge', titre: 'Milbemax', date: jour(-60), notes: '', rappel: jour(30), rappelFait: false },
    { id: 's-traite', animalId: 'a', type: 'veto', titre: '', date: jour(-400), notes: '', rappel: jour(-300), rappelFait: true },
    { id: 's-simple', animalId: 'a', type: 'antiparasitaire', titre: 'Frontline', date: jour(-5), notes: '', rappel: '', rappelFait: false },
    { id: 's-futur', animalId: 'a', type: 'autre', titre: 'Détartrage', date: jour(20), notes: '', rappel: '', rappelFait: false },
    { id: 's-inconnu', animalId: 'a', type: 'type-futur', titre: 'Mystère', date: jour(-100), notes: '', rappel: '', rappelFait: false },
    { id: 's-xss', animalId: 'a', type: 'vaccin', titre: '<img src=x onerror=alert(1)>', date: jour(-90), notes: '<b>gras</b>', rappel: '', rappelFait: false },
    { id: 's-b1', animalId: 'b', type: 'vaccin', titre: 'SOIN-DE-FILOU', date: jour(-3), notes: '', rappel: jour(2), rappelFait: false },
    ...gros],
  pesees: [] };
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(JSON.stringify(fichier))}))`);

// ===== 1. Liste des soins
for (const [tn, w, h] of [['ordinateur', 1280, 900], ['tablette', 820, 1000], ['mobile', 390, 844]]) {
  await taille(w, h); await aller2('#/animaux/a'); await sleep(300); await clip(`soins-liste-${tn}`, '#fi-panneau-sante', 2600);
  log('liste des soins', tn, ': sans défilement horizontal =', await sansDebord());
  await axe('#contenu', 'soins ' + tn);
}
await taille(1280, 900); await aller2('#/animaux/a');
log('cartes :', await ev(`document.querySelectorAll('.sn-carte').length`), '(7 soins de Moka attendus) | aucun soin de Filou =', await ev(`!document.querySelector('.sn-liste').textContent.includes('FILOU')`));
const statuts = await ev(`[...document.querySelectorAll('.sn-carte')].map(c=>c.querySelector('.sn-carte__nom').textContent+' => '+c.querySelector('.cp-badge').textContent.trim()).join('\\n')`);
log('statuts :\n' + statuts);
log('boutons Fait seulement pour les rappels en attente :', await ev(`[...document.querySelectorAll('.sn-carte')].filter(c=>c.querySelector('[data-act=fait]')).map(c=>c.querySelector('.sn-carte__nom').textContent).join(', ')`));
log('type inconnu affiché comme « Autre soin » avec l\'icône bandage :', await ev(`(()=>{const c=[...document.querySelectorAll('.sn-carte')].find(x=>x.textContent.includes('Mystère'));return c.textContent.includes('Autre soin')&&!!c.querySelector('svg')})()`));
log('HTML dans le nom ou la note : affiché comme texte, aucune balise injectée =', await ev(`!document.querySelector('.sn-liste img') && document.querySelector('.sn-liste').textContent.includes('<img src=x')`));
log('boutons d\'action nommés :', await ev(`[...document.querySelectorAll('.sn-carte')[1].querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||b.textContent.trim()).join(' | ')`));
log('notes sur plusieurs lignes conservées :', await ev(`getComputedStyle(document.querySelector('.sn-carte__notes')).whiteSpace`));

// ===== 2. Formulaire d'ajout
for (const [tn, w, h] of [['ordinateur', 1280, 800], ['tablette', 820, 1000], ['mobile', 390, 844]]) {
  await taille(w, h); await aller2('#/animaux/a'); await ev(`document.querySelector('[data-act=ajouter]').click()`); await sleep(500);
  await ecran(`soin-formulaire-${tn}`);
  log('formulaire soin', tn, ': pastilles =', await ev(`[...document.querySelectorAll('dialog input[name=type]')].map(i=>i.value).join()`), '| coché =', await ev(`document.querySelector('dialog input[name=type]:checked').value`), '| sans défilement horizontal =', await sansDebord());
  await axe('dialog', 'formulaire soin ' + tn);
  await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(300);
}
await taille(1280, 800); await aller2('#/animaux/a');
const avant = await donnees();
await ev(`document.querySelector('[data-act=ajouter]').click()`); await sleep(400);
log('titre de la fenêtre :', await texte('dialog h2'), '| focus initial :', await ev(`document.activeElement.name||document.activeElement.tagName`));
await ev(`(()=>{const d=document.querySelector('#soin-date');d.value='';d.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(200);
log('sans date : erreur =', await texte('#soin-date-erreur'), '| aria-invalid =', await ev(`document.querySelector('#soin-date').getAttribute('aria-invalid')`), '| focus =', await ev(`document.activeElement.id`), '| rien enregistré =', (await donnees()).soins.length === avant.soins.length);
await ecran('soin-formulaire-erreur-ordinateur'); await axe('dialog', 'formulaire soin en erreur');
await ev(`document.querySelector('#soin-date').focus()`); await ev(`document.querySelector('dialog input[name=type]:checked').focus()`);
await touche('ArrowRight', 'ArrowRight', 39); await touche('ArrowRight', 'ArrowRight', 39);
log('flèches : type =', await ev(`document.querySelector('dialog input[name=type]:checked').value`), '(antiparasitaire attendu)');
await ev(`(()=>{const f=document.querySelector('dialog form');f.titre.value='Bravecto';f.date.value='${jour(0)}';f.notes.value='Comprimé à jeun';f.rappel.value='${jour(90)}'; f.requestSubmit()})()`); await sleep(500);
const ap = await donnees(); const nouveau = ap.soins.find((s) => s.titre === 'Bravecto');
log('soin enregistré :', JSON.stringify(nouveau));
log('mêmes clés que les anciens soins :', Object.keys(nouveau).sort().join() === Object.keys(avant.soins[0]).sort().join(), '|', Object.keys(nouveau).sort().join());
log('associé au bon animal (Moka = a) :', nouveau.animalId === 'a', '| soins de Filou inchangés =', JSON.stringify(ap.soins.filter((s) => s.animalId === 'b')) === JSON.stringify(avant.soins.filter((s) => s.animalId === 'b')));
log('nouvelle carte visible :', await ev(`[...document.querySelectorAll('.sn-carte__nom')].some(n=>n.textContent==='Bravecto')`), '| statut =', await ev(`[...document.querySelectorAll('.sn-carte')].find(c=>c.textContent.includes('Bravecto')).querySelector('.cp-badge').textContent.trim()`));
// soin sans rappel ni note, seulement la date
await ev(`document.querySelector('[data-act=ajouter]').click()`); await sleep(300);
await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(400);
const ap2 = await donnees(); const mini = ap2.soins.find((s) => !ap.soins.some((x) => x.id === s.id));
log('soin minimal (juste la date) :', JSON.stringify(mini));

// ===== 3. Modification
await ev(`document.querySelector('[data-act=modifier][data-id="s-retard"]').click()`); await sleep(400);
log('modification : titre =', await texte('dialog h2'), '| valeurs =', await ev(`(()=>{const f=document.querySelector('dialog form');return [f.type.value,f.titre.value,f.date.value,f.notes.value.replace(/\\n/g,'/'),f.rappel.value].join(' | ')})()`));
await ecran('soin-modification-ordinateur');
await ev(`(()=>{const f=document.querySelector('dialog form');f.notes.value='Note modifiée';f.requestSubmit()})()`); await sleep(400);
let s1 = (await donnees()).soins.find((s) => s.id === 's-retard');
log('modif de la note seule : rappel conservé =', s1.rappel === jour(-10), '| rappelFait =', s1.rappelFait, '| animal =', s1.animalId, '| id conservé');
await ev(`document.querySelector('[data-act=modifier][data-id="s-traite"]').click()`); await sleep(300);
log('rappel déjà traité : aide =', await texte('#soin-rappel-aide'));
await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(300);
log('  enregistré sans rien changer : rappelFait reste =', (await donnees()).soins.find((s) => s.id === 's-traite').rappelFait, '(true attendu)');
await ev(`document.querySelector('[data-act=modifier][data-id="s-traite"]').click()`); await sleep(300);
await ev(`(()=>{const f=document.querySelector('dialog form');f.rappel.value='${jour(50)}';f.requestSubmit()})()`); await sleep(300);
log('  nouvelle date de rappel : rappelFait repasse à =', (await donnees()).soins.find((s) => s.id === 's-traite').rappelFait, '(false attendu)');
await ev(`document.querySelector('[data-act=modifier][data-id="s-inconnu"]').click()`); await sleep(300);
log('type inconnu ouvert en modification -> coché =', await ev(`document.querySelector('dialog input[name=type]:checked').value`), '(autre attendu)');
await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(200);
log('  annulé : type d\'origine conservé =', (await donnees()).soins.find((s) => s.id === 's-inconnu').type);

// ===== 4. Rappel effectué
await taille(1280, 800); await aller2('#/animaux/a');
for (const [tn, w, h] of [['ordinateur', 1280, 800], ['tablette', 820, 1000], ['mobile', 390, 844]]) {
  await taille(w, h); await aller2('#/animaux/a'); await ev(`document.querySelector('[data-act=fait][data-id="s-retard"]').click()`); await sleep(500);
  await ecran(`rappel-fait-${tn}`); await axe('dialog', 'rappel effectué ' + tn);
  log('rappel effectué', tn, ': sans défilement horizontal =', await sansDebord());
  if (tn === 'ordinateur') {
    log('  résumé :', await texte('.rf-resume'));
    log('  options :', await ev(`[...document.querySelectorAll('dialog input[name=delai]')].map(i=>i.nextElementSibling.textContent).join(' / ')`), '| défaut =', await ev(`document.querySelector('dialog input[name=delai]:checked').value`));
    log('  conséquence (Non) :', await texte('[data-consequence]'));
    await ev(`document.querySelector('dialog input[name=delai][value="3"]').click()`); await sleep(100);
    log('  conséquence (3 mois) :', await texte('[data-consequence]'));
    await ecran('rappel-fait-3mois-ordinateur');
  }
  await touche('Escape', 'Escape', 27);
}
const avantFait = await donnees();
log('Échap : aucune donnée modifiée =', JSON.stringify(avantFait) === JSON.stringify(await donnees()));
await taille(1280, 800); await aller2('#/animaux/a');
// A. « Non »
await ev(`document.querySelector('[data-act=fait][data-id="s-retard"]').click()`); await sleep(300); await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(500);
const apA = await donnees();
const orig = avantFait.soins.find((s) => s.id === 's-retard'), origA = apA.soins.find((s) => s.id === 's-retard');
log('« Non » : seul rappelFait change =', JSON.stringify({ ...orig, rappelFait: true }) === JSON.stringify(origA), '| aucun soin ajouté =', apA.soins.length === avantFait.soins.length, '| autres soins inchangés =', JSON.stringify(apA.soins.filter((s) => s.id !== 's-retard')) === JSON.stringify(avantFait.soins.filter((s) => s.id !== 's-retard')));
log('  la carte passe à :', await ev(`[...document.querySelectorAll('.sn-carte')].find(c=>c.textContent.includes('Rage')).querySelector('.cp-badge').textContent.trim()`), '| bouton Fait disparu =', await ev(`!document.querySelector('[data-act=fait][data-id="s-retard"]')`));
// B. « 3 mois »
await ev(`document.querySelector('[data-act=fait][data-id="s-venir"]').click()`); await sleep(300);
await ev(`document.querySelector('dialog input[name=delai][value="3"]').click()`); await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(500);
const apB = await donnees();
const nvx = apB.soins.filter((s) => !apA.soins.some((x) => x.id === s.id));
log('« 3 mois » : soins ajoutés =', nvx.length, '|', JSON.stringify(nvx[0]));
log('  nouveau soin : même animal, même type et même nom =', nvx[0].animalId === 'a' && nvx[0].type === 'vermifuge' && nvx[0].titre === 'Milbemax', '| date = aujourd\'hui =', nvx[0].date === jour(0), '| rappel = +3 mois =', nvx[0].rappel === moisPlus(3), '| rappelFait = false =', nvx[0].rappelFait === false);
const o2 = apA.soins.find((s) => s.id === 's-venir'), o2b = apB.soins.find((s) => s.id === 's-venir');
log('  soin d\'origine : seul rappelFait change =', JSON.stringify({ ...o2, rappelFait: true }) === JSON.stringify(o2b));
log('  soins de Filou inchangés =', JSON.stringify(apB.soins.filter((s) => s.animalId === 'b')) === JSON.stringify(avantFait.soins.filter((s) => s.animalId === 'b')));
await ecran('soins-apres-rappel-fait-ordinateur');

// C. « Autre date » (ajout de cette session)
await ev(`document.querySelector('[data-act=ajouter]').click()`); await sleep(300);
await ev(`(()=>{const f=document.querySelector('dialog form');f.titre.value='Leishmaniose';f.rappel.value='${jour(5)}';f.requestSubmit()})()`); await sleep(400);
const idL = (await donnees()).soins.find((s) => s.titre === 'Leishmaniose').id;
await ev(`document.querySelector('[data-act=fait][data-id="${idL}"]').click()`); await sleep(400);
log('« Autre date » : champ caché au départ =', await ev(`document.querySelector('.rf-date').hidden`));
await ev(`document.querySelector('dialog input[name=delai][value=date]').click()`); await sleep(150);
log('  champ affiché =', await ev(`!document.querySelector('.rf-date').hidden`), '| focus =', await ev(`document.activeElement.id`), '| conséquence =', await texte('[data-consequence]'));
const avC = await donnees();
await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(200);
log('  vide : erreur =', await texte('#rf-date-erreur'), '| aria-invalid =', await ev(`document.querySelector('#rf-date').getAttribute('aria-invalid')`), '| rien enregistré =', JSON.stringify(avC) === JSON.stringify(await donnees()));
await ev(`(()=>{const d=document.querySelector('#rf-date');d.value='${jour(-3)}';d.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('dialog form').requestSubmit()})()`); await sleep(200);
log('  passée : erreur =', await texte('#rf-date-erreur'), '| rien enregistré =', JSON.stringify(avC) === JSON.stringify(await donnees()));
await ecran('rappel-fait-erreur-ordinateur'); await axe('dialog', 'rappel effectué en erreur');
await ev(`(()=>{const d=document.querySelector('#rf-date');d.value='${jour(45)}';d.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(150);
log('  erreur effacée en corrigeant =', await ev(`!document.querySelector('#rf-date-erreur')`), '| conséquence =', await texte('[data-consequence]'));
await ecran('rappel-fait-autre-date-ordinateur');
await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(500);
const apC = await donnees(); const nvC = apC.soins.filter((s) => !avC.soins.some((x) => x.id === s.id));
log('  enregistré : 1 soin ajouté =', nvC.length === 1, '| rappel =', nvC[0]?.rappel === jour(45), '| animal =', nvC[0]?.animalId, '| clés =', Object.keys(nvC[0] || {}).sort().join());
log('  origine : seul rappelFait change =', JSON.stringify({ ...avC.soins.find((s) => s.id === idL), rappelFait: true }) === JSON.stringify(apC.soins.find((s) => s.id === idL)));
// D. Depuis la page Rappels (même fenêtre, partagée)
await aller2('#/animaux/rappels'); await sleep(300);
const nbFaitR = await ev(`document.querySelectorAll('[data-fait]').length`);
await ev(`document.querySelector('[data-fait]').click()`); await sleep(400);
log('page Rappels : boutons Fait =', nbFaitR, '| fenêtre ouverte =', await texte('dialog h2'));
await ecran('rappel-fait-depuis-rappels'); await touche('Escape', 'Escape', 27);
await aller2('#/animaux/a');

// ===== 5. Suppression
await ev(`document.querySelector('[data-act=supprimer][data-id="s-simple"]').click()`); await sleep(400);
log('confirmation :', await texte('dialog .cp-modale__corps'));
await ev(`document.querySelector('dialog [data-non]').click()`); await sleep(200);
log('  Annuler : soin toujours là =', (await donnees()).soins.some((s) => s.id === 's-simple'));
const avS = await donnees();
await ev(`document.querySelector('[data-act=supprimer][data-id="s-simple"]').click()`); await sleep(300); await ev(`document.querySelector('dialog [data-oui]').click()`); await sleep(500);
const apS = await donnees();
log('  Supprimer : un seul soin retiré =', apS.soins.length === avS.soins.length - 1 && !apS.soins.some((s) => s.id === 's-simple'), '| animaux et pesées intacts =', apS.animaux.length === avS.animaux.length && apS.pesees.length === avS.pesees.length);

// ===== 6. Animal sans soin, longue liste
await aller2('#/animaux/c'); await sleep(300);
log('animal sans soin :', await texte('#fi-panneau-sante'));
for (const [tn, w, h] of [['ordinateur', 1280, 800], ['mobile', 390, 844]]) { await taille(w, h); await aller2('#/animaux/c'); await clip(`soins-vide-${tn}`, '#fi-panneau-sante', 900); await axe('#contenu', 'soins vides ' + tn); }
await taille(1280, 900); const t0 = Date.now(); await aller2('#/animaux/b'); log('Filou (71 soins) : cartes =', await ev(`document.querySelectorAll('.sn-carte').length`), '| affichage en', Date.now() - t0, 'ms (dont 500 ms d\'attente du test)');
await axe('#contenu', 'liste de 71 soins');
await taille(390, 844); await aller2('#/animaux/b'); log('  mobile : sans défilement horizontal =', await sansDebord());

// ===== 7. Rappels et accueil toujours cohérents + export / import
await aller2('#/animaux/rappels'); log('page Rappels (5f à venir) : fonctionne =', await ev(`!!document.querySelector('#contenu h1')`), '|', await texte('#contenu h1'));
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
ws.close(); proc.kill(); process.exit(0);
