// Le PDF de la fiche de garde : une vraie page soignée, aux couleurs du thème choisi, qui tient sur une page (deux au plus), lisible aussi en noir et blanc.
//   En-tête : photo ronde, nom en grand, détails, dates de garde, logo Carnet Patte.
//   « Urgences » bien visible (cadre épais, bandeau plein, mot « URGENCES » : lisible sans couleur) : vétérinaire, personne à prévenir, centres antipoison.
//   Des cartes arrondies avec une icône (santé, repas, habitudes…), puis la grille du suivi de la garde (à cocher au stylo ou déjà cochée).
// Le contenu vient de modeleFiche() (modules/animaux/garde.js), le même que pour l'écran. Les centres antipoison et leurs horaires y sont
// repris tels quels de modules/toxique/donnees.js : on n'en écrit jamais à la main.

import { Pdf, A4, couperLignes, largeurTexte } from './pdf.js';
import { formatDate, lireISO } from './utils.js';

const MARGE = 34;
const LARGEUR = A4.l - 2 * MARGE;
const GOUTTIERE = 12;
const COLONNE = (LARGEUR - GOUTTIERE) / 2;
const BAS_UTILE = A4.h - 44; // au-delà : le pied de page
const HAUT_P1 = MARGE + 116; // sous l'en-tête de la première page
const HAUT_SUITE = MARGE + 30; // sous le petit en-tête des pages suivantes
const ECHELLES = [1, 0.95, 0.9, 0.86, 0.82]; // du plus lisible au plus compact : on prend le premier qui tient sur une page
const NOIR = [0.1, 0.1, 0.1];
const GRIS = [0.33, 0.33, 0.33];

// ----- Couleurs du thème (celui de l'écran), ramenées à des couleurs d'impression lisibles -----

const COULEURS_REPLI = { foret: [0.357, 0.388, 0.204], terre: [0.62, 0.25, 0.15] };

function lireCouleur(nom, repli) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
    if (hex) { const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }
    const rgb = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(v);
    if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Number(n) / 255);
  } catch { /* hors navigateur : couleurs de repli */ }
  return repli;
}
const luminance = ([r, g, b]) => { const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrasteSurBlanc = (c) => 1.05 / (luminance(c) + 0.05);
const melange = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
/** Assombrit une couleur jusqu'à être lisible sur du papier blanc (même si le thème de l'écran est sombre, donc clair). */
function pourPapier(c) { let r = c; for (let i = 0; i < 30 && contrasteSurBlanc(r) < 4.8; i++) r = r.map((v) => v * 0.92); return r; }

/** La palette d'impression, tirée du thème choisi par l'utilisateur. */
export function paletteTheme() {
  const primaire = pourPapier(lireCouleur('--cp-foret', COULEURS_REPLI.foret));
  const alerte = pourPapier(lireCouleur('--cp-terre', COULEURS_REPLI.terre));
  return { primaire, pale: melange(primaire, [1, 1, 1], 0.9), bord: melange(primaire, [0.2, 0.2, 0.2], 0.35), alerte, alertePale: melange(alerte, [1, 1, 1], 0.92) };
}

// ----- Briques de contenu : un « atome » est une ligne (ou un petit bloc) de hauteur connue, qui ne se coupe jamais -----

const atome = (h, dessiner, colle = false) => ({ h, dessiner, colle });
const taille = (s) => ({ corps: 9.6 * s, petit: Math.max(7.2, 7.8 * s), titre: 11.5 * s, ligne: 1.32 });

/** Un libellé (petit, gras) puis sa valeur, qui peut tenir sur plusieurs lignes. */
function atomesPaire(libelle, valeur, largeur, s, P) {
  const t = taille(s);
  const lignes = couperLignes(valeur, largeur, t.corps);
  const atomes = [atome(t.petit * 1.4, (pdf, x, y) => pdf.texte(x, y + t.petit * 1.05, libelle, { taille: t.petit, gras: true, couleur: GRIS }), true)];
  lignes.forEach((l, i) => atomes.push(atome(t.corps * t.ligne + (i === lignes.length - 1 ? 3.5 * s : 0), (pdf, x, y) => pdf.texte(x, y + t.corps * 1.02, l, { taille: t.corps, couleur: NOIR }))));
  return atomes;
}

function atomesTexte(texte, largeur, s, { gras = false, taille: tl, couleur = NOIR, apres = 0 } = {}) {
  const t = taille(s);
  const tt = tl ?? t.corps;
  const lignes = couperLignes(texte, largeur, tt, gras);
  return lignes.map((l, i) => atome(tt * t.ligne + (i === lignes.length - 1 ? apres : 0), (pdf, x, y) => pdf.texte(x, y + tt * 1.02, l, { taille: tt, gras, couleur })));
}

/** L'encadré des vaccins : le dernier, le prochain rappel (ou « à renouveler »), ou rien d'enregistré. Un seul bloc, jamais coupé. */
function atomeVaccins(v, largeur, s, P) {
  const t = taille(s);
  const retard = v.etat === 'retard';
  const lignes = [{ texte: 'VACCINS', gras: true, petit: true }];
  if (!v.dernier) lignes.push({ texte: v.texte });
  else {
    lignes.push({ texte: `Dernier vaccin : ${v.dernier.nom}, le ${formatDate(v.dernier.date)}` });
    lignes.push({ texte: v.prochain ? `${v.prochain.retard ? 'À RENOUVELER' : 'Prochain rappel'} : ${v.prochain.nom}, le ${formatDate(v.prochain.date)}` : 'Aucun rappel de vaccin prévu', gras: retard });
  }
  const interieur = largeur - 2 * 7 * s - 17 * s;
  const coupees = lignes.flatMap((l) => couperLignes(l.texte, interieur, l.petit ? t.petit : t.corps, l.gras).map((texte) => ({ ...l, texte })));
  const h = 7 * s * 2 + coupees.reduce((n, l) => n + (l.petit ? t.petit : t.corps) * t.ligne, 0) + 2 * s;
  return atome(h + 5 * s, (pdf, x, y, l) => {
    pdf.rect(x, y, l, h, { r: 7 * s, fond: retard ? P.alertePale : P.pale, trait: retard ? P.alerte : P.bord, epaisseur: retard ? 1.6 : 0.8 });
    pdf.icone(retard ? 'bell-ring' : 'syringe', x + 7 * s, y + 8 * s, 13 * s, { couleur: retard ? P.alerte : P.primaire, epaisseur: 2.2 });
    let yy = y + 7 * s;
    for (const ligne of coupees) {
      const tl = ligne.petit ? t.petit : t.corps;
      pdf.texte(x + 7 * s + 17 * s, yy + tl * 1.02, ligne.texte, { taille: tl, gras: ligne.gras, couleur: ligne.petit ? GRIS : NOIR });
      yy += tl * t.ligne;
    }
  });
}

/** Les traitements en cours : une puce par traitement (médicament en gras, puis dose et horaires). */
function atomesTraitements(liste, largeur, s) {
  const t = taille(s);
  return liste.flatMap((tr) => {
    const detail = [tr.dose, tr.horaires].filter(Boolean).join(' · ');
    const texte = `${tr.nom || 'Traitement'}${detail ? ` : ${detail}` : ''}`;
    const lignes = couperLignes(texte, largeur - 10 * s, t.corps);
    return lignes.map((l, i) => atome(t.corps * t.ligne + (i === lignes.length - 1 ? 2 * s : 0), (pdf, x, y) => {
      if (i === 0) pdf.disque(x + 3 * s, y + t.corps * 0.62, 1.6 * s, { fond: GRIS });
      const gras = tr.nom && i === 0 ? Math.min(l.length, tr.nom.length) : 0;
      if (gras) { pdf.texte(x + 10 * s, y + t.corps * 1.02, l.slice(0, gras), { taille: t.corps, gras: true, couleur: NOIR }); pdf.texte(x + 10 * s + largeurTexte(l.slice(0, gras), t.corps, true), y + t.corps * 1.02, l.slice(gras), { taille: t.corps, couleur: NOIR }); }
      else pdf.texte(x + 10 * s, y + t.corps * 1.02, l, { taille: t.corps, couleur: NOIR });
    }));
  });
}

// ----- Les cartes -----

const ENTETE_CARTE = 25;
function carte(titre, icone, atomes, extra = {}) { return { titre, icone, atomes, ...extra }; }
const hauteurAtomes = (atomes) => atomes.reduce((n, a) => n + a.h, 0);
const hauteurCarte = (c, s) => (ENTETE_CARTE + 4) * s + hauteurAtomes(c.atomes) + 6 * s;

function dessinerCarte(pdf, c, x, y, l, s, P) {
  const h = hauteurCarte(c, s);
  pdf.rect(x, y, l, h, { r: 9 * s, fond: [1, 1, 1], trait: P.bord, epaisseur: 1 });
  pdf.disque(x + 14 * s, y + 13.5 * s, 8.5 * s, { fond: P.primaire });
  pdf.icone(c.icone, x + 14 * s - 5.5 * s, y + 13.5 * s - 5.5 * s, 11 * s, { couleur: [1, 1, 1], epaisseur: 2.4 });
  pdf.texte(x + 28 * s, y + 13.5 * s + 4.1 * s, c.titre, { taille: 11.5 * s, gras: true, couleur: NOIR });
  pdf.ligne(x + 10 * s, y + ENTETE_CARTE * s, x + l - 10 * s, y + ENTETE_CARTE * s, { couleur: P.bord, epaisseur: 0.6 });
  let yy = y + (ENTETE_CARTE + 4) * s;
  for (const a of c.atomes) { a.dessiner(pdf, x + 10 * s, yy, l - 20 * s); yy += a.h; }
}

/** Le bloc « Urgences » : cadre épais, bandeau plein, contacts à gauche, centres antipoison à droite, phrase « en dehors de ces horaires » en bas. */
function carteUrgences(u, s, P) {
  const t = taille(s);
  const lc = (LARGEUR - 24 * s) * 0.45; const lp = LARGEUR - 24 * s - lc - 14 * s;
  const gauche = u.contacts.length ? u.contacts.flatMap((c) => [
    atome(t.petit * 1.4, (pdf, x, y) => pdf.texte(x, y + t.petit * 1.05, c.libelle.toUpperCase(), { taille: t.petit, gras: true, couleur: GRIS }), true),
    ...couperLignes(c.nom || '', lc, t.corps + 0.6, true).filter(Boolean).map((l) => atome((t.corps + 0.6) * t.ligne, (pdf, x, y) => pdf.texte(x, y + (t.corps + 0.6) * 1.02, l, { taille: t.corps + 0.6, gras: true, couleur: NOIR }))),
    ...(c.tel ? [atome((t.corps + 3.4) * t.ligne + 3.5 * s, (pdf, x, y) => pdf.texte(x, y + (t.corps + 3.4) * 1.02, c.tel, { taille: t.corps + 3.4, gras: true, couleur: NOIR }))] : [atome(3.5 * s, () => {})]),
  ]) : atomesTexte('Aucun contact renseigné : ajoutez votre vétérinaire et une personne à prévenir dans la fiche.', lc, s, { couleur: GRIS });
  const droite = [
    atome(t.petit * 1.4, (pdf, x, y) => pdf.texte(x, y + t.petit * 1.05, 'EN CAS D\'INGESTION OU D\'INTOXICATION', { taille: t.petit, gras: true, couleur: GRIS }), true),
    ...atomesTexte('Appelez votre vétérinaire ou un centre antipoison vétérinaire :', lp, s, { apres: 2 * s }),
    ...u.antipoison.flatMap((c) => [
      ...couperLignes(c.nom, lp, t.corps, true).map((l) => atome(t.corps * t.ligne, (pdf, x, y) => pdf.texte(x, y + t.corps * 1.02, l, { taille: t.corps, gras: true, couleur: NOIR }))),
      atome((t.corps + 3.4) * t.ligne, (pdf, x, y) => pdf.texte(x, y + (t.corps + 3.4) * 1.02, c.tel, { taille: t.corps + 3.4, gras: true, couleur: NOIR })),
      ...couperLignes(c.horaires, lp, t.petit + 0.4).map((l, i, tab) => atome(t.petit * t.ligne + (i === tab.length - 1 ? 4 * s : 0), (pdf, x, y) => pdf.texte(x, y + t.petit * 1.02, l, { taille: t.petit + 0.4, couleur: GRIS }))),
    ]),
  ];
  const hors = couperLignes(u.horsHoraires, LARGEUR - 2 * 12 * s - 16 * s, t.corps, true);
  const hG = hauteurAtomes(gauche); const hD = hauteurAtomes(droite);
  const hHors = hors.length * t.corps * t.ligne + 10 * s;
  const bandeau = 24 * s;
  const h = bandeau + 10 * s + Math.max(hG, hD) + 6 * s + hHors + 4 * s;
  return {
    h,
    dessiner(pdf, x, y) {
      pdf.rect(x, y, LARGEUR, h, { r: 9 * s, fond: P.alertePale, trait: P.alerte, epaisseur: 2.2 });
      pdf.rect(x + 1.1, y + 1.1, LARGEUR - 2.2, bandeau, { r: 8 * s, fond: P.alerte });
      pdf.rect(x + 1.1, y + bandeau * 0.55, LARGEUR - 2.2, bandeau * 0.45, { fond: P.alerte });
      pdf.icone('triangle-alert', x + 12 * s, y + 5 * s, 14 * s, { couleur: [1, 1, 1], epaisseur: 2.4 });
      pdf.texte(x + 31 * s, y + 16.5 * s, 'URGENCES', { taille: 12.5 * s, gras: true, couleur: [1, 1, 1] });
      let yy = y + bandeau + 8 * s;
      for (const a of gauche) { a.dessiner(pdf, x + 12 * s, yy, lc); yy += a.h; }
      yy = y + bandeau + 8 * s;
      for (const a of droite) { a.dessiner(pdf, x + 12 * s + lc + 14 * s, yy, lp); yy += a.h; }
      pdf.ligne(x + 12 * s + lc + 7 * s, y + bandeau + 10 * s, x + 12 * s + lc + 7 * s, y + bandeau + 6 * s + Math.max(hG, hD), { couleur: P.alerte, epaisseur: 0.8 });
      const yHors = y + bandeau + 10 * s + Math.max(hG, hD) + 2 * s;
      pdf.ligne(x + 12 * s, yHors, x + LARGEUR - 12 * s, yHors, { couleur: P.alerte, epaisseur: 0.8, tirets: [3, 2] });
      pdf.icone('info', x + 12 * s, yHors + 5 * s, 11 * s, { couleur: P.alerte, epaisseur: 2.4 });
      hors.forEach((l, i) => pdf.texte(x + 12 * s + 16 * s, yHors + 5 * s + t.corps * 1.02 + i * t.corps * t.ligne, l, { taille: t.corps, gras: true, couleur: NOIR }));
    },
  };
}

/** La grille du suivi de la garde : un jour par ligne, une case par tâche (cochée si elle l'est déjà dans l'appli). */
function carteSuivi(m, s, P, taches) {
  const t = taille(s);
  const jours = m.garde.jours.length ? m.garde.jours : null;
  const nbLignes = jours ? jours.length : 7;
  const deuxBlocs = nbLignes > 9;
  const parBloc = deuxBlocs ? Math.ceil(nbLignes / 2) : nbLignes;
  const lBloc = deuxBlocs ? (LARGEUR - 20 * s - 14 * s) / 2 : LARGEUR - 20 * s;
  const colJour = 58 * s; const colTache = (lBloc - colJour) / taches.length;
  const hLigne = 13.5 * s; const hEntete = 15 * s;
  const lignes = Array.from({ length: nbLignes }, (_, i) => ({ jour: jours?.[i] ?? null, faites: jours ? (m.suivi[jours[i]] ?? []) : [] }));
  const hGrille = hEntete + parBloc * hLigne;
  const atomes = [atome(t.petit * 1.4 + 2 * s, (pdf, x, y, l) => pdf.texte(x, y + t.petit * 1.05, 'Cochez au fur et à mesure de la garde.', { taille: t.petit + 0.3, couleur: GRIS }), true),
    atome(hGrille + 4 * s, (pdf, x, y) => {
      for (let b = 0; b < (deuxBlocs ? 2 : 1); b++) {
        const bx = x + b * (lBloc + 14 * s);
        pdf.rect(bx, y, lBloc, hEntete, { r: 4 * s, fond: P.pale, trait: P.bord, epaisseur: 0.6 });
        pdf.texte(bx + 5 * s, y + hEntete * 0.68, 'Jour', { taille: t.petit, gras: true, couleur: NOIR });
        taches.forEach((tc, i) => pdf.texte(bx + colJour + i * colTache + (colTache - largeurTexte(tc.court, t.petit, true)) / 2, y + hEntete * 0.68, tc.court, { taille: t.petit, gras: true, couleur: NOIR }));
        lignes.slice(b * parBloc, (b + 1) * parBloc).forEach((ln, r) => {
          const ly = y + hEntete + r * hLigne;
          pdf.ligne(bx, ly + hLigne, bx + lBloc, ly + hLigne, { couleur: [0.7, 0.7, 0.7], epaisseur: 0.5 });
          if (ln.jour) pdf.texte(bx + 5 * s, ly + hLigne * 0.7, lireISO(ln.jour).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }), { taille: t.petit, couleur: NOIR });
          taches.forEach((tc, i) => {
            const cx = bx + colJour + i * colTache + colTache / 2 - 4.2 * s; const cy = ly + (hLigne - 8.4 * s) / 2;
            pdf.rect(cx, cy, 8.4 * s, 8.4 * s, { r: 1.5 * s, fond: [1, 1, 1], trait: [0.25, 0.25, 0.25], epaisseur: 0.9 });
            if (ln.faites.includes(tc.id)) pdf.icone('check', cx + 0.6 * s, cy + 0.6 * s, 7.2 * s, { couleur: P.primaire, epaisseur: 3.2 });
          });
        });
      }
    })];
  return carte('Suivi de la garde', 'clipboard-list', atomes, { pleineLargeur: true });
}

// ----- Construction du contenu -----

/** Les cartes de la fiche, à partir du modèle (le même que pour l'écran). `taches` : [{ id, court }] pour la grille. */
export function construireCartes(m, s, P, taches) {
  const cartes = [];
  const l = COLONNE - 20 * s;
  const t = taille(s);
  const sante = [atomeVaccins(m.vaccins, l, s, P)];
  if (m.traitements.length) sante.push(atome(t.petit * 1.4, (pdf, x, y) => pdf.texte(x, y + t.petit * 1.05, 'TRAITEMENTS EN COURS', { taille: t.petit, gras: true, couleur: GRIS }), true), ...atomesTraitements(m.traitements, l, s));
  for (const li of [...m.identification, ...m.autresSoins]) sante.push(...atomesPaire(li.libelle, li.valeur, l, s, P));
  cartes.push(carte('Santé', 'stethoscope', sante));
  for (const sec of m.sections) cartes.push(carte(sec.titre, sec.icone, sec.lignes.flatMap((li) => atomesPaire(li.libelle, li.valeur, l, s, P))));
  cartes.push(carteSuivi(m, s, P, taches));
  return cartes;
}

// ----- Mise en page : une page si possible, sinon deux ; une carte qui ne tient pas est reportée, jamais coupée au milieu d'une ligne -----

function decouper(c, espace, s) {
  const reste = [...c.atomes];
  const prise = [];
  let h = (ENTETE_CARTE + 4) * s + 6 * s;
  while (reste.length) {
    // un libellé reste avec sa valeur : on regroupe les atomes « collés » avec le suivant
    const groupe = [reste[0]];
    while (groupe.at(-1).colle && reste[groupe.length]) groupe.push(reste[groupe.length]);
    const hg = hauteurAtomes(groupe);
    if (h + hg > espace) break;
    h += hg; prise.push(...reste.splice(0, groupe.length));
  }
  if (!prise.length || !reste.length) return null;
  return { partie: { ...c, atomes: prise }, suite: { ...c, titre: `${c.titre.replace(/ \(suite\)$/, '')} (suite)`, atomes: reste } };
}

export function mettreEnPage(urgences, cartes, s) {
  const pages = [];
  const nouvelle = () => { const debut = pages.length ? HAUT_SUITE : HAUT_P1; pages.push({ place: [], ys: [debut, debut], debut }); return pages.at(-1); };
  let page = nouvelle();
  page.place.push({ x: MARGE, y: page.ys[0], l: LARGEUR, h: urgences.h, urgences });
  page.ys = [page.ys[0] + urgences.h + GOUTTIERE, page.ys[0] + urgences.h + GOUTTIERE];
  const pageUtile = BAS_UTILE - HAUT_SUITE;
  for (let carteCourante of cartes) {
    let garde = 0;
    while (carteCourante && garde++ < 40) {
      page = pages.at(-1);
      const h = hauteurCarte(carteCourante, s);
      if (carteCourante.pleineLargeur) {
        const y = Math.max(...page.ys);
        if (y + h <= BAS_UTILE || (y === page.debut && h > pageUtile)) { page.place.push({ x: MARGE, y, l: LARGEUR, h, carte: carteCourante }); page.ys = [y + h + GOUTTIERE, y + h + GOUTTIERE]; carteCourante = null; continue; }
        // plus de place sur cette page : on commence une nouvelle page (la carte est reportée entière)
        const [a, b] = page.ys; if (a === page.debut && b === page.debut) { page.place.push({ x: MARGE, y: a, l: LARGEUR, h, carte: carteCourante }); carteCourante = null; continue; }
        page = nouvelle(); continue;
      }
      const col = page.ys[0] <= page.ys[1] ? 0 : 1;
      const choisie = [col, 1 - col].find((k) => page.ys[k] + h <= BAS_UTILE);
      if (choisie !== undefined) { page.place.push({ x: MARGE + choisie * (COLONNE + GOUTTIERE), y: page.ys[choisie], l: COLONNE, h, carte: carteCourante }); page.ys[choisie] += h + GOUTTIERE; carteCourante = null; continue; }
      const espace = BAS_UTILE - page.ys[col];
      const dec = h > pageUtile || espace > 90 * s ? decouper(carteCourante, espace, s) : null;
      if (dec) { page.place.push({ x: MARGE + col * (COLONNE + GOUTTIERE), y: page.ys[col], l: COLONNE, h: hauteurCarte(dec.partie, s), carte: dec.partie }); page.ys[col] += hauteurCarte(dec.partie, s) + GOUTTIERE; carteCourante = dec.suite; continue; }
      if (page.ys[0] === page.debut && page.ys[1] === page.debut) { page.place.push({ x: MARGE, y: page.debut, l: COLONNE, h, carte: carteCourante }); carteCourante = null; continue; } // carte plus haute qu'une page, sans découpe possible
      // les deux colonnes sont trop pleines : on passe à la page suivante, ou on essaie de découper dans l'autre colonne si la carte est énorme
      nouvelle();
    }
  }
  return pages;
}

/** Le plan de la fiche : la plus grande échelle (texte lisible) pour laquelle tout tient sur UNE page ; sinon deux pages à l'échelle 0,95. */
export function planFiche(m, P, taches) {
  let meilleur = null;
  for (const s of ECHELLES) {
    const pages = mettreEnPage(carteUrgences(m.urgences, s, P), construireCartes(m, s, P, taches), s);
    meilleur = { s, pages };
    if (pages.length === 1) return meilleur;
  }
  const s = ECHELLES[1];
  return { s, pages: mettreEnPage(carteUrgences(m.urgences, s, P), construireCartes(m, s, P, taches), s) };
}

// ----- Dessin -----

/** La photo de l'animal prête pour le PDF : { octets, largeur, hauteur } (JPEG), ou null. */
export async function photoPourPdf(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
  try {
    const image = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = dataUrl; });
    let url = dataUrl;
    if (!url.startsWith('data:image/jpeg')) { // le PDF n'accepte ici que du JPEG : on convertit
      const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(image, 0, 0);
      url = c.toDataURL('image/jpeg', 0.85);
    }
    const binaire = atob(url.split(',')[1]);
    return { octets: Uint8Array.from(binaire, (c) => c.charCodeAt(0)), largeur: image.naturalWidth, hauteur: image.naturalHeight };
  } catch { return null; }
}

function enteteLogo(pdf, x, y, P) {
  const nom = 'Carnet Patte';
  const w = largeurTexte(nom, 11, true);
  pdf.disque(x - w - 16, y + 8, 9, { fond: P.primaire });
  pdf.icone('paw-print', x - w - 16 - 5.6, y + 8 - 5.6, 11.2, { couleur: [1, 1, 1], epaisseur: 2.2 });
  pdf.texte(x - w - 3, y + 12, nom, { taille: 11, gras: true, couleur: P.primaire });
}

function dessinerEntete(pdf, m, photo, P) {
  const x = MARGE; const y = MARGE; const h = 104;
  pdf.rect(x, y, LARGEUR, h, { r: 14, fond: P.pale, trait: P.bord, epaisseur: 1 });
  const cx = x + 14 + 36; const cy = y + h / 2;
  if (photo) { pdf.photoRonde(photo, cx, cy, 36); pdf.disque(cx, cy, 36, { trait: P.primaire, epaisseur: 2.5 }); }
  else { pdf.disque(cx, cy, 36, { fond: [1, 1, 1], trait: P.primaire, epaisseur: 2.5 }); pdf.icone('paw-print', cx - 18, cy - 18, 36, { couleur: P.primaire, epaisseur: 1.6 }); }
  const tx = cx + 36 + 16; const largeurTxt = x + LARGEUR - 16 - tx;
  pdf.texte(tx, y + 19, 'FICHE DE GARDE', { taille: 8.5, gras: true, couleur: P.primaire });
  let taillNom = 26; let lignesNom = couperLignes(m.nom, largeurTxt - 118, taillNom, true);
  while (lignesNom.length > 1 && taillNom > 15) { taillNom -= 1; lignesNom = couperLignes(m.nom, largeurTxt - 118, taillNom, true); }
  lignesNom = lignesNom.slice(0, 2);
  let ty = y + 19 + taillNom;
  for (const l of lignesNom) { pdf.texte(tx, ty, l, { taille: taillNom, gras: true, couleur: NOIR }); ty += taillNom * 1.05; }
  ty = ty - taillNom * 1.05 + 16; // première ligne de détails, sous le nom
  const details = [m.details.join(' · '), m.poids && `Poids : ${m.poids}`].filter(Boolean);
  for (const d of details) for (const l of couperLignes(d, largeurTxt, 9.6)) { if (ty <= y + h - 28) pdf.texte(tx, ty, l, { taille: 9.6, couleur: [0.2, 0.2, 0.2] }); ty += 12; }
  if (m.garde.libelle) {
    const w = largeurTexte(m.garde.libelle, 9, true) + 30;
    pdf.rect(tx, y + h - 25, Math.min(w, largeurTxt), 16, { r: 8, fond: P.primaire });
    pdf.icone('calendar', tx + 7, y + h - 22.2, 10.4, { couleur: [1, 1, 1], epaisseur: 2.4 });
    pdf.texte(tx + 21, y + h - 13.6, m.garde.libelle, { taille: 9, gras: true, couleur: [1, 1, 1] });
  }
  enteteLogo(pdf, x + LARGEUR - 14, y + 11, P);
}

function dessinerEnteteSuite(pdf, m, P) {
  pdf.texte(MARGE, MARGE + 14, `${m.nom} · fiche de garde (suite)`, { taille: 11, gras: true, couleur: P.primaire });
  enteteLogo(pdf, A4.l - MARGE, MARGE, P);
  pdf.ligne(MARGE, MARGE + 22, A4.l - MARGE, MARGE + 22, { couleur: P.bord, epaisseur: 0.8 });
}

function dessinerPied(pdf, m, i, n) {
  const y = A4.h - 24;
  const texte = 'Fiche créée avec Carnet Patte · carnetpatte.com';
  pdf.ligne(MARGE, y - 11, A4.l - MARGE, y - 11, { couleur: [0.8, 0.8, 0.8], epaisseur: 0.5 });
  pdf.texte((A4.l - largeurTexte(texte, 8.3)) / 2, y, texte, { taille: 8.3, couleur: [0.4, 0.4, 0.4] });
  pdf.texte(MARGE, y, formatDate(m.date), { taille: 8, couleur: [0.5, 0.5, 0.5] });
  if (n > 1) { const p = `Page ${i + 1} sur ${n}`; pdf.texte(A4.l - MARGE - largeurTexte(p, 8), y, p, { taille: 8, couleur: [0.5, 0.5, 0.5] }); }
}

/**
 * Le PDF de la fiche (Uint8Array). `m` : modeleFiche(). `options.photo` : la photo de l'animal (texte « data:image/… »).
 * `options.taches` : les tâches du suivi, [{ id, nom }]. `options.palette` : couleurs (par défaut celles du thème de l'écran).
 */
export async function creerPdfFiche(m, { photo = '', taches = [], palette = null } = {}) {
  const P = palette ?? paletteTheme();
  const colonnes = (taches.length ? taches : [{ id: 'repas', nom: 'Repas' }, { id: 'eau', nom: 'Eau' }, { id: 'promenade', nom: 'Promenade' }, { id: 'medicament', nom: 'Médicament' }])
    .map((t) => ({ id: t.id, court: t.id === 'eau' ? 'Eau' : t.nom }));
  const plan = planFiche(m, P, colonnes);
  const pdf = new Pdf({ titre: `Fiche de garde - ${m.nom}` });
  const image = await photoPourPdf(photo);
  plan.pages.forEach((p, i) => {
    if (i) pdf.nouvellePage();
    if (i === 0) dessinerEntete(pdf, m, image, P); else dessinerEnteteSuite(pdf, m, P);
    for (const e of p.place) {
      if (e.urgences) e.urgences.dessiner(pdf, e.x, e.y); else dessinerCarte(pdf, e.carte, e.x, e.y, e.l, plan.s, P);
    }
    dessinerPied(pdf, m, i, plan.pages.length);
  });
  const octets = pdf.octets();
  octets.rapport = { pages: plan.pages.length, echelle: plan.s, boites: pdf.boites };
  return octets;
}
