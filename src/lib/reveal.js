import { useEffect } from 'react';

// Scroll motion: any element with class "rv" fades/slides in when it enters the screen.
// Siblings inside a ".stagger" parent come in one after another.
// We mark revealed elements with a data attribute (not a class) so React re-renders
// that change className can never hide them again.
export function useReveal(deps = []) {
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = [...document.querySelectorAll('.rv:not([data-in])')];
    if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => { e.dataset.in = '1'; }); return; }
    els.forEach((el) => {
      const p = el.parentElement;
      if (p?.classList.contains('stagger')) el.style.transitionDelay = `${[...p.children].indexOf(el) * 70}ms`;
    });
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.dataset.in = '1'; io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    // Safety net: never leave anything invisible for long.
    const t = setTimeout(() => document.querySelectorAll('.rv:not([data-in])').forEach((e) => { e.dataset.in = '1'; }), 2500);
    return () => { io.disconnect(); clearTimeout(t); };
  }, deps);
}
