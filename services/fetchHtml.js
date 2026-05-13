import puppeteer from 'puppeteer';
import fs from 'fs';

const url = process.argv[2];
if (!url) { console.error('❌ No URL provided'); process.exit(1); }

console.log(`🌐 Opening: ${url}`);
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 60000 });
try {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  fs.writeFileSync('data.html', html);
  console.log(`✅ Saved data.html (${(html.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
