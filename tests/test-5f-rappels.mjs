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
const moisPlus = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const soinsDe = async (id) => (await donnees()).soins.filter((s) => s.animalId === id);

await send('Page.navigate', { url: URL }); await sleep(1800);
await taille(1280, 900); await aller('#/animaux'); await ev(axeSrc);
const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [
    { id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: 'Berger australien', naissance: '2023-08-01', photo: '' },
    { id: 'b', nom: 'Filou', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' },
    { id: 'c', nom: 'Noisette', espece: 'lapin', especeAutre: '', race: '', naissance: '', photo: '' },
    { id: 'x', nom: '<i>Pirate</i>', espece: 'espece-future', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [
    { id: 'r-retard', animalId: 'a', type: 'vaccin', titre: 'Rage', date: jour(-370), notes: 'Note de la rage', rappel: jour(-10), rappelFait: false },
    { id: 'r-auj', animalId: 'b', type: 'vermifuge', titre: 'Milbemax', date: jour(-90), notes: '', rappel: jour(0), rappelFait: false },
    { id: 'r-sem', animalId: 'a', type: 'antiparasitaire', titre: 'Frontline', date: jour(-25), notes: '', rappel: jour(5), rappelFait: false },
    { id: 'r-tard', animalId: 'c', type: 'veto', titre: '', date: jour(-160), notes: '', rappel: jour(40), rappelFait: false },
    { id: 'r-tard2', animalId: 'b', type: 'type-futur', titre: 'Mystère', date: jour(-10), notes: '', rappel: jour(120), rappelFait: false },
    { id: 'r-xss', animalId: 'x', type: 'vaccin', titre: '<img src=x onerror=alert(1)>', date: jour(-10), notes: '', rappel: jour(-2), rappelFait: false },
    { id: 'r-fait1', animalId: 'a', type: 'vaccin', titre: 'CHPL', date: jour(-400), notes: '', rappel: jour(-35), rappelFait: true },
    { id: 'r-fait2', animalId: 'b', type: 'vermifuge', titre: '', date: jour(-200), notes: '', rappel: jour(-100), rappelFait: true },
    { id: 'r-orphelin', animalId: 'disparu', type: 'vaccin', titre: 'Orphelin', date: jour(-10), notes: '', rappel: jour(3), rappelFait: false },
    { id: 's-sans', animalId: 'a', type: 'veto', titre: 'Sans rappel', date: jour(-3), notes: '', rappel: '', rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'a', date: jour(-3), poids: 21.4 }] };
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(JSON.stringify(fichier))}))`);
const cartes = () => ev(`[...document.querySelectorAll('.rp-carte')].map(c=>c.querySelector('.rp-carte__nom').textContent+'/'+c.querySelector('.rp-animal').textContent.trim()).join(', ')`);
const groupes = () => ev(`[...document.querySelectorAll('.rp-groupe__titre')].map(h=>h.textContent.replace(/\\s+/g,' ').trim()).join(' | ')`);
const statut = async (v) => { await ev(`document.querySelector('input[name="rp-statut"][value="${v}"]').click()`); await sleep(150); };
const animal = async (v) => { await ev(`(()=>{const s=document.querySelector('#rp-animal');s.value='${v}';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(150); };
const pastilles = () => ev(`[...document.querySelectorAll('.rp-statuts .cp-choix__option span')].map(s=>s.textContent.replace(/\\s+/g,' ').trim()).join(' / ')`);
const chiffres = () => ev(`[...document.querySelectorAll('.rp-statuts input')].map(i=>i.nextElementSibling.textContent.replace(/\\s+/g,' ').trim().replace(/ (\\d+)$/, '=$1')).join(' ')`);
const badgeNav = () => ev(`(()=>{const c=document.querySelector('.app-lateral [data-nav=rappels] [data-retards]');return c.hidden?'':c.textContent.trim()})()`);

// ===== 1. Affichage sur les trois formats
const d0 = await donnees();
for (const [tn, w, h] of [['ordinateur', 1280, 900], ['tablette', 820, 1000], ['mobile', 390, 844]]) {
  await taille(w, h); await aller2('#/animaux/rappels'); await sleep(300);
  await clip(`rappels-${tn}`, '#contenu', 3200); await ecran(`rappels-ecran-${tn}`);
  log(tn, ': sans défilement horizontal =', await sansDebord()); await axe('#contenu', 'rappels ' + tn);
}
await taille(1280, 900); await aller2('#/animaux/rappels');
log('sous-titre :', await texte('.rp-page .pg-entete p'));
log('nombres des boutons de filtre :', await chiffres(), '(attendu À faire=6 En retard=2 À venir=4 Effectués=2)', '| plus aucun carré de chiffres =', await ev(`!document.querySelector('.rp-chiffres, .rp-chiffre')`));
log('groupes par défaut :', await groupes());
log('cartes (ordre) :', await cartes());
log('soin orphelin (animal disparu) absent =', await ev(`!document.querySelector('#contenu').textContent.includes('Orphelin')`), '| soin sans rappel absent =', await ev(`!document.querySelector('#contenu').textContent.includes('Sans rappel')`));
log('XSS : aucune balise injectée =', await ev(`!document.querySelector('#contenu img, #contenu i')`), '| texte affiché tel quel =', await ev(`document.querySelector('#contenu').textContent.includes('<i>Pirate</i>')`));
log('pastilles :', await pastilles());
log('noms des boutons Fait (uniques) :', await ev(`(()=>{const n=[...document.querySelectorAll('[data-fait]')].map(b=>b.getAttribute('aria-label'));return n.length+' boutons, '+new Set(n).size+' noms différents · ex. « '+n[0]+' »'})()`));
log('liens « Voir le soin » :', await ev(`[...document.querySelectorAll('.rp-carte a.cp-btn')].map(a=>a.getAttribute('href')).join(' ')`));
log('liens animal :', await ev(`[...document.querySelectorAll('.rp-animal')].map(a=>a.getAttribute('href')).join(' ')`));
log('pastille de la barre du haut :', await badgeNav());

// ===== 2. Filtres (affichage seulement)
await statut('retard'); log('filtre « En retard » :', await groupes(), '·', await cartes(), '| annonce =', await texte('[data-resultat]'));
await statut('a-venir'); log('filtre « À venir » :', await groupes(), '·', await cartes());
await statut('faits'); log('filtre « Effectués » :', await groupes(), '·', await cartes(), '| boutons Fait =', await ev(`document.querySelectorAll('[data-fait]').length`), '| badges =', await ev(`[...document.querySelectorAll('.rp-carte .cp-badge')].map(b=>b.textContent.trim()).join(',')`));
await clip('rappels-effectues-ordinateur', '.rp-page', 1600);
await statut('a-faire'); await ev(`document.querySelector('input[name="rp-statut"]:checked').focus()`);
await touche('ArrowRight', 'ArrowRight', 39);
log('clavier (flèche droite) -> filtre =', await ev(`document.querySelector('input[name="rp-statut"]:checked').value`), '(retard attendu)');
await statut('a-faire');
await animal('b'); log('animal Filou : pastilles =', await pastilles(), '·', await cartes(), '| annonce =', await texte('[data-resultat]'));
await statut('faits'); log('  Filou + Effectués :', await cartes());
await animal('c'); await statut('retard');
log('Noisette + En retard : état vide =', await texte('[data-groupes]'));
await clip('rappels-filtre-vide-ordinateur', '.rp-page', 1400); await axe('#contenu', 'filtre sans résultat');
await ev(`document.querySelector('[data-reinitialiser]').click()`); await sleep(150);
log('  « Voir tous les rappels à faire » -> filtre =', await ev(`document.querySelector('input[name="rp-statut"]:checked').value`), '| animal =', JSON.stringify(await ev(`document.querySelector('#rp-animal').value`)), '| focus =', await ev(`document.activeElement.value`));
log('options de la liste Animal :', await ev(`[...document.querySelectorAll('#rp-animal option')].map(o=>o.textContent).join(', ')`));
log('filtrer n\'a rien modifié =', JSON.stringify(d0) === JSON.stringify(await donnees()));

// ===== 3. Filtre gardé + « Fait » depuis la page
await animal('a');
await ev(`document.querySelector('[data-fait="r-sem"]').click()`); await sleep(400);
log('fenêtre :', await texte('dialog h2'), '·', await texte('.rf-resume'));
await ecran('rappels-fait-fenetre-ordinateur');
const av1 = await donnees();
await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(600);
const ap1 = await donnees();
log('« Non » : seul rappelFait de r-sem change =', JSON.stringify(av1.soins.map((s) => s.id === 'r-sem' ? { ...s, rappelFait: true } : s)) === JSON.stringify(ap1.soins), '| animaux/pesées intacts =', JSON.stringify(av1.animaux) === JSON.stringify(ap1.animaux) && JSON.stringify(av1.pesees) === JSON.stringify(ap1.pesees));
log('  après : filtre animal gardé =', await ev(`document.querySelector('#rp-animal').value`), '| focus =', await ev(`document.activeElement.tagName+' '+document.activeElement.textContent`), '| chiffres =', await chiffres(), '| cartes =', await cartes());
await taille(390, 844); await aller2('#/animaux/rappels'); await ecran('rappels-filtre-mobile'); await taille(1280, 900); await aller2('#/animaux/rappels');
await animal('');
await ev(`document.querySelector('[data-fait="r-retard"]').click()`); await sleep(300);
await ev(`document.querySelector('dialog input[name=delai][value="12"]').click()`); await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(600);
const ap2 = await donnees(); const nv = ap2.soins.filter((s) => !ap1.soins.some((x) => x.id === s.id));
log('« 1 an » : 1 soin ajouté =', nv.length === 1, '| même animal (Moka) =', nv[0]?.animalId === 'a', '| même type/nom =', nv[0]?.type === 'vaccin' && nv[0]?.titre === 'Rage', '| rappel =', nv[0]?.rappel, '| clés =', Object.keys(nv[0] || {}).sort().join());
log('  soin d\'origine : seul rappelFait change =', JSON.stringify({ ...ap1.soins.find((s) => s.id === 'r-retard'), rappelFait: true }) === JSON.stringify(ap2.soins.find((s) => s.id === 'r-retard')));
log('  chiffres =', await chiffres(), '| pastille du haut =', await badgeNav(), '| sous-titre =', await texte('.rp-page .pg-entete p'));

// ===== 4. « Voir le soin » et lien animal
await aller2('#/animaux/b'); await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(200); // onglet Poids mémorisé pour Filou
await aller2('#/animaux/rappels');
await ev(`document.querySelector('.rp-carte a.cp-btn[href*="r-tard2"]').click()`); await sleep(900);
log('« Voir le soin » (Mystère, Filou) : adresse =', await ev(`location.hash`), '| fiche =', await texte('.fi-entete h1'), '| onglet =', await ev(`document.querySelector('[role=tab][aria-selected=true]').dataset.onglet`), '(sante attendu)');
log('  carte mise en évidence =', await ev(`document.querySelector('.sn-carte--cible')?.querySelector('.sn-carte__nom').textContent`), '| focus dessus =', await ev(`document.activeElement.classList.contains('sn-carte--cible')`), '| visible à l\'écran =', await ev(`(()=>{const b=document.querySelector('.sn-carte--cible').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight})()`));
await ecran('voir-le-soin-ordinateur');
await taille(390, 844); await aller('#/animaux/rappels'); await ev(`document.querySelector('.rp-carte a.cp-btn[href*="r-auj"]').click()`); await sleep(900);
log('  mobile : cible =', await ev(`document.querySelector('.sn-carte--cible')?.querySelector('.sn-carte__nom').textContent`), '| visible =', await ev(`(()=>{const b=document.querySelector('.sn-carte--cible').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight})()`));
await ecran('voir-le-soin-mobile'); await taille(1280, 900);
await aller('#/animaux/a/soin/r-auj'); await sleep(500);
log('soin d\'un AUTRE animal dans l\'adresse : aucune carte mise en évidence =', await ev(`!document.querySelector('.sn-carte--cible')`), '| message =', await ev(`[...document.querySelectorAll('.cp-notif')].map(n=>n.textContent.trim()).pop()`));
await aller('#/animaux/a/soin/inexistant'); await sleep(400);
log('soin inexistant : fiche affichée =', await texte('.fi-entete h1'), '| aucune erreur');
await aller('#/animaux/rappels'); await ev(`document.querySelector('.rp-animal[href="#/animaux/c"]').click()`); await sleep(600);
log('lien animal : fiche =', await texte('.fi-entete h1'));

// ===== 5. États vides et longue liste
const base = await donnees();
const seulementFaits = { ...base, soins: base.soins.map((s) => s.rappel ? { ...s, rappelFait: true } : s) };
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(JSON.stringify(seulementFaits))}))`);
await aller2('#/animaux/rappels');
log('tout est fait : sous-titre =', await texte('.rp-page .pg-entete p'), '| contenu =', await texte('[data-groupes]'), '| pastille du haut =', JSON.stringify(await badgeNav()));
await clip('rappels-a-jour-ordinateur', '.rp-page', 1400);
const gros = { ...base, soins: [...base.soins] };
for (let i = 0; i < 45; i++) gros.soins.push({ id: 'f' + i, animalId: ['a', 'b', 'c'][i % 3], type: 'vermifuge', titre: 'Ancien ' + i, date: jour(-500 - i * 7), notes: '', rappel: jour(-400 - i * 7), rappelFait: true });
for (let i = 0; i < 25; i++) gros.soins.push({ id: 'g' + i, animalId: ['a', 'b'][i % 2], type: 'vaccin', titre: 'Futur ' + i, date: jour(-30), notes: '', rappel: jour(10 + i * 9), rappelFait: false });
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(JSON.stringify(gros))}))`);
const t0 = Date.now(); await aller2('#/animaux/rappels'); log('longue liste : affichée en', Date.now() - t0, 'ms (dont 500 ms d\'attente) | cartes à faire =', await ev(`document.querySelectorAll('.rp-carte').length`));
await axe('#contenu', 'longue liste');
await statut('faits'); log('  effectués affichés =', await ev(`document.querySelectorAll('.rp-carte').length`), '/', await ev(`document.querySelector('.rp-statuts input[value=faits] + span .rp-nombre').textContent`), '| bouton =', await texte('[data-plus]'));
await ev(`document.querySelector('[data-plus]').click()`); await sleep(200);
log('  après « Afficher plus » :', await ev(`document.querySelectorAll('.rp-carte').length`), '| focus sur le 21e =', await ev(`[...document.querySelectorAll('.rp-carte')].indexOf(document.activeElement.closest('.rp-carte'))`));
await taille(390, 844); log('  mobile : sans défilement horizontal =', await sansDebord()); await taille(1280, 900);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`); await aller2('#/animaux/rappels');
log('aucune donnée :', await texte('#contenu'));
await clip('rappels-vide-ordinateur', '.rp-page', 900); await axe('#contenu', 'page vide');
await taille(390, 844); await aller2('#/animaux/rappels'); await clip('rappels-vide-mobile', '.rp-page', 900); await taille(1280, 900);

// ===== 6. Reste de l'appli + export / import
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(JSON.stringify(base))}))`);
for (const h of ['#/accueil', '#/animaux', '#/animaux/a', '#/animaux/rappels']) { await aller2(h); log('page', h, ': titre =', await texte('#contenu h1')); }
await aller2('#/accueil'); log('accueil : bloc rappels =', await texte('#ac-rappels'), '| lien Tout voir =', await ev(`!!document.querySelector('a.pg-lien[href="#/animaux/rappels"]')`));
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
ws.close(); proc.kill(); process.exit(0);
