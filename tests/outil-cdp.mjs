// Outil commun aux tests « installable » et « calendrier » : ouvre Edge (sans fenêtre) piloté par le protocole de débogage.
// Même principe que les autres tests (voir test-5f-rappels.mjs), mais regroupé ici pour ne pas être recopié.

import { spawn } from 'node:child_process';
import fs from 'node:fs';

export const dort = (ms) => new Promise((r) => setTimeout(r, ms));
export const jour = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export async function ouvrirEdge({ sortie, balise, port }) {
  const edge = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const profil = `${sortie}/prof-${balise}`;
  fs.rmSync(profil, { recursive: true, force: true });
  const proc = spawn(edge, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let liste;
  for (let i = 0; i < 40; i++) { try { liste = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (liste.find((t) => t.type === 'page')) break; } catch { /* Edge démarre */ } await dort(250); }
  const ws = new WebSocket(liste.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const attente = new Map(); const erreurs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && attente.has(d.id)) { attente.get(d.id)(d); attente.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') erreurs.push(`EXC ${d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text}`);
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) erreurs.push(`CONSOLE ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; attente.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erreur'); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.enable');
  fs.mkdirSync(`${sortie}/shots`, { recursive: true });

  const log = (...a) => console.log(...a);
  let echecs = 0;
  const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${Boolean(condition)}`); };
  const texte = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? 'ABSENT').replace(/\\s+/g,' ').trim()`);
  const ecran = async (nom) => { const c = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${sortie}/shots/${balise}-${nom}.png`, Buffer.from(c.result.data, 'base64')); };
  const donnees = () => ev(`localStorage.getItem('carnetpatte.v1')`);
  const aller = async (h) => { await ev(`location.hash='${h}'`); await dort(700); };
  const importer = (fichier) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(JSON.stringify(fichier))}))`);

  // Contrôle d'accessibilité (axe-core, téléchargé comme dans les autres tests) ; ignoré si internet manque
  let axeSrc = '';
  for (let i = 0; i < 4 && !axeSrc; i++) { try { axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text(); } catch { await dort(1500); } }
  const axe = async (sel, nom) => {
    if (!axeSrc) { log('axe', nom, ': ignoré (pas d\'internet)'); return; }
    if (!(await ev('!!window.axe'))) await ev(axeSrc);
    const a = await ev(`axe.run(document.querySelector('${sel}'), {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r=>r.violations.map(v=>v.id+'('+v.nodes.length+') '+v.nodes[0].html.slice(0,90)))`);
    log('axe', nom, ':', a.length ? `VIOLATIONS ${a.join(' | ')}` : '0 violation');
  };

  const fin = (net) => {
    log('export -> effacer -> import -> export identique :', net);
    log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
    log('VÉRIFICATIONS EN ÉCHEC :', echecs);
    ws.close(); proc.kill(); process.exit(0);
  };
  return { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, erreurs, fin, naviguer: async (u) => { await send('Page.navigate', { url: u }); await dort(1800); } };
}
