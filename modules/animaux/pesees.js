// Pesées d'un animal + petit graphique d'évolution (dessiné à la main en SVG).

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, formatDate, formatPoids, lireISO } from '../../js/utils.js';
import { confirmer, toast } from '../../js/ui.js';

/** Construit le graphique SVG. `pesees` doit être triée par date croissante. */
export function graphiqueSvg(pesees) {
  const L = 620, H = 260;
  const marge = { g: 48, d: 18, h: 16, b: 34 };
  const largeur = L - marge.g - marge.d;
  const hauteur = H - marge.h - marge.b;

  const poids = pesees.map((p) => p.poidsKg);
  let min = Math.min(...poids);
  let max = Math.max(...poids);
  if (min === max) { min -= 1; max += 1; }
  const marge10 = (max - min) * 0.15;
  min -= marge10; max += marge10;

  const t0 = lireISO(pesees[0].date).getTime();
  const t1 = lireISO(pesees[pesees.length - 1].date).getTime();
  const x = (date) => marge.g + (t1 === t0 ? largeur / 2 : ((lireISO(date).getTime() - t0) / (t1 - t0)) * largeur);
  const y = (kg) => marge.h + (1 - (kg - min) / (max - min)) * hauteur;

  // Lignes horizontales et étiquettes de poids
  let grille = '';
  for (let i = 0; i <= 3; i++) {
    const v = min + ((max - min) * i) / 3;
    const py = y(v);
    grille += `<line x1="${marge.g}" x2="${L - marge.d}" y1="${py}" y2="${py}" class="graph-grille"/>
               <text x="${marge.g - 8}" y="${py + 4}" text-anchor="end" class="graph-texte">${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</text>`;
  }

  const points = pesees.map((p) => `${x(p.date).toFixed(1)},${y(p.poidsKg).toFixed(1)}`).join(' ');
  const ronds = pesees.map((p) =>
    `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.poidsKg).toFixed(1)}" r="5" class="graph-point">
       <title>${formatDate(p.date)} : ${formatPoids(p.poidsKg)}</title></circle>`).join('');

  const dateGauche = formatDate(pesees[0].date);
  const dateDroite = formatDate(pesees[pesees.length - 1].date);

  return `
    <svg viewBox="0 0 ${L} ${H}" class="graphique" role="img" aria-label="Évolution du poids en kg">
      ${grille}
      <polyline points="${points}" class="graph-ligne"/>
      ${ronds}
      <text x="${marge.g}" y="${H - 8}" class="graph-texte">${dateGauche}</text>
      <text x="${L - marge.d}" y="${H - 8}" text-anchor="end" class="graph-texte">${dateDroite}</text>
    </svg>
    <p class="discret graph-unite">Poids en kg</p>`;
}

function ligneHtml(pesee, precedente) {
  let variation = '';
  if (precedente) {
    const diff = Math.round((pesee.poidsKg - precedente.poidsKg) * 1000) / 1000;
    if (diff !== 0) {
      variation = `<span class="discret">${diff > 0 ? '▲ +' : '▼ '}${diff.toLocaleString('fr-FR')} kg</span>`;
    }
  }
  return `
    <li class="ligne">
      <div class="ligne-icone">⚖️</div>
      <div class="ligne-corps">
        <strong>${formatPoids(pesee.poidsKg)}</strong>
        <span class="discret">${formatDate(pesee.date)}</span>
      </div>
      <div class="ligne-actions">
        ${variation}
        <button class="bouton secondaire petit icone" data-supprimer="${pesee.id}" aria-label="Supprimer la pesée">🗑</button>
      </div>
    </li>`;
}

/** Affiche la section « Pesées » dans `zone`. */
export function rendre(zone, animal) {
  const section = document.createElement('section');
  section.className = 'carte';
  zone.replaceChildren(section);

  const pesees = storage.lister('pesees')
    .filter((p) => p.animalId === animal.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const rerendre = () => rendre(zone, animal);

  let graphique;
  if (pesees.length >= 2) graphique = graphiqueSvg(pesees);
  else if (pesees.length === 1) graphique = `<p class="discret">Ajoutez une deuxième pesée pour voir la courbe.</p>`;
  else graphique = `<div class="vide">Aucune pesée pour l'instant.</div>`;

  // Liste : la plus récente en premier, avec la variation par rapport à la précédente
  const liste = pesees.map((p, i) => ligneHtml(p, pesees[i - 1])).reverse().join('');

  section.innerHTML = `
    <h2>Poids</h2>
    <form class="formulaire form-pesee">
      <label>Date <input type="date" name="date" required value="${aujourdhui()}" max="${aujourdhui()}"></label>
      <label>Poids (kg) <input type="number" name="poids" required min="0.001" max="2000" step="0.001" inputmode="decimal" placeholder="Ex. : 4,2"></label>
      <button type="submit" class="bouton">＋ Ajouter</button>
    </form>
    <div class="zone-graphique">${graphique}</div>
    ${pesees.length ? `<ul class="lignes">${liste}</ul>` : ''}`;

  section.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const poidsKg = Number(f.get('poids'));
    if (!(poidsKg > 0)) return;
    storage.ajouter('pesees', { animalId: animal.id, date: f.get('date'), poidsKg });
    toast('Pesée ajoutée');
    rerendre();
  });

  section.addEventListener('click', async (e) => {
    const bouton = e.target.closest('[data-supprimer]');
    if (bouton && await confirmer('Supprimer cette pesée ?')) {
      storage.supprimer('pesees', bouton.dataset.supprimer);
      toast('Pesée supprimée');
      rerendre();
    }
  });
}
