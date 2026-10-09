$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputDirectory = Join-Path $projectRoot 'dist'
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$archivePath = Join-Path $outputDirectory '卫戍协议-云服务器部署包.zip'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fileStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$archive = [System.IO.Compression.ZipArchive]::new($fileStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
$fileCount = 0
try {
    foreach ($directory in @('server', 'shared', 'data', 'public')) {
        $sourceDirectory = Join-Path $projectRoot $directory
        foreach ($file in Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File) {
            $relative = [System.IO.Path]::GetRelativePath($projectRoot, $file.FullName).Replace('\', '/')
            if ($relative -match '^(server/server/|shared/shared/|data/data/)') { continue }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, ('covenant-server/' + $relative), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            $fileCount++
        }
    }
    # Cloud panels may derive the default entry point from package.json.
    $manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
    $manifest.main = 'server/index.js'
    $manifest.scripts = [pscustomobject]@{ start = 'node server/index.js' }
    $manifest.PSObject.Properties.Remove('devDependencies')
    $manifestEntry = $archive.CreateEntry('covenant-server/package.json', [System.IO.Compression.CompressionLevel]::Optimal)
    $manifestWriter = [System.IO.StreamWriter]::new($manifestEntry.Open(), [System.Text.UTF8Encoding]::new($false))
    try { $manifestWriter.Write(($manifest | ConvertTo-Json -Depth 30)) } finally { $manifestWriter.Dispose() }
    $fileCount++
    foreach ($name in @('package-lock.json', 'Dockerfile', '.dockerignore', 'ecosystem.config.cjs')) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectRoot $name), ('covenant-server/' + $name), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $fileCount++
    }
    $guide = Join-Path $projectRoot 'deployment/云服务器部署说明.md'
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $guide, 'covenant-server/部署说明.md', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    $fileCount++
    $licenseDirectory = Join-Path $projectRoot 'research/apk/full/licenses'
    foreach ($license in Get-ChildItem -LiteralPath $licenseDirectory -File) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $license.FullName, ('covenant-server/licenses/' + $license.Name), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $fileCount++
    }
} finally {
    $archive.Dispose()
    $fileStream.Dispose()
}
Write-Output "Server package: $archivePath"
Write-Output "Files: $fileCount"
Write-Output ('Size MB: ' + [math]::Round((Get-Item -LiteralPath $archivePath).Length / 1MB, 1))
