# Manga Downloader & EPUB Converter

Download manga images from truyenqqko.com and package them into an EPUB file.

## Installation

```bash
npm install
npm run init
```

`npm run init` creates the required folders and a blank `data.html` placeholder so you don't have to create them manually.

## Full Workflow (recommended)

```
1. Save the chapter list page HTML as data.html
2. node getChapters.js   ← parse data.html, update config.json
3. node run.js           ← download images + create EPUB
```

---

## Configuration — `config.json`

All settings are in `config.json`, no code changes needed.

```json
{
  "manga": {
    "title": "Manga title",      // Title shown in EPUB
    "author": "Author name",
    "language": "vi",
    "indexUrl": "https://..."    // Chapter list page URL (used by getChapters.js)
  },
  "scrape": {
    "outputDir": "output",       // Directory to save images
    "referer": "https://...",    // Referer header when downloading images
    "headless": true,            // true = run in background, false = show browser
    "limit": null,               // Max chapters to process (null = all)
    "imgSelector": ".page-chapter img", // CSS selector for images in chapter page
    "scroll": {
      "distance": 400,           // Pixels per scroll step
      "delay": 200               // Milliseconds between scroll steps
    },
    "waitAfterLoad": 2000,       // Wait after page load (ms)
    "waitAfterScroll": 1500,     // Wait after scrolling (ms)
    "waitBetweenChapters": 1000, // Wait between chapters (ms)
    "urls": [                    // Chapter URLs (auto-updated by getChapters.js)
      "https://truyenqqko.com/truyen-tranh/...chap-1",
      "https://truyenqqko.com/truyen-tranh/...chap-2"
    ]
  },
  "epub": {
    "outputFile": "manga.epub",  // Output EPUB filename
    "buildDir": ".epub-build"    // Temp directory (auto-deleted after build)
  }
}
```

## Usage

### 1. Get chapter list from HTML file

Open the chapter list page in your browser → **Save As** → save as `data.html` in this directory, then run:

```bash
node getChapters.js
```

Parses `data.html` using the `.name-chap a` selector, saves to `chapters.json`, and auto-updates `scrape.urls` in `config.json`.

### 2. Run full flow (scrape + create EPUB)

```bash
node run.js
```

### Download images only

```bash
node scrape.js
```

Opens a new browser per chapter (headless), scrolls to trigger lazy loading, downloads images into `output/chapter-XXX/`.

### Create EPUB from existing images

```bash
node toEpub.js
```

## Directory Structure

```
.
├── config.json         ← main configuration
├── data.html           ← chapter list HTML (manually saved from browser)
├── chapters.json       ← output of getChapters.js
├── getChapters.js      ← parse data.html → update config
├── scrape.js           ← download images from URLs
├── toEpub.js           ← package images into EPUB
├── run.js              ← run scrape + toEpub sequentially
├── output/
│   ├── chapter-001/
│   │   ├── 000.jpg
│   │   └── ...
│   └── chapter-002/
│       └── ...
└── manga.epub
```

## Tips

| Need | How |
|---|---|
| Run in background without browser window | Set `"headless": true` in config |
| Only process first N chapters | Set `"limit": N` in config |
| Switch to a different website | Update `indexUrl`, `referer`, `imgSelector` in config |
| Browser keeps stealing focus | Set `"headless": true` |
