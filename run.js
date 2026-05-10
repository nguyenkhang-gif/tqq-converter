import { scrape } from './scrape.js';
import { toEpub } from './toEpub.js';

console.log('=== MANGA DOWNLOADER ===\n');
await scrape();
console.log('\n--- Converting to EPUB ---\n');
toEpub();
