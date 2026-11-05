// Petites fonctions utilisables partout dans l'appli.
// Les dates sont stockées sous forme de texte "AAAA-MM-JJ" (comme le champ <input type="date">).

/** Identifiant unique pour chaque animal, soin, pesée... */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Protège un texte avant de l'insérer dans du HTML (évite d'interpréter du code). */
export function echapper(texte) {
  return String(texte ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function versISO(d) {
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

export function lireISO(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j);
}

export function aujourdhui() {
  return versISO(new Date());
}

export function ajouterJours(iso, n) {
  const d = lireISO(iso);
  d.setDate(d.getDate() + n);
  return versISO(d);
}

export function ajouterMois(iso, n) {
  const d = lireISO(iso);
  d.setMonth(d.getMonth() + n);
  return versISO(d);
}

/** Nombre de jours entre deux dates (positif si b est après a). */
export function joursEntre(a, b) {
  return Math.round((lireISO(b) - lireISO(a)) / 86400000);
}

export function formatDate(iso) {
  if (!iso) return '';
  return lireISO(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Âge lisible : "3 ans 2 mois", "5 mois", "12 jours"... */
export function age(naissance) {
  if (!naissance) return '';
  const n = lireISO(naissance);
  const t = new Date();
  let mois = (t.getFullYear() - n.getFullYear()) * 12 + (t.getMonth() - n.getMonth());
  if (t.getDate() < n.getDate()) mois--;
  if (mois < 0) return '';
  if (mois < 1) {
    const jours = Math.max(0, joursEntre(naissance, aujourdhui()));
    return `${jours} jour${jours > 1 ? 's' : ''}`;
  }
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  const partAns = ans ? `${ans} an${ans > 1 ? 's' : ''}` : '';
  const partMois = reste ? `${reste} mois` : '';
  return [partAns, partMois].filter(Boolean).join(' ');
}

/** Formate un poids : 4,2 kg */
export function formatPoids(kg) {
  const n = Number(kg);
  // Jamais d'arrondi trompeur (0,0345 n'est pas affiché 0,035, ni 0,0004 « 0 kg »)
  const decimales = Math.round(n * 1000) / 1000 === n ? 3 : 6;
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimales }) + ' kg';
}

/**
 * Lit une photo choisie par l'utilisateur et la réduit (max 400 px) en JPEG.
 * Une petite image évite de remplir l'espace de stockage du navigateur.
 */
export function redimensionnerPhoto(fichier, tailleMax = 400) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error('Lecture du fichier impossible'));
    lecteur.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Ce fichier n'est pas une image valide"));
      image.onload = () => {
        const ratio = Math.min(1, tailleMax / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      image.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}
