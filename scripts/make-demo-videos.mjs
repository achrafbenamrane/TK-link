/**
 * Fabrique les vidéos de DÉMONSTRATION des vitrines (assets/videos/*.mp4) à partir des photos
 * produit du dépôt : un diaporama de 10 secondes (zoom lent, fondus, prix barrés), sans son.
 *
 * Ce ne sont PAS des vidéos de commerçants : ce sont des exemples pour montrer au client le
 * lecteur de la vitrine. Un commerçant réel dépose la sienne depuis « Ma boutique ». Les
 * sources sont celles de assets/images/products/CREDITS.md (les huit premières ne sont pas
 * sous licence : démonstration seulement).
 *
 * Usage : node scripts/make-demo-videos.mjs   (ffmpeg doit être installé)
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const W = 960;
const H = 540;
const FPS = 30;
const FONT = 'C\\:/Windows/Fonts/arialbd.ttf';
const PINK = '0xFF1F7A';
const TRANSITION = 0.5;

const IMAGES = 'assets/images/products';
const OUT = 'assets/videos';

const VIDEOS = [
  {
    file: 'techno-capitole.mp4',
    title: 'TECHNO CAPITOLE',
    subtitle: 'Hi-tech · Toulouse Centre',
    outro: 'Nos Flash du moment',
    clips: [
      {
        img: 'd_casque.jpg',
        title: 'Casque audio sans fil',
        price: '39,00 €',
        was: 'au lieu de 89,00 €',
      },
      {
        img: 'd_tablette.jpg',
        title: 'Tablette 10 pouces reconditionnée',
        price: '129,00 €',
        was: 'au lieu de 249,00 €',
      },
    ],
    clipSeconds: 3.5,
  },
  {
    file: 'petit-toulousain.mp4',
    title: 'LE PETIT TOULOUSAIN',
    subtitle: 'Cuisine du Sud-Ouest · Les Carmes',
    outro: 'Nos Flash du moment',
    clips: [
      {
        img: 'd_cassoulet.jpg',
        title: 'Cassoulet maison',
        price: '12,90 €',
        was: 'au lieu de 18,90 €',
      },
      { img: 'd_pizza.jpg', title: 'Pizza Margherita', price: '6,90 €', was: 'au lieu de 11,90 €' },
      {
        img: 'd_viennoiseries.jpg',
        title: 'Plateau de viennoiseries',
        price: '4,50 €',
        was: 'au lieu de 9,00 €',
      },
    ],
    clipSeconds: 3,
  },
];

const text = (value, size, color, x, y) =>
  `drawtext=fontfile='${FONT}':text='${value}':fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`;

/** Une carte de titre : fond sombre dégradé rose, texte centré. */
function card(lines, seconds) {
  const bg = `color=c=0x0A0A0D:s=${W}x${H}:r=${FPS}:d=${seconds}`;
  const glow = `drawbox=x=0:y=${H - 8}:w=${W}:h=8:color=${PINK}:t=fill`;
  const [main, sub] = lines;
  return [
    `${bg},${glow},` +
      `${text(main, 58, 'white', '(w-text_w)/2', '(h-text_h)/2-30')},` +
      `${text(sub, 28, PINK, '(w-text_w)/2', '(h-text_h)/2+40')},` +
      `format=yuv420p,setsar=1`,
  ];
}

function build(video) {
  const inputs = [];
  const filters = [];
  const labels = [];
  let idx = 0;

  const addCard = (lines, seconds) => {
    const label = `v${idx}`;
    filters.push(`${card(lines, seconds)[0]}[${label}]`);
    labels.push({ label, seconds });
    idx += 1;
  };

  addCard([video.title, video.subtitle], 2);

  for (const clip of video.clips) {
    const frames = Math.round(video.clipSeconds * FPS);
    inputs.push(
      '-loop',
      '1',
      '-t',
      String(video.clipSeconds + 1),
      '-i',
      path.join(IMAGES, clip.img),
    );
    const input = inputs.filter((a) => a === '-i').length - 1;
    const label = `v${idx}`;
    filters.push(
      `[${input}:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
        `zoompan=z='min(zoom+0.0010,1.10)':d=${frames}:s=${W}x${H}:fps=${FPS},` +
        // un voile sombre en bas pour lire le texte, un filet rose, puis le titre et les prix
        `drawbox=x=0:y=${H - 150}:w=${W}:h=150:color=black@0.62:t=fill,` +
        `drawbox=x=40:y=${H - 128}:w=6:h=86:color=${PINK}:t=fill,` +
        `${text(clip.title, 38, 'white', 64, H - 130)},` +
        `${text(clip.price, 44, PINK, 64, H - 80)},` +
        `${text(clip.was, 26, '0xDDDDDD', 280, H - 70)},` +
        `format=yuv420p,setsar=1[${label}]`,
    );
    labels.push({ label, seconds: video.clipSeconds });
    idx += 1;
  }

  addCard([video.outro, 'Touch & Collect · Livraison'], 2);

  // Les fondus : chaque transition recouvre la fin du clip précédent.
  let current = labels[0].label;
  let elapsed = labels[0].seconds;
  for (let i = 1; i < labels.length; i++) {
    const out = `x${i}`;
    const offset = (elapsed - TRANSITION).toFixed(2);
    filters.push(
      `[${current}][${labels[i].label}]xfade=transition=fade:duration=${TRANSITION}:offset=${offset}[${out}]`,
    );
    current = out;
    elapsed = elapsed - TRANSITION + labels[i].seconds;
  }

  return { inputs, filter: filters.join(';'), last: current };
}

mkdirSync(OUT, { recursive: true });
for (const video of VIDEOS) {
  const { inputs, filter, last } = build(video);
  const target = path.join(OUT, video.file);
  const args = [
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    `[${last}]`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '27',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    target,
  ];
  const res = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`ffmpeg a échoué pour ${video.file}`);
    process.exit(res.status ?? 1);
  }
  console.log(`✓ ${target}`);
}
