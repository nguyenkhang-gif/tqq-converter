import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import readline from 'readline';
import * as cheerio from 'cheerio';
import Epub from 'epub-gen';

const inputFile = 'data.html';
const epubTitle = 'Gimai Seikatsu Vol 9';
const epubAuthor = 'mis3ry';
const IMG_DIR = './epub-images';

const LOCAL_COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function findLocalCover() {
  for (const ext of LOCAL_COVER_EXTENSIONS) {
    const p = `./cover${ext}`;
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Download all <img> in chapters to local, replace src with absolute file path
async function localizeImages(chapters) {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR);

  let imgIndex = 0;
  for (const chapter of chapters) {
    const $ = cheerio.load(chapter.data, { xmlMode: false });
    const imgs = $('img').toArray();
    if (imgs.length === 0) continue;

    for (const el of imgs) {
      const src = $(el).attr('src');
      if (!src) continue;

      const ext = path.extname(src.split('?')[0]) || '.jpg';
      const filename = `img_${imgIndex++}${ext}`;
      const localPath = path.resolve(IMG_DIR, filename);

      try {
        await downloadFile(src, localPath);
        $(el).attr('src', localPath);
        console.log(`  🖼️  Downloaded: ${filename}`);
      } catch (e) {
        console.warn(`  ⚠️  Failed to download image: ${src.slice(0, 60)}...`);
      }
    }

    chapter.data = $('body').html();
  }
}

function renderComments($, $commentsList) {
  if (!$commentsList || $commentsList.length === 0) return '';

  const cards = $commentsList.find('.comment-card-container').toArray();
  if (cards.length === 0) return '';

  const items = [];
  for (const card of cards) {
    const $card = $(card);

    // Skip the comment-input field if it ever matches
    if ($card.find('textarea').length > 0 && $card.find('pre.text-body-sm').length === 0) continue;

    const author = $card.find('h3.title-action').first().text().trim();
    const badge = $card.find('.pill__HVTvX').first().text().trim();
    const $pre = $card.find('pre.text-body-sm').first();
    const text = $pre.length ? ($pre.html() || '').trim() : '';
    const date = $card.find('p.postedDate__xcq5D').first().text().trim();

    if (!author && !text) continue;

    const isReply = $card.parents('.comment-card-container').length > 0;
    const indentStyle = isReply
      ? 'margin:6px 0 6px 24px;border-left:3px solid #d0d0d0;padding:6px 10px;background:#fafafa;'
      : 'margin:10px 0;padding:8px 10px;border-bottom:1px solid #eee;';

    const badgeHtml = badge
      ? ` <span style="background:#a93e19;color:#fff;font-size:0.72em;padding:1px 6px;border-radius:3px;vertical-align:middle;">${badge}</span>`
      : '';

    const dateHtml = date
      ? ` <span style="color:#888;font-size:0.8em;margin-left:6px;">· ${date}</span>`
      : '';

    items.push(
      `<div style="${indentStyle}">` +
        `<div style="font-size:0.92em;"><strong>${author || '(ẩn danh)'}</strong>${badgeHtml}${dateHtml}</div>` +
        `<div style="margin-top:4px;white-space:pre-wrap;">${text}</div>` +
      `</div>`
    );
  }

  if (items.length === 0) return '';

  return (
    `\n<aside aria-hidden="true" role="doc-endnotes" class="wp-comments">\n` +
    `<hr style="margin-top:32px;border:none;border-top:1px solid #ccc;"/>\n` +
    `<h3 style="margin-top:16px;">💬 Bình luận (${items.length})</h3>\n` +
    `<div>${items.join('\n')}</div>\n` +
    `</aside>`
  );
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let html;
try {
  html = fs.readFileSync(inputFile, 'utf8');
} catch (err) {
  console.error("❌ Lỗi khi đọc file:", err);
  process.exit(1);
}

(async () => {
  const $ = cheerio.load(html);

  const coverPath = findLocalCover();
  if (coverPath) {
    console.log(`🖼️  Cover: ${coverPath}`);
  } else {
    console.log('⚠️  No local cover found (cover.jpg / cover.png / ...)');
  }

  const chapters = [];

  // Iterate top-level articles. For each article, look for the matching comments-list:
  // - If wrapped in <section class="chapter-bundle">, take the comments-list inside that section
  // - Otherwise, fall back to the next .comments-list sibling (if any)
  $('article.story-part').each((i, article) => {
    const $article = $(article);
    const title = $article.find('.part-header h1').text().trim() || `Chapter ${i + 1}`;

    const paragraphs = [];
    $article.find('div.panel-reading p[data-p-id]').each((j, p) => {
      $(p).find('.component-wrapper').remove();
      const inner = $(p).html().trim();
      if (inner && inner !== '<br>') {
        paragraphs.push(`<p>${inner}</p>`);
      }
    });

    let $commentsList;
    const $bundle = $article.closest('section.chapter-bundle');
    if ($bundle.length > 0) {
      $commentsList = $bundle.find('.comments-list').first();
    } else {
      $commentsList = $article.nextAll('.comments-list').first();
    }

    const commentsHtml = renderComments($, $commentsList);

    if (paragraphs.length > 0 || commentsHtml) {
      chapters.push({ title, data: paragraphs.join('\n') + commentsHtml });
    }
  });

  if (chapters.length === 0) {
    console.log("⚠️ No chapters found!");
    rl.close();
    return;
  }

  const hasImg = chapters.some(c => c.data.includes('<img'));
  console.log(`\n🔍 Images in content: ${hasImg}`);

  if (hasImg) {
    const includeImgs = await new Promise(resolve => {
      rl.question('Include images in EPUB? (y/n): ', ans => resolve(ans.trim().toLowerCase() === 'y'));
    });

    if (includeImgs) {
      console.log('📥 Pre-downloading images to local...');
      await localizeImages(chapters);
    } else {
      chapters.forEach(c => {
        const $ = cheerio.load(c.data);
        $('img').remove();
        c.data = $('body').html();
      });
      console.log('🚫 Images removed from content.');
    }
  }

  console.log(`\n📘 File: ${inputFile}`);
  chapters.forEach((chap, idx) => {
    console.log(`  [${idx + 1}] ${chap.title}`);
  });

  rl.question(`\nCreate EPUB "${epubTitle}.epub"? (y/n): `, async (answer) => {
    if (answer.trim().toLowerCase() === 'y') {
      const option = {
        title: epubTitle,
        author: epubAuthor,
        cover: coverPath || undefined,
        content: chapters
      };

      try {
        await new Epub(option, `./${epubTitle}.epub`).promise;
        console.log(`✅ EPUB created: ${epubTitle}.epub`);
      } catch (error) {
        console.error("❌ Error creating EPUB:", error);
      } finally {
        if (fs.existsSync(IMG_DIR)) {
          fs.rmSync(IMG_DIR, { recursive: true, force: true });
          console.log('🗑️  Cleared epub-images/');
        }
      }
    } else {
      console.log("❌ Cancelled.");
    }

    rl.close();
  });
})();
