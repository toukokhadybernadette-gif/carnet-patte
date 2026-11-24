// Petit générateur de PDF, sans bibliothèque : tout se passe sur l'appareil, hors ligne comprise.
// Police Helvetica (standard, intégrée à tous les lecteurs de PDF), encodage Windows-1252 : les accents français et « » ’ — € œ sont bien rendus.
// On dessine sur la page avec des coordonnées en points depuis son COIN HAUT GAUCHE (A4 : 595 x 842), comme à l'écran :
//   const pdf = new Pdf({ titre: 'Fiche de garde' });
//   pdf.rect(x, y, l, h, { r: 10, fond: [1, 1, 1], trait: [0.2, 0.2, 0.2] }); pdf.texte(x, yDeLaLigne, 'Bonjour', { taille: 11, gras: true });
//   pdf.photoRonde(photo, cx, cy, rayon); pdf.icone('heart', x, y, 14, { couleur }); pdf.nouvellePage();
//   const octets = pdf.octets();   // Uint8Array à mettre dans un Blob
// `photo` : { octets: Uint8Array d'un JPEG, largeur, hauteur }. Les couleurs sont [rouge, vert, bleu] de 0 à 1.

import { dessinIcone } from './icons.js';
import { cheminPdfIcone } from './pdf-icones.js';

export const A4 = { l: 595.28, h: 841.89 };

// Largeurs Helvetica (millièmes d'em) des caractères ASCII 32 à 126
const LARGEURS = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const LARGEURS_GRAS = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975,
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333,
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// Caractères hors Latin-1 gérés par Windows-1252
const CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F };

/** Texte nettoyé : espaces insécables fines → espace, retours à la ligne gardés, le reste inchangé. */
const nettoyer = (t) => String(t ?? '').replace(/[  ​]/g, ' ').replace(/\r\n?/g, '\n');

/** Le code Windows-1252 d'un caractère (63 = « ? » pour ce qui n'existe pas). */
function code(c) {
  const n = c.codePointAt(0);
  if (n < 128 || (n >= 160 && n <= 255)) return n;
  return CP1252[c] ?? 63;
}

/** Largeur d'un texte en points, pour une taille donnée. Une lettre accentuée a la largeur de sa lettre de base. */
export function largeurTexte(texte, taille, gras = false) {
  const table = gras ? LARGEURS_GRAS : LARGEURS;
  let total = 0;
  for (const c of nettoyer(texte)) {
    let base = c;
    if (c.codePointAt(0) > 127) base = c.normalize('NFD')[0];
    const n = base.codePointAt(0);
    total += n >= 32 && n <= 126 ? table[n - 32] : (c === 'œ' || c === 'Œ' ? 889 : 556);
  }
  return (total * taille) / 1000;
}

/** Découpe un texte en lignes qui tiennent dans `largeur` points. */
export function couperLignes(texte, largeur, taille, gras = false) {
  const lignes = [];
  for (const paragraphe of nettoyer(texte).split('\n')) {
    let ligne = '';
    for (const mot of paragraphe.split(/ +/).filter((m, i, t) => m !== '' || t.length === 1)) {
      let morceau = mot;
      // Un mot plus long que la ligne est coupé caractère par caractère
      while (largeurTexte(morceau, taille, gras) > largeur) {
        if (ligne) { lignes.push(ligne); ligne = ''; }
        let n = morceau.length;
        while (n > 1 && largeurTexte(morceau.slice(0, n), taille, gras) > largeur) n--;
        lignes.push(morceau.slice(0, n));
        morceau = morceau.slice(n);
      }
      const essai = ligne ? `${ligne} ${morceau}` : morceau;
      if (ligne && largeurTexte(essai, taille, gras) > largeur) { lignes.push(ligne); ligne = morceau; } else ligne = essai;
    }
    lignes.push(ligne);
  }
  return lignes;
}

/** Chaîne PDF : (…) avec échappement ; tout caractère non ASCII devient un code octal Windows-1252. */
export function chainePdf(texte) {
  let s = '';
  for (const c of nettoyer(texte)) {
    const n = code(c);
    if (c === '(' || c === ')' || c === '\\') s += `\\${c}`;
    else if (n >= 32 && n < 127) s += c;
    else if (n === 10) s += ' ';
    else s += `\\${n.toString(8).padStart(3, '0')}`;
  }
  return `(${s})`;
}

export const nombre = (n) => (Math.round(n * 100) / 100).toString();
const hex16 = (t) => `<FEFF${[...t].map((c) => c.codePointAt(0).toString(16).padStart(4, '0').slice(-4)).join('').toUpperCase()}>`;

const K = 0.5522847498; // courbe de Bézier d'un quart de cercle

export class Pdf {
  constructor({ titre = 'Document' } = {}) {
    this.titre = titre;
    this.pages = [];
    this.photo = null;
    this.boites = []; // chaque texte dessiné, avec sa largeur : sert à vérifier qu'aucun texte ne dépasse de la page
    this.nouvellePage();
  }

  nouvellePage() { this.pages.push([]); }

  get page() { return this.pages[this.pages.length - 1]; }
  /** Ordonnée PDF (depuis le bas) d'une ordonnée « écran » (depuis le haut). */
  y(v) { return nombre(A4.h - v); }

  /** Rectangle (coins arrondis si r > 0), rempli (`fond`) et/ou tracé (`trait`). */
  rect(x, y, l, h, { r = 0, fond = null, trait = null, epaisseur = 1 } = {}) {
    r = Math.min(r, l / 2, h / 2);
    const [x0, y0, x1, y1] = [x, A4.h - y - h, x + l, A4.h - y];
    const c = r * (1 - K);
    const chemin = r > 0
      ? `${nombre(x0 + r)} ${nombre(y0)} m ${nombre(x1 - r)} ${nombre(y0)} l ${nombre(x1 - c)} ${nombre(y0)} ${nombre(x1)} ${nombre(y0 + c)} ${nombre(x1)} ${nombre(y0 + r)} c `
        + `${nombre(x1)} ${nombre(y1 - r)} l ${nombre(x1)} ${nombre(y1 - c)} ${nombre(x1 - c)} ${nombre(y1)} ${nombre(x1 - r)} ${nombre(y1)} c `
        + `${nombre(x0 + r)} ${nombre(y1)} l ${nombre(x0 + c)} ${nombre(y1)} ${nombre(x0)} ${nombre(y1 - c)} ${nombre(x0)} ${nombre(y1 - r)} c `
        + `${nombre(x0)} ${nombre(y0 + r)} l ${nombre(x0)} ${nombre(y0 + c)} ${nombre(x0 + c)} ${nombre(y0)} ${nombre(x0 + r)} ${nombre(y0)} c h`
      : `${nombre(x0)} ${nombre(y0)} ${nombre(l)} ${nombre(h)} re`;
    this.dessinerChemin(chemin, { fond, trait, epaisseur });
  }

  /** Cercle de centre (cx, cy), tracé avec quatre courbes de Bézier. */
  cercle(cx, cy, rayon) {
    const [x, y] = [cx, A4.h - cy];
    const k = K * rayon;
    return `${nombre(x + rayon)} ${nombre(y)} m ${nombre(x + rayon)} ${nombre(y + k)} ${nombre(x + k)} ${nombre(y + rayon)} ${nombre(x)} ${nombre(y + rayon)} c `
      + `${nombre(x - k)} ${nombre(y + rayon)} ${nombre(x - rayon)} ${nombre(y + k)} ${nombre(x - rayon)} ${nombre(y)} c `
      + `${nombre(x - rayon)} ${nombre(y - k)} ${nombre(x - k)} ${nombre(y - rayon)} ${nombre(x)} ${nombre(y - rayon)} c `
      + `${nombre(x + k)} ${nombre(y - rayon)} ${nombre(x + rayon)} ${nombre(y - k)} ${nombre(x + rayon)} ${nombre(y)} c h`;
  }

  disque(cx, cy, rayon, { fond = null, trait = null, epaisseur = 1 } = {}) {
    this.dessinerChemin(this.cercle(cx, cy, rayon), { fond, trait, epaisseur });
  }

  dessinerChemin(chemin, { fond, trait, epaisseur }) {
    if (!fond && !trait) return;
    const couleurs = `${fond ? `${fond.map(nombre).join(' ')} rg ` : ''}${trait ? `${trait.map(nombre).join(' ')} RG ${nombre(epaisseur)} w ` : ''}`;
    this.page.push(`q ${couleurs}${chemin} ${fond && trait ? 'B' : fond ? 'f' : 'S'} Q`);
  }

  ligne(x1, y1, x2, y2, { couleur = [0.5, 0.5, 0.5], epaisseur = 0.75, tirets = null } = {}) {
    this.page.push(`q ${couleur.map(nombre).join(' ')} RG ${nombre(epaisseur)} w ${tirets ? `[${tirets.join(' ')}] 0 d ` : ''}${nombre(x1)} ${this.y(y1)} m ${nombre(x2)} ${this.y(y2)} l S Q`);
  }

  /** Une ligne de texte dont la BASE est à l'ordonnée `y` (déjà coupée : voir couperLignes). */
  texte(x, y, texte, { taille = 11, gras = false, couleur = [0.1, 0.1, 0.1] } = {}) {
    this.boites.push({ page: this.pages.length - 1, x, y, l: largeurTexte(texte, taille, gras), taille, texte });
    this.page.push(`BT /${gras ? 'F2' : 'F1'} ${nombre(taille)} Tf ${couleur.map(nombre).join(' ')} rg ${nombre(x)} ${this.y(y)} Td ${chainePdf(texte)} Tj ET`);
  }

  /** Une icône de l'appli (js/icons.js), dans le carré (x, y, taille x taille). */
  icone(nom, x, y, taille, { couleur = [0.1, 0.1, 0.1], epaisseur = 2 } = {}) {
    const dessin = dessinIcone(nom);
    if (!dessin) return;
    const a = taille / 24;
    this.page.push(`q ${nombre(a)} 0 0 ${nombre(-a)} ${nombre(x)} ${this.y(y)} cm ${couleur.map(nombre).join(' ')} RG ${nombre(epaisseur)} w 1 J 1 j\n${cheminPdfIcone(dessin)}\nS Q`);
  }

  /** La photo, rognée en rond (elle remplit le disque). La même photo sert à toute la fiche. */
  photoRonde(photo, cx, cy, rayon) {
    this.photo = photo;
    const cote = 2 * rayon;
    const echelle = Math.max(cote / photo.largeur, cote / photo.hauteur);
    const [l, h] = [photo.largeur * echelle, photo.hauteur * echelle];
    this.page.push(`q ${this.cercle(cx, cy, rayon)} W n ${nombre(l)} 0 0 ${nombre(h)} ${nombre(cx - l / 2)} ${nombre(A4.h - cy - h / 2)} cm /Im1 Do Q`);
  }

  /** Le fichier PDF complet (Uint8Array). */
  octets() {
    const objets = []; // chaînes « binaires » (un caractère = un octet)
    const n = this.pages.length;
    const idPhoto = this.photo ? 5 : 0;
    const premierePage = idPhoto ? 6 : 5;
    const ids = Array.from({ length: n }, (_, i) => premierePage + i * 2);
    objets[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objets[2] = `<< /Type /Pages /Kids [${ids.map((i) => `${i} 0 R`).join(' ')}] /Count ${n} >>`;
    objets[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objets[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    if (idPhoto) {
      const p = this.photo;
      let donnees = '';
      for (let i = 0; i < p.octets.length; i += 8192) donnees += String.fromCharCode(...p.octets.subarray(i, i + 8192));
      objets[idPhoto] = { dict: `<< /Type /XObject /Subtype /Image /Width ${p.largeur} /Height ${p.hauteur} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${donnees.length} >>`, flux: donnees };
    }
    this.pages.forEach((contenu, i) => {
      const flux = contenu.join('\n');
      objets[ids[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.l} ${A4.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${idPhoto ? ` /XObject << /Im1 ${idPhoto} 0 R >>` : ''} >> /Contents ${ids[i] + 1} 0 R >>`;
      objets[ids[i] + 1] = { dict: `<< /Length ${flux.length} >>`, flux };
    });
    const info = objets.length;
    objets[info] = `<< /Title ${hex16(this.titre)} /Producer (Carnet Patte) /Creator (Carnet Patte) >>`;

    let sortie = '%PDF-1.4\n%âãÏÓ\n';
    const positions = [];
    for (let i = 1; i < objets.length; i++) {
      positions[i] = sortie.length;
      const o = objets[i];
      sortie += typeof o === 'string' ? `${i} 0 obj\n${o}\nendobj\n` : `${i} 0 obj\n${o.dict}\nstream\n${o.flux}\nendstream\nendobj\n`;
    }
    const debutXref = sortie.length;
    sortie += `xref\n0 ${objets.length}\n0000000000 65535 f \n${positions.slice(1).map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
    sortie += `trailer\n<< /Size ${objets.length} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;
    return Uint8Array.from(sortie, (c) => c.charCodeAt(0) & 255);
  }
}
