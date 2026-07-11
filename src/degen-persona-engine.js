// Shared DegenDNA trading-persona model for browser UI and ASP API.
// This is original DegenDNA.fun behavior-model content, not MBTI/Myers-Briggs material.

export const DEGEN_PERSONA_DIMENSIONS = {
  social: {
    name: "机会敏感度",
    left: "独立校准",
    right: "社交共振",
    leftCode: "O",
    rightCode: "E",
    leftTag: "SOLO",
    rightTag: "ECHO",
    color: "#62f7ff"
  },
  signal: {
    name: "决策果断性",
    left: "数据仪表",
    right: "叙事雷达",
    leftCode: "D",
    rightCode: "L",
    leftTag: "DATA",
    rightTag: "LORE",
    color: "#b36cff"
  },
  execution: {
    name: "资金管理力",
    left: "规则锚定",
    right: "情绪点火",
    leftCode: "R",
    rightCode: "P",
    leftTag: "RULE",
    rightTag: "PULSE",
    color: "#ffe089"
  },
  risk: {
    name: "风险承受力",
    left: "风控防守",
    right: "冲锋进攻",
    leftCode: "S",
    rightCode: "A",
    leftTag: "SHIELD",
    rightTag: "APE",
    color: "#6dffb7"
  },
  horizon: {
    name: "耐心与纪律",
    left: "长线耐受",
    right: "短线反应",
    leftCode: "V",
    rightCode: "F",
    leftTag: "VAULT",
    rightTag: "FLASH",
    color: "#7ad8ff"
  },
  validation: {
    name: "情绪稳定性",
    left: "独立判断",
    right: "FOMO 牵引",
    leftCode: "I",
    rightCode: "H",
    leftTag: "ICE",
    rightTag: "HEAT",
    color: "#ff9c74"
  }
};

export const DEGEN_PERSONA_QUESTIONS = [
  { dim: "social", left: "先自己查链上与仓位", right: "先看群里聪明钱怎么聊", text: "遇到一个新叙事时，我更像哪一种反应？" },
  { dim: "social", left: "独自复盘亏损原因", right: "立刻找朋友对答案", text: "一笔交易亏损后，我通常会怎么处理？" },
  { dim: "social", left: "少看喊单，保留距离", right: "群聊热起来时更有行动感", text: "社群情绪对我的下单节奏影响如何？" },
  { dim: "social", left: "更信自己的观察清单", right: "更信多人共识的热度", text: "当自己的判断和市场热度冲突时，我更接近哪边？" },
  { dim: "social", left: "交易前减少外部噪音", right: "交易前需要更多外部反馈", text: "临近下单前，我更需要哪种环境？" },
  { dim: "signal", left: "先看数据结构和资金流", right: "先判断故事能不能传播", text: "面对一个项目，我第一眼更看重什么？" },
  { dim: "signal", left: "链上证据不足就不动", right: "叙事窗口打开就先占位", text: "如果叙事很强但数据还早，我会怎么做？" },
  { dim: "signal", left: "指标变差会明显降权", right: "故事没破就愿意再等等", text: "持仓过程中，什么更容易改变我的态度？" },
  { dim: "signal", left: "用表格和阈值筛项目", right: "用趋势、情绪和传播感筛项目", text: "我筛选机会时更常用哪种方法？" },
  { dim: "signal", left: "厌恶模糊，喜欢可验证", right: "接受模糊，重视想象空间", text: "面对早期机会的不确定性，我更接近哪边？" },
  { dim: "execution", left: "按预设条件执行", right: "临场情绪会改计划", text: "行情快速波动时，我的执行更像哪边？" },
  { dim: "execution", left: "进场前先写退出条件", right: "先上车，边走边看", text: "我做一笔交易前通常会怎样准备？" },
  { dim: "execution", left: "亏损到线就退出", right: "亏损后容易加理由硬扛", text: "当价格跌破预期时，我更常见的反应是？" },
  { dim: "execution", left: "错过也不追规则外机会", right: "错过会让我想补一笔", text: "看到本来想买的币已经拉升后，我会怎样？" },
  { dim: "execution", left: "交易后按记录复盘", right: "交易后主要凭感觉总结", text: "我结束一笔交易后的复盘方式更像哪边？" },
  { dim: "risk", left: "先考虑亏多少", right: "先考虑能赚多少", text: "看到机会时，我脑中最先出现的问题是？" },
  { dim: "risk", left: "宁愿少赚，不想爆雷", right: "愿意承担波动换赔率", text: "我对风险和收益的权衡更接近哪边？" },
  { dim: "risk", left: "仓位变化比较克制", right: "确认机会后会明显加仓", text: "当我非常看好一个机会时，仓位会怎样变化？" },
  { dim: "risk", left: "对杠杆和小盘更谨慎", right: "高波动反而让我兴奋", text: "面对高波动资产，我的身体反应更像哪边？" },
  { dim: "risk", left: "先做最坏情况预案", right: "先抢时间窗口", text: "突发机会出现时，我更优先做什么？" },
  { dim: "horizon", left: "能忍受较长验证周期", right: "需要较快看到反馈", text: "我的交易耐心更像哪边？" },
  { dim: "horizon", left: "适合按周/月观察", right: "适合按小时/天反应", text: "我更舒服的决策节奏是？" },
  { dim: "horizon", left: "短期回撤不轻易动摇", right: "短期波动会促使我调整", text: "持仓出现短期回撤时，我更可能怎样？" },
  { dim: "horizon", left: "愿意等待叙事兑现", right: "更喜欢捕捉阶段性脉冲", text: "我更偏好的机会形态是？" },
  { dim: "horizon", left: "慢慢建仓和分批退出", right: "快进快出捕捉窗口", text: "我的仓位节奏更接近哪边？" },
  { dim: "validation", left: "不因别人盈利否定自己", right: "别人晒收益会影响我", text: "看到别人赚到我没赚的钱时，我更像哪边？" },
  { dim: "validation", left: "能接受空仓等待", right: "空仓时容易焦虑", text: "没有仓位时，我的状态更接近哪边？" },
  { dim: "validation", left: "把机会当筛选题", right: "把机会当不能错过的门票", text: "面对热门机会，我的内心叙事更像哪边？" },
  { dim: "validation", left: "我的自我评价不跟钱包走", right: "钱包涨跌会影响自我评价", text: "钱包表现对我情绪和自我感受的影响是？" },
  { dim: "validation", left: "能承认不适合就放弃", right: "越热越容易说服自己参与", text: "当一个机会不符合我的原则但热度很高时，我更像哪边？" }
];

DEGEN_PERSONA_QUESTIONS.push(
  { dim: "social", left: "先回到自己的验证清单", right: "先看市场共识是否已经形成", text: "当多个声音同时看多，但我的验证还没完成时，我更像哪种反应？" },
  { dim: "signal", left: "以链上证据校准故事热度", right: "以叙事传播速度校准仓位", text: "当数据和故事给出不同信号时，我更容易相信哪一边？" },
  { dim: "execution", left: "触发条件不满足就不行动", right: "临场机会出现时会调整规则", text: "遇到计划外插针或急拉时，我更像哪一种执行方式？" },
  { dim: "risk", left: "先锁定已有收益和最大回撤", right: "继续追求更高赔率窗口", text: "仓位已经盈利但波动开始放大时，我通常会怎么处理？" },
  { dim: "horizon", left: "允许项目继续横盘验证", right: "横盘太久就切换到新机会", text: "一个标的长时间没有反馈时，我更倾向于哪种选择？" },
  { dim: "validation", left: "盈利图只是噪音样本", right: "看到别人盈利会明显触发我", text: "当社交媒体连续晒出盈利截图时，我的自我校准会怎样变化？" }
);

DEGEN_PERSONA_QUESTIONS.push(
  { dim: "social", left: "先看自己的交易日志", right: "先问圈内人有没有同感", text: "一段行情让我犹豫时，我更依赖哪种确认方式？" },
  { dim: "social", left: "愿意逆着热度慢慢验证", right: "共识升温会明显推着我行动", text: "当市场开始形成一致预期时，我的参与欲会怎样变化？" },
  { dim: "signal", left: "先找反证再决定仓位", right: "先看叙事是否进入传播临界点", text: "判断一个机会能不能继续时，我最先检查什么？" },
  { dim: "signal", left: "没有数据闭环会降低兴趣", right: "想象空间越大越容易吸引我", text: "早期项目资料不完整时，我的判断更接近哪边？" },
  { dim: "execution", left: "计划写清楚才舒服", right: "边做边修正更自然", text: "面对复杂行情，我更喜欢哪种执行方式？" },
  { dim: "execution", left: "连续亏损后主动停手", right: "连续亏损后想尽快扳回", text: "当我连续几笔不顺时，下一步更像哪种反应？" },
  { dim: "risk", left: "先按可承受亏损定仓", right: "先按想要收益倒推仓位", text: "决定仓位大小时，我更常用哪种起点？" },
  { dim: "risk", left: "看不懂就先放弃", right: "看不懂但热度高会小冲一下", text: "遇到信息不透明但涨得很快的标的时，我更可能怎样？" },
  { dim: "horizon", left: "无聊时也能保持空仓", right: "无聊时容易找点机会做", text: "市场没有明显机会时，我的交易冲动更像哪边？" },
  { dim: "horizon", left: "愿意等二次确认", right: "更想吃第一段启动", text: "面对刚启动的趋势，我更偏向哪种节奏？" },
  { dim: "validation", left: "错过机会后能平静记录", right: "错过机会后容易追求补偿", text: "当我错过一段大涨时，内心更常出现什么？" },
  { dim: "validation", left: "亏损后先区分过程与结果", right: "亏损后容易否定整套判断", text: "一笔亏损发生后，我对自己的评价更像哪边？" }
);


DEGEN_PERSONA_QUESTIONS.push(
  { dim: "social", left: "先拆信息来源和利益关系", right: "先看头部账号是否同步转向", text: "当一个热门观点突然刷屏时，我更优先检查什么？" },
  { dim: "social", left: "保留少数反对意见做备忘", right: "共识足够强就先跟上节奏", text: "如果社区几乎一边倒看多，我会怎样处理反面信息？" },
  { dim: "social", left: "独立记录自己的入场理由", right: "需要和同伴确认才安心", text: "真正下单前，我最需要哪一种确定感？" },
  { dim: "social", left: "把公开情绪当噪音权重", right: "把公开情绪当趋势燃料", text: "我如何理解社交媒体上的情绪升温？" },
  { dim: "signal", left: "先验证真实使用和资金路径", right: "先判断故事能否形成二级传播", text: "评估新项目时，我更看重哪类早期证据？" },
  { dim: "signal", left: "指标不闭环就降低仓位", right: "叙事还在扩散就保留弹性", text: "数据不完整但市场开始定价时，我会怎样调仓？" },
  { dim: "signal", left: "先找失败条件", right: "先找爆发催化", text: "建立交易假设时，我的第一步更像哪边？" },
  { dim: "signal", left: "看成交、持币和解锁结构", right: "看话题、情绪和注意力斜率", text: "我判断行情延续性时最常看的是什么？" },
  { dim: "execution", left: "只按事前规则处理", right: "根据盘面即时重写计划", text: "价格快速接近止损或止盈区时，我更常怎么做？" },
  { dim: "execution", left: "先减仓再重新评估", right: "继续等更明确的反转", text: "浮盈回撤开始吞掉利润时，我更可能怎样？" },
  { dim: "execution", left: "不让单笔交易影响下一笔", right: "上一笔结果会改变下一笔手感", text: "刚经历一笔大赚或大亏后，我的执行会怎样变化？" },
  { dim: "execution", left: "复盘时看是否遵守流程", right: "复盘时先看盈亏结果", text: "交易结束后，我更容易用什么标准评价自己？" },
  { dim: "risk", left: "先评估最坏流动性情形", right: "先评估最大赔率空间", text: "面对小盘或低流动性机会，我脑中最先出现什么？" },
  { dim: "risk", left: "宁愿错过也不碰黑箱", right: "小仓参与换取信息优势", text: "合约、解锁或庄家结构不透明时，我会怎样？" },
  { dim: "risk", left: "收益越大越先收缩风险", right: "收益越大越想扩大优势", text: "连续盈利后，我的风险偏好通常如何变化？" },
  { dim: "risk", left: "先确认退出通道", right: "先抢进入窗口", text: "行情突然放量时，我更优先确认什么？" },
  { dim: "horizon", left: "愿意忍受低反馈期", right: "需要频繁反馈维持注意力", text: "市场沉寂或横盘时，我的耐心更像哪边？" },
  { dim: "horizon", left: "按周期目标慢慢验证", right: "按事件节点快速切换", text: "我更适合哪种机会跟踪方式？" },
  { dim: "horizon", left: "把空仓视为策略状态", right: "把空仓视为错过风险", text: "没有明确机会时，我如何看待空仓？" },
  { dim: "horizon", left: "等待假设完整兑现", right: "捕捉预期差最强的一段", text: "我更希望吃到一笔交易的哪一段收益？" },
  { dim: "validation", left: "结果不好也能拆过程", right: "结果不好会动摇自信", text: "认真执行计划但仍亏损时，我更常出现什么感受？" },
  { dim: "validation", left: "能接受别人赚更多", right: "别人赚更多会让我想追平", text: "当同伴收益明显超过我时，我的内在反应是？" },
  { dim: "validation", left: "把公开战绩和自我价值分开", right: "公开战绩会影响我的交易状态", text: "如果我的交易被别人看见，我会怎样受影响？" },
  { dim: "validation", left: "承认没有优势就退出", right: "越临近爆发越难退出", text: "发现自己没有清晰优势但行情很热时，我更像哪边？" }
);

export const DEGEN_PERSONA_TYPES = [
  {
    key: "rocket-raider",
    abbr: "RUSH",
    name: "热启冲锋型",
    subtitle: "机会窗口打开时，你的行动速度比复盘表更快。",
    match: (s) => s.risk >= 42 && s.execution >= 24,
    strengths: ["行动果断", "能抓住早期波动", "对机会窗口敏感"],
    risks: ["容易高位追入", "止损纪律被情绪覆盖", "连续亏损后可能加速上头"],
    protocol: "把单笔最大亏损、追高冷却时间和睡前禁盘写成硬规则。"
  },
  {
    key: "risk-surgeon",
    abbr: "SAFE",
    name: "风控堡垒型",
    subtitle: "你先看会不会死，再看能不能飞。",
    match: (s) => s.risk <= -42 && s.execution <= -18,
    strengths: ["风险边界清楚", "仓位克制", "更容易活到下一轮"],
    risks: ["可能错过高赔率窗口", "容易过度等待完美证据", "行情启动后进入成本焦虑"],
    protocol: "保留小仓试错额度，让系统允许自己参与非完美机会。"
  },
  {
    key: "fomo-sprinter",
    abbr: "FOMO",
    name: "错过敏感型",
    subtitle: "你不是看不懂风险，而是最怕门票在眼前关上。",
    match: (s) => s.validation >= 42 && (s.risk >= 10 || s.horizon >= 14),
    strengths: ["对机会流动很敏锐", "能快速进入状态", "不容易错过市场情绪拐点"],
    risks: ["容易被错过感驱动", "入场理由会被热度改写", "亏损后可能寻找补偿性交易"],
    protocol: "所有热门机会先延迟一轮确认，写下不买也可以接受的理由，再决定是否行动。"
  },
  {
    key: "narrative-radar",
    abbr: "LORE",
    name: "叙事捕手型",
    subtitle: "你能听见市场故事开始变响的那一秒。",
    match: (s) => s.signal >= 42 && (s.social >= 10 || s.validation >= 8),
    strengths: ["传播敏感", "叙事捕捉快", "能理解群体情绪"],
    risks: ["容易把热度误判成价值", "受社交反馈牵引", "对反证数据容忍过高"],
    protocol: "每个叙事都配一条反证指标，指标破位时必须降权。"
  },
  {
    key: "data-cartographer",
    abbr: "DATA",
    name: "数据罗盘型",
    subtitle: "你喜欢把混沌市场画成能验证的地图。",
    match: (s) => s.signal <= -42 && s.execution <= 16,
    strengths: ["证据意识强", "复盘能力好", "不容易被空喊带走"],
    risks: ["进入过慢", "容易被早期模糊性劝退", "可能错过非线性爆发"],
    protocol: "给早期机会设置小额观察仓，用真实反馈补足模型。"
  },
  {
    key: "rule-forger",
    abbr: "RULE",
    name: "规则铸造型",
    subtitle: "你真正信任的不是感觉，而是被市场反复打磨过的流程。",
    match: (s) => s.execution <= -38 && s.validation <= 20,
    strengths: ["执行稳定", "复盘颗粒度细", "能把冲动压进流程里"],
    risks: ["规则过重时会错失弹性", "临场变化容易带来迟疑", "可能把控制感误认为安全"],
    protocol: "保留一条小仓弹性规则，让系统既有纪律，也能识别罕见窗口。"
  },
  {
    key: "social-resonator",
    abbr: "ECHO",
    name: "共识共振型",
    subtitle: "你很会感受市场温度，也容易被温度烫到。",
    match: (s) => s.social >= 42 && s.validation >= 18,
    strengths: ["信息流广", "能感知共识形成", "传播趋势判断强"],
    risks: ["容易被晒图和喊单影响", "独立验证不足", "群体情绪退潮时反应慢"],
    protocol: "把社群观点分成线索而不是结论，所有入场都必须通过个人检查清单。"
  },
  {
    key: "quiet-holder",
    abbr: "HOLD",
    name: "长线锚定型",
    subtitle: "你不是不动，你是在等逻辑自己证明自己。",
    match: (s) => s.horizon <= -42 && s.risk <= 18,
    strengths: ["耐心强", "不易被短期波动洗出", "适合分批规划"],
    risks: ["可能把迟钝误当信仰", "止盈反应慢", "对基本面恶化反应不足"],
    protocol: "为长线仓设定复核日和失效条件，不让信仰吞掉退出按钮。"
  },
  {
    key: "pulse-hunter",
    abbr: "FAST",
    name: "短线脉冲型",
    subtitle: "你关注的是市场心跳最密集的那几拍。",
    match: (s) => s.horizon >= 42 && s.risk >= -6,
    strengths: ["反应快", "适合事件驱动", "能快速试错"],
    risks: ["交易频率过高", "手续费和滑点侵蚀收益", "容易被噪音牵动"],
    protocol: "限制每天有效交易次数，把无效点击从策略里剔除。"
  },
  {
    key: "conviction-architect",
    abbr: "CORE",
    name: "信念架构型",
    subtitle: "你会给一个判断留出足够时间，让逻辑慢慢兑现。",
    match: (s) => s.horizon <= -34 && s.validation <= -12 && s.signal <= 18,
    strengths: ["不易被噪音洗出", "能承受验证周期", "适合搭建中长期假设"],
    risks: ["可能过度美化原始判断", "失效信号出现时反应偏慢", "容易低估机会成本"],
    protocol: "每个中长期假设必须配失效日期、失效指标和重新建模条件。"
  },
  {
    key: "volatility-scout",
    abbr: "VOLT",
    name: "波动侦察型",
    subtitle: "你愿意走进高波动区，但最好带着绳索和地图。",
    match: (s) => s.risk >= 42 && s.execution <= 12 && s.validation <= 18,
    strengths: ["能承受不确定", "敢于小仓探索", "对赔率变化敏感"],
    risks: ["容易低估尾部风险", "胜率不高时仍被赔率吸引", "止损太松会侵蚀系统"],
    protocol: "把高波动机会拆成观察仓、验证仓和确认仓，不允许一次性打满。"
  },
  {
    key: "drawdown-alchemist",
    abbr: "RECO",
    name: "回撤修复型",
    subtitle: "亏损会让你想立刻修复局面，这既是燃料也是风险源。",
    match: (s) => s.execution >= 34 && s.validation >= 28,
    strengths: ["复原欲强", "行动能量高", "能快速寻找替代路径"],
    risks: ["容易把修复心态带进下一笔", "止损后马上反手", "复盘被情绪归因污染"],
    protocol: "亏损后先写下原计划与实际动作的差异，至少间隔一轮行情再做下一笔。"
  },
  {
    key: "contrarian-auditor",
    abbr: "AUDT",
    name: "反证审计型",
    subtitle: "你不急着相信市场，先把漏洞和反证摆上桌。",
    match: (s) => s.signal <= -34 && s.social <= -22 && s.validation <= 18,
    strengths: ["反证意识强", "不易被共识裹挟", "适合做风险筛查"],
    risks: ["可能过早否定新叙事", "进入速度偏慢", "容易把怀疑误当优势"],
    protocol: "为每个被否定的机会保留一个复核触发器，避免用一次怀疑关掉整段趋势。"
  },
  {
    key: "capital-thermostat",
    abbr: "COOL",
    name: "仓位恒温型",
    subtitle: "你擅长让资金温度保持可控，不让行情替你调节情绪。",
    match: (s) => s.risk <= -30 && s.execution <= -28 && s.validation <= 8,
    strengths: ["仓位稳定", "风险温控好", "不容易被短期盈亏拉走"],
    risks: ["可能压低高质量机会的权重", "收益弹性不足", "容易过度追求舒适区"],
    protocol: "把高置信机会单独建一个加权规则，允许系统在证据足够时升温。"
  },
  {
    key: "crowd-wave-rider",
    abbr: "WAVE",
    name: "共识浪潮型",
    subtitle: "你能踩到注意力浪潮，但浪退时要比别人更早看见水位。",
    match: (s) => s.social >= 34 && s.signal >= 28 && s.horizon >= 18,
    strengths: ["趋势嗅觉强", "传播节奏敏感", "适合事件驱动"],
    risks: ["容易把共识当安全垫", "退潮信号识别偏慢", "仓位会被热度放大"],
    protocol: "每次跟随共识都预设退潮指标，热度越高，退出规则越要机械。"
  },
  {
    key: "liquidity-operator",
    abbr: "FLOW",
    name: "流动性操作型",
    subtitle: "你关注的不只是方向，还有进出场能否真的完成。",
    match: (s) => s.execution <= -24 && s.risk <= 8 && s.horizon >= -18 && s.horizon <= 34,
    strengths: ["执行颗粒度细", "重视交易摩擦", "适合分批处理"],
    risks: ["容易被细节拖慢", "可能错过快窗口", "过度优化进出点"],
    protocol: "把交易拆成确认、试单、主仓和退出四段，提前写清每段允许的滑点和时间。"
  },
  {
    key: "balanced-reviewer",
    abbr: "BAL",
    name: "均衡复盘型",
    subtitle: "你没有一个极端按钮，但这也意味着系统还有升级空间。",
    match: () => true,
    strengths: ["可塑性强", "不容易单点失控", "适合建立稳定交易系统"],
    risks: ["优势不够尖锐", "容易在不同策略间摇摆", "需要更清晰的主策略"],
    protocol: "选定一个主交易周期和一个主信号源，减少风格漂移。"
  }
];


export const DEGEN_PERSONA_MODEL_VERSION = "degen-persona-code-v4-normalized-72q";
export const DEGEN_PERSONA_DISCLAIMER = "DegenDNA.fun 自研交易人格自查模型，用于娱乐、自我观察和交易行为复盘；不属于 MBTI、Myers-Briggs Type Indicator 或任何第三方授权人格量表，结果不构成投资建议。";

const DEGEN_PERSONA_SUBTYPES = {
  H: {
    code: "H",
    name: "热启动",
    label: "情绪热启动",
    description: "行情、盈亏和他人战绩很容易把你推入即时行动模式。优势是反应快，风险是把情绪误读成信号。"
  },
  G: {
    code: "G",
    name: "护城河",
    label: "风控护城",
    description: "你会优先保护本金、流动性和睡眠质量。优势是活得久，风险是把谨慎误读成永远不能上车。"
  },
  W: {
    code: "W",
    name: "追浪",
    label: "共识追浪",
    description: "你对市场注意力和叙事斜率非常敏感。优势是能踩到热度，风险是退潮时不够机械。"
  },
  A: {
    code: "A",
    name: "锚定",
    label: "周期锚定",
    description: "你更容易围绕长期假设和验证周期行动。优势是耐心，风险是失效信号出现后反应偏慢。"
  },
  X: {
    code: "X",
    name: "拉扯",
    label: "内在拉扯",
    description: "你的偏好里同时存在进攻和防守、独立和共识、规则和冲动。优势是适应性，风险是关键时刻摇摆。"
  },
  C: {
    code: "C",
    name: "核心",
    label: "核心均衡",
    description: "你的偏好没有明显失控端，更适合通过规则和复盘把优势磨尖。风险是风格漂移。"
  }
};

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function degenPersonaIntensity(dimensions) {
  const averageStrength = Math.round(average(dimensions.map((dimension) => dimension.strength)));
  const tier = averageStrength >= 76 ? 5 : averageStrength >= 58 ? 4 : averageStrength >= 40 ? 3 : averageStrength >= 22 ? 2 : 1;
  const labels = {
    1: "轻偏好",
    2: "可见偏好",
    3: "明确偏好",
    4: "强偏好",
    5: "极强偏好"
  };
  return {
    tier,
    score: averageStrength,
    label: labels[tier]
  };
}

function chooseDegenPersonaSubtype(scores, dimensions) {
  const riskExecutionTension =
    (scores.risk >= 28 && scores.execution <= -18) ||
    (scores.risk <= -28 && scores.execution >= 18);
  const signalSocialTension =
    (scores.signal >= 28 && scores.social <= -24) ||
    (scores.signal <= -28 && scores.social >= 24);
  const horizonValidationTension =
    (scores.horizon <= -28 && scores.validation >= 28) ||
    (scores.horizon >= 28 && scores.validation <= -24);
  const avgStrength = average(dimensions.map((dimension) => dimension.strength));

  if (scores.validation >= 36 || (scores.execution >= 32 && scores.risk >= 18)) return DEGEN_PERSONA_SUBTYPES.H;
  if (scores.risk <= -32 && scores.execution <= -20) return DEGEN_PERSONA_SUBTYPES.G;
  if ((scores.social >= 28 && scores.signal >= 24) || (scores.signal >= 32 && scores.horizon >= 18)) return DEGEN_PERSONA_SUBTYPES.W;
  if (scores.horizon <= -34 && scores.validation <= 8) return DEGEN_PERSONA_SUBTYPES.A;
  if (riskExecutionTension || signalSocialTension || horizonValidationTension) return DEGEN_PERSONA_SUBTYPES.X;
  if (avgStrength < 28) return DEGEN_PERSONA_SUBTYPES.C;
  return DEGEN_PERSONA_SUBTYPES.C;
}

function degenPersonaConfidence(answeredCount, questionCount, intensity) {
  const completion = questionCount ? answeredCount / questionCount : 0;
  const signal = Math.min(1, intensity.score / 70);
  const score = Math.round((completion * 0.7 + signal * 0.3) * 100);
  const label = completion < 0.25
    ? "初步倾向"
    : completion < 0.75
      ? "中等置信"
      : score >= 82
        ? "高置信"
        : score >= 62
          ? "中高置信"
          : "中等置信";
  return {
    score,
    label,
    sampleCoverage: Number(completion.toFixed(4))
  };
}

function formatAxisCode(rawCode) {
  return `${rawCode.slice(0, 3)}-${rawCode.slice(3)}`;
}

function buildDegenPersonaTradingPlan(persona) {
  const byKey = Object.fromEntries(persona.dimensions.map((dimension) => [dimension.key, dimension]));
  const highAxes = persona.dimensions
    .filter((dimension) => dimension.strength >= 54)
    .map((dimension) => `${dimension.name}:${dimension.direction}`);
  const lowAxes = persona.dimensions
    .filter((dimension) => dimension.strength < 30)
    .map((dimension) => dimension.name);

  const entryChecklist = [
    byKey.signal.score >= 0
      ? "叙事很强时，先写下一个可验证的反证指标；指标没过，不把热度当入场理由。"
      : "数据筛选过严时，允许用小额观察仓获取真实反馈，不等完美证据才开始学习。",
    byKey.social.score >= 0
      ? "群聊或时间线同时看多时，必须独立写出自己的入场理由和失效条件。"
      : "独立判断过强时，至少收集一个与你相反的高质量观点，避免信息孤岛。",
    byKey.horizon.score >= 0
      ? "短线机会只做你能在同一天写清楚退出条件的交易。"
      : "长线假设必须有复核日期，不能用“再等等”替代验证。"
  ];

  const positionRules = [
    byKey.risk.score >= 0
      ? "所有高波动仓位拆成观察仓、确认仓、主仓三段，禁止一次性打满。"
      : "为高置信机会预留固定试错仓，避免每次都因害怕亏损而完全错过。",
    byKey.execution.score >= 0
      ? "下单前写出最大亏损金额、加仓条件和撤退线；写不出来就不做。"
      : "规则锚定者可以保留一条小仓弹性规则，但必须提前定义触发条件。",
    "仓位大小以“亏了还能睡着”为上限，而不是以“赚了能发多大截图”为目标。"
  ];

  const exitRules = [
    byKey.execution.score >= 0
      ? "价格触发退出线后先执行，再复盘；不要在触发时临场重写故事。"
      : "如果选择继续持有，必须记录原计划为什么失效、现在凭什么继续。",
    byKey.risk.score >= 0
      ? "连续盈利后主动降温，至少把本金或部分利润移出高波动仓。"
      : "保守型止盈容易过早，建议用分批退出替代一次性清仓。",
    "任何让你开始反复刷新价格的仓位，都已经超过当前心理带宽。"
  ];

  const emotionalProtocol = [
    byKey.validation.score >= 0
      ? "看到别人盈利截图后，至少等待一轮 K 线或 20 分钟，再决定是否行动。"
      : "亏损后先区分过程错误和结果波动，不用单笔盈亏评价整个人。",
    persona.subtype.code === "H"
      ? "热启动日只允许减仓、记录和观察，禁止用下一笔交易修复上一笔情绪。"
      : "每天设置一个固定看盘窗口，把市场刺激从全天候改成定时处理。"
  ];

  const reviewQuestions = [
    "我这笔交易的入场证据来自数据、叙事、社群还是情绪？哪个权重最高？",
    "如果这笔交易亏损，我提前承认的最大亏损是多少？",
    "退出条件是价格、时间、数据失效，还是单纯感觉变了？",
    "这次行动是在执行系统，还是在补偿错过、亏损或焦虑？"
  ];

  const trainingPlan = [
    "7 天：每笔交易前只写三行：入场理由、失效条件、最大亏损。",
    "14 天：统计自己最常被哪类触发驱动：晒图、群聊、急拉、回撤、无聊。",
    "30 天：只优化一个维度，不同时改周期、仓位、标的和信号源。"
  ];

  return {
    headline: `${persona.profileCode} 的核心训练目标：把「${persona.subtype.label}」变成可执行系统，而不是临场感觉。`,
    highAxes,
    lowAxes,
    entryChecklist,
    positionRules,
    exitRules,
    emotionalProtocol,
    reviewQuestions,
    trainingPlan
  };
}

export function normalizeDegenPersonaAnswers(input) {
  const source = Array.isArray(input)
    ? Object.fromEntries(input.map((value, index) => [`degenPersona:${index}`, value]))
    : Object(input || {});
  const answers = {};

  DEGEN_PERSONA_QUESTIONS.forEach((question, index) => {
    const raw = source[`degenPersona:${index}`] ?? source[question.id] ?? source[index] ?? source[String(index)];
    if (raw === undefined || raw === null || raw === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    answers[`degenPersona:${index}`] = Math.max(-2, Math.min(2, value));
  });

  return answers;
}

export function computeDegenPersonaResultFromAnswers(input) {
  const answers = normalizeDegenPersonaAnswers(input);
  const dimensionKeys = Object.keys(DEGEN_PERSONA_DIMENSIONS);
  const rawScores = Object.fromEntries(dimensionKeys.map((key) => [key, 0]));
  const answeredByDimension = Object.fromEntries(dimensionKeys.map((key) => [key, 0]));
  const questionsByDimension = Object.fromEntries(dimensionKeys.map((key) => [
    key,
    DEGEN_PERSONA_QUESTIONS.filter((question) => question.dim === key).length
  ]));

  DEGEN_PERSONA_QUESTIONS.forEach((question, index) => {
    const value = answers[`degenPersona:${index}`];
    if (value === undefined || !question.dim) return;
    rawScores[question.dim] += Number(value) * 5;
    answeredByDimension[question.dim] += 1;
  });

  // Normalize every dimension to the complete 72-question scale. This keeps
  // classification thresholds comparable for balanced 12, 24, and 72 question modes.
  const scores = Object.fromEntries(dimensionKeys.map((key) => {
    const answered = answeredByDimension[key];
    const target = questionsByDimension[key];
    const normalized = answered ? rawScores[key] * (target / answered) : 0;
    return [key, Number(normalized.toFixed(2))];
  }));

  const rawCode = Object.entries(DEGEN_PERSONA_DIMENSIONS).map(([key, dimension]) => (
    scores[key] >= 0 ? dimension.rightCode : dimension.leftCode
  )).join("");
  const type = DEGEN_PERSONA_TYPES.find((candidate) => candidate.match(scores)) || DEGEN_PERSONA_TYPES.at(-1);
  const dimensions = Object.entries(DEGEN_PERSONA_DIMENSIONS).map(([key, dimension]) => {
    const score = scores[key];
    const direction = score >= 0 ? dimension.right : dimension.left;
    const fullScale = questionsByDimension[key] * 2 * 5;
    const strength = fullScale
      ? Math.min(100, Math.round((Math.abs(score) / fullScale) * 100))
      : 0;
    return {
      key,
      ...dimension,
      score,
      strength,
      direction,
      answeredCount: answeredByDimension[key],
      sampleCoverage: questionsByDimension[key]
        ? Number((answeredByDimension[key] / questionsByDimension[key]).toFixed(4))
        : 0
    };
  });
  const strongest = [...dimensions].sort((a, b) => b.strength - a.strength).slice(0, 2);
  const answeredCount = Object.keys(answers).length;
  const axisCode = formatAxisCode(rawCode);
  const intensity = degenPersonaIntensity(dimensions);
  const subtype = chooseDegenPersonaSubtype(scores, dimensions);
  const confidence = degenPersonaConfidence(answeredCount, DEGEN_PERSONA_QUESTIONS.length, intensity);
  const profileCode = `${type.abbr}-${axisCode}-${subtype.code}${intensity.tier}`;
  const persona = {
    modelVersion: DEGEN_PERSONA_MODEL_VERSION,
    code: profileCode,
    profileCode,
    axisCode,
    rawCode,
    type,
    subtype,
    intensity,
    confidence,
    scores,
    rawScores,
    answeredByDimension,
    scoring: {
      method: "dimension-mean-normalized-v1",
      normalizedToQuestionCount: questionsByDimension,
      answerRange: [-2, 2]
    },
    dimensions,
    strongest,
    answers,
    questionCount: DEGEN_PERSONA_QUESTIONS.length,
    answeredCount,
    completionRate: DEGEN_PERSONA_QUESTIONS.length ? Number((answeredCount / DEGEN_PERSONA_QUESTIONS.length).toFixed(4)) : 0,
    disclaimer: DEGEN_PERSONA_DISCLAIMER
  };
  persona.tradingPlan = buildDegenPersonaTradingPlan(persona);

  return persona;
}

export function buildDegenPersonaSummary(persona, lang = "zh") {
  const primary = persona.strongest?.[0] || persona.dimensions?.[0];
  const secondary = persona.strongest?.[1] || persona.dimensions?.[1] || primary;
  const isEn = lang === "en";
  return {
    modelVersion: persona.modelVersion,
    abbr: persona.type.abbr,
    title: persona.type.name,
    code: persona.code,
    axisCode: persona.axisCode,
    subtype: persona.subtype,
    intensity: persona.intensity,
    confidence: persona.confidence,
    subtitle: persona.type.subtitle,
    summary: isEn
      ? `${persona.type.name} (${persona.code}) is led by ${primary?.name || "the primary axis"} and ${secondary?.name || "the secondary axis"}, with a ${persona.subtype.label} subtype. Use it as a trading-behavior review, not financial advice.`
      : `你的交易人格更接近「${persona.type.name}」（${persona.code}）。当前最突出的维度是「${primary?.name || "主维度"}」与「${secondary?.name || "次维度"}」，细分后缀为「${persona.subtype.label} · ${persona.intensity.label}」，适合用作交易行为复盘，而不是投资建议。`,
    strengths: persona.type.strengths,
    risks: persona.type.risks,
    protocol: persona.type.protocol,
    tradingPlan: persona.tradingPlan,
    dimensions: persona.dimensions.map((dimension) => ({
      key: dimension.key,
      name: dimension.name,
      direction: dimension.direction,
      score: dimension.score,
      strength: dimension.strength,
      code: dimension.score >= 0 ? dimension.rightCode : dimension.leftCode,
      tag: dimension.score >= 0 ? dimension.rightTag : dimension.leftTag
    })),
    questionCount: persona.questionCount,
    answeredCount: persona.answeredCount,
    completionRate: persona.completionRate,
    disclaimer: persona.disclaimer
  };
}
