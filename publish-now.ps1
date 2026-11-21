param(
  [string]$Owner = 'WOchovy233',
  [string]$Repo = 'dsh-dayu-manager',
  [string]$RepoDir = $PSScriptRoot,
  [string]$TokenFile = (Join-Path $env:USERPROFILE '.dsh-dayu-manager.cred'),
  [switch]$PromptToken,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$UA = 'dsh-dayu-manager-publisher'
$api = 'https://api.github.com'

function Read-PackageVersion {
  $packagePath = Join-Path $RepoDir 'package.json'
  if (-not (Test-Path $packagePath)) { throw "package.json not found: $packagePath" }
  $package = Get-Content -Raw -Encoding utf8 -LiteralPath $packagePath | ConvertFrom-Json
  if (-not $package.version) { throw 'package.json has no version field' }
  return [string]$package.version
}

function Get-AllFiles {
  param([string]$Root)
  Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Where-Object {
    $relative = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
    $relative -notmatch '^\.git/' -and
    $relative -notmatch '^node_modules/' -and
    $relative -notmatch '^\.dsh-dayu-manager\.cred$' -and
    $relative -notmatch '^\.gh-token' -and
    $relative -notmatch '(^|/).*\.log$' -and
    $relative -notmatch '(^|/)\.DS_Store$'
  } | ForEach-Object {
    [pscustomobject]@{
      Relative = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
      FullName = $_.FullName
      Bytes    = [System.IO.File]::ReadAllBytes($_.FullName)
    }
  }
}

function Get-GitBlobSha {
  param([byte[]]$Bytes)
  $header = [System.Text.Encoding]::ASCII.GetBytes("blob $($Bytes.Length)`0")
  $all = New-Object byte[] ($header.Length + $Bytes.Length)
  [Array]::Copy($header, 0, $all, 0, $header.Length)
  [Array]::Copy($Bytes, 0, $all, $header.Length, $Bytes.Length)
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try { return ([BitConverter]::ToString($sha1.ComputeHash($all)) -replace '-', '').ToLowerInvariant() }
  finally { $sha1.Dispose() }
}

function Invoke-GitHub {
  param(
    [string]$Method,
    [string]$Path,
    $Body,
    [switch]$AllowNotFound,
    [switch]$AllowUnborn
  )
  $headers = @{
    'User-Agent' = $UA
    'Accept' = 'application/vnd.github+json'
    'Authorization' = "Bearer $script:Token"
    'X-GitHub-Api-Version' = '2022-11-28'
  }
  $params = @{
    Uri = "$api$Path"
    Method = $Method
    Headers = $headers
    UseBasicParsing = $true
    TimeoutSec = 60
  }
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 20 -Compress
    $params.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    $params.ContentType = 'application/json; charset=utf-8'
  }
  try {
    $response = Invoke-WebRequest @params
    if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
    return ($response.Content | ConvertFrom-Json)
  } catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    $detail = ''
    if ($_.Exception.Response) {
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $detail = $reader.ReadToEnd()
      } catch { $detail = '' }
    }
    if ($AllowNotFound -and $status -eq 404) { return $null }
    # GitHub returns 409 for a valid repository that has no commits yet.
    if ($AllowUnborn -and $status -eq 409) { return $null }
    throw "GitHub API $Method $Path failed ($status): $detail"
  }
}

$Version = Read-PackageVersion
$tagName = "v$Version"
$files = @(Get-AllFiles $RepoDir | Sort-Object Relative)
if ($files.Count -eq 0) { throw 'Repository directory is empty' }

Write-Host '============================================================'
Write-Host "  Dayu Manager $Version"
Write-Host "  -> https://github.com/$Owner/$Repo"
Write-Host '============================================================'
Write-Host "files: $($files.Count)"
if ($DryRun) {
  $files | ForEach-Object { Write-Host ('  {0} ({1} bytes)' -f $_.Relative, $_.Bytes.Length) }
  Write-Host 'dry-run only; nothing uploaded'
  exit 0
}

if (-not $PromptToken -and (Test-Path -LiteralPath $TokenFile)) {
  try {
    $secure = Get-Content -Raw -LiteralPath $TokenFile | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $script:Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  } catch {
    Write-Warning 'Saved token could not be read; enter it again.'
  }
}

if ([string]::IsNullOrWhiteSpace($script:Token)) {
  Write-Host 'A GitHub Personal Access Token (classic, repo scope) is required.'
  $secure = Read-Host -AsSecureString 'Paste GitHub token (input hidden)'
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $script:Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ([string]::IsNullOrWhiteSpace($script:Token)) { throw 'token is empty' }
  $encrypted = ConvertFrom-SecureString -SecureString $secure
  Set-Content -LiteralPath $TokenFile -Value $encrypted -Encoding ascii
  Write-Host "Token encrypted for current Windows user: $TokenFile"
}

if ($script:Token -notmatch '^(ghp_|github_pat_|gho_|ghu_|ghs_)') { throw 'Token prefix does not look like a GitHub token' }

$user = Invoke-GitHub -Method GET -Path '/user'
if ($user.login -ne $Owner) { throw "Token belongs to $($user.login), not target owner $Owner" }
Write-Host "authenticated as $($user.login)"

$repoInfo = Invoke-GitHub -Method GET -Path "/repos/$Owner/$Repo" -AllowNotFound
if (-not $repoInfo) {
  Write-Host "creating repository $Owner/$Repo"
  $repoInfo = Invoke-GitHub -Method POST -Path '/user/repos' -Body @{
    name = $Repo
    description = "Dayu Manager: DSH plugin discovery, install decisions and local source audits."
    private = $false
    has_issues = $true
    has_wiki = $false
    has_discussions = $false
  }
} else {
  Write-Host "repository exists: $($repoInfo.html_url)"
}

$branch = [string]$repoInfo.default_branch
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'main' }
$hasCommit = $null -ne (Invoke-GitHub -Method GET -Path "/repos/$Owner/$Repo/git/ref/heads/$branch" -AllowNotFound -AllowUnborn)
$message = "release $Version"

foreach ($file in $files) {
  $escapedPath = (($file.Relative -split '/') | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
  $existing = $null
  if ($hasCommit) {
    $existing = Invoke-GitHub -Method GET -Path "/repos/$Owner/$Repo/contents/$escapedPath?ref=$branch" -AllowNotFound
    if ($existing -and $existing.sha -eq (Get-GitBlobSha $file.Bytes)) {
      Write-Host "  unchanged $($file.Relative)"
      continue
    }
  }
  $body = @{
    message = $message
    content = [Convert]::ToBase64String($file.Bytes)
  }
  if ($hasCommit) {
    $body.branch = $branch
    if ($existing -and $existing.sha) { $body.sha = $existing.sha }
  }
  $null = Invoke-GitHub -Method PUT -Path "/repos/$Owner/$Repo/contents/$escapedPath" -Body $body
  Write-Host "  committed $($file.Relative)"
  $hasCommit = $true
}

$ref = Invoke-GitHub -Method GET -Path "/repos/$Owner/$Repo/git/ref/heads/$branch" -AllowNotFound
if (-not $ref) { throw "Upload finished but branch $branch was not found" }
$commitSha = [string]$ref.object.sha
Write-Host "head: $commitSha"

$existingTag = Invoke-GitHub -Method GET -Path "/repos/$Owner/$Repo/git/ref/tags/$tagName" -AllowNotFound
if ($existingTag) {
  $null = Invoke-GitHub -Method PATCH -Path "/repos/$Owner/$Repo/git/refs/tags/$tagName" -Body @{ sha = $commitSha; force = $true }
  Write-Host "tag updated: $tagName"
} else {
  $null = Invoke-GitHub -Method POST -Path "/repos/$Owner/$Repo/git/refs" -Body @{ ref = "refs/tags/$tagName"; sha = $commitSha }
  Write-Host "tag created: $tagName"
}

$releaseNotesPath = Join-Path $RepoDir 'RELEASE_NOTES.md'
$notes = if (Test-Path -LiteralPath $releaseNotesPath) {
  Get-Content -Raw -Encoding utf8 -LiteralPath $releaseNotesPath
} else {
  "Dayu Manager $Version"
}
$release = Invoke-GitHub -Method GET -Path "/repos/$Owner/$Repo/releases/tags/$tagName" -AllowNotFound
if ($release) {
  $null = Invoke-GitHub -Method PATCH -Path "/repos/$Owner/$Repo/releases/$($release.id)" -Body @{
    name = "Dayu Manager $tagName"
    body = $notes
    draft = $false
    prerelease = $false
  }
  Write-Host "release updated: $($release.id)"
} else {
  $release = Invoke-GitHub -Method POST -Path "/repos/$Owner/$Repo/releases" -Body @{
    tag_name = $tagName
    name = "Dayu Manager $tagName"
    body = $notes
    draft = $false
    prerelease = $false
  }
  Write-Host "release created: $($release.id)"
}

$topics = @('dsh-plugin', 'deepseek-harness', 'dsh', 'plugin-discovery', 'security-audit')
try {
  $null = Invoke-GitHub -Method PUT -Path "/repos/$Owner/$Repo/topics" -Body @{ names = $topics }
  Write-Host "topics: $($topics -join ', ')"
} catch {
  Write-Warning "topics update failed: $($_.Exception.Message)"
}

Write-Host ''
Write-Host "Repository: https://github.com/$Owner/$Repo"
Write-Host "Release:    https://github.com/$Owner/$Repo/releases/tag/$tagName"
