import express from 'express';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';

import configRouter   from './routes/config.js';
import pipelineRouter from './routes/pipeline.js';
import readerRouter   from './routes/reader.js';
import epubRouter     from './routes/epub.js';
import epubTextRouter from './routes/epubText.js';
import chaptersRouter from './routes/chapters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/config',   configRouter);
app.use('/api',          pipelineRouter);   // /api/status, /api/log, /api/run, /api/stop
app.use('/api',          readerRouter);     // /api/files, /api/reader/...
app.use('/api/epub',     epubRouter);       // /api/epub/:file/pages, /api/epub/:file/image/*
app.use('/api/epub-text', epubTextRouter); // /api/epub-text/:file/toc, /chapter/:i, /asset/*
app.use('/api/chapters', chaptersRouter);

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
const localOnly = process.argv.includes('--local');
const host = localOnly ? 'localhost' : '0.0.0.0';

app.listen(PORT, host, () => {
  const localUrl   = `http://localhost:${PORT}`;
  const networkUrl = `http://${getLocalIP()}:${PORT}`;
  console.log(`\n🌐  Local:   ${localUrl}`);
  if (!localOnly) {
    console.log(`📱  Network: ${networkUrl}\n`);
    qrcode.generate(networkUrl, { small: true });
  }
  console.log();
});
