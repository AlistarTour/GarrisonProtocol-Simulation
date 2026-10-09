$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dependencyRoot = Join-Path $projectRoot 'dist/port-3001-dependencies'
if (-not (Test-Path -LiteralPath (Join-Path $dependencyRoot 'node_modules/ws/package.json'))) {
    throw '请先在 dist/port-3001-dependencies 中使用生产版 package.json 和锁文件完成 npm ci --omit=dev。'
}
$archivePath = Join-Path $projectRoot 'dist/卫戍协议-3001修复包.zip'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
try {
    foreach ($name in @('server/index.js', 'server/net.js', 'public/js/net.js', 'Dockerfile', 'ecosystem.config.cjs', 'package-lock.json')) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectRoot $name), $name, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $dependencyRoot 'package.json'), 'package.json', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectRoot 'deployment/云服务器部署说明.md'), '部署说明.md', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $dependencyRoot 'node_modules') -Recurse -File) {
        $relative = [System.IO.Path]::GetRelativePath($dependencyRoot, $file.FullName).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $archive.Dispose()
    $stream.Dispose()
}
Write-Output "Repair package: $archivePath"
