import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36');
await page.goto('https://truyenqq.com.vn/gia-toc-diep-vien-yozakura', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));

const info = await page.evaluate(() => {
  // Lấy tất cả các link có chứa "chapter" hoặc "chuong"
  const allLinks = [...document.querySelectorAll('a[href]')]
    .map(a => ({ text: a.textContent.trim().slice(0, 60), href: a.href }))
    .filter(a => /chapter|chuong|chap/i.test(a.href) || /chapter|chuong/i.test(a.text));
  return { links: allLinks.slice(0, 20), bodySnippet: document.body.innerHTML.slice(0, 3000) };
});

console.log('=== CHAPTER LINKS ===');
console.log(JSON.stringify(info.links, null, 2));
console.log('\n=== BODY SNIPPET ===');
console.log(info.bodySnippet);

await browser.close();
