#!/usr/bin/env python3
"""Fabrique le jeu d'icônes TK LINK à partir d'UNE définition — celle-ci.

Six fichiers doivent raconter la même marque : l'icône iOS, les trois couches
de l'icône adaptative Android (fond, avant-plan, monochrome), le visuel du
splash et le favicon web. Retouchés à la main dans un éditeur, ils divergent au
premier ajustement : on corrige le vert sur l'un, on oublie les cinq autres, et
personne ne s'en aperçoit avant de voir l'app installée à côté de sa propre
notification.

D'où ce script. Le dessin vit ici, en un seul endroit.

    python scripts/make-icons.py

⚠️ Outil d'ATELIER, pas de build. Il ne tourne pas dans `npm run verify` et
n'est pas une dépendance du projet : les icônes sont versionnées, on ne les
régénère qu'en changeant la marque. Il demande Python et Pillow
(`pip install pillow`) — c'est le prix à payer pour ne pas embarquer une
chaîne de compilation native dans un dépôt JavaScript.

Le dessin : le sigle « TK » et les trois ondes du sans-contact, blancs sur le
vert de la marque. Pas d'arbre, pas de « LINK » — à 48 px sur un écran
d'accueil, tout ce qui n'est pas le sigle devient une tache.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "images")

# Les couleurs de `src/shared/theme/colors.ts`. Recopiées, faute de pouvoir
# lire du TypeScript ici — d'où le test d'intégrité qui les compare
# (src/shared/theme/__tests__/brand-icons.test.ts).
GREEN = (11, 108, 59)      # brand600 #0B6C3B
WHITE = (255, 255, 255)
LIME = (195, 245, 60)      # #C3F53C

FONT_PATH = os.path.join(
    ROOT, "node_modules", "@expo-google-fonts", "unbounded",
    "800ExtraBold", "Unbounded_800ExtraBold.ttf",
)


def draw_mark(img, scale=0.42, tone=WHITE, wave=LIME):
    """Dessine le sigle « TK » + ondes, centré comme un TOUT.

    Le piège : centrer le texte puis poser les ondes à côté décale l'ensemble
    vers la droite d'une demi-largeur d'ondes, et le « T » finit par sortir du
    cadre. On mesure donc le groupe complet — texte, écart, rayon extérieur de
    la plus grande onde — et c'est LUI qu'on centre.

    `scale` réserve la marge de sécurité : Android rogne l'icône adaptative en
    cercle, et un sigle qui touche les bords se fait amputer sur la moitié des
    lanceurs.
    """
    size = img.size[0]
    unit = size * scale
    d = ImageDraw.Draw(img)

    if not os.path.exists(FONT_PATH):
        sys.exit(f"✗ Police introuvable : {FONT_PATH}\n  Lancez `npm install` d'abord.")
    font = ImageFont.truetype(FONT_PATH, int(unit))

    text = "TK"
    box = d.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]

    # Géométrie des ondes. Chaque arc est centré sur `ox` et ouvert de ±52° :
    # sa partie visible va donc de ox + r·cos(52°) à ox + r.
    radii = (0.30, 0.47, 0.64)
    alphas = (255, 185, 110)
    inner_ratio = 0.616  # cos(52°)
    gap = unit * 0.08

    # L'onde la plus petite doit commencer juste après le K.
    # ox se déduit de sa propre extrémité gauche.
    lead = unit * radii[0] * inner_ratio
    span = tw + gap + (unit * radii[-1] - lead)

    left = size / 2 - span / 2
    cy = size / 2
    d.text((left - box[0], cy - th / 2 - box[1]), text, font=font, fill=tone)

    ox = left + tw + gap - lead
    # Un calque par onde : Pillow ne sait pas appliquer d'opacité par tracé, et
    # des arcs semi-transparents superposés cumuleraient leurs alphas.
    for r_ratio, alpha in zip(radii, alphas):
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        r = unit * r_ratio
        ImageDraw.Draw(layer).arc(
            [ox - r, cy - r, ox + r, cy + r],
            start=-52, end=52,
            fill=wave + (alpha,),
            width=max(2, int(unit * 0.115)),
        )
        img.alpha_composite(layer)


def solid(size, **kw):
    """Fond vert plein + sigle : l'icône « classique » (iOS, web)."""
    img = Image.new("RGBA", (size, size), GREEN + (255,))
    draw_mark(img, **kw)
    return img


def transparent(size, **kw):
    """Le sigle seul, sur fond transparent."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_mark(img, **kw)
    return img


def flat(size, color):
    return Image.new("RGBA", (size, size), color + (255,))


FILES = [
    ("icon.png", lambda: solid(1024, scale=0.46)),
    # Splash : le sigle seul, le fond venant de la configuration Expo.
    ("splash-icon.png", lambda: transparent(1024, scale=0.40)),
    ("favicon.png", lambda: solid(64, scale=0.50)),
    # Icône adaptative Android : trois couches, rognées en cercle par le système.
    ("android-icon-background.png", lambda: flat(1024, GREEN)),
    ("android-icon-foreground.png", lambda: transparent(1024, scale=0.34)),
    # Monochrome (thème dynamique, Android 13+) : le système applique SA
    # couleur, tout doit donc être d'une seule teinte opaque.
    (
        "android-icon-monochrome.png",
        lambda: transparent(1024, scale=0.34, tone=(0, 0, 0), wave=(0, 0, 0)),
    ),
]

if __name__ == "__main__":
    for name, make in FILES:
        img = make()
        img.save(os.path.join(OUT, name))
        print(f"  ✓ {name} — {img.size[0]}×{img.size[1]}")
    print(f"\n{len(FILES)} icônes régénérées dans assets/images/.")
