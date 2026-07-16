const DEFAULT_BASE_URL = "https://degendna-trading-persona-asp-production.up.railway.app";
const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.PUBLIC_BASE_URL || DEFAULT_BASE_URL);
const timeoutMs = positiveInteger(process.env.PROBE_TIMEOUT_MS, 15000);
const maxResponseMs = positiveInteger(process.env.PROBE_MAX_RESPONSE_MS, 10000);

const tiers = [
  { key: "quick", count: 12, amount: "100000" },
  { key: "standard", count: 24, amount: "1990000" },
  { key: "full", count: 72, amount: "3990000" }
];

await verifyHealth();
for (const tier of tiers) {
  await verifyChallenge(tier, "GET");
  await verifyChallenge(tier, "POST");
}

console.log(`All production endpoint checks passed for ${baseUrl}`);

async function verifyHealth() {
  const { response, elapsedMs } = await timedFetch(`${baseUrl}/health`);
  const body = await readJson(response, "health response");
  assert(response.status === 200, `health returned HTTP ${response.status}`);
  assert(body.ok === true, "health body did not report ok=true");
  assert(body.payment?.enabled === true, "payment is not enabled");
  assert(body.payment?.required === true, "production payment is not fail-closed");
  assert(body.payment?.ready === true, `payment is not ready (${body.payment?.status || "unknown"})`);
  assertFast(elapsedMs, "health");
  console.log(`PASS health 200 ${elapsedMs}ms`);
}

async function verifyChallenge(tier, method) {
  const url = `${baseUrl}/api/asp/trading-persona/score/${tier.key}`;
  const options = { method, redirect: "error" };
  if (method === "POST") {
    options.headers = { "content-type": "application/json" };
    options.body = JSON.stringify({
      answers: Array.from({ length: tier.count }, (_value, index) => ["A", "B", "C", "D", "E", "F"][index % 6])
    });
  }

  const { response, elapsedMs } = await timedFetch(url, options);
  assert(response.status === 402, `${method} ${tier.key} returned HTTP ${response.status}, expected 402`);
  const encoded = response.headers.get("payment-required");
  assert(encoded, `${method} ${tier.key} is missing PAYMENT-REQUIRED`);
  const challenge = decodeChallenge(encoded, `${method} ${tier.key}`);
  const option = challenge.accepts?.[0];

  assert(challenge.x402Version === 2, `${method} ${tier.key} is not x402 v2`);
  assert(challenge.resource?.url === url, `${method} ${tier.key} resource URL mismatch`);
  assert(challenge.resource?.mimeType === "application/json", `${method} ${tier.key} MIME type mismatch`);
  assert(option?.scheme === "exact", `${method} ${tier.key} payment scheme mismatch`);
  assert(option?.network === "eip155:196", `${method} ${tier.key} network mismatch`);
  assert(option?.asset?.toLowerCase() === "0x779ded0c9e1022225f8e0630b35a9b54be713736", `${method} ${tier.key} asset mismatch`);
  assert(option?.amount === tier.amount, `${method} ${tier.key} amount mismatch`);
  assert(/^0x[a-f0-9]{40}$/i.test(option?.payTo || ""), `${method} ${tier.key} payTo is invalid`);
  assertFast(elapsedMs, `${method} ${tier.key}`);
  console.log(`PASS ${method} ${tier.key} 402 ${elapsedMs}ms`);
}

async function timedFetch(url, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs)
  });
  return {
    response,
    elapsedMs: Math.round(performance.now() - startedAt)
  };
}

async function readJson(response, label) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function decodeChallenge(encoded, label) {
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch (error) {
    throw new Error(`${label} has an invalid PAYMENT-REQUIRED header: ${error.message}`);
  }
}

function normalizeBaseUrl(value) {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(normalized)) throw new Error("The public base URL must use HTTPS.");
  return normalized;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assertFast(elapsedMs, label) {
  assert(elapsedMs <= maxResponseMs, `${label} took ${elapsedMs}ms, above ${maxResponseMs}ms`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
