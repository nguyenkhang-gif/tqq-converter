import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const { outputDir: SCRAPE_DIR, limit } = cfg.scrape;
const { outputFile: EPUB_NAME, sections, inputDir } = cfg.epub;
const { outputDir: CBZ_OUT_DIR = 'cbzs' } = cfg.cbz ?? {};
const INPUT_DIR = inputDir ?? SCRAPE_DIR;

const CBZ_NAME = EPUB_NAME.replace(/\.epub$/i, '.cbz');
const BUILD_DIR = '.cbz-build';

fs.mkdirSync(CBZ_OUT_DIR, { recursive: true });

function buildCbz(chapters, cbzName) {
  let totalPages = 0;

  if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true });
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  for (let ci = 0; ci < chapters.length; ci++) {
    const chapterId = chapters[ci];
    const chapterDir = path.join(BUILD_DIR, String(ci + 1).padStart(4, '0') + '-' + chapterId);
    fs.mkdirSync(chapterDir, { recursive: true });

    const images = fs.readdirSync(path.join(INPUT_DIR, chapterId))
      .filter(f => /\.(jpe?g|png|gif)$/i.test(f))
      .sort();

    for (let pi = 0; pi < images.length; pi++) {
      const ext = path.extname(images[pi]);
      const destName = String(pi + 1).padStart(4, '0') + ext;
      fs.copyFileSync(path.join(INPUT_DIR, chapterId, images[pi]), path.join(chapterDir, destName));
    }

    totalPages += images.length;
  }

  const outPath = path.resolve(CBZ_OUT_DIR, cbzName);
  console.log(`📚 ${chapters.length} chapters, ${totalPages} pages → ${outPath}`);
  console.log('📦 Packaging CBZ...');

  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  execSync(`cd "${BUILD_DIR}" && zip -r "${outPath}" .`);
  fs.rmSync(BUILD_DIR, { recursive: true });
  console.log(`✅ Done! File: ./${CBZ_OUT_DIR}/${cbzName}`);
}

let allChapters = fs.readdirSync(INPUT_DIR)
  .filter(d => fs.statSync(path.join(INPUT_DIR, d)).isDirectory())
  .sort();
if (limit) allChapters = allChapters.slice(0, limit);

if (allChapters.length === 0) {
  console.error(`❌ No chapters found in ./${INPUT_DIR}/`);
  process.exit(1);
}

if (sections && sections.length > 0) {
  for (const sec of sections) {
    const from = Math.max(0, (sec.from ?? 1) - 1);
    const to = sec.to != null ? sec.to : allChapters.length;
    const slice = allChapters.slice(from, to);
    if (slice.length === 0) {
      console.warn(`⚠️  Section "${sec.name}" has no chapters (from ${sec.from} to ${sec.to}), skipping.`);
      continue;
    }
    buildCbz(slice, sec.name.replace(/\.epub$/i, '.cbz'));
  }
} else {
  buildCbz(allChapters, CBZ_NAME);
}
