// Ilustrações vetoriais da campanha "Quem falta, faz falta" (cards e vídeo).
// Monta o SVG dentro dos elementos marcados, assim que o script carrega:
//   <div class="ill-seats" data-cols="7" data-rows="4" data-empty="17" data-light="1" data-fill="1"></div>
//     cadeiras ocupadas com uma vazia (data-empty, índices separados por vírgula);
//     data-fill="1" desenha a pessoa de volta (dourada) no lugar vazio, com data-fill-in para animar no vídeo
//   <div class="ill-flock" data-light="1"></div>   99 ovelhas + 1 afastada, com o caminho até ela
(function () {
  const NAVY = '#0a1f44', GOLD = '#c9a227', CREAM = '#f7f3ea';
  // pseudoaleatório fixo para o resultado ser sempre igual
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

  function seats(el) {
    const cols = +el.dataset.cols || 7, rows = +el.dataset.rows || 4;
    const empty = (el.dataset.empty || '').split(',').filter(Boolean).map(Number);
    const light = !!el.dataset.light;
    const ink = light ? NAVY : CREAM;
    const back = light ? 'rgba(10,31,68,.07)' : 'rgba(255,255,255,.07)';
    const backStroke = light ? 'rgba(10,31,68,.16)' : 'rgba(255,255,255,.16)';
    const W = 100, H = 112;
    let s = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = c * W + (r % 2 ? W * 0.18 : 0), y = r * H;
        const isEmpty = empty.includes(i);
        s += `<g transform="translate(${x},${y})">`;
        if (isEmpty) {
          s += `<circle cx="50" cy="56" r="56" fill="${GOLD}" opacity=".16"/>`;
          s += `<g fill="none" stroke="${GOLD}" stroke-width="3" stroke-dasharray="7 7" opacity=".7"><circle cx="50" cy="30" r="15"/><path d="M22 80 Q22 50 50 50 Q78 50 78 80"/></g>`;
          if (el.dataset.fill) {
            s += `<g ${el.dataset.fillIn ? `data-in="${el.dataset.fillIn}" data-anim="up" data-dur="0.8"` : ''}>`
              + `<circle cx="50" cy="30" r="15" fill="${GOLD}"/><path d="M22 80 Q22 50 50 50 Q78 50 78 80 Z" fill="${GOLD}"/></g>`;
          }
          s += `<rect x="10" y="62" width="80" height="44" rx="14" fill="rgba(201,162,39,.18)" stroke="${GOLD}" stroke-width="3.5"/>`;
        } else {
          const op = (0.55 + rnd(i) * 0.35).toFixed(2);
          const hy = 28 + rnd(i + 99) * 5;
          s += `<g fill="${ink}" opacity="${op}"><circle cx="50" cy="${hy}" r="14"/><path d="M23 80 Q23 ${hy + 20} 50 ${hy + 20} Q77 ${hy + 20} 77 80 Z"/></g>`;
          s += `<rect x="10" y="62" width="80" height="44" rx="14" fill="${back}" stroke="${backStroke}" stroke-width="2"/>`;
        }
        s += '</g>';
      }
    }
    const vw = cols * W + W * 0.18, vh = rows * H;
    el.innerHTML = `<svg viewBox="-4 -8 ${vw + 8} ${vh + 12}" width="100%" style="display:block;overflow:visible">${s}</svg>`;
  }

  function sheep(x, y, k, fill, extra = '') {
    return `<g transform="translate(${x},${y}) scale(${k})" ${extra}>`
      + `<path d="M16 25v6M27 25v6" stroke="${fill}" stroke-width="2.6" stroke-linecap="round"/>`
      + `<ellipse cx="22" cy="18" rx="13" ry="9.5" fill="${fill}"/>`
      + `<circle cx="9" cy="15" r="5.2" fill="${fill}"/>`
      + `<circle cx="7.4" cy="14.2" r="1.2" fill="${NAVY}"/></g>`;
  }

  function flock(el) {
    const light = !!el.dataset.light;
    const ink = light ? NAVY : CREAM;
    let s = '';
    const cols = 11, rows = 9;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = c * 46 + (r % 2 ? 23 : 0) + (rnd(i) - 0.5) * 10;
        const y = r * 40 + (rnd(i + 7) - 0.5) * 8;
        const op = (0.45 + rnd(i + 3) * 0.4).toFixed(2);
        s += sheep(x, y, 1, ink, `opacity="${op}"`);
      }
    }
    // a centésima: afastada, dourada, com o caminho tracejado até ela
    const lx = 690, ly = 300;
    // classes stray-path / stray: o vídeo das 99 anima a ovelha se afastando e voltando
    s += `<path class="stray-path" d="M540 170 C 610 170, 640 250, ${lx + 10} ${ly + 8}" fill="none" stroke="${GOLD}" stroke-width="3" stroke-dasharray="8 9" stroke-linecap="round"/>`;
    s += `<g class="stray">`;
    s += `<circle cx="${lx + 30}" cy="${ly + 22}" r="54" fill="${GOLD}" opacity=".18"/>`;
    s += `<circle cx="${lx + 30}" cy="${ly + 22}" r="54" fill="none" stroke="${GOLD}" stroke-width="2.5"/>`;
    s += sheep(lx, ly, 1.45, GOLD);
    s += '</g>';
    el.innerHTML = `<svg viewBox="-12 -16 812 420" width="100%" style="display:block;overflow:visible">${s}</svg>`;
  }

  document.querySelectorAll('.ill-seats').forEach(seats);
  document.querySelectorAll('.ill-flock').forEach(flock);
})();
