import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const { title: MANGA_TITLE, author: MANGA_AUTHOR, language: LANG } = cfg.manga;
const { outputDir: SCRAPE_DIR, limit } = cfg.scrape;
const { outputFile: EPUB_NAME, buildDir: BUILD_DIR, sections, inputDir } = cfg.epub;
const INPUT_DIR = inputDir ?? SCRAPE_DIR;

const WEBTOON_MODE = process.argv.includes('--webtoon');

function mime(ext) {
  return ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
}

function uid() {
  return `urn:uuid:${Math.random().toString(36).slice(2)}-manga`;
}

function buildEpub(chapters, epubName, title = MANGA_TITLE) {
  const chapterPages = [];
  let totalPages = 0;
  for (let ci = 0; ci < chapters.length; ci++) {
    const chapterId = chapters[ci];
    const images = fs.readdirSync(path.join(INPUT_DIR, chapterId))
      .filter(f => /\.(jpe?g|png|gif)$/i.test(f))
      .sort()
      .map((imgFile, pi) => ({ chapterId, pageIdx: pi, imgFile, ext: path.extname(imgFile).toLowerCase() }));
    chapterPages.push({ chapterId, chapterIdx: ci, images });
    totalPages += images.length;
  }

  console.log(`📚 [${title}] ${chapters.length} chapters, ${totalPages} pages → ${epubName} (${WEBTOON_MODE ? 'webtoon' : 'paginated'})`);

  if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true });
  fs.mkdirSync(path.join(BUILD_DIR, 'META-INF'), { recursive: true });
  fs.mkdirSync(path.join(BUILD_DIR, 'OEBPS', 'images'), { recursive: true });
  fs.mkdirSync(path.join(BUILD_DIR, 'OEBPS', 'pages'), { recursive: true });

  fs.writeFileSync(path.join(BUILD_DIR, 'mimetype'), 'application/epub+zip');
  fs.writeFileSync(path.join(BUILD_DIR, 'META-INF', 'container.xml'), `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  const manifestItems = [];
  const spineItems = [];
  const navPoints = [];

  if (WEBTOON_MODE) {
    for (const { chapterId, chapterIdx, images } of chapterPages) {
      const imgDestDir = path.join(BUILD_DIR, 'OEBPS', 'images', chapterId);
      fs.mkdirSync(imgDestDir, { recursive: true });

      const imgTags = images.map(({ imgFile, ext }) => {
        fs.copyFileSync(path.join(INPUT_DIR, chapterId, imgFile), path.join(imgDestDir, imgFile));
        manifestItems.push(`    <item id="img-${chapterId}-${imgFile}" href="images/${chapterId}/${imgFile}" media-type="${mime(ext)}"/>`);
        return `  <img src="../images/${chapterId}/${imgFile}" alt="${imgFile}"/>`;
      }).join('\n');

      fs.writeFileSync(path.join(BUILD_DIR, 'OEBPS', 'pages', `${chapterId}.xhtml`),
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${chapterId.replace(/-/g, ' ')}</title>
  <style>html,body{margin:0;padding:0;background:#000;width:100%;}img{display:block;margin:0 auto;max-width:100%;height:auto;}</style>
</head>
<body>
${imgTags}
</body>
</html>`);

      manifestItems.push(`    <item id="page-${chapterId}" href="pages/${chapterId}.xhtml" media-type="application/xhtml+xml"/>`);
      spineItems.push(`    <itemref idref="page-${chapterId}"/>`);
      navPoints.push(`    <navPoint id="nav-${chapterIdx + 1}" playOrder="${chapterIdx + 1}">
      <navLabel><text>${chapterId.replace(/-/g, ' ')}</text></navLabel>
      <content src="pages/${chapterId}.xhtml"/>
    </navPoint>`);
    }
  } else {
    for (const { chapterId, chapterIdx, images } of chapterPages) {
      const imgDestDir = path.join(BUILD_DIR, 'OEBPS', 'images', chapterId);
      fs.mkdirSync(imgDestDir, { recursive: true });
      let firstPageId = null;

      for (const { pageIdx, imgFile, ext } of images) {
        const pageId = `${chapterId}-${String(pageIdx).padStart(3, '0')}`;
        if (firstPageId === null) firstPageId = pageId;

        fs.copyFileSync(path.join(INPUT_DIR, chapterId, imgFile), path.join(imgDestDir, imgFile));
        fs.writeFileSync(path.join(BUILD_DIR, 'OEBPS', 'pages', `${pageId}.xhtml`),
          `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${pageId}</title>
  <style>html,body{margin:0;padding:0;background:#000;width:100%;height:100%;}img{display:block;margin:0 auto;max-width:100%;height:auto;}</style>
</head>
<body><img src="../images/${chapterId}/${imgFile}" alt="${pageId}"/></body>
</html>`);

        manifestItems.push(`    <item id="img-${pageId}" href="images/${chapterId}/${imgFile}" media-type="${mime(ext)}"/>`);
        manifestItems.push(`    <item id="page-${pageId}" href="pages/${pageId}.xhtml" media-type="application/xhtml+xml"/>`);
        spineItems.push(`    <itemref idref="page-${pageId}"/>`);
      }

      if (firstPageId) {
        navPoints.push(`    <navPoint id="nav-${chapterIdx + 1}" playOrder="${chapterIdx + 1}">
      <navLabel><text>${chapterId.replace(/-/g, ' ')}</text></navLabel>
      <content src="pages/${firstPageId}.xhtml"/>
    </navPoint>`);
      }
    }
  }

  const bookId = uid();
  const renditionMeta = WEBTOON_MODE ? '' : `
    <meta name="rendition:layout" content="pre-paginated"/>
    <meta name="rendition:orientation" content="auto"/>
    <meta name="rendition:spread" content="auto"/>`;

  fs.writeFileSync(path.join(BUILD_DIR, 'OEBPS', 'content.opf'),
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${title}</dc:title>
    <dc:creator>${MANGA_AUTHOR}</dc:creator>
    <dc:language>${LANG}</dc:language>
    <dc:identifier id="bookId">${bookId}</dc:identifier>
    <meta name="book-type" content="comic"/>${renditionMeta}
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems.join('\n')}
  </manifest>
  <spine toc="ncx">
${spineItems.join('\n')}
  </spine>
</package>`);

  fs.writeFileSync(path.join(BUILD_DIR, 'OEBPS', 'toc.ncx'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${bookId}"/></head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>
${navPoints.join('\n')}
  </navMap>
</ncx>`);

  if (fs.existsSync(epubName)) fs.unlinkSync(epubName);
  console.log('📦 Packaging EPUB...');
  execSync(`cd ${BUILD_DIR} && zip -0 -X "../${epubName}" mimetype`);
  execSync(`cd ${BUILD_DIR} && zip -r "../${epubName}" META-INF OEBPS`);
  fs.rmSync(BUILD_DIR, { recursive: true });
  console.log(`✅ Done! File: ./${epubName}`);
}

export function toEpub() {
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
      buildEpub(slice, sec.name, sec.title ?? path.basename(sec.name, '.epub'));
    }
  } else {
    buildEpub(allChapters, EPUB_NAME);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) toEpub();
