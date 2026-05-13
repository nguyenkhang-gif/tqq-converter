# Manga Downloader & EPUB Converter

Download manga images from truyenqqko.com and package them into EPUB or CBZ files.

## Installation

```bash
npm install
npm run init   # create output/ folder and blank data.html
```

## Web UI (recommended)

```bash
npm run ui     # → open http://localhost:3000
```

1. Paste the chapter list page URL into **Quick Start**
2. Click **Fetch & Run All** — the UI will fetch the chapter list, download images, compress, and build EPUB automatically
3. Watch real-time progress and logs

The UI exposes all config fields (manga info, scrape timing, volumes/sections, compress quality) and lets you run any step individually.

---

## Terminal

All scripts live in `services/`. Run via npm scripts from the project root.

### Full pipeline

```bash
npm run start       # scrape + build EPUB (reads config.json)
```

### Step by step

```bash
npm run chapters    # parse data.html → update config.json scrape.urls
npm run scrape      # download images into output/
npm run compress    # compress images → output-compress/
npm run epub        # build EPUB from images
npm run epub:webtoon # build EPUB in webtoon mode (images stacked vertically)
npm run cbz         # build CBZ from images
```

### Getting the chapter list

For `npm run chapters` to work, you need `data.html` — either:
- **Via UI**: the Fetch step handles this automatically using puppeteer
- **Manual**: open the chapter list page in browser → Save As → `data.html` in project root

---

## Configuration — `config.json`

All settings in one file, no code changes needed.

```json
{
  "manga": {
    "title": "Manga title",
    "author": "Author name",
    "language": "vi",
    "indexUrl": "https://..."         // chapter list page URL
  },
  "scrape": {
    "outputDir": "output",
    "referer": "https://...",
    "headless": true,                 // false = show browser window
    "from": 1,                        // start from chapter N (1-indexed)
    "limit": null,                    // max chapters to download (null = all)
    "concurrency": 1,                 // parallel chapters
    "imgSelector": ".page-chapter img",
    "scroll": { "distance": 400, "delay": 100 },
    "waitAfterLoad": 2000,
    "waitAfterScroll": 1500,
    "waitBetweenChapters": 1000,
    "urls": []                        // auto-filled by getChapters
  },
  "epub": {
    "outputFile": "manga.epub",
    "inputDir": null,                 // null = use scrape.outputDir
    "buildDir": ".epub-build",
    "sections": null                  // split into volumes:
    // "sections": [
    //   { "name": "Vol 1.epub", "from": 1,  "to": 50  },
    //   { "name": "Vol 2.epub", "from": 51, "to": 100 }
    // ]
  },
  "compress": {
    "quality": 80,
    "maxWidth": null,
    "concurrency": 4,
    "outputDir": "output-compress"
  }
}
```

### Common tweaks

| Need | How |
|---|---|
| Start from chapter N | Set `"from": N` in scrape config |
| Download chapters N–M | Set `"from": N, "limit": M-N+1` |
| Split into volumes | Set `"sections"` array in epub config |
| Run in background | Set `"headless": true` |
| Different website | Update `indexUrl`, `referer`, `imgSelector` |
