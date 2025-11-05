-- 득표수 증가 함수
-- Supabase SQL Editor에서 실행하세요

CREATE OR REPLACE FUNCTION increment_vote_count(candidate_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE candidates
  SET vote_count = vote_count + 1
  WHERE id = candidate_id;
END;
$$;
