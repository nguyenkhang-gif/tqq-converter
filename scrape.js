import puppeteer from 'puppeteer';
import fs from 'fs';

const URL = 'https://www.wattpad.com/story/296617061';

async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let lastHeight = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, 800);
        const newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) {
          clearInterval(timer);
          resolve();
        }
        lastHeight = newHeight;
      }, 300);
    });
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 900 });
  console.log(`🌐 Đang mở: ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('⏬ Đang scroll xuống cuối trang...');
  await scrollToBottom(page);

  // Chờ thêm để lazy-load render xong
  await new Promise(r => setTimeout(r, 2000));

  const articles = await page.evaluate(() => {
    return [...document.querySelectorAll('article.story-part')]
      .map(el => el.outerHTML)
      .join('\n\n');
  });

  if (!articles) {
    console.error('❌ Không tìm thấy thẻ <article> nào!');
    await browser.close();
    process.exit(1);
  }

  const count = (articles.match(/<article/g) || []).length;
  fs.writeFileSync('data.html', articles, 'utf8');
  console.log(`✅ Đã lưu ${count} chương vào data.html`);

  await browser.close();
})();
