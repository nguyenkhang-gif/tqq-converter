import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { ROOT, readCfg, saveCfg } from '../lib/config.js';
import { state, bus, push, runJob } from '../lib/job.js';

const router = Router();

router.get('/status', (_req, res) => {
  if (!state.job) return res.json({ running: false });
  res.json({
    running:  state.job.status === 'running',
    status:   state.job.status,
    steps:    state.job.steps,
    step:     state.job.step,
    progress: state.job.progress,
  });
});

// Server-Sent Events — streams all job events in real time
router.get('/log', (req, res) => {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  });
  const send = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
  if (state.job) state.job.logs.forEach(send); // replay buffer for reconnects
  bus.on('data', send);
  req.on('close', () => bus.off('data', send));
});

router.post('/run', (req, res) => {
  if (state.job?.status === 'running') return res.status(409).json({ error: 'A job is already running' });
  const { config, steps } = req.body;
  if (!steps?.length) return res.status(400).json({ error: 'steps required' });
  if (config) saveCfg(config);
  res.json({ ok: true });
  runJob(steps); // non-blocking — progress streams via SSE
});

router.delete('/log', (_req, res) => {
  if (state.job) state.job.logs = [];
  res.json({ ok: true });
});

router.post('/stop', (_req, res) => {
  if (state.child) { state.child.kill('SIGTERM'); state.child = null; }
  if (state.job?.status === 'running') {
    state.job.status = 'stopped';
    push({ t: 'status', status: 'stopped' });
  }
  res.json({ ok: true });
});

router.get('/output-stats', (_req, res) => {
  const cfg = readCfg();
  const dirs = {
    output: cfg.scrape?.outputDir ?? 'output',
    compress: cfg.compress?.outputDir ?? 'output-compress',
  };
  const stats = {};
  for (const [key, d] of Object.entries(dirs)) {
    const full = path.join(ROOT, d);
    if (!fs.existsSync(full)) { stats[key] = { chapters: 0, images: 0 }; continue; }
    const chapters = fs.readdirSync(full).filter(n => fs.statSync(path.join(full, n)).isDirectory());
    let images = 0;
    for (const ch of chapters) {
      const chPath = path.join(full, ch);
      images += fs.readdirSync(chPath).filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f)).length;
    }
    stats[key] = { chapters: chapters.length, images };
  }
  res.json(stats);
});

router.post('/cleanup', (_req, res) => {
  if (state.job?.status === 'running') return res.status(409).json({ error: 'Cannot clean up while a job is running' });
  const cfg = readCfg();
  const dirs = [
    cfg.scrape?.outputDir ?? 'output',
    cfg.compress?.outputDir ?? 'output-compress',
  ];
  const removed = [];
  for (const d of dirs) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
      fs.mkdirSync(full);
      removed.push(d);
    }
  }
  res.json({ ok: true, removed });
});

export default router;
