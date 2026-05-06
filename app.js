import fs from 'fs';
import path from 'path';
import readline from 'readline';
import * as cheerio from 'cheerio';
import Epub from 'epub-gen';

const inputFile = 'data.html';
const epubTitle = 'Gimai Seikatsu Vol 4';
const epubAuthor = 'DuyAnhBi4';

const LOCAL_COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function findLocalCover() {
  for (const ext of LOCAL_COVER_EXTENSIONS) {
    const p = `./cover${ext}`;
    if (fs.existsSync(p)) return p;
  }
  return null;
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

  // Ưu tiên file local cover.jpg/png/... nếu có
  const coverPath = findLocalCover();
  if (coverPath) {
    console.log(`🖼️  Dùng ảnh bìa local: ${coverPath}`);
  } else {
    console.log('⚠️  Không tìm thấy ảnh bìa local (cover.jpg / cover.png / ...)');
  }

  const chapters = [];

  // Mỗi <article> là một chương
  $('article.story-part').each((i, article) => {
    // Tiêu đề chương: lấy từ <h1> trong .part-header
    const title = $(article).find('.part-header h1').text().trim()
      || `Chương ${i + 1}`;

    // Nội dung: tất cả <p data-p-id> trong .panel-reading
    const paragraphs = [];
    $(article).find('div.panel-reading p[data-p-id]').each((j, p) => {
      // Xóa nút comment
      $(p).find('.component-wrapper').remove();

      // Giữ nguyên HTML (bao gồm <em>, <strong>, <i>,...)
      const inner = $(p).html().trim();
      if (inner && inner !== '<br>') {
        paragraphs.push(`<p>${inner}</p>`);
      }
    });

    if (paragraphs.length > 0) {
      chapters.push({
        title,
        data: paragraphs.join('\n')
      });
    }
  });

  if (chapters.length === 0) {
    console.log("⚠️ Không tìm thấy chương nào!");
    rl.close();
    return;
  }

  // Hiển thị danh sách chương
  console.log(`\n📘 File: ${inputFile}`);
  chapters.forEach((chap, idx) => {
    console.log(`  [${idx + 1}] ${chap.title}`);
  });

  rl.question(`\nBạn có muốn tạo EPUB "${epubTitle}.epub" không? (y/n): `, async (answer) => {
    if (answer.trim().toLowerCase() === 'y') {
      const option = {
        title: epubTitle,
        author: epubAuthor,
        cover: coverPath || undefined,
        content: chapters
      };

      try {
        await new Epub(option, `./${epubTitle}.epub`).promise;
        console.log(`✅ Đã tạo EPUB: ${epubTitle}.epub`);
      } catch (error) {
        console.error("❌ Lỗi khi tạo EPUB:", error);
      }
    } else {
      console.log("❌ Đã huỷ tạo EPUB.");
    }

    rl.close();
  });
})();