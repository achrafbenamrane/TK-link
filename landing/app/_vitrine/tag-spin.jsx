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
    let loaded = false;
    let current = -1;
    let raf = 0;

    const draw = (k) => {
      const img = images[k];
      if (!img || !img.complete || !img.naturalWidth || k === current) return;
      current = k;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
    };

    const update = () => {
      raf = 0;
      const box = list.current.getBoundingClientRect();
      const mid = window.innerHeight * 0.55;
      const p = Math.min(1, Math.max(0, (mid - box.top) / box.height));
      const s = Math.min(steps.length - 1, Math.floor(p * steps.length));
      setStep(s);
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
      let ready = 0;
      for (let k = 0; k < FRAMES; k++) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          ready += 1;
          if (k === 0) draw(0);
          if (ready === FRAMES) {
            loaded = true;
            update();
          }
        };
        img.src = src(k);
        images.push(img);
      }
    };

    // Les images ne se chargent qu'à l'approche de la section (pas au premier affichage).
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && load(), {
      rootMargin: '900px 0px',
    });
    io.observe(section);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
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
