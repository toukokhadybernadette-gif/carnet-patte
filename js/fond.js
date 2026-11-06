// Protection de fluidité pour le décor animé (bulles de css/verre.css).
// Après le chargement, on mesure combien de temps dure une image pendant quelques secondes. Si l'appareil a du mal
// (médiane de plus de `seuilMs`, soit moins de ~25 images par seconde), on fige les bulles : le reste de l'effet verre est conservé.

/** Retourne { mediane, fige }. `delai` laisse la page finir de s'afficher avant de mesurer. */
export function mesurerEtAdapter({ delai = 1500, duree = 2000, seuilMs = 40 } = {}) {
  return new Promise((fin) => {
    setTimeout(() => {
      if (document.hidden) { fin({ mediane: 0, fige: false }); return; } // onglet en arrière-plan : les mesures ne voudraient rien dire
      const ecarts = [];
      const debut = performance.now();
      let dernier = debut;
      const boucle = (t) => {
        ecarts.push(t - dernier);
        dernier = t;
        if (t - debut < duree) { requestAnimationFrame(boucle); return; }
        ecarts.shift();
        ecarts.sort((a, b) => a - b);
        const mediane = ecarts[Math.floor(ecarts.length / 2)] ?? 0;
        const fige = mediane > seuilMs;
        if (fige) document.documentElement.classList.add('bulles-figees');
        fin({ mediane, fige });
      };
      requestAnimationFrame(boucle);
    }, delai);
  });
}
