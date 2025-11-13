# 🗳️ 청년국 온라인 투표 시스템

Next.js와 Supabase 기반의 투표 그룹 관리 시스템입니다.

## ✨ 주요 기능

### 투표 그룹 시스템
- **그룹 기반 투표**: 총대 선출과 임원 선출을 위한 투표 그룹 관리
- **복수 투표 통합**: 하나의 그룹에 여러 투표를 포함하여 관리
- **투표 상태 관리**: 대기/진행중/종료 상태별 투표 제어

### 투표 기능
- **익명 투표**: 투표자 신원을 보호하는 완전 익명 투표
- **참여 코드**: 고유한 참여 코드로 안전한 투표 참여
- **당선자 계산**: 최다득표, 절대과반, 득표율 기준 등 다양한 당선 기준 지원
- **동점 처리**: 동점 시 확정 당선자와 미확정 후보 구분 표시
- **투표 비고**: 각 투표에 관리자 메모 기록 기능

### 관리 기능
- **실시간 모니터링**: 투표 진행 상황 실시간 확인
- **QR 코드**: 참여 링크 QR 코드 생성 및 다운로드
- **마을 관리**: 지역별 마을 등록 및 활성화 상태 관리
- **통계 대시보드**: 투표율, 참석률, 그룹별 현황 한눈에 확인

### 시스템 커스터마이징
- **로고 업로드**: 조직 로고 업로드 및 관리
- **컬러 테마**: Primary/Secondary 색상 커스터마이징
- **관리자 관리**: 이메일 기반 관리자 권한 관리

## 🚀 빠른 시작

### 1. 환경 변수 설정

`.env.local` 파일을 생성하고 Supabase 정보를 입력하세요:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. 데이터베이스 설정

Supabase SQL Editor에서 다음 파일을 순서대로 실행하세요:

1. `supabase-schema.sql` - 기본 테이블 생성
2. `supabase-migration-v5-election-groups.sql` - 투표 그룹 기능
3. `supabase-migration-election-notes.sql` - 투표 비고 기능

### 3. 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 여세요.

### 4. 관리자 설정

1. Google OAuth로 로그인
2. Supabase의 `admin_emails` 테이블에 이메일 추가
3. `/admin` 페이지에서 관리자 기능 사용

## 📁 프로젝트 구조

```
├── app/
│   ├── admin/
│   │   ├── dashboard/              # 관리자 대시보드
│   │   ├── election-groups/        # 투표 그룹 관리
│   │   │   ├── [id]/              # 그룹 상세 (투표 목록, 코드 관리)
│   │   │   └── create/            # 새 그룹 생성
│   │   ├── elections/
│   │   │   ├── [id]/              # 투표 상세 (개요, 참여코드, 결과)
│   │   │   │   └── monitor/       # 실시간 모니터링
│   │   │   └── create/            # 새 투표 생성
│   │   ├── codes/                 # 전체 참여 코드 관리
│   │   ├── villages/              # 마을 관리
│   │   └── settings/              # 시스템 설정
│   ├── vote/
│   │   ├── [code]/                # 투표 참여 페이지
│   │   └── complete/              # 투표 완료 페이지
│   └── page.tsx                   # 홈 페이지
├── components/
│   ├── SystemLogo.tsx             # 시스템 로고 컴포넌트
│   ├── ThemeProvider.tsx          # 테마 프로바이더
│   ├── ColorThemeSettings.tsx     # 색상 테마 설정
│   └── QRCodeSection.tsx          # QR 코드 생성
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # 클라이언트 사이드 Supabase
│   │   ├── server.ts              # 서버 사이드 Supabase
│   │   └── middleware.ts          # 미들웨어용 Supabase
│   ├── auth.ts                    # 인증 함수
│   ├── database.types.ts          # DB 타입 정의
│   └── hooks/
│       └── useSystemConfig.ts     # 시스템 설정 훅
├── docs/                          # 상세 문서
└── archive/                       # 구버전 migration 파일
```

## 🔐 인증 및 권한

### 투표자
- 참여 코드로 익명 로그인
- 할당된 투표에만 접근 가능
- 한 번만 투표 가능

### 관리자
- Google OAuth 로그인 필요
- `admin_emails` 테이블에 등록된 이메일만 접근 가능
- 모든 투표 그룹 및 투표 관리 권한

## 🎨 투표 유형

### 1. 총대 선출 (Delegate Election)
- 마을별 투표
- 각 마을에서 대표 선출
- 마을 활성화 상태 관리

### 2. 임원 선출 (Officer Election)
- 직책별 투표 (예: 회장, 부회장 등)
- 전체 참여자 대상
- 직책별 선출 인원 설정

## 📊 당선 기준

1. **최다 득표 (Plurality)**: 가장 많이 득표한 후보 당선
2. **절대 과반 (Absolute Majority)**: 참석자의 50% 초과 득표 필요
3. **득표율 (Percentage)**: 특정 비율 이상 득표 필요
   - 참석자 기준 또는 발급 코드 기준 선택 가능

### 동점 처리
- 확정 당선자: 선출 인원 내 득표수가 명확히 높은 후보
- 미확정 후보: 동점으로 경합 중인 후보들
- 결선 투표 또는 별도 규정으로 결정

## 🛠️ 기술 스택

- **프레임워크**: Next.js 15 (App Router)
- **언어**: TypeScript
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth (Google OAuth)
- **스토리지**: Supabase Storage (로고 업로드)
- **스타일**: Tailwind CSS + Apple Design 스타일
- **QR 코드**: qrcode.react
- **배포**: Vercel 권장

## 📚 상세 문서

자세한 내용은 `docs/` 폴더를 참조하세요:

- **SETUP.md**: 초기 설정 및 환경 구성
- **GOOGLE_LOGIN_SETUP.md**: Google OAuth 설정 방법
- **MIGRATION_GUIDE.md**: 데이터베이스 마이그레이션 가이드
- **UPDATE_SUMMARY.md**: 주요 업데이트 내역

## � 데이터베이스 스키마

### 주요 테이블
- `election_groups`: 투표 그룹 (총대/임원)
- `elections`: 개별 투표
- `candidates`: 후보자
- `voter_codes`: 참여 코드
- `votes`: 투표 기록 (익명)
- `villages`: 마을 정보
- `admin_emails`: 관리자 이메일
- `system_config`: 시스템 설정
- `election_notes`: 투표 비고/메모

## 🔄 업데이트 이력

### v2.0 (최신)
- ✅ 투표 그룹 시스템 추가
- ✅ 투표 비고/메모 기능
- ✅ 동점 처리 로직 개선
- ✅ 대시보드 네비게이션 개선
- ✅ 불필요한 페이지 제거 (results 페이지)

### v1.0
- ✅ 기본 투표 시스템
- ✅ 익명 투표 지원
- ✅ 실시간 모니터링
- ✅ QR 코드 생성
- ✅ 테마 커스터마이징

## � 지원

문제가 발생하거나 문의사항이 있으시면 프로젝트 관리자에게 연락하세요.

## 📄 라이선스

이 프로젝트는 내부 사용 목적으로 제작되었습니다.
