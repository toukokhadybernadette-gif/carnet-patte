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
        self.assertEqual(set(l), {'id', 'cat', 'lat', 'lon', 'nom', 'adresse', 'tel', 'horaires', 'site'})
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
