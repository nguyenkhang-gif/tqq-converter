# Wattpad → EPUB Converter

Chuyển đổi HTML lưu từ Wattpad thành file EPUB.

## Yêu cầu

- Node.js >= 18
- package.json có `"type": "module"`

## Cài đặt

```bash
npm install
```

Các dependency cần có:

```json
"cheerio": "^1.x",
"epub-gen": "^0.x"
```

## Cách lấy dữ liệu HTML

Không dùng "Save Page As" toàn bộ — chỉ cần copy phần `<article>` chứa nội dung truyện:

1. Mở trang truyện trên Wattpad (từng chương hoặc nhiều chương).
2. Nhấn **F12** → tab **Elements**.
3. Tìm và copy từng thẻ `<article class="story-part">` — mỗi thẻ gồm tiêu đề (`<h1>`) và toàn bộ nội dung chương.
4. Dán tất cả các `<article>` vào file `data.html` (không cần `<html>`, `<head>`, hay `<body>`).

Ví dụ `data.html` tối giản:

```html
<article class="story-part">
  <div class="part-header"><h1>Chương 1</h1></div>
  <div class="panel-reading">
    <p data-p-id="1">Nội dung đoạn 1...</p>
    <p data-p-id="2">Nội dung đoạn 2...</p>
  </div>
</article>

<article class="story-part">
  <div class="part-header"><h1>Chương 2</h1></div>
  <div class="panel-reading">
    <p data-p-id="3">Nội dung đoạn 1...</p>
  </div>
</article>
```

## Sử dụng

1. Chuẩn bị file `data.html` theo hướng dẫn trên, đặt trong cùng thư mục.
2. Chỉnh các biến ở đầu `app.js` nếu cần:

```js
const inputFile = 'data.html';
const epubTitle = 'Gimai Seikatsu Vol 4';
const epubAuthor = 'DuyAnhBi4';
```

3. Chạy:

```bash
node app.js
```

4. Xác nhận `y` khi được hỏi — file `<epubTitle>.epub` sẽ được tạo trong cùng thư mục.

## Cấu trúc HTML hỗ trợ

Script đọc các thẻ theo cấu trúc mặc định của Wattpad:

| Thẻ | Ý nghĩa |
|-----|---------|
| `article.story-part` | Một chương |
| `.part-header h1` | Tiêu đề chương |
| `div.panel-reading p[data-p-id]` | Đoạn văn nội dung |
