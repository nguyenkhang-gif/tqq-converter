import * as cheerio from 'cheerio';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const BASE_URL = cfg.manga.indexUrl ?? 'https://truyenqqko.com';

if (!fs.existsSync('data.html')) {
  console.error('❌ data.html not found. Save the chapter list page HTML as data.html and try again.');
  process.exit(1);
}

const html = fs.readFileSync('data.html', 'utf8');
const $ = cheerio.load(html);
const chapters = [];

const selectors = [
  '.name-chap a',
  '.item-name a',
  '.works-chapter-item a',
  '.chapter-name',
  '.list-chapter a',
  'a[href*="chap-"]',
];

let matched = false;
for (const sel of selectors) {
  const els = $(sel);
  if (els.length === 0) continue;

  els.each((_, el) => {
    const name = $(el).text().trim();
    const href = $(el).attr('href');
    if (!href) return;
    const url = href.startsWith('http') ? href : new URL(href, BASE_URL).href;
    const numMatch = name.match(/(\d+(\.\d+)?)/);
    const num = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1;
    chapters.push({ num, name, url });
  });

  if (chapters.length > 0) {
    console.log(`✅ Using selector: "${sel}"`);
    matched = true;
    break;
  }
}

if (!matched || chapters.length === 0) {
  console.error('❌ No chapters found in data.html. Check the selector.');
  process.exit(1);
}

const unique = [...new Map(chapters.map(c => [c.url, c])).values()];
unique.sort((a, b) => a.num - b.num);

console.log(`📚 Found ${unique.length} chapters`);
unique.forEach(c => console.log(`   [${c.num}] ${c.name} — ${c.url}`));

fs.writeFileSync('chapters.json', JSON.stringify(unique, null, 2));
console.log('\n💾 Saved chapters.json');

cfg.scrape.urls = unique.map(c => c.url);
fs.writeFileSync('config.json', JSON.stringify(cfg, null, 2));
console.log('⚙️  Updated config.json > scrape.urls');
