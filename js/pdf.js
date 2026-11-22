// Petit générateur de PDF (texte + une photo JPEG), sans bibliothèque : tout se passe sur l'appareil, hors ligne comprise.
// Police Helvetica (standard, intégrée à tous les lecteurs de PDF), encodage Windows-1252 : les accents français et « » ’ — € œ sont bien rendus.
// Usage :  const pdf = new Pdf({ titre: 'Fiche de garde', pied: 'Carnet Patte' });
//          pdf.entete({ surtitre, nom, lignes, photo }); pdf.section('Repas'); pdf.paire('Aliment', 'Croquettes'); pdf.paragraphe('…');
//          const octets = pdf.octets();   // Uint8Array à mettre dans un Blob
// `photo` : { octets: Uint8Array d'un JPEG, largeur, hauteur } (voir jpegDepuisImage dans modules/animaux/garde.js).

const A4 = { l: 595.28, h: 841.89 };
const MARGE = 42;
const BAS = 56; // place gardée en bas pour le pied de page

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
function chainePdf(texte) {
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

const nombre = (n) => (Math.round(n * 100) / 100).toString();
const hex16 = (t) => `<FEFF${[...t].map((c) => c.codePointAt(0).toString(16).padStart(4, '0').slice(-4)).join('').toUpperCase()}>`;

export class Pdf {
  constructor({ titre = 'Document', pied = '' } = {}) {
    this.titre = titre;
    this.pied = pied;
    this.pages = [];
    this.photo = null;
    this.nouvellePage();
  }

  nouvellePage() {
    this.pages.push([]);
    this.y = A4.h - MARGE;
  }

  get page() { return this.pages[this.pages.length - 1]; }
  get largeur() { return A4.l - 2 * MARGE; }

  /** Assure `hauteur` points libres : sinon page suivante. */
  place(hauteur) { if (this.y - hauteur < BAS) this.nouvellePage(); }

  espace(n) { this.y -= n; }

  /** Écrit des lignes déjà coupées à partir de la position courante. */
  ecrire(lignes, { taille = 11, gras = false, couleur = [0.12, 0.12, 0.12], x = MARGE, interligne = 1.4 } = {}) {
    const h = taille * interligne;
    for (const ligne of lignes) {
      this.place(h);
      this.y -= h;
      this.page.push(`BT /${gras ? 'F2' : 'F1'} ${nombre(taille)} Tf ${couleur.map(nombre).join(' ')} rg ${nombre(x)} ${nombre(this.y + taille * (interligne - 1) / 2 + 1)} Td ${chainePdf(ligne)} Tj ET`);
    }
  }

  paragraphe(texte, options = {}) {
    const { taille = 11, gras = false, largeur = this.largeur, x = MARGE } = options;
    this.ecrire(couperLignes(texte, largeur - (x - MARGE), taille, gras), options);
  }

  /** Bandeau de section : fond coloré et titre en gras. */
  section(titre) {
    this.place(60);
    this.espace(10);
    this.y -= 22;
    this.page.push(`0.93 0.95 0.84 rg ${nombre(MARGE)} ${nombre(this.y)} ${nombre(this.largeur)} 22 re f`);
    this.page.push(`0.36 0.39 0.20 rg ${nombre(MARGE)} ${nombre(this.y)} 3 22 re f`);
    this.page.push(`BT /F2 12 Tf 0.25 0.28 0.12 rg ${nombre(MARGE + 10)} ${nombre(this.y + 6.5)} Td ${chainePdf(titre)} Tj ET`);
    this.espace(4);
  }

  /** « Libellé » en petit et gris, puis la valeur dessous. */
  paire(libelle, valeur) {
    const lignes = couperLignes(valeur, this.largeur - 10, 11);
    this.place(14 * 1.4 + 11 * 1.4 * Math.min(lignes.length, 2));
    this.ecrire([libelle], { taille: 9, gras: true, couleur: [0.4, 0.4, 0.4], x: MARGE + 10, interligne: 1.5 });
    this.ecrire(lignes, { taille: 11, x: MARGE + 10 });
    this.espace(3);
  }

  /** En-tête de la première page : surtitre, grand nom, lignes de détail et photo à droite. */
  entete({ surtitre, nom, lignes = [], photo = null }) {
    const haut = this.y;
    const largeurTexteEntete = photo ? this.largeur - 100 : this.largeur;
    this.ecrire([surtitre.toUpperCase()], { taille: 9, gras: true, couleur: [0.36, 0.39, 0.2], interligne: 1.6 });
    this.ecrire(couperLignes(nom, largeurTexteEntete, 24, true), { taille: 24, gras: true, interligne: 1.25 });
    this.espace(2);
    for (const l of lignes) this.ecrire(couperLignes(l, largeurTexteEntete, 11), { taille: 11, couleur: [0.25, 0.25, 0.25] });
    if (photo) {
      const cote = 84;
      this.photo = photo;
      this.page.push(`q ${cote} 0 0 ${cote} ${nombre(A4.l - MARGE - cote)} ${nombre(haut - cote)} cm /Im1 Do Q`);
      this.y = Math.min(this.y, haut - cote);
    }
    this.espace(6);
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
      const pied = `BT /F1 8 Tf 0.5 0.5 0.5 rg ${MARGE} 30 Td ${chainePdf(`${this.pied}${this.pied ? ' · ' : ''}page ${i + 1} sur ${n}`)} Tj ET`;
      const flux = [...contenu, pied].join('\n');
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
