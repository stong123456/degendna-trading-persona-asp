# DegenDNA Trading Persona ASP

Independent A2MCP-ready service for the DegenDNA trading-persona self-check.

The service exposes an original 72-question, six-dimension trading-behavior model. It does not use MBTI, Myers-Briggs Type Indicator, or third-party licensed personality inventory content.

## OKX.AI Listing Draft

Agent name:

```text
DegenDNA
```

Agent description:

```text
DegenDNA 是面向链上交易者的原创交易行为画像服务，用72题模型生成可分享的人格码与复盘建议。
```

Service name:

```text
交易人格进阶画像
```

Service type:

```text
API service
```

Fee:

```text
3.99
```

Service description:

```text
1. 基于原创72题交易行为模型，为链上交易者生成类型缩写、六轴偏好码、细分后缀、优势盲区和复盘建议。
2. 用户需提交完整自测答案或按接口传入题目选项，服务返回结构化画像、置信度、风控和执行建议。
```

Recommended endpoint after deployment:

```text
https://YOUR_DEPLOYED_DOMAIN/api/asp/trading-persona/score
```

## API

- `GET /health`
- `GET /api/asp/trading-persona`
- `POST /api/asp/trading-persona`
- `POST /api/asp/trading-persona/score`
- `POST /mcp`

The `/score` route is the intended paid A2MCP listing endpoint. Set `X402_PAY_TO`, `X402_ENABLED=true`, and OKX Developer Portal API credentials in production to enable OKX x402 payment protection.

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

Fetch questionnaire:

```bash
curl "http://127.0.0.1:8788/api/asp/trading-persona?lang=zh"
```

Score answers:

```bash
curl -X POST "http://127.0.0.1:8788/api/asp/trading-persona/score?lang=zh" \
  -H "content-type: application/json" \
  --data @examples/example-request.json
```

## Deploy

Railway and Render config files are included.

Required production variables:

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://YOUR_DEPLOYED_DOMAIN
X402_ENABLED=true
X402_NETWORK=eip155:196
X402_PRICE=$3.99
X402_PAY_TO=0xYourXLayerReceivingAddress
OKX_API_KEY=...
OKX_SECRET_KEY=...
OKX_PASSPHRASE=...
OKX_BASE_URL=https://web3.okx.com
```

Use a public HTTPS domain for OKX.AI registration.
