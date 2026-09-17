function windowKey(userId, resource, windowMs) {
  const windowIndex = Math.floor(Date.now() / windowMs);
  return `rl:fixed:${userId}:${resource}:${windowIndex}`;
}

async function checkNaive(redis, { userId, resource, max, windowMs }) {
  const key = windowKey(userId, resource, windowMs);

  const raw = await redis.get(key); // 1. READ
  const current = raw ? parseInt(raw, 10) : 0;

  if (current >= max) {
    // 2. CHECK
    const ttl = await redis.pttl(key);
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(ttl, 0) };
  }

  const next = current + 1;
  // Gap is HERE: another request can read `current` before this SET lands.
  await redis.set(key, next, "PX", windowMs); // 3. WRITE
  return { allowed: true, remaining: Math.max(max - next, 0), retryAfterMs: 0 };
}

const ATOMIC_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current == false then
  current = 0
else
  current = tonumber(current)
end

local max = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])

if current >= max then
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then ttl = 0 end
  return {0, current, ttl}
end

local new = redis.call('INCR', KEYS[1])
if new == 1 then
  redis.call('PEXPIRE', KEYS[1], windowMs)
end

return {1, new, 0}
`;

async function checkAtomic(redis, { userId, resource, max, windowMs }) {
  const key = windowKey(userId, resource, windowMs);
  const [allowedFlag, count, ttl] = await redis.eval(
    ATOMIC_SCRIPT,
    1, // number of KEYS
    key, // KEYS[1]
    max, // ARGV[1]
    windowMs, // ARGV[2]
  );

  return {
    allowed: allowedFlag === 1,
    remaining: Math.max(max - count, 0),
    retryAfterMs: allowedFlag === 1 ? 0 : ttl,
  };
}

module.exports = { checkNaive, checkAtomic, windowKey };

