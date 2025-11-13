# 📦 프로젝트 정리 요약 (2025-11-13)

## 🎯 정리 목표

프로젝트 루트를 깔끔하게 정리하고, 관련 파일들을 적절한 폴더로 분류하여 유지보수성을 향상시킵니다.

---

## 📁 새로 생성된 폴더 구조

### `migrations/` - 데이터베이스 마이그레이션 파일 통합
루트에 흩어진 마이그레이션 파일들을 한 곳에 모아 관리합니다.

**이동된 파일:**
- ✅ `supabase-migration-v5-election-groups.sql` → `migrations/`
- ✅ `supabase-migration-remove-village-code.sql` → `migrations/`
- ✅ `supabase-migration-election-notes.sql` → `migrations/`
- ✅ `archive/add-is-active-column.sql` → `migrations/archive-add-is-active-column.sql`
- ✅ `archive/fix-votes-unique-constraint.sql` → `migrations/archive-fix-votes-unique-constraint.sql`

**루트에 유지:**
- `supabase-schema.sql` - 메인 스키마 파일 (설치 시 가장 먼저 실행)

### `docs/` - 문서 파일 통합
프로젝트 관련 모든 문서를 한 폴더에서 관리합니다.

**이동된 파일:**
- ✅ `TODO.md` → `docs/TODO.md` (개발 진행 상황 및 향후 계획)
- ✅ `MODAL_CONVERSION_GUIDE.md` → `docs/MODAL_CONVERSION_GUIDE.md` (모달 변환 가이드)

**기존 문서:**
- `GOOGLE_LOGIN_SETUP.md` - Google OAuth 설정 가이드
- `MIGRATION_GUIDE.md` - DB 마이그레이션 가이드
- `SETUP.md` - 프로젝트 초기 설정 가이드
- `UPDATE_SUMMARY.md` - 업데이트 내역

**루트에 유지:**
- `README.md` - 프로젝트 메인 문서 (필수)

### `archive/` - 구버전 파일 보관
더 이상 사용하지 않지만 참고용으로 보관하는 파일들입니다.

**현재 파일:**
- `supabase-migration-v2.sql` - v2 마이그레이션 (참고용)
- `supabase-migration-v3-anonymous-voting.sql` - v3 익명 투표 마이그레이션 (참고용)
- `supabase-migration-v4-villages-active.sql` - v4 마을 활성화 마이그레이션 (참고용)

---

## 📂 정리 후 루트 파일 구조

```
youth-election/
├── .env.local                          # 환경 변수
├── .gitignore                          # Git 제외 파일
├── eslint.config.mjs                   # ESLint 설정
├── middleware.ts                       # Next.js 미들웨어
├── next-env.d.ts                       # Next.js 타입 정의
├── next.config.ts                      # Next.js 설정
├── package.json                        # 프로젝트 의존성
├── package-lock.json                   # 의존성 잠금
├── postcss.config.mjs                  # PostCSS 설정
├── tsconfig.json                       # TypeScript 설정
├── README.md                           # 📖 프로젝트 소개 문서
├── supabase-schema.sql                 # 🗄️ 메인 DB 스키마
│
├── app/                                # Next.js 페이지
├── components/                         # React 컴포넌트
├── lib/                                # 유틸리티 & 훅
├── public/                             # 정적 파일
│
├── docs/                               # 📚 모든 문서 파일
│   ├── GOOGLE_LOGIN_SETUP.md
│   ├── MIGRATION_GUIDE.md
│   ├── MODAL_CONVERSION_GUIDE.md       # 신규 추가
│   ├── SETUP.md
│   ├── TODO.md                         # 신규 추가
│   ├── UPDATE_SUMMARY.md
│   └── CLEANUP_SUMMARY.md              # 이 파일
│
├── migrations/                         # 🔄 DB 마이그레이션 파일
│   ├── supabase-migration-v5-election-groups.sql
│   ├── supabase-migration-remove-village-code.sql
│   ├── supabase-migration-election-notes.sql
│   ├── archive-add-is-active-column.sql
│   └── archive-fix-votes-unique-constraint.sql
│
└── archive/                            # 📦 구버전 백업 파일
    ├── supabase-migration-v2.sql
    ├── supabase-migration-v3-anonymous-voting.sql
    └── supabase-migration-v4-villages-active.sql
```

---

## ✨ 정리 효과

### Before (정리 전)
- ❌ 루트에 16개 이상의 파일 (설정, SQL, 문서 등 혼재)
- ❌ 마이그레이션 파일 5개가 루트와 archive에 분산
- ❌ 문서 파일 7개가 루트와 docs에 분산
- ❌ 어떤 파일이 중요한지 한눈에 파악 어려움

### After (정리 후)
- ✅ 루트에 11개의 핵심 파일만 유지 (설정 + README + 메인 스키마)
- ✅ 모든 마이그레이션 파일 → `migrations/` 폴더에 통합
- ✅ 모든 문서 파일 → `docs/` 폴더에 통합
- ✅ 구버전 파일 → `archive/` 폴더에 보관
- ✅ 깔끔하고 체계적인 프로젝트 구조
- ✅ 유지보수 및 협업 용이

---

## 🗂️ 폴더별 용도

### 핵심 폴더
- **`app/`** - Next.js 페이지 및 라우팅
- **`components/`** - 재사용 가능한 React 컴포넌트
- **`lib/`** - 유틸리티 함수, 훅, 타입 정의
- **`public/`** - 정적 파일 (이미지, 폰트 등)

### 정리 폴더
- **`docs/`** - 모든 프로젝트 문서 (가이드, 할 일 목록, 업데이트 내역)
- **`migrations/`** - DB 마이그레이션 파일 (순차 실행 필요)
- **`archive/`** - 구버전 파일 (참고용, 실제 사용 안 함)

### 설정 파일 (루트)
- **Next.js**: `next.config.ts`, `next-env.d.ts`, `middleware.ts`
- **TypeScript**: `tsconfig.json`
- **ESLint**: `eslint.config.mjs`
- **PostCSS**: `postcss.config.mjs`
- **패키지**: `package.json`, `package-lock.json`
- **Git**: `.gitignore`
- **환경변수**: `.env.local`

---

## 📝 마이그레이션 실행 순서

### 신규 설치 시
```sql
-- 1단계: 기본 스키마 (필수)
supabase-schema.sql

-- 2단계: 투표 그룹 기능 (필수)
migrations/supabase-migration-v5-election-groups.sql

-- 3단계: 투표 비고 기능 (선택)
migrations/supabase-migration-election-notes.sql

-- 4단계: 마을 코드 제거 (선택, 필요 시)
migrations/supabase-migration-remove-village-code.sql
```

### 기존 설치에서 업데이트 시
필요한 마이그레이션만 `migrations/` 폴더에서 선택하여 실행하세요.

---

## 🔄 Git 커밋 제안

```bash
git add .
git commit -m "chore: 프로젝트 구조 정리

- migrations/ 폴더 생성 및 마이그레이션 파일 통합
- docs/ 폴더로 문서 파일 이동 (TODO.md, MODAL_CONVERSION_GUIDE.md)
- archive 폴더의 SQL 파일 migrations로 통합
- 루트 파일 16개 → 11개로 정리
- CLEANUP_SUMMARY.md 작성 및 README.md 업데이트
- 깔끔하고 유지보수하기 쉬운 구조로 개선"

git push origin main
```

---

## 📅 정리 일자

**작업 일자**: 2025년 11월 13일  
**작업 내용**: 폴더 구조 재정리, 파일 이동 및 통합  
**목적**: 프로젝트 유지보수성 향상 및 협업 용이성 증대

---

## 💡 참고사항

- **`supabase-schema.sql`**은 신규 설치 시 가장 먼저 실행해야 하므로 루트에 유지합니다.
- **`README.md`**는 프로젝트의 진입점이므로 항상 루트에 있어야 합니다.
- **`migrations/`** 폴더의 파일들은 순서대로 실행해야 할 수 있으니 파일명에 버전/날짜를 포함하는 것이 좋습니다.
- **`archive/`** 폴더의 파일들은 실제로 사용하지 않지만, 과거 마이그레이션 이력을 참고하기 위해 보관합니다.

---

## ✅ 정리 완료 체크리스트

- [x] `migrations/` 폴더 생성
- [x] 루트의 마이그레이션 파일 3개 이동
- [x] archive의 SQL 파일 2개 이동
- [x] `TODO.md` → docs/ 이동
- [x] `MODAL_CONVERSION_GUIDE.md` → docs/ 이동
- [x] `CLEANUP_SUMMARY.md` 작성
- [x] `README.md` 업데이트
- [ ] Git 커밋 및 푸시

---

**다음 단계**: README.md를 업데이트하여 새로운 폴더 구조를 반영하고, Git에 커밋하세요! 🚀
