// Motor de animação quadro a quadro para os vídeos do PastorIA.
// O render-videos.js chama setup(timeline) uma vez e depois render(t) para cada quadro,
// então o resultado é determinístico (sem depender do relógio do navegador).
//
// Marcação no HTML:
//   <div class="scene" data-from="seg1" data-to="seg3">   visível do início de seg1 ao fim de seg3
//   <el data-in="seg2+0.4" data-anim="up|fade|pop|left" data-dur="0.6" data-out="seg3+1">
//   <el class="typing" data-in=".." data-out="..">       pontinhos de "digitando…" animados
//   window.onFrame = (t, at) => {…}                       animação própria da página (at('seg+1') → segundos)
(function () {
  let T = {}; // { segKey: { start, end } }
  const FADE = 0.45;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (p) => 1 - Math.pow(1 - p, 3);

  function at(expr) {
    if (expr == null || expr === '') return null;
    const m = String(expr).match(/^([a-z0-9_]+)(?::(end))?\s*([+-]\s*[\d.]+)?$/i);
    if (!m) return parseFloat(expr);
    const seg = T[m[1]];
    if (!seg) throw new Error('segmento desconhecido: ' + m[1]);
    return (m[2] === 'end' ? seg.end : seg.start) + (m[3] ? parseFloat(m[3].replace(/\s/g, '')) : 0);
  }

  window.setup = (timeline) => { T = timeline; };

  window.render = (t) => {
    document.querySelectorAll('.scene').forEach((sc) => {
      const a = at(sc.dataset.from);
      const b = at((sc.dataset.to || sc.dataset.from) + ':end');
      const first = sc.dataset.from === Object.keys(T)[0];
      const op = clamp(first ? 1 : (t - a) / FADE) * clamp((b - t) / FADE + (sc.dataset.hold ? 99 : 0));
      sc.style.opacity = op;
      sc.style.visibility = op > 0.001 ? 'visible' : 'hidden';
      // leve zoom contínuo para a cena "respirar"
      const k = sc.querySelector('.zoom');
      if (k) k.style.transform = `scale(${1 + 0.035 * clamp((t - a) / Math.max(1, b - a))})`;
    });

    document.querySelectorAll('[data-in]').forEach((el) => {
      const tin = at(el.dataset.in);
      const dur = parseFloat(el.dataset.dur || '0.6');
      let p = ease(clamp((t - tin) / dur));
      if (el.dataset.out) p *= 1 - ease(clamp((t - at(el.dataset.out)) / 0.35));
      const anim = el.dataset.anim || 'up';
      const tr = anim === 'up' ? `translateY(${(1 - p) * 50}px)`
        : anim === 'left' ? `translateX(${(1 - p) * -60}px)`
        : anim === 'pop' ? `scale(${0.8 + 0.2 * p})`
        : '';
      el.style.opacity = p;
      el.style.transform = tr;
      el.style.display = el.dataset.collapse && p === 0 ? 'none' : '';
    });

    document.querySelectorAll('.typing i').forEach((d, i) => {
      d.style.transform = `translateY(${Math.sin(t * 9 - i * 0.9) * 5}px)`;
    });

    document.querySelectorAll('.glow').forEach((g, i) => {
      g.style.translate = `${Math.sin(t * 0.35 + i) * 40}px ${Math.cos(t * 0.3 + i) * 30}px`;
    });

    // animação própria da página (ex.: ovelha que se afasta e volta), com o mesmo relógio
    if (typeof window.onFrame === 'function') window.onFrame(t, at);

    // barra de progresso das contas (opcional)
    document.querySelectorAll('[data-count-to]').forEach((el) => {
      const a = at(el.dataset.countFrom);
      const p = ease(clamp((t - a) / 1.2));
      el.textContent = Math.round(p * parseFloat(el.dataset.countTo));
    });
  };
})();
