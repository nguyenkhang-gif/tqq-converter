import fs from 'fs';
import path from 'path';
import { ROOT } from './config.js';

const HISTORY_FILE = path.join(ROOT, 'reading-history.json');

export function readHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return {};
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch { return {}; }
}

export function saveEntry(file, data) {
  const history = readHistory();
  history[file] = { ...history[file], ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
}
