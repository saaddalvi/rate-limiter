const BASE_URL = 'http://localhost:3000';
const BATCH_SIZE = 50; // concurrent requests per wave

async function fireRequest(userId) {
  try {
    const res = await fetch(`${BASE_URL}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    const body = await res.json();
    return { ok: true, allowed: body.allowed === true };
  } catch (err) {
    return { ok: false, allowed: false }; // network error -- count separately, don't crash
  }
}

async function main() {
  const totalRequests = 1000;
  const expectedMax = 10;
  const userId = `loadtest-${Date.now()}`;

  console.log(`Firing ${totalRequests} requests in batches of ${BATCH_SIZE}...`);

  const results = [];
  for (let sent = 0; sent < totalRequests; sent += BATCH_SIZE) {
    const batch = Array.from({ length: BATCH_SIZE }, () => fireRequest(userId));
    results.push(...(await Promise.all(batch)));
  }

  const allowedCount = results.filter((r) => r.allowed).length;
  const networkErrors = results.filter((r) => !r.ok).length;
  const overAdmitted = Math.max(allowedCount - expectedMax, 0);

  console.log(`Allowed: ${allowedCount} / expected max: ${expectedMax}`);
  console.log(`Network errors: ${networkErrors}`);
  console.log(`Over-admitted by: ${overAdmitted} requests (${((overAdmitted / expectedMax) * 100).toFixed(1)}%)`);
}

main();