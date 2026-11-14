'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * « Comment ça marche » : l'étiquette tourne sur sa ficelle au fil du défilement.
 *
 * 30 images rendues dans Blender (`landing/blender/etiquette.py --shot spin`) : de face (« −59 % »)
 * au dos (le QR du code de retrait), dans l'ordre des trois gestes — ce qu'on choisit, ce qu'on
 * attrape, ce qu'on montre au comptoir. Une vraie rotation 3D, pas un effet CSS sur une image
 * plate ; et aucun moteur 3D à télécharger : des images, chargées seulement quand la section
 * approche.
 *
 * Mouvement réduit demandé : pas de rotation continue, l'étiquette change de face d'un geste à
 * l'autre (trois images).
 *
 * Pensé pour un téléphone moyen : le défilement n'est écouté que quand la section est proche de
 * l'écran (pas sur toute la page), l'étape n'est mise à jour que quand elle change, et chaque image
 * est décodée à l'avance hors du fil principal (`decode()`) — sans ça, dessiner une image jamais
 * affichée la décodait en plein défilement, d'où les saccades.
 */
const FRAMES = 30;
const src = (k) => `/3d/tour/${String(k).padStart(2, '0')}.webp`;

export default function TagSpin({ steps }) {
  const root = useRef(null);
  const list = useRef(null);
  const canvas = useRef(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const section = root.current;
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const images = [];
    const ready = new Array(FRAMES).fill(false);
    let loaded = false;
    let current = -1;
    let shown = 0;
    let raf = 0;
    let listening = false;

    const draw = (k) => {
      if (!ready[k] || k === current) return;
      current = k;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(images[k], 0, 0, cv.width, cv.height);
    };

    const update = () => {
      raf = 0;
      const box = list.current.getBoundingClientRect();
      const mid = window.innerHeight * 0.55;
      const p = Math.min(1, Math.max(0, (mid - box.top) / box.height));
      const s = Math.min(steps.length - 1, Math.floor(p * steps.length));
      if (s !== shown) {
        shown = s;
        setStep(s);
      }
      if (!loaded) return;
      const k = reduce
        ? Math.round((s / (steps.length - 1)) * (FRAMES - 1))
        : Math.round(p * (FRAMES - 1));
      draw(k);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const load = () => {
      if (loaded || images.length) return;
      let count = 0;
      for (let k = 0; k < FRAMES; k++) {
        const img = new Image();
        img.decoding = 'async';
        // decode() rend la main quand l'image est décodée, hors du fil principal (sinon : à la fin
        // du chargement, vieux Safari) ; une image en échec n'est jamais dessinée (la précédente
        // reste à l'écran).
        const decoded = img.decode
          ? null
          : new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
        img.src = src(k);
        images.push(img);
        (decoded || img.decode())
          .then(() => {
            ready[k] = true;
            if (k === 0) draw(0);
          })
          .catch(() => {})
          .finally(() => {
            count += 1;
            if (count === FRAMES) {
              loaded = true;
              update();
            }
          });
      }
    };

    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      const method = on ? 'addEventListener' : 'removeEventListener';
      window[method]('scroll', onScroll, { passive: true });
      window[method]('resize', onScroll);
      if (on) onScroll();
    };

    // Les images se chargent à l'approche de la section (pas au premier affichage), et le
    // défilement n'est suivi que tant qu'elle est proche de l'écran.
    const io = new IntersectionObserver(
      (entries) => {
        const near = entries[entries.length - 1].isIntersecting;
        if (near) load();
        listen(near);
      },
      { rootMargin: '900px 0px' },
    );
    io.observe(section);
    update();
    return () => {
      io.disconnect();
      listen(false);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [steps.length]);

  return (
    <div className="v-wrap v-how__grid" ref={root} data-step={step}>
      <div className="v-how__stage" aria-hidden="true">
        <div className="v-vitrine">
          <canvas ref={canvas} width="640" height="960" className="v-vitrine__tag" />
          <p className="v-vitrine__caption">
            <span>{String(step + 1).padStart(2, '0')}</span>
            {steps[step].title}
          </p>
          <div className="v-vitrine__dots">
            {steps.map((s, i) => (
              <i key={s.title} className={i === step ? 'is-on' : undefined} />
            ))}
          </div>
        </div>
      </div>

      <ol className="v-how__steps" ref={list}>
        {steps.map((s, i) => (
          <li className={i === step ? 'v-how__step is-on' : 'v-how__step'} key={s.title}>
            <span className="v-how__num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
