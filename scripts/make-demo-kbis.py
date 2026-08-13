#!/usr/bin/env python3
"""Fabrique le Kbis de démonstration joint aux demandes d'inscription.

L'écran de validation du Super Admin ne vaut rien sans document à ouvrir : un
bouton « accepter » posé au-dessus d'un lien mort ne prouve pas qu'on peut
vérifier quoi que ce soit. Ce fichier produit la pièce que l'administrateur
lit avant de trancher.

    python scripts/make-demo-kbis.py

⚠️ Outil d'ATELIER, comme `make-icons.py`. Il ne tourne pas dans la
vérification et n'est pas une dépendance : le PDF est versionné, on ne le
régénère qu'en changeant sa forme. Il demande Python et Pillow.

⚠️ Le document porte un filigrane « DÉMONSTRATION » et une mention explicite
d'absence de valeur juridique. Un faux Kbis crédible qui circulerait sans ces
marques serait un problème d'une tout autre nature qu'un défaut d'affichage.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'landing', 'public', 'demo', 'kbis-maison-hammamet.pdf')

# A4 à 150 dpi.
W, H = 1240, 1754
MARGIN = 96

# Le vert de la marque — `brand600`, comme les icônes de l'application.
GREEN = (11, 108, 59)
GREEN_DARK = (8, 79, 43)
GREEN_PALE = (233, 243, 236)
INK = (18, 26, 20)
MUTED = (110, 122, 111)
LINE = (214, 222, 213)
WARN = (165, 48, 32)


def font(size, bold=False):
    for name in (('arialbd.ttf', 'arial.ttf')[not bold],):
        try:
            return ImageFont.truetype('C:/Windows/Fonts/' + name, size)
        except OSError:
            pass
    try:
        return ImageFont.truetype('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf', size)
    except OSError:
        return ImageFont.load_default()


def section(d, y, title):
    """Un intertitre sur bandeau vert pâle."""
    d.rounded_rectangle([MARGIN, y - 8, W - MARGIN, y + 38], 6, fill=GREEN_PALE)
    d.rectangle([MARGIN, y - 8, MARGIN + 5, y + 38], fill=GREEN)
    d.text((MARGIN + 20, y + 3), title, font=font(21, True), fill=GREEN_DARK)
    return y + 66


def field(d, y, key, value, flag=False):
    d.text((MARGIN + 20, y), key, font=font(18), fill=MUTED)
    d.text((MARGIN + 430, y), value, font=font(18, True), fill=WARN if flag else INK)
    return y + 38


def build():
    img = Image.new('RGB', (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)

    # ------------------------------------------------------------- bandeau
    d.rectangle([0, 0, W, 168], fill=GREEN)
    d.rectangle([0, 168, W, 174], fill=(195, 245, 60))  # le lime de la marque
    d.text((MARGIN, 46), 'GREFFE DU TRIBUNAL DE COMMERCE', font=font(27, True), fill=(255, 255, 255))
    d.text((MARGIN, 84), 'DE TOULOUSE', font=font(27, True), fill=(255, 255, 255))
    d.text((MARGIN, 124), 'Extrait Kbis · document de démonstration', font=font(18), fill=(196, 224, 206))

    # Cartouche de référence, en haut à droite.
    d.rounded_rectangle([W - MARGIN - 300, 44, W - MARGIN, 140], 8, outline=(120, 170, 140), width=2)
    d.text((W - MARGIN - 280, 58), 'N° de dossier', font=font(15), fill=(196, 224, 206))
    d.text((W - MARGIN - 280, 80), '2026 B 04127', font=font(21, True), fill=(255, 255, 255))
    d.text((W - MARGIN - 280, 110), 'Délivré le 12/08/2026', font=font(14), fill=(196, 224, 206))

    y = 232
    d.text((MARGIN, y), "EXTRAIT D'IMMATRICULATION PRINCIPALE", font=font(29, True), fill=INK)
    y += 42
    d.text((MARGIN, y), 'AU REGISTRE DU COMMERCE ET DES SOCIÉTÉS', font=font(29, True), fill=INK)
    y += 70

    y = section(d, y, 'Identification de la personne morale')
    y = field(d, y, 'Immatriculation au RCS, numéro', '893 214 507 R.C.S. Toulouse')
    y = field(d, y, "Date d'immatriculation", '14/03/2021')
    y = field(d, y, 'Dénomination sociale', 'MAISON HAMMAMET')
    y = field(d, y, 'Forme juridique', 'Société à responsabilité limitée (SARL)')
    y = field(d, y, 'Capital social', '12 000,00 Euros')
    y = field(d, y, 'Adresse du siège', '24 avenue Jean Baylet, 31100 Toulouse')
    y = field(d, y, 'Numéro SIRET', '893 214 507 00018')
    y = field(d, y, 'Code APE', '47.22Z — Commerce de détail de viandes')
    y += 26

    y = section(d, y, 'Gestion, direction, administration')
    y = field(d, y, 'Gérant', 'BEN SALAH Karim')
    y = field(d, y, 'Né le', '02/06/1984 à Tunis (Tunisie)')
    y = field(d, y, 'Nationalité', 'Française')
    y += 26

    y = section(d, y, "Renseignements relatifs à l'activité")
    y = field(d, y, 'Activité principale', 'Boucherie, charcuterie, plats préparés')
    y = field(d, y, "Date de début d'activité", '01/04/2021')
    y = field(d, y, 'Enseigne', 'Maison Hammamet')
    y = field(d, y, 'Effectif salarié', '4 salariés')
    y += 26

    y = section(d, y, 'Observations')
    d.text((MARGIN + 20, y), 'Aucune procédure collective en cours.', font=font(18), fill=INK)
    y += 34
    d.text((MARGIN + 20, y), 'Aucune inscription de privilège ou nantissement.', font=font(18), fill=INK)
    y += 70

    # --------------------------------------------------------- avertissement
    d.rounded_rectangle([MARGIN, y, W - MARGIN, y + 108], 10, fill=(253, 240, 236), outline=(232, 190, 178), width=2)
    d.text((MARGIN + 22, y + 20), 'DOCUMENT DE DÉMONSTRATION', font=font(20, True), fill=WARN)
    d.text((MARGIN + 22, y + 52), "Généré pour illustrer l'écran de validation TK LINK.", font=font(17), fill=WARN)
    d.text((MARGIN + 22, y + 76), "Il ne constitue pas un extrait officiel et n'a aucune valeur juridique.", font=font(17), fill=WARN)

    # ------------------------------------------------------- pied de page
    fy = H - 96
    d.line([MARGIN, fy, W - MARGIN, fy], fill=LINE, width=2)
    d.text((MARGIN, fy + 20), 'Greffe du tribunal de commerce de Toulouse', font=font(15), fill=MUTED)
    d.text((MARGIN, fy + 44), 'Palais Niel — 2 allées Jules Guesde, 31000 Toulouse', font=font(15), fill=MUTED)
    d.text((W - MARGIN - 120, fy + 20), 'Page 1 / 1', font=font(15), fill=MUTED)

    # Tampon rond, discret, en bas à droite.
    cx, cy, r = W - MARGIN - 130, fy - 130, 96
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=GREEN, width=4)
    d.ellipse([cx - r + 12, cy - r + 12, cx + r - 12, cy + r - 12], outline=GREEN, width=2)
    d.text((cx - 74, cy - 30), 'GREFFE', font=font(24, True), fill=GREEN)
    d.text((cx - 62, cy + 2), 'TOULOUSE', font=font(17, True), fill=GREEN)
    d.text((cx - 44, cy + 30), '12.08.26', font=font(15), fill=GREEN)

    # ------------------------------------------------------------ filigrane
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((120, H // 2 - 70), 'DÉMONSTRATION', font=font(118, True), fill=GREEN + (34,))
    img = Image.alpha_composite(img.convert('RGBA'), layer.rotate(26, center=(W // 2, H // 2)))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.convert('RGB').save(OUT, 'PDF', resolution=150)
    return OUT


if __name__ == '__main__':
    path = build()
    print(f'  ✓ {os.path.relpath(path, ROOT)} — {os.path.getsize(path) // 1024} Ko')
