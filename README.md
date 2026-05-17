# Manga Downloader & EPUB/CBZ Converter

Download manga images and package them into EPUB or CBZ files, with a full-featured local Web UI and in-browser reader.

## Installation

```bash
npm install
npm run init   # create output/, epubs/, cbzs/ folders and blank data.html
```

## Web UI (recommended)

```bash
npm run ui        # → open http://localhost:3001
npm run ui:local  # → localhost only (no LAN/QR)
npm run ui:stop   # stop the server
```

Override port: `PORT=8080 npm run ui`

When started, the server prints both addresses + a QR code:
```
🌐  Local:   http://localhost:3001
📱  Network: http://192.168.x.x:3001   ← scan QR or open on phone/tablet
```

### Quick Start

1. Paste the chapter list page URL into the **Quick Start** box
2. Click **Fetch & Run All** — the UI will:
   - Open the page in a headless browser and save the HTML
   - Parse chapter URLs automatically
   - Download all images
3. Watch real-time progress and live logs, then configure volumes and run CBZ/EPUB

### Web UI features

| Feature | Description |
|---|---|
| Quick Start | Enter URL → full pipeline in one click |
| Config form | Edit all settings without touching `config.json` |
| Chapter URLs | Click the **📋 N chapters** badge to view, edit, or paste new URLs |
| Individual steps | Run Fetch / Chapters / Scrape / Compress / EPUB / CBZ separately |
| Progress bar | Real-time chapter/image progress with step indicators |
| Tab title | Shows job status + `⏳ 42%` progress while running |
| Live log | Color-coded output streamed via SSE; Clear button wipes FE + BE buffer |
| Output stats | Badge shows chapter/image counts for `output/` and `output-compress/` |
| Cleanup | Delete `output/` and `output-compress/` in one click |
| Browser notifications | Desktop notification when job completes or errors |
| 📖 Reader | Open CBZ/EPUB files in the browser reader |

---

## Readers

### Image reader (`/reader.html`)

Reads both CBZ and EPUB (image-based) files. Features:
- Lists all CBZ + EPUB files; shows last-read position
- **Fit width** / **Fit height** / **Webtoon scroll** modes
- Click left/right half of image to navigate; arrow keys; touch swipe
- Jump to page; chapter sidebar with scroll position memory
- Reading history persisted server-side across browser sessions
- Mobile: sidebar hidden by default, open with **☰**

### Text EPUB reader (`/ebook-reader.html`)

Reads text-based EPUB files (e.g. light novels). Features:
- Table of contents with chapter navigation
- Adjustable font size; Dark / Sepia / Light themes
- Last-read chapter persisted per file via `localStorage`

---

## Remote access

### Tunnel (Cloudflare)

```bash
npm run tunnel       # expose port 3001 via cloudflared (prints public URL)
npm run tunnel:stop  # kill the tunnel
```

Requires `cloudflared` installed (`brew install cloudflare/cloudflare/cloudflared`).

### Export CBZ to external app

```bash
npm run export               # opens Finder folder picker (macOS)
npm run export -- /path      # sync cbzs/ to specific path
npm run export -- --reset    # reset readerDir back to cbzs/
```

Sets `cbz.readerDir` in config so the reader loads files from the external location.

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
npm run epub:webtoon  # build EPUB in webtoon/scroll mode → epubs/
npm run cbz           # build CBZ → cbzs/
```

### Getting the chapter list (terminal)

Open the chapter list page in your browser → **Save As** → `data.html` in project root → `npm run chapters`. The UI's **Fetch HTML** step does this automatically.

---

## Output folders

| Folder | Contents |
|---|---|
| `output/` | Raw downloaded images (per chapter) |
| `output-compress/` | Sharp-compressed images |
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
    "indexUrl": "https://..."
  },
  "scrape": {
    "outputDir": "output",
    "referer": "https://...",
    "headless": true,
    "from": 1,
    "limit": null,
    "concurrency": 1,
    "imgSelector": ".page-chapter img",
    "scroll": { "distance": 400, "delay": 100 },
    "waitAfterLoad": 2000,
    "waitAfterScroll": 1500,
    "waitBetweenChapters": 1000,
    "urls": []
  },
  "epub": {
    "outputDir": "epubs",
    "outputFile": "manga.epub",
    "inputDir": null,
    "buildDir": ".epub-build",
    "sections": null
  },
  "cbz": {
    "outputDir": "cbzs",
    "readerDir": null
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
| Start from chapter N | `"from": N` in scrape config |
| Download chapters N–M | `"from": N, "limit": M-N+1` |
| Split into volumes | `"sections": [{ "name": "Vol 1.epub", "from": 1, "to": 50 }, ...]` in epub/cbz config |
| Use compressed images for EPUB/CBZ | `"inputDir": "output-compress"` in epub config |
| Run browser visibly | `"headless": false` |
| Different website | Update `indexUrl`, `referer`, `imgSelector` |
| Add chapters manually | Click **📋 N chapters** badge in UI → paste URLs |
