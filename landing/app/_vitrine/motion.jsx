'use client';

import { useEffect } from 'react';

/**
 * Le mouvement de la vitrine, en un seul endroit :
 *   - l'entrée du héros (l'étiquette descend sur sa ficelle, les lignes du titre montent) ;
 *   - l'en-tête qui se resserre au défilement ;
 *   - les blocs qui apparaissent à l'approche (`.rv` → `.in`) ;
 *   - les chiffres du papier qui défilent jusqu'à leur valeur (`[data-count]`) ;
 *   - une parallaxe discrète de l'étiquette sous le pointeur (souris seulement).
 * Mouvement réduit demandé : tout est posé d'emblée, rien ne bouge.
 */
export default function Motion() {
  useEffect(() => {
    const doc = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    doc.classList.add(reduce ? 'v-still' : 'v-play');

    const head = document.getElementById('hdr');
    const onScroll = () => head?.classList.toggle('is-stuck', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const fmt = (n, d) =>
      n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const countUp = (el) => {
      const target = Number(el.dataset.count);
      const d = Number(el.dataset.decimals || 0);
      if (reduce) return;
      const start = performance.now();
      const dur = 1400;
      const tick = (t) => {
        const x = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - x, 4);
        el.textContent = fmt(target * eased, d);
        if (x < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target, d);
      };
      requestAnimationFrame(tick);
    };

    const items = document.querySelectorAll('.v .rv');
    let io;
    if (!reduce && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.add('in');
            e.target.querySelectorAll('[data-count]').forEach(countUp);
            io.unobserve(e.target);
          }
        },
        { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
      );
      items.forEach((el) => io.observe(el));
    } else {
      items.forEach((el) => el.classList.add('in'));
    }

    // Parallaxe : l'étiquette suit un peu le pointeur, comme si l'air bougeait.
    const swing = document.querySelector('[data-parallax]');
    const fine = window.matchMedia('(pointer: fine)').matches;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          swing?.style.setProperty('--px', tx.toFixed(3));
          swing?.style.setProperty('--py', ty.toFixed(3));
        });
    };
    if (swing && fine && !reduce) window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
      if (io) io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      doc.classList.remove('v-play', 'v-still');
    };
  }, []);

  return null;
}
