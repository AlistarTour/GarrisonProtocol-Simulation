$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$gameFolder = Join-Path $projectRoot 'dist/卫戍协议-win32-x64'
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$archivePath = Join-Path $projectRoot ('dist/卫戍协议-' + $manifest.version + '-win32-x64.zip')
if (-not (Test-Path -LiteralPath (Join-Path $gameFolder '卫戍协议.exe'))) { throw 'Generate the portable EXE folder first.' }
& node (Join-Path $PSScriptRoot 'sync-package-docs.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Portable documentation sync failed.' }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fileStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$archive = [System.IO.Compression.ZipArchive]::new($fileStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
$fileCount = 0
try {
    foreach ($file in Get-ChildItem -LiteralPath $gameFolder -Recurse -File) {
        $relative = [System.IO.Path]::GetRelativePath($gameFolder, $file.FullName).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, ('卫戍协议-win32-x64/' + $relative), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $fileCount++
    }
} finally {
    $archive.Dispose()
    $fileStream.Dispose()
}
Write-Output "Portable ZIP: $archivePath"
Write-Output "Files: $fileCount"
Write-Output ('Size MB: ' + [math]::Round((Get-Item -LiteralPath $archivePath).Length / 1MB, 1))
