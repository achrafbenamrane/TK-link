'use client';

import { useEffect } from 'react';

export default function Interactions() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* hero entrance */
    document.body.classList.add('play');

    /* nav border on scroll */
    const hdr = document.getElementById('hdr');
    const onScroll = () => hdr && hdr.classList.toggle('stuck', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* scroll reveal */
    const rs = document.querySelectorAll('.r');
    let io;
    if ('IntersectionObserver' in window && !reduce) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.16, rootMargin: '0px 0px -6% 0px' }
      );
      rs.forEach((el) => io.observe(el));
    } else {
      rs.forEach((el) => el.classList.add('in'));
    }

    /* live countdown */
    const total = 285; // 04:45
    let t = total;
    const ct = document.getElementById('cardTimer');
    const p = (n) => (n < 10 ? '0' : '') + n;
    const fmt = (s) => p((s / 3600) | 0) + ':' + p(((s % 3600) / 60) | 0) + ':' + p(s % 60);
    const timer = setInterval(() => {
      t--;
      if (t < 0) t = total;
      if (ct) ct.textContent = fmt(t);
    }, 1000);

    /* stock bar */
    const bar = document.getElementById('cardBar');
    const barTO = setTimeout(() => {
      if (bar) bar.style.width = '50%';
    }, 500);

    /* red button */
    const btn = document.getElementById('pushBtn');
    const press = () => btn && btn.classList.add('is-pressed');
    const release = () => btn && btn.classList.remove('is-pressed');
    const relEvents = ['pointerup', 'pointerleave', 'pointercancel'];
    const onClick = () => {
      press();
      setTimeout(release, 200);
      const d = document.getElementById('telecharger');
      if (d) d.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };
    const onKeyDown = (e) => {
      if (e.key === ' ' || e.key === 'Enter') press();
    };
    const onKeyUp = (e) => {
      if (e.key === ' ' || e.key === 'Enter') release();
    };
    if (btn) {
      btn.addEventListener('pointerdown', press);
      relEvents.forEach((ev) => btn.addEventListener(ev, release));
      btn.addEventListener('click', onClick);
      btn.addEventListener('keydown', onKeyDown);
      btn.addEventListener('keyup', onKeyUp);
    }

    /* decorative QR */
    const qr = document.getElementById('qrSvg');
    if (qr) {
      const cells = 21;
      const sz = 100 / cells;
      let out = '';
      let seed = 7;
      const finder = (x, y) =>
        '<rect x="' + x * sz + '" y="' + y * sz + '" width="' + 7 * sz + '" height="' + 7 * sz + '" fill="#17140f"/>' +
        '<rect x="' + (x + 1) * sz + '" y="' + (y + 1) * sz + '" width="' + 5 * sz + '" height="' + 5 * sz + '" fill="#f6f2ea"/>' +
        '<rect x="' + (x + 2) * sz + '" y="' + (y + 2) * sz + '" width="' + 3 * sz + '" height="' + 3 * sz + '" fill="#17140f"/>';
      for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
          const f = (x < 8 && y < 8) || (x > cells - 9 && y < 8) || (x < 8 && y > cells - 9);
          if (f) continue;
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          if ((seed >> 8) % 2 === 0)
            out += '<rect x="' + x * sz + '" y="' + y * sz + '" width="' + sz + '" height="' + sz + '" fill="#17140f"/>';
        }
      }
      qr.innerHTML = out + finder(0, 0) + finder(cells - 7, 0) + finder(0, cells - 7);
    }

    /* cleanup */
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (io) io.disconnect();
      clearInterval(timer);
      clearTimeout(barTO);
      if (btn) {
        btn.removeEventListener('pointerdown', press);
        relEvents.forEach((ev) => btn.removeEventListener(ev, release));
        btn.removeEventListener('click', onClick);
        btn.removeEventListener('keydown', onKeyDown);
        btn.removeEventListener('keyup', onKeyUp);
      }
    };
  }, []);

  return null;
}
