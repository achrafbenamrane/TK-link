"""
Génère toute l'identité visuelle Freedoo depuis une seule géométrie : un sac de
courses portant le F de la marque.

    python scripts/generate-icons.py        (nécessite Pillow)

Pourquoi un script plutôt que des PNG posés là : l'identité se redessine à
l'identique quand la marque bouge, sans rouvrir un outil de dessin. La typo vient
de node_modules — exactement celle que l'app affiche à l'écran.

── LE SYSTÈME ──────────────────────────────────────────────────────────────────
La marque existe en DEUX versions, parce qu'un sac noir disparaît sur un fond
noir :
  • `mark_on_light` — sac noir, F blanc : l'icône principale, sur fond clair ;
  • `mark_on_dark`  — sac crème, F ink  : écran de démarrage, carte de partage.
Deux fonctions plutôt qu'un paramètre qu'on oublie de passer.

── ZONE DE SÉCURITÉ ANDROID ────────────────────────────────────────────────────
Une icône adaptative est rognée par le masque du constructeur (cercle, carré
arrondi, goutte…). Seuls les 66 dp centraux sur 108 sont garantis visibles, soit
61 % de la largeur : un logo plein cadre se fait amputer sur la moitié des
téléphones. Le premier plan est réduit pour tenir dans cette zone, et
`verify_safe_zone()` le VÉRIFIE au lieu de le supposer.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'images'
WEB = ROOT / 'landing' / 'img'
FONT_PATH = (
    ROOT / 'node_modules' / '@expo-google-fonts' / 'unbounded' / '900Black' / 'Unbounded_900Black.ttf'
)
BODY_FONT = (
    ROOT / 'node_modules' / '@expo-google-fonts' / 'manrope' / '500Medium' / 'Manrope_500Medium.ttf'
)

INK = (23, 20, 15)
CREAM = (246, 242, 234)
RED = (245, 49, 29)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

# Proportions du sac, en fraction du côté du canevas. Plus HAUT que large :
# c'est ce rapport qui distingue un sac de courses d'une mallette.
BAG_W, BAG_H, BAG_CY = 0.40, 0.46, 0.56
HANDLE_R = 0.26
HANDLE_W = 0.048
LETTER = 0.21
SS = 4  # suréchantillonnage : on dessine 4x puis on réduit (bords nets)
ANDROID_SAFE = 66 / 108
ANDROID_FG_SCALE = 0.92


def _draw_mark(size, bg, bag_colour, letter_colour, scale=1.0, punch_letter=False):
    """Le sac et son F. `punch_letter` ÉVIDE la lettre au lieu de la colorer —
    indispensable pour l'icône monochrome, que le système recolore en aplat."""
    big = size * SS
    canvas = Image.new('RGBA', (big, big), (*bg, 255) if bg else (0, 0, 0, 0))

    layer = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = big / 2, big * BAG_CY
    w, h = big * BAG_W * scale, big * BAG_H * scale
    top, bot = cy - h / 2, cy + h / 2

    # L'anse d'abord : son ancrage disparaît ensuite sous le corps du sac.
    hr = w * HANDLE_R
    d.arc(
        [cx - hr, top - hr * 1.25, cx + hr, top + hr * 0.75],
        start=180,
        end=360,
        fill=(*bag_colour, 255),
        width=max(1, int(big * HANDLE_W * scale)),
    )
    d.rounded_rectangle([cx - w / 2, top, cx + w / 2, bot], radius=w * 0.14, fill=(*bag_colour, 255))

    font = ImageFont.truetype(str(FONT_PATH), max(1, int(big * LETTER * scale)))
    box = d.textbbox((0, 0), 'F', font=font)
    lx = cx - (box[2] - box[0]) / 2 - box[0]
    ly = cy + big * 0.01 * scale - (box[3] - box[1]) / 2 - box[1]

    if punch_letter:
        hole = Image.new('L', (big, big), 255)
        ImageDraw.Draw(hole).text((lx, ly), 'F', font=font, fill=0)
        layer.putalpha(Image.composite(layer.split()[3], Image.new('L', (big, big), 0), hole))
    else:
        d.text((lx, ly), 'F', font=font, fill=(*letter_colour, 255))

    canvas.alpha_composite(layer)
    return canvas.resize((size, size), Image.LANCZOS)


def mark_on_light(size, bg=WHITE, scale=1.0, punch=False):
    """Version principale : sac noir, F blanc. Pour fonds clairs."""
    return _draw_mark(size, bg, BLACK, WHITE, scale, punch)


def mark_on_dark(size, bg=INK, scale=1.0):
    """Version inverse : sac crème, F ink. Pour fonds sombres."""
    return _draw_mark(size, bg, CREAM, INK, scale)


def verify_safe_zone(img, label):
    """La marque survit-elle au rognage d'un masque adaptatif ?"""
    box = img.split()[3].getbbox()
    size = img.size[0]
    safe = size * ANDROID_SAFE
    lo, hi = (size - safe) / 2, (size + safe) / 2
    ok = bool(box) and box[0] >= lo and box[1] >= lo and box[2] <= hi and box[3] <= hi
    # On rapporte la dimension LIMITANTE : le sac est plus haut que large, donc
    # mesurer la largeur seule laisserait croire qu'il reste de la marge.
    w_fill = (box[2] - box[0]) / safe * 100 if box else 0
    h_fill = (box[3] - box[1]) / safe * 100 if box else 0
    print(
        f'  {label:32s} {"OK" if ok else "DÉBORDE — sera rognée"}  '
        f'(zone sûre remplie à {max(w_fill, h_fill):.0f} %)'
    )
    return ok


def app_icons():
    mark_on_light(1024).convert('RGB').save(OUT / 'icon.png')

    Image.new('RGB', (512, 512), WHITE).save(OUT / 'android-icon-background.png')
    fg = mark_on_light(512, bg=None, scale=ANDROID_FG_SCALE)
    fg.save(OUT / 'android-icon-foreground.png')

    # Monochrome : le système applique UNE couleur. Le F doit donc être un trou,
    # sinon il se noie dans l'aplat du sac.
    mono = mark_on_light(432, bg=None, scale=ANDROID_FG_SCALE, punch=True)
    mono.save(OUT / 'android-icon-monochrome.png')

    mark_on_light(48).convert('RGB').save(OUT / 'favicon.png')
    # Écran de démarrage : fond ink, donc version claire de la marque.
    mark_on_dark(512, bg=None).save(OUT / 'splash-icon.png')

    verify_safe_zone(fg, 'android-icon-foreground')
    verify_safe_zone(mono, 'android-icon-monochrome')


def landing_assets():
    WEB.mkdir(parents=True, exist_ok=True)
    mark_on_light(180).convert('RGB').save(WEB / 'favicon-180.png')
    mark_on_light(32).convert('RGB').save(WEB / 'favicon-32.png')

    W, H = 1200, 630
    card = Image.new('RGB', (W, H), INK)
    d = ImageDraw.Draw(card)

    title = ImageFont.truetype(str(FONT_PATH), 92)
    box = d.textbbox((0, 0), 'Freedoo', font=title)
    d.text((72 - box[0], 150 - box[1]), 'Freedoo', font=title, fill=CREAM)
    dot = 26
    d.ellipse(
        [
            72 + (box[2] - box[0]) + 14,
            150 + (box[3] - box[1]) - dot,
            72 + (box[2] - box[0]) + 14 + dot,
            150 + (box[3] - box[1]),
        ],
        fill=RED,
    )

    sub = ImageFont.truetype(str(BODY_FONT), 34) if BODY_FONT.exists() else title
    for i, line in enumerate(
        ['Les ventes flash de votre quartier,', 'livrées avant qu’elles ne s’envolent.']
    ):
        d.text((74, 300 + i * 48), line, font=sub, fill=(196, 190, 180))

    tag_font = ImageFont.truetype(str(BODY_FONT), 26) if BODY_FONT.exists() else sub
    label = 'Lancé à Toulouse'
    tb = d.textbbox((0, 0), label, font=tag_font)
    px, py, x0, y0 = 30, 16, 74, 452
    x1, y1 = x0 + (tb[2] - tb[0]) + px * 2, y0 + (tb[3] - tb[1]) + py * 2
    d.rounded_rectangle([x0, y0, x1, y1], radius=(y1 - y0) / 2, fill=RED)
    d.text((x0 + px - tb[0], y0 + py - tb[1]), label, font=tag_font, fill=CREAM)

    shot = WEB / 'accueil.jpg'
    if shot.exists():
        phone = Image.open(shot).convert('RGB')
        target_h = H - 120
        ratio = target_h / phone.size[1]
        phone = phone.resize((int(phone.size[0] * ratio), target_h), Image.LANCZOS)
        card.paste(phone, (W - phone.size[0] - 96, (H - target_h) // 2))

    card.save(WEB / 'og-card.png')


def main() -> None:
    if not FONT_PATH.exists():
        raise SystemExit(f'Police introuvable : {FONT_PATH}\nLancez `npm install` d’abord.')
    app_icons()
    landing_assets()
    print()
    for p in sorted(OUT.glob('*.png')) + sorted(WEB.glob('favicon*.png')) + [WEB / 'og-card.png']:
        im = Image.open(p)
        print(f'  {p.name:32s} {im.size[0]}x{im.size[1]}  {p.stat().st_size // 1024} Ko')


if __name__ == '__main__':
    main()
