const fs = require('fs');
const path = require('path');

// 색상 변환 규칙
const colorReplacements = [
  // Blue -> Primary
  [/\bbg-blue-600\b/g, 'bg-[var(--color-primary)]'],
  [/\bhover:bg-blue-700\b/g, 'hover:opacity-90'],
  [/\btext-blue-600\b/g, 'text-[var(--color-primary)]'],
  [/\bhover:text-blue-800\b/g, 'hover:opacity-80'],
  [/\bhover:text-blue-900\b/g, 'hover:opacity-80'],
  [/\bborder-blue-600\b/g, 'border-[var(--color-primary)]'],
  [/\bborder-blue-500\b/g, 'border-[var(--color-primary)]'],
  [/\bhover:border-blue-500\b/g, 'hover:border-[var(--color-primary)]'],
  [/\bborder-b-2 border-blue-600\b/g, 'border-b-2 border-[var(--color-primary)]'],
  [/\bbg-blue-50\b/g, 'bg-gray-50'],
  [/\btext-blue-800\b/g, 'text-gray-700'],
  [/\btext-blue-700\b/g, 'text-gray-600'],
  [/\btext-blue-900\b/g, 'text-gray-800'],
  [/\bbg-blue-100 text-blue-800\b/g, 'bg-[var(--color-primary)] bg-opacity-10 text-gray-700'],
  [/\bbg-blue-100\b/g, 'bg-[var(--color-primary)] bg-opacity-10'],
  
  // Green -> Secondary
  [/\bbg-green-600\b/g, 'bg-[var(--color-secondary)]'],
  [/\bhover:bg-green-700\b/g, 'hover:opacity-90'],
  [/\btext-green-600\b/g, 'text-[var(--color-secondary)]'],
  [/\btext-green-700\b/g, 'text-[var(--color-secondary)]'],
  [/\bborder-green-500\b/g, 'border-[var(--color-secondary)]'],
  [/\bbg-green-100 text-green-800\b/g, 'bg-[var(--color-secondary)] bg-opacity-10 text-[var(--color-secondary)]'],
  [/\bbg-green-100 text-green-700\b/g, 'bg-[var(--color-secondary)] bg-opacity-10 text-[var(--color-secondary)]'],
  [/\bbg-green-100\b/g, 'bg-[var(--color-secondary)] bg-opacity-10'],
  [/\bbg-green-50\b/g, 'bg-gray-50'],
  
  // Purple -> Primary
  [/\bbg-purple-600\b/g, 'bg-[var(--color-primary)]'],
  [/\bhover:bg-purple-700\b/g, 'hover:opacity-90'],
  [/\btext-purple-600\b/g, 'text-[var(--color-primary)]'],
  [/\btext-purple-700\b/g, 'text-[var(--color-primary)]'],
  [/\bhover:text-purple-900\b/g, 'hover:opacity-80'],
  [/\bbg-purple-100 text-purple-700\b/g, 'bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)]'],
  [/\bbg-purple-100\b/g, 'bg-[var(--color-primary)] bg-opacity-10'],
  [/\bbg-purple-50\b/g, 'bg-gray-50'],
  
  // Indigo -> Primary  
  [/\bbg-indigo-600\b/g, 'bg-[var(--color-primary)]'],
  [/\bhover:bg-indigo-700\b/g, 'hover:opacity-90'],
  [/\btext-indigo-600\b/g, 'text-[var(--color-primary)]'],
  [/\btext-indigo-700\b/g, 'text-[var(--color-primary)]'],
  [/\bhover:text-indigo-900\b/g, 'hover:opacity-80'],
  [/\bbg-indigo-100 text-indigo-700\b/g, 'bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)]'],
  [/\bbg-indigo-100\b/g, 'bg-[var(--color-primary)] bg-opacity-10'],
  
  // Orange -> Secondary
  [/\btext-orange-600\b/g, 'text-[var(--color-secondary)]'],
  [/\btext-orange-700\b/g, 'text-[var(--color-secondary)]'],
  [/\bbg-orange-100 text-orange-700\b/g, 'bg-[var(--color-secondary)] bg-opacity-10 text-[var(--color-secondary)]'],
  [/\bbg-orange-100\b/g, 'bg-[var(--color-secondary)] bg-opacity-10'],
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
    
    // 모든 색상 변환 적용
    colorReplacements.forEach(([pattern, replacement]) => {
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
