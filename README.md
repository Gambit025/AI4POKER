# AI4POKER

德州扑克新手练习，React + TypeScript 版。

在线地址：https://ai4poker.pages.dev/

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

正式网站由 Cloudflare Pages 自动发布：main 分支、根目录 react-app、构建命令 npm run build、输出 dist。更新 react-app/ 源码后提交推送即可触发构建。根目录静态文件保留用于历史 GitHub Pages 版本。

规则边界和模型限制见 [RULES.md](react-app/RULES.md)。
