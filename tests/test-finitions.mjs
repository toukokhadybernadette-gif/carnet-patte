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
await taille(1280, 900); await aller('#/accueil'); await ev(axeSrc);
// Données d'exemple de l'appli (Moka, Mimi), dates calculées par rapport à aujourd'hui
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/modules/animaux/exemples.js').then(m=>m.ajouterExemples())`);
const d0 = await donnees();
log('aujourd\'hui (appli) =', await ev(`import('/js/utils.js').then(m=>m.aujourdhui())`));
const idMoka = d0.animaux.find((a) => a.nom === 'Moka').id, idMimi = d0.animaux.find((a) => a.nom === 'Mimi').id;
const idVerm = d0.soins.find((s) => s.type === 'vermifuge').id;
const badges = (sel) => ev(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(b=>b.textContent.trim()+' ['+(b.className.replace('cp-badge','').replace('cp-badge--','').trim()||'defaut')+']').join(' | ')`);
const nav = () => ev(`[...document.querySelectorAll('.app-lateral [data-nav]')].map(a=>a.dataset.nav+(a.getAttribute('aria-current')?'*':'')).join(' ')`);

// ===== 1. Dates et couleurs, page par page
await aller2('#/animaux/rappels');
log('RAPPELS — cartes :', await ev(`[...document.querySelectorAll('.rp-carte')].map(c=>c.querySelector('.rp-carte__type')?.textContent??'(aucune petite catégorie)'+' / '+c.querySelector('.rp-carte__nom').textContent+' / '+c.querySelector('.cp-badge').textContent.trim()+' ['+c.querySelector('.cp-badge').className.split('--')[1]+']').join(' || ')`));
log('  chaque carte a sa catégorie =', await ev(`[...document.querySelectorAll('.rp-carte')].every(c=>c.querySelector('.rp-carte__nom').textContent.trim())`), '| « Dernier soin le » =', await ev(`[...document.querySelectorAll('.rp-carte')].every(c=>c.textContent.includes('Dernier soin le'))`), '| « Soin du » restant =', await ev(`document.querySelector('.rp-page').textContent.includes('Soin du')`));
await aller2('#/accueil');
log('ACCUEIL — liste des rappels :', await badges('#ac-rappels ~ .cp-liste .cp-badge, section[aria-labelledby=ac-rappels] .cp-badge'));
log('  résumé de l\'Accueil :', await texte('.ac-resume'), '| actions rapides :', await ev(`[...document.querySelectorAll('.ac-action')].map(a=>a.textContent.trim()).join(', ')`));
log('  3 prochains rappels (soin | animal · date) :', await ev(`[...document.querySelectorAll('section[aria-labelledby=ac-rappels] .cp-liste__ligne')].map(x=>x.querySelector('.cp-liste__titre').textContent+' | '+x.querySelector('.cp-liste__meta').textContent).join(' || ')`));
log('  blocs retirés de l\'Accueil (tous doivent être à 0) : chiffres =', await ev(`document.querySelectorAll('.cp-stat, .pg-stats').length`), '| liste des animaux =', await ev(`document.querySelectorAll('.pg-animaux, section[aria-labelledby=ac-animaux]').length`), '| activité récente =', await ev(`document.querySelectorAll('#ac-activite').length`), '| « Bientôt » =', await ev(`document.querySelectorAll('.pg-bientot').length`), '| boutons répétant le menu =', await ev(`document.querySelectorAll('.pg-tuile').length`));
await aller2('#/animaux');
log('MES ANIMAUX — résumé :', await texte('.al-rappels'));
log('  lien vers les rappels :', await ev(`document.querySelector('.al-rappels a')?.getAttribute('href')`), '| ordre :', await ev(`[...document.querySelectorAll('[data-grille] .cp-carte-animal__nom')].map(n=>n.textContent).join(', ')`));
await aller2('#/animaux/' + idMoka);
log('FICHE MOKA — chiffre :', await ev(`document.querySelectorAll('.fi-chiffre')[2].innerText.replace(/\\s+/g,' ')`));
log('  soins :', await ev(`[...document.querySelectorAll('.sn-carte')].map(c=>c.querySelector('.sn-carte__type')?.textContent??'(aucune petite catégorie)'+' / '+c.querySelector('.sn-carte__nom').textContent+' / '+c.querySelector('.cp-badge').className.split('--')[1]).join(' || ')`));
await ev(`document.querySelector('[data-onglet=historique]').click()`); await sleep(200);
log('  historique, badges de rappel :', await badges('[data-historique] .cp-badge'));
await ev(`document.querySelector('[data-onglet=sante]').click()`);
await aller2('#/animaux/' + idMimi);
log('FICHE MIMI — chiffre :', await ev(`document.querySelectorAll('.fi-chiffre')[2].innerText.replace(/\\s+/g,' ')`));

// ===== 2. Navigation
await aller2('#/animaux/rappels');
log('NAV ordinateur sur Rappels :', await nav(), '| badge =', await ev(`(()=>{const c=document.querySelector('[data-nav=rappels] [data-retards]');return c.hidden?'masqué':c.textContent})()`), '| nom du lien =', await ev(`document.querySelector('[data-nav=rappels]').getAttribute('aria-label')`), '| entrée Rappels du menu active =', await ev(`document.querySelector('.app-lateral [data-nav=rappels]').getAttribute('aria-current')`));
await clip('nav-ordinateur', '#barre-laterale', 900);
for (const [h, nom] of [['#/animaux', 'Mes animaux'], ['#/animaux/' + idMoka, 'fiche'], ['#/accueil', 'Accueil']]) { await aller2(h); log('  sur', nom, ':', await nav(), '| entrée Rappels du menu active =', await ev(`document.querySelector('.app-lateral [data-nav=rappels]').getAttribute('aria-current')`)); }
// clavier : Tab depuis « Mes animaux » arrive sur « Rappels »
await ev(`document.querySelector('[data-nav=animaux]').focus()`); await touche('Tab', 'Tab', 9);
log('  clavier : Tab après « Mes animaux » =', await ev(`document.activeElement.dataset.nav`), '| Entrée ->', await (async () => { await touche('Enter', 'Enter', 13); await sleep(500); return ev(`location.hash`); })());
await taille(820, 1000); await aller2('#/animaux/rappels'); await sleep(200);
log('NAV tablette (barre réduite) :', await nav(), '| compteur visible =', await ev(`(()=>{const c=document.querySelector('[data-nav=rappels] [data-retards]');const b=c.getBoundingClientRect();return !c.hidden&&b.width>0&&getComputedStyle(c).position})()`), '| info-bulle =', await ev(`document.querySelector('[data-nav=rappels]').dataset.etiquette`));
await clip('nav-tablette', '#barre-laterale', 600);
await taille(390, 844); await aller2('#/animaux/rappels'); await sleep(200);
log('NAV mobile : barre du bas =', await ev(`[...document.querySelectorAll('#nav-bas [data-nav]')].map(a=>a.dataset.nav+(a.getAttribute('aria-current')?'*':'')).join(' ')`), '| Rappels (barre du bas) actif =', await ev(`document.querySelector('#nav-bas [data-nav=rappels]').getAttribute('aria-current')`), '| nom :', await ev(`document.querySelector('#nav-bas [data-nav=rappels]').getAttribute('aria-label')`));
await ecran('nav-mobile-rappels');
await taille(1280, 900);

// ===== 3. Captures et accessibilité, trois formats
for (const [tn, w, h] of [['ordinateur', 1280, 900], ['tablette', 820, 1000], ['mobile', 390, 844]]) {
  await taille(w, h);
  for (const [nom, hash] of [['accueil', '#/accueil'], ['animaux', '#/animaux'], ['rappels', '#/animaux/rappels'], ['fiche', '#/animaux/' + idMoka]]) {
    await aller2(hash); await sleep(250);
    await clip(`${nom}-${tn}`, '#contenu', 3000);
    const ok = await sansDebord();
    await axe('body', `${nom} ${tn}${ok ? '' : ' DÉBORDEMENT'}`);
  }
}
await taille(1280, 900);

// ===== 4. « Fait » : annulation puis confirmation ; « Voir le soin » ; filtres
await aller2('#/animaux/rappels');
await ev(`document.querySelector('[data-fait="${idVerm}"]').click()`); await sleep(400);
await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(300);
log('FAIT — Annuler : fenêtre fermée =', await ev(`!document.querySelector('dialog[open]')`), '| aucune donnée modifiée =', JSON.stringify(d0) === JSON.stringify(await donnees()));
await ev(`document.querySelector('[data-fait="${idVerm}"]').click()`); await sleep(400); await touche('Escape', 'Escape', 27);
log('  Échap : aucune donnée modifiée =', JSON.stringify(d0) === JSON.stringify(await donnees()));
await ev(`document.querySelector('[data-fait="${idVerm}"]').click()`); await sleep(400);
await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(600);
const d1 = await donnees();
log('  « C\'est fait » (Non) : seul rappelFait du vermifuge change =', JSON.stringify(d0.soins.map((s) => s.id === idVerm ? { ...s, rappelFait: true } : s)) === JSON.stringify(d1.soins), '| animaux/pesées intacts =', JSON.stringify(d0.animaux) === JSON.stringify(d1.animaux) && JSON.stringify(d0.pesees) === JSON.stringify(d1.pesees));
log('  menu : badge Rappels =', await ev(`(()=>{const c=document.querySelector('[data-nav=rappels] [data-retards]');return c.hidden?'masqué':c.textContent})()`), '| nom =', await ev(`document.querySelector('[data-nav=rappels]').getAttribute('aria-label')`), '| barre du haut sans cloche =', await ev(`!document.querySelector('#notif-lien')`));
await aller2('#/accueil');
log('  accueil sans retard :', await texte('.ac-resume'));
await aller2('#/animaux'); log('  mes animaux :', await texte('.al-rappels'));
await aller2('#/animaux/rappels');
await ev(`document.querySelector('.rp-carte a.cp-btn[href*="${idMimi}"]').click()`); await sleep(900);
log('VOIR LE SOIN : fiche =', await texte('.fi-entete h1'), '| onglet =', await ev(`document.querySelector('[role=tab][aria-selected=true]').dataset.onglet`), '| carte ciblée =', await ev(`document.querySelector('.sn-carte--cible .sn-carte__nom')?.textContent`), '| focus =', await ev(`document.activeElement.classList.contains('sn-carte--cible')`), '| adresse =', await ev(`location.hash`), '| soin de Mimi =', await (async () => { const id = (await ev(`location.hash`)).split('/').pop(); return (await donnees()).soins.find((x) => x.id === id)?.animalId === idMimi; })());
await aller2('#/animaux/rappels');
const choisirAnimal = async (v) => { await ev(`(()=>{const s=document.querySelector('#rp-animal');s.value='${v}';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(150); };
const statut = async (v) => { await ev(`document.querySelector('input[name="rp-statut"][value="${v}"]').click()`); await sleep(150); };
const noms = () => ev(`[...document.querySelectorAll('.rp-carte')].map(c=>c.querySelector('.rp-carte__nom').textContent+'/'+c.querySelector('.rp-animal').textContent.trim()).join(', ')`);
await choisirAnimal(idMimi); log('FILTRES — Mimi :', await noms());
await choisirAnimal(idMoka); log('  Moka :', await noms());
await statut('faits'); log('  Moka + Effectués :', await noms());
await choisirAnimal(''); await statut('a-venir'); log('  Tous + À venir :', await noms());
await statut('retard'); log('  En retard :', await texte('[data-groupes]'));
await statut('a-faire');
log('  filtrer n\'a rien modifié =', JSON.stringify(d1) === JSON.stringify(await donnees()));

// ===== 5. Pages « Bientôt » toujours là
for (const h of ['#/carte', '#/boutique', '#/communaute', '#/pro', '#/bientot', '#/donnees']) { await aller2(h); log('page', h, ':', await texte('#contenu h1')); }

// ===== 6. Export / import
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
ws.close(); proc.kill(); process.exit(0);
