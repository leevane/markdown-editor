// 文件：packages/markdown-editor/scripts/check-publish.mjs
// 发布前校验：只查「发出去会出事」的项，不重复构建期已经做过的产物断言。
//
// 由 package.json 的 prepublishOnly 调用（先 build 再走这里），
// 也可以手动 `node scripts/check-publish.mjs` 随时自查。
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const problems = []
const ok = (msg) => console.log(`  ✓ ${msg}`)
const bad = (msg) => problems.push(msg)

// 1) 版本号与 CHANGELOG 首条一致——否则发出去的版本在变更记录里查不到
const clPath = join(root, 'CHANGELOG.md')
if (!existsSync(clPath)) {
  bad('缺少 CHANGELOG.md')
} else {
  const first = readFileSync(clPath, 'utf8').match(/^##\s*\[?([0-9][^\s\]]*)/m)
  if (!first) bad('CHANGELOG.md 里没有 `## [x.y.z]` 形式的版本标题')
  else if (first[1] !== pkg.version) bad(`CHANGELOG 首条是 ${first[1]}，package.json 是 ${pkg.version}`)
  else ok(`版本与 CHANGELOG 一致：${pkg.version}`)
}

// 2) exports / main / types 指向的文件真实存在（写错路径是发出去才发现的典型事故）
const targets = new Set()
for (const v of Object.values(pkg.exports || {})) {
  if (typeof v === 'string') targets.add(v)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) if (typeof x === 'string') targets.add(x)
}
for (const f of [pkg.main, pkg.module, pkg.types].filter(Boolean)) targets.add(f)
let exportChecked = 0
for (const rel of targets) {
  if (rel === './package.json') continue
  const p = join(root, rel)
  if (!existsSync(p) || statSync(p).size === 0) bad(`exports 指向的 ${rel} 不存在或为空`)
  else exportChecked += 1
}
if (!targets.size) bad('package.json 没有 exports / main')
else if (exportChecked) ok(`exports 的 ${exportChecked} 个出口均存在`)

// 3) files 必须覆盖产物目录，否则 dist 不会进 tarball
const files = pkg.files || []
if (!files.includes('dist')) bad('files 里没有 dist，npm 打包会漏掉产物')
else if (!files.includes('CHANGELOG.md')) bad('files 里没有 CHANGELOG.md')
else ok(`files 覆盖产物：${files.join(' / ')}`)

// 4) 依赖不能有本地路径（file: / link: / workspace:），否则装包方拿到的是空壳
const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies }
let localDeps = 0
for (const [k, v] of Object.entries(allDeps)) {
  if (/^(file|link|workspace):/.test(String(v))) {
    bad(`依赖 ${k} 指向本地路径（${v}）`)
    localDeps += 1
  }
}
if (!localDeps) ok(`依赖均为版本号（${Object.keys(allDeps).length} 项，无本地路径）`)

// 5) 第三方库必须在依赖里声明。产物是 external 的，装包方自己装这些库才能跑
const js = readFileSync(join(root, 'dist/index.js'), 'utf8')
for (const dep of ['marked', 'dompurify', 'turndown']) {
  if (!pkg.dependencies?.[dep]) bad(`${dep} 出现在产物里，但 package.json 没声明为 dependencies`)
}
ok('外部依赖均已声明')

// 6) README 是 npm 页面的正文，空文件等于没有文档
const readme = join(root, 'README.md')
if (!existsSync(readme) || statSync(readme).size < 1024) bad('README.md 缺失或过短')
else ok(`README ${(statSync(readme).size / 1024).toFixed(1)}kB`)

// 7) README 的图片：npm 在 tarball 里渲染 README，脱离仓库上下文，相对路径必然 404。
//    指向本包 CDN 的图还要能对应到本地真实文件——路径写错或没进 files 都是发布后才发现。
const readmeText = readFileSync(readme, 'utf8')
// 先剥掉围栏代码块与行内代码：正文里演示 `![x](uploading:u1)` 这类写法不该被当成真图片
const prose = readmeText.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
const imgs = [
  ...[...prose.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]),
  ...[...prose.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]),
]
const relativeImgs = imgs.filter((u) => !/^https:\/\//.test(u))
if (relativeImgs.length) {
  bad(`README 图片必须是绝对 https 地址（npm 页面解析不了相对路径）：${relativeImgs.join(' / ')}`)
} else if (imgs.length) {
  const own = new RegExp(`/${pkg.name.replace(/[/@.]/g, '\\$&')}@([^/]+)/(.+)$`)
  let missing = 0
  for (const u of imgs) {
    const m = u.match(own)
    if (!m) continue
    // 版本号写死在 URL 里：升版后忘了改，图会一直指向旧版本（本地文件检查发现不了）
    if (m[1] !== pkg.version) {
      bad(`README 图片 URL 里的版本是 ${m[1]}，package.json 是 ${pkg.version}`)
      missing += 1
    }
    if (!existsSync(join(root, m[2]))) {
      bad(`README 图片指向本包，但本地没有这个文件：${m[2]}`)
      missing += 1
    }
  }
  if (!missing) ok(`README 图片 ${imgs.length} 张，均为绝对地址且源文件存在`)
}

// 8) 仓库元信息：npm 包页右侧的 Repository / Homepage / Issues 三个链接都读这里。
//    缺一个就少一个入口；三个地址指向不同仓库（改了 owner 或仓库名漏改）时，点过去是 404。
const repoUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
const repoBase = String(repoUrl || '')
  .replace(/^git\+/, '')
  .replace(/\.git$/, '')
  .replace(/\/+$/, '')
if (!repoUrl) bad('package.json 缺少 repository（npm 页面的仓库 / Issue 入口来自这里）')
else if (!/^https:\/\/[^/]+\/[^/]+\/[^/]+/.test(repoBase)) bad(`repository 不是可用的 https 地址：${repoUrl}`)
else {
  const links = { homepage: pkg.homepage, bugs: typeof pkg.bugs === 'string' ? pkg.bugs : pkg.bugs?.url }
  let metaProblems = 0
  const metaBad = (msg) => {
    bad(msg)
    metaProblems += 1
  }
  for (const [key, url] of Object.entries(links)) {
    if (!url) metaBad(`package.json 缺少 ${key}`)
    else if (!/^https:\/\//.test(url)) metaBad(`${key} 必须是绝对 https 地址：${url}`)
    // 指向 github.com 的链接必须落在同一个仓库路径下，否则就是改了仓库名漏改
    else if (/^https:\/\/github\.com\//.test(url) && !url.startsWith(repoBase)) metaBad(`${key} 与 repository 不一致：${url}`)
  }
  if (!metaProblems) ok(`仓库元信息齐全：${repoBase}`)
}

if (problems.length) {
  console.error('\n[check-publish] 发布前校验未通过：')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`\n[check-publish] ${pkg.name}@${pkg.version} 发布前校验通过`)
