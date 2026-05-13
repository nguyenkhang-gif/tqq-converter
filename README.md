# Manga Downloader & EPUB Converter

Download manga images from truyenqqko.com and package them into EPUB or CBZ files.

## Installation

```bash
npm install
npm run init   # create output/, epubs/, cbzs/ folders and blank data.html
```

## Web UI (recommended)

```bash
npm run ui        # → open http://localhost:3000
npm run ui:stop   # stop the server
```

When started, the server prints both addresses:
```
🌐  Local:   http://localhost:3000
📱  Network: http://192.168.x.x:3000   ← access from phone/tablet on same WiFi
```

### Quick Start (no config editing needed)

1. Paste the chapter list page URL into the **Quick Start** box
2. Click **Fetch & Run All** — the UI will:
   - Open the page in a headless browser and save the HTML
   - Parse chapter URLs automatically
   - Download all images
   - Compress images
   - Build EPUB into `epubs/`
3. Watch real-time progress and live logs

### Web UI features

| Feature | Description |
|---|---|
| Quick Start | Enter URL → full pipeline in one click |
| Config form | Edit all settings without touching `config.json` |
| Chapter URLs | Click the **📋 N chapters** badge to view, edit, or paste new URLs |
| Individual steps | Run Fetch / Chapters / Scrape / Compress / EPUB / CBZ separately |
| Progress bar | Real-time chapter/image progress with step indicators |
| Live log | Color-coded output streamed from the running process |
| 📖 Reader | Open `cbzs/` files directly in the browser reader |

### CBZ Reader (`/reader.html`)

Click **📖 Reader** in the top-right of the UI. Features:
- Lists all CBZ files in `cbzs/`
- **Fit width** / **Fit height** / **Webtoon scroll** modes
- Click left/right half of image to navigate pages
- Arrow key navigation + **touch swipe** on mobile
- Jump to page
- Mobile: sidebar hidden by default, open with **☰** button
- Access from phone via the Network URL printed on startup

---

## Terminal

All scripts live in `services/`. Run via npm scripts from the project root.

### Full pipeline

```bash
npm run start         # scrape + build EPUB
```

### Step by step

```bash
npm run chapters      # parse data.html → update config.json scrape.urls
npm run scrape        # download images → output/
npm run compress      # compress images → output-compress/
npm run epub          # build EPUB → epubs/
npm run epub:webtoon  # build EPUB in webtoon mode → epubs/
npm run cbz           # build CBZ → cbzs/
```

### Getting the chapter list (terminal)

Open the chapter list page in your browser → **Save As** → save as `data.html` in the project root, then run `npm run chapters`. The UI's **Fetch HTML** step does this automatically.

---

## Output folders

| Folder | Contents |
|---|---|
| `output/` | Raw downloaded images (per chapter) |
| `output-compress/` | Compressed images (sharp re-encode) |
| `epubs/` | Final EPUB files |
| `cbzs/` | Final CBZ files |

---

## Configuration — `config.json`

All settings in one file. The Web UI config form mirrors every field below.

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
    "limit": null,                    // max chapters (null = all)
    "concurrency": 1,                 // parallel chapters
    "imgSelector": ".page-chapter img",
    "scroll": { "distance": 400, "delay": 100 },
    "waitAfterLoad": 2000,
    "waitAfterScroll": 1500,
    "waitBetweenChapters": 1000,
    "urls": []                        // auto-filled by getChapters
  },
  "epub": {
    "outputDir": "epubs",
    "outputFile": "manga.epub",
    "inputDir": null,                 // null = use scrape.outputDir
    "buildDir": ".epub-build",
    "sections": null                  // split into volumes:
    // "sections": [
    //   { "name": "Vol 1.epub", "from": 1,  "to": 50  },
    //   { "name": "Vol 2.epub", "from": 51, "to": 100 }
    // ]
  },
  "cbz": {
    "outputDir": "cbzs"
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
| Run browser visibly | Set `"headless": false` |
| Different website | Update `indexUrl`, `referer`, `imgSelector` |
| Add chapters manually | Click **📋 N chapters** badge in UI → paste URLs |
