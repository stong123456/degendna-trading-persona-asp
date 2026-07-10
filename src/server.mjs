import "dotenv/config";
import cors from "cors";
import express from "express";
import {
  DEGEN_PERSONA_DIMENSIONS,
  DEGEN_PERSONA_DISCLAIMER,
  DEGEN_PERSONA_MODEL_VERSION,
  DEGEN_PERSONA_QUESTIONS,
  buildDegenPersonaSummary,
  computeDegenPersonaResultFromAnswers
} from "./degen-persona-engine.js";

const app = express();
const port = Number(process.env.PORT || 8788);
const configuredPublicBaseUrl = normalizeBaseUrl(process.env.PUBLIC_BASE_URL);
const fallbackPublicBaseUrl = `http://127.0.0.1:${port}`;
const serviceName = "degendna-trading-persona";
const serviceVersion = DEGEN_PERSONA_MODEL_VERSION;
const paidRoute = "/api/asp/trading-persona/score";

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "96kb" }));

await installOptionalX402(app);

app.get("/", (req, res) => {
  const publicBaseUrl = resolvePublicBaseUrl(req);
  res.json({
    ok: true,
    service: serviceName,
    version: serviceVersion,
    description: "Original DegenDNA trading-behavior profiling API for A2MCP-style use.",
    endpoints: {
      health: `${publicBaseUrl}/health`,
      questionnaire: `${publicBaseUrl}/api/asp/trading-persona`,
      scoring: `${publicBaseUrl}${paidRoute}`,
      mcp: `${publicBaseUrl}/mcp`
    },
    payment: paymentStatus(req)
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: serviceName,
    version: serviceVersion,
    questionCount: DEGEN_PERSONA_QUESTIONS.length,
    payment: paymentStatus(req)
  });
});

app.get("/api/asp/trading-persona", (req, res) => {
  res.json(questionnairePayload(normalizeLang(req.query.lang)));
});

app.post(paidRoute, (req, res) => {
  try {
    res.json(scorePayload(req.body, normalizeLang(req.query.lang || req.body?.lang)));
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Invalid trading-persona request."
    });
  }
});

app.post("/api/asp/trading-persona", (req, res) => {
  try {
    res.json(scorePayload(req.body, normalizeLang(req.query.lang || req.body?.lang)));
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Invalid trading-persona request."
    });
  }
});

app.post("/mcp", async (req, res) => {
  try {
    const response = await handleMcpRequest(req.body);
    if (response === null) return res.status(204).end();
    res.json(response);
  } catch (error) {
    res.status(400).json(jsonRpcError(req.body?.id ?? null, -32603, error.message || "MCP request failed."));
  }
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

app.listen(port, () => {
  console.log(`DegenDNA Trading Persona ASP running on http://127.0.0.1:${port}`);
});

async function installOptionalX402(expressApp) {
  const payTo = normalizeAddress(process.env.X402_PAY_TO || process.env.PAY_TO_ADDRESS || "");
  const enablePayment = isTruthy(process.env.X402_ENABLED) || Boolean(payTo);
  if (!enablePayment) return;

  if (!payTo) {
    console.warn("X402 is enabled but X402_PAY_TO is missing; scoring route will run without payment protection.");
    return;
  }

  const apiKey = process.env.OKX_API_KEY || "";
  const secretKey = process.env.OKX_SECRET_KEY || "";
  const passphrase = process.env.OKX_PASSPHRASE || "";
  if (!apiKey || !secretKey || !passphrase) {
    console.warn("X402 is enabled but OKX_API_KEY, OKX_SECRET_KEY, or OKX_PASSPHRASE is missing; scoring route will run without payment protection.");
    return;
  }

  try {
    const [{ paymentMiddleware, x402ResourceServer }, { OKXFacilitatorClient }, { ExactEvmScheme }] = await Promise.all([
      import("@okxweb3/x402-express"),
      import("@okxweb3/x402-core"),
      import("@okxweb3/x402-evm/exact/server")
    ]);
    const network = process.env.X402_NETWORK || "eip155:196";
    const facilitatorClient = new OKXFacilitatorClient({
      apiKey,
      secretKey,
      passphrase,
      baseUrl: process.env.OKX_BASE_URL || "https://web3.okx.com",
      syncSettle: isTruthy(process.env.OKX_SYNC_SETTLE)
    });
    const resourceServer = new x402ResourceServer(facilitatorClient);
    resourceServer.register(network, new ExactEvmScheme());
    const buildPaymentRoutes = (resourceBaseUrl) => ({
      [`POST ${paidRoute}`]: {
        accepts: [{
          scheme: "exact",
          network,
          payTo,
          price: process.env.X402_PRICE || "$3.99",
          maxTimeoutSeconds: Number(process.env.X402_TIMEOUT_SECONDS || 300)
        }],
        resource: `${resourceBaseUrl}${paidRoute}`,
        description: "DegenDNA 72-question trading persona scoring report.",
        mimeType: "application/json"
      }
    });

    let paymentReady = false;
    let paymentInitPromise = null;
    const initializePayment = async () => {
      if (paymentReady) return;
      paymentInitPromise ??= resourceServer.initialize()
        .then(() => {
          paymentReady = true;
        })
        .catch((error) => {
          paymentInitPromise = null;
          throw error;
        });
      await paymentInitPromise;
    };

    const syncFacilitatorOnStart = isTruthy(process.env.X402_SYNC_ON_START);
    if (syncFacilitatorOnStart) {
      initializePayment().catch((error) => {
        console.warn(`X402 facilitator startup sync failed: ${error.message}`);
      });
    }

    const paymentMiddlewaresByBaseUrl = new Map();
    const middlewareForRequest = (req) => {
      const resourceBaseUrl = resolvePublicBaseUrl(req);
      if (!paymentMiddlewaresByBaseUrl.has(resourceBaseUrl)) {
        paymentMiddlewaresByBaseUrl.set(
          resourceBaseUrl,
          paymentMiddleware(buildPaymentRoutes(resourceBaseUrl), resourceServer, undefined, undefined, false)
        );
      }
      return paymentMiddlewaresByBaseUrl.get(resourceBaseUrl);
    };

    expressApp.use(async (req, res, next) => {
      if (req.method !== "POST" || req.path !== paidRoute) return next();
      try {
        await initializePayment();
      } catch (error) {
        console.warn(`X402 facilitator is unavailable: ${error.message}`);
        return res.status(503).json({
          ok: false,
          error: "Payment facilitator is temporarily unavailable. Please check the OKX API credentials and x402 seller configuration."
        });
      }
      wrapPaymentRequiredResponse(res);
      return middlewareForRequest(req)(req, res, next);
    });
  } catch (error) {
    console.warn(`X402 middleware could not be installed: ${error.message}`);
  }
}

function wrapPaymentRequiredResponse(res) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 402) {
      const paymentRequired = firstHeaderValue(res.getHeader("PAYMENT-REQUIRED") || res.getHeader("payment-required"));
      const challenge = decodePaymentRequired(paymentRequired);
      if (challenge?.x402Version) {
        res.setHeader("PAYMENT-REQUIRED", paymentRequired);
        return originalJson(challenge);
      }
    }
    return originalJson(body);
  };
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

function decodePaymentRequired(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch (_error) {
    return null;
  }
}

async function handleMcpRequest(message) {
  if (Array.isArray(message)) {
    return Promise.all(message.map((item) => handleMcpRequest(item)));
  }
  if (!message || message.jsonrpc !== "2.0") {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request.");
  }
  if (message.method?.startsWith("notifications/")) return null;

  switch (message.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: serviceName,
            version: serviceVersion
          }
        }
      };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          tools: [
            {
              name: "get_trading_persona_questionnaire",
              description: "Return the DegenDNA 72-question trading-persona questionnaire and answer scale.",
              inputSchema: {
                type: "object",
                properties: {
                  lang: { type: "string", enum: ["zh", "en"], default: "zh" }
                }
              }
            },
            {
              name: "score_trading_persona",
              description: "Score a completed DegenDNA trading-persona answer set and return persona code, subtype, confidence, risks, and trading review guidance.",
              inputSchema: {
                type: "object",
                required: ["answers"],
                properties: {
                  lang: { type: "string", enum: ["zh", "en"], default: "zh" },
                  answers: {
                    oneOf: [
                      { type: "array", items: { type: "number", minimum: -2, maximum: 2 } },
                      { type: "object", additionalProperties: { type: "number", minimum: -2, maximum: 2 } }
                    ]
                  }
                }
              }
            }
          ]
        }
      };
    case "tools/call":
      return handleMcpToolCall(message);
    default:
      return jsonRpcError(message.id, -32601, `Unknown method: ${message.method}`);
  }
}

function handleMcpToolCall(message) {
  const name = message.params?.name;
  const args = message.params?.arguments || {};
  if (name === "get_trading_persona_questionnaire") {
    const payload = questionnairePayload(normalizeLang(args.lang));
    return jsonRpcToolResult(message.id, payload);
  }
  if (name === "score_trading_persona") {
    const payload = scorePayload(args, normalizeLang(args.lang));
    return jsonRpcToolResult(message.id, payload);
  }
  return jsonRpcError(message.id, -32602, `Unknown tool: ${name}`);
}

function jsonRpcToolResult(id, payload) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2)
        }
      ],
      structuredContent: payload
    }
  };
}

function jsonRpcError(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message }
  };
}

function questionnairePayload(lang = "zh") {
  return {
    ok: true,
    service: serviceName,
    modelVersion: DEGEN_PERSONA_MODEL_VERSION,
    language: lang,
    questionCount: DEGEN_PERSONA_QUESTIONS.length,
    answerScale: [
      { value: -2, label: lang === "en" ? "Strongly prefer left" : "强烈偏左" },
      { value: -1.2, label: lang === "en" ? "Prefer left" : "偏左" },
      { value: -0.35, label: lang === "en" ? "Slightly prefer left" : "轻微偏左" },
      { value: 0.35, label: lang === "en" ? "Slightly prefer right" : "轻微偏右" },
      { value: 1.2, label: lang === "en" ? "Prefer right" : "偏右" },
      { value: 2, label: lang === "en" ? "Strongly prefer right" : "强烈偏右" }
    ],
    dimensions: Object.entries(DEGEN_PERSONA_DIMENSIONS).map(([key, dimension]) => ({
      key,
      name: dimension.name,
      left: dimension.left,
      right: dimension.right,
      leftCode: dimension.leftCode,
      rightCode: dimension.rightCode,
      leftTag: dimension.leftTag,
      rightTag: dimension.rightTag
    })),
    questions: DEGEN_PERSONA_QUESTIONS.map((question, index) => ({
      id: `degenPersona:${index}`,
      index,
      dimension: question.dim,
      text: question.text,
      left: question.left,
      right: question.right
    })),
    disclaimer: DEGEN_PERSONA_DISCLAIMER
  };
}

function scorePayload(body, lang = "zh") {
  const answers = body?.answers || body;
  const persona = computeDegenPersonaResultFromAnswers(answers);
  if (persona.answeredCount < 12) {
    throw new Error("At least 12 valid answers are required for a stable profile.");
  }
  const result = buildDegenPersonaSummary(persona, lang);
  return {
    ok: true,
    service: serviceName,
    modelVersion: persona.modelVersion,
    result,
    scores: persona.scores,
    code: persona.code,
    completion: {
      answeredCount: persona.answeredCount,
      questionCount: persona.questionCount,
      completionRate: persona.completionRate
    },
    disclaimer: persona.disclaimer
  };
}

function normalizeLang(value) {
  return value === "en" ? "en" : "zh";
}

function normalizeAddress(value) {
  const raw = String(value || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : "";
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(raw) ? raw : "";
}

function resolvePublicBaseUrl(req) {
  if (configuredPublicBaseUrl) return configuredPublicBaseUrl;
  if (!req) return fallbackPublicBaseUrl;
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host");
  return host ? `${proto}://${host}`.replace(/\/+$/, "") : fallbackPublicBaseUrl;
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function paymentStatus(req) {
  const requested = isTruthy(process.env.X402_ENABLED) || Boolean(process.env.X402_PAY_TO || process.env.PAY_TO_ADDRESS);
  const configured = requested
    && Boolean(normalizeAddress(process.env.X402_PAY_TO || process.env.PAY_TO_ADDRESS || ""))
    && Boolean(process.env.OKX_API_KEY)
    && Boolean(process.env.OKX_SECRET_KEY)
    && Boolean(process.env.OKX_PASSPHRASE);
  return {
    enabled: configured,
    requested,
    network: process.env.X402_NETWORK || "eip155:196",
    price: process.env.X402_PRICE || "$3.99",
    protectedRoute: paidRoute,
    resourceBaseUrl: resolvePublicBaseUrl(req),
    syncFacilitatorOnStart: isTruthy(process.env.X402_SYNC_ON_START)
  };
}
