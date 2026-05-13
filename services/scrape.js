import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const {
  urls: _URLS, from = 1, limit, concurrency = 1,
  outputDir: OUTPUT_DIR, referer: REFERER, scroll: SCROLL,
  waitAfterLoad, waitAfterScroll, waitBetweenChapters,
  headless = true, imgSelector = '.page-chapter img',
} = cfg.scrape;
const start = Math.max(0, from - 1);
const URLS = _URLS.slice(start, limit ? start + limit : undefined);

function createPool(size) {
  let active = 0;
  const queue = [];
  return function run(fn) {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        if (active < size) {
          active++;
          fn().then(resolve, reject).finally(() => {
            active--;
            if (queue.length) queue.shift()();
          });
        } else {
          queue.push(attempt);
        }
      };
      attempt();
    });
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { Referer: REFERER } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

export async function scrape() {
  if (URLS.length === 0) {
    console.error('❌ No URLs found in config.json > scrape.urls');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (concurrency > 1) console.log(`⚡ Running ${concurrency} chapters in parallel`);

  const pool = createPool(concurrency);

  async function scrapeChapter(url, i, attempt = 1) {
    const chNum = start + i + 1;
    const chapterDir = path.join(OUTPUT_DIR, `chapter-${String(chNum).padStart(3, '0')}`);
    fs.mkdirSync(chapterDir, { recursive: true });

    console.log(`\n📖 [${i + 1}/${URLS.length}] ${url}${attempt > 1 ? ` (retry ${attempt})` : ''}`);

    let browser;
    try {
      browser = await puppeteer.launch({ headless, protocolTimeout: 60000 });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(waitAfterLoad);

      console.log(`   [ch${chNum}] ⏬ Scrolling...`);
      await page.evaluate(({ distance, delay }) => new Promise(resolve => {
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
            clearInterval(timer); resolve();
          }
        }, delay);
      }), SCROLL);
      await sleep(waitAfterScroll);

      const imgUrls = await page.evaluate(
        sel => [...document.querySelectorAll(sel)]
          .map(img => img.src || img.dataset.original || img.dataset.src)
          .filter(src => src && !src.startsWith('data:')),
        imgSelector,
      );

      if (imgUrls.length === 0) {
        console.warn(`   [ch${chNum}] ⚠️  No images found, skipping.`);
      } else {
        console.log(`   [ch${chNum}] 🖼️  ${imgUrls.length} images, downloading...`);
        for (let j = 0; j < imgUrls.length; j++) {
          const ext = path.extname(new URL(imgUrls[j]).pathname) || '.jpg';
          const dest = path.join(chapterDir, `${String(j).padStart(3, '0')}${ext}`);
          try { await downloadImage(imgUrls[j], dest); }
          catch (err) { console.warn(`\n   [ch${chNum}] ⚠️  Failed image ${j}: ${err.message}`); }
        }
        console.log(`   [ch${chNum}] ✅ Done (${imgUrls.length} images)`);
      }
    } catch (err) {
      if (attempt <= 3) {
        console.warn(`   [ch${chNum}] ⚠️  Error: ${err.message} — retrying in 5s...`);
        await browser?.close();
        await sleep(5000);
        return scrapeChapter(url, i, attempt + 1);
      }
      console.warn(`   [ch${chNum}] ❌ Failed after 3 attempts: ${err.message}`);
    } finally {
      await browser?.close();
    }

    await sleep(waitBetweenChapters);
  }

  await Promise.all(URLS.map((url, i) => pool(() => scrapeChapter(url, i))));
  console.log(`\n✅ Done! Images saved to ./${OUTPUT_DIR}/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) scrape();
