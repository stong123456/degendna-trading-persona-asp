import "dotenv/config";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
const currentDir = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(currentDir, "..", "assets");
const paidRoute = "/api/asp/trading-persona/score";
const previewRoute = "/api/asp/trading-persona/preview";
const scoreRoutes = {
  quick: `${paidRoute}/quick`,
  standard: `${paidRoute}/standard`,
  full: `${paidRoute}/full`
};
const protectedScoreMethods = ["GET", "POST"];
const protectedScoreRoutes = [paidRoute, ...Object.values(scoreRoutes)];
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
app.use(express.json({ limit: "96kb" }));
app.use("/assets", express.static(assetsDir, { maxAge: "1h" }));

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
  res.json({
    ok: true,
    service: serviceName,
    version: serviceVersion,
    questionCount: DEGEN_PERSONA_QUESTIONS.length,
    payment: paymentStatus(req)
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
              name: "start_trading_persona_assessment",
              description: "Start a DegenDNA trading-persona assessment and return the right question set for quick, standard, or full mode.",
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
              description: "Return the DegenDNA trading-persona questionnaire and answer scale for quick, standard, or full mode.",
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
              description: "Accept a completed answer set and return calibration signals only. Use the paid HTTP score endpoints to unlock persona codes and reports.",
              inputSchema: {
                type: "object",
                required: ["answers"],
                properties: {
                  lang: { type: "string", enum: ["zh", "en"], default: "zh" },
                  mode: { type: "string", enum: ["quick", "standard", "full"], default: "quick" },
                  answers: {
                    oneOf: [
                      { type: "array", items: { type: "number", minimum: -2, maximum: 2 } },
                      { type: "object", additionalProperties: { type: "number", minimum: -2, maximum: 2 } }
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
    answerScale: [
      { value: -2, label: lang === "en" ? "Strongly prefer left" : "强烈偏左" },
      { value: -1.2, label: lang === "en" ? "Prefer left" : "偏左" },
      { value: -0.35, label: lang === "en" ? "Slightly prefer left" : "轻微偏左" },
      { value: 0.35, label: lang === "en" ? "Slightly prefer right" : "轻微偏右" },
      { value: 1.2, label: lang === "en" ? "Prefer right" : "偏右" },
      { value: 2, label: lang === "en" ? "Strongly prefer right" : "强烈偏右" }
    ],
    answerSubmission: {
      recommended: lang === "en"
        ? "Send answers as an object keyed by each question id, for example {\"degenPersona:0\": 1.2}."
        : "建议用题目 id 作为答案对象的 key，例如 {\"degenPersona:0\": 1.2}。",
      arraySupport: lang === "en"
        ? "Array answers are interpreted in the same order as the questions returned for this mode."
        : "如果传数组，服务会按当前模式返回题目的顺序自动映射。"
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
      right: question.right
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
  if (persona.answeredCount < 12) {
    throw new Error("At least 12 valid answers are required for a stable profile.");
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
      answers: "array | object keyed by degenPersona:<index>"
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
    enoughForPaidReport: persona.answeredCount >= 12,
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
      right: question.right
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
      ? ["Persona code", "two strengths", "two blind spots", "one immediate rule", "share copy"]
      : ["交易人格码", "2 个优势", "2 个盲区", "1 条立刻可执行规则", "X 分享文案"],
    standard: isEn
      ? ["Persona code", "six-dimension profile", "strengths and blind spots", "execution protocol", "light review checklist", "share copy"]
      : ["交易人格码", "六维画像", "优势与盲区", "执行协议", "轻量复盘清单", "X 分享文案"],
    full: isEn
      ? ["Complete 72-question profile", "six-dimension scores", "full trading plan", "entry/position/exit rules", "7/14/30-day training plan", "share copy"]
      : ["完整 72 题画像", "六维分数", "完整交易计划", "入场/仓位/退出规则", "7/14/30 天训练计划", "X 分享文案"]
  };
  return unlocks[normalizeMode(mode)] || unlocks.quick;
}

function reportForLevel(fullResult, persona, level, lang = "zh") {
  const reportLevel = normalizeMode(level, "full");
  const share = shareAssets(fullResult, persona, lang);
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
    reportPage: reportPageShape("full", lang)
  };
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
    components: ["heroBadge", "shareCard", "axisMeters", "actionChecklist", "lockedUpgradeRail"]
  };
  const shapes = {
    quick: {
      layout: "quick-card",
      visualDesign,
      unlockedSections: isEn
        ? ["persona badge", "top strengths", "top blind spots", "one action rule", "share copy"]
        : ["人格徽章", "核心优势", "主要盲区", "一条行动规则", "分享文案"],
      lockedSections: isEn
        ? ["six-dimension chart", "full review checklist", "7/14/30-day training plan"]
        : ["六维雷达", "完整复盘清单", "7/14/30 天训练计划"]
    },
    standard: {
      layout: "standard-report",
      visualDesign,
      unlockedSections: isEn
        ? ["persona badge", "six-dimension profile", "protocol", "light trading plan", "share copy"]
        : ["人格徽章", "六维画像", "执行协议", "轻量交易计划", "分享文案"],
      lockedSections: isEn
        ? ["full 72-question confidence", "complete entry/position/exit rules", "30-day training plan"]
        : ["完整 72 题置信度", "完整入场/仓位/退出规则", "30 天训练计划"]
    },
    full: {
      layout: "full-playbook",
      visualDesign: {
        ...visualDesign,
        components: ["heroBadge", "shareCard", "sixAxisMeters", "fullPlaybook", "trainingTimeline", "reviewChecklist"]
      },
      unlockedSections: isEn
        ? ["complete report", "six-dimension scores", "full trading plan", "training plan", "share copy"]
        : ["完整报告", "六维分数", "完整交易计划", "训练计划", "分享文案"],
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
    ? `Your edge is ${strength}; the first thing to train is ${risk}.`
    : `你的优势是${strength}，最该训练的是${risk}。`;
  return {
    shareTitle: lang === "en"
      ? `I am ${persona.profileCode} ${title}`
      : `我是 ${persona.profileCode} ${title}`,
    oneLineSummary,
    shareCardText: lang === "en"
      ? `My DegenDNA: ${persona.profileCode} | ${title} | Edge: ${strength} | Blind spot: ${risk}`
      : `我的 DegenDNA：${persona.profileCode}｜${title}｜优势：${strength}｜盲区：${risk}`,
    twitterCopy: lang === "en"
      ? `I just checked my on-chain trading persona: ${persona.profileCode} ${title}. ${oneLineSummary} This is a behavior review, not financial advice. #OKXAI`
      : `刚测了一下我的链上交易人格，结果是 ${persona.profileCode} ${title}。${oneLineSummary} 这不是买卖建议，是一次交易行为复盘。#OKXAI`
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
        ?? source[String(questionIndex)]
        ?? source[`degenPersona:${modeIndex}`]
        ?? source[modeIndex]
        ?? source[String(modeIndex)];
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
  const pattern = [1.2, 0.35, -1.2, 2, -0.35, 1.2, -2, 0.35, 1.2, -0.35, 2, -1.2];
  const answers = {};
  questionIndexesForMode(mode).forEach((questionIndex, offset) => {
    answers[`degenPersona:${questionIndex}`] = pattern[offset % pattern.length];
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
    @media (max-width: 820px) {
      .page { width: min(100% - 20px, 560px); padding-top: 10px; }
      .hero {
        min-height: 520px;
        background:
          linear-gradient(180deg, rgba(9, 18, 28, 0.88), rgba(9, 13, 20, 0.98)),
          url("/assets/degendna-logo.png") center -70px / 360px auto no-repeat;
        padding-top: 240px;
      }
      .tier-row { margin-top: 0; }
      .hero-bottom {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .metric { min-width: 0; }
      .metric:last-child { grid-column: 1 / -1; }
      .grid, .axis-grid, .plan-grid, .upgrade-grid { grid-template-columns: 1fr; }
      .timeline-item { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="brand"><img src="/assets/degendna-logo.png" alt="DegenDNA logo"><span>DegenDNA Trading Persona</span></div>
      <div class="tier-row">
        <span class="pill">${escapeHtml(modeConfig.reportName)}</span>
        <span class="pill">${escapeHtml(paymentPriceForMode(mode))}</span>
        ${options.demo ? `<span class="pill">${isEn ? "Demo report" : "演示报告"}</span>` : ""}
      </div>
      <h1>${escapeHtml(result.shareTitle || result.title || "DegenDNA")}</h1>
      <p class="lead">${escapeHtml(result.oneLineSummary || result.summary || modeConfig.promise)}</p>
      <div class="hero-bottom">
        ${renderMetric(isEn ? "Profile code" : "人格码", result.code || payload.code || "-")}
        ${renderMetric(isEn ? "Confidence" : "置信度", result.confidence?.label || "-")}
        ${renderMetric(isEn ? "Intensity" : "偏好强度", result.intensity?.label || "-")}
      </div>
    </section>

    <section class="section share-card">
      <h2>${isEn ? "Share card" : "可分享名片"}</h2>
      <p class="share-text">${escapeHtml(result.shareCardText || result.oneLineSummary || "")}</p>
      <div class="share-copy">${escapeHtml(result.twitterCopy || "")}</div>
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

    <section class="section">
      <h2>${isEn ? "Behavior axes" : mode === "quick" ? "主导维度" : "六维画像"}</h2>
      ${renderAxes(dimensions)}
    </section>

    ${renderAdviceSection(result, plan, isEn)}
    ${renderTrainingSection(plan, isEn)}
    ${renderUnlockedSection(unlocked, isEn)}
    ${renderLockedSection(locked, isEn)}
    ${renderUpgradeSection(result.upgradeOptions || [], isEn)}

    <p class="footer">${escapeHtml(payload.disclaimer || "")}</p>
    <p class="footer">${isEn ? "Preview URL" : "预览地址"}: ${escapeHtml(reportUrl)}</p>
  </main>
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

function renderAdviceSection(result, plan, isEn) {
  const quickAdvice = result.quickAdvice || [];
  const blocks = [
    { title: isEn ? "Entry" : "入场前", items: plan.entryChecklist || quickAdvice },
    { title: isEn ? "Position" : "仓位规则", items: plan.positionRules || [] },
    { title: isEn ? "Exit" : "退出纪律", items: plan.exitRules || [] }
  ].filter((block) => block.items?.length);
  if (!blocks.length) return "";
  return `<section class="section">
    <h2>${isEn ? "Trading playbook" : "交易行动卡"}</h2>
    ${plan.headline ? `<p class="share-copy">${escapeHtml(plan.headline)}</p>` : ""}
    <div class="plan-grid">${blocks.map((block) => `<div class="plan-block"><h3>${escapeHtml(block.title)}</h3>${renderList(block.items)}</div>`).join("")}</div>
  </section>`;
}

function renderTrainingSection(plan, isEn) {
  const items = plan.trainingPlan || [];
  if (!items.length) return "";
  return `<section class="section">
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
    prices: Object.fromEntries(Object.keys(ASSESSMENT_MODES).map((mode) => [mode, paymentPriceForMode(mode)])),
    price: paymentPriceForMode("full"),
    protectedMethods: protectedScoreMethods,
    protectedRoutes: protectedScoreRoutes,
    protectedRoute: paidRoute,
    resourceBaseUrl: resolvePublicBaseUrl(req),
    syncFacilitatorOnStart: isTruthy(process.env.X402_SYNC_ON_START)
  };
}
