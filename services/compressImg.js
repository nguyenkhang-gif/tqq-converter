import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const INPUT_DIR = cfg.scrape.outputDir;
const { quality = 80, maxWidth = null, concurrency = 4, outputDir = 'output-compress', webp = false } = cfg.compress ?? {};

async function compressImage(srcPath, destPath) {
  const ext = path.extname(srcPath).toLowerCase();
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (ext === '.gif') {
    fs.copyFileSync(srcPath, destPath);
    return null;
  }

  let pipeline = sharp(srcPath);
  if (maxWidth) pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });

  if (webp) {
    await pipeline.webp({ quality }).toFile(destPath);
  } else if (ext === '.png') {
    await pipeline.png({ quality, compressionLevel: 9 }).toFile(destPath);
  } else {
    await pipeline.jpeg({ quality, mozjpeg: true }).toFile(destPath);
  }

  const before = fs.statSync(srcPath).size;
  const after = fs.statSync(destPath).size;
  return { before, after };
}

function createPool(size) {
  let active = 0;
  const queue = [];
  return function run(fn) {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        if (active < size) {
          active++;
          fn().then(resolve, reject).finally(() => {
            active--;
            if (queue.length) queue.shift()();
          });
        } else {
          queue.push(attempt);
        }
      };
      attempt();
    });
  };
}

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`❌ Output directory not found: ./${INPUT_DIR}/`);
  process.exit(1);
}

const chapters = fs.readdirSync(INPUT_DIR)
  .filter(d => fs.statSync(path.join(INPUT_DIR, d)).isDirectory())
  .sort();

if (chapters.length === 0) {
  console.error(`❌ No chapters found in ./${INPUT_DIR}/`);
  process.exit(1);
}

console.log(`📂 Input:  ./${INPUT_DIR}/`);
console.log(`📂 Output: ./${outputDir}/`);

const tasks = [];
for (const chapter of chapters) {
  const images = fs.readdirSync(path.join(INPUT_DIR, chapter))
    .filter(f => /\.(jpe?g|png|gif)$/i.test(f))
    .sort();
  for (const img of images) {
    const destName = webp && !/\.gif$/i.test(img)
      ? img.replace(/\.[^.]+$/, '.webp')
      : img;
    tasks.push({ src: path.join(INPUT_DIR, chapter, img), dest: path.join(outputDir, chapter, destName) });
  }
}

const modeLabel = webp ? 'WebP' : 'JPEG/PNG';
console.log(`🗜️  ${tasks.length} images across ${chapters.length} chapters → ${modeLabel} q${quality} (concurrency: ${concurrency})\n`);

let totalBefore = 0, totalAfter = 0, done = 0;
const pool = createPool(concurrency);

await Promise.all(tasks.map(({ src, dest }) => pool(async () => {
  const result = await compressImage(src, dest);
  if (result) { totalBefore += result.before; totalAfter += result.after; }
  done++;
  process.stdout.write(`\r   ${done}/${tasks.length}`);
})));

const saved = totalBefore - totalAfter;
const pct = totalBefore > 0 ? ((saved / totalBefore) * 100).toFixed(1) : 0;
console.log(`\n\n✅ Done`);
console.log(`   Before: ${(totalBefore / 1024 / 1024).toFixed(1)} MB`);
console.log(`   After:  ${(totalAfter / 1024 / 1024).toFixed(1)} MB`);
console.log(`   Saved:  ${(saved / 1024 / 1024).toFixed(1)} MB (${pct}%)`);
