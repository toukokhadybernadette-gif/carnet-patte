// Test « sombre » : mode Clair / Sombre / Automatique (Profil), avec les 12 thèmes et la couleur personnalisée.
// Vérifie : choix et mémorisation, « Automatique » qui suit l'appareil (même en direct), contraste 4,5:1 MESURÉ dans le navigateur pour chaque thème
// (variables réellement appliquées) et par axe-core sur 4 pages × 13 thèmes, verre (flou + transparence) conservé, Carte lisible,
// mode clair inchangé, couleur personnalisée en sombre (rechargement sans flash), écran de 375 px, hors connexion.
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';

const [S, URL, TAG] = process.argv.slice(2);
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, fin, taille, controler, erreurs } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*tile.openstreetmap.org*', '*nominatim.openstreetmap.org*', '*overpass*'] });
await send('Page.navigate', { url: URL }); await dort(1800);
await taille(375, 812);
let axeSrc = '';
for (let i = 0; i < 4 && !axeSrc; i++) { try { axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text(); } catch { await dort(1500); } }

const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: 'Berger australien', naissance: '2023-08-01', photo: '' },
    { id: 'b', nom: 'Filou', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '', couleur: 'magenta' }],
  soins: [{ id: 's1', animalId: 'a', type: 'vaccin', titre: 'Rage', date: jour(-300), notes: '', rappel: jour(-4), rappelFait: false },
    { id: 's2', animalId: 'a', type: 'vermifuge', titre: '', date: jour(-60), notes: '', rappel: jour(3), rappelFait: false },
    { id: 's3', animalId: 'b', type: 'antiparasitaire', titre: 'Pipette', date: jour(-20), notes: '', rappel: jour(60), rappelFait: false },
    { id: 's4', animalId: 'b', type: 'veto', titre: 'Contrôle', date: jour(-5), notes: '', rappel: '', rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'a', date: jour(-40), poidsKg: 20.8 }, { id: 'p2', animalId: 'a', date: jour(-3), poidsKg: 21.4 }] };
await importer(fichier);
const mode = () => ev(`document.documentElement.dataset.mode`);
const variable = (nom) => ev(`getComputedStyle(document.documentElement).getPropertyValue('${nom}').trim()`);

// ===== 1. Choix dans Profil =====
log('--- 1. Profil : Apparence ---');
await aller('#/profil'); await dort(500);
verifier((await texte('#pf-mode')) === 'Apparence', 'section « Apparence » dans Profil');
const options = await ev(`[...document.querySelectorAll('input[name=mode]')].map((i) => i.value + ':' + i.nextElementSibling.textContent.trim() + (i.checked ? '*' : ''))`);
verifier(JSON.stringify(options) === JSON.stringify(['clair:Clair', 'sombre:Sombre', 'auto:Automatique*']), `trois choix, « Automatique » par défaut (nouvel utilisateur) : ${options.join(' | ')}`);
verifier(await mode() === 'light' && await variable('--cp-fond') === '#F9FAF5', 'appareil clair + Automatique : mode clair, couleurs d’origine (fond #F9FAF5), rien n’a changé');
// Nouvel utilisateur (aucun choix mémorisé) : Automatique, donc sombre si l'appareil l'est ; un choix déjà fait est gardé
await ev(`localStorage.removeItem('carnetpatte.mode')`);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await send('Page.reload'); await dort(1800);
verifier(await mode() === 'dark', 'nouvel utilisateur (aucun choix) + appareil sombre : sombre, sans rien toucher');
await ev(`localStorage.setItem('carnetpatte.mode', 'clair')`);
await send('Page.reload'); await dort(1800);
verifier(await mode() === 'light', 'un utilisateur qui avait choisi « Clair » le garde, même avec un appareil sombre');
await ev(`localStorage.setItem('carnetpatte.mode', 'sombre')`);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await send('Page.reload'); await dort(1800);
verifier(await mode() === 'dark', 'un utilisateur qui avait choisi « Sombre » le garde, même avec un appareil clair');
await ev(`localStorage.removeItem('carnetpatte.mode')`);
await send('Emulation.setEmulatedMedia', { features: [] });
await send('Page.reload'); await dort(1800);
await aller('#/profil'); await dort(400);
const clair = await ev(`(() => { const c = getComputedStyle(document.querySelector('.cp-carte')); return { fond: c.backgroundColor, flou: c.backdropFilter || c.webkitBackdropFilter }; })()`);
await ecran('profil-clair');
await controler('Profil en clair à 375 px');

// ===== 2. Sombre =====
log('--- 2. Mode sombre ---');
await ev(`document.querySelector('input[name=mode][value=sombre]').click()`); await dort(400);
verifier(await mode() === 'dark' && await ev(`localStorage.getItem('carnetpatte.mode')`) === 'sombre', 'choisir « Sombre » : appliqué tout de suite et mémorisé');
verifier((await texte('.cp-notifs')).includes('Apparence « Sombre » appliquée'), 'confirmation affichée');
verifier(await variable('--cp-fond') !== '#F9FAF5' && await ev(`getComputedStyle(document.documentElement).colorScheme`) === 'dark', `fond sombre (${await variable('--cp-fond')}), color-scheme: dark (cases, dates, barres de défilement)`);
const sombre = await ev(`(() => { const c = getComputedStyle(document.querySelector('.cp-carte')); return { fond: c.backgroundColor, flou: c.backdropFilter || c.webkitBackdropFilter }; })()`);
verifier(/blur/.test(sombre.flou) && /blur/.test(clair.flou), `le verre est gardé : flou « ${sombre.flou} »`);
const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number); return m.length === 4 ? m[3] : 1; };
verifier(alpha(sombre.fond) < 1 && alpha(clair.fond) < 1, `et la transparence aussi : fond des cartes ${sombre.fond} (clair : ${clair.fond})`);
await ecran('profil-sombre'); await controler('Profil en sombre à 375 px');
await send('Page.reload'); await dort(1800);
verifier(await mode() === 'dark', 'après rechargement : toujours sombre');
// Pas de flash : le mode est posé avant l'affichage (script de index.html), avant même le chargement de app.js
const avantApp = await ev(`(async () => { const h = await (await fetch('index.html')).text(); return /carnetpatte\\.mode/.test(h.split('<link rel="stylesheet"')[0]); })()`);
verifier(avantApp, 'le mode est lu par un petit script placé AVANT les feuilles de style (pas de flash clair au démarrage)');

// ===== 3. Automatique =====
log('--- 3. Automatique ---');
await aller('#/profil'); await dort(400);
await ev(`document.querySelector('input[name=mode][value=auto]').click()`); await dort(300);
verifier(await ev(`localStorage.getItem('carnetpatte.mode')`) === 'auto', '« Automatique » mémorisé');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }); await dort(300);
verifier(await mode() === 'light', 'appareil en mode clair → l’appli est claire');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }); await dort(400);
verifier(await mode() === 'dark', 'l’appareil passe en sombre pendant que l’appli est ouverte → elle suit en direct');
await send('Page.reload'); await dort(1800);
verifier(await mode() === 'dark' && await ev(`localStorage.getItem('carnetpatte.mode')`) === 'auto', 'après rechargement avec un appareil sombre : sombre');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }); await dort(400);
verifier(await mode() === 'light', 'retour au clair de l’appareil : l’appli redevient claire');
// Un choix explicite ignore l'appareil
await aller('#/profil'); await ev(`document.querySelector('input[name=mode][value=clair]').click()`); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }); await dort(400);
verifier(await mode() === 'light', '« Clair » reste clair même si l’appareil est sombre');
await ev(`document.querySelector('input[name=mode][value=sombre]').click()`); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }); await dort(400);
verifier(await mode() === 'dark', '« Sombre » reste sombre même si l’appareil est clair');
await send('Emulation.setEmulatedMedia', { features: [] });

// ===== 4. Contraste mesuré dans le navigateur, 12 thèmes + couleurs personnalisées =====
log('--- 4. Contraste 4,5:1 dans le navigateur (variables réellement appliquées) ---');
const MESURE = `(() => {
  const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ctr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const st = getComputedStyle(document.documentElement);
  const rgb = (n) => { const v = st.getPropertyValue(n).trim(); if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)); const m = v.match(/[\\d.]+/g).map(Number); return m.slice(0, 3); };
  const alpha = (n) => { const m = st.getPropertyValue(n).trim().match(/[\\d.]+/g); return m && m.length === 4 ? +m[3] : 1; };
  const poser = (d, a, f) => d.map((v, i) => Math.round(v * a + f[i] * (1 - a)));
  const fond = rgb('--cp-fond'); const bulle = poser(rgb('--cp-bulle-1'), alpha('--cp-bulle-1'), fond);
  const verre = poser(rgb('--cp-verre-fond'), alpha('--cp-verre-fond'), bulle);
  const fonds = { fond, carte: rgb('--cp-carte'), 'surface-2': rgb('--cp-surface-2'), 'vert-clair': rgb('--cp-vert-clair'), 'dégradé': rgb('--cp-degrade'), 'verre sur bulle': verre, 'bouton neutre': rgb('--cp-neutre-bouton') };
  const out = [];
  for (const [nf, f] of Object.entries(fonds)) for (const t of ['--cp-texte', '--cp-texte-doux', '--cp-foret-texte']) out.push([t + ' / ' + nf, ctr(rgb(t), f), 4.5]);
  for (const k of ['--cp-foret', '--cp-foret-survol', '--cp-foret-actif']) out.push(['blanc / ' + k, ctr([255, 255, 255], rgb(k)), 4.5]);
  const moy = (c) => (c[0] + c[1] + c[2]) / 3;
  out.push(['fond pas trop sombre (canal le plus bas >= 24, moyenne >= 28, comme #1C1B22)', Math.min(...fond) >= 24 && moy(fond) >= 28 ? 9 : 0, 4.5]);
  out.push(['cartes plus claires que le fond', lum(rgb('--cp-carte')) > lum(fond) ? 9 : 0, 4.5]);
  out.push(['texte secondaire bien clair / carte (7:1)', ctr(rgb('--cp-texte-doux'), rgb('--cp-carte')), 7]);
  out.push(['texte secondaire bien clair / fond (7:1)', ctr(rgb('--cp-texte-doux'), fond), 7]);
  out.push(['foret-texte / nav-actif', ctr(rgb('--cp-foret-texte'), rgb('--cp-nav-actif')), 4.5]);
  for (const [t, f] of [['--cp-terre', '--cp-terre-pale'], ['--cp-ambre', '--cp-ambre-pale'], ['--cp-succes-texte', '--cp-succes-pale'], ['--cp-terre', '--cp-neutre-bouton'],
    ['--cp-type-vaccin-texte', '--cp-type-vaccin-fond'], ['--cp-type-vermifuge-texte', '--cp-type-vermifuge-fond'], ['--cp-type-antiparasitaire-texte', '--cp-type-antiparasitaire-fond'], ['--cp-type-veto-texte', '--cp-type-veto-fond'], ['--cp-type-autre-texte', '--cp-type-autre-fond'],
    ['--cp-an-magenta-texte', '--cp-an-magenta-fond'], ['--cp-an-brun-texte', '--cp-an-brun-fond'], ['--cp-an-olive-texte', '--cp-an-olive-fond']]) out.push([t + ' / ' + f, ctr(rgb(t), rgb(f)), 4.5]);
  out.push(['contour des champs / carte', ctr(rgb('--cp-bordure-champ'), rgb('--cp-carte')), 3]);
  out.push(['focus / carte', ctr(rgb('--cp-focus'), rgb('--cp-carte')), 3]);
  return { n: out.length, mauvais: out.filter(([, r, m]) => r < m).map(([n, r, m]) => n + ' ' + r.toFixed(2) + '<' + m), pire: Math.min(...out.map(([, r, m]) => r / m)) * 1 };
})()`;
await aller('#/accueil'); await dort(300);
const THEMES = ['kaki', 'bleu-ciel', 'sauge', 'terracotta', 'lavande', 'sable', 'rose-poudre', 'corail', 'menthe', 'turquoise', 'bleu-nuit', 'moutarde'];
let totalPaires = 0; let mauvais = [];
const reglages = [...THEMES.map((id) => ['theme', id]), ['perso', '#7A4FA3'], ['perso', '#FFFFFF'], ['perso', '#000000'], ['perso', '#00FF66'], ['perso', '#FFD400']];
for (const [type, valeur] of reglages) {
  await ev(type === 'theme' ? `import('/js/theme.js').then((m) => m.appliquerTheme('${valeur}', { memoriser: false }))` : `import('/js/theme.js').then((m) => m.appliquerPerso('${valeur}', { memoriser: false }))`);
  const r = await ev(MESURE.replace('(() =>', '(() =>'));
  totalPaires += r.n; mauvais = mauvais.concat(r.mauvais.map((m) => `${valeur} : ${m}`));
}
verifier(mauvais.length === 0, `${reglages.length} réglages en sombre (12 thèmes + 5 couleurs personnalisées), ${totalPaires} paires mesurées, aucune sous 4,5:1 (3:1 pour contour et focus)${mauvais.length ? ' → ' + mauvais.slice(0, 5).join(' | ') : ''}`);
await ev(`import('/js/theme.js').then((m) => m.appliquerTheme('kaki', { memoriser: false }))`);

// ===== 5. axe-core (contraste réel à l'écran) : 4 pages × 13 thèmes =====
log('--- 5. axe-core : contraste réel, 4 pages × 13 thèmes ---');
const PAGES = [['Accueil', '#/accueil'], ['Rappels', '#/animaux/rappels'], ['Fiche', '#/animaux/a'], ['Profil', '#/profil']];
if (axeSrc) {
  const violations = []; let runs = 0;
  for (const [type, valeur] of [...THEMES.slice(0, 12).map((id) => ['theme', id]), ['perso', '#7A4FA3']]) {
    for (const [nom, h] of PAGES) {
      await ev(`location.hash = '${h}'`); await dort(350);
      await ev(type === 'theme' ? `import('/js/theme.js').then((m) => m.appliquerTheme('${valeur}', { memoriser: false }))` : `import('/js/theme.js').then((m) => m.appliquerPerso('${valeur}', { memoriser: false }))`); await dort(150);
      if (!(await ev('!!window.axe'))) await ev(axeSrc);
      const r = await ev(`axe.run(document.querySelector('#contenu'), { runOnly: ['color-contrast'] }).then((r) => r.violations.map((v) => v.nodes.map((n) => n.any[0]?.message.slice(0, 110) + ' | ' + n.html.slice(0, 70))).flat())`);
      runs++;
      violations.push(...r.map((m) => `${valeur} · ${nom} : ${m}`));
    }
  }
  verifier(violations.length === 0, `${runs} contrôles axe « color-contrast » en sombre : ${violations.length} violation(s)${violations.length ? ' → ' + violations.slice(0, 4).join(' || ') : ''}`);
  await ev(`import('/js/theme.js').then((m) => m.appliquerTheme('kaki', { memoriser: false }))`);
} else log('  axe indisponible (pas d’internet) : contrôle ignoré');

// ===== 6. Pages en sombre : captures et mise en page =====
log('--- 6. Pages en sombre ---');
for (const [nom, h] of [...PAGES, ['Boutique', '#/boutique'], ['Toxique', '#/toxique'], ['Sauvegarde', '#/donnees']]) {
  await aller(h); await dort(500);
  await ecran(`sombre-${nom.toLowerCase()}`);
  await controler(`${nom} en sombre à 375 px`);
}
// Un thème autre que le kaki
await ev(`import('/js/theme.js').then((m) => m.appliquerTheme('bleu-ciel', { memoriser: false }))`);
await aller('#/accueil'); await dort(400); await ecran('sombre-accueil-bleu');
await ev(`import('/js/theme.js').then((m) => m.appliquerTheme('kaki', { memoriser: false }))`);

// Carte : liste et fond lisibles
await send('Browser.grantPermissions', { origin: new globalThis.URL(URL).origin, permissions: ['geolocation'] }).catch(() => {});
await send('Emulation.setGeolocationOverride', { latitude: 48.1175, longitude: -1.6775, accuracy: 20 });
await aller('#/carte'); await dort(600);
await ev(`document.querySelector('#ca-loc').click()`);
for (let i = 0; i < 60 && !(await ev(`document.querySelectorAll('.ca-lieu').length > 0`)); i++) await dort(250);
await dort(800);
verifier(await ev(`document.querySelectorAll('.ca-lieu').length > 0`), 'Carte : la liste des lieux s’affiche en sombre');
await ecran('sombre-carte');
const carte = await ev(`(() => { const c = document.querySelector('.ca-carte'); const l = document.querySelector('.ca-lieu'); const cs = getComputedStyle(l); return { fondCarte: getComputedStyle(c).backgroundColor, couleurTexte: cs.color, fondLieu: cs.backgroundColor }; })()`);
log('  Carte : fond de la carte', carte.fondCarte, '· texte d’un lieu', carte.couleurTexte, 'sur', carte.fondLieu);
if (axeSrc) {
  if (!(await ev('!!window.axe'))) await ev(axeSrc);
  const v = await ev(`axe.run(document.querySelector('#contenu'), { runOnly: ['color-contrast'] }).then((r) => r.violations.map((v) => v.nodes.map((n) => n.any[0]?.message.slice(0, 110) + ' | ' + n.html.slice(0, 70))).flat())`);
  verifier(v.length === 0, `Carte en sombre : contraste ${v.length ? v.slice(0, 3).join(' || ') : 'conforme (axe color-contrast)'}`);
}
await controler('Carte en sombre à 375 px');

// ===== 6 bis. Profil > Couleur de l'appli en sombre : cartes de thèmes, case cochée, nuancier =====
log('--- 6 bis. Profil : couleur de l\'appli en sombre ---');
for (const theme of ['kaki', 'bleu-ciel', 'lavande']) {
  await aller('#/profil'); await dort(500);
  await ev(`document.querySelector('input[name=theme][value=${theme}]').click()`); await dort(300); // le vrai clic de l’utilisateur
  await ev(`document.querySelector('input[name=theme]:checked').closest('.pf-theme').scrollIntoView({ block: 'center' })`); await dort(300);
  const t = await ev(`(() => { const cartes = [...document.querySelectorAll('.pf-theme')].map((l) => { const c = l.querySelector('.pf-theme__carte'); const cs = getComputedStyle(c); const nom = getComputedStyle(l.querySelector('.pf-theme__nom')); const coche = getComputedStyle(l.querySelector('.pf-theme__pastille .ic')); return { id: l.className, fond: cs.backgroundImage.includes('gradient'), bord: cs.borderTopColor, nomCouleur: nom.color, coche: coche.opacity, choisie: l.querySelector('input').checked }; }); return cartes; })()`);
  const choisie = t.find((c) => c.choisie);
  const autre = t.find((c) => !c.choisie);
  const lumHex = (css) => { const m = css.match(/[0-9.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  verifier(t.length === 13 && t.every((c) => lumHex(c.nomCouleur) > 0.5), `${theme} : 13 cartes (12 thèmes + perso), noms en texte clair`);
  verifier(choisie && choisie.coche === '1' && autre.coche === '0' && choisie.bord !== autre.bord, `${theme} : la carte choisie se voit (case cochée visible, contour ${choisie?.bord} contre ${autre?.bord})`);
  await ecran(`profil-sombre-${theme}`);
}
await ev(`import('/js/theme.js').then((m) => m.appliquerTheme('kaki'))`);
await aller('#/profil'); await dort(400);
const apercuPerso = await ev(`(() => { const e = document.querySelector('[data-perso-carte]'); return { style: e.getAttribute('style'), fond: getComputedStyle(e.querySelector('.pf-theme__carte')).backgroundImage }; })()`);
const fondPerso0 = apercuPerso.style.match(/--pf-fond: (#[0-9A-Fa-f]{6})/)[1];
verifier(Number.parseInt(fondPerso0.slice(1, 3), 16) < 90 && /gradient/.test(apercuPerso.fond), `carte « Couleur personnalisée » en sombre : aperçu sombre (${fondPerso0})`);
const nuancier = await ev(`(() => { const n = document.querySelector('.pf-perso__nuancier'); const cs = getComputedStyle(n); const e = getComputedStyle(document.querySelector('.pf-perso__etiquette')); return { bord: cs.borderTopColor, fond: cs.backgroundColor, scheme: cs.colorScheme, etiquette: e.color }; })()`);
verifier(nuancier.scheme === 'dark' && nuancier.bord !== nuancier.fond, `nuancier : contour visible (${nuancier.bord} sur ${nuancier.fond}), contrôles natifs sombres`);
await ev(`document.querySelector('.pf-perso').scrollIntoView({ block: 'center' })`); await dort(300);
await ecran('profil-sombre-nuancier');
await controler('Profil (couleurs) en sombre à 375 px');

// ===== 7. Couleur personnalisée en sombre, rechargement =====
log('--- 7. Couleur personnalisée ---');
await aller('#/profil'); await dort(400);
await ev(`(() => { const i = document.querySelector('#pf-couleur'); i.value = '#2e86ab'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await dort(300);
const memo = await ev(`({ clair: !!localStorage.getItem('carnetpatte.themePersoVars'), sombre: !!localStorage.getItem('carnetpatte.themePersoVarsSombre'), theme: localStorage.getItem('carnetpatte.theme') })`);
verifier(memo.clair && memo.sombre && memo.theme === 'perso', 'couleur personnalisée : variables claires ET sombres mémorisées');
const fondPerso = await variable('--cp-fond');
verifier(fondPerso !== '#F9FAF5' && Number.parseInt(fondPerso.slice(1, 3), 16) < 60, `appliquée en sombre : fond ${fondPerso}`);
await send('Page.reload'); await dort(1800);
verifier(await mode() === 'dark' && await variable('--cp-fond') === fondPerso && await ev(`document.documentElement.dataset.theme`) === 'perso', 'après rechargement : sombre + couleur personnalisée, identiques');
await ev(`document.querySelector('input[name=mode][value=clair]')?.click()`);
await aller('#/profil'); await ev(`document.querySelector('input[name=mode][value=clair]').click()`); await dort(400);
verifier(await mode() === 'light' && await variable('--cp-fond') !== fondPerso, 'retour au clair : les couleurs claires de la couleur personnalisée reviennent');
await ev(`document.querySelector('input[name=mode][value=sombre]').click()`); await dort(300);
verifier(await variable('--cp-fond') === fondPerso, 'puis au sombre : les couleurs sombres reviennent');

// ===== 8. Hors connexion =====
log('--- 8. Hors connexion ---');
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await ev(`document.querySelector('input[name=mode][value=clair]').click()`); await dort(300);
await ev(`document.querySelector('input[name=mode][value=sombre]').click()`); await dort(300);
verifier(await mode() === 'dark', 'hors connexion : le changement de mode marche (aucun fichier à télécharger)');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

// Le mode ne fait pas partie des données : l'export reste identique
const exp1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp1)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
verifier(await mode() === 'dark', 'effacer / réimporter les données ne change pas l’apparence (réglage de l’appareil, pas une donnée)');
fin(net(exp1) === net(exp2));
