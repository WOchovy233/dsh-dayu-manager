/**
 * Static health check for one repository.
 *
 * Answers, from the repository's own source and its published metadata: where a
 * prompt would be sent, which other hosts the plugin talks to, whether it wants
 * a login or a key, which files it writes, whether it runs programs, whether it
 * is the original project or a copy, and whether a same-named package exists
 * somewhere else.
 *
 * This is a heuristic reading of the source, not a sandbox: it never runs the
 * plugin. Its verdict says what the code declares and how suspicious that is,
 * which is exactly what a person needs before installing a stranger's bundle.
 */
import { gunzipSync } from 'node:zlib'

/** Hosts that are model providers themselves, as opposed to relays standing in front of one. */
const MODEL_HOSTS = new Set([
  'api.openai.com', 'api.anthropic.com', 'api.deepseek.com', 'api.x.ai',
  'generativelanguage.googleapis.com', 'aiplatform.googleapis.com',
  'api.openai.azure.com', 'openrouter.ai', 'api.siliconflow.cn', 'api.groq.com',
  'api.cerebras.ai', 'api.together.xyz', 'api.together.ai', 'api.mistral.ai',
  'api.fireworks.ai', 'api.zhipuai.cn', 'open.bigmodel.cn', 'dashscope.aliyuncs.com',
  'ark.cn-beijing.volces.com', 'api.minimax.chat', 'api.moonshot.cn',
  'qianfan.baidubce.com', 'api.cohere.ai', 'api.cohere.com', 'api.lingyiwanwu.com',
  'api.stepfun.com', 'api.baichuan-ai.com', 'api.hunyuan.cloud.tencent.com',
  'integrate.api.nvidia.com', 'api.nvidia.com', 'api.sambanova.ai', 'api.nebius.ai',
  'api.chutes.ai', 'api.hyperbolic.xyz', 'api.scaleway.ai', 'api.githubcopilot.com',
])

/** Hosts that belong to the project's own distribution channel rather than to a third party. */
const GITHUB_HOSTS = new Set([
  'github.com', 'api.github.com', 'raw.githubusercontent.com', 'codeload.github.com',
  'objects.githubusercontent.com', 'gist.github.com', 'gist.githubusercontent.com',
])

/** Paths that make a URL a model endpoint even when the host is unknown. */
const MODEL_PATH = /\/(?:v1|v1beta|api\/paas\/v4|chat\/completions|messages|responses|completions|embeddings)\b/i

const TEXT_FILE = /\.(?:js|mjs|cjs|jsx|ts|tsx|json|yml|yaml|toml|py|bat|cmd)$/i
/** Directories whose contents never explain what the installed plugin does. */
const SKIP_PATH = /(?:^|\/)(?:node_modules|\.git|\.github|test|tests|__tests__|fixtures|scripts?|docs?|examples?|images?|assets?|screenshots?)\//i
/** Lockfiles only list dependencies' tarball URLs. */
const SKIP_FILE = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json)$/i

const MAX_FILE_BYTES = 400_000
const MAX_FILES = 400
const TARBALL_TIMEOUT_MS = 30_000

/** Read a NUL-terminated ASCII field from a tar header. */
function tarField(header, offset, length) {
  let end = offset
  const limit = offset + length
  while (end < limit && header[end] !== 0) end += 1
  return header.toString('utf8', offset, end)
}

/**
 * Parse a gzipped GitHub archive into its text files.
 * @param buffer - the gzip payload.
 * @returns the archive's source files, keyed without the archive's root directory.
 */
function parseArchive(buffer) {
  const tar = gunzipSync(buffer)
  const files = []
  let offset = 0
  while (offset + 512 <= tar.length && files.length < MAX_FILES) {
    const header = tar.subarray(offset, offset + 512)
    const name = tarField(header, 0, 100)
    if (name === '') break
    const prefix = tarField(header, 345, 155)
    const path = (prefix === '' ? name : `${prefix}/${name}`).replace(/^[^/]+\//, '')
    const size = Number.parseInt(tarField(header, 124, 12).trim(), 8) || 0
    const type = String.fromCharCode(header[156] || 48)
    const dataStart = offset + 512
    const data = tar.subarray(dataStart, dataStart + size)
    offset = dataStart + Math.ceil(size / 512) * 512
    if (type !== '0' && type !== '\u0000') continue
    if (path === '' || SKIP_PATH.test(path) || SKIP_FILE.test(path) || !TEXT_FILE.test(path)) continue
    if (size === 0 || size > MAX_FILE_BYTES) continue
    files.push({ path, text: data.toString('utf8') })
  }
  return files
}

/**
 * Read one repository's archive, trying the conventional branch names.
 *
 * The default branch is usually known from the panel, but a check must still
 * work when GitHub's metadata quota is exhausted, so a 404 falls back to the
 * two names almost every repository uses.
 * @param fullName - `owner/name`.
 * @param branch - the branch the caller believes is the default.
 * @returns the archive's text files and the branch that answered.
 */
async function fetchSource(fullName, branch) {
  const candidates = [branch, 'main', 'master']
    .filter((value, index, all) => typeof value === 'string' && value !== '' && all.indexOf(value) === index)
  let lastError = '未知错误'
  for (const candidate of candidates) {
    const encoded = encodeURIComponent(candidate).replaceAll('%2F', '/')
    const url = `https://codeload.github.com/${fullName}/tar.gz/refs/heads/${encoded}`
    let response
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(url, {
          headers: { 'user-agent': 'dsh-github-discover', accept: 'application/octet-stream' },
          signal: AbortSignal.timeout(TARBALL_TIMEOUT_MS),
        })
        break
      } catch (error) {
        // codeload occasionally drops a TLS handshake. Retry the same branch
        // once before moving on, otherwise a transient failure can be masked
        // by the expected 404 from the next fallback branch.
        lastError = `源码包下载失败：${String(error?.message ?? error)}`
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350))
      }
    }
    if (response === undefined) continue
    if (response.status === 404) {
      lastError = `分支 ${candidate} 不存在`
      continue
    }
    if (!response.ok) throw new Error(`源码包下载失败（HTTP ${response.status}）`)
    return { files: parseArchive(Buffer.from(await response.arrayBuffer())), branch: candidate }
  }
  throw new Error(`源码包下载失败：${lastError}`)
}

/**
 * Determine whether a file is a minified or bundled artifact.
 *
 * Bundles contain base64 payloads and `eval` for legitimate reasons, so the
 * obfuscation checks must not read them as evidence of hiding.
 * @param text - one file's source.
 * @returns true when the file is clearly machine-generated.
 */
function looksBundled(text) {
  if (text.length < 20_000) return false
  return text.length / Math.max(text.split('\n').length, 1) > 400
}

/** Normalize a repository URL to `owner/name`. */
function repoSlug(url) {
  if (typeof url !== 'string' || url === '') return undefined
  const cleaned = url.replace(/^git\+/, '').replace(/\.git$/, '').replace(/#.*$/, '')
  const match = /github\.com[/:]([\w.-]+)\/([\w.-]+)/i.exec(cleaned)
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : undefined
}

/**
 * Read a package's registry record.
 * @param name - the package name.
 * @returns its publication facts, or why they could not be read.
 */
async function readNpm(name) {
  if (typeof name !== 'string' || name.trim() === '') return { status: 'unknown' }
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name.trim())}`, {
      headers: { accept: 'application/json', 'user-agent': 'dsh-github-discover' },
      signal: AbortSignal.timeout(12_000),
    })
    if (response.status === 404) return { status: 'absent' }
    if (!response.ok) return { status: 'unknown', code: response.status }
    const data = await response.json()
    const latest = data['dist-tags']?.latest
    const version = latest ? data.versions?.[latest] : undefined
    const repository = version?.repository ?? data.repository
    return {
      status: 'published',
      latest,
      repository: repoSlug(typeof repository === 'string' ? repository : repository?.url),
      publishedAt: latest ? data.time?.[latest] : undefined,
    }
  } catch (error) {
    return { status: 'unknown', error: String(error?.message ?? error) }
  }
}

/** Collect every http(s) URL mentioned in the scanned text. */
function collectUrls(files) {
  const urls = new Map()
  for (const file of files) {
    for (const match of file.text.matchAll(/https?:\/\/[^\s"'`<>()[\]{}\\$]+/g)) {
      const url = match[0].replace(/[.,;:]+$/, '')
      const known = urls.get(url)
      if (known) known.count += 1
      else urls.set(url, { url, count: 1, file: file.path })
    }
  }
  return [...urls.values()]
}

/** Read a host out of one URL, ignoring template placeholders and documentation domains. */
function hostOf(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (/(?:^|\.)(?:example\.(?:com|org|net)|invalid|localhost)$/.test(host)) return undefined
    return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+$/.test(host) ? host : undefined
  } catch {
    return undefined
  }
}

/** Collapse one host to a short, displayable class. */
function classifyHost(host, urls) {
  if (/^(?:127\.|localhost$|0\.0\.0\.0$|\[::1\])/.test(host)) return 'local'
  if (MODEL_HOSTS.has(host)) return 'model-official'
  if ([...MODEL_HOSTS].some(known => host.endsWith(`.${known}`))) return 'model-official'
  if (GITHUB_HOSTS.has(host)) return 'github'
  if (urls.some(entry => MODEL_PATH.test(entry.url))) return 'model-relay'
  if (/^(?:login|auth|accounts?|sso|oauth)\./.test(host)) return 'login'
  if (/analytics|telemetry|sentry|bugsnag|umami|clarity|statistic|hm\.baidu|google-analytics/i.test(host)) return 'analytics'
  return 'other'
}

/** Name a write destination from the line that performs it. */
function writeScope(line) {
  if (/DSH_HOME|['"`]\.dsh\b/i.test(line)) return 'dsh'
  if (/tmpdir|cyber-egg|\.cache/i.test(line)) return 'cache'
  if (/settings\.json|cordis\.patch|profiles?\//i.test(line)) return 'config'
  if (/homedir|AppData|Program\s+Files|\/etc\/|\.bashrc|\.zshrc|Startup|registry|schtasks|System32/i.test(line)) return 'system'
  return 'other'
}

/**
 * Decide whether an offset sits inside a quoted string on its own line.
 *
 * Prompt text and documentation strings routinely contain words like `eval(`;
 * without this guard the scanner reads prose as code.
 * @param text - the file's source.
 * @param index - the offset to test.
 * @returns true when the offset is inside a single-line string literal.
 */
function insideString(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1
  let quote = ''
  for (let position = lineStart; position < index; position += 1) {
    const character = text[position]
    if (quote !== '') {
      if (character === '\\') { position += 1; continue }
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'" || character === '`') quote = character
  }
  return quote !== ''
}

const SCOPE_TEXT = {
  dsh: 'DSH 数据目录',
  cache: '临时或缓存目录',
  config: 'DSH 配置',
  other: '仓库内的相对路径',
  system: '用户主目录或系统位置',
}

/**
 * Grade one repository.
 * @param input - the repository, its metadata and its manifest.
 * @returns the verdict, the checks a person reads, and the structured facts behind them.
 */
export async function auditRepository(input) {
  const { fullName, branch } = input
  let { meta, pkg } = input
  const checks = []
  let files = []
  let scanError
  let usedBranch = branch
  try {
    const source = await fetchSource(fullName, branch)
    files = source.files
    usedBranch = source.branch
  } catch (error) {
    scanError = String(error?.message ?? error)
  }

  // The manifest ships inside the archive, so a check needs no GitHub API quota.
  if (pkg === undefined) {
    const manifest = files.find(file => file.path === 'package.json')
    if (manifest !== undefined) {
      try { pkg = JSON.parse(manifest.text) } catch { pkg = undefined }
    }
  }

  const scanned = files.reduce((total, file) => total + file.text.length, 0)
  const sourceCode = files.filter(file => /\.(?:js|mjs|cjs|jsx|ts|tsx|py|bat|cmd)$/i.test(file.path) && !looksBundled(file.text))
  const allText = files.map(file => file.text).join('\n')

  // --- where the words go -------------------------------------------------
  const urls = collectUrls(files)
  const byHost = new Map()
  for (const entry of urls) {
    const host = hostOf(entry.url)
    if (host === undefined) continue
    const list = byHost.get(host) ?? []
    list.push(entry)
    byHost.set(host, list)
  }
  const endpoints = [...byHost.entries()].map(([host, list]) => ({
    host,
    kind: classifyHost(host, list),
    samples: list.slice(0, 2).map(entry => entry.url.slice(0, 120)),
    count: list.reduce((total, entry) => total + entry.count, 0),
  })).sort((left, right) => right.count - left.count)

  const modelEndpoints = endpoints.filter(entry => entry.kind === 'model-official' || entry.kind === 'model-relay')
  const relayEndpoints = modelEndpoints.filter(entry => entry.kind === 'model-relay')
  if (modelEndpoints.length === 0) {
    checks.push({
      id: 'endpoint.model', level: 'info', title: '没有自己发起的模型请求',
      detail: '源码里没有找到模型接口地址：它要么不调用模型，要么把请求交给 DSH 统一处理。',
      evidence: [],
    })
  } else if (relayEndpoints.length === 0) {
    checks.push({
      id: 'endpoint.model', level: 'green', title: '你的内容发往官方模型接口',
      detail: `只连官方模型域名：${modelEndpoints.map(entry => entry.host).join('、')}。`,
      evidence: modelEndpoints.flatMap(entry => entry.samples).slice(0, 4),
    })
  } else {
    checks.push({
      id: 'endpoint.model', level: 'yellow', title: '你的内容会经非官方中转',
      detail: `出现不在官方名单里的模型地址：${relayEndpoints.map(entry => entry.host).join('、')}。中转方能看到完整对话。`,
      evidence: relayEndpoints.flatMap(entry => entry.samples).slice(0, 4),
    })
  }

  const otherHosts = endpoints.filter(entry => entry.kind !== 'model-official' && entry.kind !== 'model-relay')
  if (otherHosts.length > 0) {
    const KIND_TEXT = { github: '检查更新 / 拉取代码', login: '登录与授权', analytics: '统计上报', local: '本机服务', other: '其他服务' }
    const hosts = otherHosts.filter(entry => entry.kind !== 'local')
    if (hosts.length > 0) {
      checks.push({
        id: 'endpoint.other',
        level: hosts.some(entry => entry.kind === 'analytics') ? 'yellow' : 'info',
        title: `除模型外还连 ${hosts.length} 个外部域名`,
        detail: hosts.slice(0, 8).map(entry => `${entry.host}（${KIND_TEXT[entry.kind]}）`).join('；'),
        evidence: hosts.flatMap(entry => entry.samples).slice(0, 4),
      })
    }
  }

  // --- login and keys -----------------------------------------------------
  const credentialRefs = [...new Set([...allText.matchAll(/\b[A-Z][A-Z0-9]{2,}_(?:API_KEY|APIKEY|ACCESS_TOKEN|AUTH_TOKEN|GITHUB_TOKEN|CLIENT_SECRET|SECRET_KEY)\b/g)].map(match => match[0]))].slice(0, 6)
  const loginHosts = endpoints.filter(entry => entry.kind === 'login').map(entry => entry.host)
  const localeFiles = files.filter(file => /locale\/[^/]+\.json$/i.test(file.path))
  const localeText = localeFiles.map(file => file.text).join('\n')
  const claimsNoLogin = /无需登录|免登录|无需注册|no\s+login|no\s+sign-?up|without\s+(?:a\s+)?key/i.test(`${localeText}\n${allText}`)
  const needsCredential = credentialRefs.length > 0 || loginHosts.length > 0
  checks.push({
    id: 'credential',
    level: needsCredential ? 'yellow' : 'green',
    title: needsCredential ? '会读写凭据（可能要登录或填 Key）' : '不需要登录，也不需要自己的 Key',
    detail: needsCredential
      ? [
        credentialRefs.length > 0 ? `凭据项：${credentialRefs.join('、')}` : '',
        loginHosts.length > 0 ? `登录域名：${loginHosts.join('、')}` : '',
        claimsNoLogin ? '（但文案声称免登录，安装前值得核对）' : '',
      ].filter(Boolean).join('；')
      : (claimsNoLogin ? '源码没有读取凭据，文案也声明免登录。' : '源码没有读取凭据。'),
    evidence: credentialRefs,
  })

  // --- files it writes ----------------------------------------------------
  const writeSamples = []
  for (const file of sourceCode) {
    for (const line of file.text.split('\n')) {
      if (!/(?:writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream|mkdirSync|mkdir|renameSync|rename|unlinkSync|unlink|rmSync|copyFileSync|copyFile)\s*\(/.test(line)) continue
      writeSamples.push({ file: file.path, line: line.trim().slice(0, 150), scope: writeScope(line) })
      if (writeSamples.length >= 60) break
    }
  }
  const systemWrites = writeSamples.filter(sample => sample.scope === 'system')
  const scopes = [...new Set(writeSamples.map(sample => SCOPE_TEXT[sample.scope]))]
  if (writeSamples.length === 0) {
    checks.push({ id: 'write', level: 'green', title: '不改动本机文件', detail: '源码里没有找到写文件调用。', evidence: [] })
  } else if (systemWrites.length > 0) {
    checks.push({
      id: 'write', level: 'red', title: '会写到用户主目录或系统位置',
      detail: `写文件位置不在 DSH 自己的数据目录里：${systemWrites.length} 处。`,
      evidence: systemWrites.slice(0, 4).map(sample => `${sample.file}: ${sample.line}`),
    })
  } else {
    checks.push({
      id: 'write', level: 'yellow', title: '会写本机文件',
      detail: `写文件 ${writeSamples.length} 处，涉及：${scopes.join('、')}。属于正常落盘，但确实会留下数据。`,
      evidence: writeSamples.slice(0, 4).map(sample => `${sample.file}: ${sample.line}`),
    })
  }

  // --- programs it runs ---------------------------------------------------
  const execSamples = []
  const processFiles = sourceCode.filter(file => /(?:from\s+['"]node:child_process['"]|require\(\s*['"](?:node:)?child_process['"]|from\s+['"]execa['"]|require\(\s*['"]execa['"])/.test(file.text))
  for (const file of processFiles) {
    for (const line of file.text.split('\n')) {
      if (/\b(?:execSync|execFileSync|execFile|spawnSync|spawn|execa)\s*\(|shell\s*:\s*true/.test(line)) {
        execSamples.push(`${file.path}: ${line.trim().slice(0, 150)}`)
      }
    }
  }
  for (const file of sourceCode) {
    for (const line of file.text.split('\n')) {
      if (/\b(?:powershell|cmd\.exe|reg\s+add|schtasks|certutil|wmic)\b|bash\s+-c/i.test(line)) {
        execSamples.push(`${file.path}: ${line.trim().slice(0, 150)}`)
      }
    }
  }
  const execUnique = [...new Set(execSamples)].slice(0, 8)
  checks.push({
    id: 'exec',
    level: execUnique.length > 0 ? 'yellow' : 'green',
    title: execUnique.length > 0 ? '会启动关键程序或执行命令' : '不启动外部程序',
    detail: execUnique.length > 0
      ? `找到 ${execUnique.length} 处进程调用：这类能力可以很正当（装依赖、调 Git），也能做别的事，装之前要知道。`
      : '源码里没有找到子进程或 shell 调用。',
    evidence: execUnique.slice(0, 4),
  })

  // --- hidden behaviour ---------------------------------------------------
  // Decoding image payloads with `Buffer.from(x, 'base64')` or `atob` is ordinary,
  // so only dynamic code evaluation and oversized literals count here.
  const obfuscation = []
  for (const file of sourceCode) {
    const pattern = /\beval\s*\(|\bnew\s+Function\s*\(/gi
    let hit
    let flagged = false
    while ((hit = pattern.exec(file.text)) !== null) {
      // A string literal that merely talks about eval is not dynamic execution.
      if (insideString(file.text, hit.index)) continue
      flagged = true
      const from = Math.max(0, hit.index - 60)
      obfuscation.push(`${file.path}: ${file.text.slice(from, hit.index + 100).replace(/\s+/g, ' ').trim()}`)
      break
    }
    if (flagged) continue
    const literal = /['"][A-Za-z0-9+/=\s]{1500,}['"]/.exec(file.text)
    if (literal !== null) obfuscation.push(`${file.path}: 超长 base64 字面量（${literal[0].length} 字符）`)
  }
  const dangerous = obfuscation.length > 0 && (execUnique.length > 0 || writeSamples.length > 0)
  checks.push({
    id: 'obfuscation',
    level: dangerous ? 'red' : (obfuscation.length > 0 ? 'yellow' : 'green'),
    title: dangerous ? '有编码/混淆 + 执行或写盘的组合' : (obfuscation.length > 0 ? '有编码或动态执行' : '没有混淆'),
    detail: dangerous
      ? '检测到动态执行或编码载荷，同时又具备执行命令或写文件的能力，这是"藏东西"的典型组合。'
      : (obfuscation.length > 0 ? '出现动态执行或 base64 解码，可能合法也可能藏逻辑。' : '没有发现 eval、动态 Function 或大片编码内容。'),
    evidence: obfuscation.slice(0, 4),
  })

  // --- who wrote it -------------------------------------------------------
  const declaredRepo = repoSlug(typeof pkg?.repository === 'string' ? pkg.repository : pkg?.repository?.url)
  const actualRepo = fullName.toLowerCase()
  const npm = await readNpm(pkg?.name)
  const origin = {
    fork: meta?.fork === true,
    parent: meta?.parent?.full_name,
    ownerType: meta?.owner?.type,
    createdAt: meta?.created_at,
    repositoryField: declaredRepo,
    packageName: pkg?.name,
    npm,
  }

  if (meta === undefined) {
    checks.push({
      id: 'origin.fork', level: 'info', title: '没读到仓库元数据',
      detail: 'GitHub 接口额度用尽或仓库不可读，fork 状态未知；其余结论仍然只来自源码。',
      evidence: [],
    })
  } else if (origin.fork) {
    checks.push({
      id: 'origin.fork', level: 'yellow', title: '这是一个 fork',
      detail: `原仓库是 ${origin.parent ?? '未知'}。fork 本身正常，但代码可能被改过，维护者也不是原班人马。`,
      evidence: [],
    })
  } else {
    checks.push({
      id: 'origin.fork', level: 'green', title: '不是 fork',
      detail: `仓库由 ${fullName.split('/')[0]} 自己维护。`,
      evidence: [],
    })
  }

  if (declaredRepo !== undefined && declaredRepo !== actualRepo) {
    checks.push({
      id: 'origin.declared', level: 'red', title: '包里写的仓库地址是别处',
      detail: `package.json 声明仓库为 ${declaredRepo}，但你现在看的是 ${actualRepo} —— 可能是改包或复刻。`,
      evidence: [declaredRepo],
    })
  } else if (declaredRepo === undefined) {
    checks.push({
      id: 'origin.declared', level: 'info', title: '没声明来源仓库',
      detail: 'package.json 没有 repository 字段，无法用清单反查作者。',
      evidence: [],
    })
  } else {
    checks.push({
      id: 'origin.declared', level: 'green', title: '清单声明的仓库就是这里',
      detail: 'package.json 的 repository 指向当前仓库，作者与包一致。',
      evidence: [],
    })
  }

  if (npm.status === 'published') {
    if (npm.repository !== undefined && npm.repository !== actualRepo) {
      checks.push({
        id: 'origin.npm', level: 'red', title: 'npm 上的同名包属于别人',
        detail: `npm 上 ${pkg?.name} 指向 ${npm.repository}，不是你正在看的这个仓库 —— 典型抢注或复刻，装它可能装到另一份代码。`,
        evidence: [`npm ${pkg?.name}@${npm.latest} → ${npm.repository}`],
      })
    } else if (npm.repository === actualRepo) {
      checks.push({
        id: 'origin.npm', level: 'green', title: 'npm 同名包就是本仓库',
        detail: `npm ${pkg?.name}@${npm.latest} 的仓库字段与这里一致，来源可追溯。`,
        evidence: [npm.publishedAt ? `发布于 ${npm.publishedAt}` : ''],
      })
    } else {
      checks.push({
        id: 'origin.npm', level: 'info', title: 'npm 上有同名包，来源未声明',
        detail: `npm 上存在 ${pkg?.name}@${npm.latest}，但没写仓库地址，无法核对是否同一份代码。`,
        evidence: [],
      })
    }
  } else if (npm.status === 'absent') {
    checks.push({
      id: 'origin.npm', level: 'info', title: '没有发布到 npm',
      detail: '只能从 GitHub 源码安装，不存在"同名包"混淆的问题，也意味着没有第三方 registry 审核。',
      evidence: [],
    })
  }

  // --- verdict ------------------------------------------------------------
  // Without source there is no evidence, and no evidence is never "green".
  const noEvidence = files.length === 0
  if (noEvidence) {
    checks.push({
      id: 'scan', level: 'info', title: '没读到源码',
      detail: scanError ? `${scanError}。没读到代码就不下结论。` : '源码包是空的，没读到代码就不下结论。',
      evidence: [],
    })
  }
  const reds = checks.filter(check => check.level === 'red')
  const yellows = checks.filter(check => check.level === 'yellow')
  const verdict = noEvidence ? 'unknown' : (reds.length > 0 ? 'red' : (yellows.length > 0 ? 'yellow' : 'green'))
  const summary = noEvidence
    ? '无法体检：没有读到源码'
    : reds.length > 0
      ? `红灯：${reds.map(check => check.title).join('；')}`
      : yellows.length > 0
        ? `黄灯：${yellows.map(check => check.title).join('；')}`
        : '绿灯：没有发现需要警惕的行为'

  return {
    repo: fullName,
    branch: usedBranch,
    verdict,
    summary,
    checks,
    facts: {
      package: pkg === undefined ? null : {
        name: typeof pkg.name === 'string' ? pkg.name : undefined,
        version: typeof pkg.version === 'string' ? pkg.version : undefined,
        description: typeof pkg.description === 'string' ? pkg.description : undefined,
        license: typeof pkg.license === 'string' ? pkg.license : undefined,
        dependencyCount: pkg.dependencies !== null && typeof pkg.dependencies === 'object' ? Object.keys(pkg.dependencies).length : 0,
        scriptCount: pkg.scripts !== null && typeof pkg.scripts === 'object' ? Object.keys(pkg.scripts).length : 0,
      },
      repoInfo: meta === undefined ? null : {
        stars: Number(meta.stargazers_count ?? 0),
        forks: Number(meta.forks_count ?? 0),
        language: typeof meta.language === 'string' ? meta.language : undefined,
        license: typeof meta.license?.spdx_id === 'string' ? meta.license.spdx_id : undefined,
        archived: meta.archived === true,
        fork: meta.fork === true,
        topics: Array.isArray(meta.topics) ? meta.topics.slice(0, 8) : [],
        pushedAt: typeof meta.pushed_at === 'string' ? meta.pushed_at : undefined,
        updatedAt: typeof meta.updated_at === 'string' ? meta.updated_at : undefined,
        createdAt: typeof meta.created_at === 'string' ? meta.created_at : undefined,
      },
      endpoints: endpoints.slice(0, 24),
      modelHosts: modelEndpoints.map(entry => entry.host),
      relayHosts: relayEndpoints.map(entry => entry.host),
      needsCredential,
      credentialRefs,
      claimsNoLogin,
      writeCount: writeSamples.length,
      writeSamples: writeSamples.slice(0, 6).map(sample => `${sample.file}: ${sample.line}`),
      systemWrites: systemWrites.slice(0, 4).map(sample => `${sample.file}: ${sample.line}`),
      execSamples: execUnique,
      obfuscation: obfuscation.slice(0, 4),
      providesTools: /(?:ctx\.)?tools\.register\s*\(/.test(allText),
      origin,
    },
    scan: {
      files: files.length,
      bytes: scanned,
      error: scanError,
      at: Date.now(),
    },
  }
}
