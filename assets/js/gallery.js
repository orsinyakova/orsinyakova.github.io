(() => {
  const PROJECTS = window.PROJECTS || {};
  const WORKS = (window.WORKS || []).map((w) => ({
    ...w,
    id: w.id || w.src.split('/').pop().replace(/\.[a-z0-9]+$/i, ''),
  }));

  // Категории приходят из админки; «Все» всегда первая
  const CAT_LIST = [['all', 'Все'], ...(window.CATEGORIES || []).map((c) => [c.key, c.label])];
  const CATEGORIES = [CAT_LIST.slice(0, 4), CAT_LIST.slice(4)].filter((c) => c.length);

  const mqMobile = window.matchMedia('(max-width: 768px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Сетка по умолчанию: 3 колонки для всех категорий
  const defaultCols = () => 3;
  const state = {
    cat: 'all',
    cols: defaultCols('all'),
  };

  const masonry = document.querySelector('[data-masonry]');
  if (!masonry) return;

  // ---------- Категории ----------
  const renderCategories = () => {
    document.querySelectorAll('[data-categories]').forEach((root) => {
      root.innerHTML = CATEGORIES.map((col) =>
        `<ul class="cat-list">${col.map(([key, label]) =>
          `<li><button type="button" class="cat-item" data-cat="${key}" aria-pressed="${key === state.cat}"><span class="cat-bullet" aria-hidden="true"></span>${label}</button></li>`
        ).join('')}</ul>`
      ).join('');
    });
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.cat-item');
    if (!b || b.dataset.cat === state.cat) return;
    state.cat = b.dataset.cat;
    state.cols = defaultCols(state.cat);
    document.querySelectorAll('.cat-item').forEach((el) =>
      el.setAttribute('aria-pressed', String(el.dataset.cat === state.cat)));
    syncGridButtons();
    renderGrid();
  });

  // ---------- Переключатель колонок ----------
  const gridButtons = [...document.querySelectorAll('.grid-options button')];
  const syncGridButtons = () => gridButtons.forEach((b) =>
    b.setAttribute('aria-pressed', String(+b.dataset.cols === state.cols)));
  gridButtons.forEach((b) => b.addEventListener('click', () => {
    state.cols = +b.dataset.cols;
    syncGridButtons();
    renderGrid();
  }));

  // ---------- Сетка ----------
  // Порядок из админки: сначала расставленные вручную, остальные — следом по умолчанию
  const ORDER = window.GALLERY_ORDER || {};
  const filtered = () => {
    const list = WORKS.filter((w) => state.cat === 'all' || (PROJECTS[w.p]?.cats || []).includes(state.cat));
    const order = ORDER[state.cat];
    if (!order) return list;
    const pos = new Map(order.map((id, i) => [id, i]));
    return list
      .map((w, i) => ({ w, k: pos.has(w.id) ? pos.get(w.id) : order.length + i }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.w);
  };

  const currentCols = () => (mqMobile.matches ? 2 : state.cols);

  const cardHTML = (w) => {
    const title = PROJECTS[w.p]?.title || '';
    const ratio = `${w.w} / ${w.h}`;
    const media = w.type === 'video'
      ? `<video muted loop playsinline preload="none" poster="${w.thumb}" data-src="${w.src}" aria-hidden="true"></video>
         <img src="${w.thumb}" alt="" loading="lazy" decoding="async">
         <span class="card-badge" aria-hidden="true"><svg width="8" height="10" viewBox="0 0 8 10"><path d="M0 0l8 5-8 5z" fill="#e5e5e5"/></svg></span>`
      : `<img src="${w.thumb}" alt="${title.replace(/"/g, '&quot;')}" loading="lazy" decoding="async">`;
    return `<article class="card"><a class="card-link" href="?work=${w.id}" data-work="${w.id}" aria-label="${title.replace(/"/g, '&quot;')}">
      <span class="frame" style="aspect-ratio:${ratio}">${media}</span></a></article>`;
  };

  let io;
  const renderGrid = () => {
    const list = filtered();
    const n = currentCols();
    if (!list.length) {
      masonry.innerHTML = '<p class="masonry-empty">Здесь пока пусто.</p>';
      return;
    }
    // Раскладываем по самой короткой колонке
    const cols = Array.from({ length: n }, () => ({ h: 0, items: [] }));
    list.forEach((w) => {
      const c = cols.reduce((a, b) => (b.h < a.h ? b : a));
      c.items.push(w);
      c.h += w.h / w.w + 0.05;
    });
    masonry.innerHTML = cols.map((c) =>
      `<div class="masonry-col">${c.items.map(cardHTML).join('')}</div>`).join('');

    // Плавное появление картинок
    masonry.querySelectorAll('.frame').forEach((f) => {
      const img = f.querySelector('img');
      const done = () => f.classList.add('is-loaded');
      if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });

    // Видео играют, пока видны на экране
    if (io) io.disconnect();
    if (!reduceMotion && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
        if (isIntersecting) {
          if (!v.src) v.src = v.dataset.src;
          v.play().then(() => v.nextElementSibling && (v.nextElementSibling.style.display = 'none')).catch(() => {});
        } else {
          v.pause();
        }
      }), { rootMargin: '200px 0px' });
      masonry.querySelectorAll('video').forEach((v) => io.observe(v));
    }
  };

  // ---------- Просмотр работы ----------
  const viewer = document.getElementById('viewer');
  const stage = viewer.querySelector('[data-stage]');
  const panel = viewer.querySelector('[data-panel]');
  const relatedMobile = viewer.querySelector('[data-related-mobile]');
  const backBtn = viewer.querySelector('.viewer-back');
  const expandBtn = viewer.querySelector('.viewer-expand');
  let openId = null;
  let lastFocus = null;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const relatedHTML = (w) => {
    const items = WORKS.filter((x) => x.p === w.p);
    if (items.length < 2) return '';
    return `<div class="related"><p class="caption meta-label-like">Ещё в проекте</p>
      <div class="related-row"><ul class="related-list">${items.map((x) =>
        `<li><button type="button" class="related-thumb" data-goto="${x.id}" aria-current="${x.id === w.id}" aria-label="Изображение ${items.indexOf(x) + 1} из ${items.length}"><img src="${x.thumb}" alt="" loading="lazy"></button></li>`
      ).join('')}</ul></div></div>`;
  };

  const panelHTML = (w) => {
    const p = PROJECTS[w.p] || {};
    const services = (p.services || []).map((s) => `<span>${esc(s)}</span>`).join('');
    return `
      <div class="panel-head">
        <p class="caption meta-label-like">Проект</p>
        <h2 class="panel-title" id="viewer-title">${esc(p.title || '')}</h2>
        <div class="panel-desc-block">
          <p class="panel-desc is-clamped">${esc(p.text || '')}</p>
          <button type="button" class="desc-toggle" aria-expanded="false" hidden>Читать дальше<span class="desc-chevron" aria-hidden="true"></span></button>
        </div>
        ${(p.case || p.site) ? '<div class="panel-buttons">' : ''}
        ${p.case ? `<a class="panel-button" href="case.html?p=${encodeURIComponent(w.p)}">Полный кейс
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></a>` : ''}
        ${p.site ? `<a class="panel-button${p.case ? ' panel-button--ghost' : ''}" href="${esc(p.site)}" target="_blank" rel="noreferrer">Смотреть сайт
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4 10l6-6M5 4h5v5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></a>` : ''}
        ${(p.case || p.site) ? '</div>' : ''}
      </div>
      ${relatedHTML(w)}
      <div class="panel-meta">
        ${p.client ? `<div class="meta-sep"></div><div class="meta-row"><span class="meta-label">Клиент</span><span class="meta-value">${esc(p.client)}</span></div>` : ''}
        ${services ? `<div class="meta-sep"></div><div class="meta-row"><span class="meta-label">Что сделала</span><span class="meta-value">${services}</span></div>` : ''}
        ${p.year ? `<div class="meta-sep"></div><div class="meta-row"><span class="meta-label">Год</span><span class="meta-value">${esc(p.year)}</span></div>` : ''}
      </div>`;
  };

  const stageHTML = (w) => w.type === 'video'
    ? `<div class="viewer-frame" style="aspect-ratio:${w.w}/${w.h}"><video src="${w.src}" poster="${w.thumb}" muted loop playsinline autoplay controls></video></div>`
    : `<div class="viewer-frame"><img src="${w.src}" alt="${esc(PROJECTS[w.p]?.title || '')}" width="${w.w}" height="${w.h}"></div>`;

  const fillViewer = (w) => {
    stage.innerHTML = stageHTML(w);
    panel.innerHTML = panelHTML(w);
    relatedMobile.innerHTML = relatedHTML(w);
    document.title = `${(PROJECTS[w.p]?.title || '').replace(/ /g, ' ')} — Оля Синякова`;
    const desc = panel.querySelector('.panel-desc');
    const toggle = panel.querySelector('.desc-toggle');
    requestAnimationFrame(() => {
      if (desc.scrollHeight > desc.clientHeight + 2) toggle.hidden = false;
      else desc.classList.remove('is-clamped');
    });
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      desc.classList.toggle('is-clamped', !open);
      toggle.firstChild.textContent = open ? 'Свернуть' : 'Читать дальше';
    });
    viewer.scrollTop = 0;
  };

  const open = (id, push = true) => {
    const w = WORKS.find((x) => x.id === id);
    if (!w) return;
    if (!openId) lastFocus = document.activeElement;
    openId = id;
    fillViewer(w);
    viewer.hidden = false;
    document.body.classList.add('viewer-open');
    if (push) history.pushState({ work: id }, '', `?work=${id}`);
    backBtn.focus({ preventScroll: true });
  };

  const close = (push = true) => {
    if (!openId) return;
    openId = null;
    viewer.hidden = true;
    viewer.classList.remove('is-expanded');
    expandBtn.setAttribute('aria-pressed', 'false');
    stage.innerHTML = '';
    document.body.classList.remove('viewer-open');
    document.title = 'Оля Синякова — портфолио';
    if (push) history.pushState({}, '', location.pathname);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  };

  const step = (dir) => {
    const list = filtered();
    const i = list.findIndex((x) => x.id === openId);
    if (i < 0) return;
    const next = list[(i + dir + list.length) % list.length];
    open(next.id, false);
    history.replaceState({ work: next.id }, '', `?work=${next.id}`);
  };

  const toggleExpand = () => {
    if (mqMobile.matches) return;
    const on = !viewer.classList.contains('is-expanded');
    viewer.classList.toggle('is-expanded', on);
    expandBtn.setAttribute('aria-pressed', String(on));
    expandBtn.setAttribute('aria-label', on ? 'Свернуть изображение' : 'Развернуть изображение');
  };

  masonry.addEventListener('click', (e) => {
    const a = e.target.closest('[data-work]');
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    open(a.dataset.work);
  });
  viewer.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) {
      open(g.dataset.goto, false);
      history.replaceState({ work: g.dataset.goto }, '', `?work=${g.dataset.goto}`);
      return;
    }
    if (e.target.closest('.viewer-frame img')) toggleExpand();
  });
  backBtn.addEventListener('click', () => close());
  expandBtn.addEventListener('click', toggleExpand);
  document.addEventListener('keydown', (e) => {
    if (!openId) return;
    if (e.key === 'Escape') {
      if (viewer.classList.contains('is-expanded')) toggleExpand(); else close();
    } else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });
  // Свайп на телефоне
  let tx = null;
  stage.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    tx = null;
  });
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('work');
    if (id) open(id, false); else close(false);
  });

  window.openWork = (id) => open(id);

  // ---------- Старт ----------
  renderCategories();
  syncGridButtons();
  renderGrid();
  mqMobile.addEventListener('change', renderGrid);
  const initial = new URLSearchParams(location.search).get('work');
  if (initial) open(initial, false);
})();
