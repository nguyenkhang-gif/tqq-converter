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

function unzipText(epubPath, innerPath) {
  try {
    return execSync(`unzip -p "${epubPath}" "${innerPath}"`, { maxBuffer: 10 * 1024 * 1024 }).toString();
  } catch { return null; }
}

function getAttr(str, attr) {
  const m = str.match(new RegExp(`${attr}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
}

function parseOpf(epubPath) {
  const container = unzipText(epubPath, 'META-INF/container.xml');
  if (!container) return null;
  const opfPath = container.match(/full-path=["']([^"']+)["']/i)?.[1];
  if (!opfPath) return null;
  const opf = unzipText(epubPath, opfPath);
  if (!opf) return null;
  const opfDir = path.dirname(opfPath) === '.' ? '' : path.dirname(opfPath);

  const manifest = {};
  const itemRe = /<item\s([^>]*)\/?>/gi;
  let m;
  while ((m = itemRe.exec(opf)) !== null) {
    const id = getAttr(m[1], 'id');
    const href = getAttr(m[1], 'href');
    const mediaType = getAttr(m[1], 'media-type');
    if (id && href) manifest[id] = { href: opfDir ? `${opfDir}/${href}` : href, mediaType };
  }

  const spine = [];
  const spineRe = /<itemref\s([^>]*)\/?>/gi;
  while ((m = spineRe.exec(opf)) !== null) {
    const idref = getAttr(m[1], 'idref');
    if (idref && manifest[idref]) spine.push({ ...manifest[idref], id: idref });
  }

  // Try NCX for titles
  const ncxItem = Object.values(manifest).find(v => v.mediaType === 'application/x-dtbncx+xml');
  const titles = [];
  if (ncxItem) {
    const ncx = unzipText(epubPath, ncxItem.href);
    if (ncx) {
      const npRe = /<navPoint[\s\S]*?<\/navPoint>/gi;
      let np;
      while ((np = npRe.exec(ncx)) !== null) {
        titles.push(np[0].match(/<text>([\s\S]*?)<\/text>/i)?.[1]?.trim() ?? '');
      }
    }
  }

  return { spine, manifest, opfDir, titles };
}

// GET /api/epub-text/:file/toc
router.get('/:file/toc', (req, res) => {
  const epubPath = path.join(getEpubDir(), req.params.file);
  if (!fs.existsSync(epubPath)) return res.status(404).json({ error: 'Not found' });
  try {
    const parsed = parseOpf(epubPath);
    if (!parsed) return res.status(500).json({ error: 'Cannot parse EPUB' });
    const { spine, titles } = parsed;
    const isImageOnly = spine.every(s => s.mediaType?.startsWith('image/'));
    res.json({
      isImageOnly,
      toc: spine.map((item, i) => ({ index: i, title: titles[i] || `Chapter ${i + 1}` })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/epub-text/:file/chapter/:index
router.get('/:file/chapter/:index', (req, res) => {
  const epubPath = path.join(getEpubDir(), req.params.file);
  if (!fs.existsSync(epubPath)) return res.status(404).json({ error: 'Not found' });
  try {
    const parsed = parseOpf(epubPath);
    if (!parsed) return res.status(500).json({ error: 'Cannot parse EPUB' });
    const { spine } = parsed;
    const index = parseInt(req.params.index);
    if (index < 0 || index >= spine.length) return res.status(404).json({ error: 'Chapter not found' });

    const item = spine[index];
    let html = unzipText(epubPath, item.href);
    if (!html) return res.status(500).json({ error: 'Cannot read chapter' });

    // Extract body content
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;

    // Rewrite relative src/href to proxy endpoint
    const chapterDir = path.dirname(item.href);
    const fileParam = encodeURIComponent(req.params.file);
    const rewritten = body.replace(/(src|href)=["'](?!https?:\/\/)([^"']+)["']/gi, (_, attr, src) => {
      if (src.startsWith('#')) return `${attr}="${src}"`;
      const assetPath = chapterDir && chapterDir !== '.' ? `${chapterDir}/${src}` : src;
      return `${attr}="/api/epub-text/${fileParam}/asset/${assetPath}"`;
    });

    res.json({ html: rewritten, total: spine.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/epub-text/:file/asset/* — stream images/assets
router.get('/:file/asset/*', (req, res) => {
  const epubPath = path.join(getEpubDir(), req.params.file);
  const assetPath = req.params[0];
  if (!fs.existsSync(epubPath)) return res.status(404).end();
  const ext = path.extname(assetPath).toLowerCase();
  const mimes = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.css': 'text/css',
  };
  if (mimes[ext]) res.setHeader('Content-Type', mimes[ext]);
  const proc = spawn('unzip', ['-p', epubPath, assetPath]);
  proc.stdout.pipe(res);
  proc.stderr.on('data', () => {});
  proc.on('error', () => res.status(500).end());
});

export default router;
