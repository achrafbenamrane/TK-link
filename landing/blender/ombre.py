"""L'ombre rose de l'étiquette du héros, cuite dans l'image.

Le site posait l'ombre en CSS (`filter: drop-shadow(0 40px 50px rgba(255, 20, 120, .22))`) sur une
image qui se balance sans fin : le navigateur refaisait ce flou de 50 px à chaque image du
balancement. Sur un téléphone, c'est ce qui saccadait. Cuite ici une fois pour toutes, l'ombre
coûte zéro : le balancement ne déplace plus qu'une image.

Même ombre que le CSS, à la taille où l'étiquette s'affiche sur ordinateur (420 px de large pour
1000 px d'image) : décalage 40 px → 95 px, flou 50 px (écart-type 25 px) → 60 px. Le bas de l'image
est agrandi de 200 px pour que l'ombre ne soit pas coupée.

Entrée : public/3d/etiquette.webp (le rendu brut de `etiquette.py --shot hero`, jamais modifié).
Sortie : public/3d/etiquette-ombre.webp (celle que la page sert). À relancer après chaque rendu :

    python landing/blender/ombre.py
"""

import os

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'public', '3d', 'etiquette.webp')
OUT = os.path.join(HERE, '..', 'public', '3d', 'etiquette-ombre.webp')

AFFICHAGE = 420  # px CSS, largeur de l'étiquette sur ordinateur (.v-hero__swing)
DECALAGE = 40  # px CSS
FLOU = 50  # px CSS : rayon du drop-shadow, l'écart-type en est la moitié
ROSE = (255, 20, 120)
OPACITE = 0.22
MARGE_BAS = 200  # px d'image ajoutés sous l'étiquette


def main():
    tag = Image.open(SRC).convert('RGBA')
    w, h = tag.size
    k = w / AFFICHAGE

    toile = Image.new('RGBA', (w, h + MARGE_BAS), (0, 0, 0, 0))

    # La silhouette de l'étiquette, teintée en rose, floutée, décalée vers le bas.
    alpha = tag.getchannel('A').point(lambda a: round(a * OPACITE))
    masque = Image.new('L', toile.size, 0)
    masque.paste(alpha, (0, round(DECALAGE * k)))
    masque = masque.filter(ImageFilter.GaussianBlur(FLOU / 2 * k))
    ombre = Image.new('RGBA', toile.size, ROSE + (0,))
    ombre.putalpha(masque)

    toile.alpha_composite(ombre)
    toile.alpha_composite(tag, (0, 0))
    toile.save(OUT, 'WEBP', quality=90, method=6)
    print(f'{OUT} : {toile.size[0]} × {toile.size[1]}, {os.path.getsize(OUT) // 1024} Ko')


if __name__ == '__main__':
    main()
