import { useEffect, useRef } from 'react';

// Adiciona `is-visible` quando o elemento entra na viewport (uma vez).
// Par da classe `.reveal` em index.css. Sem IntersectionObserver, mostra direto.
// Threshold baixo: blocos altos (grade de planos no celular) também disparam.
export default function useReveal({ threshold = 0.05, rootMargin = '0px 0px -40px 0px' } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold, rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}
