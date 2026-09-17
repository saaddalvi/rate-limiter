const express = require('express');
const config = require('./config');
const redis = require('./redisClient');
const { checkNaive, checkAtomic } = require('./algorithms/fixedWindow');

const app = express();
app.use(express.json());

const MAX_REQUESTS = 10;
const WINDOW_MS = 10_000;
const NAIVE_MODE = process.env.NAIVE_MODE !== 'false'; // true unless explicitly disabled

app.post('/check', async (req, res) => {
  const { user_id, resource = 'default' } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const check = NAIVE_MODE ? checkNaive : checkAtomic;
  const result = await check(redis, {
    userId: user_id,
    resource,
    max: MAX_REQUESTS,
    windowMs: WINDOW_MS,
  });

  if (!result.allowed) {
    return res.status(429).json({ allowed: false, retry_after: result.retryAfterMs });
  }
  res.json({ allowed: true, remaining: result.remaining, retry_after: 0 });
});

app.listen(config.port, () => console.log(`listening on http://localhost:${config.port}`));