import path from 'path';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { ROOT, readCfg } from './config.js';

export const bus = new EventEmitter();
bus.setMaxListeners(100);

// Mutable state wrapped in object so all importers share the same reference
export const state = { job: null, child: null };

export function push(data) {
  if (state.job) state.job.logs.push(data);
  bus.emit('data', data);
}

function parseProgress(text) {
  let m = text.match(/\[(\d+)\/(\d+)\]/);
  if (m) return { done: +m[1], total: +m[2] };
  m = text.replace(/\r/g, '\n').match(/^\s*(\d+)\/(\d+)\s*$/m);
  if (m) return { done: +m[1], total: +m[2] };
  return null;
}

function runScript(script, args = []) {
  return new Promise((resolve, reject) => {
    state.child = spawn('node', [path.join('services', script), ...args], { cwd: ROOT });

    const handle = (buf, level) => {
      const text = buf.toString();
      push({ t: 'log', text, level });
      const p = parseProgress(text);
      if (p && state.job) { state.job.progress = p; push({ t: 'progress', ...p }); }
    };

    state.child.stdout.on('data', b => handle(b, 'info'));
    state.child.stderr.on('data', b => handle(b, 'warn'));
    state.child.on('close', code => {
      state.child = null;
      (code === 0 || code === null) ? resolve() : reject(new Error(`Process exited with code ${code}`));
    });
    state.child.on('error', e => { state.child = null; reject(e); });
  });
}

export async function runJob(steps) {
  const cfg = readCfg();
  state.job = { steps, step: 0, logs: [], progress: null, status: 'running' };
  push({ t: 'status', status: 'running', steps });

  try {
    for (let i = 0; i < steps.length; i++) {
      if (state.job.status !== 'running') break;
      const s = steps[i];
      state.job.step = i;
      state.job.progress = null;
      push({ t: 'step', step: s, i, total: steps.length });

      if (s === 'fetchHtml') {
        await runScript('fetchHtml.js', [cfg.manga.indexUrl]);
        if (state.job.status !== 'running') break;
        await runScript('getChapters.js');
      } else if (s === 'chapters')   await runScript('getChapters.js');
      else if (s === 'scrape')       await runScript('scrape.js');
      else if (s === 'compress')     await runScript('compressImg.js');
      else if (s === 'epub')         await runScript('toEpub.js');
      else if (s === 'epub:webtoon') await runScript('toEpub.js', ['--webtoon']);
      else if (s === 'cbz')          await runScript('toCbz.js');
    }
    if (state.job.status === 'running') {
      state.job.status = 'done';
      push({ t: 'status', status: 'done' });
    }
  } catch (err) {
    if (state.job.status !== 'stopped') {
      state.job.status = 'error';
      push({ t: 'status', status: 'error', error: err.message });
    }
  }
}
