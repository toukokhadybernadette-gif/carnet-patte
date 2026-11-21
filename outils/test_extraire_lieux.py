"""Tests des fonctions pures de extraire-lieux.py : python outils/test_extraire_lieux.py (aucun téléchargement, aucun fichier OpenStreetMap)."""
import importlib.util
import os
import unittest

chemin = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'extraire-lieux.py')
spec = importlib.util.spec_from_file_location('extraire_lieux', chemin)
x = importlib.util.module_from_spec(spec)
spec.loader.exec_module(x)


class Nettoyage(unittest.TestCase):
    def test_categories(self):
        self.assertEqual(x.categorie_de({'amenity': 'veterinary'}), 'v')
        self.assertEqual(x.categorie_de({'leisure': 'dog_park'}), 'p')
        self.assertEqual(x.categorie_de({'shop': 'pet'}), 'a')
        self.assertEqual(x.categorie_de({'shop': 'pet_supply'}), 'a')
        self.assertEqual(x.categorie_de({'shop': 'pet_grooming'}), 't')
        self.assertEqual(x.categorie_de({'amenity': 'animal_shelter'}), 'r')
        self.assertIsNone(x.categorie_de({'amenity': 'cafe'}))

    def test_adresse(self):
        self.assertEqual(x.adresse({'addr:housenumber': '12', 'addr:street': 'rue des Lilas', 'addr:postcode': '35000', 'addr:city': 'Rennes'}), '12 rue des Lilas, 35000 Rennes')
        self.assertEqual(x.adresse({'addr:full': '1 place X, 75001 Paris'}), '1 place X, 75001 Paris')
        self.assertEqual(x.adresse({}), '')

    def test_telephone(self):
        self.assertEqual(x.telephone({'phone': '+33 2 99 00 00 01; +33 6 00 00 00 00'}), '+33 2 99 00 00 01')
        self.assertEqual(x.telephone({'contact:phone': '02 99 00 00 02'}), '02 99 00 00 02')
        self.assertEqual(x.telephone({'phone': 'pas un numéro'}), '')
        self.assertEqual(x.telephone({}), '')

    def test_site_web_jamais_de_courriel(self):
        self.assertEqual(x.site_web({'website': 'https://exemple.fr/accueil'}), 'https://exemple.fr/accueil')
        self.assertEqual(x.site_web({'contact:website': 'www.exemple.fr'}), 'https://www.exemple.fr')
        self.assertEqual(x.site_web({'website': 'mailto:contact@exemple.fr'}), '')
        self.assertEqual(x.site_web({'website': 'contact@exemple.fr'}), '')
        self.assertEqual(x.site_web({'website': 'https://user:mdp@exemple.fr'}), '')
        self.assertEqual(x.site_web({'website': 'javascript:alert(1)'}), '')
        self.assertEqual(x.site_web({}), '')

    def test_aucun_courriel_ni_champ_personnel_dans_un_lieu(self):
        tags = {'amenity': 'veterinary', 'name': 'Clinique', 'email': 'a@b.fr', 'contact:email': 'a@b.fr', 'operator:website': 'x', 'addr:street': 'Rue', 'phone': '+33299000001'}
        l = x.lieu_depuis('n1', tags, 43.60446789, 1.44424111)
        self.assertEqual(set(l), {'id', 'cat', 'lat', 'lon', 'nom', 'adresse', 'tel', 'horaires', 'site', 'rue', 'ban'})
        self.assertNotIn('@', ' '.join(str(v) for v in l.values()))
        self.assertEqual((l['lat'], l['lon']), (43.60447, 1.44424))

    def test_lieu_abandonne_ignore(self):
        self.assertIsNone(x.lieu_depuis('n1', {'amenity': 'veterinary', 'disused': 'yes'}, 1, 1))
        self.assertIsNone(x.lieu_depuis('n1', {'amenity': 'cafe'}, 1, 1))

    def test_ligne_sans_champs_vides_de_fin(self):
        l = x.lieu_depuis('n7', {'amenity': 'veterinary', 'name': 'V'}, 43.1, 1.2)
        self.assertEqual(x.en_ligne(l), ['n7', 'v', 43.1, 1.2, 'V'])
        l2 = x.lieu_depuis('n8', {'amenity': 'veterinary', 'name': 'V', 'website': 'https://a.fr'}, 43.1, 1.2)
        self.assertEqual(x.en_ligne(l2), ['n8', 'v', 43.1, 1.2, 'V', '', '', '', 'https://a.fr'])
        l3 = x.lieu_depuis('n9', {'amenity': 'veterinary', 'addr:street': 'rue des Lilas'}, 43.1, 1.2)
        self.assertEqual(x.en_ligne(l3), ['n9', 'v', 43.1, 1.2, '', 'rue des Lilas', '', '', '', 'rue des Lilas'])
        l4 = x.lieu_depuis('n10', {'amenity': 'veterinary', 'name': 'V'}, 43.1, 1.2)
        l4['adresse'], l4['ban'] = '11 Boulevard Lazare Carnot, 31000 Toulouse', True
        self.assertEqual(x.en_ligne(l4), ['n10', 'v', 43.1, 1.2, 'V', '11 Boulevard Lazare Carnot, 31000 Toulouse', '', '', '', '', 'b'])  # « b » en 11e colonne : adresse de la BAN


class Doublons(unittest.TestCase):
    def test_meme_lieu_point_et_batiment(self):
        a = x.lieu_depuis('n1', {'amenity': 'veterinary', 'name': 'Clinique du Parc'}, 43.6000, 1.4400)
        b = x.lieu_depuis('w2', {'amenity': 'veterinary', 'name': 'clinique du parc', 'phone': '+33299000001'}, 43.60020, 1.44010)
        gardes = x.dedoublonner([a, b])
        self.assertEqual(len(gardes), 1)
        self.assertEqual(gardes[0]['id'], 'w2')  # la fiche la plus complète

    def test_deux_lieux_differents_sont_gardes(self):
        a = x.lieu_depuis('n1', {'amenity': 'veterinary', 'name': 'A'}, 43.6000, 1.4400)
        b = x.lieu_depuis('n2', {'amenity': 'veterinary', 'name': 'B'}, 43.6001, 1.4401)
        c = x.lieu_depuis('n3', {'amenity': 'veterinary', 'name': 'A'}, 43.7000, 1.4400)  # même nom, 11 km plus loin
        self.assertEqual(len(x.dedoublonner([a, b, c])), 3)

    def test_lieux_sans_nom_jamais_fusionnes(self):
        a = x.lieu_depuis('n1', {'amenity': 'veterinary'}, 43.6000, 1.4400)
        b = x.lieu_depuis('n2', {'amenity': 'veterinary'}, 43.6000, 1.4400)
        self.assertEqual(len(x.dedoublonner([a, b])), 2)


class Rues(unittest.TestCase):
    def lieu(self, ident, lat, lon, **tags):
        return x.lieu_depuis(ident, {'amenity': 'veterinary', **tags}, lat, lon)

    def test_rue_la_plus_proche_pour_un_lieu_sans_nom(self):
        sans_nom = self.lieu('n1', 43.6000, 1.4400)
        adresses = [
            (43.60054, 1.4400, 'Rue Proche'),     # environ 60 m
            (43.60108, 1.4400, 'Rue Moyenne'),    # environ 120 m
            (43.6036, 1.4400, 'Rue Lointaine'),   # environ 400 m : trop loin
        ]
        self.assertEqual(x.attribuer_rues([sans_nom], iter(adresses)), 1)
        self.assertEqual(sans_nom['rue'], 'Rue Proche')

    def test_aucune_adresse_assez_proche(self):
        l = self.lieu('n2', 43.6000, 1.4400)
        self.assertEqual(x.attribuer_rues([l], iter([(43.6036, 1.4400, 'Rue Lointaine')])), 0)
        self.assertEqual(l['rue'], '')

    def test_un_lieu_nomme_ou_avec_sa_rue_n_est_pas_touche(self):
        nomme = self.lieu('n3', 43.6000, 1.4400, name='Clinique')
        propre = self.lieu('n4', 43.6000, 1.4400, **{'addr:street': 'Rue Propre'})
        x.attribuer_rues([nomme, propre], iter([(43.60005, 1.4400, 'Rue Voisine')]))
        self.assertEqual(nomme['rue'], '')
        self.assertEqual(propre['rue'], 'Rue Propre')

    def test_les_cases_voisines_couvrent_le_rayon(self):
        l = self.lieu('n5', 43.6000, 1.4400)
        cases = x.cases_voisines([l])
        # une adresse à 140 m à l'est ou à l'ouest doit se trouver dans une case à examiner
        for dlon in (-0.0017, 0.0017):
            self.assertIn(x.case_de(43.6000, 1.4400 + dlon), cases)
        self.assertNotIn(x.case_de(43.6000, 1.4400 + 0.01), cases)


def ligne_ban(identifiant, distance='3', type_='housenumber', statut='ok', nom='11 Boulevard Lazare Carnot', rue='Boulevard Lazare Carnot', cp='31000', ville='Toulouse'):
    """Une ligne telle que la renvoie le point d'accès « reverse/csv » de la Géoplateforme."""
    return {'id': identifiant, 'result_distance': distance, 'result_type': type_, 'result_status': statut,
            'result_name': nom, 'result_street': rue, 'result_postcode': cp, 'result_city': ville, 'result_housenumber': '11'}


class BaseAdresseNationale(unittest.TestCase):
    def lieu(self, ident, lat=43.6012, lon=1.4516, **tags):
        return x.lieu_depuis(ident, {'shop': 'pet', **tags}, lat, lon)

    def test_adresse_officielle_retenue(self):
        self.assertEqual(x.adresse_ban(ligne_ban('a')), ('11 Boulevard Lazare Carnot, 31000 Toulouse', 'Boulevard Lazare Carnot', 3.0))

    def test_seuil_de_50_metres(self):
        self.assertIsNotNone(x.adresse_ban(ligne_ban('a', distance='50')))
        self.assertIsNone(x.adresse_ban(ligne_ban('a', distance='51')))

    def test_pas_une_adresse_exploitable(self):
        self.assertIsNone(x.adresse_ban(ligne_ban('a', type_='locality')))        # une rue sans numéro
        self.assertIsNone(x.adresse_ban(ligne_ban('a', statut='not-found')))
        self.assertIsNone(x.adresse_ban(ligne_ban('a', distance='')))
        self.assertIsNone(x.adresse_ban(ligne_ban('a', nom='')))
        self.assertIsNone(x.adresse_ban(ligne_ban('a', ville='')))
        self.assertIsNone(x.adresse_ban({}))

    def test_completion_seulement_des_lieux_sans_adresse(self):
        deja = self.lieu('n1', **{'addr:street': 'Rue Propre', 'addr:housenumber': '4'})
        sans = self.lieu('n2', name='Sans adresse')
        appels = []
        def faux(points):
            appels.append([p[0] for p in points])
            return [ligne_ban(p[0]) for p in points]
        stats = x.completer_adresses_ban([deja, sans], {}, interroger=faux, dormir=lambda s: None)
        self.assertEqual(appels, [['n2']])                     # le lieu qui a déjà une adresse OpenStreetMap n'est jamais demandé
        self.assertEqual(deja['adresse'], '4 Rue Propre') and self.assertFalse(deja['ban'])
        self.assertEqual((sans['adresse'], sans['ban']), ('11 Boulevard Lazare Carnot, 31000 Toulouse', True))
        self.assertEqual(stats, {'cibles': 1, 'reutilises': 0, 'trouves': 1, 'requetes': 1, 'indisponibles': 0})

    def test_la_rue_officielle_remplace_la_rue_deduite_pour_un_lieu_sans_nom(self):
        sans_nom = x.lieu_depuis('n3', {'amenity': 'veterinary'}, 43.6012, 1.4516)
        sans_nom['rue'] = 'Rue Devinee'
        nomme = x.lieu_depuis('n4', {'amenity': 'veterinary', 'name': 'Clinique'}, 43.6012, 1.4516)
        x.completer_adresses_ban([sans_nom, nomme], {}, interroger=lambda pts: [ligne_ban(p[0]) for p in pts], dormir=lambda s: None)
        self.assertEqual(sans_nom['rue'], 'Boulevard Lazare Carnot')
        self.assertEqual(nomme['rue'], '')                       # un lieu nommé n'a pas besoin de rue

    def test_resultats_du_mois_precedent_reutilises(self):
        inchange = self.lieu('n5')
        deplace = self.lieu('n6')
        anciens = {'n5': {'lat': 43.6012, 'lon': 1.4516, 'adresse': '1 Rue Ancienne, 31000 Toulouse', 'rue': 'Rue Ancienne'},
                   'n6': {'lat': 40.0, 'lon': 1.0, 'adresse': 'ancienne position', 'rue': ''}}
        demandes = []
        stats = x.completer_adresses_ban([inchange, deplace], anciens, interroger=lambda pts: (demandes.append([p[0] for p in pts]) or [ligne_ban(p[0]) for p in pts]), dormir=lambda s: None)
        self.assertEqual(demandes, [['n6']])                   # seul le lieu qui a changé de position est redemandé
        self.assertEqual(inchange['adresse'], '1 Rue Ancienne, 31000 Toulouse')
        self.assertEqual((stats['reutilises'], stats['trouves']), (1, 1))

    def test_par_lots_avec_pause_entre_deux_requetes(self):
        lieux = [self.lieu(f'n{i}') for i in range(25)]
        pauses, tailles = [], []
        stats = x.completer_adresses_ban(lieux, {}, interroger=lambda pts: (tailles.append(len(pts)) or [ligne_ban(p[0]) for p in pts]),
                                         dormir=pauses.append, taille_lot=10, pause=3.0)
        self.assertEqual(tailles, [10, 10, 5])
        self.assertEqual(pauses, [3.0, 3.0])                   # une pause entre deux requêtes, pas après la dernière
        self.assertEqual(stats['requetes'], 3)

    def test_service_indisponible_ne_bloque_pas_l_extraction(self):
        l = self.lieu('n7')
        def en_panne(points): raise RuntimeError('injoignable')
        stats = x.completer_adresses_ban([l], {}, interroger=en_panne, dormir=lambda s: None)
        self.assertEqual((l['adresse'], l['ban']), ('', False))
        self.assertEqual(stats['indisponibles'], 1)

    def test_reponse_sans_resultat_pour_un_lieu(self):
        l = self.lieu('n8')
        x.completer_adresses_ban([l], {}, interroger=lambda pts: [ligne_ban(p[0], statut='not-found') for p in pts], dormir=lambda s: None)
        self.assertEqual(l['adresse'], '')

    def test_corps_multipart(self):
        corps, type_contenu = x.corps_multipart([('columns', 'lat'), ('type', 'genre')], 'lieux.csv', b'id,lat\n1,2\n')
        frontiere = type_contenu.split('boundary=')[1]
        texte = corps.decode('utf-8')
        self.assertTrue(texte.startswith(f'--{frontiere}\r\n') and texte.endswith(f'--{frontiere}--\r\n'))
        self.assertIn('name="columns"\r\n\r\nlat', texte)
        self.assertIn('name="data"; filename="lieux.csv"', texte)
        self.assertIn('id,lat\n1,2\n', texte)

    def test_interrogation_de_l_api_reessaie_si_elle_est_occupee(self):
        import io, urllib.error
        class Reponse:
            def __init__(self, texte): self.texte = texte
            def read(self): return self.texte.encode('utf-8')
            def __enter__(self): return self
            def __exit__(self, *a): return False
        etat = {'n': 0, 'requete': None}
        def ouvrir(requete, timeout):
            etat['n'] += 1
            etat['requete'] = requete
            if etat['n'] == 1:
                raise urllib.error.HTTPError(x.URL_BAN, 429, 'Too Many Requests', {'Retry-After': '2'}, None)
            return Reponse('id,lat,lon,genre,result_status\nn1,43.6,1.4,housenumber,ok\n')
        attentes = []
        lignes = x.interroger_ban([('n1', 43.6, 1.4)], ouvrir=ouvrir, dormir=attentes.append)
        self.assertEqual(etat['n'], 2)
        self.assertEqual(attentes, [10])                       # 429 : on attend avant de réessayer
        self.assertEqual(lignes[0]['id'], 'n1')
        self.assertEqual(etat['requete'].full_url, 'https://data.geopf.fr/geocodage/reverse/csv/')  # l'adresse officielle actuelle, pas l'ancien api-adresse.data.gouv.fr
        self.assertIn('CarnetPatte', etat['requete'].get_header('User-agent'))

    def test_aucune_autre_source_d_adresses(self):
        """Toutes les adresses web du script : seulement OpenStreetMap, Geofabrik, la Géoplateforme (BAN), Etalab / data.gouv.fr et GitHub. Jamais Google Maps ni les Pages Jaunes."""
        import re
        source = open(chemin, encoding='utf-8').read()
        hotes = {re.match(r'https?://([^/\s\'")]+)', u).group(1) for u in re.findall(r'https?://[^\s\'")]+', source)}
        autorises = {'download.geofabrik.de', 'etalab-datasets.geo.data.gouv.fr', 'data.geopf.fr', 'adresse.data.gouv.fr', 'www.etalab.gouv.fr',
                     'github.com', 'www.openstreetmap.org', 'api-adresse.data.gouv.fr'}
        self.assertEqual(hotes - autorises, set())
        self.assertNotIn('api-adresse.data.gouv.fr/reverse', source)   # l'ancienne adresse (dépréciée) n'est jamais appelée


class Departements(unittest.TestCase):
    def test_rangement_et_bord_de_mer(self):
        from shapely.geometry import box
        deps = {'01': box(0, 0, 1, 1), '02': box(1, 0, 2, 1)}
        lieux = [
            x.lieu_depuis('n1', {'amenity': 'veterinary'}, 0.5, 0.5),
            x.lieu_depuis('n2', {'amenity': 'veterinary'}, 0.5, 1.5),
            x.lieu_depuis('n3', {'amenity': 'veterinary'}, 0.5, -0.05),   # juste hors contour : département le plus proche
            x.lieu_depuis('n4', {'amenity': 'veterinary'}, 5, 5),         # très loin : ignoré
        ]
        rangement, hors = x.ranger_par_departement(lieux, deps)
        self.assertEqual({c: [l['id'] for l in v] for c, v in rangement.items()}, {'01': ['n1', 'n3'], '02': ['n2']})
        self.assertEqual(hors, 1)

    def test_contour_de_la_france_couvre_les_departements(self):
        from shapely.geometry import Point, box
        deps = {'01': box(0, 0, 1, 1), '02': box(1, 0, 2, 1)}
        anneaux = x.contour_france(deps)
        self.assertEqual(len(anneaux), 1)
        from shapely.geometry import Polygon
        poly = Polygon(anneaux[0])
        self.assertTrue(poly.contains(Point(0.5, 0.5)) and poly.contains(Point(1.99, 0.5)))
        self.assertFalse(poly.contains(Point(5, 5)))


if __name__ == '__main__':
    unittest.main(verbosity=2)
