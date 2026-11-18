(() => {
  const P = window.PROJECTS || {};
  const ORDER = (window.PROJECT_ORDER || Object.keys(P)).filter((id) => P[id] && P[id].case);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const paras = (t) => String(t || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initial = (t) => (String(t || '').replace(/[«»"'\s]/g, '')[0] || '•').toUpperCase();
  const darkText = (hex) => {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || ''); if (!m) return false;
    const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
  };
  const mediaTag = (m, cls = '', opts = '') => !m ? '' : m.type === 'video'
    ? `<video class="${cls}" src="${esc(m.src)}" poster="${esc(m.thumb)}" muted loop playsinline ${reduce ? '' : 'autoplay'} ${opts}></video>`
    : `<img class="${cls}" src="${esc(m.src)}" alt="" width="${m.w}" height="${m.h}" ${opts}>`;
  const brand = (p) => `<span class="brand-mark" style="background:${esc(p.brandColor || '#2a2a2a')};color:${darkText(p.brandColor) ? '#0a0a0a' : '#e5e5e5'}" aria-hidden="true">${esc(initial(p.client || p.title))}</span>`;

  // ---------- Список кейсов ----------
  const grid = document.querySelector('[data-cases]');
  if (grid) {
    if (!ORDER.length) grid.innerHTML = '<p class="masonry-empty">Кейсы скоро появятся.</p>';
    grid.innerHTML = ORDER.map((id) => {
      const p = P[id]; const c = p.case;
      const ids = [c.cover, ...c.blocks.flatMap((b) => b.items || [])].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 5);
      const slides = ids.map((mid) => p.media[mid]).filter(Boolean);
      return `<article class="case-card">
        <a class="case-cover-link" href="case.html?p=${encodeURIComponent(id)}" aria-label="${esc(p.title)}">
          <div class="case-slides" data-slides="${slides.length}">
            ${slides.map((m, i) => `<div class="case-slide${i === 0 ? ' is-active' : ''}"><img src="${esc(m.type === 'video' ? m.thumb : (m.thumb || m.src))}" alt="" loading="lazy" decoding="async"></div>`).join('')}
            ${slides.length > 1 ? `<div class="case-ind" aria-hidden="true">${slides.map((_, i) => `<span class="${i === 0 ? 'is-active' : ''}"></span>`).join('')}</div>` : ''}
          </div>
        </a>
        <a class="case-meta" href="case.html?p=${encodeURIComponent(id)}">${brand(p)}
          <span class="case-meta-text"><span class="case-meta-title">${esc(p.title)}</span><span class="case-meta-client">${esc(p.client)}</span></span></a>
      </article>`;
    }).join('') || grid.innerHTML;

    // Наведение: позиция мыши выбирает картинку, как у референса
    grid.querySelectorAll('.case-slides').forEach((box) => {
      const n = +box.dataset.slides; if (n < 2) return;
      const slides = box.querySelectorAll('.case-slide');
      const dots = box.querySelectorAll('.case-ind span');
      const show = (k) => { slides.forEach((s, i) => s.classList.toggle('is-active', i === k)); dots.forEach((d, i) => d.classList.toggle('is-active', i === k)); };
      box.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = box.getBoundingClientRect();
        show(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
      });
      box.addEventListener('pointerleave', () => show(0));
    });
  }

  // ---------- Страница кейса ----------
  const root = document.querySelector('[data-case]');
  if (root) {
    const id = new URLSearchParams(location.search).get('p');
    const p = P[id];
    if (!p || !p.case) {
      root.innerHTML = `<div class="case-missing"><p class="display-title">Кейс не&nbsp;найден</p><a class="animated-underline animated-underline-active" href="cases.html">Все кейсы</a></div>`;
      return;
    }
    const c = p.case;
    document.title = `${p.title.replace(/ /g, ' ')} — Оля Синякова`;
    const cover = p.media[c.cover] || Object.values(p.media)[0];
    const field = (label, value) => value ? `<div class="case-field"><p class="caption meta-label-like">${label}</p><div class="case-field-value">${value}</div></div>` : '';
    const services = (p.services || []).map((s) => `<span>${esc(s)}</span>`).join('');
    const meta = `
      <div class="case-meta-row">${field('Клиент', esc(p.client))}${field('Что сделала', services)}</div>
      ${p.year || p.site ? `<div class="case-meta-row">${field('Год', esc(p.year))}${field('Сайт', p.site ? `<a class="animated-underline" href="${esc(p.site)}" target="_blank" rel="noreferrer">${esc(p.site.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : '')}</div>` : ''}`;
    const lead = paras(c.lead).map((t) => `<p class="case-lead-p">${esc(t)}</p>`).join('');

    const blocks = c.blocks.map((b) => {
      if (b.type === 'text') {
        if (!b.title && !b.text) return '';
        return `<section class="case-text layout-grid-3"><div class="case-text-inner">
          ${b.title ? `<h2 class="case-text-title">${esc(b.title)}</h2>` : ''}
          ${paras(b.text).map((t) => `<p class="case-text-p">${esc(t)}</p>`).join('')}</div></section>`;
      }
      const items = (b.items || []).map((mid) => p.media[mid]).filter(Boolean);
      if (!items.length) return '';
      return `<div class="case-row" style="--cols:${Math.min(b.cols || 1, items.length)}">${items.map((m) =>
        `<figure class="case-fig">${mediaTag(m, 'case-media', 'loading="lazy"')}</figure>`).join('')}</div>`;
    }).join('');

    const idx = ORDER.indexOf(id);
    const nextId = ORDER[(idx + 1) % ORDER.length];
    const next = nextId && nextId !== id ? P[nextId] : null;

    root.innerHTML = `
      <div class="case-cover" aria-hidden="true">${mediaTag(cover, 'case-cover-media')}</div>
      <section class="case-info">
        <div class="case-info-grid layout-grid-3">
          <h1 class="case-title">${esc(p.title)}</h1>
          <div class="case-meta-grid">${meta}</div>
          <div class="case-lead">${lead}</div>
        </div>
      </section>
      <div class="case-content">${blocks}</div>
      ${next ? `<nav class="case-next" aria-label="Следующий кейс">
        <div class="separator"></div>
        <div class="layout-grid-3 case-next-inner">
          <p class="caption">Следующий кейс</p>
          <div class="case-next-content">
            <a class="case-next-title interactive-opacity" href="case.html?p=${encodeURIComponent(nextId)}">${esc(next.title)}</a>
            <a class="animated-underline" href="case.html?p=${encodeURIComponent(nextId)}">Смотреть кейс</a>
          </div>
        </div>
      </nav>` : ''}`;
  }
})();
