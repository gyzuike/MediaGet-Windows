param([string]$RuntimeFromExe = '', [switch]$SkipWebBuild, [switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$work = Join-Path $root '.work'
$stage = Join-Path $work 'windows-stage'
$base = Join-Path $work 'runtime-base'
$assets = Join-Path $work 'assets'
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $work,$assets,$dist,(Join-Path $work 'tmp') | Out-Null
$env:TMP = Join-Path $work 'tmp'; $env:TEMP = $env:TMP
function Clean-LocalDirectory([string]$target) {
    $full = [IO.Path]::GetFullPath($target)
    if (!$full.StartsWith($work + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing cleanup outside .work: $full" }
    if (Test-Path -LiteralPath $full) { Remove-Item -LiteralPath $full -Recurse -Force }
    New-Item -ItemType Directory -Path $full -Force | Out-Null
}
function Run-Npm([string[]]$Arguments) {
    $before = $env:NODE_OPTIONS
    try {
        $retry = (Join-Path $PSScriptRoot 'mkdir-retry.cjs').Replace('\','/')
        $env:NODE_OPTIONS = (($before + ' --require="' + $retry + '"').Trim())
        & npm.cmd @Arguments
        if ($LASTEXITCODE -ne 0) { throw "npm command failed: $($Arguments -join ' ')" }
    } finally { $env:NODE_OPTIONS = $before }
}
function Download-Checked([string]$url, [string]$target, [string]$expected) {
    if (Test-Path -LiteralPath $target) {
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $expected) { return }
        Remove-Item -LiteralPath $target -Force
    }
    Write-Host ('Downloading ' + ([Uri]$url).Host)
    $options = @{ Uri=$url; OutFile=$target; UseBasicParsing=$true }
    if ($env:HTTPS_PROXY) { $options.Proxy = $env:HTTPS_PROXY }
    Invoke-WebRequest @options
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $expected) { throw "SHA256 mismatch: $target" }
}
Push-Location $root
try {
    if (!(Get-Command node -ErrorAction SilentlyContinue) -or !(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22+ with npm first.' }
    if (!$SkipInstall) { Run-Npm -Arguments @('ci','--no-audit','--no-fund'); Run-Npm -Arguments @('ci','--prefix','desktop','--no-audit','--no-fund') }
    if (!$SkipWebBuild) {
        $savedNodeOptions = $env:NODE_OPTIONS
        try {
            # This retry is scoped to the build process; it handles transient Windows mkdir EPERM.
            $retry = (Join-Path $PSScriptRoot 'mkdir-retry.cjs').Replace('\','/')
            $env:NODE_OPTIONS = (($savedNodeOptions + ' --require="' + $retry + '"').Trim())
            $env:NEXT_TELEMETRY_DISABLED = '1'
            Run-Npm -Arguments @('run','build')
        } finally { $env:NODE_OPTIONS = $savedNodeOptions }
    }
    $standalone = Join-Path $root '.next\standalone'
    if (!(Test-Path -LiteralPath (Join-Path $standalone 'server.js'))) { throw 'Next.js standalone build is missing.' }
    Clean-LocalDirectory $base
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if ($RuntimeFromExe) {
        # Reuse trusted runtime binaries only. Fresh sources replace all application/server code below.
        $assembly = [Reflection.Assembly]::LoadFile((Resolve-Path -LiteralPath $RuntimeFromExe).Path)
        $stream = $assembly.GetManifestResourceStream('payload.zip')
        if (!$stream) { throw 'The selected EXE is not a MediaGet single-file build.' }
        try {
            $zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Read)
            foreach ($entry in $zip.Entries) {
                $name = $entry.FullName.Replace('\','/')
                if ($name.StartsWith('resources/server/') -or ($name.StartsWith('resources/app/') -and !$name.StartsWith('resources/app/tools/'))) { continue }
                $target = [IO.Path]::GetFullPath((Join-Path $base $name))
                if (!$target.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid archive path.' }
                if (!$entry.Name) { New-Item -ItemType Directory -Path $target -Force | Out-Null; continue }
                New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$true)
            }
            $zip.Dispose()
        } finally { $stream.Dispose() }
    } else {
        $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-assets.json') -Raw | ConvertFrom-Json
        $checksums = Get-Content -LiteralPath (Join-Path $root 'desktop\node_modules\electron\checksums.json') -Raw | ConvertFrom-Json
        $electronZip = Join-Path $assets 'electron-v42.0.0-win32-x64.zip'
        Download-Checked $manifest.electron.url $electronZip $checksums.'electron-v42.0.0-win32-x64.zip'
        Expand-Archive -LiteralPath $electronZip -DestinationPath $base -Force
        $tools = Join-Path $base 'resources\app\tools'; New-Item -ItemType Directory -Path $tools -Force | Out-Null
        Download-Checked $manifest.ytdlp.url (Join-Path $tools 'yt-dlp.exe') $manifest.ytdlp.sha256
        $ffmpegArchive = Join-Path $assets 'ffmpeg-9.0.2-essentials_build.7z'
        Download-Checked $manifest.ffmpeg.url $ffmpegArchive $manifest.ffmpeg.sha256
        $unpacked = Join-Path $work 'ffmpeg-unpacked'; Clean-LocalDirectory $unpacked
        & tar.exe -xf $ffmpegArchive -C $unpacked
        if ($LASTEXITCODE -ne 0) { throw 'FFmpeg extraction failed. Windows tar.exe with 7z support is required.' }
        $ffmpegRoot = Join-Path $unpacked 'ffmpeg-9.0.2-essentials_build'
        Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'bin\ffmpeg.exe'),(Join-Path $ffmpegRoot 'bin\ffprobe.exe') -Destination $tools
        Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'LICENSE') -Destination (Join-Path $tools 'LICENSE-FFmpeg.txt')
        Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'README.txt') -Destination (Join-Path $tools 'README-FFmpeg.txt')
        foreach ($notice in $manifest.ytdlp.notices) { Download-Checked $notice.url (Join-Path $tools $notice.name) $notice.sha256 }
    }
    # Keep the development runtime named electron.exe so Electron reports app.isPackaged=false.
    if (Test-Path -LiteralPath (Join-Path $base 'MediaGet.exe')) { Rename-Item -LiteralPath (Join-Path $base 'MediaGet.exe') -NewName 'electron.exe' }
    Clean-LocalDirectory $stage
    Get-ChildItem -LiteralPath $base -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }
    if (Test-Path -LiteralPath (Join-Path $stage 'electron.exe')) { Rename-Item -LiteralPath (Join-Path $stage 'electron.exe') -NewName 'MediaGet.exe' }
    $app = Join-Path $stage 'resources\app'; New-Item -ItemType Directory -Path $app -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $root 'desktop') -File | Where-Object { ($_.Extension -eq '.cjs' -and $_.Name -notlike '*.test.cjs' -and $_.Name -ne 'start.cjs') -or $_.Name -eq 'package.json' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $app -Force }
    New-Item -ItemType Directory -Path (Join-Path $app 'node_modules') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'desktop\node_modules\undici') -Destination (Join-Path $app 'node_modules\undici') -Recurse -Force
    $server = Join-Path $stage 'resources\server'
    Copy-Item -LiteralPath $standalone -Destination $server -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $root 'public') -Destination (Join-Path $server 'public') -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $root '.next\static') -Destination (Join-Path $server '.next\static') -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination (Join-Path $stage 'LICENSE-MediaGet.txt') -Force
    $payload = Join-Path $work 'payload.zip'
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $payload -CompressionLevel Optimal -Force
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    if (!(Test-Path -LiteralPath $compiler)) { throw '.NET Framework C# compiler was not found.' }
    $exe = Join-Path $dist 'MediaGet-Windows-x64.exe'
    & $compiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$exe" "/resource:$payload,payload.zip" "/win32icon:$(Join-Path $root 'desktop\MediaGet.ico')" /reference:System.IO.Compression.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $root 'desktop\Launcher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'EXE compilation failed.' }
    ((Get-FileHash -LiteralPath $exe).Hash+'  MediaGet-Windows-x64.exe') | Set-Content -LiteralPath (Join-Path $dist 'SHA256.txt') -Encoding UTF8
    Write-Host "Built: $exe"
} finally { Pop-Location }

