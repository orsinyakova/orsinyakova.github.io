(() => {
  const P = window.PROJECTS || {};
  const WORKS = window.WORKS || [];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = window.matchMedia('(max-width: 768px)');
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const thumbOf = (w) => w.thumb || w.src;

  // ---------- Сфера из работ ----------
  const sphere = document.querySelector('[data-sphere]');
  const drag = document.querySelector('[data-drag]');
  const cards = WORKS.slice(0, 42);
  const N = cards.length;
  const radius = () => (mqMobile.matches ? 260 : 420);
  const build = () => {
    const R = radius();
    const golden = Math.PI * (3 - Math.sqrt(5));
    sphere.innerHTML = cards.map((w, i) => {
      const y = 1 - (i / (N - 1)) * 2;            // от 1 до -1
      const lat = Math.asin(y) * 180 / Math.PI;     // широта
      const lon = (i * golden * 180 / Math.PI) % 360; // долгота
      return `<div class="about-card" style="transform: rotateY(${lon.toFixed(2)}deg) rotateX(${(-lat).toFixed(2)}deg) translateZ(${R}px)"><img src="${esc(thumbOf(w))}" alt="" decoding="async" draggable="false"></div>`;
    }).join('');
  };
  if (sphere && N) {
    build();
    let ax = -12, ay = 0, vx = 0, vy = reduce ? 0 : 0.06, dragging = false, lx = 0, ly = 0, running = true;
    const render = () => { sphere.style.transform = `rotateX(${ax}deg) rotateY(${ay}deg)`; };
    const loop = () => {
      if (!dragging) {
        ay += vy; ax += vx;
        // после броска плавно возвращаемся к медленному вращению
        vy += ((reduce ? 0 : 0.06) - vy) * 0.03;
        vx *= 0.95;
        ax = Math.max(-40, Math.min(40, ax));
      }
      render();
      if (running) requestAnimationFrame(loop);
    };
    render();
    if (!reduce) requestAnimationFrame(loop);
    // крутим только когда сфера видна
    new IntersectionObserver(([e]) => {
      const was = running; running = e.isIntersecting;
      if (running && !was && !reduce) requestAnimationFrame(loop);
    }).observe(drag);

    drag.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // на телефоне не мешаем прокрутке страницы
      dragging = true; lx = e.clientX; ly = e.clientY; vx = vy = 0;
      drag.setPointerCapture(e.pointerId); drag.classList.add('is-dragging');
    });
    drag.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      vy = dx * 0.25; vx = -dy * 0.2;
      ay += vy; ax = Math.max(-40, Math.min(40, ax + vx));
      if (reduce) render();
    });
    const up = () => { dragging = false; drag.classList.remove('is-dragging'); if (reduce) render(); };
    drag.addEventListener('pointerup', up);
    drag.addEventListener('pointercancel', up);
    let lastW = window.innerWidth;
    window.addEventListener('resize', () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; build(); } });
  }

  // ---------- Бегущая лента ----------
  const track = document.querySelector('[data-marquee]');
  if (track) {
    const list = WORKS.filter((w, i, a) => a.findIndex((x) => x.p === w.p) === i).concat(WORKS.slice(12, 20));
    const html = list.map((w) => `<div class="about-slide"><img src="${esc(thumbOf(w))}" alt="" loading="lazy" decoding="async"></div>`).join('');
    track.innerHTML = html + html; // дважды — для бесконечной прокрутки
  }

  // ---------- Клиенты ----------
  const CLIENTS = [
    ['kontur', 'Строительная компания «Контур»'],
    ['equicenter', 'Конная школа Equicenter'],
    ['pesduke', 'Груминг-салон PёsDuke'],
    ['kavkaz', 'Тур «Кавказ. Неделя»'],
    ['kolpa-school', 'Kolpa School'],
    ['chalavek-i-kon', 'Кафе «Чалавек и конь»'],
    ['cream-brew', 'Велоклуб Cream Brew'],
    ['team-of-power', 'Team of Power'],
  ].filter(([id]) => P[id]);
  const listEl = document.querySelector('[data-clients]');
  const stack = document.querySelector('[data-client-stack]');
  if (listEl && stack && CLIENTS.length) {
    const imgOf = (id) => {
      const p = P[id];
      const m = (p.case && p.media[p.case.cover]) || Object.values(p.media)[0];
      return m ? (m.type === 'video' ? m.thumb : m.thumb || m.src) : '';
    };
    const href = (id) => P[id].case ? `case.html?p=${encodeURIComponent(id)}` : `index.html?work=${encodeURIComponent(id + '-' + Object.keys(P[id].media)[0])}`;
    listEl.innerHTML = CLIENTS.map(([id, name], i) =>
      `<li><a class="about-client${i === 0 ? ' is-active' : ''}" href="${href(id)}" data-client="${esc(id)}">${esc(name).replace(/(^|\s)(\S{1,2}) /g, '$1$2&nbsp;')}</a></li>`).join('');
    stack.innerHTML = `<div class="about-stack-frame is-current"><img src="${esc(imgOf(CLIENTS[0][0]))}" alt=""></div>`;
    CLIENTS.forEach(([id]) => { const im = new Image(); im.src = imgOf(id); }); // заранее подгружаем
    let current = CLIENTS[0][0];
    const show = (id) => {
      if (id === current) return;
      current = id;
      listEl.querySelectorAll('.about-client').forEach((a) => a.classList.toggle('is-active', a.dataset.client === id));
      stack.querySelectorAll('.about-stack-frame').forEach((f) => { f.classList.remove('is-current'); f.classList.add('is-leaving'); setTimeout(() => f.remove(), 460); });
      const f = document.createElement('div');
      f.className = 'about-stack-frame is-entering';
      f.innerHTML = `<img src="${esc(imgOf(id))}" alt="">`;
      stack.append(f);
    };
    listEl.addEventListener('pointerover', (e) => { const a = e.target.closest('[data-client]'); if (a && e.pointerType === 'mouse') show(a.dataset.client); });
    listEl.addEventListener('focusin', (e) => { const a = e.target.closest('[data-client]'); if (a) show(a.dataset.client); });
  }
})();
