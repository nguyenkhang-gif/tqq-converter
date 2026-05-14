import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const readCfg = () =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

export const saveCfg = cfg =>
  fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(cfg, null, 2));
