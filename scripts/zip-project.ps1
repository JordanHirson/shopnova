# ======================================
# ShopNova Review ZIP Script
#
# Run with:
# .\scripts\zip-project.ps1
#
# Creates a review ZIP excluding:
# - node_modules
# - .next
# - .git
# - .vercel
# - .env*
# ======================================

$ProjectName = "shopnova"

$Timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"

$ZipName = "$ProjectName-review-$Timestamp.zip"

$TempFolder = Join-Path $env:TEMP "$ProjectName-review-temp"

# Clean old temp folder
if (Test-Path $TempFolder) {
    Remove-Item $TempFolder -Recurse -Force
}

# Copy project
Copy-Item "." $TempFolder -Recurse

# Folders to exclude
$ExcludeFolders = @(
    "node_modules",
    ".next",
    ".git",
    ".vercel",
    ".turbo",
    "coverage",
    "dist",
    "build"
)

foreach ($folder in $ExcludeFolders) {
    Get-ChildItem $TempFolder -Directory -Recurse |
        Where-Object { $_.Name -eq $folder } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Files to exclude
$ExcludeFiles = @(
    ".env",
    ".env.local",
    ".env.development.local",
    ".env.production.local",
    ".env.test.local"
)

foreach ($file in $ExcludeFiles) {
    Get-ChildItem $TempFolder -File -Recurse |
        Where-Object { $_.Name -eq $file } |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

# Create ZIP
Compress-Archive -Path "$TempFolder\*" -DestinationPath $ZipName -Force

# Clean temp
Remove-Item $TempFolder -Recurse -Force

# Keep only newest 5 review ZIPs
Get-ChildItem "*.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 5 |
    Remove-Item -Force

Write-Host ""
Write-Host "======================================"
Write-Host " Review ZIP created successfully!"
Write-Host "======================================"
Write-Host ""
Write-Host $ZipName
Write-Host ""