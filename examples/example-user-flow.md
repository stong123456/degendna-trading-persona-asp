# Example User Flow

## Quick Mode

User:

```text
我经常看到别人赚钱就忍不住追，亏了又想马上扳回来，帮我看看是什么交易人格。
```

Agent:

```text
我先用 DegenDNA 给你做 12 题极速测评。它不会预测行情，也不会给买卖建议，只帮你识别自己的交易行为偏好。
```

Agent calls:

```http
GET /api/asp/trading-persona?mode=quick&lang=zh
```

Agent shows 12 questions with A-F choices. The user answers with letters only, such as `1=E, 2=D, 3=B`.

Agent calls the paid endpoint:

```http
POST /api/asp/trading-persona/score/quick?lang=zh
```

Agent response:

```text
你的 DegenDNA 接近 BAL-ELP-SFH-C1 均衡复盘型。优势是可塑性强，不容易单点失控；主要盲区是优势不够尖锐，容易在不同策略间摇摆。

下一笔交易前先做一件事：选定一个主交易周期和一个主信号源，减少风格漂移。

可复制分享：
刚测了一下我的链上交易人格，结果是 BAL-ELP-SFH-C1 均衡复盘型。你的优势是可塑性强，最该训练的是优势不够尖锐。 这不是买卖建议，是一次交易行为复盘。#OKXAI
```

## Standard Mode

Use standard mode when the user wants a six-dimension profile but does not need the full 72-question training plan.
The interaction is still plain A-F multiple choice; no user-facing scores are required.

```http
GET /api/asp/trading-persona?mode=standard&lang=zh
POST /api/asp/trading-persona/score/standard?lang=zh
```

The report should include:

- Persona code
- Six-dimension profile
- Strengths and blind spots
- Execution protocol
- Light review checklist
- X share copy

## Full Mode

Use full mode when the user wants the highest-confidence report and a training plan.
The interaction should be batched in friendly chunks, for example 12 questions at a time, with the user replying only with A-F letters.

```http
GET /api/asp/trading-persona?mode=full&lang=zh
POST /api/asp/trading-persona/score/full?lang=zh
```

The report should include:

- Complete 72-question profile
- Six-dimension scores
- Entry checklist
- Position rules
- Exit rules
- Emotional protocol
- Review questions
- 7/14/30-day training plan
- X share copy

## Visual Demo

Open a demo report page:

```text
https://degendna-trading-persona-asp-production.up.railway.app/report/demo?mode=full&lang=zh
```

The demo uses sample answers. It is safe for screenshots and X demo videos.
