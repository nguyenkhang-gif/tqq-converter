import fs from 'fs';

const defaultConfig = {
  manga: {
    title: 'Manga Title',
    author: 'Author Name',
    language: 'vi',
    indexUrl: 'https://truyenqqko.com/truyen-tranh/...',
  },
  scrape: {
    outputDir: 'output',
    referer: 'https://truyenqqko.com/',
    headless: true,
    concurrency: 1,
    from: 1,
    limit: null,
    imgSelector: '.page-chapter img',
    scroll: { distance: 400, delay: 100 },
    waitAfterLoad: 2000,
    waitAfterScroll: 1500,
    waitBetweenChapters: 1000,
    urls: [],
  },
  epub: {
    inputDir: null,
    outputFile: 'manga.epub',
    buildDir: '.epub-build',
    sections: null,
  },
  compress: {
    quality: 80,
    maxWidth: null,
    concurrency: 4,
    outputDir: 'output-compress',
  },
};

const dirs = ['output'];
const files = {
  'data.html': '<!-- Paste the chapter list page HTML here -->\n',
  'config.json': JSON.stringify(defaultConfig, null, 2) + '\n',
};

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created  ${dir}/`);
  } else {
    console.log(`Exists   ${dir}/`);
  }
}

for (const [file, content] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, content);
    console.log(`Created  ${file}`);
  } else {
    console.log(`Exists   ${file}`);
  }
}

console.log('\nDone. Edit config.json, then fill in data.html and run:');
console.log('  node getChapters.js');
console.log('  node run.js');
