# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # install dependencies (puppeteer, cheerio, sharp, express)
npm run ui       # start Web UI → http://localhost:3000  (primary interface)
npm run init     # create output/ folder and blank data.html
npm run start    # terminal: scrape + build EPUB (full pipeline)
npm run chapters # terminal: parse data.html → update config.json scrape.urls
npm run scrape   # terminal: download images only
npm run compress # terminal: compress images with sharp → output-compress/
npm run epub     # terminal: build EPUB from existing images
npm run epub:webtoon # terminal: build EPUB in webtoon/scrolling mode
npm run cbz      # terminal: build CBZ from existing images
```

No build step, no linter, no tests. All scripts are plain Node.js ESM (`"type": "module"`).

## Architecture

All configuration lives in `config.json`. No code changes needed to switch manga or adjust behavior.

### Folder structure

```
server/
  index.js          ← Express server + SSE job runner
  public/index.html ← Web UI (single file, vanilla JS)
services/
  fetchHtml.js      ← puppeteer: fetch chapter list page → data.html
  getChapters.js    ← cheerio: parse data.html → config.scrape.urls
  scrape.js         ← puppeteer: download images per chapter
  compressImg.js    ← sharp: re-encode images → output-compress/
  toEpub.js         ← build EPUB 2.0 from images
  toCbz.js          ← build CBZ from images
run.js              ← terminal shortcut: scrape() + toEpub()
init.js             ← first-run setup
```

### Web UI (server/)

`server/index.js` is an Express server that:
- Serves `server/public/index.html`
- Reads/writes `config.json` via `/api/config`
- Spawns `services/*.js` as child processes via `/api/run` (with cwd = project root)
- Streams stdout/stderr to the browser in real time via SSE (`/api/log`)
- Parses progress from log output: `[X/Y]` for scrape, `X/Y` for compress

Quick Start flow (URL → full pipeline): `fetchHtml → chapters → scrape → compress → epub`

### Pipeline stages (services/)

1. **`fetchHtml.js`** — Takes URL as `argv[2]`, opens with puppeteer (headless), saves full page HTML to `data.html`.

2. **`getChapters.js`** — Parses `data.html` with a fallback selector chain (`.name-chap a`, `a[href*="chap-"]`, etc.), writes `chapters.json`, overwrites `config.scrape.urls`.

3. **`scrape.js`** — Opens one Puppeteer browser per chapter (up to `concurrency` in parallel), scrolls to trigger lazy images, downloads into `output/chapter-XXX/`. Exports `scrape()` for `run.js`.

4. **`compressImg.js`** — Re-encodes JPEG/PNG with sharp (`quality`, optional `maxWidth`), writes to `output-compress/`. GIFs copied as-is.

5. **`toEpub.js`** — Builds EPUB 2.0 (OPF/NCX/XHTML) in a temp `.epub-build/` dir, zips with system `zip`. Two modes: paginated (default, one XHTML per image) and webtoon (`--webtoon`, one XHTML per chapter). Supports `epub.sections` for splitting into volumes. Exports `toEpub()` for `run.js`.

6. **`toCbz.js`** — Same section logic as toEpub, zips images directly into a CBZ.

### Key config fields

- `epub.inputDir` — image source for EPUB/CBZ (defaults to `scrape.outputDir`)
- `epub.sections` — `[{ name, from, to }]` to produce multiple volume files
- `scrape.imgSelector` — CSS selector for images (default `.page-chapter img`)
- `scrape.headless` — `false` to show browser window during scrape
