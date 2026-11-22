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

  // Contrôles de mise en page : rien ne déborde de l'écran, aucun bouton n'en recouvre un autre, aucun texte de bouton ne déborde, aucun texte n'en recouvre un autre
  const OUTILS = `(() => {
    const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
    const defile = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    const nom = (e) => (e.className && e.className.baseVal === undefined ? '.' + String(e.className).trim().split(/\s+/).slice(0, 2).join('.') : e.tagName.toLowerCase());
    const etiquette = (e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    window.__mep = (racine) => {
      const out = [];
      const L = innerWidth;
      for (const e of racine.querySelectorAll('*')) { if (!visible(e) || defile(e) || e.closest('svg, .cp-sr, [hidden], .app-fond')) continue; const r = e.getBoundingClientRect(); if (r.right > L + 1 || r.left < -1) out.push('déborde de l écran : ' + nom(e)); }
      const bs = [...racine.querySelectorAll('.cp-btn')].filter((e) => visible(e) && !e.closest('svg, .cp-sr, [hidden]'));
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const ra = bs[i].getBoundingClientRect(); const rb = bs[j].getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 1 && h > 1) out.push('boutons qui se chevauchent : « ' + etiquette(bs[i]) + ' » / « ' + etiquette(bs[j]) + ' »');
      }
      for (const b of bs) {
        const br = b.getBoundingClientRect(); const r = document.createRange(); r.selectNodeContents(b); const t = r.getBoundingClientRect();
        if (b.scrollWidth > b.clientWidth + 1 || t.left < br.left - 1 || t.right > br.right + 1 || t.top < br.top - 1 || t.bottom > br.bottom + 1) out.push('texte de bouton qui déborde : « ' + etiquette(b) + ' »');
      }
      const textes = [...racine.querySelectorAll('*')].filter((e) => visible(e) && !defile(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest('svg, [hidden], .cp-sr, .cp-btn'));
      const rect = (e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect(); };
      for (let i = 0; i < textes.length; i++) for (let j = i + 1; j < textes.length; j++) {
        const a = textes[i]; const b = textes[j];
        if (a.contains(b) || b.contains(a)) continue;
        const cadre = a.closest('li, .cp-carte, header, dialog, details, section');
        if (!cadre || !cadre.contains(b)) continue;
        const ra = rect(a); const rb = rect(b);
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 2 && h > 2) out.push('textes qui se chevauchent : ' + nom(a) + ' / ' + nom(b));
      }
      return [...new Set(out)].slice(0, 8);
    };
  })()`;
  const taille = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  const controler = async (nomControle, sel = '#contenu') => {
    await ev(OUTILS);
    const r = await ev(`window.__mep(document.querySelector(${JSON.stringify(sel)}))`);
    verifier(r.length === 0, `${nomControle} : aucun débordement, aucun chevauchement${r.length ? ' → ' + r.join(' | ') : ''}`);
  };

  const fin = (net) => {
    log('export -> effacer -> import -> export identique :', net);
    log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
    log('VÉRIFICATIONS EN ÉCHEC :', echecs);
    ws.close(); proc.kill(); process.exit(0);
  };
  return { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, erreurs, fin, taille, controler, naviguer: async (u) => { await send('Page.navigate', { url: u }); await dort(1800); } };
}
