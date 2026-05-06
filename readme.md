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

## Sử dụng

1. Lưu trang Wattpad dưới dạng HTML (Save Page As) vào file `data.html` trong cùng thư mục.
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
