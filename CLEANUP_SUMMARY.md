# 코드 정리 요약 (2025-11-11)

## 🗑️ 삭제된 파일

### 사용하지 않는 컴포넌트
- `components/MainVoteQRCode.tsx` - 어디서도 import되지 않는 컴포넌트

### Deprecated 페이지
- `app/admin/elections/page.tsx` - 그룹 기반 워크플로우로 대체됨
- `app/admin/results/page.tsx` - 그룹 기반 워크플로우로 대체됨

### 임시 SQL 파일
- `admin-email-insert.sql`
- `check-migration.sql`
- `create-increment-function.sql`
- `fix-voter-codes-policy.sql`
- `supabase-update.sql`

### 사용하지 않는 스크립트
- `apply-theme-colors.ps1`
- `update-all-colors.ps1`

## 📦 Archive로 이동된 파일

구버전 마이그레이션 파일들을 `archive/` 폴더로 이동:
- `supabase-migration-v2.sql`
- `supabase-migration-v3-anonymous-voting.sql`
- `supabase-migration-v4-villages-active.sql`

**현재 사용 중인 마이그레이션**: `supabase-migration-v5-election-groups.sql`

## 📚 Docs로 이동된 파일

문서 파일들을 `docs/` 폴더로 정리:
- `GOOGLE_LOGIN_SETUP.md`
- `MIGRATION_GUIDE.md`
- `SETUP.md`
- `UPDATE_SUMMARY.md`

## 📁 현재 루트 파일 구조

```
├── .env.local                              # 환경 변수 (gitignore)
├── .gitignore                              # Git 제외 파일 목록
├── eslint.config.mjs                       # ESLint 설정
├── middleware.ts                           # Next.js 미들웨어
├── next-env.d.ts                          # Next.js 타입 정의
├── next.config.ts                         # Next.js 설정
├── package.json                           # 프로젝트 의존성
├── package-lock.json                      # 의존성 잠금 파일
├── postcss.config.mjs                     # PostCSS 설정
├── README.md                              # 프로젝트 소개 (업데이트됨)
├── supabase-migration-v5-election-groups.sql  # 최신 DB 마이그레이션
├── supabase-schema.sql                    # DB 스키마 정의
├── TODO.md                                # 개발 진행 상황
├── tsconfig.json                          # TypeScript 설정
├── CLEANUP_SUMMARY.md                     # 이 파일
├── app/                                   # Next.js 페이지
├── components/                            # React 컴포넌트
├── lib/                                   # 유틸리티 함수
├── public/                                # 정적 파일
├── archive/                               # 구버전 파일 백업
└── docs/                                  # 프로젝트 문서
```

## ✅ 정리 효과

### Before
- 루트에 19개의 파일 (SQL, PS1, MD 등 혼재)
- 사용하지 않는 컴포넌트 1개
- Deprecated 페이지 2개
- 임시 SQL 파일 5개
- 구버전 마이그레이션 3개
- 문서 파일 4개가 루트에 흩어져 있음

### After
- 루트에 14개의 핵심 파일만 유지
- 사용하지 않는 코드 완전 제거
- 구버전 파일은 archive/ 폴더로 백업
- 문서는 docs/ 폴더로 체계적으로 정리
- 깔끔하고 유지보수하기 쉬운 구조

## � 링크 정리

삭제된 페이지를 참조하던 링크들도 모두 수정:
- `/admin/elections/[id]/monitor` - `/admin/results` 링크 제거
- `/admin/elections/[id]/results` - `/admin/results` 링크 제거  
- `/admin/elections/[id]` - 에러 시 `/admin/dashboard`로 리다이렉트
- `/admin/elections/create` - 취소 버튼 `/admin/dashboard`로 변경

## �🔄 Git 업데이트 필요

```bash
git add .
git commit -m "chore: 사용하지 않는 파일 정리 및 폴더 구조 개선

- 사용하지 않는 컴포넌트 및 페이지 삭제
- 임시 SQL 파일 제거
- 구버전 마이그레이션 파일 archive로 이동
- 문서 파일 docs 폴더로 정리
- 삭제된 페이지 참조 링크 모두 수정
- README 업데이트"
git push
```

## 📝 참고사항

- `/admin/elections`와 `/admin/results` 경로는 더 이상 사용되지 않습니다.
- 모든 투표 관리는 `/admin/election-groups`를 통해 이루어집니다.
- 구버전 마이그레이션 파일은 참고용으로 archive에 보관되어 있습니다.
