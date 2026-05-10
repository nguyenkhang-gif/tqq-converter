import puppeteer from 'puppeteer';
import fs from 'fs';
import readline from 'readline';

const URLS = [
  "https://www.wattpad.com/1424837505-gimai-seikatsu-volume-9-minh-h%E1%BB%8Da",
  "https://www.wattpad.com/1460358306-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-1-12-th%C3%A1ng-6-th%E1%BB%A9",
  "https://www.wattpad.com/1461225048-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-2-12-th%C3%A1ng-6-th%E1%BB%A9",
  "https://www.wattpad.com/1463032555-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-3-13-th%C3%A1ng-6-ch%E1%BB%A7",
  "https://www.wattpad.com/1465868098-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-4-13-th%C3%A1ng-6-ch%E1%BB%A7",
  "https://www.wattpad.com/1465877236-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-5-14-th%C3%A1ng-6-th%E1%BB%A9",
  "https://www.wattpad.com/1465894379-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-6-14-th%C3%A1ng-6-th%E1%BB%A9",
  "https://www.wattpad.com/1466125555-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-7-15-th%C3%A1ng-6-th%E1%BB%A9-ba",
  "https://www.wattpad.com/1469369984-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-8-15-th%C3%A1ng-6-th%E1%BB%A9-ba",
  "https://www.wattpad.com/1469398585-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-9-20-th%C3%A1ng-7-th%E1%BB%A9-ba",
  "https://www.wattpad.com/1469664011-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-10-20-th%C3%A1ng-7-th%E1%BB%A9",
  "https://www.wattpad.com/1471120026-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-11-22-th%C3%A1ng-7-th%E1%BB%A9",
  "https://www.wattpad.com/1471344137-gimai-seikatsu-volume-9-ch%C6%B0%C6%A1ng-12-22-th%C3%A1ng-7-th%E1%BB%A9"
];

const SCROLL_STEP = 800;
const SCROLL_DELAY = 1000;
const OUTPUT_FILE = 'data.html';

const SCRAPE_COMMENTS = true;
const COMMENT_SCROLL_DELAY = 1200;
const COMMENT_MAX_ITERATIONS = 80;
const REPLY_MAX_CLICKS = 200;

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

async function loadAllComments(page) {
  let stagnant = 0;
  let lastHeight = 0;

  for (let i = 0; i < COMMENT_MAX_ITERATIONS; i++) {
    const result = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const loadMore = buttons.find(b => {
        if (b.disabled || b.offsetParent === null) return false;
        const text = (b.textContent || '').trim().toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        return text.startsWith('hiển thị thêm')
            || text.startsWith('xem thêm')
            || text.startsWith('show more')
            || text.startsWith('load more')
            || aria.includes('show more')
            || aria.includes('load more');
      });

      if (loadMore) {
        loadMore.scrollIntoView({ block: 'center' });
        loadMore.click();
        return { action: 'clicked', height: document.documentElement.scrollHeight };
      }

      window.scrollTo(0, document.documentElement.scrollHeight);
      return { action: 'scrolled', height: document.documentElement.scrollHeight };
    });

    await sleep(COMMENT_SCROLL_DELAY);

    if (result.height === lastHeight && result.action === 'scrolled') {
      stagnant++;
      if (stagnant >= 3) break;
    } else {
      stagnant = 0;
      lastHeight = result.height;
    }
  }
}

async function expandAllReplies(page) {
  for (let i = 0; i < REPLY_MAX_CLICKS; i++) {
    const clicked = await page.evaluate(() => {
      const isReplyBtn = (b) => {
        if (b.disabled || b.offsetParent === null) return false;
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        if (aria === 'view replies') return true;
        const text = (b.textContent || '').trim().toLowerCase();
        return text.startsWith('xem ') && text.includes('trả lời') && !text.startsWith('trả lời');
      };
      const target = Array.from(document.querySelectorAll('button')).find(isReplyBtn);
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.click();
        return true;
      }
      return false;
    });

    if (!clicked) break;
    await sleep(700);
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

    console.log('  ⏬ Đang scroll nội dung chương...');
    await scrollUntilEnd(page);

    if (SCRAPE_COMMENTS) {
      console.log('  💬 Đang load comments...');
      await loadAllComments(page);
      console.log('  💬 Đang mở rộng replies...');
      await expandAllReplies(page);
      // After replies expand, more comments may load — scroll a bit more
      await loadAllComments(page);
    }

    const result = await page.evaluate(() => {
      const article = document.querySelector('article.story-part');
      if (!article) return null;
      const lists = document.querySelectorAll('.comments-list');
      const comments = lists.length ? lists[lists.length - 1] : null;
      return {
        article: article.outerHTML,
        comments: comments ? comments.outerHTML : ''
      };
    });

    if (result) {
      const bundle =
        `<section class="chapter-bundle">\n${result.article}\n${result.comments}\n</section>\n\n`;
      fs.appendFileSync(OUTPUT_FILE, bundle, 'utf8');
      saved++;
      console.log(`  ✅ Đã lưu chương ${i + 1} (${result.comments ? 'kèm comments' : 'không có comments'}) vào ${OUTPUT_FILE}`);
    } else {
      console.warn(`  ⚠️  Không tìm thấy <article>, bỏ qua`);
    }
  }

  await browser.close();
  console.log(`\n✅ Hoàn tất! ${saved}/${URLS.length} chương đã lưu vào ${OUTPUT_FILE}`);
})();
