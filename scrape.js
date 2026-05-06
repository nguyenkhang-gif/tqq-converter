import puppeteer from 'puppeteer';
import fs from 'fs';
import readline from 'readline';

const URLS = [
  'https://www.wattpad.com/1173022060-gimai-seikatsu-vol-4-ch%C6%B0%C6%A1ng-1-ng%C3%A0y-3-th%C3%A1ng-9-th%E1%BB%A9',
  // thêm link các chương khác vào đây
];

const SCROLL_STEP = 800;
const SCROLL_DELAY = 1000;
const OUTPUT_FILE = 'data.html';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

async function scrollUntilEnd(page) {
  while (true) {
    const status = await page.evaluate((step) => {
      const nav = document.querySelector('#story-part-navigation');
      if (nav && nav.getBoundingClientRect().top <= window.innerHeight) return 'nav';
      const before = window.scrollY;
      window.scrollBy(0, step);
      return window.scrollY === before ? 'bottom' : 'scrolling';
    }, SCROLL_STEP);

    if (status === 'nav' || status === 'bottom') break;
    await sleep(SCROLL_DELAY);
  }
}

(async () => {
  if (fs.existsSync(OUTPUT_FILE)) {
    const ans = await ask(`⚠️  "${OUTPUT_FILE}" đã tồn tại. Xóa và scrape lại từ đầu? (y/n): `);
    if (ans === 'y') {
      fs.unlinkSync(OUTPUT_FILE);
      console.log(`🗑️  Đã xóa ${OUTPUT_FILE}`);
    } else {
      console.log(`📝 Giữ file cũ, append thêm vào cuối.`);
    }
  }

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  let saved = 0;

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`\n📖 [${i + 1}/${URLS.length}] ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);

    console.log('  ⏬ Đang scroll...');
    await scrollUntilEnd(page);

    const articleHtml = await page.evaluate(() => {
      const el = document.querySelector('article.story-part');
      return el ? el.outerHTML : null;
    });

    if (articleHtml) {
      // Append vào file ngay, không chờ xong hết
      fs.appendFileSync(OUTPUT_FILE, articleHtml + '\n\n', 'utf8');
      saved++;
      console.log(`  ✅ Đã lưu chương ${i + 1} vào ${OUTPUT_FILE}`);
    } else {
      console.warn(`  ⚠️  Không tìm thấy <article>, bỏ qua`);
    }
  }

  await browser.close();
  console.log(`\n✅ Hoàn tất! ${saved}/${URLS.length} chương đã lưu vào ${OUTPUT_FILE}`);
})();
