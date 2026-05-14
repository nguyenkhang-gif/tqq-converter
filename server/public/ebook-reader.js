let currentFile = null;
let currentIndex = 0;
let totalChapters = 0;
let fontSize = parseInt(localStorage.getItem('ebook-font-size') ?? '17');
let theme = localStorage.getItem('ebook-theme') ?? 'dark';

// ── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  applyFontSize();
  applyTheme();
  await loadFileList();
  const params = new URLSearchParams(location.search);
  const file = params.get('file');
  if (file) await openBook(file);
})();

// ── File list ─────────────────────────────────────────────────────────────────
async function loadFileList() {
  const res = await fetch('/api/files');
  if (!res.ok) return;
  const files = await res.json();
  const epubs = files.filter(f => f.type === 'epub');
  const container = document.getElementById('fileList');

  if (epubs.length === 0) {
    container.innerHTML = '<div style="padding:10px 12px;color:var(--muted);font-size:12px">No EPUB files found</div>';
    return;
  }

  container.innerHTML = '<div style="padding:6px 10px 4px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Files</div>';
  epubs.forEach(({ name }) => {
    const btn = document.createElement('button');
    btn.className = 'chap-btn';
    btn.id = `file-${name}`;
    btn.textContent = name.replace(/\.epub$/i, '');
    btn.title = name;
    btn.style.cssText = 'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    btn.onclick = () => { openBook(name); closeSidebar(); };
    container.appendChild(btn);
  });
}

// ── Book loading ──────────────────────────────────────────────────────────────
async function openBook(file) {
  currentFile = file;
  document.getElementById('bookTitle').textContent = file.replace(/\.epub$/i, '');
  document.querySelectorAll('[id^="file-"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`file-${file}`)?.classList.add('active');

  const res = await fetch(`/api/epub-text/${encodeURIComponent(file)}/toc`);
  if (!res.ok) { showError('Cannot parse EPUB'); return; }
  const { toc, isImageOnly } = await res.json();

  if (isImageOnly) {
    showError('This EPUB contains only images. Use the main Reader instead.');
    return;
  }

  totalChapters = toc.length;
  buildToc(toc);

  const startIndex = parseInt(localStorage.getItem(`ebook-pos-${file}`) ?? '0');
  await loadChapter(Math.min(startIndex, totalChapters - 1));
}

function buildToc(toc) {
  const list = document.getElementById('chapList');
  list.innerHTML = '';
  const select = document.getElementById('chapSelect');
  select.innerHTML = '';
  select.disabled = false;

  toc.forEach(({ index, title }) => {
    const btn = document.createElement('button');
    btn.className = 'chap-btn';
    btn.id = `chap-${index}`;
    btn.textContent = title;
    btn.onclick = () => { loadChapter(index); closeSidebar(); };
    list.appendChild(btn);

    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = title;
    select.appendChild(opt);
  });
}

async function loadChapter(index) {
  if (!currentFile || index < 0 || index >= totalChapters) return;
  currentIndex = index;

  // Update UI state
  document.querySelectorAll('.chap-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`chap-${index}`)?.classList.add('active');
  document.getElementById(`chap-${index}`)?.scrollIntoView({ block: 'nearest' });
  document.getElementById('chapSelect').value = index;
  document.getElementById('btnPrev').disabled = index === 0;
  document.getElementById('btnNext').disabled = index === totalChapters - 1;

  const viewer = document.getElementById('viewer');
  viewer.innerHTML = '<div class="placeholder"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`/api/epub-text/${encodeURIComponent(currentFile)}/chapter/${index}`);
    if (!res.ok) throw new Error('Failed to load chapter');
    const { html } = await res.json();

    const content = document.createElement('div');
    content.className = 'chapter-content';
    content.innerHTML = html;
    viewer.innerHTML = '';
    viewer.appendChild(content);
    viewer.scrollTop = 0;

    localStorage.setItem(`ebook-pos-${currentFile}`, index);
    history.replaceState(null, '', `?file=${encodeURIComponent(currentFile)}`);
  } catch (err) {
    showError(err.message);
  }
}

function prevChapter() { loadChapter(currentIndex - 1); }
function nextChapter() { loadChapter(currentIndex + 1); }

// ── Settings panel ────────────────────────────────────────────────────────────
function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('hidden');
}
document.addEventListener('click', e => {
  const wrap = document.querySelector('.settings-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('settingsPanel')?.classList.add('hidden');
  }
});

// ── Theme ─────────────────────────────────────────────────────────────────────
function setTheme(t) {
  theme = t;
  localStorage.setItem('ebook-theme', t);
  applyTheme();
}
function applyTheme() {
  document.body.className = theme === 'dark' ? '' : `theme-${theme}`;
  ['dark', 'sepia', 'light'].forEach(t => {
    document.getElementById(`btn${t[0].toUpperCase() + t.slice(1)}`)?.classList.toggle('active', t === theme);
  });
}

// ── Font size ─────────────────────────────────────────────────────────────────
function changeFontSize(delta) {
  fontSize = Math.min(28, Math.max(12, fontSize + delta));
  localStorage.setItem('ebook-font-size', fontSize);
  applyFontSize();
}
function applyFontSize() {
  document.documentElement.style.setProperty('--font-size', `${fontSize}px`);
  const el = document.getElementById('fontSizeVal');
  if (el) el.textContent = `${fontSize}px`;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('overlay');
  s.classList.toggle('hidden');
  o.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('overlay').classList.remove('show');
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextChapter();
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevChapter();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) {
  document.getElementById('viewer').innerHTML =
    `<div class="placeholder"><span>⚠️ ${msg}</span></div>`;
}
