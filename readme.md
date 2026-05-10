# Wattpad → EPUB Converter

Automatically scrape content from Wattpad and generate an EPUB file.

## Requirements

- Node.js >= 18

## Installation

```bash
npm install
```

## Workflow

```
scrape.js  →  data.html  →  app.js  →  .epub
```

---

## Step 1 — Scrape content (`scrape.js`)

Open `scrape.js` and add chapter URLs to the `URLS` array:

```js
const URLS = [
  'https://www.wattpad.com/1173022060-chapter-1',
  'https://www.wattpad.com/1173066655-chapter-2',
  // ...
];
```

Run the scraper:

```bash
npm run scrape
```

The script will:
1. If `data.html` already exists — ask whether to delete it or keep it (append to the end)
2. Open Chrome and visit each URL in order
3. Scroll 800px at a time with a 1-second delay — stops when it hits the navigation element or reaches the bottom of the page
4. Continue scrolling past the navigation to load chapter-end comments, click "Hiển thị thêm / Show more" until exhausted, then click every "Xem N trả lời / View replies" to expand reply threads
5. Extract `<article class="story-part">` together with the final `<div class="comments-list">`, wrap them in `<section class="chapter-bundle">`, and **write to `data.html` immediately** before moving to the next chapter

> If interrupted, all chapters already scraped are safely kept in `data.html`.
> To skip comment scraping, set `SCRAPE_COMMENTS = false` at the top of `scrape.js`.

---

## Step 2 — Generate EPUB (`app.js`)

Edit the book info at the top of `app.js`:

```js
const epubTitle  = 'Gimai Seikatsu Vol 4';
const epubAuthor = 'DuyAnhBi4';
```

Optionally place a cover image named `cover.jpg` / `cover.png` in the same directory.

Run:

```bash
npm start
```

Confirm `y` when prompted — the file `<epubTitle>.epub` will be created in the same directory.

---

## Supported HTML Structure

| Tag | Meaning |
|-----|---------|
| `section.chapter-bundle` | A chapter wrapper (article + its comments) |
| `article.story-part` | A single chapter |
| `.part-header h1` | Chapter title |
| `div.panel-reading p[data-p-id]` | Paragraph content |
| `div.comments-list` | Chapter-end comments section |
| `div.comment-card-container` | A single comment (or reply if nested) |
| `h3.title-action` | Comment author username |
| `.pill__HVTvX` | Author badge (e.g. "Tác Giả") |
| `pre.text-body-sm` | Comment body text |
| `p.postedDate__xcq5D` | Comment posted-date label |

Each chapter renders the original paragraphs followed by a `💬 Bình luận (N)` section listing every captured top-level comment and reply (replies are indented).
