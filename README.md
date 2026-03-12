# AI4POKER

<p align="center">
  <strong>🤖 AI 驱动的德州扑克智能教练</strong>
</p>

<p align="center">
  实时胜率 · 策略建议 · 拟人 AI 对手 · 专业级牌局复盘
</p>

<p align="center">
  <a href="https://gambit025.github.io/AI4POKER/">🌐 在线体验</a>
</p>

---

## 不止是练牌，更是你的私人 AI 扑克教练

**AI4POKER** 把「AI 教练」搬进浏览器：在每一手牌的每一个决策点，为你提供**实时胜率估算**、**EHS 期望收益分析**和**自然语言下注建议**。无需安装、无需后端，打开即用，在真实对局节奏里提升你的扑克思维。

---

## 核心亮点

| 能力 | 说明 |
|------|------|
| **🧠 5 层 AI 决策引擎** | 恐惧系数 → 底池承诺 → 对手行为分析 → 综合决策 → 智能下注量控制，每个 AI 都像真人一样思考 |
| **🎭 8 种 AI 性格 × 加权随机分配** | TAG、LAG、GTO、Maniac、Nit、Shark、Loose Passive、Tight Passive——每局开局前按概率随机分配，同一桌永远遇到不同的对手组合 |
| **🔄 全街 AI 教练** | 翻前到河牌，每一街都有实时胜率、EHS 与自然语言策略建议，像身边坐了一位高手在帮你读牌 |
| **📊 专业级牌局复盘** | 每手牌结束后，用 Pot Odds、Fold Equity、EV、SPR 等术语为你的每条决策打分，快速发现漏洞 |
| **👥 2–8 人灵活桌** | 从单挑到满桌，可调人数与智能座位布局 |
| **📱 移动端优先** | 针对手机浏览器深度优化，375px 小屏也能完美显示 8 人桌 |
| **🎵 沉浸体验** | 发牌、下注、弃牌、获胜均有合成音效；Dark Glassmorphism 界面 |
| **♾️ 无淘汰机制** | 筹码可为负、对局不中断，专注练牌与学习 |

---

## AI 决策系统

AI4POKER 的 AI 不是简单的「牌力 > 阈值就加注」——它通过 **5 层决策管道** 模拟真实人类的思考过程：

```
牌力评估 → 恐惧系数 → 底池承诺 → 对手故事 → 综合决策 → 下注量控制
```

1. **恐惧系数（Fear Factor）**：面对大额下注时，AI 会像真人一样「怕」——即使手牌不错，看到对手 All-in 也可能选择放弃
2. **底池承诺（Pot Commitment）**：已经投入大量筹码？AI 会计算沉没成本，不会轻易弃牌
3. **对手行为分析（Opponent Story）**：根据对手下注模式推测范围——对手突然重注？可能是强牌或诈唬
4. **综合决策**：将牌力、位置、底池赔率、对手行为综合评估，决定跟注/加注/弃牌
5. **智能下注量**：不再无脑 All-in，根据底池大小和牌力强度选择合理的下注比例

每个 AI 还有独特的**性格参数**（激进度、诈唬倾向、恐惧敏感度等），同一副好牌，Maniac 可能全下，Nit 可能只跟注，Shark 会精准加注——就像真实牌桌上的不同玩家。

---

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript，零依赖、无构建
- **AI 胜率引擎**：Monte Carlo 模拟 + EHS 计算，在 Web Worker 中异步跑，不卡界面
- **音效**：Web Audio API 合成，无需外部音频文件
- **部署**：GitHub Pages，零成本托管

---

## 快速开始

在**包含 `index.html` 的本项目目录**下启动本地服务：

```bash
cd AI4POKER
python3 -m http.server 8080
```


直接访问 **[在线版本](https://gambit025.github.io/AI4POKER/)**，无需本地运行。

---

## 项目结构

```
AI4POKER/
├── index.html            # 主入口（首页 / 设置 / 对局）
├── style.css             # Dark Glassmorphism 主题 + 移动端响应式
├── js/
│   ├── game.js           # 核心：牌型评估、Monte Carlo、EHS、5层AI决策、建议系统
│   ├── app.js            # UI 渲染、动画、事件与 Worker 调用
│   ├── mcWorker.js       # 异步 Monte Carlo 胜率
│   ├── seatPositions.js  # 2–8 人座位布局
│   └── sounds.js         # 音效合成
└── README.md
```

---

## License

MIT
