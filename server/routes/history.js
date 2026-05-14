import { Router } from 'express';
import { readHistory, saveEntry } from '../lib/history.js';

const router = Router();

// GET /api/history — all entries
router.get('/', (_req, res) => {
  res.json(readHistory());
});

// GET /api/history/:file — single entry
router.get('/:file', (req, res) => {
  const history = readHistory();
  const entry = history[req.params.file];
  if (!entry) return res.json(null);
  res.json(entry);
});

// POST /api/history/:file — save/update entry
router.post('/:file', (req, res) => {
  const { type, lastChapter, lastPage, totalChapters } = req.body;
  saveEntry(req.params.file, { type, lastChapter, lastPage, totalChapters });
  res.json({ ok: true });
});

export default router;
