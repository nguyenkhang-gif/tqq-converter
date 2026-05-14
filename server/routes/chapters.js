import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { ROOT, readCfg } from '../lib/config.js';

const router = Router();

function getOutputDir() {
  const cfg = readCfg();
  return path.join(ROOT, cfg.scrape?.outputDir ?? 'output');
}

// List chapter folders in output/
router.get('/', (_req, res) => {
  const dir = getOutputDir();
  if (!fs.existsSync(dir)) return res.json([]);
  const chapters = fs.readdirSync(dir)
    .filter(f => fs.statSync(path.join(dir, f)).isDirectory())
    .sort();
  res.json(chapters);
});

// List images in a chapter folder
router.get('/:chapter/pages', (req, res) => {
  const chapterDir = path.join(getOutputDir(), req.params.chapter);
  if (!fs.existsSync(chapterDir)) return res.status(404).json({ error: 'Not found' });
  const pages = fs.readdirSync(chapterDir)
    .filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f))
    .sort();
  res.json(pages);
});

// Serve an image from a chapter folder
router.get('/:chapter/page/:filename', (req, res) => {
  const imgPath = path.join(getOutputDir(), req.params.chapter, req.params.filename);
  if (!fs.existsSync(imgPath)) return res.status(404).end();
  const ext = path.extname(imgPath).toLowerCase();
  const mime = { '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext] ?? 'image/jpeg';
  res.setHeader('Content-Type', mime);
  fs.createReadStream(imgPath).pipe(res);
});

export default router;
