"""
Génère le jeu d'icônes Freedoo depuis la marque : un F en Unbounded Black,
crème sur ink, suivi du point rouge du wordmark « Freedoo. ».

    python scripts/generate-icons.py        (nécessite Pillow)

Pourquoi un script plutôt que des PNG posés là : l'icône se redessine quand la
marque bouge, à l'identique, sans rouvrir un outil de dessin. La typo vient de
node_modules — la même que l'app affiche à l'écran.

⚠ ZONE DE SÉCURITÉ ANDROID. Une icône adaptative est rognée par le masque du
constructeur (cercle, carré arrondi, goutte…). Seuls les 66 dp centraux sur 108
sont garantis visibles, soit 61 % de la largeur. Un logo dessiné plein cadre se
fait donc amputer sur la moitié des téléphones. Le premier plan est mis à
l'échelle pour tenir dans cette zone.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'images'
FONT_PATH = (
    ROOT / 'node_modules' / '@expo-google-fonts' / 'unbounded' / '900Black' / 'Unbounded_900Black.ttf'
)

INK = (23, 20, 15)
CREAM = (246, 242, 234)
RED = (245, 49, 29)

# Part de la largeur occupée par le F, et diamètre du point relatif à ce F.
LETTER_RATIO = 0.60
DOT_RATIO = 0.20
# 66/108 : la fraction garantie visible d'une icône adaptative Android.
ANDROID_SAFE = 66 / 108
# Échelle du premier plan : réglée pour REMPLIR cette zone sûre plutôt que de
# s'y perdre au centre. Vérifiée par `npm run icons:check`.
ANDROID_FG_SCALE = 0.92


def draw_mark(size: int, fg, bg, scale: float = 1.0, dot=RED):
    """Le F suivi de son point, centré optiquement sur l'ensemble."""
    img = Image.new('RGBA', (size, size), (*bg, 255) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    font = ImageFont.truetype(str(FONT_PATH), int(size * LETTER_RATIO * scale))
    box = d.textbbox((0, 0), 'F', font=font)
    lw, lh = box[2] - box[0], box[3] - box[1]

    dot_d = lh * DOT_RATIO
    gap = dot_d * 0.55
    # On centre le bloc COMPLET (lettre + espace + point), sinon l'ensemble
    # penche à gauche alors que la lettre seule paraissait centrée.
    total_w = lw + gap + dot_d
    x = (size - total_w) / 2
    y = (size - lh) / 2

    d.text((x - box[0], y - box[1]), 'F', font=font, fill=(*fg, 255))
    if dot is not None:
        # Le point s'aligne sur la ligne de base du F, comme dans « Freedoo. ».
        dot_top = y + lh - dot_d
        d.ellipse([x + lw + gap, dot_top, x + lw + gap + dot_d, dot_top + dot_d], fill=(*dot, 255))
    return img


def landing_assets() -> None:
    """Favicon + carte de partage de la landing, tirés de la même marque."""
    web = ROOT / 'landing' / 'img'
    web.mkdir(parents=True, exist_ok=True)

    # Favicons. 32 px pour l'onglet, 180 px pour l'écran d'accueil iOS.
    draw_mark(180, CREAM, INK).convert('RGB').save(web / 'favicon-180.png')
    draw_mark(32, CREAM, INK).convert('RGB').save(web / 'favicon-32.png')

    # Carte Open Graph : ce que voit le destinataire quand on lui envoie le lien
    # sur WhatsApp ou LinkedIn. Sans elle, un lien nu, sans marque ni promesse.
    W, H = 1200, 630
    card = Image.new('RGB', (W, H), INK)
    d = ImageDraw.Draw(card)

    title_font = ImageFont.truetype(str(FONT_PATH), 92)
    box = d.textbbox((0, 0), 'Freedoo', font=title_font)
    d.text((72 - box[0], 150 - box[1]), 'Freedoo', font=title_font, fill=CREAM)
    dot_d = 26
    d.ellipse(
        [72 + (box[2] - box[0]) + 14, 150 + (box[3] - box[1]) - dot_d,
         72 + (box[2] - box[0]) + 14 + dot_d, 150 + (box[3] - box[1])],
        fill=RED,
    )

    body = ROOT / 'node_modules' / '@expo-google-fonts' / 'manrope' / '500Medium' / 'Manrope_500Medium.ttf'
    sub_font = ImageFont.truetype(str(body), 34) if body.exists() else ImageFont.truetype(str(FONT_PATH), 28)
    for i, line in enumerate([
        'Les ventes flash de votre quartier,',
        'livrées avant qu’elles ne s’envolent.',
    ]):
        d.text((74, 300 + i * 48), line, font=sub_font, fill=(196, 190, 180))

    # La pastille se dimensionne sur le texte mesuré : une largeur en dur
    # déborde dès qu'on change un mot ou la police.
    tag_font = ImageFont.truetype(str(body), 26) if body.exists() else sub_font
    label = 'Lancé à Toulouse'
    tb = d.textbbox((0, 0), label, font=tag_font)
    pad_x, pad_y = 30, 16
    x0, y0 = 74, 452
    x1 = x0 + (tb[2] - tb[0]) + pad_x * 2
    y1 = y0 + (tb[3] - tb[1]) + pad_y * 2
    d.rounded_rectangle([x0, y0, x1, y1], radius=(y1 - y0) / 2, fill=RED)
    d.text((x0 + pad_x - tb[0], y0 + pad_y - tb[1]), label, font=tag_font, fill=CREAM)

    # La capture réelle à droite : la carte montre le produit, pas une promesse.
    shot = ROOT / 'landing' / 'img' / 'accueil.jpg'
    if shot.exists():
        phone = Image.open(shot).convert('RGB')
        # Tient entièrement dans la carte, centré : une capture tronquée au ras
        # du bord se lit comme un bug d'export, pas comme un parti pris.
        target_h = H - 120
        ratio = target_h / phone.size[1]
        phone = phone.resize((int(phone.size[0] * ratio), target_h), Image.LANCZOS)
        card.paste(phone, (W - phone.size[0] - 96, (H - target_h) // 2))

    card.save(web / 'og-card.png')
    for n in ('favicon-32.png', 'favicon-180.png', 'og-card.png'):
        f = web / n
        print(f'  landing/img/{n:22s} {Image.open(f).size[0]}x{Image.open(f).size[1]}  {f.stat().st_size // 1024} Ko')


def main() -> None:
    if not FONT_PATH.exists():
        raise SystemExit(f'Police introuvable : {FONT_PATH}\nLancez `npm install` d’abord.')

    # Icône principale : plein cadre, l'OS applique son propre masque.
    draw_mark(1024, CREAM, INK).convert('RGB').save(OUT / 'icon.png')

    # Android adaptatif : fond et premier plan séparés, premier plan réduit pour
    # survivre au rognage du masque.
    Image.new('RGB', (512, 512), INK).save(OUT / 'android-icon-background.png')
    draw_mark(512, CREAM, None, scale=ANDROID_FG_SCALE).save(OUT / 'android-icon-foreground.png')

    # Icône monochrome (thème Material You) : une silhouette, pas de couleur —
    # le système la recolore. Le point rouge disparaîtrait donc en aplat.
    draw_mark(432, (255, 255, 255), None, scale=ANDROID_FG_SCALE, dot=(255, 255, 255)).save(
        OUT / 'android-icon-monochrome.png'
    )

    draw_mark(48, CREAM, INK).convert('RGB').save(OUT / 'favicon.png')

    # Splash : le logo seul sur fond transparent, Expo pose le fond ink.
    draw_mark(512, CREAM, None).save(OUT / 'splash-icon.png')

    for name in (
        'icon.png',
        'android-icon-background.png',
        'android-icon-foreground.png',
        'android-icon-monochrome.png',
        'favicon.png',
        'splash-icon.png',
    ):
        p = OUT / name
        print(f'  {name:32s} {Image.open(p).size[0]}x{Image.open(p).size[1]}  {p.stat().st_size // 1024} Ko')

    landing_assets()


if __name__ == '__main__':
    main()
