import "dotenv/config";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import {
  DEGEN_PERSONA_ANSWER_OPTIONS,
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
const currentDir = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(currentDir, "..", "assets");
const paidRoute = "/api/asp/trading-persona/score";
const previewRoute = "/api/asp/trading-persona/preview";
const scoreRoutes = {
  quick: `${paidRoute}/quick`,
  standard: `${paidRoute}/standard`,
  full: `${paidRoute}/full`
};
const protectedScoreMethods = ["GET", "HEAD", "POST"];
const protectedScoreRoutes = [paidRoute, ...Object.values(scoreRoutes)];
const paymentRuntime = {
  required: false,
  requested: false,
  configured: false,
  initialized: false,
  error: ""
};
const ASSESSMENT_MODES = {
  quick: {
    key: "quick",
    name: "极速版",
    questionCount: 12,
    perDimension: 2,
    price: "0.10",
    priceEnv: "X402_PRICE_QUICK",
    serviceName: "测出我的链上交易人格·极速版",
    reportName: "12题速测卡",
    promise: "约 1 分钟完成，先判断主要亏损盲区、交易冲动来源和一个可分享人格码。"
  },
  standard: {
    key: "standard",
    name: "标准版",
    questionCount: 24,
    perDimension: 4,
    price: "1.99",
    priceEnv: "X402_PRICE_STANDARD",
    serviceName: "测出我的链上交易人格·标准版",
    reportName: "24题标准报告",
    promise: "覆盖六个维度的核心偏好，生成优势、盲区、执行协议和轻量复盘清单。"
  },
  full: {
    key: "full",
    name: "完整版",
    questionCount: DEGEN_PERSONA_QUESTIONS.length,
    perDimension: Infinity,
    price: "3.99",
    priceEnv: "X402_PRICE_FULL",
    serviceName: "测出我的链上交易人格·完整版",
    reportName: "72题完整训练计划",
    promise: "完整 72 题画像，生成六维雷达、盲区、复盘清单、7/14/30 天训练计划和分享文案。"
  }
};

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(cors());
app.use("/assets", express.static(assetsDir, { maxAge: "1h" }));

await installOptionalX402(app);
app.use(express.json({ limit: "96kb" }));

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
      preview: `${publicBaseUrl}${previewRoute}`,
      scoring: `${publicBaseUrl}${paidRoute}`,
      quickScore: `${publicBaseUrl}${scoreRoutes.quick}`,
      standardScore: `${publicBaseUrl}${scoreRoutes.standard}`,
      fullScore: `${publicBaseUrl}${scoreRoutes.full}`,
      reportDemo: `${publicBaseUrl}/report/demo?mode=quick`,
      mcp: `${publicBaseUrl}/mcp`
    },
    modes: publicModes(),
    payment: paymentStatus(req)
  });
});

app.get("/health", (req, res) => {
  const payment = paymentStatus(req);
  const ok = !payment.required || payment.ready;
  res.status(ok ? 200 : 503).json({
    ok,
    service: serviceName,
    version: serviceVersion,
    questionCount: DEGEN_PERSONA_QUESTIONS.length,
    payment
  });
});

app.get("/api/asp/trading-persona", (req, res) => {
  res.json(questionnairePayload(normalizeLang(req.query.lang), normalizeMode(req.query.mode)));
});

app.get(paidRoute, (req, res) => {
  res.json(scoreGetPayload("full", normalizeLang(req.query.lang), req));
});

app.get(scoreRoutes.quick, (req, res) => {
  res.json(scoreGetPayload("quick", normalizeLang(req.query.lang), req));
});

app.get(scoreRoutes.standard, (req, res) => {
  res.json(scoreGetPayload("standard", normalizeLang(req.query.lang), req));
});

app.get(scoreRoutes.full, (req, res) => {
  res.json(scoreGetPayload("full", normalizeLang(req.query.lang), req));
});

app.get("/report/demo", (req, res) => {
  const lang = normalizeLang(req.query.lang);
  const mode = normalizeMode(req.query.mode, "quick");
  const payload = scorePayload({ answers: sampleAnswersForMode(mode) }, lang, {
    mode,
    reportLevel: mode
  });
  res.type("html").send(renderReportPage(payload, {
    lang,
    mode,
    baseUrl: resolvePublicBaseUrl(req),
    demo: true
  }));
});

app.post(paidRoute, (req, res) => {
  try {
    res.json(scorePayload(req.body, normalizeLang(req.query.lang || req.body?.lang), {
      mode: "full",
      reportLevel: "full"
    }));
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Invalid trading-persona request."
    });
  }
});

app.post(scoreRoutes.quick, (req, res) => {
  try {
    res.json(scorePayload(req.body, normalizeLang(req.query.lang || req.body?.lang), {
      mode: "quick",
      reportLevel: "quick"
    }));
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Invalid quick trading-persona request."
    });
  }
});

app.post(scoreRoutes.standard, (req, res) => {
  try {
    res.json(scorePayload(req.body, normalizeLang(req.query.lang || req.body?.lang), {
      mode: "standard",
      reportLevel: "standard"
    }));
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Invalid standard trading-persona request."
    });
  }
});

app.post(scoreRoutes.full, (req, res) => {
  try {
    res.json(scorePayload(req.body, normalizeLang(req.query.lang || req.body?.lang), {
      mode: "full",
      reportLevel: "full"
    }));
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Invalid full trading-persona request."
    });
  }
});

app.post(previewRoute, (req, res) => {
  res.json(previewCatalogPayload(normalizeLang(req.query.lang || req.body?.lang), req));
});

app.post("/api/asp/trading-persona", (req, res) => {
  res.json(previewCatalogPayload(normalizeLang(req.query.lang || req.body?.lang), req));
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

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ ok: false, error: "Invalid JSON request body." });
  }
  return next(error);
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
  const requirePayment = isTruthy(process.env.X402_REQUIRE_PAYMENT) || process.env.NODE_ENV === "production";
  paymentRuntime.required = requirePayment;
  paymentRuntime.requested = enablePayment;

  if (!enablePayment) {
    if (requirePayment) installPaymentUnavailableMiddleware(expressApp, "payment_disabled");
    return;
  }

  if (!payTo) {
    console.warn("X402 is enabled but X402_PAY_TO is missing; paid routes are unavailable.");
    installPaymentUnavailableMiddleware(expressApp, "missing_pay_to");
    return;
  }

  const apiKey = process.env.OKX_API_KEY || "";
  const secretKey = process.env.OKX_SECRET_KEY || "";
  const passphrase = process.env.OKX_PASSPHRASE || "";
  if (!apiKey || !secretKey || !passphrase) {
    console.warn("X402 seller credentials are incomplete; paid routes are unavailable.");
    installPaymentUnavailableMiddleware(expressApp, "missing_seller_credentials");
    return;
  }

  try {
    const [{ paymentMiddleware, x402ResourceServer }, { OKXFacilitatorClient }, { ExactEvmScheme }] = await Promise.all([
      import("@okxweb3/x402-express"),
      import("@okxweb3/x402-core"),
      import("@okxweb3/x402-evm/exact/server")
    ]);
    const network = process.env.X402_NETWORK || "eip155:196";
    const initializationTimeoutMs = positiveInteger(process.env.X402_INIT_TIMEOUT_MS, 8000);
    const facilitatorClient = new OKXFacilitatorClient({
      apiKey,
      secretKey,
      passphrase,
      baseUrl: process.env.OKX_BASE_URL || "https://web3.okx.com",
      syncSettle: isTruthy(process.env.OKX_SYNC_SETTLE)
    });
    const resourceServer = new x402ResourceServer(facilitatorClient);
    resourceServer.register(network, new ExactEvmScheme());
    paymentRuntime.configured = true;
    const buildRouteConfig = (resourceBaseUrl, route, mode) => Object.fromEntries(protectedScoreMethods.map((method) => [
      `${method} ${route}`,
      {
        accepts: [{
          scheme: "exact",
          network,
          payTo,
          price: paymentPriceForMode(mode),
          maxTimeoutSeconds: Number(process.env.X402_TIMEOUT_SECONDS || 300)
        }],
        resource: `${resourceBaseUrl}${route}`,
        description: `DegenDNA ${ASSESSMENT_MODES[mode].questionCount}-question ${mode} trading persona report.`,
        mimeType: "application/json"
      }
    ]));
    const buildPaymentRoutes = (resourceBaseUrl) => ({
      ...buildRouteConfig(resourceBaseUrl, paidRoute, "full"),
      ...buildRouteConfig(resourceBaseUrl, scoreRoutes.quick, "quick"),
      ...buildRouteConfig(resourceBaseUrl, scoreRoutes.standard, "standard"),
      ...buildRouteConfig(resourceBaseUrl, scoreRoutes.full, "full")
    });

    let paymentReady = false;
    let paymentInitPromise = null;
    const initializePayment = async () => {
      if (paymentReady) return;
      paymentInitPromise ??= withTimeout(
        resourceServer.initialize(),
        initializationTimeoutMs,
        "X402 facilitator initialization timed out"
      )
        .then(() => {
          paymentReady = true;
          paymentRuntime.initialized = true;
          paymentRuntime.error = "";
        })
        .catch((error) => {
          paymentRuntime.initialized = false;
          paymentRuntime.error = "facilitator_unavailable";
          paymentInitPromise = null;
          throw error;
        });
      await paymentInitPromise;
    };

    const syncFacilitatorOnStart = requirePayment || isTruthy(process.env.X402_SYNC_ON_START);
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
      if (!protectedScoreMethods.includes(req.method) || !protectedScoreRoutes.includes(req.path)) return next();
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
    paymentRuntime.configured = false;
    paymentRuntime.initialized = false;
    paymentRuntime.error = "middleware_unavailable";
    console.warn(`X402 middleware could not be installed: ${error.message}`);
    installPaymentUnavailableMiddleware(expressApp, "middleware_unavailable");
  }
}

function installPaymentUnavailableMiddleware(expressApp, reason) {
  paymentRuntime.configured = false;
  paymentRuntime.initialized = false;
  paymentRuntime.error = reason;
  expressApp.use((req, res, next) => {
    if (!protectedScoreMethods.includes(req.method) || !protectedScoreRoutes.includes(req.path)) return next();
    return res.status(503).json({
      ok: false,
      error: "Payment service is not ready. Please try again later."
    });
  });
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    timeoutId.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
              name: "start_trading_persona_assessment",
              description: "Start a DegenDNA trading-persona assessment. Show each question with A-F choices; users can simply reply with letters.",
              inputSchema: {
                type: "object",
                properties: {
                  lang: { type: "string", enum: ["zh", "en"], default: "zh" },
                  mode: { type: "string", enum: ["quick", "standard", "full"], default: "quick" }
                }
              }
            },
            {
              name: "get_trading_persona_questionnaire",
              description: "Return the DegenDNA questionnaire with A-F choices, left/right meaning, and score mapping for quick, standard, or full mode.",
              inputSchema: {
                type: "object",
                properties: {
                  lang: { type: "string", enum: ["zh", "en"], default: "zh" },
                  mode: { type: "string", enum: ["quick", "standard", "full"], default: "quick" }
                }
              }
            },
            {
              name: "score_trading_persona",
              description: "Accept completed A-F answers and return calibration signals only. Use the paid HTTP score endpoints to unlock persona codes and reports.",
              inputSchema: {
                type: "object",
                required: ["answers"],
                properties: {
                  lang: { type: "string", enum: ["zh", "en"], default: "zh" },
                  mode: { type: "string", enum: ["quick", "standard", "full"], default: "quick" },
                  answers: {
                    oneOf: [
                      { type: "array", items: { oneOf: [
                        { type: "string", enum: ["A", "B", "C", "D", "E", "F"] },
                        { type: "number", minimum: -2, maximum: 2 }
                      ] } },
                      { type: "object", additionalProperties: { oneOf: [
                        { type: "string", enum: ["A", "B", "C", "D", "E", "F"] },
                        { type: "number", minimum: -2, maximum: 2 }
                      ] } }
                    ]
                  }
                }
              }
            },
            {
              name: "score_trading_persona_from_profile",
              description: "Create a low-friction preview from a user's natural-language trading habits, then return calibration questions.",
              inputSchema: {
                type: "object",
                required: ["profile"],
                properties: {
                  lang: { type: "string", enum: ["zh", "en"], default: "zh" },
                  profile: { type: "string", minLength: 8 },
                  mode: { type: "string", enum: ["quick", "standard"], default: "quick" }
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
  if (name === "start_trading_persona_assessment") {
    const payload = questionnairePayload(normalizeLang(args.lang), normalizeMode(args.mode || "quick"));
    return jsonRpcToolResult(message.id, payload);
  }
  if (name === "get_trading_persona_questionnaire") {
    const payload = questionnairePayload(normalizeLang(args.lang), normalizeMode(args.mode || "quick"));
    return jsonRpcToolResult(message.id, payload);
  }
  if (name === "score_trading_persona") {
    const payload = answersPreviewPayload(args, normalizeLang(args.lang), normalizeMode(args.mode || "quick"));
    return jsonRpcToolResult(message.id, payload);
  }
  if (name === "score_trading_persona_from_profile") {
    const payload = profilePreviewPayload(String(args.profile || ""), normalizeLang(args.lang), normalizeMode(args.mode || "quick"));
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

function answerScale(lang = "zh") {
  return DEGEN_PERSONA_ANSWER_OPTIONS.map((option) => ({
    key: option.key,
    value: option.value,
    side: option.side,
    label: lang === "en" ? option.en : option.zh
  }));
}

function answerChoicesForQuestion(question, lang = "zh") {
  const isEn = lang === "en";
  return DEGEN_PERSONA_ANSWER_OPTIONS.map((option) => {
    const directionLabel = isEn ? option.en : option.zh;
    const sideLabel = option.side === "left"
      ? (isEn ? "left" : "偏左")
      : (isEn ? "right" : "偏右");
    const sideText = option.side === "left" ? question.left : question.right;
    return {
      key: option.key,
      value: option.value,
      side: option.side,
      label: directionLabel,
      text: sideText,
      display: isEn
        ? `${option.key}. ${directionLabel} (${sideLabel}, ${option.value}) - ${sideText}`
        : `${option.key}. ${directionLabel}（${sideLabel}，${option.value}）｜${sideText}`
    };
  });
}

function questionnairePayload(lang = "zh", mode = "quick") {
  const modeKey = normalizeMode(mode);
  const indexes = questionIndexesForMode(modeKey);
  return {
    ok: true,
    service: serviceName,
    modelVersion: DEGEN_PERSONA_MODEL_VERSION,
    language: lang,
    mode: publicMode(modeKey, lang),
    questionCount: indexes.length,
    totalQuestionCount: DEGEN_PERSONA_QUESTIONS.length,
    answerScale: answerScale(lang),
    answerSubmission: {
      recommended: lang === "en"
        ? "For normal users, collect only A/B/C/D/E/F. Submit either an array such as [\"A\",\"C\",\"F\"] or an object keyed by question id, for example {\"degenPersona:0\":\"E\"}."
        : "面向普通用户时，只需要收集 A/B/C/D/E/F。提交时可传数组，例如 [\"A\",\"C\",\"F\"]，也可用题目 id 作为 key，例如 {\"degenPersona:0\":\"E\"}。",
      arraySupport: lang === "en"
        ? "Array answers are interpreted in the same order as the questions returned for this mode."
        : "如果传数组，服务会按当前模式返回题目的顺序自动映射。",
      acceptedFormats: ["A-F letters", "numeric values -2..2", "object keyed by degenPersona:<index>", "array in returned question order"]
    },
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
    questions: indexes.map((index, modeIndex) => {
      const question = DEGEN_PERSONA_QUESTIONS[index];
      return {
      id: `degenPersona:${index}`,
      index,
      modeIndex,
      dimension: question.dim,
      text: question.text,
      left: question.left,
      right: question.right,
      choices: answerChoicesForQuestion(question, lang),
      replyFormat: lang === "en"
        ? "Reply with one letter: A, B, C, D, E, or F."
        : "用户只需回复一个字母：A、B、C、D、E 或 F。"
      };
    }),
    paidReports: publicModes(lang),
    disclaimer: DEGEN_PERSONA_DISCLAIMER
  };
}

function scorePayload(body, lang = "zh", options = {}) {
  const mode = normalizeMode(options.mode || body?.mode || "full", "full");
  const reportLevel = normalizeMode(options.reportLevel || mode, mode);
  const answers = answersForMode(body?.answers || body, mode);
  const persona = computeDegenPersonaResultFromAnswers(answers);
  const requiredAnswerCount = ASSESSMENT_MODES[mode].questionCount;
  if (persona.answeredCount < requiredAnswerCount) {
    throw new Error(lang === "en"
      ? `Complete all ${requiredAnswerCount} answers for the ${mode} report. Received ${persona.answeredCount}.`
      : `${ASSESSMENT_MODES[mode].name}需要完整提交 ${requiredAnswerCount} 个答案，当前收到 ${persona.answeredCount} 个有效答案。`);
  }
  const fullResult = buildDegenPersonaSummary(persona, lang);
  const result = reportForLevel(fullResult, persona, reportLevel, lang);
  const evidence = buildScoreEvidence({ mode, reportLevel, answers }, result);
  return {
    ok: true,
    service: serviceName,
    mode: publicMode(mode, lang),
    reportLevel,
    modelVersion: persona.modelVersion,
    scoring: persona.scoring,
    result,
    scores: reportLevel === "quick" ? undefined : persona.scores,
    code: persona.code,
    completion: completionForMode(persona, mode),
    evidence,
    disclaimer: persona.disclaimer
  };
}

function previewCatalogPayload(lang = "zh", req) {
  const baseUrl = resolvePublicBaseUrl(req);
  return {
    ok: true,
    service: serviceName,
    modelVersion: DEGEN_PERSONA_MODEL_VERSION,
    language: lang,
    message: lang === "en"
      ? "This free endpoint only returns the assessment catalog. Paid score routes return the differentiated reports."
      : "这个免费入口只返回测评目录和购买路径；差异化报告只通过付费评分接口返回。",
    freeBoundary: lang === "en"
      ? "GET the questionnaire first, then POST answers to a paid score endpoint. The legacy POST /api/asp/trading-persona does not return a full report."
      : "先 GET 问卷，再把答案 POST 到对应付费评分接口。旧的 POST /api/asp/trading-persona 不再返回完整报告。",
    endpoints: {
      questionnaire: `${baseUrl}/api/asp/trading-persona?mode=quick`,
      quickScore: `${baseUrl}${scoreRoutes.quick}`,
      standardScore: `${baseUrl}${scoreRoutes.standard}`,
      fullScore: `${baseUrl}${scoreRoutes.full}`,
      legacyFullScore: `${baseUrl}${paidRoute}`
    },
    modes: publicModes(lang, baseUrl),
    disclaimer: DEGEN_PERSONA_DISCLAIMER
  };
}

function scoreGetPayload(mode = "full", lang = "zh", req) {
  const modeKey = normalizeMode(mode, "full");
  const baseUrl = resolvePublicBaseUrl(req);
  return {
    ok: true,
    service: serviceName,
    modelVersion: DEGEN_PERSONA_MODEL_VERSION,
    mode: publicMode(modeKey, lang, baseUrl),
    message: lang === "en"
      ? "This paid endpoint is x402-protected. Submit answers with POST to generate the report."
      : "这个付费 endpoint 已接入 x402。请使用 POST 提交 answers 生成正式报告。",
    expectedMethod: "POST",
    acceptsAnswerShape: {
      answers: "array of A-F letters | object keyed by degenPersona:<index> | numeric values -2..2",
      recommended: lang === "en"
        ? "Ask the user to answer with A/B/C/D/E/F, then submit those letters in the returned question order."
        : "建议让用户只回复 A/B/C/D/E/F，再按题库返回顺序提交这些字母。"
    },
    questionnaire: `${baseUrl}/api/asp/trading-persona?mode=${modeKey}&lang=${lang}`,
    demoReport: `${baseUrl}/report/demo?mode=${modeKey}&lang=${lang}`,
    disclaimer: DEGEN_PERSONA_DISCLAIMER
  };
}

function answersPreviewPayload(body, lang = "zh", mode = "quick") {
  const modeKey = normalizeMode(mode);
  const answers = answersForMode(body?.answers || body, modeKey);
  const persona = computeDegenPersonaResultFromAnswers(answers);
  const strongest = [...persona.dimensions].sort((a, b) => b.strength - a.strength).slice(0, 2);
  return {
    ok: true,
    service: serviceName,
    previewOnly: true,
    language: lang,
    mode: publicMode(modeKey, lang),
    answeredCount: persona.answeredCount,
    requiredAnswerCount: ASSESSMENT_MODES[modeKey].questionCount,
    enoughForPaidReport: persona.answeredCount >= ASSESSMENT_MODES[modeKey].questionCount,
    message: lang === "en"
      ? "Answers were accepted for calibration. Purchase a paid score route to unlock the persona code and report."
      : "答案已用于校准预览。人格码和完整报告需要通过对应付费评分接口解锁。",
    visibleSignals: strongest.map((dimension) => ({
      key: dimension.key,
      name: dimension.name,
      direction: dimension.direction,
      strength: dimension.strength
    })),
    paidReports: publicModes(lang),
    disclaimer: DEGEN_PERSONA_DISCLAIMER
  };
}

function profilePreviewPayload(profile, lang = "zh", mode = "quick") {
  const modeKey = normalizeMode(mode);
  const text = String(profile || "").trim();
  const signals = inferProfileSignals(text, lang);
  const calibrationQuestions = questionIndexesForMode(modeKey).slice(0, 5).map((index, modeIndex) => {
    const question = DEGEN_PERSONA_QUESTIONS[index];
    return {
      id: `degenPersona:${index}`,
      index,
      modeIndex,
      dimension: question.dim,
      text: question.text,
      left: question.left,
      right: question.right,
      choices: answerChoicesForQuestion(question, lang),
      replyFormat: lang === "en"
        ? "Reply with one letter: A, B, C, D, E, or F."
        : "用户只需回复一个字母：A、B、C、D、E 或 F。"
    };
  });
  return {
    ok: true,
    service: serviceName,
    previewOnly: true,
    language: lang,
    inputLength: text.length,
    recommendedMode: publicMode(modeKey, lang),
    initialSignals: signals,
    calibrationQuestions,
    nextAction: lang === "en"
      ? "Answer these calibration questions, then use the matching paid score endpoint for the report."
      : "先回答这些校准题，再调用对应付费评分接口生成正式报告。",
    disclaimer: DEGEN_PERSONA_DISCLAIMER
  };
}

function publicModes(lang = "zh", baseUrl = "") {
  return Object.keys(ASSESSMENT_MODES).map((mode) => publicMode(mode, lang, baseUrl));
}

function publicMode(mode, lang = "zh", baseUrl = "") {
  const modeKey = normalizeMode(mode, "full");
  const config = ASSESSMENT_MODES[modeKey];
  const route = scoreRoutes[modeKey] || paidRoute;
  return {
    key: config.key,
    name: config.name,
    serviceName: config.serviceName,
    reportName: config.reportName,
    questionCount: config.questionCount,
    priceUsd: Number(paymentPriceForMode(config.key).replace(/^\$/, "")),
    price: paymentPriceForMode(config.key),
    questionnaire: baseUrl ? `${baseUrl}/api/asp/trading-persona?mode=${config.key}` : `/api/asp/trading-persona?mode=${config.key}`,
    endpoint: baseUrl ? `${baseUrl}${route}` : route,
    promise: config.promise,
    unlocks: reportUnlocks(config.key, lang)
  };
}

function reportUnlocks(mode, lang = "zh") {
  const isEn = lang === "en";
  const unlocks = {
    quick: isEn
      ? ["Persona code", "warm first read", "two strengths", "two blind spots", "one immediate rule", "share copy"]
      : ["交易人格码", "温和的第一判断", "2 个优势", "2 个盲区", "1 条立刻可执行规则", "X 分享文案"],
    standard: isEn
      ? ["Persona code", "six-dimension explanations", "strengths and blind spots", "three action priorities", "light review checklist", "share copy"]
      : ["交易人格码", "六维逐项解释", "优势与盲区", "3 个行动优先级", "轻量复盘清单", "X 分享文案"],
    full: isEn
      ? ["Complete 72-question profile", "six-dimension explanations", "four scenario playbooks", "full trading plan", "measurable 7/14/30-day roadmap", "share copy"]
      : ["完整 72 题画像", "六维逐项解释", "4 类交易情境应对", "完整交易计划", "可衡量的 7/14/30 天路线", "X 分享文案"]
  };
  return unlocks[normalizeMode(mode)] || unlocks.quick;
}

function reportForLevel(fullResult, persona, level, lang = "zh") {
  const reportLevel = normalizeMode(level, "full");
  const share = shareAssets(fullResult, persona, lang);
  const narrative = buildReportNarrative(fullResult, persona, reportLevel, lang);
  const dimensionInsights = buildDimensionInsights(fullResult.dimensions, lang);
  const priorityActions = buildPriorityActions(fullResult.tradingPlan, lang);
  const scenarioGuidance = buildScenarioGuidance(fullResult, persona, lang);
  const trainingRoadmap = buildTrainingRoadmap(fullResult, persona, lang);
  const base = {
    reportLevel,
    reportName: ASSESSMENT_MODES[reportLevel].reportName,
    abbr: fullResult.abbr,
    title: fullResult.title,
    code: fullResult.code,
    axisCode: fullResult.axisCode,
    subtype: fullResult.subtype,
    intensity: fullResult.intensity,
    confidence: fullResult.confidence,
    summary: fullResult.summary,
    classification: {
      primaryType: fullResult.title,
      subtype: fullResult.subtype?.label,
      intensity: fullResult.intensity?.label,
      confidence: fullResult.confidence?.label
    },
    narrative,
    ...share
  };

  if (reportLevel === "quick") {
    return {
      ...base,
      strengths: fullResult.strengths.slice(0, 2),
      risks: fullResult.risks.slice(0, 2),
      mainDimensions: strongestDimensions(fullResult, 2),
      quickAdvice: [
        fullResult.protocol,
        fullResult.tradingPlan?.entryChecklist?.[0]
      ].filter(Boolean).slice(0, 2),
      immediateAction: priorityActions[0],
      reportPage: reportPageShape("quick", lang),
      upgradeOptions: [publicMode("standard", lang), publicMode("full", lang)]
    };
  }

  if (reportLevel === "standard") {
    return {
      ...base,
      subtitle: fullResult.subtitle,
      strengths: fullResult.strengths,
      risks: fullResult.risks,
      protocol: fullResult.protocol,
      dimensions: fullResult.dimensions,
      dimensionInsights,
      priorityActions,
      tradingPlan: compactTradingPlan(fullResult.tradingPlan, "standard"),
      reportPage: reportPageShape("standard", lang),
      upgradeOptions: [publicMode("full", lang)]
    };
  }

  return {
    ...fullResult,
    ...share,
    reportLevel: "full",
    reportName: ASSESSMENT_MODES.full.reportName,
    classification: base.classification,
    narrative,
    dimensionInsights,
    priorityActions,
    scenarioGuidance,
    trainingRoadmap,
    closingNote: lang === "en"
      ? "You do not need to become a different trader. The goal is to protect your strengths with rules that still work when the market gets loud."
      : "你不需要变成另一个交易者。真正有效的成长，是保留自己的敏锐和行动力，同时用一套在市场最吵时仍然有效的规则保护它。",
    reportPage: reportPageShape("full", lang)
  };
}

function buildReportNarrative(result, persona, level, lang = "zh") {
  const isEn = lang === "en";
  const strength = result.strengths?.[0] || (isEn ? "adapt quickly" : "快速适应");
  const risk = result.risks?.[0] || (isEn ? "repeat a costly pattern" : "重复高成本动作");
  const primary = [...(result.dimensions || [])].sort((a, b) => b.strength - a.strength)[0];
  const confidenceNotes = {
    quick: isEn
      ? "This 12-question result is an early directional signal. Use it to spot the first risk pattern, not to define yourself."
      : "这份 12 题结果是一张早期风险雷达。它适合帮你先看见最需要留意的动作，但不需要急着用一个标签定义自己。",
    standard: isEn
      ? "The 24-question profile is sufficient for a practical six-axis review. Recheck it after a meaningful change in strategy or market cycle."
      : "24 题已经能形成可执行的六维轮廓。若你的交易周期、仓位习惯或市场阶段明显变化，建议重新测一次，而不是把结果当成永久身份。",
    full: isEn
      ? "The complete sample supports a higher-confidence behavioral profile. It describes recurring preferences, not fixed traits or market skill."
      : "完整作答让这份画像拥有更高置信度。它描述的是你在压力和机会面前容易重复的偏好，不是能力高低，也不是一成不变的命运。"
  };
  return {
    opening: isEn
      ? `First, there is nothing inherently wrong with being a ${result.title}. Your instinct to ${strength} is a real trading resource.`
      : `先说一句重要的：成为「${result.title}」并没有对错。你身上“${strength}”的部分，是市场里很真实、也很珍贵的资源。`,
    corePattern: isEn
      ? `Your edge and your blind spot are often powered by the same switch. Under pressure, ${strength} can slide into ${risk}.`
      : `你的优势和盲区，往往来自同一个按钮。平稳时，它让你${strength}；当热度、盈亏或时间压力放大时，它也可能滑向“${risk}”。`,
    primarySignal: isEn
      ? `${primary?.name || "Your primary axis"} currently leans toward ${primary?.direction || "one side"}. Treat that as the first place to add a guardrail.`
      : `当前最值得优先照顾的是「${primary?.name || "主维度"}」上的“${primary?.direction || "偏好"}”。不是要消灭它，而是先给它加一道可执行的护栏。`,
    confidenceNote: confidenceNotes[level] || confidenceNotes.quick,
    reassurance: isEn
      ? "The goal is not to suppress your instincts. It is to make sure they still serve you when the market becomes noisy."
      : "你要训练的不是“别有情绪”或“别犯错”，而是在情绪出现、市场变吵的时候，仍然知道下一步该做什么。",
    subtypeNote: persona.subtype?.description || ""
  };
}

function buildDimensionInsights(dimensions, lang = "zh") {
  const isEn = lang === "en";
  const zhCopy = {
    social: {
      right: ["你对群体注意力和共识升温很敏感，往往能比纯数据型交易者更早感到市场温度变化。", "这让你更容易发现正在形成的机会，也更容易在多人同时兴奋时把线索误当成结论。", "把每条外部观点拆成三栏：它提供了什么线索、我自己的证据是什么、什么情况会证明我错了。"],
      left: ["你习惯先回到自己的证据和清单，不容易被群聊节奏直接带走。", "独立性保护了判断质量，但也可能让你错过市场注意力已经转向的事实。", "每次形成结论后，主动找一条高质量反方观点，再决定是否调整，而不是为了合群而调整。"]
    },
    signal: {
      right: ["你擅长理解故事、情绪和传播路径，对早期叙事窗口有天然雷达。", "想象空间能帮助你提前站位，也可能让你对反证数据过度宽容。", "每个叙事必须配一条可量化反证指标；指标失效时先降仓，再讨论故事。"],
      left: ["你更相信数据闭环、资金路径和可验证证据，判断通常有清晰依据。", "严谨能过滤噪音，但等待完美证据可能让学习和试错发生得太晚。", "为尚未闭环但值得观察的机会设置固定小额观察仓，用真实反馈更新判断。"]
    },
    execution: {
      right: ["盘面变化会快速点燃你的行动系统，你能在机会出现时迅速响应。", "高压环境下，你也更容易临场改计划、放宽止损或用下一笔修复上一笔情绪。", "下单前写出最大亏损、加仓条件和撤退线；任一项写不清楚，就先不下单。"],
      left: ["你倾向按事前规则处理交易，执行稳定性通常优于临场型交易者。", "规则能保护你，也可能在市场结构变化时变成僵硬的安全感。", "保留一条提前定义的小仓弹性规则，让系统允许试探，但不允许临场无限改写。"]
    },
    risk: {
      right: ["你愿意承受波动换取赔率，面对不确定性时不容易因为害怕而完全缺席。", "进攻性是收益弹性的来源，也可能让仓位在兴奋和连续盈利后失去上限。", "高波动仓位统一拆成观察仓、确认仓和主仓，任何时候都不一次性打满。"],
      left: ["你会先保护本金、流动性和心理承受力，通常更能避免致命错误。", "防守让你活得久，但过度谨慎也可能把“还没完美”变成永远不上车。", "为高置信机会保留固定试错额度，用可承受的小亏换取真实信息。"]
    },
    horizon: {
      right: ["你偏好快速反馈和事件窗口，能及时切换注意力并捕捉阶段性波动。", "速度带来机会，也会放大无聊交易、过度点击和手续费侵蚀。", "给每天设置有效交易次数上限；超过上限后只能记录，不能新开计划外仓位。"],
      left: ["你能忍受较长验证周期，不容易被短期噪音轻易洗出。", "耐心是优势，但如果没有复核日期，也可能把失效判断包装成长期信仰。", "每个长线假设都写清复核日、失效指标和重新建模条件。"]
    },
    validation: {
      right: ["你对错过、他人战绩和钱包波动较敏感，这让你能迅速感到市场情绪拐点。", "外部反馈也可能进入自我评价，让追高、扳回和证明自己变成隐形下单理由。", "看到盈利截图或错过急拉后，至少等待一轮 K 线或 20 分钟，再重新填写入场理由。"],
      left: ["你较能把单笔盈亏与自我价值分开，情绪恢复速度和独立判断通常更稳定。", "稳定能减少冲动，但也可能让你低估市场共识变化对价格的真实影响。", "复盘时同时记录过程质量和市场反馈，既不因亏损否定自己，也不因自信忽略变化。"]
    }
  };

  return (dimensions || []).map((dimension) => {
    const side = dimension.score >= 0 ? "right" : "left";
    const strengthLabel = dimension.strength >= 75
      ? (isEn ? "high" : "高强度")
      : dimension.strength >= 50
        ? (isEn ? "clear" : "明显")
        : dimension.strength >= 30
          ? (isEn ? "visible" : "可见")
          : (isEn ? "light" : "轻微");
    if (isEn) {
      return {
        key: dimension.key,
        name: dimension.name,
        direction: dimension.direction,
        strength: dimension.strength,
        strengthLabel,
        observation: `${dimension.name} shows a ${strengthLabel} preference toward ${dimension.direction}.`,
        watchout: "This preference can be useful in the right environment and costly when stress turns it into an automatic response.",
        practice: "Define one observable trigger and one pre-committed response before the next trade."
      };
    }
    const copy = zhCopy[dimension.key]?.[side] || [
      `你在「${dimension.name}」上更接近“${dimension.direction}”。`,
      "这个偏好既有价值，也需要在压力下被规则保护。",
      "下一笔交易前，为这个维度写下一条能被观察和执行的规则。"
    ];
    return {
      key: dimension.key,
      name: dimension.name,
      direction: dimension.direction,
      strength: dimension.strength,
      strengthLabel,
      observation: copy[0],
      watchout: copy[1],
      practice: copy[2]
    };
  });
}

function buildPriorityActions(plan, lang = "zh") {
  const isEn = lang === "en";
  const items = [
    {
      priority: 1,
      title: isEn ? "Stabilize the trigger" : "先稳住触发",
      why: isEn ? "Create space between emotion and action." : "先在刺激与下单之间留出空间，避免情绪替你完成决策。",
      action: plan?.emotionalProtocol?.[0]
    },
    {
      priority: 2,
      title: isEn ? "Cap the position" : "再锁住仓位",
      why: isEn ? "Keep one decision from defining the whole account." : "让任何一次判断都不足以伤害整个账户，也不需要靠下一笔证明自己。",
      action: plan?.positionRules?.[0]
    },
    {
      priority: 3,
      title: isEn ? "Make the exit mechanical" : "最后机械退出",
      why: isEn ? "Decide before the market starts negotiating with you." : "把退出写在情绪出现之前，触发后先执行，再复盘。",
      action: plan?.exitRules?.[0]
    }
  ];
  return items.filter((item) => item.action);
}

function buildScenarioGuidance(result, persona, lang = "zh") {
  const isEn = lang === "en";
  const plan = result.tradingPlan || {};
  if (isEn) {
    return [
      { scenario: "A token suddenly accelerates", likelyResponse: "Urgency rises and the entry standard becomes easier to rewrite.", betterMove: plan.entryChecklist?.[0] },
      { scenario: "Two losses in a row", likelyResponse: "The next trade starts carrying the emotional weight of the previous one.", betterMove: plan.emotionalProtocol?.[1] || plan.emotionalProtocol?.[0] },
      { scenario: "A winning streak", likelyResponse: "Confidence and position size can rise faster than evidence quality.", betterMove: plan.exitRules?.[1] },
      { scenario: "No clear setup", likelyResponse: "Boredom can disguise itself as opportunity.", betterMove: "Treat staying flat as an active position and write down what evidence would justify re-entry." }
    ].filter((item) => item.betterMove);
  }
  return [
    {
      scenario: "热点突然急拉",
      likelyResponse: "紧迫感上升，原本的入场标准容易被“再不上就没了”悄悄改写。",
      betterMove: plan.entryChecklist?.[0]
    },
    {
      scenario: "连续两笔亏损",
      likelyResponse: persona.subtype?.code === "H"
        ? "下一笔交易开始承担“把上一笔赢回来”的任务，判断会变得更快、更重。"
        : "你可能把结果波动误认为整个系统失效，急着换策略或证明自己。",
      betterMove: plan.emotionalProtocol?.[1] || plan.emotionalProtocol?.[0]
    },
    {
      scenario: "连续盈利",
      likelyResponse: "信心、仓位和点击频率可能同时升温，但证据质量未必同步提高。",
      betterMove: plan.exitRules?.[1]
    },
    {
      scenario: "没有明确机会",
      likelyResponse: "无聊或空仓焦虑可能伪装成机会感，让计划外交易看起来很合理。",
      betterMove: "把空仓视为主动仓位：只记录“什么新证据出现时才重新评估”，证据没出现就不靠频繁下单制造反馈。"
    }
  ].filter((item) => item.betterMove);
}

function buildTrainingRoadmap(result, persona, lang = "zh") {
  const isEn = lang === "en";
  if (isEn) {
    return [
      { period: "7 days", goal: "Externalize the decision", action: "Before every trade, write the thesis, invalidation, and maximum loss.", successMetric: "At least 80% of trades have all three fields completed before entry." },
      { period: "14 days", goal: "Identify the trigger", action: "Tag each urge with its source: social proof, acceleration, drawdown, boredom, or planned signal.", successMetric: "Name the two triggers most associated with rule-breaking." },
      { period: "30 days", goal: "Build one durable rule", action: "Improve only one dimension and keep timeframe, asset universe, and signal source stable.", successMetric: "Rule adherence improves without increasing maximum planned loss." }
    ];
  }
  return [
    {
      period: "7 天",
      goal: "把临场感觉写到纸面上",
      action: "每笔交易前只写三行：入场理由、失效条件、最大可承受亏损。没有写完，不下单。",
      successMetric: "至少 80% 的交易在入场前完成三行记录；本阶段不以盈亏评价自己，只看是否按流程执行。"
    },
    {
      period: "14 天",
      goal: "找到真正驱动你的触发源",
      action: "每次想交易时标记来源：晒图、群聊、急拉、回撤、无聊，或原计划信号。",
      successMetric: `找出最常导致规则失守的两个触发源，并为「${persona.subtype?.label || "主要偏好"}」写下一条冷却动作。`
    },
    {
      period: "30 天",
      goal: "把一条规则练成默认动作",
      action: "只优化一个行为维度，不同时更换周期、仓位、标的和信号源；每周固定复盘一次。",
      successMetric: `规则执行率持续提高，同时单笔计划亏损不扩大；最终沉淀一份属于「${result.title}」的个人交易守则。`
    }
  ];
}

function strongestDimensions(result, count) {
  return [...(result.dimensions || [])]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, count)
    .map((dimension) => ({
      key: dimension.key,
      name: dimension.name,
      direction: dimension.direction,
      strength: dimension.strength,
      tag: dimension.tag
    }));
}

function compactTradingPlan(plan, level) {
  if (!plan || level === "full") return plan;
  return {
    headline: plan.headline,
    highAxes: plan.highAxes?.slice(0, 3) || [],
    lowAxes: plan.lowAxes?.slice(0, 3) || [],
    entryChecklist: plan.entryChecklist?.slice(0, 2) || [],
    positionRules: plan.positionRules?.slice(0, 2) || [],
    exitRules: plan.exitRules?.slice(0, 1) || [],
    emotionalProtocol: plan.emotionalProtocol?.slice(0, 1) || [],
    reviewQuestions: plan.reviewQuestions?.slice(0, 3) || [],
    trainingPlan: plan.trainingPlan?.slice(0, 1) || []
  };
}

function reportPageShape(level, lang = "zh") {
  const isEn = lang === "en";
  const visualDesign = {
    theme: "neon-risk-passport",
    primaryAsset: "/assets/degendna-logo.png",
    palette: {
      background: "#070b11",
      panel: "#0d141e",
      accent: "#43e7ff",
      positive: "#7cffb2",
      warning: "#ffe08a",
      danger: "#ff8b8b"
    },
    components: ["heroBadge", "warmNarrative", "shareCard", "axisMeters", "actionChecklist", "lockedUpgradeRail"]
  };
  const shapes = {
    quick: {
      layout: "quick-card",
      visualDesign,
      unlockedSections: isEn
        ? ["persona badge", "warm first read", "top strengths", "top blind spots", "one action rule", "share copy"]
        : ["人格徽章", "温和的第一判断", "核心优势", "主要盲区", "一条行动规则", "分享文案"],
      lockedSections: isEn
        ? ["six-dimension chart", "full review checklist", "7/14/30-day training plan"]
        : ["六维雷达", "完整复盘清单", "7/14/30 天训练计划"]
    },
    standard: {
      layout: "standard-report",
      visualDesign,
      unlockedSections: isEn
        ? ["persona badge", "six-dimension explanations", "action priorities", "light trading plan", "share copy"]
        : ["人格徽章", "六维逐项解释", "行动优先级", "轻量交易计划", "分享文案"],
      lockedSections: isEn
        ? ["full 72-question confidence", "complete entry/position/exit rules", "30-day training plan"]
        : ["完整 72 题置信度", "完整入场/仓位/退出规则", "30 天训练计划"]
    },
    full: {
      layout: "full-playbook",
      visualDesign: {
        ...visualDesign,
        components: ["heroBadge", "warmNarrative", "shareCard", "sixAxisInsights", "scenarioPlaybook", "fullPlaybook", "trainingRoadmap", "reviewChecklist"]
      },
      unlockedSections: isEn
        ? ["complete report", "six-dimension explanations", "scenario playbooks", "full trading plan", "measurable training roadmap", "share copy"]
        : ["完整报告", "六维逐项解释", "情境应对卡", "完整交易计划", "可衡量训练路线", "分享文案"],
      lockedSections: []
    }
  };
  return shapes[normalizeMode(level)] || shapes.quick;
}

function shareAssets(result, persona, lang = "zh") {
  const strength = result.strengths?.[0] || (lang === "en" ? "fast self-review" : "快速复盘");
  const risk = result.risks?.[0] || (lang === "en" ? "repeating the same loss pattern" : "重复同一种亏损动作");
  const title = result.title || persona.type?.name || "DegenDNA";
  const oneLineSummary = lang === "en"
    ? `Your edge is ${strength}. The next step is not to suppress it, but to place a guardrail around ${risk}.`
    : `你最有价值的能力是${strength}；下一步不是压住自己，而是为“${risk}”提前加一道规则。`;
  return {
    shareTitle: lang === "en"
      ? `I am ${persona.profileCode} ${title}`
      : `我是 ${persona.profileCode} ${title}`,
    oneLineSummary,
    shareCardText: lang === "en"
      ? `My DegenDNA: ${persona.profileCode} | ${title} | Edge: ${strength} | Blind spot: ${risk}`
      : `我的 DegenDNA：${persona.profileCode}｜${title}｜我想保留：${strength}｜我会训练：${risk}`,
    twitterCopy: lang === "en"
      ? `I just checked my on-chain trading persona: ${persona.profileCode} ${title}. ${oneLineSummary} This is a behavior review, not financial advice. #OKXAI`
      : `刚测了一下我的链上交易人格：${persona.profileCode} ${title}。${oneLineSummary}它不告诉我买什么，只提醒我下一次别再怎样亏。#OKXAI`
  };
}

function completionForMode(persona, mode) {
  const modeQuestionCount = questionIndexesForMode(mode).length;
  const modeAnsweredCount = Math.min(persona.answeredCount, modeQuestionCount);
  return {
    answeredCount: persona.answeredCount,
    modeQuestionCount,
    totalQuestionCount: persona.questionCount,
    modeCompletionRate: modeQuestionCount ? Number((modeAnsweredCount / modeQuestionCount).toFixed(4)) : 0,
    totalCompletionRate: persona.completionRate
  };
}

function answersForMode(input, mode) {
  const modeKey = normalizeMode(mode, "full");
  if (modeKey === "full") return input;

  const source = Array.isArray(input) ? input : Object(input || {});
  const indexes = questionIndexesForMode(modeKey);
  const mapped = {};
  indexes.forEach((questionIndex, modeIndex) => {
    const value = Array.isArray(source)
      ? source[modeIndex]
      : source[`degenPersona:${questionIndex}`]
        ?? source[questionIndex]
        ?? source[String(questionIndex)];
    if (value !== undefined) mapped[`degenPersona:${questionIndex}`] = value;
  });
  return mapped;
}

function questionIndexesForMode(mode) {
  const modeKey = normalizeMode(mode);
  const config = ASSESSMENT_MODES[modeKey];
  if (!Number.isFinite(config.perDimension)) {
    return DEGEN_PERSONA_QUESTIONS.map((_question, index) => index);
  }

  const counts = Object.fromEntries(Object.keys(DEGEN_PERSONA_DIMENSIONS).map((key) => [key, 0]));
  const indexes = [];
  DEGEN_PERSONA_QUESTIONS.forEach((question, index) => {
    if (!question.dim || counts[question.dim] === undefined) return;
    if (counts[question.dim] >= config.perDimension) return;
    indexes.push(index);
    counts[question.dim] += 1;
  });

  if (indexes.length < config.questionCount) {
    DEGEN_PERSONA_QUESTIONS.forEach((_question, index) => {
      if (indexes.length >= config.questionCount) return;
      if (!indexes.includes(index)) indexes.push(index);
    });
  }

  return indexes.slice(0, config.questionCount);
}

function inferProfileSignals(profile, lang = "zh") {
  const text = profile.toLowerCase();
  const signalDefinitions = [
    {
      key: "fomo",
      zh: "错过敏感 / 容易追高",
      en: "FOMO-sensitive / chase-prone",
      words: ["fomo", "追高", "错过", "别人赚钱", "忍不住", "上头", "冲进去", "急拉"]
    },
    {
      key: "revenge",
      zh: "回撤修复 / 亏损后急着扳回",
      en: "drawdown repair / revenge-trading risk",
      words: ["扳回", "回本", "亏了", "连亏", "报复", "revenge", "drawdown", "loss"]
    },
    {
      key: "overcautious",
      zh: "风控过强 / 容易错过窗口",
      en: "over-cautious / window-missing risk",
      words: ["不敢", "犹豫", "错过", "怕亏", "太谨慎", "overcautious", "hesitate"]
    },
    {
      key: "narrative",
      zh: "叙事雷达 / 传播敏感",
      en: "narrative radar / attention-flow sensitive",
      words: ["叙事", "热点", "kol", "推特", "twitter", "x ", "meme", "story", "narrative"]
    },
    {
      key: "leverage",
      zh: "高波动偏好 / 杠杆与仓位需要约束",
      en: "high-volatility preference / leverage guardrails needed",
      words: ["合约", "杠杆", "爆仓", "加仓", "扛单", "leverage", "perp"]
    }
  ];
  const matches = signalDefinitions
    .map((definition) => ({
      key: definition.key,
      label: lang === "en" ? definition.en : definition.zh,
      hits: definition.words.filter((word) => text.includes(word.toLowerCase())).length
    }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3);

  if (matches.length) return matches;
  return [{
    key: "needs-calibration",
    label: lang === "en" ? "needs calibration questions" : "需要用校准题确认主要偏好",
    hits: 0
  }];
}

function paymentPriceForMode(mode) {
  const modeKey = normalizeMode(mode, "full");
  const config = ASSESSMENT_MODES[modeKey];
  const raw = process.env[config.priceEnv] || (modeKey === "full" ? process.env.X402_PRICE : "") || config.price;
  const numeric = Number(String(raw).trim().replace(/^\$/, ""));
  if (Number.isFinite(numeric)) return `$${numeric.toFixed(2)}`;
  const value = String(raw || config.price).trim();
  return value.startsWith("$") ? value : `$${value}`;
}

function normalizeMode(value, fallback = "quick") {
  const raw = String(value || "").trim().toLowerCase();
  return ASSESSMENT_MODES[raw] ? raw : fallback;
}

function buildScoreEvidence(request, result) {
  return {
    requestId: `${request.mode}-${shortHash(request)}`,
    requestHash: shortHash(request),
    resultHash: shortHash({
      code: result.code,
      reportLevel: result.reportLevel,
      reportName: result.reportName,
      oneLineSummary: result.oneLineSummary
    })
  };
}

function shortHash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 16);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sampleAnswersForMode(mode) {
  const dimensionProfile = {
    social: 1.2,
    signal: 1.2,
    execution: 2,
    risk: 1.2,
    horizon: 1.2,
    validation: 2
  };
  const answers = {};
  questionIndexesForMode(mode).forEach((questionIndex) => {
    const question = DEGEN_PERSONA_QUESTIONS[questionIndex];
    answers[`degenPersona:${questionIndex}`] = dimensionProfile[question.dim] ?? 0.35;
  });
  return answers;
}

function renderReportPage(payload, options = {}) {
  const lang = options.lang || "zh";
  const isEn = lang === "en";
  const result = payload.result || {};
  const mode = normalizeMode(payload.reportLevel || payload.mode?.key || options.mode, "quick");
  const modeConfig = ASSESSMENT_MODES[mode];
  const baseUrl = options.baseUrl || "";
  const title = result.shareTitle || `${result.code || "DegenDNA"} ${result.title || ""}`;
  const description = result.oneLineSummary || result.summary || "";
  const dimensions = result.dimensions || result.mainDimensions || [];
  const plan = result.tradingPlan || {};
  const locked = result.reportPage?.lockedSections || [];
  const unlocked = result.reportPage?.unlockedSections || [];
  const reportUrl = `${baseUrl}/report/demo?mode=${mode}&lang=${lang}`;
  const navItems = [
    ["overview", isEn ? "Overview" : "先读结论"],
    ["axes", isEn ? "Profile" : mode === "quick" ? "主导维度" : "六维画像"],
    ["actions", isEn ? "Actions" : "行动优先级"],
    ["playbook", isEn ? "Playbook" : "交易行动卡"],
    ...(result.trainingRoadmap?.length || plan.trainingPlan?.length ? [["training", isEn ? "Training" : "训练路线"]] : []),
    ...(result.scenarioGuidance?.length ? [["scenarios", isEn ? "Scenarios" : "行情应对"]] : [])
  ];

  return `<!doctype html>
<html lang="${isEn ? "en" : "zh-CN"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | DegenDNA</title>
  <meta name="description" content="${escapeHtml(description)}">
  <style>
    :root {
      color-scheme: dark;
      --bg: #070b11;
      --panel: rgba(13, 20, 30, 0.86);
      --panel-strong: rgba(16, 28, 40, 0.96);
      --line: rgba(128, 231, 255, 0.22);
      --text: #eef8ff;
      --muted: #8aa2b4;
      --cyan: #43e7ff;
      --green: #7cffb2;
      --gold: #ffe08a;
      --red: #ff8b8b;
      --violet: #b995ff;
      --shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      min-height: 100vh;
      background:
        linear-gradient(rgba(67, 231, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(67, 231, 255, 0.04) 1px, transparent 1px),
        linear-gradient(180deg, #09111a 0%, #06090f 62%, #030507 100%);
      background-size: 34px 34px, 34px 34px, auto;
    }
    a { color: inherit; }
    .page {
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 48px;
    }
    .hero {
      position: relative;
      overflow: hidden;
      min-height: 430px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background:
        linear-gradient(132deg, rgba(9, 18, 28, 0.96), rgba(9, 13, 20, 0.82)),
        url("/assets/degendna-logo.png") right -70px top -80px / 520px auto no-repeat;
      box-shadow: var(--shadow);
      padding: clamp(22px, 5vw, 56px);
    }
    .hero:after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(67, 231, 255, 0.8), transparent);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 12px;
    }
    .brand img {
      width: 42px;
      height: 42px;
      border-radius: 8px;
      border: 1px solid rgba(67, 231, 255, 0.35);
    }
    .tier-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 52px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 7px 11px;
      border: 1px solid rgba(67, 231, 255, 0.28);
      border-radius: 999px;
      color: var(--cyan);
      background: rgba(67, 231, 255, 0.08);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    h1 {
      max-width: 780px;
      margin: 22px 0 0;
      font-size: clamp(38px, 7vw, 78px);
      line-height: 0.96;
      letter-spacing: 0;
    }
    .lead {
      max-width: 690px;
      margin: 20px 0 0;
      color: #cbe0ed;
      font-size: clamp(16px, 2vw, 22px);
      line-height: 1.55;
    }
    .hero-bottom {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 34px;
    }
    .metric {
      min-width: 148px;
      padding: 14px 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: rgba(4, 9, 14, 0.58);
    }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 8px;
    }
    .metric strong {
      display: block;
      color: var(--text);
      font-size: 20px;
    }
    .section {
      margin-top: 18px;
      border: 1px solid rgba(128, 231, 255, 0.16);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 16px 46px rgba(0, 0, 0, 0.22);
      padding: clamp(18px, 3vw, 28px);
    }
    .section h2 {
      margin: 0 0 16px;
      font-size: 18px;
      letter-spacing: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-top: 18px;
    }
    .list {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .list li {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 13px 14px;
      color: #dcecf5;
      background: rgba(255, 255, 255, 0.035);
      line-height: 1.45;
    }
    .list.good li { border-color: rgba(124, 255, 178, 0.18); }
    .list.risk li { border-color: rgba(255, 139, 139, 0.22); }
    .share-card {
      background:
        linear-gradient(135deg, rgba(67, 231, 255, 0.14), rgba(255, 224, 138, 0.08)),
        var(--panel-strong);
    }
    .share-text {
      margin: 0;
      color: #e6f8ff;
      font-size: clamp(18px, 2.3vw, 30px);
      line-height: 1.35;
      font-weight: 800;
    }
    .share-copy {
      margin-top: 14px;
      color: var(--muted);
      line-height: 1.6;
      word-break: break-word;
    }
    .axis-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .axis {
      display: grid;
      gap: 9px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.035);
    }
    .axis-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #dff5ff;
      font-weight: 800;
      line-height: 1.35;
    }
    .bar {
      height: 9px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
    }
    .bar i {
      display: block;
      width: var(--value);
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--cyan), var(--green));
    }
    .axis small {
      color: var(--muted);
    }
    .narrative {
      display: grid;
      gap: 14px;
    }
    .narrative p {
      margin: 0;
      color: #dcecf5;
      line-height: 1.75;
    }
    .narrative .opening {
      color: var(--text);
      font-size: clamp(18px, 2vw, 24px);
      font-weight: 750;
      line-height: 1.55;
    }
    .note {
      border-left: 3px solid var(--cyan);
      padding: 12px 14px;
      color: #cfe6f2;
      background: rgba(67, 231, 255, 0.055);
      line-height: 1.65;
    }
    .insight-list, .scenario-list, .priority-list {
      display: grid;
      gap: 14px;
    }
    .insight-row, .scenario-row, .priority-row {
      display: grid;
      gap: 9px;
      padding: 16px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.09);
    }
    .insight-row:first-child, .scenario-row:first-child, .priority-row:first-child { border-top: 0; }
    .insight-head, .priority-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      color: var(--text);
      font-weight: 800;
    }
    .insight-row p, .scenario-row p, .priority-row p {
      margin: 0;
      color: #c9dce7;
      line-height: 1.65;
    }
    .insight-row strong, .scenario-row strong, .priority-row strong { color: var(--cyan); }
    .practice { color: var(--green) !important; }
    .roadmap {
      display: grid;
      gap: 12px;
    }
    .roadmap-step {
      display: grid;
      grid-template-columns: 90px minmax(0, 1fr);
      gap: 16px;
      padding: 18px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.09);
    }
    .roadmap-step:first-child { border-top: 0; }
    .roadmap-period { color: var(--green); font-size: 18px; font-weight: 850; }
    .roadmap-body { display: grid; gap: 8px; }
    .roadmap-body strong { color: var(--text); }
    .roadmap-body p { margin: 0; color: #c9dce7; line-height: 1.6; }
    .plan-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .plan-block {
      border: 1px solid rgba(255, 224, 138, 0.18);
      border-radius: 8px;
      padding: 14px;
      background: rgba(255, 224, 138, 0.045);
    }
    .plan-block h3 {
      margin: 0 0 10px;
      font-size: 14px;
      color: var(--gold);
    }
    .timeline {
      display: grid;
      gap: 10px;
    }
    .timeline-item {
      display: grid;
      grid-template-columns: 86px 1fr;
      gap: 12px;
      align-items: start;
      padding: 13px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .timeline-item:first-child { border-top: 0; }
    .timeline-item strong { color: var(--green); }
    .timeline-item span { color: #d8e8f1; line-height: 1.55; }
    .lock-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .lock {
      padding: 10px 12px;
      border: 1px dashed rgba(138, 162, 180, 0.34);
      border-radius: 8px;
      color: #9fb0bd;
      background: rgba(255, 255, 255, 0.025);
    }
    .upgrade-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .upgrade {
      display: grid;
      gap: 10px;
      padding: 16px;
      border: 1px solid rgba(67, 231, 255, 0.18);
      border-radius: 8px;
      background: rgba(67, 231, 255, 0.045);
    }
    .upgrade strong {
      color: var(--cyan);
      font-size: 18px;
    }
    .upgrade p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }
    .footer {
      margin-top: 18px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
      text-align: center;
    }
    body.report-quick { --tier: var(--cyan); }
    body.report-standard { --tier: var(--green); }
    body.report-full { --tier: var(--gold); }
    html { scroll-behavior: smooth; }
    body {
      background:
        linear-gradient(rgba(67, 231, 255, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(67, 231, 255, 0.035) 1px, transparent 1px),
        #05080c;
      background-size: 40px 40px;
    }
    button, a { -webkit-tap-highlight-color: transparent; }
    button:focus-visible, a:focus-visible {
      outline: 2px solid var(--tier);
      outline-offset: 3px;
    }
    .page { width: min(1160px, calc(100vw - 36px)); padding-top: 20px; }
    .hero {
      min-height: 0;
      padding: 0;
      background:
        radial-gradient(circle at 82% 22%, rgba(67, 231, 255, 0.11), transparent 30%),
        linear-gradient(140deg, rgba(9, 17, 24, 0.98), rgba(4, 8, 12, 0.98));
      border-color: color-mix(in srgb, var(--tier) 34%, transparent);
    }
    .hero:before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(90deg, color-mix(in srgb, var(--tier) 8%, transparent), transparent 46%);
    }
    .hero-shell {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.55fr);
      gap: 48px;
      align-items: stretch;
      padding: 42px;
    }
    .hero-copy { min-width: 0; }
    .tier-row { margin-top: 38px; }
    .pill {
      border-color: color-mix(in srgb, var(--tier) 36%, transparent);
      color: var(--tier);
      background: color-mix(in srgb, var(--tier) 8%, transparent);
    }
    .hero-label {
      margin: 42px 0 0;
      color: var(--tier);
      font-size: 13px;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      max-width: 700px;
      margin-top: 12px;
      font-size: 64px;
      line-height: 1.05;
    }
    .lead { max-width: 720px; font-size: 20px; }
    .hero-bottom { margin-top: 30px; }
    .metric {
      min-width: 136px;
      border-color: rgba(255, 255, 255, 0.09);
      background: rgba(0, 0, 0, 0.24);
    }
    .metric strong { font-size: 18px; }
    .persona-seal {
      position: relative;
      display: flex;
      min-width: 0;
      flex-direction: column;
      justify-content: flex-end;
      align-items: flex-start;
      padding: 30px;
      overflow: hidden;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.045));
    }
    .persona-seal img {
      position: absolute;
      width: 330px;
      height: 330px;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      object-fit: contain;
      opacity: 0.42;
      filter: saturate(0.9);
    }
    .persona-seal span, .persona-seal strong, .persona-seal small { position: relative; z-index: 1; }
    .persona-seal span {
      color: var(--tier);
      font-size: 11px;
      font-weight: 850;
      letter-spacing: 0.12em;
    }
    .persona-seal strong {
      max-width: 100%;
      margin-top: 10px;
      color: var(--text);
      font-size: 24px;
      line-height: 1.18;
      overflow-wrap: anywhere;
    }
    .persona-seal small { margin-top: 12px; color: var(--muted); line-height: 1.5; }
    .report-nav {
      position: sticky;
      top: 10px;
      z-index: 20;
      display: flex;
      gap: 4px;
      margin-top: 14px;
      padding: 7px;
      overflow-x: auto;
      border: 1px solid rgba(128, 231, 255, 0.15);
      border-radius: 8px;
      background: rgba(5, 10, 15, 0.93);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.26);
      backdrop-filter: blur(14px);
      scrollbar-width: none;
    }
    .report-nav::-webkit-scrollbar { display: none; }
    .report-nav a {
      display: inline-flex;
      flex: 1 0 auto;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 6px;
      color: #c6d9e4;
      text-decoration: none;
      font-size: 13px;
      font-weight: 750;
    }
    .report-nav a:hover { color: var(--text); background: rgba(255, 255, 255, 0.055); }
    .report-nav a span { color: var(--tier); font-size: 10px; letter-spacing: 0.05em; }
    .section {
      scroll-margin-top: 76px;
      margin-top: 0;
      padding: 38px 0;
      border: 0;
      border-top: 1px solid rgba(128, 231, 255, 0.14);
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .section h2 {
      margin-bottom: 22px;
      font-size: 22px;
      line-height: 1.35;
    }
    .section h2:before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 18px;
      margin-right: 10px;
      vertical-align: -2px;
      border-radius: 2px;
      background: var(--tier);
    }
    .grid {
      gap: 14px;
      margin-top: 0;
      padding: 38px 0;
      border-top: 1px solid rgba(128, 231, 255, 0.14);
    }
    .grid .section {
      padding: 24px;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.025);
    }
    .grid .section:first-child { border-color: rgba(124, 255, 178, 0.2); }
    .grid .section:last-child { border-color: rgba(255, 139, 139, 0.22); }
    .share-card {
      margin: 16px 0 38px;
      padding: 26px;
      border: 1px solid color-mix(in srgb, var(--tier) 24%, transparent);
      border-radius: 8px;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--tier) 9%, transparent), transparent 58%),
        rgba(11, 18, 26, 0.88);
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
    }
    .share-text { max-width: 900px; font-size: 25px; }
    .share-copy {
      max-width: 940px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.18);
      color: #b9ccd8;
    }
    .share-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 14px; }
    .share-actions button {
      min-height: 38px;
      padding: 9px 13px;
      border: 1px solid color-mix(in srgb, var(--tier) 32%, transparent);
      border-radius: 6px;
      color: var(--text);
      background: color-mix(in srgb, var(--tier) 8%, rgba(0, 0, 0, 0.3));
      font: inherit;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }
    .share-actions button:hover { background: color-mix(in srgb, var(--tier) 14%, rgba(0, 0, 0, 0.3)); }
    .copy-status { min-height: 20px; color: var(--green); font-size: 13px; }
    .narrative { grid-template-columns: minmax(0, 1.7fr) minmax(240px, 0.7fr); align-items: start; }
    .narrative .opening { grid-column: 1 / -1; max-width: 940px; font-size: 27px; }
    .narrative .note {
      grid-column: 2;
      grid-row: 2 / span 3;
      border: 1px solid color-mix(in srgb, var(--tier) 24%, transparent);
      border-left-width: 4px;
      border-radius: 0 7px 7px 0;
      background: color-mix(in srgb, var(--tier) 6%, transparent);
    }
    .axis-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .axis { padding: 17px; background: rgba(255, 255, 255, 0.025); }
    .axis-head span:last-child { color: var(--tier); font-size: 22px; }
    .bar { height: 7px; }
    .bar i { background: linear-gradient(90deg, var(--cyan), var(--tier)); }
    .axis small { font-size: 13px; }
    .insight-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .insight-row {
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.085);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.024);
    }
    .insight-row:first-child { border-top: 1px solid rgba(255, 255, 255, 0.085); }
    .insight-head span:last-child {
      padding: 4px 8px;
      border-radius: 999px;
      color: var(--tier);
      background: color-mix(in srgb, var(--tier) 8%, transparent);
      font-size: 12px;
    }
    .priority-list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .priority-row {
      position: relative;
      min-height: 220px;
      padding: 22px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 8px;
      background: linear-gradient(145deg, color-mix(in srgb, var(--tier) 6%, transparent), rgba(255, 255, 255, 0.018));
    }
    .priority-row:first-child { border-top: 1px solid rgba(255, 255, 255, 0.09); }
    .priority-head { color: var(--text); font-size: 18px; }
    .priority-row .practice { margin-top: auto; }
    .scenario-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .scenario-row {
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.024);
    }
    .scenario-row:first-child { border-top: 1px solid rgba(255, 255, 255, 0.09); }
    .scenario-row > strong { font-size: 17px; }
    .roadmap { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .roadmap-step {
      grid-template-columns: 1fr;
      align-content: start;
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-top: 3px solid var(--tier);
      border-radius: 0 0 8px 8px;
      background: rgba(255, 255, 255, 0.024);
    }
    .roadmap-step:first-child { border-top: 3px solid var(--tier); }
    .roadmap-period { font-size: 25px; color: var(--tier); }
    .plan-block { background: rgba(255, 224, 138, 0.028); }
    .lock-list { gap: 8px; }
    .lock { border-style: solid; background: rgba(255, 255, 255, 0.025); }
    .upgrade { background: rgba(67, 231, 255, 0.025); }
    @media print {
      body { background: #fff; color: #111; }
      .page { width: 100%; }
      .report-nav, .share-actions, .footer:last-child { display: none; }
      .hero, .share-card, .grid .section, .axis, .insight-row, .priority-row, .scenario-row, .roadmap-step, .plan-block {
        box-shadow: none;
        break-inside: avoid;
      }
    }
    @media (max-width: 820px) {
      .page { width: min(100% - 20px, 600px); padding-top: 10px; }
      .hero {
        min-height: 0;
        background: linear-gradient(180deg, rgba(9, 18, 28, 0.98), rgba(5, 9, 14, 0.98));
      }
      .hero-shell { grid-template-columns: 1fr; gap: 24px; padding: 22px; }
      .hero-copy { display: contents; }
      .brand { order: 1; }
      .persona-seal {
        order: 2;
        min-height: 205px;
        padding: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
      }
      .persona-seal img { width: 230px; height: 230px; top: -42px; left: auto; right: -18px; transform: none; }
      .persona-seal strong { max-width: 62%; font-size: 21px; }
      .tier-row { order: 3; margin-top: 0; }
      .hero-label { order: 4; margin-top: 4px; }
      h1 { order: 5; margin-top: -12px; font-size: 40px; line-height: 1.08; }
      .lead { order: 6; margin-top: -10px; font-size: 17px; }
      .hero-bottom { order: 7; margin-top: -4px; }
      .hero-bottom {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .metric { min-width: 0; }
      .metric:last-child { grid-column: 1 / -1; }
      .report-nav { top: 6px; margin-top: 10px; }
      .section { padding: 30px 0; }
      .section h2 { font-size: 20px; }
      .grid { padding: 30px 0; }
      .share-card { margin: 10px 0 30px; padding: 20px; }
      .share-text { font-size: 20px; }
      .narrative { grid-template-columns: 1fr; }
      .narrative .opening, .narrative .note { grid-column: auto; grid-row: auto; }
      .narrative .opening { font-size: 22px; }
      .grid, .axis-grid, .plan-grid, .upgrade-grid, .insight-list, .priority-list, .scenario-list, .roadmap { grid-template-columns: 1fr; }
      .priority-row { min-height: 0; }
      .timeline-item, .roadmap-step { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  </style>
</head>
<body class="report-${mode}">
  <main class="page">
    <section class="hero">
      <div class="hero-shell">
        <div class="hero-copy">
          <div class="brand"><img src="/assets/degendna-logo.png" alt="DegenDNA logo"><span>DegenDNA Trading Persona</span></div>
          <div class="tier-row">
            <span class="pill">${escapeHtml(modeConfig.reportName)}</span>
            <span class="pill">${escapeHtml(paymentPriceForMode(mode))}</span>
            ${options.demo ? `<span class="pill">${isEn ? "Demo report" : "演示报告"}</span>` : ""}
          </div>
          <p class="hero-label">${isEn ? "My onchain trading persona" : "我的链上交易人格"}</p>
          <h1>${escapeHtml(result.title || result.shareTitle || "DegenDNA")}</h1>
          <p class="lead">${escapeHtml(result.oneLineSummary || result.summary || modeConfig.promise)}</p>
          <div class="hero-bottom">
            ${renderMetric(isEn ? "Confidence" : "置信度", result.confidence?.label || "-")}
            ${renderMetric(isEn ? "Preference" : "偏好强度", result.intensity?.label || "-")}
            ${renderMetric(isEn ? "Questions" : "作答深度", `${modeConfig.questionCount}`)}
          </div>
        </div>
        <aside class="persona-seal" aria-label="${isEn ? "Persona certificate" : "人格证书"}">
          <img src="/assets/degendna-logo.png" alt="">
          <span>${isEn ? "PERSONA CODE" : "原创人格码"}</span>
          <strong>${escapeHtml(result.code || payload.code || "-")}</strong>
          <small>${isEn ? "Behavior, not destiny" : "看见偏好，不给自己贴死标签"}</small>
        </aside>
      </div>
    </section>

    <nav class="report-nav" aria-label="${isEn ? "Report sections" : "报告章节"}">
      ${navItems.map(([href, label], index) => `<a href="#${href}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(label)}</a>`).join("")}
    </nav>

    ${renderNarrativeSection(result.narrative, isEn)}

    <section class="section share-card" id="share">
      <h2>${isEn ? "Share card" : "可分享名片"}</h2>
      <p class="share-text">${escapeHtml(result.shareCardText || result.oneLineSummary || "")}</p>
      <div class="share-copy" data-share-copy>${escapeHtml(result.twitterCopy || "")}</div>
      <div class="share-actions">
        <button type="button" data-copy-share>${isEn ? "Copy share text" : "复制分享文案"}</button>
        <button type="button" data-print-report>${isEn ? "Print report" : "打印 / 保存报告"}</button>
        <span class="copy-status" data-copy-status aria-live="polite"></span>
      </div>
    </section>

    <div class="grid">
      <section class="section">
        <h2>${isEn ? "Edges" : "核心优势"}</h2>
        ${renderList(result.strengths || [], "good")}
      </section>
      <section class="section">
        <h2>${isEn ? "Blind spots" : "亏损盲区"}</h2>
        ${renderList(result.risks || [], "risk")}
      </section>
    </div>

    <section class="section" id="axes">
      <h2>${isEn ? "Behavior axes" : mode === "quick" ? "主导维度" : "六维画像"}</h2>
      ${renderAxes(dimensions)}
    </section>

    ${renderDimensionInsightsSection(result.dimensionInsights || [], isEn)}
    ${renderPrioritySection(result.priorityActions || (result.immediateAction ? [result.immediateAction] : []), isEn, mode)}
    ${renderAdviceSection(result, plan, isEn)}
    ${result.trainingRoadmap?.length ? renderTrainingRoadmapSection(result.trainingRoadmap, isEn) : renderTrainingSection(plan, isEn)}
    ${renderScenarioSection(result.scenarioGuidance || [], isEn)}
    ${renderUnlockedSection(unlocked, isEn)}
    ${renderLockedSection(locked, isEn)}
    ${renderUpgradeSection(result.upgradeOptions || [], isEn)}
    ${renderClosingSection(result.closingNote, isEn)}

    <p class="footer">${escapeHtml(payload.disclaimer || "")}</p>
    <p class="footer">${isEn ? "Preview URL" : "预览地址"}: ${escapeHtml(reportUrl)}</p>
  </main>
  <script>
    const copyButton = document.querySelector("[data-copy-share]");
    const copySource = document.querySelector("[data-share-copy]");
    const copyStatus = document.querySelector("[data-copy-status]");
    copyButton?.addEventListener("click", async () => {
      const text = copySource?.textContent?.trim() || "";
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
        await navigator.clipboard.writeText(text);
        copyStatus.textContent = ${JSON.stringify(isEn ? "Copied" : "已复制")};
      } catch {
        const fallback = document.createElement("textarea");
        fallback.value = text;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        const copied = document.execCommand("copy");
        fallback.remove();
        if (copied) {
          copyStatus.textContent = ${JSON.stringify(isEn ? "Copied" : "已复制")};
        } else {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(copySource);
          selection.removeAllRanges();
          selection.addRange(range);
          copyStatus.textContent = ${JSON.stringify(isEn ? "Text selected. Press Ctrl+C to copy." : "文案已选中，请按 Ctrl+C 复制")};
        }
      }
    });
    document.querySelector("[data-print-report]")?.addEventListener("click", () => window.print());
  </script>
</body>
</html>`;
}

function renderMetric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderList(items, className = "") {
  const list = (items || []).filter(Boolean);
  if (!list.length) return `<p class="share-copy">-</p>`;
  return `<ul class="list ${className}">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderAxes(dimensions) {
  const list = (dimensions || []).filter(Boolean);
  if (!list.length) return `<p class="share-copy">No axis data.</p>`;
  return `<div class="axis-grid">${list.map((dimension) => {
    const strength = Math.max(0, Math.min(100, Number(dimension.strength || 0)));
    return `<div class="axis">
      <div class="axis-head"><span>${escapeHtml(dimension.name || dimension.key || "Axis")}</span><span>${strength}</span></div>
      <div class="bar"><i style="--value:${strength}%"></i></div>
      <small>${escapeHtml(dimension.direction || dimension.tag || "")}</small>
    </div>`;
  }).join("")}</div>`;
}

function renderNarrativeSection(narrative, isEn) {
  if (!narrative) return "";
  return `<section class="section" id="overview">
    <h2>${isEn ? "Your first read" : "先读懂自己，再谈改变"}</h2>
    <div class="narrative">
      ${narrative.opening ? `<p class="opening">${escapeHtml(narrative.opening)}</p>` : ""}
      ${narrative.corePattern ? `<p>${escapeHtml(narrative.corePattern)}</p>` : ""}
      ${narrative.primarySignal ? `<p>${escapeHtml(narrative.primarySignal)}</p>` : ""}
      ${narrative.confidenceNote ? `<div class="note">${escapeHtml(narrative.confidenceNote)}</div>` : ""}
      ${narrative.reassurance ? `<p>${escapeHtml(narrative.reassurance)}</p>` : ""}
    </div>
  </section>`;
}

function renderDimensionInsightsSection(insights, isEn) {
  if (!insights?.length) return "";
  return `<section class="section">
    <h2>${isEn ? "What each axis means for you" : "六维不是分数，是你会重复的动作"}</h2>
    <div class="insight-list">${insights.map((insight) => `<div class="insight-row">
      <div class="insight-head"><span>${escapeHtml(insight.name)} · ${escapeHtml(insight.direction)}</span><span>${escapeHtml(insight.strengthLabel)} ${escapeHtml(insight.strength)}</span></div>
      <p>${escapeHtml(insight.observation)}</p>
      <p><strong>${isEn ? "Watch:" : "需要留意："}</strong> ${escapeHtml(insight.watchout)}</p>
      <p class="practice"><strong>${isEn ? "Practice:" : "建议练习："}</strong> ${escapeHtml(insight.practice)}</p>
    </div>`).join("")}</div>
  </section>`;
}

function renderPrioritySection(actions, isEn, mode) {
  if (!actions?.length) return "";
  return `<section class="section" id="actions">
    <h2>${isEn ? "Your next priorities" : mode === "quick" ? "今天先做这一件事" : "你的行动优先级"}</h2>
    <div class="priority-list">${actions.map((item) => `<div class="priority-row">
      <div class="priority-head"><span>${escapeHtml(item.priority)}. ${escapeHtml(item.title)}</span></div>
      <p>${escapeHtml(item.why)}</p>
      <p class="practice"><strong>${isEn ? "Action:" : "具体动作："}</strong> ${escapeHtml(item.action)}</p>
    </div>`).join("")}</div>
  </section>`;
}

function renderScenarioSection(items, isEn) {
  if (!items?.length) return "";
  return `<section class="section" id="scenarios">
    <h2>${isEn ? "When the market gets loud" : "当真实行情发生时，你可以这样做"}</h2>
    <div class="scenario-list">${items.map((item) => `<div class="scenario-row">
      <strong>${escapeHtml(item.scenario)}</strong>
      <p>${escapeHtml(item.likelyResponse)}</p>
      <p class="practice"><strong>${isEn ? "Better move:" : "更好的动作："}</strong> ${escapeHtml(item.betterMove)}</p>
    </div>`).join("")}</div>
  </section>`;
}

function renderTrainingRoadmapSection(items, isEn) {
  if (!items?.length) return "";
  return `<section class="section" id="training">
    <h2>${isEn ? "Measurable training roadmap" : "不是喊口号，而是能完成的 7/14/30 天路线"}</h2>
    <div class="roadmap">${items.map((item) => `<div class="roadmap-step">
      <div class="roadmap-period">${escapeHtml(item.period)}</div>
      <div class="roadmap-body">
        <strong>${escapeHtml(item.goal)}</strong>
        <p>${escapeHtml(item.action)}</p>
        <p class="practice"><strong>${isEn ? "Done when:" : "完成标准："}</strong> ${escapeHtml(item.successMetric)}</p>
      </div>
    </div>`).join("")}</div>
  </section>`;
}

function renderClosingSection(note, isEn) {
  if (!note) return "";
  return `<section class="section share-card">
    <h2>${isEn ? "A final note" : "最后，留给你一句话"}</h2>
    <p class="share-text">${escapeHtml(note)}</p>
  </section>`;
}

function renderAdviceSection(result, plan, isEn) {
  const quickAdvice = result.quickAdvice || [];
  const blocks = [
    { title: isEn ? "Entry" : "入场前", items: plan.entryChecklist || quickAdvice },
    { title: isEn ? "Position" : "仓位规则", items: plan.positionRules || [] },
    { title: isEn ? "Exit" : "退出纪律", items: plan.exitRules || [] }
  ].filter((block) => block.items?.length);
  if (!blocks.length) return "";
  return `<section class="section" id="playbook">
    <h2>${isEn ? "Trading playbook" : "交易行动卡"}</h2>
    ${plan.headline ? `<p class="share-copy">${escapeHtml(plan.headline)}</p>` : ""}
    <div class="plan-grid">${blocks.map((block) => `<div class="plan-block"><h3>${escapeHtml(block.title)}</h3>${renderList(block.items)}</div>`).join("")}</div>
  </section>`;
}

function renderTrainingSection(plan, isEn) {
  const items = plan.trainingPlan || [];
  if (!items.length) return "";
  return `<section class="section" id="training">
    <h2>${isEn ? "Training rhythm" : "训练节奏"}</h2>
    <div class="timeline">${items.map((item, index) => {
      const label = index === 0 ? "7D" : index === 1 ? "14D" : "30D";
      return `<div class="timeline-item"><strong>${label}</strong><span>${escapeHtml(item)}</span></div>`;
    }).join("")}</div>
  </section>`;
}

function renderUnlockedSection(items, isEn) {
  if (!items?.length) return "";
  return `<section class="section">
    <h2>${isEn ? "Unlocked in this tier" : "本档已解锁"}</h2>
    <div class="lock-list">${items.map((item) => `<span class="lock">${escapeHtml(item)}</span>`).join("")}</div>
  </section>`;
}

function renderLockedSection(items, isEn) {
  if (!items?.length) return "";
  return `<section class="section">
    <h2>${isEn ? "Upgrade unlocks" : "升级可解锁"}</h2>
    <div class="lock-list">${items.map((item) => `<span class="lock">${escapeHtml(item)}</span>`).join("")}</div>
  </section>`;
}

function renderUpgradeSection(options, isEn) {
  if (!options?.length) return "";
  return `<section class="section">
    <h2>${isEn ? "Next report options" : "继续升级"}</h2>
    <div class="upgrade-grid">${options.map((option) => `<div class="upgrade">
      <strong>${escapeHtml(option.reportName)} · ${escapeHtml(option.price)}</strong>
      <p>${escapeHtml(option.promise)}</p>
      <p>${escapeHtml(option.endpoint)}</p>
    </div>`).join("")}</div>
  </section>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const requested = paymentRuntime.requested;
  const configured = paymentRuntime.configured;
  return {
    enabled: configured,
    requested,
    required: paymentRuntime.required,
    ready: configured && paymentRuntime.initialized,
    status: configured && paymentRuntime.initialized ? "ready" : (paymentRuntime.error || "initializing"),
    network: process.env.X402_NETWORK || "eip155:196",
    prices: Object.fromEntries(Object.keys(ASSESSMENT_MODES).map((mode) => [mode, paymentPriceForMode(mode)])),
    price: paymentPriceForMode("full"),
    protectedMethods: protectedScoreMethods,
    protectedRoutes: protectedScoreRoutes,
    protectedRoute: paidRoute,
    resourceBaseUrl: resolvePublicBaseUrl(req),
    syncFacilitatorOnStart: paymentRuntime.required || isTruthy(process.env.X402_SYNC_ON_START)
  };
}
