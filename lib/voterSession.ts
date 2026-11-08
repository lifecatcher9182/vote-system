// 코드 입력 화면에서 받은 enter_code() 결과를 투표 화면으로 넘긴다.
// 같은 코드를 60초 안에 다시 조회하지 않으므로 투표자 1명당 DB 호출이 한 번 준다.
const TTL = 60 * 1000;

export interface Candidate { id: string; name: string; }
export interface VoterElection {
  id: string; title: string; election_type: 'delegate' | 'officer'; position: string | null;
  max_selections: number; round: number; status: string; village_name: string | null; candidates: Candidate[];
}
export interface CodeInfo {
  id: string; code: string; code_type: 'delegate' | 'officer';
  accessible_elections: string[]; voted: string[]; elections: VoterElection[];
}

const key = (code: string) => `enter:${code.toUpperCase()}`;

export function stashCodeInfo(code: string, info: CodeInfo) {
  try { sessionStorage.setItem(key(code), JSON.stringify({ ts: Date.now(), info })); } catch {}
}

export function takeCodeInfo(code: string): CodeInfo | null {
  try {
    const raw = sessionStorage.getItem(key(code));
    if (!raw) return null;
    sessionStorage.removeItem(key(code));
    const { ts, info } = JSON.parse(raw);
    return Date.now() - ts < TTL ? info : null;
  } catch { return null; }
}
