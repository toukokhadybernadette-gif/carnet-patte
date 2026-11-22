// Écran étroit (375 px, comme un iPhone) avec des NOMS LONGS : rien ne déborde, rien ne se chevauche, aucun mot n'est coupé au milieu.
// + la navigation : menu ☰ (panneau de verre à gauche), bouton rond « + » au centre de la barre du bas, plus d'« Actions rapides ».
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const S = process.argv[2], URL = process.argv[3], TAG = process.argv[4];
const E = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; // chemin de msedge.exe : à adapter avec la variable EDGE si besoin
const port = +(process.env.PORT || 9350);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let echecs = 0;
const log = (...a) => console.log(...a);
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const D = await import(pathToFileURL(path.join(RACINE, 'modules/toxique/donnees.js')).href);

fs.rmSync(`${S}/prof-e2e-${TAG}`, { recursive: true, force: true });
const proc = spawn(E, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${S}/prof-e2e-${TAG}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (list.find((t) => t.type === 'page')) break; } catch {} await sleep(250); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const erreurs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') erreurs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) erreurs.push('CONSOLE ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') erreurs.push('LOG ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erreur'); return r.result.result.value; };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
fs.mkdirSync(`${S}/shots`, { recursive: true });
const taille = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
const aller = async (h) => { await ev(`location.hash='${h}'`); await sleep(700); };
const aller2 = async (h) => { if (await ev(`location.hash`) === h) { await ev(`import('/js/router.js').then(r=>r.rafraichir())`); await sleep(500); } else await aller(h); };
const ecran = async (nom, plein = false) => { const c = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: plein }); fs.writeFileSync(`${S}/shots/${TAG}-${nom}.png`, Buffer.from(c.result.data, 'base64')); };
let axeSrc = ''; for (let i = 0; i < 4 && !axeSrc; i++) { try { axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text(); } catch { await sleep(1500); } }
const axe = async (sel, nom) => { if (await ev('typeof axe') !== 'function') await ev(axeSrc); const a = await ev(`axe.run(document.querySelector('${sel}'), {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r=>({v:r.violations.map(v=>v.id+'('+v.nodes.length+') '+v.nodes[0].html.slice(0,90)),inc:r.incomplete.map(i=>i.id)}))`); log('axe', nom, ':', a.v.length ? 'VIOLATIONS ' + a.v.join(' | ') : '0 violation', a.inc.length ? '· à vérifier ' + a.inc : ''); };
const sansDebord = () => ev(`document.documentElement.scrollWidth<=innerWidth`);
const texte = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? 'ABSENT').replace(/\\s+/g,' ').trim()`);
const importer = (t) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(t)}))`);
const style = (sel, prop) => ev(`getComputedStyle(document.querySelector(${JSON.stringify(sel)}))[${JSON.stringify(prop)}]`);

// ===== Les contrôles génériques, injectés dans la page =====
// 1. debordements : un élément visible qui dépasse de l'écran (hors zones qui défilent exprès : carrousel, rangées de pastilles)
// 2. chevauchements : deux textes d'une même carte qui se recouvrent
// 3. motsCoupes : un mot (ou un morceau de mot entre deux tirets) qui tient sur deux lignes, c'est-à-dire coupé au milieu
const OUTILS = `(() => {
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const defile = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  const nom = (e) => (e.className && e.className.baseVal === undefined ? '.' + String(e.className).trim().split(/\\s+/).slice(0, 2).join('.') : e.tagName.toLowerCase());
  const textes = (racine) => [...racine.querySelectorAll('*')].filter((e) => visible(e) && !defile(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest('svg, [hidden], .cp-sr'));
  window.__controles = {
    debordements(racine = document.body) {
      const L = innerWidth; const out = [];
      for (const e of racine.querySelectorAll('*')) { if (!visible(e) || defile(e) || e.closest('svg, .cp-sr, [hidden], .app-fond')) continue; const r = e.getBoundingClientRect(); if (r.right > L + 1 || r.left < -1) out.push(nom(e) + ' ' + Math.round(r.left) + '→' + Math.round(r.right)); }
      return [...new Set(out)].slice(0, 6);
    },
    chevauchements(racine = document.body) {
      const out = []; const els = textes(racine);
      const rect = (e) => { if (getComputedStyle(e).overflow !== 'visible') return e.getBoundingClientRect(); const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect(); };
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
        const a = els[i]; const b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        const cadre = a.closest('li, .cp-carte, .cp-btn, header, .ps-actuel, .tx-urgence, dialog, .app-menu, .ac-afaire, .ac-couv__slide');
        if (!cadre || !cadre.contains(b)) continue;
        const ra = rect(a); const rb = rect(b);
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 2 && h > 2) out.push(nom(a) + ' / ' + nom(b));
      }
      return [...new Set(out)].slice(0, 6);
    },
    // 4. boutons : deux boutons (ou liens-boutons) qui se recouvrent, ou un texte de bouton qui dépasse de son bouton
    boutons(racine = document.body) {
      const out = []; const bs = [...racine.querySelectorAll('.cp-btn')].filter((e) => visible(e) && !e.closest('svg, .cp-sr, [hidden]'));
      const etiquette = (e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const ra = bs[i].getBoundingClientRect(); const rb = bs[j].getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 1 && h > 1) out.push('se chevauchent : « ' + etiquette(bs[i]) + ' » / « ' + etiquette(bs[j]) + ' »');
      }
      for (const b of bs) {
        const br = b.getBoundingClientRect(); const r = document.createRange(); r.selectNodeContents(b); const t = r.getBoundingClientRect();
        if (b.scrollWidth > b.clientWidth + 1 || t.left < br.left - 1 || t.right > br.right + 1 || t.top < br.top - 1 || t.bottom > br.bottom + 1) out.push('texte qui déborde : « ' + etiquette(b) + ' »');
      }
      return [...new Set(out)].slice(0, 8);
    },
    motsCoupes(racine = document.body) {
      const out = [];
      for (const e of textes(racine)) for (const n of e.childNodes) {
        if (n.nodeType !== 3) continue;
        const t = n.textContent; const re = /[^\\s\\-–—·/()«»,;:.!?]{4,}/g; let m;
        while ((m = re.exec(t))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const lignes = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 4))); if (lignes.size > 1) out.push(m[0] + ' (' + nom(e) + ')'); }
      }
      return [...new Set(out)].slice(0, 8);
    },
  };
})()`;
const controler = async (nom, racine = 'document.body') => {
  await ev(OUTILS);
  const d = await ev(`__controles.debordements(${racine})`); const c = await ev(`__controles.chevauchements(${racine})`); const m = await ev(`__controles.motsCoupes(${racine})`);
  verifier(d.length === 0, `${nom} : rien ne déborde de l'écran${d.length ? ' → ' + d.join(' | ') : ''}`);
  verifier(c.length === 0, `${nom} : aucun texte ne chevauche un autre${c.length ? ' → ' + c.join(' | ') : ''}`);
  verifier(m.length === 0, `${nom} : aucun mot coupé au milieu${m.length ? ' → ' + m.join(' | ') : ''}`);
};

await send('Page.navigate', { url: URL }); await sleep(1800); await taille(375, 812); await aller('#/accueil'); await ev(axeSrc);
const aujourdhui = await ev(`import('/js/utils.js').then(m => m.aujourdhui())`);
const dans = (n) => new Date(Date.parse(aujourdhui) + n * 86400000).toISOString().slice(0, 10);
const A = (id, nom, espece, extra = {}) => ({ id, nom, espece, especeAutre: '', race: '', naissance: '', photo: '', ...extra });
const LONG1 = 'Maximilien-Alexandre de la Fontaine';
const LONG2 = 'Anticonstitutionnellement';
const donnees = { version: 1, exemplesAjoutes: true,
  animaux: [A('a', LONG1, 'chien', { race: 'Berger belge malinois à poil long', naissance: '2018-04-02' }), A('b', LONG2, 'autre', { especeAutre: 'Hippopotame nain de Madagascar' }), A('c', 'Moka', 'chat')],
  soins: [
    { id: 's1', animalId: 'a', type: 'vaccin', titre: 'Vaccin polyvalent CHPPiL + rage, rappel annuel obligatoire', date: dans(-400), notes: 'Très longue note sur le comportement après la piqûre, à surveiller pendant deux jours entiers sans rien oublier', rappel: dans(-14), rappelFait: false },
    { id: 's2', animalId: 'b', type: 'antiparasitaire', titre: 'Antiparasitaire externe spot-on mensuel', date: dans(-30), notes: '', rappel: dans(5), rappelFait: false },
    { id: 's3', animalId: 'c', type: 'vermifuge', titre: 'Vermifuge', date: dans(-100), notes: '', rappel: dans(40), rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'a', date: dans(-60), poidsKg: 27.2 }, { id: 'p2', animalId: 'a', date: dans(-20), poidsKg: 28.4 }, { id: 'p3', animalId: 'a', date: dans(-2), poidsKg: 29.1 }] };
await importer(JSON.stringify(donnees));

log('=== 375 px, NOMS LONGS : toutes les pages ===');
for (const [nom, pg] of [['Accueil', '#/accueil'], ['Mes animaux', '#/animaux'], ['Fiche (animal au nom long)', '#/animaux/a'], ['Fiche (espèce longue)', '#/animaux/b'], ['Rappels', '#/animaux/rappels'], ['Profil', '#/profil'], ['Sauvegarde', '#/donnees'], ['Bientôt', '#/bientot']]) {
  await aller2(pg); await ev(`window.scrollTo(0, 0)`);
  verifier(await sansDebord(), `${nom} : pas de défilement horizontal`);
  await controler(nom);
  await ecran(nom.toLowerCase().replace(/[^a-z]+/g, '-'), true);
}
for (const onglet of ['poids', 'historique', 'sante']) {
  await aller2('#/animaux/a'); await ev(`document.querySelector('[data-onglet=${onglet}]').click()`); await sleep(500);
  verifier(await sansDebord(), `Fiche · ${onglet} : pas de défilement horizontal`);
  await controler(`Fiche · ${onglet}`);
}
await axe('#app', 'Fiche (375 px, noms longs)');

log('=== BOUTONS à 375 px ET 390 px : aucun ne chevauche un autre, aucun texte ne déborde ===');
for (const largeur of [375, 390]) {
  await taille(largeur, 844);
  for (const [nom, pg, onglet] of [['Rappels', '#/animaux/rappels'], ['Fiche · Santé', '#/animaux/a', 'sante'], ['Fiche · Santé (espèce longue)', '#/animaux/b', 'sante'], ['Accueil', '#/accueil']]) {
    await aller2(pg); if (onglet) { await ev(`document.querySelector('[data-onglet=${onglet}]').click()`); await sleep(400); }
    await ev(OUTILS);
    const nb = await ev(`document.querySelectorAll('#contenu .cp-btn').length`);
    const b = await ev(`__controles.boutons(document.querySelector('#contenu'))`);
    verifier(nb > 3 && b.length === 0, `${largeur} px · ${nom} : ${nb} boutons, aucun ne chevauche un autre, aucun texte ne déborde${b.length ? ' → ' + b.join(' | ') : ''}`);
    verifier(await sansDebord(), `${largeur} px · ${nom} : pas de défilement horizontal`);
    if (largeur === 375) await ecran(`boutons-${nom.toLowerCase().replace(/[^a-z]+/g, '-')}`, true);
  }
}
await taille(375, 812);

log('=== GROUPE (basse-cour) : onglets et graphique de ponte à 375 px ET 390 px ===');
const jourN = (n) => dans(n);
const oeufsDe = (nombres) => nombres.map((n, i) => ({ id: 'oe' + i, animalId: 'g', date: jourN(-(i + 1)), nombre: n }));
const donneesGroupe = (nombres) => ({ ...donnees, animaux: [...donnees.animaux, { id: 'g', nom: 'Mes poules de la Fontaine-aux-Oies', espece: 'poule', especeAutre: '', groupe: true, effectif: 12, race: '', naissance: '', photo: '' }], oeufs: oeufsDe(nombres),
  stocks: [{ id: 'st', animalId: 'g', nom: 'Mélange de céréales et de graines', quantiteKg: 4, consoJourKg: 0.9, seuilJours: 7, date: dans(-1) }] });
for (const largeur of [375, 390]) {
  await taille(largeur, 844);
  for (const [nombres, attendu] of [[[6, 4, 5, 6, 3, 0, 5, 4, 6, 5, 4, 6], 'max 6'], [[17, 12, 15, 9, 14], 'max 17'], [[1, 0, 1], 'max 1'], [[130, 90, 120], 'max 130']]) {
    await importer(JSON.stringify(donneesGroupe(nombres)));
    await aller2('#/animaux/g'); await sleep(500);
    const noms = await ev(`[...document.querySelectorAll('[role=tab]')].map((t) => t.textContent.trim())`);
    const tabs = await ev(`(() => { const L = [...document.querySelectorAll('[role=tab]')].map((t) => { const r = t.getBoundingClientRect(); const s = t.querySelector('span:last-child'); const rs = document.createRange(); rs.selectNodeContents(s); const tr = rs.getBoundingClientRect(); return { nom: t.textContent.trim(), g: r.left, d: r.right, tg: tr.left, td: tr.right }; });
      const liste = document.querySelector('[role=tablist]'); return { L, defile: liste.scrollWidth > liste.clientWidth + 1, ecart: L.slice(1).map((t, i) => Math.round(t.tg - L[i].td)), texteDans: L.every((t) => t.tg >= t.g - 1 && t.td <= t.d + 1), cote: Math.round(liste.getBoundingClientRect().width) }; })()`);
    verifier(JSON.stringify(noms) === JSON.stringify(['Santé', 'Ponte', 'Repas', 'Historique', 'Documents']), `${largeur} px : onglets du groupe ${noms.join(' · ')}`);
    verifier(tabs.ecart.every((e) => e >= 8) && tabs.texteDans, `${largeur} px : les libellés des onglets ne se collent pas (espaces entre libellés : ${tabs.ecart.join(', ')} px) et chaque texte reste dans son onglet`);
    verifier(!tabs.defile, `${largeur} px : les 5 onglets du groupe TIENNENT sur l’écran, sans défiler (aucun onglet coupé)`);
    // le dernier onglet est atteignable : on le touche, la rangée défile et il est entièrement visible
    await ev(`document.querySelector('[data-onglet=documents]').click()`); await sleep(500);
    const dernier = await ev(`(() => { const r = document.querySelector('[data-onglet=documents]').getBoundingClientRect(); return { g: Math.round(r.left), d: Math.round(r.right), L: innerWidth }; })()`);
    verifier(dernier.g >= 0 && dernier.d <= dernier.L + 1, `${largeur} px : le dernier onglet est entièrement visible quand on le choisit${tabs.defile ? ' (la rangée défile)' : ''}`);
    await ev(`document.querySelector('[data-onglet=ponte]').click()`); await sleep(500);
    const g = await ev(`(() => { const s = document.querySelector('.fe-graphe'); const W = s.viewBox.baseVal.width; const sb = s.getBoundingClientRect(); const axe = [...s.querySelectorAll('text.fe-axe')].map((t) => { const b = t.getBBox(); return { texte: t.textContent, g: b.x, d: b.x + b.width, fin: t.getAttribute('data-axe') === 'y' }; }); return { W, axe, debord: sb.right > innerWidth + 1 || sb.left < -1 }; })()`);
    const y = g.axe.filter((t) => t.fin);
    verifier(y.length >= 3 && y.every((t) => /^[0-9]+$/.test(t.texte)) && y.every((t) => t.g >= 2 && t.d <= g.W) && g.axe.every((t) => t.g >= 0 && t.d <= g.W + 1) && !g.debord,
      `${largeur} px · graphique (${attendu}) : axe en nombres entiers (${y.map((t) => t.texte).join(', ')}), aucun chiffre coupé, rien ne déborde`);
    await ev(OUTILS);
    const m = await ev(`__controles.boutons(document.querySelector('#contenu'))`);
    verifier(m.length === 0, `${largeur} px · onglet Ponte : aucun bouton ne chevauche un autre${m.length ? ' → ' + m.join(' | ') : ''}`);
    if (largeur === 375 && attendu === 'max 6') await ecran('groupe-ponte', true);
  }
}
// Très petit écran (320 px, iPhone SE) : si les onglets ne tiennent pas, la rangée défile ET un fondu à droite l'annonce ; jamais un onglet coupé sans indication
await importer(JSON.stringify(donneesGroupe([5, 4, 6])));
await taille(320, 700); await aller2('#/animaux/g'); await sleep(500);
const petitOnglets = await ev(`(() => { const l = document.querySelector('[role=tablist]'); const fin = l.scrollWidth - l.clientWidth; return { defile: fin > 1, fondu: l.classList.contains('a-suite') }; })()`);
verifier(!petitOnglets.defile || petitOnglets.fondu, `320 px : les onglets ${petitOnglets.defile ? 'défilent, avec un fondu à droite qui annonce la suite' : 'tiennent sur l’écran'}`);
await ev(`document.querySelector('[role=tablist]').scrollTo({ left: 9999 })`); await sleep(400);
const finDefil = await ev(`(() => { const l = document.querySelector('[role=tablist]'); const t = [...l.querySelectorAll('[role=tab]')].pop().getBoundingClientRect(); return { fondu: l.classList.contains('a-suite'), droite: Math.round(t.right), largeur: innerWidth }; })()`);
verifier(!finDefil.fondu && finDefil.droite <= finDefil.largeur, `320 px : au bout de la rangée, le fondu disparaît et « Documents » est entier (bord droit ${finDefil.droite} px sur ${finDefil.largeur})`);
await importer(JSON.stringify(donnees));
await taille(375, 812);

log('=== ACCUEIL : carrousel, diapositive « Ajouter », plus d\'« Actions rapides » ==='),
await aller2('#/accueil'); await ev(`window.scrollTo(0, 0)`);
verifier(await ev(`!document.querySelector('.ac-actions, .ac-action, #ac-actions')`) && !(await texte('#contenu')).includes('Actions rapides'), 'la section « Actions rapides » est supprimée');
await ev(`document.querySelector('[data-piste]').scrollTo({ left: 99999 })`); await sleep(600);
const fin = await ev(`(() => { const p = document.querySelector('[data-piste]'); const pr = p.getBoundingClientRect(); const last = p.lastElementChild; const lr = last.getBoundingClientRect(); const carte = last.querySelector('.ac-couv__ajout').getBoundingClientRect(); const btn = last.querySelector('[data-act=animal]').getBoundingClientRect();
  const voisines = [...p.children].slice(0, -1).filter((li) => { const r = li.getBoundingClientRect(); return r.right > pr.left + 1 && r.left < pr.right - 1; }).length;
  return { carteH: Math.round(carte.height), carteL: Math.round(carte.left), carteR: Math.round(carte.right), largeur: innerWidth, btnDedans: btn.left >= carte.left && btn.right <= carte.right && btn.top >= carte.top && btn.bottom <= carte.bottom, voisines, fait: [...p.querySelectorAll('[data-fait]')].filter((b) => { const r = b.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; }).length, texteBtn: last.querySelector('[data-act=animal]').textContent.trim() }; })()`);
verifier(fin.carteH >= 180 && fin.carteL >= 0 && fin.carteR <= fin.largeur && fin.btnDedans && fin.texteBtn === 'Ajouter un animal', `dernière diapositive : une vraie carte (${fin.carteH} px de haut) avec son bouton « ${fin.texteBtn} » dedans`);
verifier(fin.voisines === 0 && fin.fait === 0, `en fin de carrousel : rien de la diapositive précédente ne dépasse (voisines visibles : ${fin.voisines}, boutons « Fait » visibles : ${fin.fait})`);
await ecran('accueil-fin-carrousel');
await ev(`document.querySelector('[data-act=animal]').click()`); await sleep(500);
verifier(await ev(`!!document.querySelector('dialog[open] input[name=nom]')`), 'le bouton de la diapositive ouvre « Nouvel animal »');
await controler('Formulaire « Nouvel animal »', `document.querySelector('dialog[open]')`);
await ev(`document.querySelector('dialog[open] [data-annuler]').click()`); await sleep(300);

log('=== TOXIQUE ? à 375 px : noms entiers, numéros l\'un sous l\'autre ===');
await aller2('#/toxique');
const tel = await ev(`(() => { const t = [...document.querySelectorAll('.tx-urgence--haut .tx-tel')].map((a) => a.getBoundingClientRect()); const u = document.querySelector('.tx-urgence--haut').getBoundingClientRect(); return { n: t.length, dessous: t[1].top >= t[0].bottom - 1, dedans: t.every((r) => r.left >= u.left - 1 && r.right <= u.right + 1), memeLargeur: Math.abs(t[0].width - t[1].width) < 2 }; })()`);
verifier(tel.n === 2 && tel.dessous && tel.dedans, 'les 2 numéros d\'urgence sont l\'un sous l\'autre, dans le cadre, sans se chevaucher');
const ecartTx = await ev(`Math.round(document.querySelector('.tx-especes').getBoundingClientRect().top - document.querySelector('.tx-urgence--haut').getBoundingClientRect().bottom)`);
verifier(ecartTx > 0 && ecartTx <= 20, `Toxique ? : écart entre le bloc d'urgence et les pastilles d'espèces réduit (${ecartTx} px)`);
await controler('Toxique ? (haut de page)');
for (const g of D.ESPECES_TOXIQUE) {
  await ev(`document.querySelector('input[name=tx-espece][value=${g.id}]').click()`); await sleep(250);
  await ev(`document.querySelectorAll('[data-section]').forEach((b) => { if (b.getAttribute('aria-expanded') !== 'true') b.click(); })`); await sleep(200);
  await ev(OUTILS);
  const coupes = await ev(`__controles.motsCoupes(document.querySelector('.pg--toxique'))`);
  const chev = await ev(`__controles.chevauchements(document.querySelector('.pg--toxique'))`);
  const deb = await ev(`__controles.debordements(document.querySelector('.pg--toxique'))`);
  const nbFiches = await ev(`document.querySelectorAll('.tx-carte').length`);
  verifier(coupes.length === 0 && chev.length === 0 && deb.length === 0 && nbFiches > 10, `${g.nom} : ${nbFiches} fiches, noms entiers, badges sans chevauchement${coupes.length ? ' → coupés : ' + coupes.join(' | ') : ''}${chev.length ? ' → ' + chev.join(' | ') : ''}`);
}
await ev(`document.querySelector('input[name=tx-espece][value=chat]').click()`); await sleep(250);
await ecran('toxique-chat', true);
await ev(`document.querySelector('.tx-carte__tete').click()`); await sleep(300);
await controler('Toxique ? (une fiche ouverte)', `document.querySelector('.pg--toxique')`);
await axe('#app', 'Toxique ? (375 px)');

log('=== RAPPELS : un vrai trait rouge, droit ===');
await aller2('#/animaux/rappels');
const trait = await ev(`(() => { const c = document.querySelector('.rp-carte--retard'); const cs = getComputedStyle(c); const b = getComputedStyle(c, '::before'); const r = c.getBoundingClientRect(); return { ombre: cs.boxShadow, largeur: b.width, rayon: b.borderTopLeftRadius, haut: b.top, bas: b.bottom, couleur: b.backgroundColor, h: Math.round(r.height), contenu: b.content }; })()`);
verifier(trait.ombre === 'none' && trait.largeur === '4px' && trait.rayon === '2px' && trait.contenu !== 'none' && trait.couleur === 'rgb(142, 61, 43)', `trait rouge propre : 4 px de large, coins de 2 px, terre cuite (${trait.couleur}), plus d'ombre intérieure déformée`);
await ecran('rappels-trait', false);

log('=== MENU ☰ ===');
await aller2('#/accueil');
verifier(await ev(`(() => { const b = document.querySelector('#menu-bouton').getBoundingClientRect(); return b.left < 60 && b.top < 60 && b.width >= 40 && b.height >= 40; })()`), 'bouton ☰ en haut à gauche de la barre du haut (au moins 40 px)');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(500);
const menu = await ev(`(() => { const d = document.querySelector('dialog.app-menu[open]'); if (!d) return null; const r = d.getBoundingClientRect(); const cs = getComputedStyle(d); return { gauche: Math.round(r.left), largeur: Math.round(r.width), hauteur: Math.round(r.height), flou: cs.backdropFilter, fond: cs.backgroundColor, entrees: [...d.querySelectorAll('.app-menu__titre')].map((t) => t.textContent.trim()), expanded: document.querySelector('#menu-bouton').getAttribute('aria-expanded'), anim: cs.animationName }; })()`);
verifier(menu && menu.gauche === 0 && menu.largeur <= 360 && menu.hauteur >= 700 && /blur/.test(menu.flou) && /rgba/.test(menu.fond), `panneau à gauche, en verre (${menu?.largeur} px de large, flou ${menu?.flou})`);
verifier(menu && menu.entrees.join(' | ') === "Toxique ? | Boutique | Sauvegarde | Couleur de l'appli | Bientôt sur Carnet Patte | À propos" && menu.expanded === 'true', `entrées : ${menu?.entrees.join(' | ')}`);
await controler('Menu ☰', `document.querySelector('dialog.app-menu')`);
await axe('dialog.app-menu', 'Menu ☰'); await ecran('menu');
await ev(`document.querySelector('.app-menu [data-menu=toxique]').click()`); await sleep(700);
verifier(await ev(`location.hash`) === '#/toxique' && await ev(`!document.querySelector('dialog.app-menu')`), 'Toxique ? : ouvre la page et referme le panneau');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(400);
await ev(`document.querySelector('.app-menu [data-menu=donnees]').click()`); await sleep(700);
verifier(await ev(`location.hash`) === '#/donnees', 'Sauvegarde : ouvre la page Sauvegarde');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(400);
await ev(`document.querySelector('.app-menu [data-menu=couleur]').click()`); await sleep(900);
verifier(await ev(`location.hash`) === '#/profil' && await ev(`(() => { const r = document.querySelector('#pf-theme').getBoundingClientRect(); return r.top >= 0 && r.top < 300; })()`), 'Couleur de l\'appli : ouvre le Profil directement sur le choix de couleur');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(400);
await ev(`document.querySelector('.app-menu [data-menu=bientot]').click()`); await sleep(700);
verifier(await ev(`location.hash`) === '#/bientot', 'Bientôt sur Carnet Patte : ouvre la page des modules à venir');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(400);
await ev(`document.querySelector('.app-menu [data-menu=apropos]').click()`); await sleep(700);
verifier(await ev(`!!document.querySelector('dialog[open] .ap-texte') && !document.querySelector('dialog.app-menu')`), 'À propos : ouvre une fenêtre et referme le panneau');
await controler('À propos', `document.querySelector('dialog[open]')`);
await ev(`document.querySelector('dialog[open] [data-fermer]').click()`); await sleep(300);
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(400);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(600);
verifier(await ev(`!document.querySelector('dialog.app-menu')`) && await ev(`document.activeElement.id`) === 'menu-bouton', 'Échap referme le panneau et rend le focus au bouton ☰');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(400);
await ev(`(() => { const d = document.querySelector('dialog.app-menu'); d.dispatchEvent(new MouseEvent('click', { bubbles: true })); })()`); await sleep(600);
verifier(await ev(`!document.querySelector('dialog.app-menu')`), 'un toucher à côté du panneau le referme');

log('=== BARRE DU BAS : ICÔNES SEULES + BOUTON « + » SÉPARÉ À DROITE ===');
await aller2('#/accueil'); await ev(`window.scrollTo(0, 0)`);
const plus = await ev(`(() => {
  const st = (e) => getComputedStyle(e);
  const bar = document.querySelector('.app-nav-bas').getBoundingClientRect();
  const b = document.querySelector('#ajout-bouton'); const r = b.getBoundingClientRect();
  const items = [...document.querySelectorAll('#nav-bas [data-nav]')];
  const actif = document.querySelector('#nav-bas [aria-current="page"] .cp-nav-bas__icone');
  return { nb: items.length, textes: items.map((a) => a.textContent.replace(a.querySelector('[data-retards]')?.textContent ?? '', '').trim()).join(''), noms: items.map((a) => a.getAttribute('aria-label')),
    barG: Math.round(bar.left), barD: Math.round(bar.right), barH: Math.round(bar.height), barBas: Math.round(bar.bottom),
    plusG: Math.round(r.left), plusD: Math.round(r.right), plusH: Math.round(r.height), plusL: Math.round(r.width), plusBas: Math.round(r.bottom), ecran: innerWidth,
    texte: b.textContent.trim(), nom: b.getAttribute('aria-label'), fondPlus: st(b).backgroundColor, fondBarre: st(document.querySelector('.app-nav-bas')).backgroundColor,
    flouPlus: st(b).backdropFilter, couleurIcone: st(b.querySelector('svg')).color, rondeur: st(b).borderRadius,
    pastille: actif ? st(actif).backgroundColor : null, pastilleL: actif ? Math.round(actif.getBoundingClientRect().width) : 0 };
})()`);
verifier(plus.nb === 5 && plus.barD < plus.plusG && plus.plusD <= plus.ecran - 12 && plus.barG >= 12, `barre (${plus.barG}–${plus.barD} px) puis « + » (${plus.plusG}–${plus.plusD} px) à sa droite, dans l'écran de ${plus.ecran} px`);
verifier(plus.plusG - plus.barD >= 6 && plus.plusG - plus.barD <= 16, `espace de ${plus.plusG - plus.barD} px entre la barre et le « + »`);
verifier(plus.plusH === plus.barH && plus.plusBas === plus.barBas && plus.plusL === plus.plusH && plus.rondeur === '50%', `« + » rond (${plus.plusL} px), même hauteur (${plus.plusH} / ${plus.barH} px) et même ligne de pied (${plus.plusBas} / ${plus.barBas}) : pas surélevé`);
verifier(plus.fondPlus === plus.fondBarre && /blur/.test(plus.flouPlus), `« + » en verre de la même couleur que la barre (${plus.fondPlus})`);
verifier(plus.couleurIcone === 'rgb(255, 255, 255)' && plus.texte === '' && plus.nom === 'Ajouter', `« + » blanc, sans texte, nommé « ${plus.nom} » pour les lecteurs d'écran`);
verifier(plus.textes === '' && plus.noms.every(Boolean), `onglets : icônes seules (le badge des retards mis à part), noms pour les lecteurs d'écran (${plus.noms.join(', ')})`);
const ordreOnglets = await ev(`[...document.querySelectorAll('#nav-bas [data-nav]')].map((a) => a.dataset.nav).join()`);
const largeursOnglets = await ev(`[...document.querySelectorAll('#nav-bas [data-nav]')].map((a) => Math.round(a.getBoundingClientRect().width))`);
verifier(ordreOnglets === 'accueil,animaux,carte,rappels,profil' && largeursOnglets.every((w) => w >= 44), `5 onglets dans l'ordre Accueil, Animaux, Carte, Rappels, Profil ; chacun assez large pour le doigt (${largeursOnglets.join(', ')} px à 375 px)`);
verifier(plus.pastille === 'rgb(253, 254, 252)' && plus.pastilleL >= 40, `onglet actif : pastille claire derrière l'icône (${plus.pastille}, ${plus.pastilleL} px de large)`);
await ecran('barre-plus');
// Très petit téléphone (320 px, iPhone SE) : les 5 onglets et le « + » doivent encore tenir sans se chevaucher
await taille(320, 568); await aller2('#/accueil'); await sleep(400);
const petit = await ev(`(() => { const p = document.querySelector('#ajout-bouton').getBoundingClientRect(); const it = [...document.querySelectorAll('#nav-bas [data-nav]')].map((a) => a.getBoundingClientRect()); const b = document.querySelector('.app-nav-bas').getBoundingClientRect(); return { sansDebord: document.documentElement.scrollWidth <= innerWidth, dedans: b.left >= 0 && p.right <= innerWidth, largeurs: it.map((r) => Math.round(r.width)), chevauche: it.some((r, i) => i > 0 && r.left < it[i - 1].right - 1), plusApres: p.left >= b.right, pastille: Math.round(document.querySelector('#nav-bas [aria-current="page"] .cp-nav-bas__icone').getBoundingClientRect().width) }; })()`);
verifier(petit.sansDebord && petit.dedans && !petit.chevauche && petit.plusApres && petit.largeurs.every((w) => w >= 36), `320 px : 5 onglets (${petit.largeurs.join(', ')} px) et « + » tiennent sans déborder ni se chevaucher, pastille de l'onglet actif ${petit.pastille} px`);
await ecran('barre-320');
await taille(375, 812); await aller2('#/accueil'); await sleep(300);
await ev(`document.querySelector('#ajout-bouton').click()`); await sleep(500);
const ajout = await ev(`(() => { const d = document.querySelector('dialog[open]'); return [...d.querySelectorAll('.ar-choix__titre')].map((t) => t.textContent.trim()).join(' | '); })()`);
verifier(ajout === 'Ajouter un soin | Ajouter une pesée | Ajouter un animal', `petite fenêtre : ${ajout}`);
await controler('Fenêtre « Ajouter »', `document.querySelector('dialog[open]')`); await axe('dialog[open]', 'Fenêtre « Ajouter »'); await ecran('ajout');
await ev(`document.querySelector('dialog[open] [data-ajout=soin]').click()`); await sleep(600);
verifier(await ev(`!!document.querySelector('dialog[open] .ac-choix__animal')`) && await ev(`document.querySelectorAll('dialog[open] .ac-choix__animal').length`) === 3, 'Ajouter un soin : choix de l\'animal (3 animaux)');
await controler('Choix de l\'animal (noms longs)', `document.querySelector('dialog[open]')`);
await ev(`document.querySelector('dialog[open] .ac-choix__animal').click()`); await sleep(600);
verifier(await ev(`!!document.querySelector('dialog[open] form')`), 'puis le formulaire du soin s\'ouvre');
await controler('Formulaire de soin', `document.querySelector('dialog[open]')`);
await ev(`document.querySelector('dialog[open] [data-annuler]').click()`); await sleep(300);
await ev(`document.querySelector('#ajout-bouton').click()`); await sleep(400);
await ev(`document.querySelector('dialog[open] [data-ajout=pesee]').click()`); await sleep(500);
await ev(`document.querySelector('dialog[open] .ac-choix__animal').click()`); await sleep(500);
verifier(await ev(`!!document.querySelector('dialog[open] #mpesee-poids')`), 'Ajouter une pesée : formulaire de pesée');
await ev(`document.querySelector('dialog[open] [data-annuler]').click()`); await sleep(300);
await ev(`document.querySelector('#ajout-bouton').click()`); await sleep(400);
await ev(`document.querySelector('dialog[open] [data-ajout=animal]').click()`); await sleep(500);
verifier(await ev(`!!document.querySelector('dialog[open] input[name=nom]')`), 'Ajouter un animal : formulaire d\'un nouvel animal');
await ev(`document.querySelector('dialog[open] [data-annuler]').click()`); await sleep(300);
// sans animal : soin et pesée grisés
await importer(JSON.stringify({ version: 1, exemplesAjoutes: true, animaux: [], soins: [], pesees: [] })); await aller2('#/accueil');
await ev(`document.querySelector('#ajout-bouton').click()`); await sleep(400);
verifier(await ev(`document.querySelector('dialog[open] [data-ajout=soin]').disabled && document.querySelector('dialog[open] [data-ajout=pesee]').disabled && !document.querySelector('dialog[open] [data-ajout=animal]').disabled`), 'sans animal : « soin » et « pesée » sont grisés, « animal » reste actif');
await ev(`document.querySelector('dialog[open] [data-fermer]').click()`); await sleep(300);
await importer(JSON.stringify(donnees));

log('=== TABLETTE ET ORDINATEUR : menu ☰ et bouton « Ajouter » dans la barre du haut ===');
for (const [w, h, nom] of [[820, 1000, 'tablette'], [1280, 900, 'ordinateur']]) {
  await taille(w, h); await aller2('#/accueil');
  verifier(await ev(`(() => { const m = document.querySelector('#menu-bouton').getBoundingClientRect(); const a = document.querySelector('#ajout-haut').getBoundingClientRect(); return m.width > 0 && a.width > 0 && getComputedStyle(document.querySelector('.app-nav-bas')).display === 'none'; })()`), `${nom} : ☰ et « Ajouter » dans la barre du haut, pas de barre du bas`);
  await ev(`document.querySelector('#ajout-haut').click()`); await sleep(400);
  verifier(await ev(`document.querySelectorAll('dialog[open] .ar-choix').length`) === 3, `${nom} : « Ajouter » ouvre la même petite fenêtre`);
  await ev(`document.querySelector('dialog[open] [data-fermer]').click()`); await sleep(300);
  await ev(`document.querySelector('#menu-bouton').click()`); await sleep(500);
  verifier(await ev(`document.querySelectorAll('dialog.app-menu .app-menu__lien').length`) === 6, `${nom} : le menu ☰ a ses 6 entrées (Boutique ajoutée ; plus de « Carte Patte » : elle est dans la barre du bas)`);
  await ev(`document.querySelector('dialog.app-menu [data-fermer]').click()`); await sleep(500);
  verifier(await sansDebord(), `${nom} : pas de défilement horizontal`);
}

log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`); await importer(exp);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (x) => { const o = JSON.parse(x); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
