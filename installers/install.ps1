$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Assert-Digest([string] $Path, [string] $Expected) {
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -cne $Expected) { throw "checksum mismatch: $([IO.Path]::GetFileName($Path))" }
}

$version = if ($env:ROOTFORM_VERSION) { $env:ROOTFORM_VERSION } else { '@ROOTFORM_VERSION@' }
if ($version -cnotmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$') {
    throw "invalid release version: $version"
}
$architecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
if ($architecture -ne 'X64') { throw "unsupported Windows architecture: $architecture" }
$asset = "rootform_${version}_windows_amd64.zip"
$manifestName = "rootform_${version}_manifest.json"
$base = if ($env:ROOTFORM_RELEASE_BASE_URL) { $env:ROOTFORM_RELEASE_BASE_URL.TrimEnd('/') } else {
    "https://github.com/rootform-dev/rootform/releases/download/v$version"
}
$uri = [Uri] $base
if (($uri.Scheme -ne 'https' -and -not ($uri.Scheme -eq 'http' -and $uri.Host -in @('localhost', '127.0.0.1', '::1'))) -or
    $uri.UserInfo -or $uri.Query -or $uri.Fragment) {
    throw 'release URL must use HTTPS or localhost HTTP'
}

$work = Join-Path ([IO.Path]::GetTempPath()) ("rootform-install-" + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $work -ErrorAction Stop
try {
    $sumsPath = Join-Path $work 'SHA256SUMS'
    $manifestPath = Join-Path $work $manifestName
    $archivePath = Join-Path $work $asset
    Invoke-WebRequest -Uri "$base/SHA256SUMS" -OutFile $sumsPath -MaximumRedirection 5 -UseBasicParsing
    Invoke-WebRequest -Uri "$base/$manifestName" -OutFile $manifestPath -MaximumRedirection 5 -UseBasicParsing
    Invoke-WebRequest -Uri "$base/$asset" -OutFile $archivePath -MaximumRedirection 5 -UseBasicParsing

    $checksums = @{}
    foreach ($line in [IO.File]::ReadAllLines($sumsPath)) {
        if ($line -cnotmatch '^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$') { throw 'invalid release checksum metadata' }
        if ($checksums.ContainsKey($Matches[2])) { throw 'duplicate release checksum metadata' }
        $checksums[$Matches[2]] = $Matches[1]
    }
    if (-not $checksums.ContainsKey($asset) -or -not $checksums.ContainsKey($manifestName)) {
        throw 'missing release checksum metadata'
    }
    Assert-Digest $manifestPath $checksums[$manifestName]
    Assert-Digest $archivePath $checksums[$asset]
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.format_version -cne '1' -or $manifest.product.name -cne 'rootform' -or
        $manifest.product.version -cne $version -or $manifest.product.tag -cne "v$version") {
        throw 'invalid release version metadata'
    }
    $record = @($manifest.artifacts | Where-Object { $_.asset -ceq $asset })
    if ($record.Count -ne 1 -or $record[0].sha256 -cne $checksums[$asset]) {
        throw 'release archive metadata drifted'
    }

    $archiveStream = [IO.File]::OpenRead($archivePath)
    try {
        if ($archiveStream.Length -lt 22) { throw 'corrupted archive' }
        $magic = New-Object byte[] 4
        $null = $archiveStream.Read($magic, 0, 4)
        if ([BitConverter]::ToUInt32($magic, 0) -ne 0x04034b50) { throw 'corrupted archive' }
        $null = $archiveStream.Seek(-22, [IO.SeekOrigin]::End)
        $null = $archiveStream.Read($magic, 0, 4)
        if ([BitConverter]::ToUInt32($magic, 0) -ne 0x06054b50) { throw 'corrupted archive' }
    } finally { $archiveStream.Dispose() }

    $zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        $expected = @('rootform.exe', 'ROOTFORM-BINARY-LICENSE.txt', 'SHA256SUMS', 'THIRD_PARTY_NOTICES.txt', "rootform_${version}_sbom.spdx.json")
        $names = @($zip.Entries | ForEach-Object { $_.FullName })
        if ($names.Count -ne $expected.Count -or @($names | Where-Object { $_ -cnotin $expected }).Count -ne 0 -or
            @($names | Select-Object -Unique).Count -ne $expected.Count) {
            throw 'unexpected archive contents'
        }
        $entry = $zip.GetEntry('rootform.exe')
        if ($null -eq $entry -or $entry.Length -le 0) { throw 'archive executable is missing' }
        $extracted = Join-Path $work 'rootform.exe'
        $inputStream = $entry.Open()
        try {
            $outputStream = [IO.File]::Create($extracted)
            try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose() }
        } finally { $inputStream.Dispose() }
    } finally { $zip.Dispose() }
    & $extracted version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'downloaded executable cannot run' }

    $destination = if ($env:ROOTFORM_INSTALL_DIR) { $env:ROOTFORM_INSTALL_DIR } else {
        Join-Path $env:LOCALAPPDATA 'Programs\Rootform'
    }
    if (-not [IO.Path]::IsPathRooted($destination)) { throw 'installation directory must be absolute' }
    $null = New-Item -ItemType Directory -Path $destination -Force
    $staged = Join-Path $destination ('.rootform-' + [Guid]::NewGuid().ToString('N') + '.exe')
    try {
        [IO.File]::Copy($extracted, $staged, $false)
        $target = Join-Path $destination 'rootform.exe'
        if ([IO.File]::Exists($target)) {
            $backup = Join-Path $work 'previous-rootform.exe'
            [IO.File]::Replace($staged, $target, $backup)
        } else {
            [IO.File]::Move($staged, $target)
        }
    } finally {
        if ([IO.File]::Exists($staged)) { [IO.File]::Delete($staged) }
    }
    if ($env:ROOTFORM_INSTALL_DIR) {
        $env:PATH = "$destination;$env:PATH"
    } else {
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        if (@($userPath -split ';') -notcontains $destination) {
            [Environment]::SetEnvironmentVariable('Path', "$userPath;$destination".TrimStart(';'), 'User')
        }
        $env:PATH = "$destination;$env:PATH"
    }
    Write-Host "Installed Rootform $version to $target"
    Write-Host 'Run rootform version to verify. New shells inherit the updated user PATH.'
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
