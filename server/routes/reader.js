import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { ROOT, readCfg } from '../lib/config.js';

const router = Router();

function getCbzDir() {
  const cfg = readCfg();
  return path.join(ROOT, cfg.cbz?.outputDir ?? 'cbzs');
}

function getOutputDirs() {
  const cfg = readCfg();
  return {
    epubs: path.join(ROOT, cfg.epub?.outputDir  ?? 'epubs'),
    cbzs:  path.join(ROOT, cfg.cbz?.outputDir   ?? 'cbzs'),
  };
}

// List all output files (epub + cbz)
router.get('/files', (_req, res) => {
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
router.get('/reader/:file/pages', (req, res) => {
  const filePath = path.join(getCbzDir(), req.params.file);
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
router.get('/reader/:file/page/*', (req, res) => {
  const filePath = path.join(getCbzDir(), req.params.file);
  const imgPath  = req.params[0];
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const ext = path.extname(imgPath).toLowerCase();
  const mime = { '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext] ?? 'image/jpeg';
  res.setHeader('Content-Type', mime);

  const proc = spawn('unzip', ['-p', filePath, imgPath]);
  proc.stdout.pipe(res);
  proc.stderr.on('data', () => {});
  proc.on('error', () => res.status(500).end());
});

export default router;
