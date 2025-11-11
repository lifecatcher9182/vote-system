# 🗳️ 청년 선거 시스템

Next.js 기반의 그룹형 온라인 투표 시스템입니다.

## 📋 주요 기능

- **투표 그룹 관리**: 총대 선출 및 임원 선출을 위한 그룹 기반 투표 관리
- **익명 투표**: 투표자 신원 보호를 위한 익명 투표 시스템
- **실시간 모니터링**: 투표 진행 상황 실시간 확인
- **참여 코드 관리**: 그룹별 참여 코드 생성 및 관리
- **마을 관리**: 지역별 마을 및 활성화 상태 관리
- **테마 커스터마이징**: 시스템 로고 및 컬러 테마 설정

## 🚀 시작하기

### 환경 변수 설정

`.env.local` 파일을 생성하고 Supabase 연결 정보를 입력하세요:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 데이터베이스 설정

Supabase에서 다음 파일을 실행하여 데이터베이스를 설정하세요:

```bash
supabase-migration-v5-election-groups.sql
```

### 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열어 확인하세요.

## 📁 프로젝트 구조

```
├── app/                    # Next.js 앱 라우터
│   ├── admin/             # 관리자 페이지
│   │   ├── dashboard/     # 대시보드
│   │   ├── election-groups/ # 투표 그룹 관리
│   │   ├── codes/         # 참여 코드 관리
│   │   ├── villages/      # 마을 관리
│   │   └── settings/      # 시스템 설정
│   └── vote/              # 투표 페이지
├── components/            # 재사용 가능한 컴포넌트
├── lib/                   # 유틸리티 및 라이브러리
│   ├── supabase/         # Supabase 클라이언트
│   └── auth.ts           # 인증 관련 함수
├── docs/                  # 프로젝트 문서
└── archive/              # 구버전 마이그레이션 파일

```

## 📚 문서

자세한 설정 및 사용 방법은 `docs/` 폴더의 문서를 참조하세요:

- `SETUP.md`: 초기 설정 가이드
- `GOOGLE_LOGIN_SETUP.md`: 구글 로그인 설정
- `MIGRATION_GUIDE.md`: 데이터베이스 마이그레이션 가이드

## 🛠️ 기술 스택

- **Frontend**: Next.js 16, React, TypeScript
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## 📝 개발 진행 상황

현재 진행 상황은 `TODO.md`에서 확인할 수 있습니다.
