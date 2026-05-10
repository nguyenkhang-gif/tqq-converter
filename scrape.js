import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const { urls: _URLS, limit, outputDir: OUTPUT_DIR, referer: REFERER, scroll: SCROLL, waitAfterLoad, waitAfterScroll, waitBetweenChapters, headless = true, imgSelector = '.page-chapter img' } = cfg.scrape;
const URLS = limit ? _URLS.slice(0, limit) : _URLS;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export async function scrape() {
  if (URLS.length === 0) {
    console.error('❌ No URLs found in config.json > scrape.urls');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    const chapterDir = path.join(OUTPUT_DIR, `chapter-${String(i + 1).padStart(3, '0')}`);
    fs.mkdirSync(chapterDir, { recursive: true });

    console.log(`\n📖 [${i + 1}/${URLS.length}] ${url}`);

    const browser = await puppeteer.launch({ headless });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36');

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(waitAfterLoad);

      console.log(`   ⏬ Scrolling to trigger lazy load...`);
      await page.evaluate(({ distance, delay }) => {
        return new Promise(resolve => {
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, delay);
        });
      }, SCROLL);
      await sleep(waitAfterScroll);

      const imgUrls = await page.evaluate((sel) =>
        [...document.querySelectorAll(sel)]
          .map(img => img.src || img.dataset.original || img.dataset.src)
          .filter(src => src && !src.startsWith('data:'))
      , imgSelector);

      if (imgUrls.length === 0) {
        console.warn(`   ⚠️  No images found, skipping.`);
      } else {
        console.log(`   🖼️  ${imgUrls.length} images, downloading...`);

        for (let j = 0; j < imgUrls.length; j++) {
          const imgUrl = imgUrls[j];
          const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
          const dest = path.join(chapterDir, `${String(j).padStart(3, '0')}${ext}`);
          try {
            await downloadImage(imgUrl, dest);
            process.stdout.write(`\r   ✅ ${j + 1}/${imgUrls.length}`);
          } catch (err) {
            console.warn(`\n   ⚠️  Failed to download image ${j}: ${err.message}`);
          }
        }
        console.log(`\n   ✅ Chapter ${i + 1} done`);
      }
    } catch (err) {
      console.warn(`   ❌ Error: ${err.message}`);
    } finally {
      await browser.close();
      console.log(`   🔒 Browser closed`);
    }

    await sleep(waitBetweenChapters);
  }

  console.log(`\n✅ Done! Images saved to ./${OUTPUT_DIR}/`);
}

if (process.argv[1].endsWith('scrape.js')) scrape();
