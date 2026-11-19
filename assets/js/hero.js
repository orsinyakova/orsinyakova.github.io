(() => {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const nameEl = hero.querySelector('[data-hero-name]');
  const strip = hero.querySelector('[data-hero-strip]');
  const intro = document.querySelector('[data-intro]');
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = window.matchMedia('(max-width: 768px)');
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  // ---------- Лента: моё видео + 4 работы из админки ----------
  const items = window.HERO || [];
  strip.innerHTML =
    `<div class="hero-frame" style="--i:0"><video src="assets/video/me.mp4" poster="assets/video/me-poster.jpg" muted loop playsinline ${reduce ? '' : 'autoplay'} aria-label="Оля Синякова, видео-селфи в горах"></video></div>` +
    items.map((w, i) => `<a class="hero-frame" style="--i:${i + 1}" href="?work=${encodeURIComponent(w.id)}" data-hero-work="${esc(w.id)}">
      <img src="${esc(w.type === 'video' ? w.thumb : w.thumb || w.src)}" alt="${esc(w.title)}" decoding="async">
      <span class="hero-frame-cap">${esc(w.title)}</span></a>`).join('');
  strip.addEventListener('click', (e) => {
    const a = e.target.closest('[data-hero-work]');
    if (!a || e.metaKey || e.ctrlKey || !window.openWork) return;
    e.preventDefault();
    window.openWork(a.dataset.heroWork);
  });

  // ---------- Часы ----------
  const clock = hero.querySelector('[data-clock]');
  const tick = () => {
    clock.textContent = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date());
  };
  tick(); setInterval(tick, 20000);

  // ---------- Имя: буквы в спанах и подгонка по ширине ----------
  nameEl.querySelectorAll('.hero-line').forEach((line) => {
    line.innerHTML = [...line.textContent].map((ch) => `<span class="hero-letter">${ch}</span>`).join('');
  });
  const letters = [...nameEl.querySelectorAll('.hero-letter')];
  const line2 = nameEl.querySelector('.hero-line--2');
  const fit = () => {
    nameEl.style.setProperty('--hero-size', '100px');
    const avail = nameEl.clientWidth - parseFloat(getComputedStyle(nameEl).paddingLeft) * 2;
    const w = line2.getBoundingClientRect().width;
    const byWidth = (avail / w) * 100;
    const byHeight = mqMobile.matches ? Infinity : window.innerHeight * 0.27;
    nameEl.style.setProperty('--hero-size', `${Math.floor(Math.min(byWidth, byHeight))}px`);
  };

  // ---------- Имя уезжает в логотип при прокрутке ----------
  const logo = () => [...document.querySelectorAll('.site-header .header-logo')].find((el) => el.offsetParent !== null);
  let base = null;
  const measure = () => {
    nameEl.style.transform = '';
    const n = nameEl.getBoundingClientRect();
    const l = logo().getBoundingClientRect();
    const firstLetter = letters[0].getBoundingClientRect();
    base = {
      // точка «О» в документе и куда она должна прийти (левый верх логотипа)
      x0: firstLetter.left, y0: firstLetter.top + window.scrollY,
      originX: n.left, originY: n.top + window.scrollY,
      tx: l.left, ty: l.top,
      scale: parseFloat(getComputedStyle(logo()).fontSize) / parseFloat(getComputedStyle(nameEl).fontSize) * 1.04,
      range: Math.max(260, n.height * 0.9),
    };
  };
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const header = document.querySelector('.site-header');
  let lastLogo = null, lastSolid = null, ticking = false;
  const setLogo = (v) => { if (v !== lastLogo) { lastLogo = v; header.style.setProperty('--logo-o', v); } };
  const update = () => {
    ticking = false;
    const solid = window.scrollY > 4;
    if (solid !== lastSolid) { lastSolid = solid; header.classList.toggle('is-solid', solid); }
    if (!base || !hero.classList.contains('is-revealed')) return;
    const s = window.scrollY;
    const p = Math.min(1, Math.max(0, s / base.range));
    const e = ease(p);
    if (reduce) {
      nameEl.style.opacity = String(1 - p);
      setLogo(p > 0.6 ? '1' : '0');
      return;
    }
    const sc = 1 + (base.scale - 1) * e;
    // где «О» окажется без трансформации на этом скролле
    const curX = base.x0, curY = base.y0 - s;
    const ox = base.originX, oy = base.originY - s;
    // позиция «О» после масштабирования от левого верха блока
    const scaledX = ox + (curX - ox) * sc, scaledY = oy + (curY - oy) * sc;
    const dx = (base.tx - scaledX) * e, dy = (base.ty - scaledY) * e;
    if (p >= 1) {
      // имя уже ушло — дальше ничего не трогаем, чтобы не грузить прокрутку
      if (nameEl.dataset.gone !== '1') { nameEl.dataset.gone = '1'; nameEl.style.opacity = '0'; nameEl.style.visibility = 'hidden'; }
      setLogo('1');
      return;
    }
    if (nameEl.dataset.gone === '1') { nameEl.dataset.gone = ''; nameEl.style.visibility = ''; }
    nameEl.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sc.toFixed(4)})`;
    nameEl.style.opacity = p < 0.82 ? '1' : String(Math.max(0, 1 - (p - 0.82) / 0.18));
    setLogo(p < 0.8 ? '0' : String(Math.min(1, (p - 0.8) / 0.2).toFixed(2)));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  // На телефоне при прокрутке прячется адресная строка и меняется высота окна —
  // пересчитываем имя только если поменялась ширина (поворот, изменение окна)
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW && mqMobile.matches) return;
    lastW = window.innerWidth;
    fit(); measure(); update();
  });

  const reveal = () => {
    hero.classList.add('is-revealed');
    fit(); measure(); update();
  };

  // ---------- Заставка: буквенная сетка → имя ----------
  const ABC = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯабвгдежзиклмнопрстуфхцчшэюя';
  const rnd = () => ABC[Math.floor(Math.random() * ABC.length)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const playIntro = async () => {
    root.classList.add('intro-lock');
    intro.classList.add('is-on');
    fit();
    const vw = window.innerWidth, vh = window.innerHeight;
    const cols = mqMobile.matches ? 6 : vw < 1100 ? 9 : 12;
    const cw = vw / cols;
    const rows = Math.ceil(vh / cw) + 1;
    const cellSize = Math.round(cw * 0.62);
    intro.style.setProperty('--cell-size', `${cellSize}px`);
    const grid = document.createElement('div');
    grid.className = 'intro-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, ${cw}px)`;
    grid.style.gridAutoRows = `${cw}px`;
    const total = cols * rows;
    const cells = Array.from({ length: total }, () => { const c = document.createElement('span'); c.className = 'intro-cell'; c.textContent = rnd(); grid.append(c); return c; });
    intro.append(grid);
    const skipHint = document.createElement('span');
    skipHint.className = 'intro-skip'; skipHint.textContent = 'Нажми, чтобы пропустить';
    intro.append(skipHint);

    // клетки для букв имени: по одной в каждом отрезке сетки, по порядку чтения
    const word = letters.map((l) => l.textContent);
    const visibleRows = Math.floor(vh / cw);
    const usable = cols * Math.max(1, visibleRows);
    const seg = usable / word.length;
    const targets = word.map((_, i) => Math.min(usable - 1, Math.floor(i * seg + Math.random() * Math.max(1, seg - 1))));

    let done = false;
    const finish = () => {
      if (done) return; done = true;
      clearInterval(scramble);
      intro.classList.remove('is-on');
      intro.innerHTML = '';
      root.classList.remove('intro-lock');
      try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
      reveal();
    };
    ['click', 'wheel', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, finish, { once: true, passive: true }));

    // 1. буквы перебираются
    const scramble = setInterval(() => {
      for (let k = 0; k < total / 6; k++) {
        const c = cells[Math.floor(Math.random() * total)];
        if (!c.dataset.lock) c.textContent = rnd();
      }
    }, 60);
    await wait(750); if (done) return;

    // 2. загораются буквы имени
    for (let i = 0; i < word.length; i++) {
      const c = cells[targets[i]];
      c.dataset.lock = '1'; c.textContent = word[i];
      c.animate([{ color: 'rgba(229,229,229,.2)', filter: 'blur(.4px)' }, { color: '#e5e5e5', filter: 'blur(0)' }], { duration: 220, fill: 'forwards' });
      await wait(45); if (done) return;
    }
    await wait(250); if (done) return;

    // 3. остальные гаснут
    clearInterval(scramble);
    cells.forEach((c) => { if (!c.dataset.lock) c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' }); });
    skipHint.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
    await wait(260); if (done) return;

    // 4. буквы слетаются в большое имя
    hero.classList.add('is-measuring');
    const heroSize = parseFloat(getComputedStyle(nameEl).fontSize);
    const flies = word.map((ch, i) => {
      const cell = cells[targets[i]];
      const from = cell.getBoundingClientRect();
      const to = letters[i].getBoundingClientRect();
      const s0 = cellSize / heroSize;
      const f = document.createElement('span');
      f.className = 'intro-fly'; f.textContent = ch;
      f.style.fontSize = `${heroSize}px`;
      intro.append(f);
      const fx = from.left + (from.width - to.width * s0) / 2, fy = from.top + (from.height - to.height * s0) / 2;
      cell.style.visibility = 'hidden';
      return f.animate([
        { transform: `translate(${fx}px, ${fy}px) scale(${s0})` },
        { transform: `translate(${to.left}px, ${to.top}px) scale(1)` },
      ], { duration: 720, delay: i * 25, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
    });
    intro.animate([{ backgroundColor: 'rgba(10,10,10,1)' }, { backgroundColor: 'rgba(10,10,10,0)' }], { duration: 500, delay: 450, fill: 'forwards' });
    await Promise.all(flies.map((a) => a.finished.catch(() => {})));
    if (done) return;
    finish();
  };

  const start = async () => {
    try { await document.fonts.ready; } catch (e) {}
    fit();
    let seen = false;
    try { seen = sessionStorage.getItem('introSeen') === '1'; } catch (e) {}
    const deep = new URLSearchParams(location.search).has('work');
    if (reduce || seen || deep || window.scrollY > 10) {
      if (reduce) hero.style.setProperty('--no-anim', '1');
      reveal();
      return;
    }
    playIntro();
  };
  start();
})();
