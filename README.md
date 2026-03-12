# AI4POKER

<p align="center">
  <strong>🤖 AI 驱动的德州扑克智能教练</strong>
</p>

<p align="center">
  实时胜率 · 策略建议 · 多风格 AI 对手 · 专业级牌局复盘
</p>

<p align="center">
  <a href="https://gambit025.github.io/AI4POKER/">🌐 在线体验</a>
</p>

---

## 不止是练牌，更是你的私人 AI 扑克教练

**AI4POKER** 把「AI 教练」搬进浏览器：在每一手牌的每一个决策点，为你提供**实时胜率估算**、**EHS 期望收益分析**和**自然语言下注建议**。无需安装、无需后端，打开即用，在真实对局节奏里提升你的扑克思维。

- **智能决策支持**：翻前 / 翻牌 / 转牌 / 河牌全阶段，AI 实时给出「该跟注、加注还是弃牌」的可理解建议
- **专业级胜率引擎**：基于 Monte Carlo 模拟的胜率计算，结合 EHS（赢率×胜率）帮你理解期望价值
- **多风格 AI 对手**：9 种人格（TAG、LAG、GTO、Maniac、Nit、Shark…）模拟真实牌桌，练就应对不同玩家的能力
- **零依赖、纯前端**：不依赖 Node、不依赖框架，一个文件夹 + 本地服务器即可运行

---

## 核心亮点

| 能力 | 说明 |
|------|------|
| **🔄 全街 AI 教练** | 从翻前到河牌，每一街都有实时胜率、EHS 与自然语言策略建议，像身边坐了一位高手在帮你读牌 |
| **📊 专业级牌局复盘** | 每手牌结束后，用 Pot Odds、Fold Equity、EV、SPR 等术语为你的每条决策打分，快速发现漏洞 |
| **🎭 9 种 AI 人格** | TAG、LAG、Tight/Loose Passive、GTO、Maniac、Nit、Shark、Fish，模拟真实牌桌的多样风格 |
| **👥 2–8 人灵活桌** | 从单挑到满桌，可调人数与智能座位布局，随时练不同人数下的策略 |
| **🎵 沉浸体验** | 发牌、下注、弃牌、获胜均有合成音效；Dark Glassmorphism 界面，手机也能畅玩 |
| **♾️ 无淘汰机制** | 筹码可为负、对局不中断，专注练牌与学习，不必担心被清空离桌 |

---

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript，零依赖、无构建
- **AI 胜率引擎**：Monte Carlo 模拟 + EHS 计算，在 Web Worker 中异步跑，不卡界面
- **音效**：Web Audio API 合成，无需外部音频文件

---

## 快速开始

在**包含 `index.html` 的本项目目录**下启动本地服务：

```bash
cd AI4POKER
python3 -m http.server 8080
```

浏览器打开 **http://localhost:8080**。

> 若打不开：请确认终端当前目录里能看到 `index.html` 和 `js` 文件夹再执行上面命令；若 8080 被占用，可改用 `python3 -m http.server 8000`，然后访问 http://localhost:8000。

---

## 项目结构

```
AI4POKER/
├── index.html          # 主入口（首页 / 设置 / 对局）
├── style.css           # Dark Glassmorphism 主题
├── js/
│   ├── game.js         # 核心：牌型评估、Monte Carlo、EHS、AI 决策与建议
│   ├── app.js          # UI 渲染、动画、事件与 Worker 调用
│   ├── mcWorker.js     # 异步 Monte Carlo 胜率
│   ├── seatPositions.js # 2–8 人座位布局
│   └── sounds.js       # 音效合成
└── README.md
```

---

## License

MIT
