import { useEffect } from 'react';

// Scroll motion: any element with class "rv" fades/slides in when it enters the screen.
// Siblings inside a ".stagger" parent come in one after another.
export function useReveal(deps = []) {
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = [...document.querySelectorAll('.rv:not(.in)')];
    if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    els.forEach((el) => {
      const p = el.parentElement;
      if (p?.classList.contains('stagger')) el.style.transitionDelay = `${[...p.children].indexOf(el) * 70}ms`;
    });
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, deps);
}
