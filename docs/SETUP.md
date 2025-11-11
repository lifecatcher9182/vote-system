# 청년국 전자투표 시스템 - 설정 가이드

## 현재 진행 상황
✅ Next.js 프로젝트 생성 완료
✅ Supabase 클라이언트 연결 완료 (anon key)
✅ 기본 페이지 구조 완료
  - 홈페이지 (/)
  - 투표 페이지 (/vote)
  - 관리자 로그인 (/admin)
  - 관리자 대시보드 (/admin/dashboard)

## 다음 단계

### 1. Supabase 데이터베이스 설정

1. **Supabase Dashboard** (https://supabase.com/dashboard) 로그인
2. 프로젝트의 **SQL Editor**로 이동
3. `supabase-schema.sql` 파일의 내용을 복사하여 실행
4. 테이블들이 생성되었는지 확인

### 2. 관리자 이메일 등록

SQL Editor에서 다음 쿼리를 실행하여 본인의 Google 이메일을 관리자로 등록하세요:

```sql
INSERT INTO admin_emails (email) VALUES ('your-email@gmail.com');
```

### 3. Google OAuth 설정

1. **Supabase Dashboard** > **Authentication** > **Providers**
2. **Google** 활성화
3. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
   - Authorized redirect URIs: `https://your-project.supabase.co/auth/v1/callback`
4. Client ID와 Client Secret을 Supabase에 입력

### 4. 환경 변수 확인

`.env.local` 파일에 다음 내용이 있는지 확인:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

## 다음 구현 예정 기능

- [ ] 마을 관리 페이지
- [ ] 투표 생성 페이지
- [ ] 참여코드 생성 기능
- [ ] 실제 투표 진행 페이지
- [ ] 실시간 투표 현황 모니터링
- [ ] 투표 결과 페이지
- [ ] QR 코드 생성 기능
- [ ] 참여코드 PDF 출력 기능

## 시스템 구조

### 투표 프로세스
1. 관리자가 마을 정보 등록 (총대 선출용)
2. 관리자가 투표 생성 (총대 선출 또는 임원 선출)
3. 관리자가 참여코드 생성 및 배포
4. 투표자가 참여코드로 투표 참여
5. 관리자가 실시간으로 투표 현황 모니터링
6. 투표 종료 후 결과 확인

### 데이터베이스 구조
- `admin_emails`: 관리자 화이트리스트
- `villages`: 마을 정보
- `elections`: 투표 정보
- `candidates`: 후보자 정보
- `voter_codes`: 참여코드
- `votes`: 투표 기록
