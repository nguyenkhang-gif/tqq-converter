import { Router } from 'express';
import { saveCfg } from '../lib/config.js';
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

router.post('/stop', (_req, res) => {
  if (state.child) { state.child.kill('SIGTERM'); state.child = null; }
  if (state.job?.status === 'running') {
    state.job.status = 'stopped';
    push({ t: 'status', status: 'stopped' });
  }
  res.json({ ok: true });
});

export default router;
