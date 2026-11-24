// Dessine les icônes de l'appli (js/icons.js, jeu Lucide : grille de 24, trait fin) dans un PDF, avec les mêmes tracés qu'à l'écran.
// Convertit les éléments SVG (path, circle, ellipse, rect, line, polyline, polygon) en ordres de tracé PDF (m, l, c, h) sur la grille de 24.

const K = 0.5522847498; // pour tracer un quart de cercle avec une courbe de Bézier
const nombre = (n) => (Math.round(n * 1000) / 1000).toString();

/** Un arc SVG (rayons rx, ry, rotation, drapeaux, point d'arrivée) devient des courbes de Bézier, comme le prévoit la norme SVG (annexe F.6). */
function arcVersCourbes(x1, y1, rx, ry, rotation, grand, balayage, x2, y2) {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [['l', x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (rotation * Math.PI) / 180; const c = Math.cos(phi); const s = Math.sin(phi);
  const dx = (x1 - x2) / 2; const dy = (y1 - y2) / 2;
  const x1p = c * dx + s * dy; const y1p = -s * dx + c * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (grand === balayage ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry; const cyp = (-coef * ry * x1p) / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2; const cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!balayage && delta > 0) delta -= 2 * Math.PI;
  else if (balayage && delta < 0) delta += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const pas = delta / n; const t = (4 / 3) * Math.tan(pas / 4);
  const sortie = [];
  let a = theta1;
  for (let i = 0; i < n; i++) {
    const b = a + pas;
    const point = (ang) => [Math.cos(ang), Math.sin(ang)];
    const [ca, sa] = point(a); const [cb, sb] = point(b);
    const p1 = [ca - t * sa, sa + t * ca]; const p2 = [cb + t * sb, sb - t * cb]; const p3 = [cb, sb];
    const versPlan = ([ex, ey]) => [c * rx * ex - s * ry * ey + cx, s * rx * ex + c * ry * ey + cy];
    const [a1x, a1y] = versPlan(p1); const [a2x, a2y] = versPlan(p2); const [a3x, a3y] = versPlan(p3);
    sortie.push(['c', a1x, a1y, a2x, a2y, a3x, a3y]);
    a = b;
  }
  return sortie;
}

/** Le contenu d'un attribut « d » de path SVG → ordres [['m', x, y], ['l', x, y], ['c', …], ['h']]. */
function lirePath(d) {
  const ordres = [];
  let i = 0;
  const espaces = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  const nombreSuivant = () => {
    espaces();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i));
    if (!m) throw new Error('chemin SVG illisible');
    i += m[0].length;
    return Number(m[0]);
  };
  const drapeau = () => { espaces(); const v = d[i] === '1' ? 1 : 0; i++; return v; }; // un drapeau d'arc est un seul caractère, parfois collé au suivant
  let x = 0; let y = 0; let departX = 0; let departY = 0; let precX = 0; let precY = 0; let derniere = '';
  let cmd = '';
  while (true) {
    espaces();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) { cmd = d[i]; i++; } // sinon : le même ordre continue avec de nouveaux nombres
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ax = (v) => (rel ? x + v : v); const ay = (v) => (rel ? y + v : v);
    if (C === 'Z') { ordres.push(['h']); x = departX; y = departY; derniere = 'Z'; continue; }
    if (C === 'M') { const nx = ax(nombreSuivant()); const ny = ay(nombreSuivant()); ordres.push(['m', nx, ny]); x = nx; y = ny; departX = x; departY = y; cmd = rel ? 'l' : 'L'; derniere = 'M'; continue; }
    if (C === 'L') { const nx = ax(nombreSuivant()); const ny = ay(nombreSuivant()); ordres.push(['l', nx, ny]); x = nx; y = ny; derniere = 'L'; continue; }
    if (C === 'H') { const nx = ax(nombreSuivant()); ordres.push(['l', nx, y]); x = nx; derniere = 'H'; continue; }
    if (C === 'V') { const ny = ay(nombreSuivant()); ordres.push(['l', x, ny]); y = ny; derniere = 'V'; continue; }
    if (C === 'C' || C === 'S') {
      let x1; let y1;
      if (C === 'C') { x1 = ax(nombreSuivant()); y1 = ay(nombreSuivant()); } else if (derniere === 'C' || derniere === 'S') { x1 = 2 * x - precX; y1 = 2 * y - precY; } else { x1 = x; y1 = y; }
      const x2 = ax(nombreSuivant()); const y2 = ay(nombreSuivant()); const nx = ax(nombreSuivant()); const ny = ay(nombreSuivant());
      ordres.push(['c', x1, y1, x2, y2, nx, ny]); precX = x2; precY = y2; x = nx; y = ny; derniere = C; continue;
    }
    if (C === 'Q' || C === 'T') {
      let qx; let qy;
      if (C === 'Q') { qx = ax(nombreSuivant()); qy = ay(nombreSuivant()); } else if (derniere === 'Q' || derniere === 'T') { qx = 2 * x - precX; qy = 2 * y - precY; } else { qx = x; qy = y; }
      const nx = ax(nombreSuivant()); const ny = ay(nombreSuivant());
      ordres.push(['c', x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), nx + (2 / 3) * (qx - nx), ny + (2 / 3) * (qy - ny), nx, ny]);
      precX = qx; precY = qy; x = nx; y = ny; derniere = C; continue;
    }
    if (C === 'A') {
      const rx = nombreSuivant(); const ry = nombreSuivant(); const rot = nombreSuivant(); const g = drapeau(); const b = drapeau();
      const nx = ax(nombreSuivant()); const ny = ay(nombreSuivant());
      ordres.push(...arcVersCourbes(x, y, rx, ry, rot, g, b, nx, ny)); x = nx; y = ny; derniere = 'A'; continue;
    }
    throw new Error(`ordre SVG non géré : ${cmd}`);
  }
  return ordres;
}

const ellipse = (cx, cy, rx, ry) => [['m', cx + rx, cy],
  ['c', cx + rx, cy + K * ry, cx + K * rx, cy + ry, cx, cy + ry], ['c', cx - K * rx, cy + ry, cx - rx, cy + K * ry, cx - rx, cy],
  ['c', cx - rx, cy - K * ry, cx - K * rx, cy - ry, cx, cy - ry], ['c', cx + K * rx, cy - ry, cx + rx, cy - K * ry, cx + rx, cy], ['h']];

function rectangle(x, y, w, h, rx = 0, ry = rx) {
  rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
  if (!rx || !ry) return [['m', x, y], ['l', x + w, y], ['l', x + w, y + h], ['l', x, y + h], ['h']];
  return [['m', x + rx, y], ['l', x + w - rx, y], ['c', x + w - rx + K * rx, y, x + w, y + ry - K * ry, x + w, y + ry], ['l', x + w, y + h - ry],
    ['c', x + w, y + h - ry + K * ry, x + w - rx + K * rx, y + h, x + w - rx, y + h], ['l', x + rx, y + h],
    ['c', x + rx - K * rx, y + h, x, y + h - ry + K * ry, x, y + h - ry], ['l', x, y + ry], ['c', x, y + ry - K * ry, x + rx - K * rx, y, x + rx, y], ['h']];
}

/** Le dessin d'une icône (texte SVG) → ordres de tracé sur la grille de 24. */
export function ordresIcone(svg) {
  const ordres = [];
  for (const [, balise, attrs] of svg.matchAll(/<(\w+)([^>]*?)\/?>/g)) {
    const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const n = (k, defaut = 0) => (a[k] === undefined ? defaut : Number(a[k]));
    if (balise === 'path') ordres.push(...lirePath(a.d));
    else if (balise === 'circle') ordres.push(...ellipse(n('cx'), n('cy'), n('r'), n('r')));
    else if (balise === 'ellipse') ordres.push(...ellipse(n('cx'), n('cy'), n('rx'), n('ry')));
    else if (balise === 'rect') ordres.push(...rectangle(n('x'), n('y'), n('width'), n('height'), n('rx'), a.ry === undefined ? n('rx') : n('ry')));
    else if (balise === 'line') ordres.push(['m', n('x1'), n('y1')], ['l', n('x2'), n('y2')]);
    else if (balise === 'polyline' || balise === 'polygon') {
      const pts = (a.points ?? '').trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i + 1 < pts.length; i += 2) ordres.push([i === 0 ? 'm' : 'l', pts[i], pts[i + 1]]);
      if (balise === 'polygon') ordres.push(['h']);
    }
  }
  return ordres;
}

/** Les ordres PDF (texte) d'une icône, sur la grille de 24 ; à placer dans une transformation `cm` qui met l'icône à sa taille et à sa place. */
export function cheminPdfIcone(svg) {
  return ordresIcone(svg).map(([o, ...v]) => `${v.map(nombre).join(' ')}${v.length ? ' ' : ''}${o}`).join('\n');
}
