# AI4POKER

德州扑克新手练习，React + TypeScript 版。

在线地址：https://gambit025.github.io/AI4POKER/

支持 2–8 人虚拟筹码练习、新手第一局、行为范围教练、决策复盘、全下/边池、音效和手机布局。教练为启发式范围建议，未经求解器校准。

## 开发

源代码在 `react-app/`，根目录的 `index.html` 和 `assets/` 是 GitHub Pages 发布产物。旧版 `js/` 与 `style.css` 暂时保留，当前入口使用 React。

```sh
cd react-app
npm ci
npm run dev
npm test
npm run build:pages
```

发布时，将 `react-app/dist/` 的内容复制到仓库根目录并提交至 `main`。已有 GitHub Pages 配置从 `main` 根目录发布，网址保持不变。

规则边界和模型限制见 [RULES.md](react-app/RULES.md)。
