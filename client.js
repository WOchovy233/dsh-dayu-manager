/**
 * Dayu Manager - browser half.
 *
 * A plugin discovery and installation-decision panel for DSH. The interface is
 * deliberately local-first: opening the panel never starts a model request or a
 * source download. A source audit starts only after the user asks for it, and
 * the optional model explanation is a separate, explicit action.
 */
window.__ModuleLoader__.load({
  id: 'dsh-github-discover',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'github.discover'
    const PANEL_ID = 'github-discover'
    const ENDPOINT = 'api/dsh-github-discover'
    const TOKEN_KEY = 'dsh-github-discover:token'
    const PAGE_SIZE = 6

    const ZH = {
      panel: '大鱼管家',
      title: '大鱼管家',
      eyebrow: 'DAYU MANAGER · PLUGIN TRUST CENTER',
      subtitle: '安装之前，先看清它能做什么、会动什么。',
      'action.refresh': '刷新',
      'action.refreshing': '刷新中…',
      'action.token': 'GitHub 令牌',
      'action.save': '保存',
      'action.dismiss': '关闭',
      'action.retry': '重试',
      'action.prev': '上一页',
      'action.next': '下一页',
      'action.github': '在 GitHub 打开',
      'search.placeholder': '搜索插件、作者或能力',
      'token.placeholder': '粘贴 GitHub 令牌（可选，只存本机）',
      'token.hint': '令牌只用于提高 GitHub 检索频率，不会上传到别处。',
      'ago.now': '刚刚',
      'ago.min': '{n} 分钟前',
      'ago.hour': '{n} 小时前',
      'ago.day': '{n} 天前',
      'section.picks': '精选插件',
      'section.results': '搜索结果',
      'section.hint': '按当前 DSH 版本与安装情况推荐',
      'section.count': '{n} 个',
      'hint.updating': '更新中…',
      'hint.searching': '检索中…',
      'cat.all': '全部',
      'cat.dev': '开发工具',
      'cat.model': '模型能力',
      'cat.ui': '界面美化',
      'cat.make': '内容创作',
      'cat.game': '游戏开发',
      'cat.other': '其他',
      'card.installed': '已安装',
      'card.available': '可安装',
      'card.viewing': '正在查看',
      'card.updated': '{ago}更新',
      'card.stars': '★ {n}',
      'empty.title': '没有找到匹配的插件',
      'empty.hint': '换个关键词，或刷新 GitHub 检索。',
      'error.title': '检索失败',
      'rate.hint': 'GitHub 检索频率已用完，请稍后重试或填写令牌。',
      'detail.badgeLocal': '本地体检 · 0 Token',
      'detail.badgeBundle': '社区插件',
      'detail.descriptionFallback': '这个仓库还没有填写简介。',
      'detail.auditTitle': '安装前先做一次本地体检',
      'detail.auditHint': '只读扫描源码，不运行插件，不消耗模型额度。',
      'detail.auditStart': '开始本地体检',
      'detail.auditAgain': '重新体检',
      'detail.auditing': '正在读源码并整理能力清单…',
      'detail.auditFailed': '体检没有完成',
      'detail.scanned': '扫了 {files} 个文件 / {kb} KB',
      'detail.summaryTitle': '30 秒结论',
      'detail.confirmTitle': '需要你确认',
      'detail.capabilities': '它能做什么',
      'detail.capabilityHint': '依据 README、package.json 与源码中的公开能力整理。',
      'detail.maintenance': '维护与兼容',
      'detail.updated': '{ago}更新',
      'detail.branch': '分支 {branch}',
      'detail.stars': '★ {n}',
      'detail.version': '版本 {version}',
      'detail.metric.network': '外部网络',
      'detail.metric.write': '本地写入',
      'detail.metric.exec': '子进程',
      'detail.metric.deps': '运行时依赖',
      'detail.metric.hosts': '{n} 个域名',
      'detail.metric.writes': '{n} 处',
      'detail.metric.none': '未发现',
      'detail.metric.count': '{n} 个',
      'detail.metric.unknown': '待体检',
      'detail.checksTitle': '体检明细',
      'detail.checksSummary': '查看 {n} 项检查',
      'detail.install': '安装插件',
      'detail.source': '查看源码',
      'detail.inspect': '正在核对安装包…',
      'detail.confirmInstall': '确认安装',
      'detail.cancel': '取消',
      'detail.installRisk': '插件来自第三方仓库，安装后与 DSH 拥有同等权限。请只安装你信任的项目。',
      'detail.bundleMissing': '这个仓库没有声明 DSH 插件清单，安装后大概率不会生效。',
      'detail.installSuccess': '已安装 {name}，回到对话即可使用。',
      'detail.installRestart': '已安装 {name}，重启 DSH 后生效。',
      'detail.installFailed': '安装失败：{message}',
      'detail.aiTitle': '可选的 AI 解读',
      'detail.aiHint': '用当前默认模型，把体检结果解释成一句人话。',
      'detail.aiNote': '仅点击时调用 · 使用你的模型额度 · 按体检版本缓存',
      'detail.aiButton': 'AI 解读',
      'detail.aiLoading': '正在生成…',
      'detail.aiUnavailable': '先完成本地体检后可用',
      'detail.aiError': 'AI 解读失败：{message}',
      'detail.aiBy': '由 {model} 生成',
      'detail.sourceNote': '静态体检只说明源码里发现了什么，不构成安全担保。',
      'summary.green': '没有发现需要特别警惕的行为，可以先试用；安装后仍建议观察它的实际行为。',
      'summary.caution': '功能比较明确，但会带来一些本机能力。安装前请确认这些能力是你需要的。',
      'summary.concern': '源码里有值得谨慎的信号，建议先看下面的体检明细，再决定是否安装。',
      'summary.unknown': '这次没有读到足够源码，无法给出可靠判断。',
      'chip.external': '访问外部域名',
      'chip.write': '写入本地文件',
      'chip.exec': '执行命令',
      'chip.credential': '需要登录或 Key',
      'chip.system': '写入系统位置',
      'chip.obfuscation': '动态执行/混淆',
      'chip.none': '未发现额外能力',
      'chip.tools': '注册 DSH 工具',
      'list.loading': '正在检索 GitHub…',
      'list.none': '这一列暂时没有结果',
      'footer.range': '显示 {from}–{to} / {total}',
    }

    const EN = {
      panel: 'Dayu Manager',
      title: 'Dayu Manager',
      eyebrow: 'DAYU MANAGER · PLUGIN TRUST CENTER',
      subtitle: 'Know what a plugin does and touches before you install it.',
      'action.refresh': 'Refresh',
      'action.refreshing': 'Refreshing…',
      'action.token': 'GitHub token',
      'action.save': 'Save',
      'action.dismiss': 'Dismiss',
      'action.retry': 'Retry',
      'action.prev': 'Prev',
      'action.next': 'Next',
      'action.github': 'Open on GitHub',
      'search.placeholder': 'Search plugins, authors or capabilities',
      'token.placeholder': 'Paste a GitHub token (optional, stored locally)',
      'token.hint': 'Only used to raise GitHub search limits; it is never uploaded elsewhere.',
      'ago.now': 'just now',
      'ago.min': '{n} min ago',
      'ago.hour': '{n} h ago',
      'ago.day': '{n} d ago',
      'section.picks': 'Editor picks',
      'section.results': 'Search results',
      'section.hint': 'Selected for the current DSH version and installed set',
      'section.count': '{n}',
      'hint.updating': 'Updating…',
      'hint.searching': 'Searching…',
      'cat.all': 'All',
      'cat.dev': 'Dev tools',
      'cat.model': 'Models',
      'cat.ui': 'Look & feel',
      'cat.make': 'Creation',
      'cat.game': 'Game dev',
      'cat.other': 'Other',
      'card.installed': 'Installed',
      'card.available': 'Installable',
      'card.viewing': 'Viewing',
      'card.updated': 'Updated {ago}',
      'card.stars': '★ {n}',
      'empty.title': 'No matching plugins',
      'empty.hint': 'Try another keyword or refresh the GitHub search.',
      'error.title': 'Search failed',
      'rate.hint': 'GitHub search limit reached. Try again later or add a token.',
      'detail.badgeLocal': 'Local audit · 0 Token',
      'detail.badgeBundle': 'Community plugin',
      'detail.descriptionFallback': 'This repository has no description yet.',
      'detail.auditTitle': 'Run a local audit before installing',
      'detail.auditHint': 'Read-only source scan. Nothing is executed and no model tokens are used.',
      'detail.auditStart': 'Run local audit',
      'detail.auditAgain': 'Audit again',
      'detail.auditing': 'Reading source and building the capability list…',
      'detail.auditFailed': 'Audit did not finish',
      'detail.scanned': 'Scanned {files} files / {kb} KB',
      'detail.summaryTitle': '30-second verdict',
      'detail.confirmTitle': 'What to confirm',
      'detail.capabilities': 'What it can do',
      'detail.capabilityHint': 'Derived from README, package.json and public source capabilities.',
      'detail.maintenance': 'Maintenance & compatibility',
      'detail.updated': 'Updated {ago}',
      'detail.branch': 'Branch {branch}',
      'detail.stars': '★ {n}',
      'detail.version': 'Version {version}',
      'detail.metric.network': 'External hosts',
      'detail.metric.write': 'Local writes',
      'detail.metric.exec': 'Processes',
      'detail.metric.deps': 'Runtime deps',
      'detail.metric.hosts': '{n} hosts',
      'detail.metric.writes': '{n}',
      'detail.metric.none': 'None found',
      'detail.metric.count': '{n}',
      'detail.metric.unknown': 'Audit first',
      'detail.checksTitle': 'Audit details',
      'detail.checksSummary': 'View {n} checks',
      'detail.install': 'Install plugin',
      'detail.source': 'View source',
      'detail.inspect': 'Checking the package…',
      'detail.confirmInstall': 'Confirm install',
      'detail.cancel': 'Cancel',
      'detail.installRisk': 'Third-party plugins run with the same authority as DSH. Install only projects you trust.',
      'detail.bundleMissing': 'This repository does not declare a DSH bundle and will most likely not work.',
      'detail.installSuccess': 'Installed {name}. It is ready for your next conversation.',
      'detail.installRestart': 'Installed {name}. Restart DSH to activate it.',
      'detail.installFailed': 'Install failed: {message}',
      'detail.aiTitle': 'Optional AI explanation',
      'detail.aiHint': 'Use the current default model to turn the audit into plain language.',
      'detail.aiNote': 'Runs only on click · uses your model quota · cached by audit version',
      'detail.aiButton': 'Explain with AI',
      'detail.aiLoading': 'Generating…',
      'detail.aiUnavailable': 'Available after a local audit',
      'detail.aiError': 'AI explanation failed: {message}',
      'detail.aiBy': 'Generated by {model}',
      'detail.sourceNote': 'A static audit only reports what was found in source; it is not a security guarantee.',
      'summary.green': 'Nothing especially risky surfaced. It is reasonable to try, while still watching what it does after installation.',
      'summary.caution': 'The purpose is fairly clear, but it carries local capabilities. Confirm those capabilities are what you want.',
      'summary.concern': 'The source contains signals worth checking. Read the audit details before installing.',
      'summary.unknown': 'Not enough source was available for a reliable verdict.',
      'chip.external': 'External hosts',
      'chip.write': 'Local writes',
      'chip.exec': 'Runs commands',
      'chip.credential': 'Login or key',
      'chip.system': 'System paths',
      'chip.obfuscation': 'Dynamic code',
      'chip.none': 'No extra capabilities found',
      'chip.tools': 'Registers DSH tools',
      'list.loading': 'Searching GitHub…',
      'list.none': 'Nothing in this column yet',
      'footer.range': 'Showing {from}–{to} / {total}',
    }

    function translate(dictionary) {
      return (key, variables) => {
        let text = dictionary[key] ?? key
        if (variables !== undefined && typeof variables === 'object') {
          for (const [name, value] of Object.entries(variables)) text = text.replaceAll(`{${name}}`, String(value))
        }
        return text
      }
    }
    const tz = translate(ZH)
    const te = translate(EN)

    function endpoint(path, params) {
      const url = new URL(`${ENDPOINT}/${path}`, document.baseURI)
      if (params !== undefined) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
        }
      }
      return url.toString()
    }

    function ago(t, iso) {
      const time = Date.parse(iso)
      if (!Number.isFinite(time)) return '—'
      const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000))
      if (minutes < 1) return t('ago.now')
      if (minutes < 60) return t('ago.min', { n: minutes })
      const hours = Math.round(minutes / 60)
      if (hours < 24) return t('ago.hour', { n: hours })
      const days = Math.round(hours / 24)
      if (days < 30) return t('ago.day', { n: days })
      return new Date(time).toLocaleDateString()
    }

    function normalizeName(value) {
      return String(value ?? '').toLowerCase().replace(/^@[^/]+\//, '').replace(/[^a-z0-9]+/g, '')
    }

    function categorize(item) {
      const text = `${item.name} ${item.topics.join(' ')} ${item.description}`.toLowerCase()
      if (/模型|model|llm|token|额度|provider|openai|claude|gemini|deepseek/.test(text)) return 'model'
      if (/界面|主题|皮肤|ui|theme|skin|layout|样式|外观/.test(text)) return 'ui'
      if (/创作|写作|绘画|图像|图片|音频|视频|音乐|翻译|markdown|canvas|image|video|audio|writing|design/.test(text)) return 'make'
      if (/工具|开发|终端|代码|调试|搜索|文件|记忆|数据库|api|cli|dev|tool|code|terminal|search|memory|database/.test(text)) return 'dev'
      return 'other'
    }

    function initials(name) {
      const value = String(name ?? '?').replace(/^dsh[-_]?/i, '')
      const ascii = value.match(/[A-Za-z0-9]+/g)
      return ascii === null ? value.slice(0, 1).toUpperCase() : ascii.slice(0, 2).map(part => part[0]).join('').toUpperCase()
    }

    function formatKb(bytes) {
      return Math.max(1, Math.round(Number(bytes ?? 0) / 1024))
    }

    function auditView(t, audit) {
      if (audit === null || audit === undefined) return null
      const facts = audit.facts ?? {}
      const packageFacts = facts.package ?? {}
      const endpoints = Array.isArray(facts.endpoints) ? facts.endpoints : []
      const external = endpoints.filter(entry => entry?.kind !== 'local')
      const writes = Number(facts.writeCount ?? 0)
      const execs = Array.isArray(facts.execSamples) ? facts.execSamples.length : 0
      const systemWrites = Array.isArray(facts.systemWrites) ? facts.systemWrites.length : 0
      const obfuscation = Array.isArray(facts.obfuscation) ? facts.obfuscation.length : 0
      const deps = Number(packageFacts.dependencyCount ?? 0)
      const chips = []
      if (systemWrites > 0) chips.push(t('chip.system'))
      if (facts.needsCredential === true) chips.push(t('chip.credential'))
      if (execs > 0) chips.push(t('chip.exec'))
      if (writes > 0) chips.push(t('chip.write'))
      if (external.length > 0) chips.push(t('chip.external'))
      if (obfuscation > 0) chips.push(t('chip.obfuscation'))
      if (facts.providesTools === true) chips.push(t('chip.tools'))
      if (chips.length === 0) chips.push(t('chip.none'))
      const tone = audit.verdict === 'red' ? 'concern' : audit.verdict === 'yellow' ? 'caution' : audit.verdict === 'green' ? 'green' : 'unknown'
      return {
        tone,
        summary: t(`summary.${tone}`),
        chips: chips.slice(0, 6),
        metrics: [
          { icon: 'globe', label: t('detail.metric.network'), value: external.length > 0 ? t('detail.metric.hosts', { n: external.length }) : t('detail.metric.none') },
          { icon: 'file', label: t('detail.metric.write'), value: writes > 0 ? t('detail.metric.writes', { n: writes }) : t('detail.metric.none') },
          { icon: 'terminal', label: t('detail.metric.exec'), value: execs > 0 ? t('detail.metric.count', { n: execs }) : t('detail.metric.none') },
          { icon: 'box', label: t('detail.metric.deps'), value: facts.package === null || facts.package === undefined ? '—' : t('detail.metric.count', { n: deps }) },
        ],
        checks: Array.isArray(audit.checks) ? audit.checks : [],
        scanned: t('detail.scanned', { files: Number(audit.scan?.files ?? 0), kb: formatKb(audit.scan?.bytes) }),
        packageFacts,
      }
    }

    function Icon(props) {
      const size = typeof props.size === 'number' ? props.size : 18
      const common = {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
        ...(props.style === undefined ? {} : { style: props.style }),
      }
      const p = (d, extra) => h('path', { d, ...extra })
      let children
      if (props.name === 'search') children = [h('circle', { cx: 10.5, cy: 10.5, r: 6.5 }), p('M15.4 15.4 21 21')]
      else if (props.name === 'refresh') children = [p('M20 7v5h-5'), p('M4 17v-5h5'), p('M6.1 9a7 7 0 0 1 11.3-2.2L20 12'), p('M4 12l2.6 5.2A7 7 0 0 0 17.9 15')]
      else if (props.name === 'spark') children = [h('path', { d: 'M12 2.8 13.7 8l5.2 1.7-5.2 1.7L12 16.6l-1.7-5.2L5.1 9.7 10.3 8 12 2.8Z', fill: 'currentColor', stroke: 'none' }), h('circle', { cx: 19, cy: 18, r: 1.4, fill: 'currentColor', stroke: 'none' })]
      else if (props.name === 'shield') children = [p('M12 2.5 20 5.7v5.4c0 4.7-3.3 8.3-8 10.4-4.7-2.1-8-5.7-8-10.4V5.7L12 2.5Z'), p('m8.2 12 2.5 2.5 5.2-5.2')]
      else if (props.name === 'globe') children = [h('circle', { cx: 12, cy: 12, r: 8.5 }), p('M3.8 12h16.4'), p('M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5S14.3 18.1 12 20.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z')]
      else if (props.name === 'file') children = [p('M6 3.5h7l5 5v12H6v-17Z'), p('M13 3.5v5h5'), p('M9 13h6M9 16.5h5')]
      else if (props.name === 'terminal') children = [h('rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }), p('m7 9 3 3-3 3'), p('M13 15h4')]
      else if (props.name === 'box') children = [p('m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z'), p('m4.3 7.7 7.7 4.4 7.7-4.4'), p('M12 12.1V21')]
      else if (props.name === 'check') children = [p('m5 12.5 4.4 4.4L19 7.4')]
      else if (props.name === 'alert') children = [p('M12 3 21 20H3L12 3Z'), p('M12 9v4.5'), h('circle', { cx: 12, cy: 17, r: 0.8, fill: 'currentColor', stroke: 'none' })]
      else if (props.name === 'github') children = [p('M9 19c-4.5 1.4-4.5-2.5-6-3m12 6v-3.8c0-1.1.1-1.6-.5-2.2 2.8-.3 5.7-1.4 5.7-6.2a4.8 4.8 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.9 2.9 5.9 3.2 5.9 3.2a4.4 4.4 0 0 0-.1 3.3A4.8 4.8 0 0 0 4.5 9.8c0 4.8 2.9 5.9 5.7 6.2-.5.5-.6 1.1-.5 2.2V22')]
      else if (props.name === 'chevron') children = [p('m9 5 7 7-7 7')]
      else if (props.name === 'x') children = [p('m6 6 12 12M18 6 6 18')]
      else if (props.name === 'lock') children = [h('rect', { x: 5, y: 10, width: 14, height: 10, rx: 2.5 }), p('M8 10V7a4 4 0 0 1 8 0v3')]
      else children = [h('circle', { cx: 12, cy: 12, r: 8 })]
      return h('svg', common, children)
    }

    function SidebarIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, [
        h('path', { key: 'shield', d: 'M12 2.4 20 5.6v5.5c0 4.7-3.3 8.3-8 10.5-4.7-2.2-8-5.8-8-10.5V5.6L12 2.4Z' }),
        h('path', { key: 'wave', d: 'M7 12c1.7-2.1 3.4-2.1 5 0s3.3 2.1 5 0' }),
        h('circle', { key: 'eye', cx: 8.4, cy: 9.5, r: 0.8, fill: 'currentColor', stroke: 'none' }),
      ])
    }

    const CSS = `
.dy-page {
  --dy-bg: var(--dsw-alias-bg-base, #f4f7fc);
  --dy-layer: var(--dsw-alias-bg-layer-1, #ffffff);
  --dy-layer2: var(--dsw-alias-bg-layer-2, #f8faff);
  --dy-overlay: var(--dsw-alias-bg-overlay, #eef3fb);
  --dy-border: var(--dsw-alias-border-l1, #e2e8f2);
  --dy-border2: var(--dsw-alias-border-l2, #cfd9e8);
  --dy-text: var(--dsw-alias-label-primary, #17233a);
  --dy-muted: var(--dsw-alias-label-secondary, #718097);
  --dy-brand: var(--dsw-alias-brand-primary, #3d6ff2);
  --dy-brand-soft: color-mix(in srgb, var(--dy-brand) 9%, transparent);
  --dy-brand-line: color-mix(in srgb, var(--dy-brand) 28%, transparent);
  --dy-success: var(--dsw-alias-state-success-primary, #2f9d70);
  --dy-warn: var(--dsw-alias-state-warn-primary, #c8872e);
  --dy-danger: var(--dsw-alias-state-error-primary, #d95454);
  --dy-shadow: 0 14px 38px rgba(35, 65, 120, .09);
  display:flex; flex-direction:column; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden;
  color:var(--dy-text); background:var(--dy-bg); font-size:14px; line-height:1.55;
}
.dy-page * { box-sizing:border-box; }
.dy-head { flex:none; display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:16px 24px;
  padding:24px clamp(20px,3vw,38px) 16px; border-bottom:1px solid var(--dy-border);
  background:linear-gradient(180deg, var(--dy-layer) 0%, var(--dy-bg) 130%); }
.dy-headMain { min-width:0; }
.dy-eyebrow { margin:0 0 5px; font-size:9.5px; letter-spacing:.16em; font-weight:650; color:var(--dy-brand); }
.dy-title { margin:0; font-size:27px; line-height:1.18; font-weight:650; letter-spacing:-.02em; }
.dy-sub { margin:7px 0 0; max-width:620px; font-size:12.5px; color:var(--dy-muted); }
.dy-tools { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dy-search { position:relative; display:flex; align-items:center; gap:8px; width:min(330px, 34vw); height:38px;
  padding:0 12px; border-radius:10px; border:1px solid var(--dy-border); background:var(--dy-layer);
  color:var(--dy-muted); transition:border-color .15s, box-shadow .15s; }
.dy-search:focus-within { border-color:var(--dy-brand); box-shadow:0 0 0 3px var(--dy-brand-soft); }
.dy-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:var(--dy-text); font:inherit; font-size:12.5px; }
.dy-search input::placeholder { color:var(--dy-muted); opacity:.82; }
.dy-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; height:38px; padding:0 13px;
  border:1px solid var(--dy-border2); border-radius:10px; background:var(--dy-layer); color:var(--dy-text);
  font:inherit; font-size:12.5px; cursor:pointer; white-space:nowrap; transition:background .15s, border-color .15s, opacity .15s; }
.dy-btn:hover { background:var(--dy-layer2); }
.dy-btn:disabled { cursor:default; opacity:.55; }
.dy-btn.primary { border-color:transparent; background:var(--dy-brand); color:#fff; }
.dy-btn.primary:hover { opacity:.9; }
.dy-btn.ghost { border-color:transparent; background:transparent; color:var(--dy-muted); }
.dy-btn.ghost:hover { background:var(--dy-overlay); color:var(--dy-text); }
.dy-btn.small { height:32px; border-radius:8px; padding:0 11px; font-size:11.5px; }
.dy-tokenRow { flex:none; display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:10px clamp(20px,3vw,38px);
  border-bottom:1px solid var(--dy-border); background:var(--dy-layer); }
.dy-tokenRow input { flex:1 1 280px; min-width:0; height:34px; padding:0 11px; border-radius:8px; border:1px solid var(--dy-border2);
  outline:0; background:var(--dy-layer2); color:var(--dy-text); font:inherit; font-size:12px; }
.dy-tokenRow input:focus { border-color:var(--dy-brand); }
.dy-tokenHint { font-size:11px; color:var(--dy-muted); }
.dy-notice { flex:none; display:flex; align-items:flex-start; gap:9px; margin:10px clamp(20px,3vw,38px) 0; padding:9px 12px;
  border:1px solid var(--dy-border); border-radius:9px; background:var(--dy-layer); color:var(--dy-muted); font-size:12px; }
.dy-notice.ok { border-color:color-mix(in srgb, var(--dy-success) 38%, var(--dy-border)); }
.dy-notice.warn { border-color:color-mix(in srgb, var(--dy-warn) 42%, var(--dy-border)); }
.dy-notice.error { border-color:color-mix(in srgb, var(--dy-danger) 40%, var(--dy-border)); }
.dy-notice span { flex:1; min-width:0; }
.dy-notice button { flex:none; border:0; background:transparent; color:var(--dy-muted); cursor:pointer; padding:0 2px; font-size:16px; line-height:1; }
.dy-body { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) minmax(360px, 440px); gap:18px;
  padding:16px clamp(20px,3vw,38px) 20px; }
.dy-browser { min-width:0; min-height:0; display:flex; flex-direction:column; }
.dy-browserHead { flex:none; display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:10px 16px; padding-bottom:10px; border-bottom:1px solid var(--dy-border); }
.dy-browserTitle { display:flex; align-items:baseline; gap:9px; min-width:0; }
.dy-browserTitle h2 { margin:0; font-size:15px; font-weight:650; }
.dy-browserHint { font-size:10.5px; color:var(--dy-muted); }
.dy-sort { margin-left:auto; font-size:10.5px; color:var(--dy-muted); white-space:nowrap; }
.dy-toolbar { flex:none; display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:12px 0 2px; }
.dy-cat { display:inline-flex; align-items:center; gap:5px; height:27px; padding:0 10px; border-radius:999px;
  border:1px solid var(--dy-border); background:transparent; color:var(--dy-muted); font:inherit; font-size:11px; cursor:pointer; white-space:nowrap; }
.dy-cat:hover { background:var(--dy-layer2); color:var(--dy-text); }
.dy-cat.active { border-color:transparent; background:var(--dy-brand); color:#fff; }
.dy-catCount { font-size:9.5px; opacity:.72; font-variant-numeric:tabular-nums; }
.dy-grid { flex:1; min-height:0; overflow:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));
  gap:12px; align-content:start; padding:12px 2px 6px; scrollbar-gutter:stable; }
.dy-card { min-width:0; min-height:166px; display:flex; flex-direction:column; gap:7px; padding:14px; text-align:left;
  border:1px solid var(--dy-border); border-radius:15px; background:var(--dy-layer); color:inherit; font:inherit; cursor:pointer;
  box-shadow:0 3px 12px rgba(35,65,120,.035); transition:transform .15s, border-color .15s, box-shadow .15s, background .15s; }
.dy-card:hover { transform:translateY(-1px); border-color:var(--dy-border2); box-shadow:0 9px 24px rgba(35,65,120,.08); }
.dy-card.selected { border-color:var(--dy-brand); background:color-mix(in srgb, var(--dy-brand) 4%, var(--dy-layer)); box-shadow:0 8px 24px rgba(61,111,242,.13); }
.dy-cardTop { display:flex; align-items:flex-start; gap:9px; min-width:0; }
.dy-avatar { position:relative; flex:none; width:36px; height:36px; border-radius:10px; overflow:hidden; background:var(--dy-overlay); }
.dy-avatarFallback { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; }
.dy-avatar img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.dy-cardIdent { min-width:0; flex:1; display:flex; flex-direction:column; gap:1px; }
.dy-cardName { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:650; }
.dy-cardOwner { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; color:var(--dy-muted); }
.dy-badge { display:inline-flex; align-items:center; gap:4px; flex:none; height:20px; padding:0 7px; border-radius:999px;
  border:1px solid var(--dy-border); color:var(--dy-muted); font-size:9px; white-space:nowrap; }
.dy-badge.installable { color:var(--dy-success); background:color-mix(in srgb, var(--dy-success) 8%, transparent); border-color:color-mix(in srgb, var(--dy-success) 24%, transparent); }
.dy-badge.viewing { color:var(--dy-brand); background:var(--dy-brand-soft); border-color:var(--dy-brand-line); }
.dy-cardDesc { margin:1px 0 0; min-height:32px; color:var(--dy-muted); font-size:11.5px; line-height:1.45;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word; }
.dy-cardFoot { margin-top:auto; display:flex; align-items:center; gap:6px; min-width:0; }
.dy-topic { max-width:112px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:1px 7px; border-radius:999px;
  background:var(--dy-overlay); color:var(--dy-muted); font-size:9px; }
.dy-cardMeta { margin-left:auto; color:var(--dy-muted); font-size:9px; white-space:nowrap; }
.dy-pager { flex:none; display:flex; align-items:center; justify-content:space-between; gap:10px; padding-top:10px; border-top:1px solid var(--dy-border); }
.dy-pagerText { font-size:10px; color:var(--dy-muted); }
.dy-pagerBtns { display:flex; gap:5px; }
.dy-pagerBtn { width:29px; height:27px; border-radius:7px; border:1px solid var(--dy-border); background:var(--dy-layer); color:var(--dy-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.dy-pagerBtn:hover:not(:disabled) { background:var(--dy-layer2); color:var(--dy-text); }
.dy-pagerBtn:disabled { opacity:.35; cursor:default; }
.dy-state { min-height:200px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:var(--dy-muted); font-size:12px; text-align:center; }
.dy-state strong { color:var(--dy-text); font-size:13px; font-weight:600; }
.dy-error { margin:10px 0; padding:10px 12px; border-radius:9px; border:1px solid color-mix(in srgb, var(--dy-danger) 35%, var(--dy-border)); background:var(--dy-layer); font-size:11.5px; color:var(--dy-muted); }
.dy-error strong { color:var(--dy-danger); font-weight:600; }
` 

    const CSS_DETAIL = `
.dy-detail { min-width:0; min-height:0; overflow:auto; border:1px solid var(--dy-border); border-radius:18px;
  background:var(--dy-layer); box-shadow:var(--dy-shadow); align-self:start; max-height:100%; scrollbar-gutter:stable; }
.dy-detailHero { position:relative; overflow:hidden; padding:19px 20px 17px; border-bottom:1px solid var(--dy-border);
  background:linear-gradient(130deg, color-mix(in srgb, var(--dy-brand) 13%, var(--dy-layer)) 0%, var(--dy-layer) 68%); }
.dy-detailHero::after { content:''; position:absolute; width:190px; height:190px; right:-63px; top:-91px; border-radius:50%;
  background:color-mix(in srgb, var(--dy-brand) 9%, transparent); pointer-events:none; }
.dy-detailTop { position:relative; display:flex; align-items:flex-start; gap:11px; z-index:1; }
.dy-detailAvatar { width:52px; height:52px; border-radius:14px; }
.dy-detailIdent { flex:1; min-width:0; }
.dy-detailName { margin:0; font-size:20px; line-height:1.22; font-weight:650; letter-spacing:-.015em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dy-detailOwner { margin:2px 0 0; font-size:10.5px; color:var(--dy-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dy-githubLink { flex:none; display:inline-flex; align-items:center; gap:4px; border:0; background:transparent; color:var(--dy-muted); font:inherit; font-size:9.5px; text-decoration:none; cursor:pointer; padding:3px 2px; }
.dy-githubLink:hover { color:var(--dy-brand); }
.dy-detailBadges { position:relative; z-index:1; display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
.dy-detailBadges .dy-badge { height:21px; padding:0 8px; }
.dy-detailDesc { position:relative; z-index:1; margin:11px 0 0; color:var(--dy-muted); font-size:11.5px; line-height:1.55; }
.dy-detailBody { display:flex; flex-direction:column; gap:13px; padding:15px 20px 18px; }
.dy-auditGate { display:flex; flex-direction:column; gap:11px; padding:15px; border-radius:12px;
  border:1px solid var(--dy-brand-line); background:linear-gradient(135deg, var(--dy-brand-soft), transparent); }
.dy-auditGateTop { display:flex; align-items:flex-start; gap:10px; }
.dy-auditIcon { flex:none; display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:9px; background:var(--dy-brand); color:#fff; }
.dy-auditGateTitle { margin:0; font-size:12px; font-weight:650; }
.dy-auditGateHint { margin:3px 0 0; font-size:10.5px; color:var(--dy-muted); }
.dy-auditActions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dy-auditNote { font-size:9.5px; color:var(--dy-muted); }
.dy-spinner { width:15px; height:15px; border-radius:50%; border:1.8px solid color-mix(in srgb, var(--dy-brand) 25%, transparent); border-top-color:var(--dy-brand); animation:dy-spin .8s linear infinite; }
@keyframes dy-spin { to { transform:rotate(360deg); } }
.dy-auditProgress { display:flex; align-items:center; gap:9px; padding:13px; border-radius:11px; border:1px solid var(--dy-border); background:var(--dy-layer2); color:var(--dy-muted); font-size:11px; }
.dy-summary { padding:13px 14px; border-radius:12px; border:1px solid var(--dy-border); background:var(--dy-layer2); }
.dy-summary.green { border-color:color-mix(in srgb, var(--dy-success) 28%, var(--dy-border)); background:color-mix(in srgb, var(--dy-success) 5%, var(--dy-layer)); }
.dy-summary.caution { border-color:color-mix(in srgb, var(--dy-warn) 32%, var(--dy-border)); background:color-mix(in srgb, var(--dy-warn) 5%, var(--dy-layer)); }
.dy-summary.concern { border-color:color-mix(in srgb, var(--dy-danger) 30%, var(--dy-border)); background:color-mix(in srgb, var(--dy-danger) 5%, var(--dy-layer)); }
.dy-summaryHead { display:flex; align-items:center; gap:7px; color:var(--dy-text); font-size:11px; font-weight:650; }
.dy-summaryDot { width:7px; height:7px; border-radius:50%; background:var(--dy-brand); }
.dy-summary.green .dy-summaryDot { background:var(--dy-success); }
.dy-summary.caution .dy-summaryDot { background:var(--dy-warn); }
.dy-summary.concern .dy-summaryDot { background:var(--dy-danger); }
.dy-summaryText { margin:7px 0 0; color:var(--dy-text); font-size:11.5px; line-height:1.6; }
.dy-chipRow { display:flex; flex-wrap:wrap; gap:5px; margin-top:9px; }
.dy-chip { display:inline-flex; align-items:center; min-height:20px; padding:1px 7px; border-radius:999px; border:1px solid var(--dy-border);
  background:var(--dy-layer); color:var(--dy-muted); font-size:9.2px; }
.dy-chip.warn { color:var(--dy-warn); border-color:color-mix(in srgb, var(--dy-warn) 28%, var(--dy-border)); }
.dy-sectionTitle { margin:0; font-size:11px; font-weight:650; }
.dy-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
.dy-metric { min-width:0; display:flex; align-items:center; gap:8px; padding:8px 9px; border:1px solid var(--dy-border); border-radius:9px; background:var(--dy-layer2); }
.dy-metricIcon { flex:none; display:flex; align-items:center; justify-content:center; width:25px; height:25px; border-radius:8px; background:var(--dy-brand-soft); color:var(--dy-brand); }
.dy-metricBody { min-width:0; display:flex; flex-direction:column; gap:0; }
.dy-metricLabel { font-size:8.7px; color:var(--dy-muted); }
.dy-metricValue { font-size:10.5px; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dy-capabilities { display:flex; flex-wrap:wrap; gap:5px; }
.dy-cap { padding:2px 7px; border-radius:999px; background:var(--dy-overlay); color:var(--dy-muted); font-size:9.2px; }
.dy-smallNote { margin:0; color:var(--dy-muted); font-size:9px; line-height:1.5; }
.dy-maintenance { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; overflow:hidden; border:1px solid var(--dy-border); border-radius:9px; background:var(--dy-border); }
.dy-maintenanceCell { min-width:0; padding:8px 9px; background:var(--dy-layer2); }
.dy-maintenanceValue { font-size:10px; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dy-maintenanceLabel { margin-top:1px; color:var(--dy-muted); font-size:8.2px; }
.dy-divider { height:1px; background:var(--dy-border); }
.dy-actions { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.dy-actions .dy-btn.primary { flex:1 1 150px; }
.dy-versionNote { margin-left:auto; text-align:right; color:var(--dy-muted); font-size:8.7px; line-height:1.45; }
.dy-checks { border:1px solid var(--dy-border); border-radius:9px; background:var(--dy-layer2); }
.dy-checks summary { cursor:pointer; padding:8px 10px; font-size:10px; color:var(--dy-muted); user-select:none; }
.dy-checks summary:hover { color:var(--dy-text); }
.dy-checksList { display:flex; flex-direction:column; gap:0; border-top:1px solid var(--dy-border); }
.dy-check { display:flex; align-items:flex-start; gap:8px; padding:8px 10px; border-top:1px solid var(--dy-border); }
.dy-check:first-child { border-top:0; }
.dy-checkDot { flex:none; width:6px; height:6px; margin-top:5px; border-radius:50%; background:var(--dy-muted); }
.dy-checkDot.red { background:var(--dy-danger); }
.dy-checkDot.yellow { background:var(--dy-warn); }
.dy-checkDot.green { background:var(--dy-success); }
.dy-checkText { min-width:0; }
.dy-checkTitle { font-size:9.8px; font-weight:600; color:var(--dy-text); }
.dy-checkDetail { margin-top:1px; color:var(--dy-muted); font-size:9px; line-height:1.45; }
.dy-confirm { display:flex; flex-direction:column; gap:9px; padding:12px; border:1px dashed var(--dy-border2); border-radius:10px; background:var(--dy-layer2); }
.dy-confirmTitle { margin:0; font-size:11px; font-weight:650; }
.dy-factGrid { display:grid; grid-template-columns:auto minmax(0,1fr); gap:3px 10px; margin:0; font-size:9.5px; }
.dy-factGrid dt { color:var(--dy-muted); }
.dy-factGrid dd { margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dy-warning { display:flex; align-items:flex-start; gap:6px; color:var(--dy-warn); font-size:9.2px; line-height:1.45; }
.dy-warning.danger { color:var(--dy-danger); }
.dy-confirmActions { display:flex; justify-content:flex-end; gap:7px; }
.dy-ai { display:flex; flex-direction:column; gap:7px; padding:12px; border:1px solid color-mix(in srgb, var(--dy-brand) 18%, var(--dy-border)); border-radius:11px;
  background:linear-gradient(135deg, color-mix(in srgb, var(--dy-brand) 5%, var(--dy-layer)), var(--dy-layer)); }
.dy-aiHead { display:flex; align-items:center; gap:8px; }
.dy-aiIcon { display:flex; align-items:center; justify-content:center; width:27px; height:27px; border-radius:8px; background:var(--dy-brand-soft); color:var(--dy-brand); }
.dy-aiTitle { font-size:10.5px; font-weight:650; }
.dy-aiHint { font-size:9px; color:var(--dy-muted); }
.dy-aiText { margin:0; padding:9px 10px; border-radius:8px; background:var(--dy-layer); border:1px solid var(--dy-border); font-size:10.3px; line-height:1.6; color:var(--dy-text); }
.dy-aiFoot { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.dy-aiBy { font-size:8.4px; color:var(--dy-muted); }
.dy-errorText { margin:0; color:var(--dy-danger); font-size:9.5px; line-height:1.45; }
@media (max-width: 1080px) {
  .dy-body { grid-template-columns:minmax(0,1fr); overflow:auto; }
  .dy-browser { min-height:560px; }
  .dy-detail { max-height:none; }
}
@media (max-width: 640px) {
  .dy-head { padding:18px 16px 14px; }
  .dy-tools { width:100%; }
  .dy-search { width:100%; }
  .dy-body { padding:12px 16px 18px; }
  .dy-grid { grid-template-columns:minmax(0,1fr); }
  .dy-metrics { grid-template-columns:minmax(0,1fr); }
}
`

    function avatarGradient(value) {
      const palettes = [
        'linear-gradient(135deg,#3d6ff2,#7d9cff)',
        'linear-gradient(135deg,#179ca6,#55d1c4)',
        'linear-gradient(135deg,#e0823c,#ffb25f)',
        'linear-gradient(135deg,#d75b99,#f18dbb)',
        'linear-gradient(135deg,#3d4b66,#7285a8)',
        'linear-gradient(135deg,#2f9a68,#65c893)',
      ]
      let hash = 0
      for (const char of String(value ?? '')) hash = (hash * 31 + char.codePointAt(0)) >>> 0
      return palettes[hash % palettes.length]
    }

    function matchingInstalled(installed, repoName) {
      const key = normalizeName(repoName)
      if (key.length < 4) return false
      for (const name of installed) {
        const candidate = normalizeName(name)
        if (candidate.length < 4) continue
        if (candidate === key || candidate.endsWith(key) || key.endsWith(candidate)) return true
      }
      return false
    }

    function createPanel(api) {
      return function Panel(props) {
        const fallback = String(document.documentElement.lang ?? '').toLowerCase().startsWith('en') ? te : tz
        const t = typeof props.t === 'function' ? props.t : fallback
        const language = String(document.documentElement.lang ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh'

        const [columns, setColumns] = useState({
          utility: { status: 'loading', items: [], error: '', rateLimited: false },
          game: { status: 'loading', items: [], error: '', rateLimited: false },
        })
        const [installed, setInstalled] = useState([])
        const [query, setQuery] = useState('')
        const [search, setSearch] = useState({ status: 'idle', items: [], error: '' })
        const [searchNonce, setSearchNonce] = useState(0)
        const [category, setCategory] = useState('all')
        const [pageState, setPageState] = useState(1)
        const [selectedId, setSelectedId] = useState(null)
        const [tokenOpen, setTokenOpen] = useState(false)
        const [tokenDraft, setTokenDraft] = useState(() => api.readToken())
        const [notice, setNotice] = useState(null)
        const [audits, setAudits] = useState({})
        const [aiState, setAiState] = useState({})
        const [confirm, setConfirm] = useState(null)
        const [installing, setInstalling] = useState({})
        const searchSeq = useRef(0)

        const loadInstalled = useCallback(async () => {
          try {
            const body = await api.installed()
            setInstalled(Array.isArray(body.names) ? body.names : [])
          } catch {
            setInstalled([])
          }
        }, [api])

        const loadColumn = useCallback(async (name, refresh) => {
          setColumns(previous => ({
            ...previous,
            [name]: {
              ...previous[name],
              status: previous[name].items.length > 0 ? 'refreshing' : 'loading',
              error: '',
            },
          }))
          try {
            const body = await api.list(name, refresh === true)
            if (body.ok === false) throw new Error(String(body.error ?? body.message ?? 'GitHub request failed'))
            setColumns(previous => ({
              ...previous,
              [name]: {
                status: 'ready',
                items: Array.isArray(body.items) ? body.items : [],
                error: String(body.error ?? ''),
                rateLimited: body.rateLimited === true,
              },
            }))
          } catch (error) {
            setColumns(previous => ({
              ...previous,
              [name]: {
                ...previous[name],
                status: 'ready',
                error: String(error?.message ?? error),
              },
            }))
          }
        }, [api])

        useEffect(() => {
          void loadColumn('utility', false)
          void loadColumn('game', false)
          void loadInstalled()
        }, [loadColumn, loadInstalled])

        useEffect(() => {
          const text = query.trim()
          if (text === '') {
            searchSeq.current += 1
            setSearch({ status: 'idle', items: [], error: '' })
            return undefined
          }
          setSearch(previous => ({ status: 'loading', items: previous.items, error: '' }))
          const timer = window.setTimeout(() => {
            const sequence = searchSeq.current + 1
            searchSeq.current = sequence
            setSearch(previous => ({ ...previous, status: 'loading', error: '' }))
            void api.search(text).then(body => {
              if (searchSeq.current !== sequence) return
              setSearch({
                status: 'ready',
                items: Array.isArray(body.items) ? body.items : [],
                error: body.ok === false ? String(body.error ?? body.message ?? '') : '',
              })
            }).catch(error => {
              if (searchSeq.current !== sequence) return
              setSearch({ status: 'ready', items: [], error: String(error?.message ?? error) })
            })
          }, 380)
          return () => { window.clearTimeout(timer) }
        }, [api, query, searchNonce])

        const allItems = useMemo(() => {
          const seen = new Set()
          const merged = []
          for (const [column, list] of [['utility', columns.utility.items], ['game', columns.game.items]]) {
            for (const item of list) {
              if (seen.has(item.fullName)) continue
              seen.add(item.fullName)
              merged.push({ ...item, __column: column })
            }
          }
          return merged
        }, [columns.game.items, columns.utility.items])

        const source = useMemo(() => {
          if (query.trim() === '') return allItems
          return search.items.map(item => ({ ...item, __column: 'search' }))
        }, [allItems, query, search.items])

        const counts = useMemo(() => {
          const next = { all: source.length, dev: 0, model: 0, ui: 0, make: 0, game: 0, other: 0 }
          for (const item of source) {
            const key = item.__column === 'game' ? 'game' : categorize(item)
            next[key] += 1
          }
          return next
        }, [source])

        const filtered = useMemo(() => {
          if (category === 'all') return source
          return source.filter(item => (item.__column === 'game' ? 'game' : categorize(item)) === category)
        }, [category, source])

        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
        const page = Math.min(pageState, totalPages)
        const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        const pageKey = pageItems.map(item => item.fullName).join('|')

        useEffect(() => {
          if (pageItems.length === 0) return
          if (!pageItems.some(item => item.fullName === selectedId)) setSelectedId(pageItems[0].fullName)
        }, [pageKey, selectedId])

        const selected = useMemo(() => {
          if (selectedId === null) return null
          return allItems.find(item => item.fullName === selectedId)
            ?? search.items.find(item => item.fullName === selectedId)
            ?? null
        }, [allItems, search.items, selectedId])

        const isInstalled = useCallback(item => matchingInstalled(installed, item.name), [installed])
        const selectedAudit = selected === null ? undefined : audits[selected.fullName]
        const selectedView = selectedAudit?.status === 'ready' ? auditView(t, selectedAudit.data) : null
        const selectedAi = selected === null ? undefined : aiState[selected.fullName]
        const selectedInstall = selected === null ? undefined : installing[selected.fullName]
        const selectedConfirm = selected !== null && confirm?.repo === selected.fullName ? confirm : null
        const refreshing = columns.utility.status === 'refreshing' || columns.game.status === 'refreshing'
        const loadingInitial = columns.utility.status === 'loading' && columns.utility.items.length === 0

        const runAudit = useCallback(async (item, refresh) => {
          const fullName = item.fullName
          setAudits(previous => ({
            ...previous,
            [fullName]: { status: 'loading', data: previous[fullName]?.data ?? null, error: '' },
          }))
          setAiState(previous => {
            if (previous[fullName] === undefined) return previous
            const next = { ...previous }
            delete next[fullName]
            return next
          })
          try {
            const data = await api.audit(fullName, item.branch, refresh === true)
            setAudits(previous => ({ ...previous, [fullName]: { status: 'ready', data, error: '' } }))
          } catch (error) {
            setAudits(previous => ({
              ...previous,
              [fullName]: { status: 'error', data: previous[fullName]?.data ?? null, error: String(error?.message ?? error) },
            }))
          }
        }, [api])

        const runAi = useCallback(async (item) => {
          const fullName = item.fullName
          setAiState(previous => ({
            ...previous,
            [fullName]: { status: 'loading', text: previous[fullName]?.text ?? '', model: previous[fullName]?.model ?? '', error: '' },
          }))
          try {
            const body = await api.interpret(fullName, language)
            setAiState(previous => ({
              ...previous,
              [fullName]: { status: 'ready', text: String(body.text ?? ''), model: String(body.model ?? ''), error: '' },
            }))
          } catch (error) {
            setAiState(previous => ({
              ...previous,
              [fullName]: {
                status: 'error',
                text: previous[fullName]?.text ?? '',
                model: previous[fullName]?.model ?? '',
                error: String(error?.message ?? error),
              },
            }))
          }
        }, [api, language])

        const beginInstall = useCallback(async item => {
          setInstalling(previous => ({ ...previous, [item.fullName]: { status: 'idle' } }))
          setConfirm({ repo: item.fullName, status: 'loading', info: null, error: '' })
          try {
            const body = await api.inspect(item.fullName)
            setConfirm({ repo: item.fullName, status: 'ready', info: body.info, error: '' })
          } catch (error) {
            setConfirm({ repo: item.fullName, status: 'error', info: null, error: String(error?.message ?? error) })
          }
        }, [api])

        const completeInstall = useCallback(async item => {
          if (selectedConfirm?.info === undefined || selectedConfirm?.info === null) return
          setInstalling(previous => ({ ...previous, [item.fullName]: { status: 'loading' } }))
          try {
            const result = await api.install(item.fullName, selectedConfirm.info.branch || item.branch)
            if (result.ok === false) {
              setInstalling(previous => ({ ...previous, [item.fullName]: { status: 'error', message: String(result.message ?? 'Install failed') } }))
              return
            }
            const name = String(result.name ?? selectedConfirm.info.name ?? item.name)
            setInstalling(previous => ({ ...previous, [item.fullName]: { status: 'ready' } }))
            setConfirm(null)
            setNotice({ kind: 'ok', text: result.status === 'restart-required' ? t('detail.installRestart', { name }) : t('detail.installSuccess', { name }) })
            void loadInstalled()
          } catch (error) {
            setInstalling(previous => ({ ...previous, [item.fullName]: { status: 'error', message: String(error?.message ?? error) } }))
          }
        }, [api, loadInstalled, selectedConfirm, t])

        const categories = [
          { id: 'all', label: t('cat.all') },
          { id: 'dev', label: t('cat.dev') },
          { id: 'model', label: t('cat.model') },
          { id: 'ui', label: t('cat.ui') },
          { id: 'make', label: t('cat.make') },
          { id: 'game', label: t('cat.game') },
          { id: 'other', label: t('cat.other') },
        ]

        const renderCard = item => {
          const selectedCard = item.fullName === selectedId
          const installedCard = isInstalled(item)
          const categoryId = item.__column === 'game' ? 'game' : categorize(item)
          return h('button', {
            type: 'button',
            key: item.fullName,
            className: selectedCard ? 'dy-card selected' : 'dy-card',
            onClick: () => {
              setSelectedId(item.fullName)
              setConfirm(null)
            },
            'aria-pressed': selectedCard,
          },
            h('div', { className: 'dy-cardTop' },
              h('span', { className: 'dy-avatar' },
                h('span', { className: 'dy-avatarFallback', style: { background: avatarGradient(item.fullName) } }, initials(item.name)),
                item.avatar === '' ? null : h('img', { src: item.avatar, alt: '', loading: 'lazy', onError: event => { event.currentTarget.style.display = 'none' } })),
              h('span', { className: 'dy-cardIdent' },
                h('span', { className: 'dy-cardName' }, item.name || item.fullName),
                h('span', { className: 'dy-cardOwner' }, item.owner || item.fullName.split('/')[0])),
              h('span', {
                className: installedCard ? 'dy-badge installable' : selectedCard ? 'dy-badge viewing' : 'dy-badge',
              }, selectedCard ? t('card.viewing') : installedCard ? t('card.installed') : t('card.available'))),
            h('p', { className: 'dy-cardDesc' }, item.description || t('detail.descriptionFallback')),
            h('div', { className: 'dy-cardFoot' },
              (item.topics || []).slice(0, 2).map(topic => h('span', { className: 'dy-topic', key: topic }, topic)),
              h('span', { className: 'dy-cardMeta' }, `${t('card.stars', { n: item.stars })} · ${t('card.updated', { ago: ago(t, item.updatedAt) })}`)))
        }

        const renderError = () => {
          const searchFailed = query.trim() !== '' && search.error !== ''
          const failed = [columns.utility, columns.game].find(column => column.error !== '')
          if (!searchFailed && failed === undefined) return null
          const message = searchFailed ? search.error : failed.error
          return h('div', { className: 'dy-error', role: 'status' },
            h('strong', null, t('error.title')),
            ` ${message}`,
            failed?.rateLimited === true ? h('div', null, t('rate.hint')) : null,
            h('div', { style: { marginTop: '7px' } },
              h('button', {
                type: 'button', className: 'dy-btn small',
                onClick: () => {
                  void loadColumn('utility', true)
                  void loadColumn('game', true)
                  if (query.trim() !== '') setSearchNonce(value => value + 1)
                },
              }, t('action.retry'))))
        }

        const renderDetail = () => {
          if (selected === null) {
            return h('aside', { className: 'dy-detail' },
              h('div', { className: 'dy-state' }, h('strong', null, t('empty.title')), h('span', null, t('empty.hint'))))
          }
          const categoryId = selected.__column === 'game' ? 'game' : categorize(selected)
          const auditData = selectedAudit?.status === 'ready' ? selectedAudit.data : null
          const view = selectedView
          const auditBusy = selectedAudit?.status === 'loading'
          const capabilities = []
          for (const topic of (selected.topics || []).slice(0, 3)) capabilities.push(topic)
          if (auditData?.facts?.providesTools === true) capabilities.push(t('chip.tools'))
          if (capabilities.length === 0) capabilities.push(t(`cat.${categoryId}`))
          const packageFacts = view?.packageFacts ?? {}
          const installInfo = selectedConfirm?.info ?? null
          const version = installInfo?.version ?? packageFacts.version
          const installBusy = selectedInstall?.status === 'loading'

          const summaryBlock = view === null ? null : h('div', { className: `dy-summary ${view.tone}` },
            h('div', { className: 'dy-summaryHead' }, h('span', { className: 'dy-summaryDot' }), t('detail.summaryTitle')),
            h('p', { className: 'dy-summaryText' }, view.summary),
            h('div', { className: 'dy-chipRow' }, view.chips.map((chip, index) =>
              h('span', { className: `dy-chip ${view.tone === 'caution' || view.tone === 'concern' ? 'warn' : ''}`, key: `${chip}-${String(index)}` }, chip))))

          const checkRows = view === null ? [] : view.checks.slice(0, 14).map((check, index) => {
            const title = String(check.title ?? '')
            const detail = String(check.detail ?? '')
            return h('div', { className: 'dy-check', key: `${String(check.id ?? 'check')}-${String(index)}` },
              h('span', { className: `dy-checkDot ${String(check.level ?? '')}` }),
              h('span', { className: 'dy-checkText' },
                h('div', { className: 'dy-checkTitle' }, title),
                detail === '' ? null : h('div', { className: 'dy-checkDetail' }, detail)))
          })
          const checksBlock = view === null ? null : h('details', { className: 'dy-checks' },
            h('summary', null, t('detail.checksSummary', { n: view.checks.length })),
            h('div', { className: 'dy-checksList' }, checkRows))

          const auditBlock = auditBusy
            ? h('div', { className: 'dy-auditProgress' }, h('span', { className: 'dy-spinner' }), t('detail.auditing'))
            : view !== null
              ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '11px' } },
                summaryBlock,
                h('div', { className: 'dy-metrics' }, view.metrics.map(metric => h('div', { className: 'dy-metric', key: metric.label },
                  h('span', { className: 'dy-metricIcon' }, h(Icon, { name: metric.icon, size: 15 })),
                  h('span', { className: 'dy-metricBody' },
                    h('span', { className: 'dy-metricLabel' }, metric.label),
                    h('span', { className: 'dy-metricValue' }, metric.value))))),
                h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                    h('h3', { className: 'dy-sectionTitle' }, t('detail.confirmTitle')),
                    h('span', { className: 'dy-smallNote' }, view.scanned)),
                  h('div', { className: 'dy-capabilities' }, view.chips.map((chip, index) =>
                    h('span', { className: 'dy-cap', key: `${chip}-cap-${String(index)}` }, chip)))),
                checksBlock,
                h('button', {
                  type: 'button', className: 'dy-btn small ghost', style: { alignSelf: 'flex-start' },
                  onClick: () => { void runAudit(selected, true) },
                }, h(Icon, { name: 'refresh', size: 13 }), t('detail.auditAgain')))
              : h('div', { className: 'dy-auditGate' },
                selectedAudit?.status === 'error'
                  ? h('p', { className: 'dy-errorText' }, `${t('detail.auditFailed')}: ${selectedAudit.error}`)
                  : null,
                h('div', { className: 'dy-auditGateTop' },
                  h('span', { className: 'dy-auditIcon' }, h(Icon, { name: 'shield', size: 17 })),
                  h('div', null,
                    h('h3', { className: 'dy-auditGateTitle' }, t('detail.auditTitle')),
                    h('p', { className: 'dy-auditGateHint' }, t('detail.auditHint')))),
                h('div', { className: 'dy-auditActions' },
                  h('button', { type: 'button', className: 'dy-btn primary small', onClick: () => { void runAudit(selected, false) } },
                    h(Icon, { name: 'shield', size: 14 }), t('detail.auditStart')),
                  h('span', { className: 'dy-auditNote' }, t('detail.badgeLocal'))))

          const aiBlock = h('div', { className: 'dy-ai' },
            h('div', { className: 'dy-aiHead' },
              h('span', { className: 'dy-aiIcon' }, h(Icon, { name: 'spark', size: 15 })),
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { className: 'dy-aiTitle' }, t('detail.aiTitle')),
                h('div', { className: 'dy-aiHint' }, t('detail.aiHint'))),
              h('button', {
                type: 'button', className: 'dy-btn small',
                disabled: view === null || selectedAi?.status === 'loading',
                onClick: () => { void runAi(selected) },
                title: view === null ? t('detail.aiUnavailable') : t('detail.aiButton'),
              }, selectedAi?.status === 'loading' ? t('detail.aiLoading') : t('detail.aiButton'))),
            h('p', { className: 'dy-smallNote' }, t('detail.aiNote')),
            selectedAi?.status === 'error' ? h('p', { className: 'dy-errorText' }, t('detail.aiError', { message: selectedAi.error })) : null,
            selectedAi?.text ? h('p', { className: 'dy-aiText' }, selectedAi.text) : null,
            selectedAi?.text && selectedAi.model ? h('div', { className: 'dy-aiBy' }, t('detail.aiBy', { model: selectedAi.model })) : null)

          const confirmBlock = selectedConfirm === null ? null : h('div', { className: 'dy-confirm' },
            h('h3', { className: 'dy-confirmTitle' }, t('detail.confirmInstall')),
            selectedConfirm.status === 'loading'
              ? h('div', { className: 'dy-auditProgress' }, h('span', { className: 'dy-spinner' }), t('detail.inspect'))
              : selectedConfirm.status === 'error'
                ? h('p', { className: 'dy-errorText' }, selectedConfirm.error)
                : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                  h('dl', { className: 'dy-factGrid' },
                    h('dt', null, 'Package'), h('dd', null, String(installInfo?.name ?? '—')),
                    h('dt', null, 'Version'), h('dd', null, String(installInfo?.version ?? '—')),
                    h('dt', null, 'Branch'), h('dd', null, String(installInfo?.branch ?? '—')),
                    h('dt', null, 'Source'), h('dd', null, String(installInfo?.repo ?? selected.fullName))),
                  h('div', { className: `dy-warning ${installInfo?.isBundle === false ? 'danger' : ''}` },
                    h(Icon, { name: 'alert', size: 13 }),
                    h('span', null, installInfo?.isBundle === false ? t('detail.bundleMissing') : t('detail.installRisk'))),
                  selectedInstall?.status === 'error' ? h('p', { className: 'dy-errorText' }, t('detail.installFailed', { message: selectedInstall.message })) : null,
                  h('div', { className: 'dy-confirmActions' },
                    h('button', { type: 'button', className: 'dy-btn small ghost', onClick: () => { setConfirm(null) } }, t('detail.cancel')),
                    h('button', {
                      type: 'button', className: 'dy-btn small primary', disabled: installBusy,
                      onClick: () => { void completeInstall(selected) },
                    }, installBusy ? t('detail.inspect') : t('detail.confirmInstall')))))

          return h('aside', { className: 'dy-detail' },
            h('div', { className: 'dy-detailHero' },
              h('div', { className: 'dy-detailTop' },
                h('span', { className: 'dy-avatar dy-detailAvatar' },
                  h('span', { className: 'dy-avatarFallback', style: { background: avatarGradient(selected.fullName), fontSize: '14px' } }, initials(selected.name)),
                  selected.avatar === '' ? null : h('img', { src: selected.avatar, alt: '', loading: 'lazy', onError: event => { event.currentTarget.style.display = 'none' } })),
                h('div', { className: 'dy-detailIdent' },
                  h('h2', { className: 'dy-detailName' }, selected.name || selected.fullName),
                  h('p', { className: 'dy-detailOwner' }, `${selected.owner || selected.fullName.split('/')[0]} / ${selected.fullName}`)),
                h('a', { className: 'dy-githubLink', href: selected.url, target: '_blank', rel: 'noreferrer', title: t('action.github') },
                  h(Icon, { name: 'github', size: 13 }), 'GitHub')),
              h('div', { className: 'dy-detailBadges' },
                h('span', { className: isInstalled(selected) ? 'dy-badge installable' : 'dy-badge' }, isInstalled(selected) ? t('card.installed') : t('card.available')),
                h('span', { className: 'dy-badge' }, t('detail.badgeBundle')),
                h('span', { className: 'dy-badge viewing' }, t('detail.badgeLocal'))),
              h('p', { className: 'dy-detailDesc' }, selected.description || t('detail.descriptionFallback'))),
            h('div', { className: 'dy-detailBody' },
              auditBlock,
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                h('h3', { className: 'dy-sectionTitle' }, t('detail.capabilities')),
                h('div', { className: 'dy-capabilities' }, capabilities.map(cap => h('span', { className: 'dy-cap', key: cap }, cap))),
                h('p', { className: 'dy-smallNote' }, t('detail.capabilityHint'))),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                h('h3', { className: 'dy-sectionTitle' }, t('detail.maintenance')),
                h('div', { className: 'dy-maintenance' },
                  h('div', { className: 'dy-maintenanceCell' },
                    h('div', { className: 'dy-maintenanceValue' }, ago(t, selected.updatedAt)),
                    h('div', { className: 'dy-maintenanceLabel' }, t('detail.updated', { ago: '' }).trim() || 'Updated')),
                  h('div', { className: 'dy-maintenanceCell' },
                    h('div', { className: 'dy-maintenanceValue' }, `★ ${selected.stars}`),
                    h('div', { className: 'dy-maintenanceLabel' }, 'GitHub')),
                  h('div', { className: 'dy-maintenanceCell' },
                    h('div', { className: 'dy-maintenanceValue' }, selected.branch || 'main'),
                    h('div', { className: 'dy-maintenanceLabel' }, t('detail.branch', { branch: '' }).trim() || 'Branch')))),
              h('div', { className: 'dy-divider' }),
              h('div', { className: 'dy-actions' },
                h('button', { type: 'button', className: 'dy-btn primary', onClick: () => { void beginInstall(selected) } },
                  h(Icon, { name: 'box', size: 15 }), t('detail.install')),
                h('a', { className: 'dy-btn', href: selected.url, target: '_blank', rel: 'noreferrer' },
                  h(Icon, { name: 'github', size: 14 }), t('detail.source')),
                h('span', { className: 'dy-versionNote' },
                  version === undefined ? selected.branch || 'main' : `${t('detail.version', { version })}`)),
              confirmBlock,
              aiBlock,
              h('p', { className: 'dy-smallNote' }, t('detail.sourceNote'))))
        }

        const listLoading = query.trim() !== ''
          ? search.status === 'loading' && source.length === 0
          : loadingInitial
        const listFailed = query.trim() !== ''
          ? search.error !== ''
          : columns.utility.error !== '' || columns.game.error !== ''
        const empty = !listLoading && !listFailed && filtered.length === 0
        const from = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
        const to = Math.min(filtered.length, page * PAGE_SIZE)
        const browserTitle = query.trim() === '' ? t('section.picks') : t('section.results')
        const browserHint = query.trim() === ''
          ? refreshing ? t('hint.updating') : t('section.hint')
          : search.status === 'loading' ? t('hint.searching') : ''

        const body = h('div', { className: 'dy-body' },
          h('section', { className: 'dy-browser', 'aria-label': browserTitle },
            h('div', { className: 'dy-browserHead' },
              h('div', { className: 'dy-browserTitle' },
                h('h2', null, browserTitle),
                h('span', { className: 'dy-browserHint' }, t('section.count', { n: filtered.length }))),
              h('span', { className: 'dy-sort' }, browserHint)),
            h('div', { className: 'dy-toolbar' }, categories.map(entry => h('button', {
              type: 'button',
              key: entry.id,
              className: entry.id === category ? 'dy-cat active' : 'dy-cat',
              onClick: () => { setCategory(entry.id); setPageState(1) },
            }, entry.label, h('span', { className: 'dy-catCount' }, String(counts[entry.id] ?? 0))))),
            listFailed ? renderError() : null,
            listLoading
              ? h('div', { className: 'dy-state' }, h('span', { className: 'dy-spinner' }), h('span', null, query.trim() === '' ? t('list.loading') : t('hint.searching')))
              : empty
                ? h('div', { className: 'dy-state' }, h('strong', null, t('empty.title')), h('span', null, t('empty.hint')))
                : h('div', { className: 'dy-grid' }, pageItems.map(renderCard)),
            h('div', { className: 'dy-pager' },
              h('span', { className: 'dy-pagerText' }, t('footer.range', { from, to, total: filtered.length })),
              h('div', { className: 'dy-pagerBtns' },
                h('button', {
                  type: 'button', className: 'dy-pagerBtn', 'aria-label': t('action.prev'), disabled: page <= 1,
                  onClick: () => { setPageState(Math.max(1, page - 1)) },
                }, h(Icon, { name: 'chevron', size: 13, style: { transform: 'rotate(180deg)' } })),
                h('button', {
                  type: 'button', className: 'dy-pagerBtn', 'aria-label': t('action.next'), disabled: page >= totalPages,
                  onClick: () => { setPageState(Math.min(totalPages, page + 1)) },
                }, h(Icon, { name: 'chevron', size: 13 }))))),
          renderDetail())

        return h('div', { className: 'dy-page' },
          h('style', null, CSS + CSS_DETAIL),
          h('header', { className: 'dy-head' },
            h('div', { className: 'dy-headMain' },
              h('p', { className: 'dy-eyebrow' }, t('eyebrow')),
              h('h1', { className: 'dy-title' }, t('title')),
              h('p', { className: 'dy-sub' }, t('subtitle'))),
            h('div', { className: 'dy-tools' },
              h('label', { className: 'dy-search' },
                h(Icon, { name: 'search', size: 15 }),
                h('input', {
                  type: 'search', value: query, placeholder: t('search.placeholder'),
                  'aria-label': t('search.placeholder'), onChange: event => { setQuery(event.target.value); setPageState(1) },
                })),
              h('button', {
                type: 'button', className: 'dy-btn ghost', 'aria-expanded': tokenOpen,
                onClick: () => { setTokenOpen(value => !value) },
              }, h(Icon, { name: 'lock', size: 14 }), t('action.token')),
              h('button', {
                type: 'button', className: 'dy-btn primary',
                onClick: () => {
                  void loadColumn('utility', true)
                  void loadColumn('game', true)
                  if (query.trim() !== '') setSearchNonce(value => value + 1)
                },
              }, h(Icon, { name: 'refresh', size: 14 }), refreshing ? t('action.refreshing') : t('action.refresh')))),
          tokenOpen
            ? h('div', { className: 'dy-tokenRow' },
              h('input', {
                type: 'password', value: tokenDraft, placeholder: t('token.placeholder'),
                'aria-label': t('token.placeholder'), onChange: event => { setTokenDraft(event.target.value) },
              }),
              h('button', {
                type: 'button', className: 'dy-btn small',
                onClick: () => { api.writeToken(tokenDraft.trim()); setTokenOpen(false) },
              }, t('action.save')),
              h('span', { className: 'dy-tokenHint' }, t('token.hint')))
            : null,
          notice === null
            ? null
            : h('div', { className: `dy-notice ${notice.kind}`, role: 'status' },
              h('span', null, notice.text),
              h('button', { type: 'button', 'aria-label': t('action.dismiss'), onClick: () => { setNotice(null) } }, '×')),
          body)
      }
    }

    /**
     * Build the request helpers used by the panel.
     * @returns token access and the Host calls.
     */
    function createApi() {
      const token = () => {
        try { return window.localStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' }
      }
      const request = async (path, init, params, soft) => {
        const headers = { ...(init?.headers ?? {}) }
        const current = token()
        if (current !== '') headers['x-github-token'] = current
        const response = await fetch(endpoint(path, params), { ...init, headers })
        const body = await response.json().catch(() => null)
        if (body === null) throw new Error(`HTTP ${String(response.status)}`)
        if (!response.ok || (soft !== true && body.ok === false)) {
          throw new Error(String(body.message ?? body.error ?? `HTTP ${String(response.status)}`))
        }
        return body
      }
      return {
        readToken: token,
        writeToken(value) {
          try {
            if (value === '') window.localStorage.removeItem(TOKEN_KEY)
            else window.localStorage.setItem(TOKEN_KEY, value)
          } catch {
            // Storage may be disabled; the page still works without the token.
          }
        },
        list: (column, refresh) => request('list', { method: 'GET' }, { column, refresh: refresh ? 1 : undefined }, true),
        installed: () => request('installed', { method: 'GET' }, {}),
        search: query => request('search', { method: 'GET' }, { q: query }, true),
        inspect: repo => request('inspect', { method: 'GET' }, { repo }),
        audit: async (repo, branch, refresh) => {
          const body = await request('audit', { method: 'GET' }, { repo, branch, refresh: refresh ? 1 : undefined })
          return body.audit
        },
        interpret: (repo, lang) => request('interpret', { method: 'GET' }, { repo, lang }),
        install: (repo, branch) => request('install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ repo, branch }),
        }, undefined, true),
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'github-discover: dictionaries')
        const t = ctx.locale.bind(NS)
        const api = createApi()
        const Panel = createPanel(api)
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: PANEL_ID, locale: NS,
        }, Panel))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 30, locale: NS,
          label: () => t('panel'),
        }, SidebarIcon))
      },
    }
  },
})