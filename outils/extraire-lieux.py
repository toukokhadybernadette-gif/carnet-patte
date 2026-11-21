#!/usr/bin/env python3
"""Extrait d'OpenStreetMap les lieux utiles aux animaux (France métropolitaine) et écrit un petit fichier JSON par département.

    python outils/extraire-lieux.py --pbf france-latest.osm.pbf --sortie donnees/lieux [--extrait 2026-11-21T02:05:17Z] [--resume resume.md]

Entrée : l'extrait « France » de Geofabrik (https://download.geofabrik.de/europe/france-latest.osm.pbf), mis à jour chaque nuit.
Catégories : vétérinaires, parcs à chiens, animaleries, toiletteurs, refuges (mêmes étiquettes OpenStreetMap que modules/carte/carte-donnees.js).
Sortie  : donnees/lieux/<code>.json (un par département) et donnees/lieux/index.json (zones couvertes, contour de la France, date de l'extrait).
Champs gardés : nom, adresse, téléphone, horaires, site web, et pour les lieux sans nom la rue la plus proche. JAMAIS de courriel ni de nom de personne (RGPD).
Adresses manquantes : complétées avec la Base Adresse Nationale (BAN, Licence Ouverte 2.0) par le service public de géocodage inverse de la Géoplateforme (IGN),
  par lots, au numéro de rue le plus proche à moins de 50 m ; ces adresses sont marquées « b » (colonne 11) pour que l'appli les distingue de celles d'OpenStreetMap.
  Aucune autre source d'adresses n'est utilisée : jamais Google Maps, jamais les Pages Jaunes.
Contours des départements : IGN Admin Express via Etalab (Licence Ouverte 2.0), téléchargés au besoin ; ils ne servent qu'à ranger chaque lieu dans un fichier.
Données : © contributeurs d'OpenStreetMap, licence ODbL 1.0 (voir donnees/lieux/LICENCE.txt).

Dépendances : pip install osmium shapely
"""
import argparse
import datetime
import csv
import io
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
import uuid
from collections import defaultdict

URL_CONTOURS = 'https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2025/geojson/departements-100m.geojson'

# Catégorie de l'appli (code court) : (nom, [(clé, valeur) OpenStreetMap])
CATEGORIES = {
    'v': ('Vétérinaires', [('amenity', 'veterinary')]),
    'p': ('Parcs à chiens', [('leisure', 'dog_park')]),
    'a': ('Animaleries', [('shop', 'pet'), ('shop', 'pet_supply')]),
    't': ('Toiletteurs', [('shop', 'pet_grooming')]),
    'r': ('Refuges', [('amenity', 'animal_shelter')]),
}
PAIRES = [p for _, (_, paires) in CATEGORIES.items() for p in paires]
VERSION = 1
DECIMALES = 5            # environ 1 m
RAYON_DEDOUBLONNAGE_M = 80
# Géoplateforme (IGN) : l'ancienne adresse api-adresse.data.gouv.fr est dépréciée (arrêt annoncé le 2026-01-31, redirection permanente vers celle-ci).
# Le point d'accès « csv » traite des lots entiers en une requête (limite du service : 50 requêtes par seconde ; ici une requête toutes les 3 secondes).
URL_BAN = 'https://data.geopf.fr/geocodage/reverse/csv/'
SOURCE_BAN = 'Base Adresse Nationale (BAN), Licence Ouverte 2.0, par le géocodage inverse de la Géoplateforme (IGN)'
RAYON_BAN_M = 50                          # une adresse officielle n'est retenue que si le numéro de rue est à moins de 50 m du lieu
LOT_BAN = 1000                            # lieux par requête
PAUSE_BAN_S = 3.0                         # pause entre deux requêtes
AGENT = 'CarnetPatte-extraction/1.0 (+https://github.com/toukokhadybernadette-gif/carnet-patte)'
RAYON_RUE_M = 150                         # une rue n'est attribuée à un lieu sans nom que si un point d'adresse est à moins de 150 m
PAS_GRILLE = 0.0025                       # cases d'environ 200 m pour chercher les adresses voisines
DISTANCE_MAX_HORS_DEPARTEMENT_DEG = 0.1   # un lieu hors de tout contour (bord de mer, frontière) est rangé dans le département le plus proche s'il est à moins d'environ 10 km


# ===== Nettoyage des étiquettes (même logique que modules/carte/carte-donnees.js) =====

def nettoyer(texte, maximum=200):
    return re.sub(r'\s+', ' ', str(texte or '')).strip()[:maximum]


def categorie_de(tags):
    for code, (_, paires) in CATEGORIES.items():
        if any(tags.get(k) == v for k, v in paires):
            return code
    return None


def adresse(tags):
    rue = ' '.join(x for x in (nettoyer(tags.get('addr:housenumber'), 20), nettoyer(tags.get('addr:street'))) if x)
    ville = ' '.join(x for x in (nettoyer(tags.get('addr:postcode'), 12), nettoyer(tags.get('addr:city'))) if x)
    return ', '.join(x for x in (rue, ville) if x) or nettoyer(tags.get('addr:full'))


def telephone(tags):
    """Premier numéro valide, tel qu'écrit (l'appli en tire le lien « Appeler »). Chaîne vide si aucun."""
    brut = nettoyer(tags.get('phone') or tags.get('contact:phone') or tags.get('mobile') or tags.get('contact:mobile'), 60)
    premier = re.split(r'[;,/]', brut)[0].strip()
    lien = re.sub(r'[\s.()-]', '', premier)
    return premier if re.fullmatch(r'\+?\d{6,15}', lien) else ''


def site_web(tags):
    """Adresse du site, seulement si c'est une vraie adresse http(s) (jamais de courriel)."""
    brut = nettoyer(tags.get('website') or tags.get('contact:website') or tags.get('url'), 200)
    if brut and not re.match(r'^[a-z][a-z0-9+.-]*://', brut, re.I) and re.match(r'^[\w-]+(\.[\w-]+)+(/.*)?$', brut):
        brut = 'https://' + brut
    return brut if re.fullmatch(r'https?://[^\s<>"\']+', brut, re.I) and '@' not in brut.split('/')[2] else ''


def lieu_depuis(identifiant, tags, lat, lon):
    code = categorie_de(tags)
    if not code or tags.get('disused') == 'yes' or tags.get('abandoned') == 'yes':
        return None
    nom = nettoyer(tags.get('name') or tags.get('operator') or tags.get('brand'), 160)
    return {
        'id': identifiant, 'cat': code, 'lat': round(lat, DECIMALES), 'lon': round(lon, DECIMALES),
        'nom': nom, 'adresse': adresse(tags), 'tel': telephone(tags),
        'horaires': nettoyer(tags.get('opening_hours'), 300), 'site': site_web(tags),
        # lieu sans nom : sa propre rue si elle est connue (sinon complétée par attribuer_rues)
        'rue': '' if nom else nettoyer(tags.get('addr:street'), 80),
        'ban': False,   # vrai si l'adresse vient de la Base Adresse Nationale (voir completer_adresses_ban)
    }


def en_ligne(l):
    """Une ligne de fichier : [id, catégorie, lat, lon, nom, adresse, tél., horaires, site, rue, source de l'adresse (« b » = BAN)], sans les champs vides de fin."""
    ligne = [l['id'], l['cat'], l['lat'], l['lon'], l['nom'], l['adresse'], l['tel'], l['horaires'], l['site'], l['rue'], 'b' if l.get('ban') else '']
    while len(ligne) > 4 and ligne[-1] == '':
        ligne.pop()
    return ligne


def distance_m(a, b):
    from math import asin, cos, radians, sin, sqrt
    dl, dn = radians(b['lat'] - a['lat']), radians(b['lon'] - a['lon'])
    h = sin(dl / 2) ** 2 + cos(radians(a['lat'])) * cos(radians(b['lat'])) * sin(dn / 2) ** 2
    return 2 * 6371000 * asin(sqrt(h))


def case_de(lat, lon):
    return (math.floor(lat / PAS_GRILLE), math.floor(lon / PAS_GRILLE))


def cases_voisines(cibles):
    """Les cases (et leurs voisines) où il faut chercher des adresses : environ 18 000 cases pour 2 000 lieux sans nom."""
    return {(i + di, j + dj) for (i, j) in (case_de(l['lat'], l['lon']) for l in cibles) for di in (-1, 0, 1) for dj in (-1, 0, 1)}


def attribuer_rues(cibles, adresses, rayon_m=RAYON_RUE_M):
    """Donne à chaque lieu sans nom la rue du point d'adresse le plus proche, à moins de `rayon_m` mètres.
    `adresses` : suite de (lat, lon, rue). Renvoie le nombre de lieux complétés."""
    grille = defaultdict(list)
    for l in cibles:
        if not l['nom'] and not l['rue']:
            grille[case_de(l['lat'], l['lon'])].append(l)
    meilleur = {}
    for lat, lon, rue in adresses:
        i, j = case_de(lat, lon)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for l in grille.get((i + di, j + dj), ()):
                    d = distance_m(l, {'lat': lat, 'lon': lon})
                    if d <= rayon_m and (l['id'] not in meilleur or d < meilleur[l['id']][0]):
                        meilleur[l['id']] = (d, rue)
    for l in cibles:
        if l['id'] in meilleur:
            l['rue'] = nettoyer(meilleur[l['id']][1], 80)
    return len(meilleur)


# ===== Adresses manquantes : Base Adresse Nationale =====

def corps_multipart(champs, nom_fichier, contenu):
    """Corps d'une requête multipart/form-data (le module standard de Python n'en fournit pas) : renvoie (octets, type de contenu)."""
    frontiere = uuid.uuid4().hex
    corps = b''
    for cle, valeur in champs:
        corps += f'--{frontiere}\r\nContent-Disposition: form-data; name="{cle}"\r\n\r\n{valeur}\r\n'.encode('utf-8')
    corps += f'--{frontiere}\r\nContent-Disposition: form-data; name="data"; filename="{nom_fichier}"\r\nContent-Type: text/csv\r\n\r\n'.encode('utf-8')
    corps += contenu + f'\r\n--{frontiere}--\r\n'.encode('utf-8')
    return corps, f'multipart/form-data; boundary={frontiere}'


def interroger_ban(points, ouvrir=urllib.request.urlopen, dormir=time.sleep, essais=4):
    """Géocodage inverse d'un lot : `points` = suite de (id, lat, lon) ; renvoie les lignes de résultat (dictionnaires).
    Une colonne « genre » = housenumber demande des numéros de rue (pas de simples rues). Réessaie avec une attente croissante si le service est occupé (429, 5xx)."""
    tampon = io.StringIO(newline='')
    ecrivain = csv.writer(tampon)
    ecrivain.writerow(['id', 'lat', 'lon', 'genre'])
    for identifiant, lat, lon in points:
        ecrivain.writerow([identifiant, lat, lon, 'housenumber'])
    corps, type_contenu = corps_multipart([('columns', 'lat'), ('columns', 'lon'), ('type', 'genre')], 'lieux.csv', tampon.getvalue().encode('utf-8'))
    derniere = None
    for essai in range(essais):
        try:
            requete = urllib.request.Request(URL_BAN, data=corps, headers={'User-Agent': AGENT, 'Content-Type': type_contenu})
            with ouvrir(requete, timeout=300) as reponse:
                texte = reponse.read().decode('utf-8')
            return list(csv.DictReader(io.StringIO(texte)))
        except urllib.error.HTTPError as e:
            derniere = e
            if e.code not in (429, 500, 502, 503, 504):
                raise
            try:
                demande = int((e.headers or {}).get('Retry-After', 0) or 0)
            except (TypeError, ValueError):
                demande = 0
            dormir(max(demande, 10 * (essai + 1)))
        except (urllib.error.URLError, TimeoutError) as e:
            derniere = e
            dormir(10 * (essai + 1))
    raise RuntimeError(f"service de géocodage inverse injoignable après {essais} essais : {derniere}")


def adresse_ban(ligne, rayon_m=RAYON_BAN_M):
    """Une ligne de résultat → (adresse, rue, distance en m), ou None si ce n'est pas un numéro de rue trouvé à moins de `rayon_m` mètres."""
    try:
        if ligne.get('result_status') != 'ok' or ligne.get('result_type') != 'housenumber':
            return None
        distance = float(ligne['result_distance'])
    except (KeyError, TypeError, ValueError):
        return None
    if distance > rayon_m:
        return None
    numero_rue = nettoyer(ligne.get('result_name'), 120)          # « 11 Boulevard Lazare Carnot »
    commune = nettoyer(ligne.get('result_city'), 80)
    ville = ' '.join(x for x in (nettoyer(ligne.get('result_postcode'), 10), commune) if x)
    if not numero_rue or not commune:
        return None
    return f'{numero_rue}, {ville}', nettoyer(ligne.get('result_street'), 80), distance


def completer_adresses_ban(lieux, anciens_ban, interroger=interroger_ban, dormir=time.sleep, taille_lot=LOT_BAN, pause=PAUSE_BAN_S):
    """Donne une adresse officielle aux lieux qui n'en ont pas (OpenStreetMap n'en a pas), marquée `ban`.
    `anciens_ban` : les résultats du mois précédent {id: {lat, lon, adresse, rue}} : un lieu qui n'a pas bougé n'est pas re-demandé (l'API est sollicitée au minimum).
    Si le service est indisponible, les lieux concernés restent sans adresse (l'extraction continue). Renvoie des statistiques."""
    cibles = [l for l in lieux if not l['adresse']]
    stats = {'cibles': len(cibles), 'reutilises': 0, 'trouves': 0, 'requetes': 0, 'indisponibles': 0}

    def appliquer(l, adresse, rue):
        l['adresse'], l['ban'] = adresse, True
        if not l['nom'] and rue:
            l['rue'] = rue   # sans nom : la rue officielle remplace la rue déduite des points d'adresse voisins

    a_demander = []
    for l in cibles:
        ancien = anciens_ban.get(l['id'])
        if ancien and ancien['lat'] == l['lat'] and ancien['lon'] == l['lon']:
            appliquer(l, ancien['adresse'], ancien['rue'])
            stats['reutilises'] += 1
        else:
            a_demander.append(l)
    for debut in range(0, len(a_demander), taille_lot):
        lot = a_demander[debut:debut + taille_lot]
        try:
            lignes = interroger([(l['id'], l['lat'], l['lon']) for l in lot])
        except RuntimeError as e:
            print(f'ATTENTION : {e} ; {len(lot)} lieux restent sans adresse officielle.', file=sys.stderr)
            stats['indisponibles'] += len(lot)
            continue
        stats['requetes'] += 1
        par_id = {x.get('id'): x for x in lignes}
        for l in lot:
            trouve = adresse_ban(par_id.get(l['id'], {}))
            if trouve:
                appliquer(l, trouve[0], trouve[1])
                stats['trouves'] += 1
        if debut + taille_lot < len(a_demander):
            dormir(pause)   # une requête toutes les `pause` secondes, très en dessous de la limite du service
    return stats


def dedoublonner(lieux):
    """Un même lieu saisi deux fois (un point ET le bâtiment) : même catégorie, même nom, à moins de 80 m. On garde la fiche la plus complète."""
    def richesse(l):
        return sum(1 for k in ('adresse', 'tel', 'horaires', 'site') if l[k])
    gardes, grille = [], defaultdict(list)
    for l in sorted(lieux, key=lambda x: (-richesse(x), x['id'])):
        case = (round(l['lat'] * 100), round(l['lon'] * 100))
        doublon = False
        if l['nom']:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for autre in grille[(case[0] + dx, case[1] + dy)]:
                        if autre['cat'] == l['cat'] and autre['nom'].lower() == l['nom'].lower() and distance_m(l, autre) <= RAYON_DEDOUBLONNAGE_M:
                            doublon = True
        if not doublon:
            gardes.append(l)
            grille[case].append(l)
    return gardes


# ===== Lecture du fichier OpenStreetMap =====

def lire_pbf(chemin):
    """Deux passages : (1) les objets qui nous intéressent, avec les repères des chemins ; (2) la position de ces repères."""
    import osmium
    bruts, chemins, relations = [], [], 0
    traitement = osmium.FileProcessor(chemin).with_filter(osmium.filter.TagFilter(*PAIRES))
    for o in traitement:
        tags = {t.k: t.v for t in o.tags}
        if o.is_node():
            if o.location.valid():
                l = lieu_depuis(f'n{o.id}', tags, o.location.lat, o.location.lon)
                if l:
                    bruts.append(l)
        elif o.is_way():
            chemins.append((f'w{o.id}', tags, [n.ref for n in o.nodes]))
        elif o.is_relation():
            relations += 1  # rares (parcs à chiens en multipolygone) : ignorés, comptés dans le résumé
    reperes = {ref for _, _, refs in chemins for ref in refs}
    positions = {}
    if reperes:
        for n in osmium.FileProcessor(chemin, osmium.osm.NODE).with_filter(osmium.filter.IdFilter(reperes)):
            if n.location.valid():
                positions[n.id] = (n.location.lat, n.location.lon)
    for identifiant, tags, refs in chemins:
        pts = [positions[r] for r in refs if r in positions]
        if not pts:
            continue
        # comme Overpass « out center » : le centre du rectangle qui englobe le chemin
        lat = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
        lon = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
        l = lieu_depuis(identifiant, tags, lat, lon)
        if l:
            bruts.append(l)
    return bruts, relations


def adresses_osm(chemin, cases):
    """Les points d'adresse d'OpenStreetMap (nœuds avec « addr:street ») situés dans l'une des `cases` : (lat, lon, rue)."""
    import osmium
    for n in osmium.FileProcessor(chemin, osmium.osm.NODE).with_filter(osmium.filter.KeyFilter('addr:street')):
        if not n.location.valid() or case_de(n.location.lat, n.location.lon) not in cases:
            continue
        rue = n.tags.get('addr:street')
        if rue:
            yield n.location.lat, n.location.lon, rue


def date_extrait(chemin):
    try:
        import osmium
        lecteur = osmium.io.Reader(chemin, osmium.osm.osm_entity_bits.NOTHING)
        valeur = lecteur.header().get('osmosis_replication_timestamp')
        lecteur.close()
        return valeur or ''
    except Exception:
        return ''


# ===== Départements =====

def charger_contours(chemin):
    from shapely import make_valid
    from shapely.geometry import shape
    if not os.path.exists(chemin):
        print(f'Téléchargement des contours des départements : {URL_CONTOURS}')
        with urllib.request.urlopen(URL_CONTOURS, timeout=120) as r, open(chemin, 'wb') as f:
            f.write(r.read())
    with open(chemin, encoding='utf-8') as f:
        donnees = json.load(f)
    deps = {}
    for feat in donnees['features']:
        code = str(feat['properties']['code'])
        if code.startswith('97') or code.startswith('98'):
            continue  # outre-mer : hors de cet extrait, la Carte garde Overpass pour eux
        forme = shape(feat['geometry'])
        deps[code] = forme if forme.is_valid else make_valid(forme)  # le fichier officiel contient quelques auto-intersections
    return deps


def ranger_par_departement(lieux, deps):
    from shapely.geometry import Point
    from shapely.strtree import STRtree
    codes = list(deps)
    arbre = STRtree([deps[c] for c in codes])
    rangement, hors = defaultdict(list), 0
    for l in lieux:
        p = Point(l['lon'], l['lat'])
        trouves = arbre.query(p, predicate='intersects')
        if len(trouves):
            rangement[codes[int(trouves[0])]].append(l)
            continue
        proche = int(arbre.nearest(p))
        if deps[codes[proche]].distance(p) <= DISTANCE_MAX_HORS_DEPARTEMENT_DEG:
            rangement[codes[proche]].append(l)
        else:
            hors += 1
    return rangement, hors


def contour_france(deps):
    """Contour très simplifié de la France métropolitaine (environ 1,5 km de tolérance, élargi de 2 km) : sert à l'appli à savoir si un point est couvert."""
    from shapely.ops import unary_union
    france = unary_union(list(deps.values())).buffer(0.02).simplify(0.015)
    polygones = [france] if france.geom_type == 'Polygon' else list(france.geoms)
    anneaux = []
    for p in sorted(polygones, key=lambda x: -x.area):
        if p.area < 0.002:
            continue
        anneaux.append([[round(x, 3), round(y, 3)] for x, y in p.exterior.coords])
    return anneaux


# ===== Écriture =====

def ecrire_json(chemin, objet):
    with open(chemin, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(objet, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')


def lire_anciens(sortie):
    """Les identifiants de l'extraction précédente, pour le résumé « + X / − Y »."""
    anciens = {}
    if os.path.isdir(sortie):
        for nom in os.listdir(sortie):
            if re.fullmatch(r'[0-9AB]{2}\.json', nom):
                try:
                    with open(os.path.join(sortie, nom), encoding='utf-8') as f:
                        anciens[nom[:2]] = {ligne[0] for ligne in json.load(f)['lieux']}
                except Exception:
                    pass
    return anciens


def lire_anciens_ban(sortie):
    """Les adresses BAN déjà obtenues (colonne 11 = « b ») dans les fichiers actuels : {id: {lat, lon, adresse, rue}}."""
    anciens = {}
    if os.path.isdir(sortie):
        for nom in os.listdir(sortie):
            if re.fullmatch(r'[0-9AB]{2}\.json', nom):
                try:
                    with open(os.path.join(sortie, nom), encoding='utf-8') as f:
                        for ligne in json.load(f)['lieux']:
                            if len(ligne) > 10 and ligne[10] == 'b':
                                anciens[ligne[0]] = {'lat': ligne[2], 'lon': ligne[3], 'adresse': ligne[5], 'rue': ligne[9]}
                except Exception:
                    pass
    return anciens


def principal():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')  # la console Windows (cp1252) ne sait pas écrire « − »
        sys.stderr.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--pbf', required=True, help="extrait OpenStreetMap (.osm.pbf)")
    ap.add_argument('--sortie', default='donnees/lieux')
    ap.add_argument('--contours', default=os.path.join(os.environ.get('TEMP', '.'), 'departements-100m.geojson'), help='contours des départements (téléchargés si absents)')
    ap.add_argument('--extrait', default='', help="date de l'extrait (ISO) si le fichier ne la contient pas")
    ap.add_argument('--sans-ban', action='store_true', help="ne complète pas les adresses manquantes avec la Base Adresse Nationale")
    ap.add_argument('--sans-rues', action='store_true', help="ne cherche pas la rue la plus proche des lieux sans nom")
    ap.add_argument('--minimum-absolu', type=int, default=5000, help='refuse d\'écrire sous ce nombre de lieux (extrait tronqué ?)')
    ap.add_argument('--minimum-relatif', type=float, default=0.8, help='refuse d\'écrire si le total tombe sous cette part du total précédent')
    ap.add_argument('--resume', default='', help='écrit un résumé Markdown (corps de la Pull Request)')
    a = ap.parse_args()

    deps = charger_contours(a.contours)
    print(f'{len(deps)} départements')
    anciens = lire_anciens(a.sortie)
    anciens_ban = lire_anciens_ban(a.sortie)
    bruts, relations = lire_pbf(a.pbf)
    print(f'{len(bruts)} lieux bruts, {relations} relations ignorées')
    lieux = dedoublonner(bruts)
    print(f'{len(lieux)} lieux après dédoublonnage')
    sans_nom = [l for l in lieux if not l['nom']]
    rue_propre = sum(1 for l in sans_nom if l['rue'])
    rues_proches = 0
    if not a.sans_rues:
        cibles = [l for l in sans_nom if not l['rue']]
        rues_proches = attribuer_rues(cibles, adresses_osm(a.pbf, cases_voisines(cibles)))
    print(f"{len(sans_nom)} lieux sans nom : {rue_propre} avec leur propre rue, {rues_proches} avec la rue d'une adresse voisine (moins de {RAYON_RUE_M} m)")
    avant_ban = sum(1 for l in lieux if l['adresse'])
    stats_ban = {'cibles': 0, 'reutilises': 0, 'trouves': 0, 'requetes': 0, 'indisponibles': 0}
    if not a.sans_ban:
        stats_ban = completer_adresses_ban(lieux, anciens_ban)
        print(f"{avant_ban} lieux avec une adresse OpenStreetMap ; {stats_ban['cibles']} sans adresse : {stats_ban['trouves']} complétés par la BAN + {stats_ban['reutilises']} repris du mois précédent ({stats_ban['requetes']} requêtes, {stats_ban['indisponibles']} lieux sans réponse)")
    rangement, hors = ranger_par_departement(lieux, deps)

    # Garde-fou : un extrait tronqué ou une erreur de lecture ne doit jamais écraser de bonnes données
    total = sum(len(v) for v in rangement.values())
    total_precedent = sum(len(v) for v in anciens.values())
    if total < a.minimum_absolu or (total_precedent and total < a.minimum_relatif * total_precedent):
        print(f'REFUSÉ : {total} lieux seulement (minimum {a.minimum_absolu}, version précédente {total_precedent}). Les fichiers ne sont pas modifiés.', file=sys.stderr)
        return 2

    os.makedirs(a.sortie, exist_ok=True)
    for nom in os.listdir(a.sortie):
        if re.fullmatch(r'[0-9AB]{2}\.json', nom):
            os.remove(os.path.join(a.sortie, nom))  # un département devenu vide disparaît
    extrait = a.extrait or date_extrait(a.pbf)
    index = {
        'v': VERSION, 'extrait': extrait, 'genere': datetime.date.today().isoformat(),
        'source': 'Geofabrik, extrait « France » d\'OpenStreetMap',
        'licence': "Données © contributeurs d'OpenStreetMap, base de données sous licence ODbL 1.0 : https://www.openstreetmap.org/copyright",
        'categories': {c: n for c, (n, _) in CATEGORIES.items()},
        'format': ['id', 'catégorie', 'lat', 'lon', 'nom', 'adresse', 'téléphone', 'horaires', 'site', 'rue', 'source de l\'adresse (b = Base Adresse Nationale)'],
        'adresses_ban': {'source': SOURCE_BAN, 'licence': 'Licence Ouverte 2.0 : https://www.etalab.gouv.fr/licence-ouverte-open-licence/', 'site': 'https://adresse.data.gouv.fr', 'rayon_m': RAYON_BAN_M, 'n': 0},
        'total': 0, 'departements': {}, 'france': contour_france(deps),
    }
    nouveaux = {}
    for code in sorted(rangement):
        liste = sorted(rangement[code], key=lambda l: l['id'])
        ecrire_json(os.path.join(a.sortie, f'{code}.json'), {'v': VERSION, 'dep': code, 'lieux': [en_ligne(l) for l in liste]})
        index['departements'][code] = {
            'n': len(liste),
            'bbox': [min(l['lat'] for l in liste), min(l['lon'] for l in liste), max(l['lat'] for l in liste), max(l['lon'] for l in liste)],
        }
        nouveaux[code] = {l['id'] for l in liste}
        index['total'] += len(liste)
    index['adresses_ban']['n'] = sum(1 for liste in rangement.values() for l in liste if l.get('ban'))
    ecrire_json(os.path.join(a.sortie, 'index.json'), index)

    # Résumé
    par_cat = defaultdict(int)
    for liste in rangement.values():
        for l in liste:
            par_cat[l['cat']] += 1
    ajoutes = sum(len(nouveaux[c] - anciens.get(c, set())) for c in nouveaux)
    retires = sum(len(anciens[c] - nouveaux.get(c, set())) for c in anciens)
    taille = sum(os.path.getsize(os.path.join(a.sortie, n)) for n in os.listdir(a.sortie) if n.endswith('.json'))
    avec_adresse = sum(1 for liste in rangement.values() for l in liste if l['adresse'])
    nb_ban = index['adresses_ban']['n']
    lignes = [
        f"Extrait OpenStreetMap du **{extrait or 'date inconnue'}**.",
        '',
        f"- **{index['total']}** lieux dans **{len(index['departements'])}** départements ({taille / 1024 / 1024:.2f} Mo de JSON)",
        *[f"- {CATEGORIES[c][0]} : {par_cat[c]}" for c in CATEGORIES],
        f"- Depuis la version précédente : **+{ajoutes}** / **−{retires}** lieux" + ('' if anciens else ' (première extraction)'),
        f"- Lieux avec une adresse : **{avec_adresse}** ({avec_adresse * 100 // max(index['total'], 1)} %), dont {nb_ban} complétées par la Base Adresse Nationale (adresse officielle la plus proche, à moins de {RAYON_BAN_M} m) et {avec_adresse - nb_ban} venant d'OpenStreetMap",
        f"- Lieux sans nom : {len(sans_nom)}, dont {rue_propre + rues_proches} avec une rue connue ({rues_proches} déduites d'une adresse voisine à moins de {RAYON_RUE_M} m)",
        f"- Ignorés : {relations} relations OpenStreetMap, {hors} lieux hors des départements métropolitains",
    ]
    texte = '\n'.join(lignes) + '\n'
    print(texte)
    if a.resume:
        with open(a.resume, 'w', encoding='utf-8', newline='\n') as f:
            f.write(texte)


if __name__ == '__main__':
    sys.exit(principal())
