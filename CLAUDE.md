# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies (puppeteer, cheerio, sharp, express)
npm run ui           # start Web UI → http://localhost:3000  (primary interface)
npm run ui:stop      # kill the server on port 3000
npm run init         # create output/, epubs/, cbzs/ and blank data.html
npm run start        # terminal: scrape + build EPUB (full pipeline)
npm run chapters     # terminal: parse data.html → update config.json scrape.urls
npm run scrape       # terminal: download images → output/
npm run compress     # terminal: compress images → output-compress/
npm run epub         # terminal: build EPUB → epubs/
npm run epub:webtoon # terminal: build EPUB in webtoon/scrolling mode → epubs/
npm run cbz          # terminal: build CBZ → cbzs/
```

No build step, no linter, no tests. All scripts are plain Node.js ESM (`"type": "module"`).

## Architecture

All configuration lives in `config.json`. No code changes needed to switch manga or adjust behavior.

### Folder structure

```
server/
  index.js          ← Express server + SSE job runner + reader API
  public/
    index.html      ← Web UI (single file, vanilla JS)
    reader.html     ← CBZ reader (single file, vanilla JS)
services/
  fetchHtml.js      ← puppeteer: fetch chapter list page → data.html
  getChapters.js    ← cheerio: parse data.html → config.scrape.urls
  scrape.js         ← puppeteer: download images per chapter → output/
  compressImg.js    ← sharp: re-encode images → output-compress/
  toEpub.js         ← build EPUB 2.0 → epubs/
  toCbz.js          ← build CBZ → cbzs/
run.js              ← terminal shortcut: scrape() + toEpub()
init.js             ← first-run setup (creates folders + blank config)
```

### Output folders

| Folder | Contents |
|---|---|
| `output/` | Raw downloaded images (chapter-XXX/) |
| `output-compress/` | Sharp-compressed images |
| `epubs/` | Final EPUB files (`epub.outputDir`) |
| `cbzs/` | Final CBZ files (`cbz.outputDir`) |

### Web UI (server/)

`server/index.js` is an Express server that:
- Serves `server/public/` (index.html + reader.html)
- Reads/writes `config.json` via `GET /api/config` and `POST /api/config`
- Spawns `services/*.js` as child processes via `POST /api/run` (cwd = project root)
- Streams stdout/stderr to the browser in real time via SSE (`GET /api/log`)
- Parses progress: `[X/Y]` from scrape logs, `X/Y` from compress logs
- Lists output files via `GET /api/files`
- Serves CBZ images via `GET /api/reader/:file/page/*` (streams via `unzip -p`)

Quick Start flow (URL → full pipeline): `fetchHtml → chapters → scrape → compress → epub`

Chapter URL management: clicking the badge in the Scrape config section opens a modal where URLs can be viewed, edited inline, or new URLs pasted and appended (auto-deduped on save).

### CBZ Reader (server/public/reader.html)

- Lists CBZ files from `GET /api/files`
- Loads page list from `GET /api/reader/:file/pages` (parsed from `unzip -l` output)
- Streams each image from `GET /api/reader/:file/page/*` (via `unzip -p`)
- Three view modes: fit-width (default), fit-height, webtoon scroll
- Keyboard arrow navigation; click left/right half of image to turn pages

### Pipeline stages (services/)

1. **`fetchHtml.js`** — Takes URL as `argv[2]`, opens with puppeteer (headless), saves full page HTML to `data.html`.

2. **`getChapters.js`** — Parses `data.html` with a fallback selector chain (`.name-chap a`, `a[href*="chap-"]`, etc.), writes `chapters.json`, overwrites `config.scrape.urls`.

3. **`scrape.js`** — Opens one Puppeteer browser per chapter (up to `concurrency` in parallel), scrolls to trigger lazy images, downloads into `output/chapter-XXX/`. Exports `scrape()` for `run.js`.

4. **`compressImg.js`** — Re-encodes JPEG/PNG with sharp (`quality`, optional `maxWidth`), writes to `output-compress/`. GIFs copied as-is.

5. **`toEpub.js`** — Builds EPUB 2.0 (OPF/NCX/XHTML) in `.epub-build/`, zips with system `zip`, writes to `epubs/`. Modes: paginated (default) and webtoon (`--webtoon`). Supports `epub.sections` for splitting into volumes. Exports `toEpub()` for `run.js`.

6. **`toCbz.js`** — Same section logic as toEpub, zips images into `cbzs/`.

### Key config fields

- `epub.outputDir` / `cbz.outputDir` — output folders for final files (`epubs/`, `cbzs/`)
- `epub.inputDir` — image source for EPUB/CBZ (defaults to `scrape.outputDir`)
- `epub.sections` — `[{ name, from, to }]` to produce multiple volume files
- `scrape.imgSelector` — CSS selector for images (default `.page-chapter img`)
- `scrape.headless` — `false` to show browser window during scrape
