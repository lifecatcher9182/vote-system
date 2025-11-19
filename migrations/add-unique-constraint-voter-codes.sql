-- voter_codes 테이블의 code 컬럼에 UNIQUE 제약 조건 추가
-- 이렇게 하면 중복된 코드가 절대 저장되지 않습니다

-- 기존에 중복된 코드가 있는지 먼저 확인
SELECT code, COUNT(*) as count 
FROM voter_codes 
GROUP BY code 
HAVING COUNT(*) > 1;

-- 중복이 없다면 UNIQUE 제약 조건 추가
ALTER TABLE voter_codes 
ADD CONSTRAINT voter_codes_code_unique 
UNIQUE (code);

-- 실행 후 확인
-- \d voter_codes  (제약 조건 확인용, PostgreSQL 명령어)
