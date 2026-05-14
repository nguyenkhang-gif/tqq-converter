import { Router } from 'express';
import { readCfg, saveCfg } from '../lib/config.js';

const router = Router();

router.get('/', (_req, res) => res.json(readCfg()));

router.post('/', (req, res) => {
  saveCfg(req.body);
  res.json({ ok: true });
});

export default router;
