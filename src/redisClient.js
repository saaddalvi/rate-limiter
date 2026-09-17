const Redis = require('ioredis');
const config = require('./config');

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3, // fail fast in dev instead of hanging
});

redis.on('error', (err) => console.error('[redis] error:', err.message));
redis.on('connect', () => console.log(`[redis] connected -> ${config.redisUrl}`));

module.exports = redis; 

