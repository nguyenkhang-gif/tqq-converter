import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const { title: MANGA_TITLE, author: MANGA_AUTHOR, language: LANG } = cfg.manga;
const { outputDir: INPUT_DIR, limit } = cfg.scrape;
const { outputFile: EPUB_NAME, buildDir: BUILD_DIR, sections } = cfg.epub;

function mime(ext) {
  return ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
}

function uid() {
  return `urn:uuid:${Math.random().toString(36).slice(2)}-manga`;
}

function buildEpub(chapters, epubName) {
  const pages = [];
  for (let ci = 0; ci < chapters.length; ci++) {
    const chapterId = chapters[ci];
    const images = fs.readdirSync(path.join(INPUT_DIR, chapterId))
      .filter(f => /\.(jpe?g|png|gif)$/i.test(f))
      .sort();
    for (let pi = 0; pi < images.length; pi++) {
      pages.push({ chapterIdx: ci, chapterId, pageIdx: pi, imgFile: images[pi], ext: path.extname(images[pi]).toLowerCase() });
    }
  }

  console.log(`📚 ${chapters.length} chapters, ${pages.length} pages → ${epubName}`);

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

  for (const p of pages) {
    const pageId = `${p.chapterId}-${String(p.pageIdx).padStart(3, '0')}`;
    const imgDestDir = path.join(BUILD_DIR, 'OEBPS', 'images', p.chapterId);
    fs.mkdirSync(imgDestDir, { recursive: true });
    fs.copyFileSync(path.join(INPUT_DIR, p.chapterId, p.imgFile), path.join(imgDestDir, p.imgFile));

    fs.writeFileSync(path.join(BUILD_DIR, 'OEBPS', 'pages', `${pageId}.xhtml`),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${pageId}</title>
  <style>html,body{margin:0;padding:0;background:#000;width:100%;height:100%;}img{display:block;margin:0 auto;max-width:100%;height:auto;}</style>
</head>
<body><img src="../images/${p.chapterId}/${p.imgFile}" alt="${pageId}"/></body>
</html>`);

    manifestItems.push(`    <item id="img-${pageId}" href="images/${p.chapterId}/${p.imgFile}" media-type="${mime(p.ext)}"/>`);
    manifestItems.push(`    <item id="page-${pageId}" href="pages/${pageId}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`    <itemref idref="page-${pageId}"/>`);
  }

  const navPoints = chapters.map((chId, ci) => {
    const first = pages.find(p => p.chapterId === chId);
    if (!first) return '';
    const pageId = `${chId}-${String(first.pageIdx).padStart(3, '0')}`;
    return `    <navPoint id="nav-${ci + 1}" playOrder="${ci + 1}">
      <navLabel><text>${chId.replace(/-/g, ' ')}</text></navLabel>
      <content src="pages/${pageId}.xhtml"/>
    </navPoint>`;
  }).join('\n');

  const bookId = uid();

  fs.writeFileSync(path.join(BUILD_DIR, 'OEBPS', 'content.opf'),
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${MANGA_TITLE}</dc:title>
    <dc:creator>${MANGA_AUTHOR}</dc:creator>
    <dc:language>${LANG}</dc:language>
    <dc:identifier id="bookId">${bookId}</dc:identifier>
    <meta name="book-type" content="comic"/>
    <meta name="rendition:layout" content="pre-paginated"/>
    <meta name="rendition:orientation" content="auto"/>
    <meta name="rendition:spread" content="auto"/>
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
  <docTitle><text>${MANGA_TITLE}</text></docTitle>
  <navMap>
${navPoints}
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
      buildEpub(slice, sec.name);
    }
  } else {
    buildEpub(allChapters, EPUB_NAME);
  }
}

if (process.argv[1].endsWith('toEpub.js')) toEpub();
