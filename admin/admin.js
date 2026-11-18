(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const TR = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  const slugify = (s) => [...String(s).toLowerCase()].map((c) => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const url = (p) => '/' + p;

  const S = { data: null, current: null, tab: 'main', dirty: false, saving: false, uploading: 0 };
  const list = $('[data-project-list]');
  const editor = $('[data-editor]');
  const saveBtn = $('[data-action="save"]');
  const saveState = $('[data-save-state]');

  const project = () => S.data.projects.find((p) => p.id === S.current);
  const mediaById = (p, id) => p.media.find((m) => m.id === id);

  // ---------- уведомления и статус ----------
  const toast = (msg, err = false) => {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' is-error' : '');
    t.textContent = msg;
    $('[data-toasts]').append(t);
    setTimeout(() => t.remove(), err ? 7000 : 3200);
  };
  const setDirty = (v = true) => {
    S.dirty = v;
    saveBtn.disabled = !v || S.saving;
    saveState.className = 'save-state' + (v ? ' is-dirty' : '');
    saveState.textContent = v ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
  };
  window.addEventListener('beforeunload', (e) => { if (S.dirty || S.uploading) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- API ----------
  const api = async (method, path, body, headers = {}) => {
    const r = await fetch(path, { method, body, headers });
    const j = await r.json().catch(() => ({ ok: false, message: `Ошибка сервера (${r.status})` }));
    if (!r.ok || j.ok === false) throw new Error(j.message || 'Ошибка');
    return j;
  };
  const save = async () => {
    if (S.saving) return;
    S.saving = true; saveBtn.disabled = true;
    saveState.textContent = 'Сохраняю…';
    try {
      const j = await api('PUT', '/api/data', JSON.stringify(S.data), { 'Content-Type': 'application/json' });
      setDirty(false);
      toast(j.trashed ? `Сохранено. Неиспользуемые файлы (${j.trashed}) перенесены в папку _trash` : 'Сохранено, сайт обновлён');
    } catch (e) {
      saveState.className = 'save-state is-error';
      saveState.textContent = 'Не сохранилось';
      toast(e.message, true);
      saveBtn.disabled = false;
    } finally { S.saving = false; }
  };
  saveBtn.addEventListener('click', save);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (S.dirty) save(); }
  });
  $('[data-action="publish"]').addEventListener('click', async (e) => {
    if (S.dirty) await save();
    if (S.dirty) return;
    e.target.disabled = true;
    try { const j = await api('POST', '/api/publish'); toast(j.message); }
    catch (err) { toast(err.message, true); }
    finally { e.target.disabled = false; }
  });

  // ---------- список проектов ----------
  const coverThumb = (p) => {
    const c = p.case?.cover && mediaById(p, p.case.cover);
    return (c || p.media[0])?.thumb;
  };
  const renderList = () => {
    list.innerHTML = S.data.projects.map((p) => {
      const th = coverThumb(p);
      const nf = p.media.length, plural = nf % 10 === 1 && nf % 100 !== 11 ? 'файл' : (nf % 10 >= 2 && nf % 10 <= 4 && (nf % 100 < 10 || nf % 100 >= 20) ? 'файла' : 'файлов');
      const meta = [nf ? `${nf} ${plural}` : 'нет файлов', p.case?.enabled ? 'кейс' : '', p.visible === false ? 'скрыт' : ''].filter(Boolean).join(' · ');
      return `<li class="project-item${p.id === S.current && S.view !== 'gallery' ? ' is-active' : ''}${p.visible === false ? ' is-hidden' : ''}" draggable="true" data-id="${esc(p.id)}">
        ${th ? `<img class="pi-thumb" src="${esc(url(th))}" alt="">` : '<span class="pi-thumb"></span>'}
        <span class="pi-text"><span class="pi-title">${esc(p.title || 'Без названия')}</span><span class="pi-meta">${esc(meta)}</span></span></li>`;
    }).join('');
  };
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.project-item');
    if (li) select(li.dataset.id);
  });
  // перетаскивание проектов
  let dragId = null;
  list.addEventListener('dragstart', (e) => { const li = e.target.closest('.project-item'); dragId = li?.dataset.id; li?.classList.add('dragging'); });
  list.addEventListener('dragend', () => { dragId = null; renderList(); });
  list.addEventListener('dragover', (e) => {
    const li = e.target.closest('.project-item'); if (!li || !dragId) return;
    e.preventDefault();
    list.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over'));
    li.classList.add('drag-over');
  });
  list.addEventListener('drop', (e) => {
    const li = e.target.closest('.project-item'); if (!li || !dragId || li.dataset.id === dragId) return;
    e.preventDefault();
    const arr = S.data.projects;
    const from = arr.findIndex((p) => p.id === dragId);
    const [moved] = arr.splice(from, 1);
    arr.splice(arr.findIndex((p) => p.id === li.dataset.id), 0, moved);
    setDirty(); renderList();
  });

  $('[data-action="new-project"]').addEventListener('click', () => {
    let base = 'novyy-proekt', id = base, i = 2;
    while (S.data.projects.some((p) => p.id === id)) id = `${base}-${i++}`;
    S.data.projects.unshift({
      id, title: 'Новый проект', client: '', year: '', cats: [], services: [], text: '', site: '', visible: false,
      brandColor: '#2a2a2a', media: [], case: { enabled: false, cover: null, lead: '', blocks: [] },
    });
    S.autoId = id;
    setDirty(); S.tab = 'main'; select(id);
    S.autoId = id;
    toast('Проект создан. Он скрыт с сайта, пока ты не включишь «Показывать на сайте»');
    setTimeout(() => $('[data-f="title"]')?.select(), 50);
  });

  const select = (id) => { if (id !== S.current) S.autoId = null; S.view = 'project'; S.current = id; renderList(); renderEditor(); };

  // ---------- редактор ----------
  const renderEditor = () => {
    $('[data-action="gallery-order"]').classList.toggle('is-active', S.view === 'gallery');
    if (S.view === 'gallery') { renderGalleryOrder(); return; }
    const p = project();
    if (!p) { editor.innerHTML = '<div class="empty">Выбери проект слева или создай новый.</div>'; return; }
    const tabs = [['main', 'Основное'], ['media', 'Фото и видео', p.media.length], ['case', 'Кейс', p.case?.enabled ? 'вкл' : '']];
    editor.innerHTML = `
      <div class="ed-head">
        <h1 class="ed-title" data-live-title>${esc(p.title || 'Без названия')}</h1>
        <div class="ed-actions">
          ${p.visible !== false ? `<a class="btn btn-ghost btn-small" href="/?work=${esc(p.id)}-${esc(p.media[0]?.id || '')}" target="_blank">В галерее ↗</a>` : ''}
          ${p.visible !== false && p.case?.enabled ? `<a class="btn btn-ghost btn-small" href="/case.html?p=${esc(p.id)}" target="_blank">Кейс ↗</a>` : ''}
          <button class="btn btn-danger btn-small" type="button" data-act="delete-project">Удалить</button>
        </div>
      </div>
      <div class="tabs" role="tablist">${tabs.map(([k, l, c]) =>
        `<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${S.tab === k}">${l}${c ? `<span class="count">${c}</span>` : ''}</button>`).join('')}</div>
      <div data-pane></div>`;
    const pane = $('[data-pane]', editor);
    if (S.tab === 'main') renderMain(pane, p);
    if (S.tab === 'media') renderMedia(pane, p);
    if (S.tab === 'case') renderCase(pane, p);
  };

  editor.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { S.tab = t.dataset.tab; renderEditor(); return; }
    if (e.target.closest('[data-act="delete-project"]')) {
      const p = project();
      if (!confirm(`Удалить проект «${p.title}»? Он пропадёт с сайта после сохранения. Файлы перенесутся в папку _trash.`)) return;
      S.data.projects = S.data.projects.filter((x) => x !== p);
      S.current = S.data.projects[0]?.id || null;
      setDirty(); renderList(); renderEditor();
    }
  });

  // --- Основное
  const renderMain = (pane, p) => {
    const cats = S.data.categories || [];
    pane.innerHTML = `
      <div class="form">
        <label class="field field--full"><span>Название</span><input class="input" data-f="title" value="${esc(p.title)}"></label>
        <label class="field"><span>Клиент</span><input class="input" data-f="client" value="${esc(p.client)}" placeholder="Например, Кафе-пекарня «Чалавек и конь»"></label>
        <label class="field"><span>Год</span><input class="input" data-f="year" value="${esc(p.year)}" placeholder="2026" inputmode="numeric"></label>
        <div class="field field--full"><span>Категории</span><div class="chips">${cats.map((c) =>
          `<button type="button" class="chip" data-cat="${esc(c.key)}" aria-pressed="${p.cats.includes(c.key)}">${esc(c.label)}</button>`).join('')}</div></div>
        <label class="field field--full"><span>Описание</span><textarea class="textarea" data-f="text" placeholder="2–4 предложения: что за проект и что ты сделала. Показывается в панели при клике на работу.">${esc(p.text)}</textarea>
          <small>Неразрывные пробелы после предлогов расставятся сами.</small></label>
        <label class="field"><span>Что сделала</span><textarea class="textarea" data-f="services" placeholder="Каждый пункт с новой строки">${esc(p.services.join('\n'))}</textarea></label>
        <div class="field">
          <label class="field"><span>Ссылка на сайт</span><input class="input" data-f="site" value="${esc(p.site)}" placeholder="https://… (если есть — появится кнопка «Смотреть сайт»)"></label>
          <div class="field"><span>Цвет значка клиента</span><div class="color-row"><input type="color" data-f="brandColor" value="${esc(p.brandColor || '#2a2a2a')}"><small>Кружок рядом с названием в списке кейсов</small></div></div>
        </div>
        <label class="field"><span>Адрес проекта</span><input class="input" data-f="id" value="${esc(p.id)}" spellcheck="false"><small>Латиница и дефисы. Меняй, только пока проект не опубликован.</small></label>
        <div class="field"><span>Видимость</span><label class="switch"><input type="checkbox" data-f="visible" ${p.visible !== false ? 'checked' : ''}> Показывать на сайте</label></div>
      </div>`;
  };

  editor.addEventListener('input', (e) => {
    const f = e.target.dataset.f; const p = project(); if (!f || !p) return;
    let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (f === 'services') v = v.split('\n').map((s) => s.trim()).filter(Boolean);
    if (f === 'id') return;
    if (f.startsWith('case.')) { p.case[f.slice(5)] = v; }
    else p[f] = v;
    if (f === 'title') {
      $('[data-live-title]').textContent = v || 'Без названия';
      // Пока проект новый и файлов нет, адрес собирается из названия
      if (S.autoId === p.id && !p.media.length) {
        let base = slugify(v) || 'proekt', id = base, i = 2;
        while (S.data.projects.some((x) => x !== p && x.id === id)) id = `${base}-${i++}`;
        p.id = id; S.current = id; S.autoId = id;
        const idInput = $('[data-f="id"]'); if (idInput) idInput.value = id;
      }
    }
    setDirty();
    if (f === 'title' || f === 'visible') renderList();
  });
  editor.addEventListener('change', (e) => {
    const p = project(); if (!p) return;
    if (e.target.dataset.f === 'id') {
      const v = slugify(e.target.value);
      if (!v) { e.target.value = p.id; return; }
      if (v !== p.id && S.data.projects.some((x) => x.id === v)) { toast('Такой адрес уже есть', true); e.target.value = p.id; return; }
      p.id = v; S.current = v; e.target.value = v; setDirty(); renderList();
    }
    if (e.target.dataset.f === 'visible') renderEditor();
  });
  editor.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]'); const p = project(); if (!c || !p) return;
    const k = c.dataset.cat;
    p.cats = p.cats.includes(k) ? p.cats.filter((x) => x !== k) : [...p.cats, k];
    c.setAttribute('aria-pressed', String(p.cats.includes(k)));
    setDirty();
  });

  // --- Фото и видео
  const renderMedia = (pane, p) => {
    pane.innerHTML = `
      <label class="dropzone" data-drop>
        <strong>Перетащи файлы сюда или нажми, чтобы выбрать</strong>
        <span>Фото: JPG, PNG, HEIC, WebP, SVG · Видео: MP4, MOV, GIF</span>
        <small>Сжимаются автоматически: фото до 2000 px, видео до 1440 px без звука</small>
        <input type="file" multiple hidden accept="image/*,video/*,.svg,.heic" data-file>
      </label>
      <div class="uploads" data-uploads></div>
      ${p.media.length ? '<p class="hint" style="margin:0 0 12px">Перетаскивай карточки, чтобы поменять порядок. Первая картинка идёт в галерею первой.</p>' : '<div class="notice">Пока нет ни одного файла.</div>'}
      <div class="media-grid" data-media-grid>${p.media.map((m) => `
        <div class="media-card" draggable="true" data-mid="${esc(m.id)}">
          <div class="media-thumb"><img src="${esc(url(m.thumb))}" alt="" loading="lazy">
            ${m.type === 'video' ? '<span class="badge">видео</span>' : ''}
            ${p.case?.cover === m.id ? '<span class="badge badge--cover">обложка</span>' : ''}</div>
          <div class="media-ctrl">
            <label class="switch"><input type="checkbox" data-m="gallery" ${m.gallery !== false ? 'checked' : ''}> В галерее</label>
            <label class="switch"><input type="checkbox" data-m="hero" ${m.hero ? 'checked' : ''}> На первом экране</label>
            <div class="row"><span class="dim">${m.w}×${m.h}</span>
              <span><button class="icon-btn" type="button" data-m="cover" title="Сделать обложкой кейса">Обложка</button>
              <button class="icon-btn icon-btn--danger" type="button" data-m="delete" title="Удалить">✕</button></span></div>
          </div>
        </div>`).join('')}</div>`;

    const drop = $('[data-drop]', pane);
    const file = $('[data-file]', pane);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); drop.classList.add('is-over'); } }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); upload(p, [...e.dataTransfer.files]); } });
    file.addEventListener('change', () => { upload(p, [...file.files]); file.value = ''; });

    const grid = $('[data-media-grid]', pane);
    let dragM = null;
    grid.addEventListener('dragstart', (e) => { const c = e.target.closest('.media-card'); dragM = c?.dataset.mid; c?.classList.add('dragging'); });
    grid.addEventListener('dragend', () => { dragM = null; grid.querySelectorAll('.dragging,.drag-over').forEach((x) => x.classList.remove('dragging', 'drag-over')); });
    grid.addEventListener('dragover', (e) => { const c = e.target.closest('.media-card'); if (!c || !dragM) return; e.preventDefault(); grid.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); c.classList.add('drag-over'); });
    grid.addEventListener('drop', (e) => {
      const c = e.target.closest('.media-card'); if (!c || !dragM || c.dataset.mid === dragM) return;
      e.preventDefault();
      const from = p.media.findIndex((m) => m.id === dragM);
      const [mv] = p.media.splice(from, 1);
      p.media.splice(p.media.findIndex((m) => m.id === c.dataset.mid), 0, mv);
      setDirty(); renderEditor(); renderList();
    });
    grid.addEventListener('change', (e) => {
      const key = e.target.dataset.m;
      if (key !== 'gallery' && key !== 'hero') return;
      mediaById(p, e.target.closest('[data-mid]').dataset.mid)[key] = e.target.checked; setDirty();
      if (key === 'hero') {
        const n = S.data.projects.filter((x) => x.visible !== false).flatMap((x) => x.media).filter((m) => m.hero).length;
        if (n > 4) toast(`На первом экране помещается 4 работы (+ твоё видео). Отмечено ${n} — покажутся первые 4 по порядку проектов.`);
      }
    });
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-m]'); if (!b) return;
      const id = b.closest('[data-mid]').dataset.mid;
      if (b.dataset.m === 'cover') { p.case.cover = id; setDirty(); renderEditor(); renderList(); }
      if (b.dataset.m === 'delete') {
        if (!confirm('Удалить этот файл из проекта? Он уберётся и из кейса.')) return;
        p.media = p.media.filter((m) => m.id !== id);
        if (p.case.cover === id) p.case.cover = p.media[0]?.id || null;
        p.case.blocks.forEach((bl) => { if (bl.items) bl.items = bl.items.filter((x) => x !== id); });
        setDirty(); renderEditor(); renderList();
      }
    });
  };

  const upload = async (p, files) => {
    const box = $('[data-uploads]');
    S.uploading += files.length;
    for (const f of files) {
      const row = document.createElement('div');
      row.className = 'upload-row';
      row.innerHTML = `<span>${esc(f.name)}</span><span class="st">${f.type.startsWith('video') ? 'сжимаю видео… это может занять минуту' : 'загружаю…'}</span>`;
      box?.append(row);
      try {
        const j = await api('POST', `/api/upload?project=${encodeURIComponent(p.id)}`, f, { 'X-Filename': encodeURIComponent(f.name) });
        p.media.push(j.media);
        if (!p.case.cover) p.case.cover = j.media.id;
        row.classList.add('is-done'); row.querySelector('.st').textContent = 'готово';
      } catch (e) {
        row.classList.add('is-error'); row.querySelector('.st').textContent = e.message;
      } finally { S.uploading--; }
    }
    setDirty();
    await save();
    if (S.current === p.id && S.tab === 'media') { const keep = box?.innerHTML; renderEditor(); const nb = $('[data-uploads]'); if (nb && keep) nb.innerHTML = keep; }
    renderList();
  };

  // --- Кейс
  const renderCase = (pane, p) => {
    const c = p.case;
    const thumbs = (sel, attr) => p.media.map((m) => {
      const n = Array.isArray(sel) ? sel.indexOf(m.id) : -1;
      const on = Array.isArray(sel) ? n >= 0 : sel === m.id;
      return `<button type="button" class="pick" ${attr}="${esc(m.id)}" aria-pressed="${on}" title="${m.type === 'video' ? 'видео' : 'фото'}"><img src="${esc(url(m.thumb))}" alt="" loading="lazy">${n >= 0 ? `<span class="num">${n + 1}</span>` : ''}</button>`;
    }).join('');
    pane.innerHTML = `
      <div class="field" style="margin-bottom:24px"><label class="switch"><input type="checkbox" data-case-enabled ${c.enabled ? 'checked' : ''}> Есть страница кейса</label>
        <small>Если выключено, проект показывается только в галерее, без страницы кейса.</small></div>
      ${!p.media.length ? '<div class="notice">Сначала загрузи фото и видео на вкладке «Фото и видео», потом собирай кейс.</div>' : ''}
      <div class="case-top">
        <div class="field field--full"><span>Обложка кейса</span><div class="cover-picker">${thumbs(c.cover, 'data-cover')}</div></div>
        <label class="field field--full"><span>Вступление</span><textarea class="textarea textarea--tall" data-f="case.lead" placeholder="Крупный текст под заголовком кейса: о клиенте и задаче. Абзацы — через пустую строку.">${esc(c.lead)}</textarea></label>
      </div>
      <h2 class="section-title">Блоки кейса</h2>
      <p class="hint" style="margin:-6px 0 14px">Собирай историю сверху вниз: текст, потом картинки к нему.</p>
      <div class="blocks">${c.blocks.map((b, i) => `
        <div class="block" data-bi="${i}">
          <div class="block-head"><span class="block-type">${i + 1}. ${b.type === 'text' ? 'Текст' : 'Фото и видео'}</span>
            <span class="block-tools">
              <button class="icon-btn" type="button" data-b="up" ${i === 0 ? 'disabled' : ''} title="Выше">↑</button>
              <button class="icon-btn" type="button" data-b="down" ${i === c.blocks.length - 1 ? 'disabled' : ''} title="Ниже">↓</button>
              <button class="icon-btn icon-btn--danger" type="button" data-b="delete" title="Удалить блок">✕</button></span></div>
          <div class="block-body">${b.type === 'text' ? `
            <label class="field"><span>Заголовок</span><input class="input" data-bf="title" value="${esc(b.title)}" placeholder="Например, Задача"></label>
            <label class="field"><span>Текст</span><textarea class="textarea" data-bf="text">${esc(b.text)}</textarea></label>` : `
            <div class="field"><span>В ряд</span><div class="seg">${[1, 2, 3].map((n) => `<button type="button" data-cols="${n}" aria-pressed="${(b.cols || 1) === n}">${n}</button>`).join('')}</div></div>
            <div class="field"><span>Файлы — нажимай по порядку</span><div class="cover-picker">${thumbs(b.items, 'data-item')}</div></div>`}
          </div>
        </div>`).join('')}</div>
      <div class="block-add">
        <button class="btn btn-small" type="button" data-add="text">+ Текст</button>
        <button class="btn btn-small" type="button" data-add="media">+ Фото и видео</button>
      </div>`;

    pane.addEventListener('change', (e) => {
      if (e.target.matches('[data-case-enabled]')) { c.enabled = e.target.checked; setDirty(); renderEditor(); renderList(); }
    });
    pane.addEventListener('input', (e) => {
      const bf = e.target.dataset.bf; if (!bf) return;
      c.blocks[+e.target.closest('[data-bi]').dataset.bi][bf] = e.target.value; setDirty();
    });
    pane.addEventListener('click', (e) => {
      const cov = e.target.closest('[data-cover]');
      if (cov) { c.cover = cov.dataset.cover; setDirty(); renderEditor(); renderList(); return; }
      const add = e.target.closest('[data-add]');
      if (add) { c.blocks.push(add.dataset.add === 'text' ? { type: 'text', title: '', text: '' } : { type: 'media', cols: 1, items: [] }); setDirty(); renderEditor(); return; }
      const blk = e.target.closest('[data-bi]'); if (!blk) return;
      const i = +blk.dataset.bi; const b = c.blocks[i];
      const it = e.target.closest('[data-item]');
      if (it) { const id = it.dataset.item; b.items = b.items.includes(id) ? b.items.filter((x) => x !== id) : [...b.items, id]; setDirty(); renderEditor(); return; }
      const cols = e.target.closest('[data-cols]');
      if (cols) { b.cols = +cols.dataset.cols; setDirty(); renderEditor(); return; }
      const act = e.target.closest('[data-b]')?.dataset.b;
      if (act === 'up' && i > 0) [c.blocks[i - 1], c.blocks[i]] = [c.blocks[i], c.blocks[i - 1]];
      else if (act === 'down' && i < c.blocks.length - 1) [c.blocks[i + 1], c.blocks[i]] = [c.blocks[i], c.blocks[i + 1]];
      else if (act === 'delete') { if (!confirm('Удалить блок?')) return; c.blocks.splice(i, 1); }
      else return;
      setDirty(); renderEditor();
    });
  };


  // ---------- порядок в галерее ----------
  S.go = { cat: 'all', cols: 3 };
  // Порядок по умолчанию — как собирает сервер: проекты по очереди, по одной картинке
  const defaultWorks = () => {
    const per = S.data.projects.filter((p) => p.visible !== false).map((p) => ({
      p, items: p.media.filter((m) => m.gallery !== false).map((m) => ({ id: `${p.id}-${m.id}`, p, m })),
    }));
    const out = [];
    while (per.some((x) => x.items.length)) per.forEach((x) => { if (x.items.length) out.push(x.items.shift()); });
    return out;
  };
  const orderedWorks = (cat) => {
    const list = defaultWorks().filter((w) => cat === 'all' || w.p.cats.includes(cat));
    const order = (S.data.galleryOrder || {})[cat];
    if (!order) return list;
    const pos = new Map(order.map((id, i) => [id, i]));
    return list.map((w, i) => ({ w, k: pos.has(w.id) ? pos.get(w.id) : order.length + i })).sort((a, b) => a.k - b.k).map((x) => x.w);
  };
  const setOrder = (cat, ids) => { S.data.galleryOrder = S.data.galleryOrder || {}; S.data.galleryOrder[cat] = ids; setDirty(); };

  const renderGalleryOrder = () => {
    const cats = [{ key: 'all', label: 'Все' }, ...(S.data.categories || [])];
    const cat = S.go.cat;
    const list = orderedWorks(cat);
    const custom = !!(S.data.galleryOrder || {})[cat];
    // раскладка как на сайте: каждую следующую картинку в самую короткую колонку
    const cols = Array.from({ length: S.go.cols }, () => ({ h: 0, items: [] }));
    list.forEach((w, i) => { const c = cols.reduce((a, b) => (b.h < a.h ? b : a)); c.items.push([w, i]); c.h += w.m.h / w.m.w + 0.05; });
    editor.innerHTML = `
      <div class="ed-head"><h1 class="ed-title">Порядок в галерее${custom ? '<span class="go-badge">свой порядок</span>' : ''}</h1></div>
      <p class="hint" style="margin:-10px 0 20px">Перетащи картинку на другую — она встанет на её место. Так сетка выглядит на сайте; для каждой категории порядок свой.</p>
      <div class="go-bar">
        <div class="chips">${cats.map((c) => `<button type="button" class="chip" data-go-cat="${esc(c.key)}" aria-pressed="${c.key === cat}">${esc(c.label)}</button>`).join('')}</div>
        <div style="display:flex;gap:10px;align-items:center">
          <span class="label">Колонки</span>
          <div class="seg">${[3, 5, 7].map((n) => `<button type="button" data-go-cols="${n}" aria-pressed="${S.go.cols === n}">${n}</button>`).join('')}</div>
          <button class="btn btn-ghost btn-small" type="button" data-go-reset ${custom ? '' : 'disabled'}>Сбросить порядок</button>
        </div>
      </div>
      ${list.length ? `<div class="go-masonry">${cols.map((c) => `<div class="go-col">${c.items.map(([w, i]) => `
        <div class="go-card" draggable="true" data-wid="${esc(w.id)}" style="aspect-ratio:${w.m.w}/${w.m.h}">
          <img src="${esc(url(w.m.thumb))}" alt="" loading="lazy">
          <span class="go-num">${i + 1}</span>
          <span class="go-tools"><button type="button" data-go-move="first" title="В начало">⇤</button><button type="button" data-go-move="last" title="В конец">⇥</button></span>
          <span class="go-name">${esc(w.p.title)}</span>
        </div>`).join('')}</div>`).join('')}</div>` : '<div class="notice">В этой категории пока нет работ.</div>'}`;
  };

  $('[data-action="gallery-order"]').addEventListener('click', () => { S.view = 'gallery'; renderList(); renderEditor(); });

  editor.addEventListener('click', (e) => {
    if (S.view !== 'gallery') return;
    const c = e.target.closest('[data-go-cat]');
    if (c) { S.go.cat = c.dataset.goCat; renderEditor(); return; }
    const n = e.target.closest('[data-go-cols]');
    if (n) { S.go.cols = +n.dataset.goCols; renderEditor(); return; }
    if (e.target.closest('[data-go-reset]')) {
      if (!confirm('Вернуть порядок по умолчанию для этой категории?')) return;
      delete S.data.galleryOrder[S.go.cat]; setDirty(); renderEditor(); return;
    }
    const mv = e.target.closest('[data-go-move]');
    if (mv) {
      const id = mv.closest('[data-wid]').dataset.wid;
      const ids = orderedWorks(S.go.cat).map((w) => w.id).filter((x) => x !== id);
      if (mv.dataset.goMove === 'first') ids.unshift(id); else ids.push(id);
      setOrder(S.go.cat, ids); renderEditor();
    }
  });
  let goDrag = null;
  editor.addEventListener('dragstart', (e) => {
    const c = e.target.closest('.go-card'); if (!c) return;
    goDrag = c.dataset.wid; c.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  editor.addEventListener('dragend', () => { goDrag = null; editor.querySelectorAll('.go-card').forEach((x) => x.classList.remove('dragging', 'drop-before')); });
  editor.addEventListener('dragover', (e) => {
    const c = e.target.closest('.go-card'); if (!c || !goDrag) return;
    e.preventDefault();
    editor.querySelectorAll('.drop-before').forEach((x) => x.classList.remove('drop-before'));
    if (c.dataset.wid !== goDrag) c.classList.add('drop-before');
  });
  editor.addEventListener('drop', (e) => {
    const c = e.target.closest('.go-card'); if (!c || !goDrag || c.dataset.wid === goDrag) return;
    e.preventDefault();
    const ids = orderedWorks(S.go.cat).map((w) => w.id);
    const from = ids.indexOf(goDrag), to = ids.indexOf(c.dataset.wid);
    ids.splice(from, 1);
    ids.splice(to, 0, goDrag); // встаёт на место той, на которую бросили
    setOrder(S.go.cat, ids); goDrag = null; renderEditor();
  });

  // ---------- категории ----------
  $('[data-action="categories"]').addEventListener('click', () => {
    const cats = S.data.categories;
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    const draw = () => {
      bg.innerHTML = `<div class="modal" role="dialog" aria-label="Категории">
        <h2>Категории</h2><p class="hint" style="margin:0 0 8px">«Все» есть всегда. Порядок здесь = порядок на сайте.</p>
        ${cats.map((c, i) => `<div class="cat-row" data-ci="${i}"><input class="input" value="${esc(c.label)}" data-cl>
          <button class="icon-btn" type="button" data-c="up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" type="button" data-c="down" ${i === cats.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn icon-btn--danger" type="button" data-c="del">✕</button></div>`).join('')}
        <div class="block-add"><button class="btn btn-small" type="button" data-c="add">+ Категория</button>
        <span style="flex:1"></span><button class="btn btn-primary btn-small" type="button" data-c="close">Готово</button></div></div>`;
    };
    draw();
    document.body.append(bg);
    bg.addEventListener('input', (e) => { if (e.target.matches('[data-cl]')) { cats[+e.target.closest('[data-ci]').dataset.ci].label = e.target.value; setDirty(); } });
    bg.addEventListener('click', (e) => {
      if (e.target === bg) { bg.remove(); renderEditor(); return; }
      const a = e.target.closest('[data-c]')?.dataset.c; if (!a) return;
      const i = +e.target.closest('[data-ci]')?.dataset.ci;
      if (a === 'close') { bg.remove(); renderEditor(); return; }
      if (a === 'add') { let k = 'cat-' + Math.random().toString(36).slice(2, 6); cats.push({ key: k, label: 'Новая категория' }); }
      if (a === 'up') [cats[i - 1], cats[i]] = [cats[i], cats[i - 1]];
      if (a === 'down') [cats[i + 1], cats[i]] = [cats[i], cats[i + 1]];
      if (a === 'del') {
        if (!confirm(`Удалить категорию «${cats[i].label}»? Проекты останутся, просто без неё.`)) return;
        const k = cats[i].key; cats.splice(i, 1); S.data.projects.forEach((p) => { p.cats = p.cats.filter((x) => x !== k); });
      }
      setDirty(); draw();
    });
  });

  // ---------- старт ----------
  (async () => {
    try {
      S.data = await (await fetch('/api/data')).json();
      S.current = S.data.projects[0]?.id || null;
      renderList(); renderEditor(); setDirty(false);
    } catch (e) {
      saveState.textContent = 'Не удалось загрузить данные';
      toast('Админка открыта не через сервер. Запусти «Запустить админку.command».', true);
    }
  })();
})();
