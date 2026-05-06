# Wattpad → EPUB Converter

Tự động scrape nội dung từ Wattpad và tạo file EPUB.

## Yêu cầu

- Node.js >= 18

## Cài đặt

```bash
npm install
```

## Workflow

```
scrape.js  →  data.html  →  app.js  →  .epub
```

---

## Bước 1 — Scrape nội dung (`scrape.js`)

Mở `scrape.js` và thêm link từng chương vào mảng `URLS`:

```js
const URLS = [
  'https://www.wattpad.com/1173022060-chuong-1',
  'https://www.wattpad.com/1173066655-chuong-2',
  // ...
];
```

Chạy scraper:

```bash
npm run scrape
```

Script sẽ:
1. Nếu `data.html` đã tồn tại — hỏi xóa hay giữ (append thêm vào cuối)
2. Mở Chrome, lần lượt mở từng link
3. Scroll từng bước 800px — delay 1 giây mỗi lần — dừng khi chạm thẻ điều hướng hoặc hết trang
4. Lấy `<article class="story-part">` và **ghi vào `data.html` ngay** trước khi chuyển chương

> Nếu bị ngắt giữa chừng, các chương đã scrape vẫn được giữ trong `data.html`.

---

## Bước 2 — Tạo EPUB (`app.js`)

Chỉnh thông tin sách ở đầu `app.js`:

```js
const epubTitle  = 'Gimai Seikatsu Vol 4';
const epubAuthor = 'DuyAnhBi4';
```

Đặt ảnh bìa (tùy chọn) tên `cover.jpg` / `cover.png` vào cùng thư mục.

Chạy:

```bash
npm start
```

Xác nhận `y` — file `<epubTitle>.epub` sẽ được tạo trong cùng thư mục.

---

## Cấu trúc HTML hỗ trợ

| Thẻ | Ý nghĩa |
|-----|---------|
| `article.story-part` | Một chương |
| `.part-header h1` | Tiêu đề chương |
| `div.panel-reading p[data-p-id]` | Đoạn văn nội dung |
