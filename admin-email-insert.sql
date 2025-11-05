-- 이 파일을 Supabase SQL Editor에서 실행하세요
-- https://supabase.com/dashboard/project/gmniknsurottqhdduyhu/sql

-- 1. 먼저 관리자 이메일을 입력하세요 (본인의 Gmail 주소로 변경)
INSERT INTO admin_emails (email) VALUES ('your-email@gmail.com');

-- 예시:
-- INSERT INTO admin_emails (email) VALUES ('moonhyunmin@gmail.com');

-- 2. 등록된 관리자 이메일 확인
SELECT * FROM admin_emails;
