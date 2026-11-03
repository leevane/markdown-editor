# 发布流程与提交规范

本仓库有两条线：**Git 记录代码历史，npm 记录对外版本**。两条线靠一条规则对齐：

> 一次发版 = 一个 `release` 提交 + 一个 tag + 一个 npm 版本，三者版本号相同。

npm 的版本号一旦发出就无法覆盖、也无法复用（撤销后该号码永久作废），所以顺序必须是**先提交、后发布**。

---

## 一、什么时候做什么

| 你做的事 | 提交 git | 发 npm |
|---|---|---|
| 改组件代码、样式、类型 | 立即提交，可以拆成多个小提交 | 暂不发，攒到一次功能完整时发 |
| 修 bug（使用者受影响） | 立即提交 | 发 `PATCH` |
| 只改 README、注释、CHANGELOG | 提交 | 不发，等下次发版自然带上 |
| 新增 prop / 事件 / 方法 | 提交 | 发 `MINOR` |
| 删除或修改已有 API、改默认行为 | 提交 | 发 `MAJOR` |
| 改构建配置、依赖版本 | 提交 | 视产物是否变化而定，通常随下次发版 |

原则：**git 是流水账，npm 是里程碑**。不要每改一行就发一次 npm，也不要把几个不相关的功能攒成一个大版本——发出去的版本是对使用者的承诺，粒度越清晰，CHANGELOG 越有用。

---

## 二、日常提交（不发布）

```bash
git add -A
git commit -m "fix: 修正 Safari 下全屏按钮换行"
git push origin main
```

提交信息前缀，与本仓库已有历史保持一致：

| 前缀 | 用于 |
|---|---|
| `feat` | 新增能力 |
| `fix` | 修复缺陷 |
| `docs` | 文档、注释 |
| `refactor` | 重构，不改变对外行为 |
| `chore` | 构建配置、依赖、换行符等杂项 |
| `release` | 发版提交，见下一节 |

---

## 三、发版流程（六步，按顺序执行）

### 第 1 步：判断版本号

| 变化 | 版本位 | 例子 |
|---|---|---|
| 只修 bug、只改文档或元信息，API 不变 | PATCH | `1.0.1` → `1.0.2` |
| 新增 prop / 事件 / 方法，旧代码不用改 | MINOR | `1.0.1` → `1.1.0` |
| 删除或重命名已有 API、改默认值导致行为变化、提升 peer 依赖大版本 | MAJOR | `1.0.1` → `2.0.0` |

判断口诀：**老代码装上就报错 → MAJOR；老代码能跑但用不上新东西 → MINOR；只有内部变化 → PATCH。**

### 第 2 步：改版本号，同时写 CHANGELOG

```bash
npm version patch --no-git-tag-version
```

`--no-git-tag-version` 必须带，否则 npm 会自动提交并打 tag，打乱后面的提交结构。

接着手动在 `CHANGELOG.md` 顶部补一条（`npm version` **不会**替你写）：

```markdown
## [1.0.2] - 2026-11-05

### 修复

- 全屏状态下切换预览模式，工具栏宽度未重新计算。
```

三条要求：

1. **首条版本号必须与 `package.json` 一致**，否则下一步校验直接拦截；
2. 日期写实际发版日；
3. 只记使用者能感知的变化，不记「调整了变量名」这类内部改动。

### 第 3 步：本地自检（在包目录执行）

```bash
npm run typecheck      # 期望 0 错
npm test               # 期望 82 项通过
npm run check:publish  # 期望 8 项通过
```

改过源码、构建配置或依赖时，回到示例工程根再跑一次完整验收：

```bash
npm run verify         # 八步：typecheck / unit / pure / ssr / build:lib / consumer / publish / build:demo
```

`consumer` 那一步会用 `npm pack` 出的 tarball 装进空工程再 import，能提前发现「本地自引用、发出去却缺文件」的问题。

### 第 4 步：提交 + 打 tag + 推送（**先 git，后 npm**）

```bash
git add -A
git commit -m "release: 1.0.2"
git tag -a v1.0.2 -m "v1.0.2"
git push origin main
git push origin v1.0.2
```

顺序不能颠倒。npm 上的 tarball 是从工作区构建的，只有 git 提交能回答「这个版本对应哪份代码」；万一发错，靠 tag 才能精确回滚。

### 第 5 步：发布

```bash
npm publish
```

`prepublishOnly` 会自动重新构建（vite + vue-tsc + postbuild 四条产物断言）再跑一遍 8 项校验，任一项失败即中止，坏包传不上去。

成功回执：

```
+ @leevane/markdown-editor@1.0.2
```

### 第 6 步：验证（一分钟内完成）

```bash
npm view @leevane/markdown-editor version         # 期望新版本号
npm view @leevane/markdown-editor dist-tags       # latest 指向新版本
```

浏览器再看三处：

- 包页 README 正文正常渲染；
- 顶部示意图能显示（`unpkg.com/@leevane/markdown-editor@<新版本>/docs/preview.png`）；
- 右侧 Repository / Homepage / Issues 指向 `github.com/leevane/markdown-editor`。

若 `npm view` 仍是旧版本，说明这一版进了暂存队列：打开
`https://www.npmjs.com/settings/leevane/staged` → 点 **Approve** → 指纹确认。
（`1.0.0` 走的是这套流程；`1.0.1` 起实测发布后自动生效，通常不需要手工批准。）

---

## 四、认证（首次使用，或换了机器）

```bash
npm logout
npm login --auth-type=web
npm whoami          # 必须返回 jw_lee
```

`--auth-type=web` 不是可选项。本账号 2FA 用的是 **passkey（Windows Hello）**，没有 6 位 TOTP，
npm 只能通过浏览器指纹完成验证。漏掉这一步、或 `.npmrc` 里残留旧 token，`npm publish` 会报
`EOTP`：

> This operation requires a one-time password from your authenticator.

处理：`npm logout` 清掉旧 token → `npm login --auth-type=web` 重新走浏览器授权 → **等 30 秒**
让认证状态传播 → 再 `npm publish`。

---

## 五、失败对照表

| 报错 / 现象 | 原因 | 处理 |
|---|---|---|
| `EOTP` | 走了 TOTP 分支，或登录态未传播 | 见上一节，重新登录后等 30 秒重试 |
| `CHANGELOG 首条版本是 x，package.json 是 y` | 改了 `version` 没补 CHANGELOG | 补顶部条目，两处对齐 |
| `README 图片 URL 的版本是 x，package.json 是 y` | 升版后配图地址没跟着改 | 改 README 里 unpkg URL 的版本号 |
| `402 Payment Required` | scoped 包没声明公开 | 确认 `publishConfig.access` 为 `public` |
| `403 Forbidden` / `Scope not found` | 发布账号不是组织成员 | `npm org ls leevane` 应能看到自己 |
| `409 Conflict` | 该版本号已存在，不可复用 | 升 PATCH 重新发，不能覆盖 |
| 登录正常却返回 `404` | npm 对权限问题常返回误导性 404 | 查 `npm whoami` 与组织成员关系 |
| 包页配图 404 | unpkg URL 指向尚未发布的版本 | 发布完成后自动恢复，或核对 URL 版本号 |

---

## 六、不要做的事

- **不要手改 `dist/`**。它由 `npm run build` 生成，下次构建即被覆盖，也不入库。
- **不要先 `npm publish` 再提交 git**。发出去的版本会找不到对应的代码快照。
- **不要重发同一个版本号**。npm 不允许覆盖，只能升版本。
- **不要把 token 写进 `.npmrc` 或提交进仓库**。用完即在网页上撤销。
- **不要在 CHANGELOG 里写流水账**。它是给使用者读的，不是开发日志。
- **不要跳过第 3 步**。`prepublishOnly` 只覆盖构建与打包相关内容，跑不了 SSR 与消费端安装验证。
