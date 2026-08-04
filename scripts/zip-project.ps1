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
# - .turbo
# - coverage
# - dist
# - build
# - .env*
# ======================================

$ProjectName = "shopnova"

# Folder where review ZIPs are stored
$ReviewFolder = "C:\Users\jorda\OneDrive\Documents\Codeeza Project\ShopNova Reviews"

# Create the review folder if it doesn't exist
if (!(Test-Path $ReviewFolder)) {
    New-Item -ItemType Directory -Path $ReviewFolder | Out-Null
}

$Timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"

$ZipName = "$ProjectName-review-$Timestamp.zip"

$ZipPath = Join-Path $ReviewFolder $ZipName

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
    ".env.test.local",
    "*.zip",
    "*.7z",
    "*.tsbuildinfo"
)

foreach ($pattern in $ExcludeFiles) {
    Get-ChildItem $TempFolder -File -Recurse -Filter $pattern -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

# Create ZIP
Compress-Archive -Path "$TempFolder\*" -DestinationPath $ZipPath -Force

# Clean temp folder
Remove-Item $TempFolder -Recurse -Force

# Keep only the newest 10 review ZIPs
Get-ChildItem $ReviewFolder -Filter "*.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 10 |
    Remove-Item -Force

Write-Host ""
Write-Host "======================================"
Write-Host " Review ZIP created successfully!"
Write-Host "======================================"
Write-Host ""
Write-Host "Location:"
Write-Host $ZipPath
Write-Host ""