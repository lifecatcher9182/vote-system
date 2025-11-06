# 전체 프로젝트에 테마 색상 적용 스크립트

$files = Get-ChildItem -Path ".\app" -Recurse -Include *.tsx
$files += Get-ChildItem -Path ".\components" -Recurse -Include *.tsx

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Primary color (파란색) → CSS 변수
    $content = $content -replace 'bg-blue-600', 'bg-[var(--color-primary)]'
    $content = $content -replace 'hover:bg-blue-700', 'hover:opacity-90'
    $content = $content -replace 'text-blue-600', 'text-[var(--color-primary)]'
    $content = $content -replace 'border-blue-600', 'border-[var(--color-primary)]'
    $content = $content -replace 'border-blue-500', 'border-[var(--color-primary)]'
    $content = $content -replace 'hover:border-blue-500', 'hover:border-[var(--color-primary)]'
    $content = $content -replace 'hover:text-blue-800', 'hover:opacity-80'
    $content = $content -replace 'hover:text-blue-900', 'hover:opacity-80'
    
    # Info boxes (파란색 배경)
    $content = $content -replace 'bg-blue-50', 'bg-gray-50'
    $content = $content -replace 'text-blue-800', 'text-gray-700'
    $content = $content -replace 'text-blue-700', 'text-gray-600'
    $content = $content -replace 'border-blue-200', 'border-gray-200'
    
    # 로딩 스피너
    $content = $content -replace 'border-blue-600', 'border-[var(--color-primary)]'
    
    # Secondary color (초록색) → CSS 변수
    $content = $content -replace 'bg-green-500', 'bg-[var(--color-secondary)]'
    $content = $content -replace 'text-green-500', 'text-[var(--color-secondary)]'
    $content = $content -replace 'border-green-500', 'border-[var(--color-secondary)]'
    
    Set-Content $file.FullName $content -NoNewline
    Write-Host "Updated: $($file.Name)"
}

Write-Host "`n완료! 모든 파일의 색상이 테마 변수로 변경되었습니다." -ForegroundColor Green
