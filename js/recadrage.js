// Recadrage d'une photo d'animal : on déplace la photo (doigt ou souris), on zoome (pincer, molette, curseur, touches + et -),
// avec un aperçu du rendu rond (listes, avatars) et carré (fiche). Sans bibliothèque. Retourne une photo carrée réduite (JPEG), comme les photos
// gardées jusqu'ici : elle pèse peu sur l'appareil et dans le cloud (js/synchro.js la synchronise comme n'importe quelle photo).
//
// recadrerPhoto(source) : `source` = un fichier (File) ou une photo déjà gardée (texte « data:image/… »).
//   → une promesse : la photo recadrée (texte « data:image/jpeg;base64,… »), ou null si l'utilisateur annule.
//   Lève une erreur claire si l'image est illisible.

import { ouvrirModale, bouton } from './composants.js';

export const COTE_SORTIE = 480; // pixels du côté de la photo gardée
const QUALITE = 0.82;
const ZOOM_MAX = 4;

function blobDepuisDataUrl(dataUrl) {
  const [tete, corps] = dataUrl.split(',');
  const binaire = atob(corps);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type: /^data:([^;]+)/.exec(tete)?.[1] ?? 'image/jpeg' });
}

async function lireImage(source) {
  const blob = typeof source === 'string' ? blobDepuisDataUrl(source) : source;
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' }); // tient compte de l'orientation des photos d'iPhone
  } catch {
    throw new Error("Cette image n'a pas pu être lue. Essayez avec une photo JPEG ou PNG.");
  }
}

/** Calcul pur du cadrage : taille affichée, position, et limites pour que la photo couvre toujours le cadre. */
export function cadrage({ largeur, hauteur, cadre, zoom, centreX, centreY }) {
  const base = Math.max(cadre / largeur, cadre / hauteur); // la photo couvre juste le cadre
  const echelle = base * Math.min(ZOOM_MAX, Math.max(1, zoom));
  const w = largeur * echelle; const h = hauteur * echelle;
  const mx = (w - cadre) / 2; const my = (h - cadre) / 2; // jusqu'où le centre peut s'écarter
  const cx = Math.min(cadre / 2 + mx, Math.max(cadre / 2 - mx, centreX));
  const cy = Math.min(cadre / 2 + my, Math.max(cadre / 2 - my, centreY));
  return { echelle, w, h, cx, cy, x: cx - w / 2, y: cy - h / 2 };
}

export function recadrerPhoto(source) {
  return new Promise(async (resolve, reject) => {
    let image;
    try { image = await lireImage(source); } catch (e) { reject(e); return; }
    const cadreCss = Math.max(220, Math.min(320, Math.floor(window.innerWidth - 96)));
    const etat = { zoom: 1, centreX: cadreCss / 2, centreY: cadreCss / 2 };
    let valide = false;

    const dlg = ouvrirModale({
      titre: 'Recadrer la photo',
      contenu: `
        <div class="rc">
          <div class="rc-cadre" style="width:${cadreCss}px;height:${cadreCss}px" tabindex="0" role="application"
               aria-label="Zone de recadrage. Flèches : déplacer la photo. Plus et moins : zoomer." data-cadre>
            <canvas class="rc-toile" data-toile></canvas>
          </div>
          <label class="rc-zoom">Zoom
            <input type="range" min="1" max="${ZOOM_MAX}" step="0.01" value="1" data-zoom aria-label="Zoom">
          </label>
          <div class="rc-apercus" aria-label="Aperçu du résultat">
            <span class="cp-doux">Aperçu :</span>
            <canvas class="rc-mini rc-mini--rond" width="96" height="96" data-mini-rond role="img" aria-label="Aperçu rond (listes et avatars)"></canvas>
            <canvas class="rc-mini rc-mini--carre" width="96" height="96" data-mini-carre role="img" aria-label="Aperçu carré (fiche)"></canvas>
          </div>
          <p class="cp-doux rc-aide">Glissez la photo pour la déplacer, pincez ou utilisez le curseur pour zoomer. Rond dans les listes, carré dans la fiche.</p>
        </div>`,
      pied: `${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}${bouton({ texte: 'Valider', icone: 'check', attrs: { 'data-valider': true } })}`,
      ouvert: (d) => brancher(d),
    });
    dlg.addEventListener('close', () => { image.close?.(); resolve(valide ? dlg.__resultat : null); });

    function brancher(d) {
      const cadreEl = d.querySelector('[data-cadre]');
      const toile = d.querySelector('[data-toile]');
      const curseur = d.querySelector('[data-zoom]');
      const miniRond = d.querySelector('[data-mini-rond]');
      const miniCarre = d.querySelector('[data-mini-carre]');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      toile.width = Math.round(cadreCss * dpr); toile.height = Math.round(cadreCss * dpr);
      toile.style.width = `${cadreCss}px`; toile.style.height = `${cadreCss}px`;
      const g = toile.getContext('2d');

      const calcul = () => {
        const c = cadrage({ largeur: image.width, hauteur: image.height, cadre: cadreCss, ...etat });
        etat.centreX = c.cx; etat.centreY = c.cy; etat.zoom = Math.min(ZOOM_MAX, Math.max(1, etat.zoom));
        return c;
      };
      const dessiner = (ctx, c, cote, { masque = false } = {}) => {
        const k = cote / cadreCss;
        ctx.clearRect(0, 0, cote, cote);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cote, cote);
        ctx.drawImage(image, c.x * k, c.y * k, c.w * k, c.h * k);
        if (masque) { // assombrit ce qui sera hors du rond, et trace le rond
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,.45)';
          ctx.beginPath(); ctx.rect(0, 0, cote, cote); ctx.arc(cote / 2, cote / 2, cote / 2 - 2 * dpr, 0, Math.PI * 2, true); ctx.fill('evenodd');
          ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2 * dpr;
          ctx.beginPath(); ctx.arc(cote / 2, cote / 2, cote / 2 - 2 * dpr, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      };
      const rendre = () => {
        const c = calcul();
        dessiner(g, c, toile.width, { masque: true });
        for (const [mini, rond] of [[miniRond, true], [miniCarre, false]]) {
          const m = mini.getContext('2d');
          m.save(); m.clearRect(0, 0, mini.width, mini.height);
          if (rond) { m.beginPath(); m.arc(mini.width / 2, mini.height / 2, mini.width / 2, 0, Math.PI * 2); m.clip(); }
          dessiner(m, c, mini.width);
          m.restore();
        }
        curseur.value = String(etat.zoom);
      };
      /** Zoome en gardant fixe le point (px, py) du cadre. */
      const zoomerVers = (nouveauZoom, px = cadreCss / 2, py = cadreCss / 2) => {
        const z0 = Math.min(ZOOM_MAX, Math.max(1, etat.zoom));
        const z1 = Math.min(ZOOM_MAX, Math.max(1, nouveauZoom));
        const rapport = z1 / z0;
        etat.centreX = px + (etat.centreX - px) * rapport; etat.centreY = py + (etat.centreY - py) * rapport;
        etat.zoom = z1; rendre();
      };

      // ----- Doigts et souris : un point = déplacer, deux points = pincer -----
      const points = new Map();
      let derniere = null; // { distance, milieuX, milieuY }
      const pos = (e) => { const r = toile.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      const mesure = () => {
        const [a, b] = [...points.values()];
        return { distance: Math.hypot(a.x - b.x, a.y - b.y), milieuX: (a.x + b.x) / 2, milieuY: (a.y + b.y) / 2 };
      };
      toile.addEventListener('pointerdown', (e) => {
        points.set(e.pointerId, pos(e));
        try { toile.setPointerCapture(e.pointerId); } catch { /* pointeur simulé : sans importance */ }
        derniere = points.size === 2 ? mesure() : null;
        toile.classList.add('rc-toile--prise');
        e.preventDefault();
      });
      toile.addEventListener('pointermove', (e) => {
        if (!points.has(e.pointerId)) return;
        const avant = points.get(e.pointerId); const p = pos(e);
        points.set(e.pointerId, p);
        if (points.size === 1) {
          etat.centreX += p.x - avant.x; etat.centreY += p.y - avant.y; rendre();
        } else if (points.size === 2 && derniere) {
          const m = mesure();
          etat.centreX += m.milieuX - derniere.milieuX; etat.centreY += m.milieuY - derniere.milieuY;
          zoomerVers(etat.zoom * (m.distance / Math.max(1, derniere.distance)), m.milieuX, m.milieuY);
          derniere = m;
        }
      });
      const lacher = (e) => { points.delete(e.pointerId); derniere = points.size === 2 ? mesure() : null; if (!points.size) toile.classList.remove('rc-toile--prise'); };
      toile.addEventListener('pointerup', lacher);
      toile.addEventListener('pointercancel', lacher);
      toile.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); zoomerVers(etat.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), p.x, p.y); }, { passive: false });
      curseur.addEventListener('input', () => zoomerVers(Number(curseur.value)));
      cadreEl.addEventListener('keydown', (e) => {
        const pas = 12;
        const actions = { ArrowLeft: () => { etat.centreX -= pas; }, ArrowRight: () => { etat.centreX += pas; }, ArrowUp: () => { etat.centreY -= pas; }, ArrowDown: () => { etat.centreY += pas; } };
        if (actions[e.key]) { actions[e.key](); rendre(); e.preventDefault(); }
        else if (e.key === '+' || e.key === '=') { zoomerVers(etat.zoom * 1.1); e.preventDefault(); }
        else if (e.key === '-' || e.key === '_') { zoomerVers(etat.zoom / 1.1); e.preventDefault(); }
      });

      d.querySelector('[data-annuler]').addEventListener('click', () => d.close());
      d.querySelector('[data-valider]').addEventListener('click', () => {
        const sortie = document.createElement('canvas'); sortie.width = COTE_SORTIE; sortie.height = COTE_SORTIE;
        dessiner(sortie.getContext('2d'), calcul(), COTE_SORTIE);
        d.__resultat = sortie.toDataURL('image/jpeg', QUALITE);
        valide = true;
        d.close();
      });
      rendre();
    }
  });
}
