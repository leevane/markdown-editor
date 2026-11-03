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
npm run check:publish  # 期望 8 项通过（明细见附录 A）
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
npm publish --//registry.npmjs.org/:_authToken=npm_你的token
```

token 的获取见第四节，**内联传参、不写进 `.npmrc`**。

`prepublishOnly` 会自动重新构建（vite + vue-tsc + postbuild 四条产物断言）再跑一遍 8 项校验，任一项失败即中止，坏包传不上去。

成功回执：

```
+ @leevane/markdown-editor@x.y.z
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

## 四、认证：用带 bypass 2FA 的 granular access token

发布固定用这一条：

```bash
npm publish --//registry.npmjs.org/:_authToken=npm_你的token
```

**为什么不用 `npm login`。** 本账号 2FA 是 **passkey（Windows Hello）**，没有 6 位 TOTP。npm 的写操作
要求一次性口令，而 passkey 只能在浏览器里确认——非交互终端（脚本、CI、自动化）拿不到结果，
`npm publish` 会直接报 `EOTP`。`--auth-type=web` 只在有交互终端的机器上才起作用。

**每次发版前生成一枚短期 token：**

1. 打开 `https://www.npmjs.com/settings/jw_lee/tokens` → **Generate New Token** → **Granular Access Token**
2. Permissions 选 **Read and write**
3. Expiration 选 **7 days**
4. Organizations 选 `leevane` 为 **Read and write**（发布组织包所需的权限在这里，不在 Packages 那栏）
5. 滚到页面底部勾选 **Bypass 2FA**（不勾就会被 403 拦下）
6. **Generate Token**，复制 `npm_` 开头的字符串——只显示一次

**收尾三步（必做）：**

- 发布成功后立刻回 token 页面 **Revoke**；
- 终端执行 `history -c`，清掉带 token 的命令历史；
- token 不要写进 `.npmrc`、不要提交进仓库、不要贴进聊天记录。

**冲突处理。** 如果 `~/.npmrc` 里还留着旧的 `//registry.npmjs.org/:_authToken`，先 `npm logout`
清掉再发布，避免它与内联 token 相互覆盖。

> **时效提醒**：npm 已宣布「granular token 直发」通道于 2027 年 1 月关闭。届时要改用
> stage-only + 网页批准，或 Trusted Publishing（GitHub Actions + OIDC）。本流程届时需更新。

---

## 五、失败对照表

| 报错 / 现象 | 原因 | 处理 |
|---|---|---|
| `EOTP` | 发布时没内联 token，或 `.npmrc` 残留旧 token 让 npm 走了 TOTP 分支 | 用 `--//registry.npmjs.org/:_authToken=npm_xxx` 传入带 bypass 2FA 的 token |
| `403 ... a granular access token with bypass 2fa enabled is required` | token 没勾 Bypass 2FA | 重新生成，勾选 Bypass 2FA |
| `CHANGELOG 首条版本是 x，package.json 是 y` | 改了 `version` 没补 CHANGELOG | 补顶部条目，两处对齐 |
| `README 图片 URL 的版本是 x，package.json 是 y` | 升版后配图地址没跟着改 | 改 README 里 unpkg URL 的版本号 |
| `402 Payment Required` | scoped 包没声明公开 | 确认 `publishConfig.access` 为 `public` |
| `403 Forbidden` / `Scope not found` | 发布账号不是组织成员 | `npm org ls leevane` 应能看到自己 |
| `409 Conflict` | 该版本号已存在，不可复用 | 升 PATCH 重新发，不能覆盖 |
| 登录正常却返回 `404` | npm 对权限问题常返回误导性 404 | 检查 token 的组织权限与 `npm org ls leevane` 成员关系 |
| 包页配图 404 | unpkg URL 指向尚未发布的版本 | 发布完成后自动恢复，或核对 URL 版本号 |

---

## 六、不要做的事

- **不要手改 `dist/`**。它由 `npm run build` 生成，下次构建即被覆盖，也不入库。
- **不要先 `npm publish` 再提交 git**。发出去的版本会找不到对应的代码快照。
- **不要重发同一个版本号**。npm 不允许覆盖，只能升版本。
- **不要把 token 写进 `.npmrc` 或提交进仓库**。用 `--//registry.npmjs.org/:_authToken=` 内联传入，
  发完 `history -c`，并在网页上 Revoke。
- **不要在 CHANGELOG 里写流水账**。它是给使用者读的，不是开发日志。
- **不要跳过第 3 步**。`prepublishOnly` 只覆盖构建与打包相关内容，跑不了 SSR 与消费端安装验证。

---

## 附录 A：`check:publish` 的 8 项校验

由 `scripts/check-publish.mjs` 执行，`prepublishOnly` 会自动调用，也可以单独跑。

| # | 校验 | 拦截的典型事故 |
|---|---|---|
| 1 | 版本号与 `CHANGELOG.md` 首条一致 | 发出去的版本在变更记录里查不到 |
| 2 | `exports` / `main` / `types` 指向的文件存在且非空 | 路径写错，安装后才报找不到模块 |
| 3 | `files` 覆盖 `dist`、`CHANGELOG.md`、`docs` | tarball 漏产物或漏配图 |
| 4 | 依赖无 `file:` / `link:` / `workspace:` | 装包方拿到空壳 |
| 5 | `marked` / `dompurify` / `turndown` 已在 `dependencies` 声明 | 产物是 external 的，使用方装不上就跑不起来 |
| 6 | README 非空 | npm 页面没有文档 |
| 7 | README 图片为绝对 https 地址、URL 版本号与 `package.json` 一致、源文件存在 | 包页配图 404，或升版后图仍指向旧版本 |
| 8 | `repository` / `homepage` / `bugs` 齐全、均为 https、且与仓库路径一致 | 包页缺少仓库与 Issue 入口，或改名后链接指向不存在的仓库 |

本包为 scoped 包，`publishConfig.access` 已设为 `public`，无需额外传 `--access public`。

---

## 附录 B：首次发布前的准备（一次性）

| # | 事项 | 做法 |
|---|---|---|
| 1 | npm 账号 + 2FA | 已启用 passkey 两步验证（Windows Hello）。发布不走 OTP 流程，改用带 bypass 2FA 的 granular token |
| 2 | 发布凭据 | 每次发版前生成一枚 7 天期、勾选 Bypass 2FA 的 token，内联传给 `npm publish`，用完撤销（见第四节） |
| 3 | 包名是否可用 | `npm view @leevane/markdown-editor version`，返回 404 才是可用 |
| 4 | 作用域归属 | `@leevane` 是 npm 组织，发布账号必须是成员：`npm org ls leevane` 能看到自己才可发布 |
| 5 | 仓库地址 | `repository` / `homepage` / `bugs` 三项写入 `package.json`；包页右侧 Repository、Homepage、Issues 入口全部由这三项生成 |

---

## 附录 C：暂存队列与包页配图

### 暂存发布（staged publishing）

npm 对命令行 / token 发起的发布**可能**先进暂存队列，人工确认后才对外开放。本包 `1.0.0`
遇到的就是这种情况；`1.0.1`、`1.0.2` 用 bypass token 发布均直接生效，未进队列。

| 步骤 | 现象 |
|---|---|
| 1. `npm publish --//registry.npmjs.org/:_authToken=npm_xxx` | 返回 `+ @leevane/markdown-editor@x.y.z` |
| 2. 查 registry | `npm view <包名> version` 返回 `0.0.0-stage`，新版本仍 404 |
| 3. 批准 | npmjs.com → **Packages → Staged Packages** → **Approve**，过 2FA |
| 4. 生效 | `latest` 指向新版本，tarball 与配图立即可取 |

几个容易误判的点：

- **`0.0.0-stage` 不是发错版本**。它是 npm 自动创建的占位包，描述为
  `Temporary package placeholder for staged publishing`。该占位会一直留在版本列表里，不影响 `latest`。
- **暂存队列按 owner 分开**。组织包要在组织维度看：`npmjs.com/settings/leevane/staged`，
  个人账号的 Staged Packages 页面里看不到组织包。
- **真进了队列时，approve 必须在浏览器里做**。2FA 闸门在批准环节，CLI 的 bypass token 无法代替。

### 包页配图为什么用 unpkg 绝对地址

示意图存放在 `docs/preview.png`，随包一起发布（`files` 里含 `docs`），README 首行用绝对地址引用：

```
https://unpkg.com/@leevane/markdown-editor@<版本号>/docs/preview.png
```

- **必须绝对地址**。npm 从 tarball 渲染 README，脱离仓库上下文，`./docs/preview.png`
  这类相对路径在包页上必然 404（在 GitHub 上却正常，所以本地很难发现）。
- **用 unpkg 而非 GitHub raw**。部分网络访问 `raw.githubusercontent.com` 与 `cdn.jsdelivr.net`
  会失败，unpkg 直接读 npm 包内容，发布后立即可用。
- **升版必须同步 URL 里的版本号**，由附录 A 第 7 项把关。
- 改用 raw 地址可从 `files` 移除 `docs`，tarball 小约 170 kB，代价是包页配图依赖 GitHub 可用性。
  当前选择「图随包走」，包页与 tarball 内容一致。

### 文档放哪里

| 文件 | 面向 | 是否进 tarball |
|---|---|---|
| `README.md` | 使用方：安装、Props、事件、方法、限制 | ✅ 进，npm 包页正文 |
| `CHANGELOG.md` | 使用方：版本变化 | ✅ 进 |
| `PUBLISHING.md` | 维护者：发布与提交流程 | ❌ 不进，只在仓库里看 |
| `docs/preview.png` | 使用方：包页配图 | ✅ 进 |
