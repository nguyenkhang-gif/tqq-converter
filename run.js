import { scrape } from './services/scrape.js';
import { toEpub } from './services/toEpub.js';

console.log('=== MANGA DOWNLOADER ===\n');
await scrape();
console.log('\n--- Converting to EPUB ---\n');
toEpub();
