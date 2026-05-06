import fs from 'fs';
import readline from 'readline';
import * as cheerio from 'cheerio';
import Epub from 'epub-gen';

const inputFile = 'data.html';
const epubTitle = 'Gimai Seikatsu Vol 4';
const epubAuthor = 'DuyAnhBi4';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

fs.readFile(inputFile, 'utf8', async (err, html) => {
  if (err) {
    console.error("❌ Lỗi khi đọc file:", err);
    return;
  }

  const $ = cheerio.load(html);
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
});