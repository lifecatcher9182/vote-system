const fs = require('fs');
const path = require('path');

// Primary와 Secondary를 교체하는 규칙
const swapReplacements = [
  // 먼저 임시 플레이스홀더로 변경
  [/bg-\[var\(--color-primary\)\]/g, 'TEMP_BG_PRIMARY'],
  [/text-\[var\(--color-primary\)\]/g, 'TEMP_TEXT_PRIMARY'],
  [/border-\[var\(--color-primary\)\]/g, 'TEMP_BORDER_PRIMARY'],
  
  [/bg-\[var\(--color-secondary\)\]/g, 'TEMP_BG_SECONDARY'],
  [/text-\[var\(--color-secondary\)\]/g, 'TEMP_TEXT_SECONDARY'],
  [/border-\[var\(--color-secondary\)\]/g, 'TEMP_BORDER_SECONDARY'],
  
  // 플레이스홀더를 교체된 값으로 변경
  [/TEMP_BG_PRIMARY/g, 'bg-[var(--color-secondary)]'],
  [/TEMP_TEXT_PRIMARY/g, 'text-[var(--color-secondary)]'],
  [/TEMP_BORDER_PRIMARY/g, 'border-[var(--color-secondary)]'],
  
  [/TEMP_BG_SECONDARY/g, 'bg-[var(--color-primary)]'],
  [/TEMP_TEXT_SECONDARY/g, 'text-[var(--color-primary)]'],
  [/TEMP_BORDER_SECONDARY/g, 'border-[var(--color-primary)]'],
];

// 파일 목록
const files = [
  'app/admin/dashboard/page.tsx',
  'app/admin/elections/page.tsx',
  'app/admin/elections/create/page.tsx',
  'app/admin/elections/[id]/page.tsx',
  'app/admin/elections/[id]/monitor/page.tsx',
  'app/admin/elections/[id]/results/page.tsx',
  'app/admin/results/page.tsx',
  'app/admin/settings/page.tsx',
  'app/admin/setup/page.tsx',
  'app/admin/villages/page.tsx',
  'app/admin/codes/page.tsx',
  'app/page.tsx',
  'app/vote/page.tsx',
  'app/vote/[code]/page.tsx',
  'app/vote/complete/page.tsx',
  'components/ColorThemeSettings.tsx',
  'components/LogoUploadSettings.tsx',
  'components/MainVoteQRCode.tsx',
  'components/QRCodeSection.tsx',
];

let successCount = 0;
let errorCount = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  try {
    // UTF-8로 파일 읽기
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 모든 색상 교체 적용
    swapReplacements.forEach(([pattern, replacement]) => {
      content = content.replace(pattern, replacement);
    });
    
    // UTF-8로 파일 쓰기
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`✅ ${file}`);
    successCount++;
  } catch (error) {
    console.error(`❌ ${file}: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n완료! 성공: ${successCount}, 실패: ${errorCount}`);
console.log('\n이제 Primary = 배경색, Secondary = 버튼색으로 사용됩니다!');
