# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies (puppeteer, cheerio, sharp, express, qrcode-terminal)
npm run ui           # start Web UI → http://localhost:3000  (prints QR for network URL)
npm run ui:local     # start server on localhost only (no LAN access, no QR)
npm run ui:stop      # kill the server on port 3000
npm run init         # create output/, epubs/, cbzs/ and blank data.html
npm run start        # terminal: scrape + build EPUB (full pipeline)
npm run chapters     # terminal: parse data.html → update config.json scrape.urls
npm run scrape       # terminal: download images → output/
npm run compress     # terminal: compress images → output-compress/
npm run epub         # terminal: build EPUB → epubs/
npm run epub:webtoon # terminal: build EPUB in webtoon/scrolling mode → epubs/
npm run cbz          # terminal: build CBZ → cbzs/
npm run export       # sync cbzs/ → external path (opens Finder picker on macOS)
npm run export -- /path  # sync to specific path
npm run export -- --reset  # reset readerDir back to cbzs/
```

No build step, no linter, no tests. All scripts are plain Node.js ESM (`"type": "module"`).

## Architecture

All configuration lives in `config.json`. No code changes needed to switch manga or adjust behavior.

### Folder structure

```
server/
  index.js              ← Express app setup + route mounting + server start + QR code
  lib/
    config.js           ← ROOT path, readCfg(), saveCfg() shared across routes
    job.js              ← Mutable job state, EventEmitter bus, runJob(), runScript()
  routes/
    config.js           ← GET/POST /api/config
    pipeline.js         ← /api/status, /api/log (SSE), /api/run, /api/stop
    reader.js           ← /api/files, /api/reader/:file/pages, /api/reader/:file/page/*
    epub.js             ← /api/epub/:file/pages, /api/epub/:file/image/*
    epubText.js         ← /api/epub-text/:file/toc, /chapter/:i, /asset/* (text EPUB reader)
    chapters.js         ← /api/chapters (legacy folder-based reader)
  public/
    shared.css          ← :root CSS variables, reset, spinner keyframes
    index.css           ← Web UI styles
    index.html          ← Web UI (vanilla JS, inline)
    index.js            ← Web UI logic (external file)
    reader.css          ← Image reader styles
    reader.html         ← Image reader shell (CBZ + image EPUB)
    reader.js           ← Image reader logic
    ebook-reader.css    ← Text EPUB reader styles
    ebook-reader.html   ← Text EPUB reader shell
    ebook-reader.js     ← Text EPUB reader logic
    img/
      background.jpeg   ← Blurred background used by both readers
services/
  fetchHtml.js          ← puppeteer: fetch chapter list page → data.html
  getChapters.js        ← cheerio: parse data.html → config.scrape.urls
  scrape.js             ← puppeteer: download images per chapter → output/
  compressImg.js        ← sharp: re-encode images → output-compress/
  toEpub.js             ← build EPUB 2.0 → epubs/
  toCbz.js              ← build CBZ → cbzs/
run.js                  ← terminal shortcut: scrape() + toEpub()
init.js                 ← first-run setup (creates folders + blank config)
```

### Output folders

| Folder | Contents |
|---|---|
| `output/` | Raw downloaded images (chapter-XXX/) |
| `output-compress/` | Sharp-compressed images |
| `epubs/` | Final EPUB files |
| `cbzs/` | Final CBZ files |

### Server architecture

`server/index.js` mounts routers, starts the server, and prints a QR code for the network URL (skipped with `--local`).

**Shared state pattern**: `server/lib/job.js` exports a `state = { job, child }` object. All route files import the same object reference, so mutations are visible across modules (works because ES modules cache by identity).

**SSE streaming**: `GET /api/log` opens a Server-Sent Events connection. `pipeline.js` listens to `bus` (EventEmitter in `job.js`) and pipes events to all connected clients. Progress is parsed from stdout: `[X/Y]` format from scrape, `X/Y` from compress.

**Job runner**: `POST /api/run` accepts `{ steps: string[] }` and runs them sequentially via `runJob()`. Each step spawns `node services/<script>.js` as a child process (cwd = project root). The loop checks `state.job.status` before each step — stopping the job via `POST /api/stop` kills the child process (SIGTERM) and the loop exits cleanly without running further steps.

**Stop handling**: `POST /api/stop` kills `state.child` with SIGTERM and sets status to `stopped`. `runJob()` checks status at the top of each iteration and after sub-steps, so it won't advance to the next step. The `catch` block ignores errors when status is already `stopped`.

### UI flow (Web UI)

**Fetch & Run All** quick-start runs: `fetchHtml` → `chapters` → `scrape`, then stops and prompts the user to configure volumes/sections before running CBZ manually.

After `fetchHtml` or `chapters` steps complete, the UI automatically calls `loadConfig()` to refresh the chapter URL count badge and modal textarea. The SSE client tracks `currentSteps` from the `running` event (since `done` event doesn't include steps) to know which steps just ran.

**Browser notifications**: The UI requests `Notification` permission on load and fires a notification when a job reaches `done` or `error` status.

### Reader — image-based (`/reader.html`)

Reads both CBZ and EPUB files. Key data flow:

1. `init()` fetches `/api/files` → gets `[{ name, type, size }]` for all cbz + epub files
2. Clicking a volume calls `loadVolume(file)` → fetches all page paths from `/api/reader/:file/pages` (CBZ) or `/api/epub/:file/pages` (EPUB)
3. `extractChapters(pageList, type)` groups pages into chapters:
   - CBZ: group by `parts[0]` (first path component, e.g. `0001-chapter-001/`)
   - EPUB: group by `parts[parts.length - 2]` (second-to-last, e.g. `OEBPS/images/chapter-001/`)
4. Images stream from `/api/reader/:file/page/<path>` or `/api/epub/:file/image/<path>` via `unzip -p`

### Reader — text EPUB (`/ebook-reader.html`)

Parses EPUB structure server-side via `/api/epub-text/`:

1. `GET /toc` — reads `META-INF/container.xml` → OPF → spine order + NCX titles
2. `GET /chapter/:index` — extracts body HTML of the spine item, rewrites relative `src`/`href` to `/api/epub-text/:file/asset/*`
3. `GET /asset/*` — streams images/CSS from inside the EPUB ZIP

If the EPUB contains only images (no text), the reader shows a message to use the image reader instead. Font size and theme (Dark/Sepia/Light) persist via `localStorage`. Last-read chapter position is saved per file.

Both readers use a blurred background image (`/img/background.jpeg`) via `body::before` pseudo-element.

### Pipeline stages (services/)

1. **`fetchHtml.js`** — Takes URL as `argv[2]`, opens with puppeteer (headless), saves full page HTML to `data.html`.
2. **`getChapters.js`** — Parses `data.html` with a fallback selector chain, writes `chapters.json`, overwrites `config.scrape.urls`.
3. **`scrape.js`** — Opens one Puppeteer browser per chapter (up to `concurrency` in parallel), scrolls to trigger lazy images, downloads into `output/chapter-XXX/`. After all chapters complete, force-kills orphan Chrome processes (`pkill`). Browser is closed immediately on error before retry (up to 3 attempts).
4. **`compressImg.js`** — Re-encodes JPEG/PNG with sharp (`quality`, optional `maxWidth`), writes to `output-compress/`. GIFs copied as-is.
5. **`toEpub.js`** — Builds EPUB 2.0 (OPF/NCX/XHTML) in `.epub-build/`, zips with system `zip`. Modes: paginated (default) and webtoon (`--webtoon`). Supports `epub.sections` for splitting into volumes. Does NOT apply `scrape.limit` — reads all chapters from `inputDir`.
6. **`toCbz.js`** — Same section logic as toEpub, zips images into `cbzs/`. Does NOT apply `scrape.limit` — reads all chapters from `inputDir`.

### Key config fields

- `cbz.readerDir` — if set, reader loads CBZ files from this path instead of `cbz.outputDir`; set by `export-cbz.js`, reset to `null` with `--reset`

- `manga.indexUrl` — URL for `fetchHtml` to scrape the chapter list from
- `manga.title` — shown in the reader sidebar
- `epub.outputDir` / `cbz.outputDir` — output folders for final files
- `epub.inputDir` — image source for EPUB/CBZ (defaults to `scrape.outputDir`; set to `"output-compress"` to use compressed images)
- `epub.sections` — `[{ name, from, to }]` to produce multiple volume files; used by both EPUB and CBZ
- `scrape.outputDir` — where scraped images land
- `scrape.imgSelector` — CSS selector for images (default `.page-chapter img`)
- `scrape.headless` — `false` to show browser window during scrape
- `scrape.concurrency` — parallel chapter downloads
- `scrape.from` / `scrape.limit` — scrape a slice of URLs (1-based `from`, count-based `limit`); does NOT affect EPUB/CBZ chapter reading
- `scrape.referer` — HTTP `Referer` header sent with image downloads
- `scrape.scroll` — `{ distance, delay }` for auto-scroll to trigger lazy images
- `scrape.waitAfterLoad` / `scrape.waitAfterScroll` / `scrape.waitBetweenChapters` — ms delays

### Network access

Server binds `0.0.0.0` and prints both addresses + a QR code on startup. Override port with `PORT=8080 npm run ui`.
