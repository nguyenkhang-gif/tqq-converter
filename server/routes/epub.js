import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { ROOT, readCfg } from '../lib/config.js';

const router = Router();

function getEpubDir() {
  const cfg = readCfg();
  return path.join(ROOT, cfg.epub?.outputDir ?? 'epubs');
}

// List image paths inside an EPUB (same unzip -l approach as CBZ)
router.get('/:file/pages', (req, res) => {
  const filePath = path.join(getEpubDir(), req.params.file);
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

// Stream a single image from an EPUB
router.get('/:file/image/*', (req, res) => {
  const filePath = path.join(getEpubDir(), req.params.file);
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
