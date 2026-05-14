import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

if (process.argv[2] === '--reset') {
  const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  cfg.cbz.readerDir = null;
  fs.writeFileSync('config.json', JSON.stringify(cfg, null, 2) + '\n');
  console.log(`✅ Reset về default: ${cfg.cbz?.outputDir ?? 'cbzs'}/`);
  process.exit(0);
}

let dest = process.argv[2];
if (!dest) {
  if (process.platform === 'darwin') {
    try {
      dest = execSync(
        `osascript -e 'POSIX path of (choose folder with prompt "Chọn thư mục đích để export CBZ:")'`
      ).toString().trim();
    } catch {
      console.error('❌ Không chọn được folder. Thoát.');
      process.exit(1);
    }
  } else {
    console.error('Usage: node export-cbz.js <destination-path>');
    console.error('Example: node export-cbz.js /Volumes/ExternalDrive/Manga');
    process.exit(1);
  }
}

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const srcDir = path.resolve(cfg.cbz?.outputDir ?? 'cbzs');
const destDir = path.resolve(dest);

if (!fs.existsSync(srcDir)) {
  console.error(`❌ Source folder not found: ${srcDir}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

console.log(`\n📂 Source : ${srcDir}`);
console.log(`📂 Dest   : ${destDir}\n`);

if (process.platform !== 'win32') {
  // rsync: only copy new/changed files, trailing slash to copy contents
  execSync(`rsync -av --progress "${srcDir}/" "${destDir}/"`, { stdio: 'inherit' });
} else {
  // fallback: manual copy, skip existing same-size files
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.cbz'));
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dst = path.join(destDir, file);
    const srcSize = fs.statSync(src).size;
    if (fs.existsSync(dst) && fs.statSync(dst).size === srcSize) {
      console.log(`  skip  ${file}`);
      continue;
    }
    fs.copyFileSync(src, dst);
    console.log(`  copy  ${file}`);
  }
}

// Save readerDir to config
cfg.cbz.readerDir = destDir;
fs.writeFileSync('config.json', JSON.stringify(cfg, null, 2) + '\n');
console.log(`\n✅ Done! Reader will now load from: ${destDir}`);
