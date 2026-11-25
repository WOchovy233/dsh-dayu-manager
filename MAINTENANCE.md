# 大鱼管家维护手册

给接手的 agent：这是一个已安装并正在运行的 DSH 插件。先读完本文件再动手。

> **发布规则（必须遵守）**：改完插件后不要自己发布，不要调用 GitHub API，不要使用用户保存的 Token。  
> 保留 `publish-now.cmd`，让用户自己双击发布，并等待用户明确确认发布完成。  
> Agent 最多只运行 `publish-now.ps1 -DryRun`；不要为了验证而真实上传。

## 1. 它是什么

左侧栏「大鱼管家」：精选 GitHub 上的 DSH 相关插件，用右侧安装决策面板展示功能、外部网络、本地写入、子进程、依赖与维护状态。支持本地静态体检、可选 AI 解读和一键安装。

- 包目录：`<repo-root>`
- 实际 profile 链接：`%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-github-discover` 指向包目录
- 包名：`dsh-github-discover`（技术 id 保留，避免破坏已安装 profile）
- Loader 行 id：`include:github-discover`
- 当前 profile：`desktop`
- 对外产品名：`大鱼管家` / `Dayu Manager`

## 2. 文件地图

| 文件 | 职责 |
|---|---|
| `index.js` | Host 半边。HTTP 路由 `/api/dsh-github-discover/*`：`list`、`installed`、`inspect`、`install`、`audit`、`interpret`、`all`、`search`、`version`、`update`。含内存 + 磁盘缓存、限流处理、按需 AI 解读与按需更新检查。 |
| `audit.js` | 体检引擎：下载 codeload 归档 → gunzip + tar 解析 → 静态扫描（模型端点、登录、写文件、子进程、混淆、fork、npm 同名包）→ 输出结构化事实与检查项。不依赖 GitHub API 额度。 |
| `client.js` | 浏览器半边的全部 UI：字典、CSS、精选列表、分类、搜索、右侧决策面板、体检展示、AI 解读、安装确认、版本按钮。 |
| `locale/zh.json`、`locale/en.json` | 「插件」页显示的标题与描述（`meta.detail` 指向 `docs/DETAIL.md`）。 |
| `docs/DETAIL.md`、`docs/preview.png` | 详情页说明与界面预览。 |
| `README.md`、`LICENSE` | GitHub 首页与 MIT 许可证。 |
| `RELEASE_NOTES.md` | 发布脚本读取的版本说明。 |
| `publish-now.cmd`、`publish-now.ps1` | 一键发布到 GitHub：上传文件、创建 tag 与 release。 |

## 3. 数据流与缓存

- 初次打开面板时，Host 并行检索 utility（1 次搜索）与 game（2 次搜索）两列，结果合并后由前端评分分类。
- 三层缓存：内存 `cache` / `allCache` → `%TEMP%\dsh-github-discover-cache.json` → stale-while-revalidate。
- 星数快照：`%TEMP%\dsh-github-discover-stars.json`。
- 体检结果：进程内 `audits`，6 小时或仓库 push 变化后重扫。
- AI 解读：进程内 `interpretations`，按仓库 + 体检时间 + 语言缓存，最多 80 条。
- 限流：未登录 GitHub 搜索约 10 次/分钟；核心 API 60 次/小时。撞限流后短期短路匿名搜索，并把 `rateLimited + resetAt` 返回前端。刷新按钮使用缓存优先模式，不强制消耗额度；界面有旧数据时只显示轻量限流提示。
- 版本与更新：`/version` 只读本地 `package.json`，不联网；`/update` 只在用户点击顶部版本按钮时请求最新版本，不做轮询、不在打开面板时检查。
- `/update` 的源顺序：GitHub API 与 jsDelivr 并行竞速，失败后回退到 GitHub Release 跳转、Fastly jsDelivr、raw.githubusercontent、githack。Token 只发给 `api.github.com`，绝不发给镜像站点。
- 版本号有三处：`package.json`、`index.js` 的 `PLUGIN_VERSION`、`client.js` 的 `CLIENT_VERSION`。DSH loader 的入口 URL 可能不在包目录，后两者是兜底；发布脚本会校验三处一致，改版本时三处一起改。
- 打开面板不体检、不调用模型。只有用户点击才发生源码下载或模型请求。

## 4. 改动的标准流程

1. 改文件。UI 只改 `client.js`；Host 逻辑改 `index.js` / `audit.js`。
2. 语法检查：
   ```powershell
   $node='%DSH_NODE%'
   & $node --check <repo-root>/index.js
   & $node --check <repo-root>/audit.js
   & $node --check <repo-root>/client.js
   ```
3. 让改动生效：
   - **Host 改动**（`index.js` / `audit.js`）：必须重载插件行，否则仍旧代码。
   - **界面改动**（`client.js`）：页面 `Ctrl+R`。
   - `locale/*.json`：只影响「插件」页展示，无需重载。
4. 验证见第 6 节。

## 5. 设计决策

- **品牌蓝固定为 `#3d6ff2`**：DSH 浅色主题的 `--dsw-alias-brand-primary` 实际是黑色，直接继承会让面板变成黑白；大鱼管家保留自己的蓝色品牌。
- **分类是评分式启发**：`categorize()` 对 name/topics/description 加权评分，先清掉 dsh/deepseek/harness/plugin 这类通用词，再比较 model/ui/make/dev 得分。不要退回单条正则顺序，否则几乎所有仓库都会被 `deepseek` 吸进模型类。
- **右侧决策面板**：选中卡片后原地查看，不离开列表，不打开新页面。
- **不自动体检**：打开面板零下载、零模型调用。用户点「开始本地体检」才扫描。
- **不用红黄绿灯做安全承诺**：显示真实能力和检查明细，使用「30 秒结论」表达。
- **本地优先**：体检完全本地，0 Token；AI 解读是独立、可选的第二步。
- **AI 只发事实**：`/interpret` 只发送结构化体检事实，不发送插件源码；必须由用户主动点击。
- **安装走 tarball 归档**：用户机器没有 Git，`pluginManager.installBundle` 使用 GitHub archive tar.gz。
- **体检从归档读 package.json**：不再依赖 GitHub contents API，避免额度耗尽后误判。
- **技术包名保持 `dsh-github-discover`**：产品已改名，但内部 id 不变，避免已安装 profile 断链。

## 6. 验证清单

```powershell
# 1) 语法
$node='%DSH_NODE%'
& $node --check <repo-root>/index.js
& $node --check <repo-root>/audit.js
& $node --check <repo-root>/client.js

# 2) 发布脚本 dry-run
powershell -NoProfile -ExecutionPolicy Bypass -File <repo-root>/publish-now.ps1 -DryRun
```

运行时验证：

- 「大鱼管家」出现在左侧栏。
- 打开面板不产生 codeload 下载。
- 点卡片后右侧显示详情；点「开始本地体检」才发起扫描。
- 体检后 30 秒结论、四项指标与检查明细正常显示。
- 「AI 解读」按钮在体检后可用；未配置模型时给出清晰错误。
- 安装按钮先核对 package.json，再显示确认栏。
- 搜索无结果、GitHub 限流、体检失败时都有可读提示。

## 7. 已知坑

- **codeload 大仓库可能很慢**：首次体检可能需要等待归档下载。后续优化方向是只抓 `index.js` / `client.js` / `package.json`。
- **GitHub 搜索质量不稳**：`isDshRelated()` 过滤名字碰瓷项目，别删。
- **端口每次重启都会变**：命令行验证不要写死 GUI URL。
- **AI 依赖当前默认模型**：`agentDefaultModel.currentSelection()` 必须有 provider/model；自定义中转不可用时，解读会失败但本地体检不受影响。
- **每次发布都手动粘贴 Token**：Token 只在当前 PowerShell 进程内存中使用，不写盘、不读取旧凭证。旧版 `%USERPROFILE%\.dsh-dayu-manager.cred` 已废弃，建议删除。
- **发布 Token 必须有写权限**：classic PAT 勾选 `repo`；fine-grained 选本仓库并给 `Contents: Read and write`。脚本会在第一次写 blob 前用 `GET /repos` 的 `permissions.push` 预检，写入 401/403 会附带权限提示。
- **Token 只有读权限时**：`/user` 可能成功，但 `POST /git/blobs` 会 401。看到这种错误先检查 Token 的 writable 权限，不是脚本问题。

## 8. 发布

```powershell
# 每次：双击 publish-now.cmd，按提示粘贴 token（输入隐藏，不保存）
# 然后脚本更新代码、tag 和 release
```

发布脚本会：

1. 读取 `package.json` 的版本号。
2. 创建或更新 `WOchovy233/dsh-dayu-manager`。
3. 上传变更文件。
4. 创建 `v1.0.0` 形式的 tag。
5. 创建或更新 GitHub Release。
6. 更新仓库 topics。

## 9. 待办候选

- 体检只抓 3 个关键文件，缩短大仓库等待时间。
- 冷启动检索已降到 3 次（utility 1 + game 2）。
- 分类标签准确率微调（改 `CATEGORY_RULES` 的权重）。
- 体检结果落盘。
- 已安装插件升级检查和管理入口。