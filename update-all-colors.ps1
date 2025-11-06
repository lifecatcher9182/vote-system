# 모든 페이지의 색상을 메인/보조 컬러로 변환하는 스크립트

$files = @(
  "app\admin\elections\[id]\page.tsx",
  "app\admin\elections\[id]\monitor\page.tsx",
  "app\admin\elections\[id]\results\page.tsx"
)

foreach ($file in $files) {
  $path = Join-Path $PSScriptRoot $file
  if (Test-Path $path) {
    Write-Host "Processing: $file" -ForegroundColor Yellow
    
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    
    # Blue 색상들
    $content = $content -replace '\bborder-b-2 border-blue-600\b', 'border-b-2 border-[var(--color-primary)]'
    $content = $content -replace '\bbg-blue-600\b', 'bg-[var(--color-primary)]'
    $content = $content -replace '\bhover:bg-blue-700\b', 'hover:opacity-90'
    $content = $content -replace '\btext-blue-600\b', 'text-[var(--color-primary)]'
    $content = $content -replace '\bhover:text-blue-800\b', 'hover:opacity-80'
    $content = $content -replace '\bborder-blue-600\b', 'border-[var(--color-primary)]'
    $content = $content -replace '\bborder-blue-500\b', 'border-[var(--color-primary)]'
    $content = $content -replace '\bhover:border-blue-500\b', 'hover:border-[var(--color-primary)]'
    $content = $content -replace '\bbg-blue-50\b', 'bg-gray-50'
    $content = $content -replace '\btext-blue-800\b', 'text-gray-700'
    $content = $content -replace '\btext-blue-700\b', 'text-gray-600'
    $content = $content -replace '\btext-blue-900\b', 'text-gray-800'
    $content = $content -replace 'bg-blue-100 text-blue-800', 'bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)]'
    $content = $content -replace '\bhover:bg-blue-200\b', 'hover:opacity-80'
    $content = $content -replace '\bbg-blue-100\b', 'bg-[var(--color-primary)] bg-opacity-10'
    $content = $content -replace '\bbg-blue-400\b', 'bg-[var(--color-primary)]'
    $content = $content -replace '\bbg-blue-500\b', 'bg-[var(--color-primary)]'
    $content = $content -replace 'from-blue-300 to-blue-400 text-blue-900', 'from-gray-200 to-gray-300 text-gray-800'
    
    # Green 색상들
    $content = $content -replace '\btext-green-600\b', 'text-[var(--color-secondary)]'
    $content = $content -replace 'bg-green-100 text-green-800', 'bg-[var(--color-secondary)] bg-opacity-10 text-[var(--color-secondary)]'
    $content = $content -replace 'bg-green-100 text-green-700', 'bg-[var(--color-secondary)] bg-opacity-10 text-[var(--color-secondary)]'
    $content = $content -replace '\bbg-green-100\b', 'bg-[var(--color-secondary)] bg-opacity-10'
    $content = $content -replace '\bhover:bg-green-200\b', 'hover:opacity-80'
    $content = $content -replace '\btext-green-700\b', 'text-[var(--color-secondary)]'
    
    # Purple 색상들
    $content = $content -replace '\bbg-purple-600\b', 'bg-[var(--color-primary)]'
    $content = $content -replace '\bhover:bg-purple-700\b', 'hover:opacity-90'
    $content = $content -replace '\btext-purple-600\b', 'text-[var(--color-primary)]'
    $content = $content -replace 'bg-purple-100 text-purple-700', 'bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)]'
    $content = $content -replace '\bbg-purple-100\b', 'bg-[var(--color-primary)] bg-opacity-10'
    $content = $content -replace '\btext-purple-700\b', 'text-[var(--color-primary)]'
    $content = $content -replace '\bhover:bg-purple-200\b', 'hover:opacity-80'
    $content = $content -replace '\bhover:text-purple-900\b', 'hover:opacity-80'
    
    # Indigo 색상들
    $content = $content -replace '\bbg-indigo-600\b', 'bg-[var(--color-primary)]'
    $content = $content -replace '\bhover:bg-indigo-700\b', 'hover:opacity-90'
    $content = $content -replace '\btext-indigo-600\b', 'text-[var(--color-primary)]'
    $content = $content -replace 'bg-indigo-100 text-indigo-700', 'bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)]'
    $content = $content -replace '\bbg-indigo-100\b', 'bg-[var(--color-primary)] bg-opacity-10'
    $content = $content -replace '\btext-indigo-700\b', 'text-[var(--color-primary)]'
    $content = $content -replace '\bhover:bg-indigo-200\b', 'hover:opacity-80'
    $content = $content -replace '\bhover:text-indigo-900\b', 'hover:opacity-80'
    
    # Orange 색상들
    $content = $content -replace '\btext-orange-600\b', 'text-[var(--color-secondary)]'
    $content = $content -replace '\btext-orange-700\b', 'text-[var(--color-secondary)]'
    $content = $content -replace 'bg-orange-100 text-orange-700', 'bg-[var(--color-secondary)] bg-opacity-10 text-[var(--color-secondary)]'
    $content = $content -replace 'bg-orange-200 text-orange-800', 'bg-[var(--color-secondary)] bg-opacity-20 text-[var(--color-secondary)]'
    $content = $content -replace '\bbg-orange-100\b', 'bg-[var(--color-secondary)] bg-opacity-10'
    $content = $content -replace '\bbg-orange-200\b', 'bg-[var(--color-secondary)] bg-opacity-20'
    $content = $content -replace '\btext-orange-800\b', 'text-[var(--color-secondary)]'
    $content = $content -replace '\btext-orange-900\b', 'text-gray-800'
    $content = $content -replace 'from-orange-300 to-orange-400 text-orange-900', 'from-gray-200 to-gray-300 text-gray-800'
    
    [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
    Write-Host "✓ $file" -ForegroundColor Green
  } else {
    Write-Host "× $file (not found)" -ForegroundColor Red
  }
}

Write-Host "`n완료!" -ForegroundColor Cyan
