(() => {
  // ----- Контакты (десктоп) -----
  const btn = document.querySelector('.contacts-button');
  const dd = document.getElementById('contacts-dropdown');
  if (btn && dd) {
    const set = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      dd.classList.toggle('is-open', open);
      document.body.classList.toggle('contacts-open', open);
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      set(btn.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', (e) => {
      if (!dd.contains(e.target)) set(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dd.classList.contains('is-open')) { set(false); btn.focus(); }
    });
  }

  // ----- Мобильное меню -----
  const mBtn = document.querySelector('.menu-button');
  const overlay = document.getElementById('mobile-menu');
  if (mBtn && overlay) {
    const label = mBtn.querySelector('span');
    const set = (open) => {
      mBtn.setAttribute('aria-expanded', String(open));
      overlay.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      label.textContent = open ? 'Закрыть' : 'Меню';
      updateFloat();
    };
    mBtn.addEventListener('click', () => set(mBtn.getAttribute('aria-expanded') !== 'true'));
    overlay.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) { set(false); mBtn.focus(); }
    });

    // Кнопка «Меню» остаётся на экране при прокрутке
    const updateFloat = () => {
      const open = overlay.classList.contains('is-open');
      mBtn.classList.toggle('is-floating', open || window.scrollY > 15);
    };
    window.addEventListener('scroll', updateFloat, { passive: true });
    updateFloat();
  }

  // ----- Видео: без автоплея при «уменьшить движение» -----
  const v = document.querySelector('.header-video-media');
  if (v && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    v.removeAttribute('autoplay');
    v.pause();
  }
})();
