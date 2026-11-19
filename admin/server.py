#!/usr/bin/env python3
"""Локальная админка портфолио.

Запуск: python3 admin/server.py  (или двойной клик по «Запустить админку.command»)
Админка: http://localhost:8800/admin/   Сайт: http://localhost:8800/

Хранит всё в content/data.json и после каждого сохранения пересобирает
assets/js/works.js, из которого читает сайт. Без сторонних библиотек.
Для сжатия нужны cwebp и ffmpeg (brew install webp ffmpeg).
"""
import http.server, json, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.parse, webbrowser, random, string

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'content', 'data.json')
WORKS_JS = os.path.join(ROOT, 'assets', 'js', 'works.js')
MEDIA_DIR = os.path.join(ROOT, 'assets', 'works')
ORIGINALS = os.path.join(ROOT, '_originals')
TRASH = os.path.join(ROOT, '_trash')
PORT = int(os.environ.get('PORT', 8800))
SERVER_VERSION = 3  # увеличивать при изменениях сервера — админка попросит перезапуск
LOCK = threading.Lock()

# ---------------------------------------------------------------- типографика
SHORT = r'(?<![\w\-])([А-Яа-яЁёA-Za-z]{1,3}|\d+) (?=\S)'
def nbsp(t):
    if not t: return t
    t = re.sub(SHORT, lambda m: m.group(1) + ' ', t)
    t = t.replace(' — ', ' — ').replace(' – ', ' — ')
    return t

# ---------------------------------------------------------------- утилиты
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя', ['a','b','v','g','d','e','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','ts','ch','sh','sch','','y','','e','yu','ya']))
def slugify(s, fallback='file'):
    s = ''.join(TR.get(c, c) for c in (s or '').lower())
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:40] or fallback

def rnd(n=4): return ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(n))

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout or 'ошибка').strip()[-400:])
    return p.stdout

def probe(path):
    out = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', path])
    st = json.loads(out)['streams'][0]
    w, h = int(st['width']), int(st['height'])
    rot = 0
    for sd in st.get('side_data_list', []) or []:
        rot = abs(int(sd.get('rotation', 0) or 0))
    return (h, w) if rot in (90, 270) else (w, h)

def rel(p): return os.path.relpath(p, ROOT).replace(os.sep, '/')

# ---------------------------------------------------------------- обработка медиа
IMG = {'.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'}
CONVERT = {'.heic', '.heif', '.bmp'}
VID = {'.mp4', '.mov', '.m4v', '.webm', '.gif'}

def process_upload(project_id, filename, raw_path):
    ext = os.path.splitext(filename)[1].lower()
    base = f"{slugify(project_id, 'project')}-{slugify(os.path.splitext(filename)[0])}-{rnd()}"
    os.makedirs(MEDIA_DIR, exist_ok=True)
    os.makedirs(os.path.join(ORIGINALS, project_id), exist_ok=True)
    shutil.copy(raw_path, os.path.join(ORIGINALS, project_id, base + ext))
    mid = base.split('-', 1)[1] if '-' in base else base
    mid = base[len(slugify(project_id, 'project')) + 1:]

    if ext == '.svg':
        dst = os.path.join(MEDIA_DIR, base + '.svg')
        shutil.copy(raw_path, dst)
        svg = open(dst, encoding='utf-8', errors='ignore').read(4000)
        m = re.search(r'viewBox="\s*[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)', svg)
        w, h = (round(float(m.group(1))), round(float(m.group(2)))) if m else (1600, 1000)
        return dict(id=mid, type='image', src=rel(dst), thumb=rel(dst), w=w, h=h, gallery=True)

    if ext in CONVERT:
        tmp = raw_path + '.jpg'
        run(['sips', '-s', 'format', 'jpeg', raw_path, '--out', tmp])
        raw_path, ext = tmp, '.jpg'

    if ext in IMG:
        w, h = probe(raw_path)
        big = os.path.join(MEDIA_DIR, base + '.webp')
        sm = os.path.join(MEDIA_DIR, base + '-sm.webp')
        if w >= h: rs_big = [str(min(w, 2000)), '0']
        else: rs_big = ['0', str(min(h, 2000))]
        run(['cwebp', '-quiet', '-metadata', 'icc', '-q', '82', '-resize', *rs_big, raw_path, '-o', big])
        run(['cwebp', '-quiet', '-metadata', 'icc', '-q', '78', '-resize', str(min(w, 800)), '0', raw_path, '-o', sm])
        w2, h2 = probe(big)
        return dict(id=mid, type='image', src=rel(big), thumb=rel(sm), w=w2, h=h2, gallery=True)

    if ext in VID:
        dst = os.path.join(MEDIA_DIR, base + '.mp4')
        w, h = probe(raw_path)
        nw = min(w, 1440) // 2 * 2
        run(['ffmpeg', '-y', '-v', 'error', '-i', raw_path, '-an', '-vf', f'scale={nw}:-2:flags=lanczos,fps=30',
             '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'medium',
             '-movflags', '+faststart', dst])
        png = os.path.join(tempfile.gettempdir(), base + '.png')
        run(['ffmpeg', '-y', '-v', 'error', '-i', dst, '-frames:v', '1', png])
        poster = os.path.join(MEDIA_DIR, base + '-poster.webp')
        run(['cwebp', '-quiet', '-q', '80', '-resize', str(min(nw, 1440)), '0', png, '-o', poster])
        os.remove(png)
        w2, h2 = probe(dst)
        return dict(id=mid, type='video', src=rel(dst), thumb=rel(poster), w=w2, h=h2, gallery=True)

    raise RuntimeError(f'Формат {ext or "без расширения"} не поддерживается')

# ---------------------------------------------------------------- данные и сборка сайта
def load():
    with open(DATA, encoding='utf-8') as f: return json.load(f)

def validate(data):
    if not isinstance(data, dict) or not isinstance(data.get('projects'), list):
        raise ValueError('Неверный формат данных')
    ids = set()
    for p in data['projects']:
        if not p.get('id') or p['id'] in ids: raise ValueError(f'Повтор или пустой id проекта: {p.get("id")}')
        ids.add(p['id'])
        if not (p.get('title') or '').strip(): raise ValueError('У проекта нет названия')
    ho = data.get('heroOrder', [])
    if not isinstance(ho, list) or not all(isinstance(x, str) for x in ho):
        raise ValueError('Неверный формат порядка первого экрана')
    go = data.get('galleryOrder', {})
    if not isinstance(go, dict) or any(not isinstance(v, list) or not all(isinstance(x, str) for x in v) for v in go.values()):
        raise ValueError('Неверный формат порядка галереи')
    for p in data['projects']:
        mids = set()
        for m in p.get('media', []):
            if m['id'] in mids: raise ValueError(f'Повтор файла в проекте «{p["title"]}»')
            mids.add(m['id'])
            for k in ('src', 'thumb'):
                if '..' in m[k] or not m[k].startswith('assets/'): raise ValueError('Неверный путь к файлу')

def build(data):
    projects, by_project = {}, {}
    for p in data['projects']:
        if not p.get('visible', True): continue
        c = p.get('case') or {}
        projects[p['id']] = {
            'title': nbsp(p['title']), 'client': nbsp(p.get('client', '')), 'year': p.get('year', ''),
            'cats': p.get('cats', []), 'services': p.get('services', []), 'text': nbsp(p.get('text', '')),
            'site': p.get('site', ''), 'brandColor': p.get('brandColor', '#2a2a2a'),
            'media': {m['id']: {k: m[k] for k in ('type', 'src', 'thumb', 'w', 'h') if k in m} for m in p.get('media', [])},
            'case': None if not c.get('enabled') else {
                'cover': c.get('cover'), 'lead': nbsp(c.get('lead', '')),
                'blocks': [
                    {'type': 'text', 'title': nbsp(b.get('title', '')), 'text': nbsp(b.get('text', ''))} if b['type'] == 'text'
                    else {'type': 'media', 'cols': int(b.get('cols', 1)), 'items': b.get('items', [])}
                    for b in c.get('blocks', [])
                ],
            },
        }
        by_project[p['id']] = [dict(p=p['id'], id=f"{p['id']}-{m['id']}", **{k: m[k] for k in ('type', 'src', 'thumb', 'w', 'h') if k in m})
                               for m in p.get('media', []) if m.get('gallery', True)]
    works, order = [], [p['id'] for p in data['projects'] if p['id'] in by_project]
    while any(by_project[i] for i in order):
        for i in order:
            if by_project[i]: works.append(by_project[i].pop(0))
    js = '// Собирается автоматически из content/data.json — правьте через админку\n'
    js += 'window.CATEGORIES = ' + json.dumps(data.get('categories', []), ensure_ascii=False) + ';\n'
    js += 'window.PROJECTS = ' + json.dumps(projects, ensure_ascii=False) + ';\n'
    js += 'window.PROJECT_ORDER = ' + json.dumps(order, ensure_ascii=False) + ';\n'
    js += 'window.WORKS = ' + json.dumps(works, ensure_ascii=False) + ';\n'
    # Ручной порядок картинок для каждой категории (из раздела «Порядок в галерее»)
    cats_of = {pid: set(projects[pid]['cats']) for pid in projects}
    gallery_order = {}
    for cat, ids in (data.get('galleryOrder') or {}).items():
        valid = {w['id'] for w in works if cat == 'all' or cat in cats_of.get(w['p'], ())}
        clean = [i for i in ids if i in valid]
        if clean: gallery_order[cat] = clean
    js += 'window.GALLERY_ORDER = ' + json.dumps(gallery_order, ensure_ascii=False) + ';\n'
    # Лента первого экрана: отмеченные «На первом экране» (по порядку проектов), максимум 4
    hero = []
    for p in data['projects']:
        if not p.get('visible', True): continue
        for m in p.get('media', []):
            if m.get('hero'):
                hero.append(dict(id=f"{p['id']}-{m['id']}", p=p['id'], title=nbsp(p['title']), **{k: m[k] for k in ('type', 'src', 'thumb', 'w', 'h') if k in m}))
    # Порядок, расставленный в разделе «Первый экран»
    hpos = {wid: i for i, wid in enumerate(data.get('heroOrder') or [])}
    hero.sort(key=lambda w: hpos.get(w['id'], len(hpos)))
    if not hero:  # ничего не отмечено — берём по одной картинке из первых проектов
        seen = set()
        for w in works:
            if w['p'] in seen or w.get('type') == 'video': continue
            seen.add(w['p']); hero.append(dict(w, title=projects[w['p']]['title']))
    js += 'window.HERO = ' + json.dumps(hero[:4], ensure_ascii=False) + ';\n'
    tmp = WORKS_JS + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: f.write(js)
    os.replace(tmp, WORKS_JS)

def collect_garbage(data):
    """Файлы, которые больше не используются, переносим в _trash (не удаляем)."""
    used = set()
    for p in data['projects']:
        for m in p.get('media', []):
            used.add(os.path.basename(m['src'])); used.add(os.path.basename(m['thumb']))
    moved = 0
    if os.path.isdir(MEDIA_DIR):
        for name in os.listdir(MEDIA_DIR):
            if name.startswith('.') or name in used: continue
            os.makedirs(TRASH, exist_ok=True)
            shutil.move(os.path.join(MEDIA_DIR, name), os.path.join(TRASH, name))
            moved += 1
    return moved

def save(data):
    validate(data)
    with LOCK:
        if os.path.exists(DATA):
            os.makedirs(os.path.join(ROOT, 'content', 'backups'), exist_ok=True)
            shutil.copy(DATA, os.path.join(ROOT, 'content', 'backups', time.strftime('data-%Y%m%d-%H%M%S.json')))
            backs = sorted(os.listdir(os.path.join(ROOT, 'content', 'backups')))
            for old in backs[:-30]: os.remove(os.path.join(ROOT, 'content', 'backups', old))
        tmp = DATA + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, DATA)
        build(data)
        return collect_garbage(data)

def publish():
    if not os.path.isdir(os.path.join(ROOT, '.git')):
        return {'ok': False, 'message': 'Сайт ещё не подключён к GitHub. Попроси Claude подключить репозиторий и домен — после этого кнопка начнёт публиковать.'}
    run(['git', '-C', ROOT, 'add', '-A'])
    st = run(['git', '-C', ROOT, 'status', '--porcelain'])
    if st.strip():
        run(['git', '-C', ROOT, 'commit', '-m', 'Обновление портфолио через админку'])
    run(['git', '-C', ROOT, 'push'])
    return {'ok': True, 'message': 'Опубликовано. Сайт обновится через минуту-две.'}

# ---------------------------------------------------------------- HTTP
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        # В журнал пишем только запросы к API и ошибки; первый аргумент бывает не строкой
        first = str(args[0]) if args else ''
        if '/api/' in first or fmt.startswith('code'):
            sys.stderr.write('  ' + (fmt % args) + '\n')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def same_origin(self):
        o = self.headers.get('Origin')
        return o is None or o in (f'http://localhost:{PORT}', f'http://127.0.0.1:{PORT}')

    def read_body(self, limit=1024 * 1024 * 1024):
        n = int(self.headers.get('Content-Length') or 0)
        if n > limit: raise ValueError('Файл слишком большой')
        return n

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/api/data':
            return self.send_json(load())
        if u.path == '/api/status':
            return self.send_json({'git': os.path.isdir(os.path.join(ROOT, '.git')), 'version': SERVER_VERSION})
        if u.path in ('/admin', '/admin/'):
            self.path = '/admin/index.html'
        if any(seg in u.path for seg in ('/_originals', '/_trash', '/.git')):
            return self.send_error(404)
        return super().do_GET()

    def do_PUT(self):
        if not self.same_origin(): return self.send_error(403)
        if urllib.parse.urlparse(self.path).path != '/api/data': return self.send_error(404)
        try:
            n = self.read_body(20 * 1024 * 1024)
            data = json.loads(self.rfile.read(n).decode('utf-8'))
            moved = save(data)
            self.send_json({'ok': True, 'trashed': moved})
        except Exception as e:
            self.send_json({'ok': False, 'message': str(e)}, 400)

    def do_POST(self):
        if not self.same_origin(): return self.send_error(403)
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        try:
            if u.path == '/api/upload':
                pid = slugify(q.get('project', [''])[0], 'project')
                name = urllib.parse.unquote(self.headers.get('X-Filename', 'file'))
                n = self.read_body()
                fd, tmp = tempfile.mkstemp(suffix=os.path.splitext(name)[1].lower())
                with os.fdopen(fd, 'wb') as f:
                    left = n
                    while left > 0:
                        chunk = self.rfile.read(min(1 << 20, left))
                        if not chunk: break
                        f.write(chunk); left -= len(chunk)
                try:
                    media = process_upload(pid, name, tmp)
                finally:
                    for t in (tmp, tmp + '.jpg'):
                        if os.path.exists(t): os.remove(t)
                return self.send_json({'ok': True, 'media': media})
            if u.path == '/api/publish':
                return self.send_json(publish())
            return self.send_error(404)
        except Exception as e:
            return self.send_json({'ok': False, 'message': str(e)}, 400)

def main():
    for tool in ('cwebp', 'ffmpeg', 'ffprobe'):
        if not shutil.which(tool):
            print(f'Не найден {tool}. Установи: brew install webp ffmpeg'); sys.exit(1)
    if not os.path.exists(WORKS_JS) or os.path.getmtime(WORKS_JS) < os.path.getmtime(DATA):
        build(load())
    global PORT
    srv = None
    for port in range(PORT, PORT + 10):
        try:
            srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
            PORT = port
            break
        except OSError:
            # Адрес занят. Если это уже запущенная админка — просто открываем её.
            try:
                import urllib.request
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/status', timeout=1) as r:
                    if r.status == 200:
                        url = f'http://localhost:{port}/admin/'
                        print(f'\n  Админка уже запущена — открываю {url}\n  Это окно можно закрыть.\n')
                        webbrowser.open(url)
                        return
            except Exception:
                pass
    if srv is None:
        print('Не получилось запустить админку: порты 8800–8809 заняты.'); sys.exit(1)
    url = f'http://localhost:{PORT}/admin/'
    print(f'\n  Админка: {url}\n  Сайт:    http://localhost:{PORT}/\n\n  Чтобы остановить — закрой это окно или нажми Ctrl+C.\n')
    if '--no-browser' not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: pass

if __name__ == '__main__':
    main()
