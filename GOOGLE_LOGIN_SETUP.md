# Google 로그인 설정 가이드

## 1단계: Supabase 데이터베이스 설정

### 1-1. Supabase SQL Editor에서 스키마 실행

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. **New Query** 버튼 클릭
4. `supabase-schema.sql` 파일의 전체 내용을 복사하여 붙여넣기
5. **Run** 버튼 클릭하여 실행

### 1-2. 관리자 이메일 등록

SQL Editor에서 다음 쿼리를 실행 (본인의 Gmail 주소로 변경):

```sql
INSERT INTO admin_emails (email) VALUES ('your-email@gmail.com');
```

예시:
```sql
INSERT INTO admin_emails (email) VALUES ('moonhyunmin@gmail.com');
```

## 2단계: Google Cloud Console 설정

### 2-1. Google Cloud Console 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단의 프로젝트 선택 드롭다운 클릭
3. **새 프로젝트** 클릭
4. 프로젝트 이름 입력 (예: "청년국-투표시스템")
5. **만들기** 클릭

### 2-2. OAuth 동의 화면 구성

1. 왼쪽 메뉴에서 **API 및 서비스** > **OAuth 동의 화면** 클릭
2. **User Type**: **외부** 선택 후 **만들기** 클릭
3. 앱 정보 입력:
   - **앱 이름**: 청년국 전자투표 시스템
   - **사용자 지원 이메일**: 본인 이메일
   - **개발자 연락처 정보**: 본인 이메일
4. **저장 후 계속** 클릭
5. 범위 단계는 건너뛰기 (**저장 후 계속**)
6. 테스트 사용자는 건너뛰기 (**저장 후 계속**)

### 2-3. OAuth 2.0 클라이언트 ID 만들기

1. 왼쪽 메뉴에서 **API 및 서비스** > **사용자 인증 정보** 클릭
2. 상단의 **+ 사용자 인증 정보 만들기** 클릭
3. **OAuth 클라이언트 ID** 선택
4. 애플리케이션 유형: **웹 애플리케이션** 선택
5. 이름 입력 (예: "청년국 웹 클라이언트")
6. **승인된 리디렉션 URI** 섹션에서 **+ URI 추가** 클릭

## 3단계: Supabase에서 리디렉션 URI 확인

### 3-1. Supabase 콜백 URL 가져오기

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 왼쪽 메뉴에서 **Authentication** 클릭
3. **Settings** 탭 클릭
4. **Configuration** URL 섹션에서 다음 URL 복사:

```
https://your-project-id.supabase.co/auth/v1/callback
```

**중요**: `your-project-id`는 실제 Supabase 프로젝트 ID로 자동으로 표시됩니다.

### 3-2. Google Cloud Console에 리디렉션 URI 추가

1. 복사한 Supabase 콜백 URL을 Google Cloud Console의 **승인된 리디렉션 URI**에 붙여넣기
2. 로컬 개발용 URI도 추가:
   ```
   http://localhost:3000/api/auth/callback
   http://localhost:3001/api/auth/callback
   ```
3. **만들기** 클릭
4. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀** 복사 (나중에 사용)

## 4단계: Supabase에 Google Provider 활성화

### 4-1. Google Provider 설정

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 왼쪽 메뉴에서 **Authentication** 클릭
3. **Providers** 탭 클릭
4. **Google** 항목 찾아서 클릭
5. **Enable Sign in with Google** 토글 켜기
6. Google Cloud Console에서 복사한 정보 입력:
   - **Client ID (for OAuth)**: 복사한 클라이언트 ID 붙여넣기
   - **Client Secret (for OAuth)**: 복사한 클라이언트 보안 비밀 붙여넣기
7. **Save** 클릭

## 5단계: 로컬에서 테스트

### 5-1. 환경 변수 확인

`.env.local` 파일에 다음 내용이 있는지 확인:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 5-2. 개발 서버 실행

```bash
npm run dev
```

### 5-3. 테스트

1. 브라우저에서 http://localhost:3000/admin 접속
2. **Google로 로그인** 버튼 클릭
3. Google 계정 선택 화면이 나타나면 성공!
4. 관리자로 등록한 이메일로 로그인
5. 자동으로 `/admin/dashboard`로 리디렉션

## 문제 해결

### 에러: "redirect_uri_mismatch"
- Google Cloud Console의 승인된 리디렉션 URI가 정확한지 확인
- Supabase 콜백 URL을 정확히 복사했는지 확인

### 에러: "관리자 권한이 없습니다"
- `admin_emails` 테이블에 본인의 이메일이 등록되어 있는지 확인
- SQL Editor에서 확인:
  ```sql
  SELECT * FROM admin_emails;
  ```

### 로그인 후 리디렉션이 안 됨
- `middleware.ts` 파일 확인
- 브라우저 콘솔에서 에러 확인

## 완료 체크리스트

- [ ] Supabase SQL 스키마 실행 완료
- [ ] 관리자 이메일 등록 완료
- [ ] Google Cloud Console 프로젝트 생성
- [ ] OAuth 동의 화면 구성 완료
- [ ] OAuth 클라이언트 ID 생성 완료
- [ ] Supabase에 Google Provider 활성화
- [ ] 로컬에서 Google 로그인 테스트 성공
- [ ] 관리자 대시보드 접근 성공
