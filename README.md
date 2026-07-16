# DegenDNA Trading Persona ASP

DegenDNA 是给链上交易者用的自我风控镜子。它不告诉用户买什么，只帮助用户看清自己为什么容易在同一个地方亏钱。

This is an independent A2MCP-ready ASP service for the DegenDNA trading-persona self-check. The model is original DegenDNA.fun content: 72 self-developed questions across six trading-behavior dimensions. It does not use MBTI, Myers-Briggs Type Indicator, or third-party licensed personality inventory content.

## OKX.AI Listing Copy

Agent name:

```text
DegenDNA 交易人格诊断
```

Agent description:

```text
DegenDNA 是面向链上交易者的原创行为复盘服务，用 12/24/72 题识别 FOMO、追高、扛单、仓位失控与过度谨慎等偏好，生成可分享的人格码、六维解释、情境应对和可执行训练计划。
```

Suggested service tiers:

| Service name | Endpoint | Fee |
| --- | --- | --- |
| 测出我的链上交易人格·极速版 | `/api/asp/trading-persona/score/quick` | 0.10 USDT |
| 测出我的链上交易人格·标准版 | `/api/asp/trading-persona/score/standard` | 1.99 USDT |
| 测出我的链上交易人格·完整版 | `/api/asp/trading-persona/score/full` | 3.99 USDT |

Service description:

```text
DegenDNA 会根据你的交易习惯生成交易人格码、六维偏好、主要优势、常见亏损盲区和复盘清单。它不预测行情，也不提供买卖建议，只帮助用户看清自己在市场里最容易重复犯的动作。
```

## Product Tiers

| Tier | Questions | Delivery |
| --- | ---: | --- |
| Quick | 12 | Persona code, warm first read, two strengths, two blind spots, one immediate rule, X share copy, visual quick-card report. |
| Standard | 24 | Six-dimension explanations, strengths and risks, three action priorities, light trading plan, review questions, share copy. |
| Full | 72 | Complete profile, six-dimension explanations, four scenario playbooks, full trading plan, measurable 7/14/30-day roadmap, share copy. |

Free routes only return the questionnaire, catalog, or calibration signals. Paid reports are returned only from the `/score/*` endpoints protected by OKX x402 payment challenges.

All three tiers use dimension-mean normalization against the complete 72-question scale. For the same underlying answers, the primary type, axis code, subtype, and intensity remain comparable across tiers; additional questions increase confidence and unlock report depth instead of mechanically inflating the score.

Each paid route requires all questions for its tier. Arrays follow the questionnaire's returned order; object payloads use the canonical `degenPersona:<questionIndex>` ids returned by the questionnaire.

## API

- `GET /health`
- `GET /api/asp/trading-persona?mode=quick|standard|full`
- `POST /api/asp/trading-persona/preview`
- `POST /api/asp/trading-persona`
- `POST /api/asp/trading-persona/score/quick`
- `POST /api/asp/trading-persona/score/standard`
- `POST /api/asp/trading-persona/score/full`
- `POST /api/asp/trading-persona/score` legacy full-report endpoint
- `GET /report/demo?mode=quick|standard|full`
- `POST /mcp`

The `/score/*` routes are intended paid A2MCP listing endpoints. Production runs fail closed: if payment configuration is missing or the facilitator is unavailable, paid routes return `503` instead of exposing reports for free. A correctly configured unpaid request returns a standard HTTP `402` challenge with a `PAYMENT-REQUIRED` header.

## Local Run

```bash
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with local credentials before testing x402. The file is ignored by Git and must never be committed.

Health check:

```bash
curl http://127.0.0.1:8788/health
```

Fetch a 12-question quick assessment:

```bash
curl "http://127.0.0.1:8788/api/asp/trading-persona?mode=quick&lang=zh"
```

Preview the visual report page:

```bash
open "http://127.0.0.1:8788/report/demo?mode=full&lang=zh"
```

Score quick answers:

```bash
curl -X POST "http://127.0.0.1:8788/api/asp/trading-persona/score/quick?lang=zh" \
  -H "content-type: application/json" \
  --data @examples/example-request-quick.json
```

## Deploy

Railway and Render config files are included.

Required production variables:

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://degendna-trading-persona-asp-production.up.railway.app
X402_ENABLED=true
X402_REQUIRE_PAYMENT=true
X402_NETWORK=eip155:196
X402_INIT_TIMEOUT_MS=8000
X402_PRICE_QUICK=$0.10
X402_PRICE_STANDARD=$1.99
X402_PRICE_FULL=$3.99
X402_PRICE=$3.99
X402_PAY_TO=0xYourXLayerReceivingAddress
OKX_API_KEY=...
OKX_SECRET_KEY=...
OKX_PASSPHRASE=...
OKX_BASE_URL=https://web3.okx.com
OKX_SYNC_SETTLE=false
X402_SYNC_ON_START=true
```

`PUBLIC_BASE_URL` is recommended. On Railway, do not manually add `PORT`; Railway injects the correct runtime port.

Before submitting or resubmitting the ASP, run the production contract probe:

```bash
npm run verify:public -- https://degendna-trading-persona-asp-production.up.railway.app
```

The probe verifies health readiness plus GET and POST payment challenges for all three tiers, including response time, resource URL, network, token amount, and `PAYMENT-REQUIRED` integrity.

Use a public HTTPS domain for OKX.AI registration. The visual demo page is safe to share for demos because it uses sample answers, not user payment data.
