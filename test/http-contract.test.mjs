import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";

test("local HTTP contract returns JSON and complete tier reports", async (context) => {
  const baseUrl = await startServer(context, {
    NODE_ENV: "test",
    X402_ENABLED: "false",
    X402_REQUIRE_PAYMENT: "false"
  });
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const questionnaire = await fetch(`${baseUrl}/api/asp/trading-persona?mode=quick`);
  const questionnaireBody = await questionnaire.json();
  assert.equal(questionnaire.status, 200);
  assert.equal(questionnaireBody.questions.length, 12);
  assert.deepEqual(questionnaireBody.answerScale.map((option) => option.key), ["A", "B", "C", "D", "E", "F"]);
  assert.equal(questionnaireBody.questions[0].choices.length, 6);
  assert.equal(questionnaireBody.questions[0].choices[0].key, "A");
  assert.match(questionnaireBody.answerSubmission.recommended, /A\/B\/C\/D\/E\/F/);

  for (const [mode, count] of [["quick", 12], ["standard", 24], ["full", 72]]) {
    const response = await fetch(`${baseUrl}/api/asp/trading-persona/score/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: Array.from({ length: count }, (_value, index) => ["A", "B", "C", "D", "E", "F"][index % 6]) })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.reportLevel, mode);
  }

  const invalid = await fetch(`${baseUrl}/api/asp/trading-persona/score/quick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{"
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { ok: false, error: "Invalid JSON request body." });
});

test("production fails closed before parsing requests when payment is misconfigured", async (context) => {
  const baseUrl = await startServer(context, {
    NODE_ENV: "production",
    X402_ENABLED: "true",
    X402_REQUIRE_PAYMENT: "true"
  });

  const health = await fetch(`${baseUrl}/health`);
  const healthBody = await health.json();
  assert.equal(health.status, 503);
  assert.equal(healthBody.ok, false);
  assert.equal(healthBody.payment.required, true);
  assert.equal(healthBody.payment.ready, false);
  assert.equal(healthBody.payment.status, "missing_pay_to");

  const protectedResponse = await fetch(`${baseUrl}/api/asp/trading-persona/score/quick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{"
  });
  assert.equal(protectedResponse.status, 503);
  assert.deepEqual(await protectedResponse.json(), {
    ok: false,
    error: "Payment service is not ready. Please try again later."
  });
});

async function startServer(context, environment) {
  const port = await findFreePort();
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_BASE_URL: "",
      X402_PAY_TO: "",
      PAY_TO_ADDRESS: "",
      OKX_API_KEY: "",
      OKX_SECRET_KEY: "",
      OKX_PASSPHRASE: "",
      ...environment
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  context.after(() => child.kill());
  await waitForServer(child, port, () => stderr);
  return `http://127.0.0.1:${port}`;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function waitForServer(child, port, stderr) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server startup timed out: ${stderr()}`)), 10000);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited with ${code}: ${stderr()}`));
    });
    child.stdout.on("data", async (chunk) => {
      if (!String(chunk).includes("DegenDNA Trading Persona ASP running")) return;
      try {
        await fetch(`http://127.0.0.1:${port}/health`);
        clearTimeout(timeout);
        resolve();
      } catch (_error) {
        // The startup line can arrive just before the socket is ready; the test fetch retries below.
        setTimeout(async () => {
          try {
            await fetch(`http://127.0.0.1:${port}/health`);
            clearTimeout(timeout);
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        }, 100);
      }
    });
  });
}
