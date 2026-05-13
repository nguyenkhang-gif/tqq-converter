import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..'); // project root

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const bus = new EventEmitter();
bus.setMaxListeners(100);

let job = null;
let child = null;

const readCfg = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const saveCfg = cfg => fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(cfg, null, 2));

function push(data) {
  if (job) job.logs.push(data);
  bus.emit('data', data);
}

function parseProgress(text) {
  // scrape.js logs "[3/50]"
  let m = text.match(/\[(\d+)\/(\d+)\]/);
  if (m) return { done: +m[1], total: +m[2] };
  // compressImg.js writes "   34/456" after \r
  m = text.replace(/\r/g, '\n').match(/^\s*(\d+)\/(\d+)\s*$/m);
  if (m) return { done: +m[1], total: +m[2] };
  return null;
}

function runScript(script, args = []) {
  return new Promise((resolve, reject) => {
    child = spawn('node', [path.join('services', script), ...args], { cwd: ROOT });

    const handle = (buf, level) => {
      const text = buf.toString();
      push({ t: 'log', text, level });
      const p = parseProgress(text);
      if (p && job) { job.progress = p; push({ t: 'progress', ...p }); }
    };

    child.stdout.on('data', b => handle(b, 'info'));
    child.stderr.on('data', b => handle(b, 'warn'));
    child.on('close', code => {
      child = null;
      (code === 0 || code === null) ? resolve() : reject(new Error(`Process exited with code ${code}`));
    });
    child.on('error', e => { child = null; reject(e); });
  });
}

async function runJob(steps) {
  const cfg = readCfg();
  job = { steps, step: 0, logs: [], progress: null, status: 'running' };
  push({ t: 'status', status: 'running', steps });

  try {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      job.step = i;
      job.progress = null;
      push({ t: 'step', step: s, i, total: steps.length });

      if      (s === 'fetchHtml')     await runScript('fetchHtml.js', [cfg.manga.indexUrl]);
      else if (s === 'chapters')      await runScript('getChapters.js');
      else if (s === 'scrape')        await runScript('scrape.js');
      else if (s === 'compress')      await runScript('compressImg.js');
      else if (s === 'epub')          await runScript('toEpub.js');
      else if (s === 'epub:webtoon')  await runScript('toEpub.js', ['--webtoon']);
      else if (s === 'cbz')           await runScript('toCbz.js');
    }
    job.status = 'done';
    push({ t: 'status', status: 'done' });
  } catch (err) {
    job.status = 'error';
    push({ t: 'status', status: 'error', error: err.message });
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

app.get('/api/config', (_req, res) => res.json(readCfg()));

app.post('/api/config', (req, res) => {
  saveCfg(req.body);
  res.json({ ok: true });
});

app.get('/api/status', (_req, res) => {
  if (!job) return res.json({ running: false });
  res.json({
    running: job.status === 'running',
    status: job.status,
    steps: job.steps,
    step: job.step,
    progress: job.progress,
  });
});

// Server-Sent Events — streams all job events in real time
app.get('/api/log', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  const send = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
  if (job) job.logs.forEach(send); // replay buffer for reconnects
  bus.on('data', send);
  req.on('close', () => bus.off('data', send));
});

app.post('/api/run', (req, res) => {
  if (job?.status === 'running') return res.status(409).json({ error: 'A job is already running' });
  const { config, steps } = req.body;
  if (!steps?.length) return res.status(400).json({ error: 'steps required' });
  if (config) saveCfg(config);
  res.json({ ok: true });
  runJob(steps); // non-blocking — progress streams via SSE
});

app.post('/api/stop', (_req, res) => {
  if (child) { child.kill('SIGTERM'); child = null; }
  if (job?.status === 'running') {
    job.status = 'stopped';
    push({ t: 'status', status: 'stopped' });
  }
  res.json({ ok: true });
});

// ── Reader API ────────────────────────────────────────────────────────────────

function getOutputDirs() {
  const cfg = readCfg();
  return {
    epubs: path.join(ROOT, cfg.epub?.outputDir ?? 'epubs'),
    cbzs:  path.join(ROOT, cfg.cbz?.outputDir  ?? 'cbzs'),
  };
}

app.get('/api/files', (_req, res) => {
  const { epubs, cbzs } = getOutputDirs();
  const list = [];
  for (const [type, dir] of [['epub', epubs], ['cbz', cbzs]]) {
    if (!fs.existsSync(dir)) continue;
    fs.readdirSync(dir)
      .filter(f => f.endsWith(`.${type}`))
      .forEach(f => {
        const stat = fs.statSync(path.join(dir, f));
        list.push({ name: f, type, size: stat.size, dir });
      });
  }
  res.json(list);
});

// List image paths inside a CBZ
app.get('/api/reader/:file/pages', (req, res) => {
  const { cbzs } = getOutputDirs();
  const filePath = path.join(cbzs, req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  try {
    const out = execSync(`unzip -l "${filePath}"`).toString();
    const pages = out.split('\n')
      .filter(l => /\.(jpe?g|png|gif)/i.test(l))
      .map(l => l.trim().split(/\s+/).slice(3).join(' '))
      .filter(Boolean)
      .sort();
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stream a single image from a CBZ
app.get('/api/reader/:file/page/*', (req, res) => {
  const { cbzs } = getOutputDirs();
  const filePath = path.join(cbzs, req.params.file);
  const imgPath  = req.params[0];
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const ext = path.extname(imgPath).toLowerCase();
  res.setHeader('Content-Type', ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg');

  const proc = spawn('unzip', ['-p', filePath, imgPath]);
  proc.stdout.pipe(res);
  proc.stderr.on('data', () => {});
  proc.on('error', () => res.status(500).end());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌐  Manga Converter UI → http://localhost:${PORT}\n`);
});
