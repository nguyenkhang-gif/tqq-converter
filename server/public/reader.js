const $ = id => document.getElementById(id);
const viewer      = $('viewer');
const sidebar     = $('chapter-list');
const pageInfo    = $('page-info');
const chapSelect  = $('chap-select');
const sideTitle   = $('manga-title');
const overlay     = $('overlay');

let files       = [];   // { name, type, size }[]
let currentFile = null;
let allChapters = [];   // { label, pages[] }[] — extracted from volume
let currentChap = -1;
let pages       = [];   // pages of the current chapter only
let currentPage = 0;
let mode        = localStorage.getItem('reader-mode') || 'vert';
let imgObserver = null;

// ── init ──────────────────────────────────────────────────────────────────
async function init() {
  const [cfg, allFiles] = await Promise.all([
    fetch('/api/config').then(r => r.json()).catch(() => ({})),
    fetch('/api/files').then(r => r.json()).catch(() => []),
  ]);

  if (cfg.manga?.title) sideTitle.textContent = cfg.manga.title;

  files = allFiles; // both cbz and epub
  showFileList();
}

// ── sidebar: volume list ──────────────────────────────────────────────────
function showFileList() {
  sideTitle.textContent = 'Thư viện';
  sidebar.innerHTML = '';

  if (!files.length) {
    sidebar.innerHTML = '<div class="side-empty">Chưa có file CBZ.<br>Build CBZ từ trang chính trước.</div>';
    return;
  }

  files.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'chap-btn' + (f === currentFile ? ' active' : '');
    btn.dataset.name = f.name;
    const icon = f.type === 'epub' ? '📚' : '📦';
    btn.innerHTML =
      `<span class="chap-label">${icon} ${f.name.replace(/\.(cbz|epub)$/i, '')}</span>` +
      `<span class="chap-meta">${f.type.toUpperCase()} · ${fmtSize(f.size)}</span>`;
    btn.addEventListener('click', () => loadVolume(f));
    sidebar.appendChild(btn);
  });
}

// ── sidebar: chapter list (inside a volume) ───────────────────────────────
function showChapterList() {
  sideTitle.textContent = currentFile.name.replace(/\.cbz$/i, '');
  sidebar.innerHTML = '';

  const back = document.createElement('button');
  back.className = 'back-btn';
  back.textContent = '← Thư viện';
  back.addEventListener('click', showFileList);
  sidebar.appendChild(back);

  allChapters.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'chap-btn' + (i === currentChap ? ' active' : '');
    btn.dataset.idx = i;
    btn.innerHTML = `<span class="chap-label">${ch.label}</span>`;
    btn.addEventListener('click', () => { loadChapter(i); closeSidebar(); });
    sidebar.appendChild(btn);
  });

  // scroll active into view
  sidebar.querySelector('.chap-btn.active')?.scrollIntoView({ block: 'nearest' });
}

function syncChapterActive() {
  sidebar.querySelectorAll('.chap-btn').forEach(b =>
    b.classList.toggle('active', +b.dataset.idx === currentChap)
  );
  sidebar.querySelector('.chap-btn.active')?.scrollIntoView({ block: 'nearest' });
}

// ── extract chapters from flat page list ──────────────────────────────────
// CBZ:  "0001-chapter-001/001.jpg"  → group by first path component
// EPUB: "OEBPS/images/chapter-001/001.jpg" → group by second-to-last component
function extractChapters(pageList, type) {
  const groupKey = pg => {
    const parts = pg.split('/');
    if (type === 'epub') return parts.length >= 2 ? parts[parts.length - 2] : '__root__';
    return parts.length >= 2 ? parts[0] : '__root__';
  };

  const map = new Map();
  pageList.forEach(pg => {
    const key = groupKey(pg);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(pg);
  });

  return [...map.entries()].map(([key, pgs]) => ({
    label: key === '__root__'
      ? 'Chapter 1'
      : key.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    pages: pgs,
  }));
}

// ── populate chapter select dropdown ─────────────────────────────────────
function populateSelect() {
  chapSelect.innerHTML = '';
  if (!allChapters.length) {
    chapSelect.disabled = true;
    const opt = document.createElement('option');
    opt.textContent = 'Không có chapter';
    chapSelect.appendChild(opt);
    return;
  }
  chapSelect.disabled = false;
  allChapters.forEach((ch, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = ch.label;
    chapSelect.appendChild(opt);
  });
}

function syncSelect() {
  if (currentChap >= 0) chapSelect.value = currentChap;
}

// ── load volume (fetch all pages, extract chapters, show chapter list) ────
async function loadVolume(file) {
  currentFile = file;
  currentChap = -1;
  pages = [];

  // update file list active state
  sidebar.querySelectorAll('.chap-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.name === file.name)
  );

  viewer.innerHTML = '<div class="placeholder"><div class="spinner"></div><span>Đang tải danh sách...</span></div>';
  chapSelect.innerHTML = '<option>Đang tải...</option>';
  chapSelect.disabled = true;
  pageInfo.textContent = '';
  updateFileNav();

  const apiBase = file.type === 'epub' ? '/api/epub' : '/api/reader';
  const allPages = await fetch(`${apiBase}/${encodeURIComponent(file.name)}/pages`)
    .then(r => r.json()).catch(() => []);

  if (!allPages.length) {
    viewer.innerHTML = '<div class="placeholder"><span>Không có ảnh trong file này</span></div>';
    allChapters = [];
    populateSelect();
    showChapterList();
    return;
  }

  allChapters = extractChapters(allPages, file.type);
  populateSelect();
  showChapterList();

  // restore last position from history, fallback to 0
  const hist = await fetch(`/api/history/${encodeURIComponent(file.name)}`).then(r => r.json()).catch(() => null);
  loadChapter(hist?.lastChapter ?? 0);
}

// ── load a single chapter ─────────────────────────────────────────────────
function loadChapter(idx) {
  if (idx < 0 || idx >= allChapters.length) return;
  currentChap = idx;
  currentPage = 0;
  pages = allChapters[idx].pages;

  location.hash = encodeURIComponent(currentFile.name) + '/' + idx;
  syncChapterActive();
  syncSelect();
  updateChapNav();
  renderViewer();

  fetch(`/api/history/${encodeURIComponent(currentFile.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: currentFile.type,
      lastChapter: idx,
      lastPage: 0,
      totalChapters: allChapters.length,
    }),
  }).catch(() => {});
}

function pageUrl(pg) {
  if (currentFile.type === 'epub')
    return `/api/epub/${encodeURIComponent(currentFile.name)}/image/${pg}`;
  return `/api/reader/${encodeURIComponent(currentFile.name)}/page/${pg}`;
}

// ── render ────────────────────────────────────────────────────────────────
function renderViewer() {
  viewer.className = `viewer ${mode}`;
  viewer.innerHTML = '';
  if (imgObserver) { imgObserver.disconnect(); imgObserver = null; }

  if (mode === 'horiz') renderHoriz();
  else                  renderVert();
}

// ── vertical mode ─────────────────────────────────────────────────────────
function renderVert() {
  let loadedCount = 0;
  const bar = Object.assign(document.createElement('div'), { className: 'load-bar' });
  viewer.appendChild(bar);

  function onLoad(wrap) {
    loadedCount++;
    bar.style.width = `${(loadedCount / pages.length) * 100}%`;
    if (loadedCount === pages.length) bar.style.opacity = '0';
    wrap.style.height = 'auto';
  }

  imgObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const img = e.target.querySelector('img');
      if (img && !img.src) {
        img.src = img.dataset.src;
        img.addEventListener('load',  () => onLoad(e.target), { once: true });
        img.addEventListener('error', () => onLoad(e.target), { once: true });
      }
    });
  }, { root: viewer, rootMargin: '1000px 0px' });

  pages.forEach((pg, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    wrap.style.height = '1400px';

    const img = new Image();
    img.className = 'page-img';
    img.alt = `Trang ${i + 1}`;
    img.dataset.src = pageUrl(pg);

    if (i < 2) {
      img.src = img.dataset.src;
      img.addEventListener('load',  () => onLoad(wrap), { once: true });
      img.addEventListener('error', () => onLoad(wrap), { once: true });
    }

    wrap.appendChild(img);
    viewer.appendChild(wrap);
    imgObserver.observe(wrap);
  });

  viewer.addEventListener('scroll', onVertScroll, { passive: true });
  updatePageInfo();
}

function onVertScroll() {
  const wraps = viewer.querySelectorAll('.page-wrap');
  if (!wraps.length) return;
  const mid = viewer.scrollTop + viewer.clientHeight / 2;
  let best = 0, bestDist = Infinity;
  wraps.forEach((w, i) => {
    const dist = Math.abs(w.offsetTop + w.offsetHeight / 2 - mid);
    if (dist < bestDist) { bestDist = dist; best = i; }
  });
  if (best !== currentPage) { currentPage = best; updatePageInfo(); }
}

// ── horizontal mode ───────────────────────────────────────────────────────
function renderHoriz() {
  const prev = document.createElement('div');
  prev.className = 'nav-zone nav-prev';
  prev.addEventListener('click', () => navigate(-1));
  viewer.appendChild(prev);

  const img = new Image();
  img.className = 'page-img';
  viewer.appendChild(img);

  const next = document.createElement('div');
  next.className = 'nav-zone nav-next';
  next.addEventListener('click', () => navigate(1));
  viewer.appendChild(next);

  showPage(0);
}

function showPage(idx) {
  if (idx < 0 || idx >= pages.length) return;
  currentPage = idx;
  viewer.querySelector('.page-img').src = pageUrl(pages[idx]);
  updatePageInfo();
}

function navigate(dir) {
  const next = currentPage + dir;
  if (next < 0)             { prevChap(); return; }
  if (next >= pages.length) { nextChap(); return; }
  showPage(next);
}

function updatePageInfo() {
  pageInfo.textContent = pages.length ? `${currentPage + 1} / ${pages.length}` : '';
}

// ── chapter nav (prev/next buttons) ──────────────────────────────────────
function updateChapNav() {
  $('btn-prev-chap').disabled = currentChap <= 0;
  $('btn-next-chap').disabled = currentChap < 0 || currentChap >= allChapters.length - 1;
}

function prevChap() { loadChapter(currentChap - 1); }
function nextChap() { loadChapter(currentChap + 1); }

// ── file nav ──────────────────────────────────────────────────────────────
function updateFileNav() {
  const idx = files.indexOf(currentFile);
  // reuse prev/next buttons for file nav when no chapter is loaded yet
  $('btn-prev-chap').disabled = idx <= 0;
  $('btn-next-chap').disabled = idx < 0 || idx >= files.length - 1;
}

$('btn-prev-chap').addEventListener('click', () => {
  if (allChapters.length) prevChap(); else loadVolume(files[files.indexOf(currentFile) - 1]);
});
$('btn-next-chap').addEventListener('click', () => {
  if (allChapters.length) nextChap(); else loadVolume(files[files.indexOf(currentFile) + 1]);
});

// ── chapter select dropdown ───────────────────────────────────────────────
chapSelect.addEventListener('change', () => loadChapter(+chapSelect.value));

// ── mode toggle ───────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  localStorage.setItem('reader-mode', m);
  $('btn-vert').classList.toggle('active',  m === 'vert');
  $('btn-horiz').classList.toggle('active', m === 'horiz');
  if (pages.length) renderViewer();
}

// apply saved mode on load
$('btn-vert').classList.toggle('active',  mode === 'vert');
$('btn-horiz').classList.toggle('active', mode === 'horiz');

$('btn-vert').addEventListener('click',  () => setMode('vert'));
$('btn-horiz').addEventListener('click', () => setMode('horiz'));

// ── keyboard ──────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (mode === 'horiz') {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(-1);
  } else {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') nextChap();
    if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   prevChap();
  }
});

// ── touch swipe ───────────────────────────────────────────────────────────
let touchStartX = 0;
viewer.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
viewer.addEventListener('touchend', e => {
  if (mode !== 'horiz') return;
  const dx = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(dx) > 40) navigate(dx > 0 ? 1 : -1);
}, { passive: true });

// ── mobile sidebar ────────────────────────────────────────────────────────
function closeSidebar() {
  if (window.innerWidth <= 640) {
    $('sidebar').classList.add('hidden');
    overlay.classList.remove('show');
  }
}

$('menu-btn').addEventListener('click', () => {
  const sb = $('sidebar');
  const open = !sb.classList.contains('hidden');
  sb.classList.toggle('hidden', open);
  overlay.classList.toggle('show', !open);
});
overlay.addEventListener('click', closeSidebar);

if (window.innerWidth <= 640) $('sidebar').classList.add('hidden');

// ── util ──────────────────────────────────────────────────────────────────
function fmtSize(b) {
  return b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB';
}

init();
