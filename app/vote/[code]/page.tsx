'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';
import { useKiosk } from '@/lib/kiosk';
import { takeCodeInfo, type CodeInfo, type VoterElection } from '@/lib/voterSession';

type Notice = { title: string; message: string; onClose?: () => void };

// cast_vote() 가 던지는 예외 메시지 → 사용자 문구
const CAST_ERRORS: Record<string, string> = {
  INVALID_CODE: '올바르지 않은 참여코드입니다.',
  NO_ACCESS: '이 코드로 참여할 수 없는 투표입니다.',
  NOT_ACTIVE: '지금은 진행 중인 투표가 아닙니다.',
  ALREADY_VOTED: '이미 이 투표에 참여하셨습니다.',
  WRONG_COUNT: '선택 인원이 맞지 않습니다. 다시 선택해 주세요.',
  DUPLICATE_CANDIDATE: '같은 후보를 두 번 선택할 수 없습니다.',
  INVALID_CANDIDATE: '후보 정보가 바뀌었습니다. 다시 선택해 주세요.',
};

function describe(e: VoterElection) {
  return e.election_type === 'delegate'
    ? `총대 선출 · ${e.village_name || '-'}`
    : `임원 선출 · ${e.position || ''}`;
}

export default function VoteWithCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const kiosk = useKiosk();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<CodeInfo | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);

  // 1. 코드 확인. 입력 화면에서 넘어온 결과가 있으면 재조회하지 않는다.
  const loadData = useCallback(async () => {
    let d = takeCodeInfo(code);
    if (!d) {
      const { data, error } = await createClient().rpc('enter_code', { p_code: code });
      if (error || !data) {
        setLoading(false);
        setNotice({ title: '오류', message: '올바르지 않은 참여코드입니다.', onClose: () => router.replace('/vote') });
        return;
      }
      d = data as CodeInfo;
    }
    setInfo(d);
    setVotedIds(new Set(d.voted));
    setLoading(false);
    if (d.elections.length === 0) {
      setNotice({ title: '투표 없음', message: '현재 참여 가능한 투표가 없습니다.\n투표가 시작되면 다시 시도해 주세요.', onClose: () => router.replace('/vote') });
    }
  }, [code, router]);

  useEffect(() => { loadData(); }, [loadData]);

  // 2. 선택된 선거는 URL(?election=) 에서 파생. 뒤로가기 = 목록으로.
  const electionId = searchParams.get('election');
  const elections = info?.elections ?? [];
  const selected = electionId ? elections.find((e) => e.id === electionId && !votedIds.has(e.id)) ?? null : null;

  useEffect(() => {
    if (!loading && info && electionId && !selected) router.replace(`/vote/${code}`);
  }, [loading, info, electionId, selected, code, router]);

  const onSubmitted = (remaining: number, title: string) => {
    if (remaining === 0) {
      router.replace(`/vote/complete?election=${encodeURIComponent(title)}`);
      return;
    }
    if (selected) setVotedIds(new Set([...votedIds, selected.id]));
    router.replace(`/vote/${code}`);
    setNotice({ title: '완료', message: '투표가 접수되었습니다. 남은 투표를 진행해 주세요.' });
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="spinner" aria-label="불러오는 중" />
      </main>
    );
  }

  const remainingCount = elections.filter((e) => !votedIds.has(e.id)).length;

  return (
    <main className="min-h-screen px-5 sm:px-8 py-10">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <p className="eyebrow">
            참여코드 <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--ink)' }}>{code}</span>
          </p>
          {selected ? (
            <button onClick={() => router.push(`/vote/${code}`)} className="btn btn-secondary" style={{ minHeight: 40 }}>
              목록으로
            </button>
          ) : (!kiosk && (
            <button onClick={() => router.replace('/vote')} className="text-sm underline" style={{ color: 'var(--ink-2)' }}>
              다른 코드로
            </button>
          ))}
        </div>

        {!selected ? (
          <>
            <h1 className="mt-4 text-3xl sm:text-4xl">투표를 선택하세요</h1>
            <p className="mt-2" style={{ color: 'var(--ink-2)' }}>
              {remainingCount > 0 ? `남은 투표 ${remainingCount}개` : '모든 투표를 마쳤습니다'}
            </p>

            <div className="mt-8 space-y-3">
              {elections.map((e) => {
                const done = votedIds.has(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => router.push(`/vote/${code}?election=${e.id}`)}
                    disabled={done}
                    className="row"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-lg">{e.title}</p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--ink-2)' }}>
                        {describe(e)} · {e.round}차 · {e.max_selections}명 선택
                      </p>
                    </div>
                    <span className="text-sm flex-none" style={{ color: done ? 'var(--ok)' : 'var(--accent)' }}>
                      {done ? '완료' : '투표하기 →'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <Ballot key={selected.id} code={code} election={selected} onSubmitted={onSubmitted} onNotice={setNotice} />
        )}
      </div>

      <AlertModal
        isOpen={!!notice}
        onClose={() => { const cb = notice?.onClose; setNotice(null); cb?.(); }}
        message={notice?.message ?? ''}
        title={notice?.title ?? ''}
      />
    </main>
  );
}

// 투표용지. key={election.id} 로 마운트되므로 선거가 바뀌면 상태가 자동 초기화된다.
// 후보 목록은 enter_code() 응답에 들어 있어 추가 조회가 없다.
function Ballot({ code, election, onSubmitted, onNotice }: {
  code: string;
  election: VoterElection;
  onSubmitted: (remaining: number, title: string) => void;
  onNotice: (n: Notice) => void;
}) {
  const router = useRouter();
  const candidates = election.candidates ?? [];
  const [picked, setPicked] = useState<string[]>([]);
  const [abstain, setAbstain] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const togglePick = (id: string) => {
    setAbstain(false);
    if (picked.includes(id)) { setPicked(picked.filter((p) => p !== id)); return; }
    if (picked.length >= election.max_selections) {
      onNotice({ title: '안내', message: `최대 ${election.max_selections}명까지 선택할 수 있습니다.` });
      return;
    }
    setPicked([...picked, id]);
  };

  const ready = abstain || picked.length === election.max_selections;

  // 3. 제출: cast_vote() 한 번. 중복·동시 제출은 DB 가 막는다.
  const submit = async () => {
    setSubmitting(true);
    setConfirmOpen(false);
    const { data, error } = await createClient().rpc('cast_vote', {
      p_code: code,
      p_election_id: election.id,
      p_candidate_ids: abstain ? [] : picked,
      p_abstain: abstain,
    });

    if (error) {
      const key = Object.keys(CAST_ERRORS).find((k) => error.message.includes(k));
      onNotice({
        title: '오류',
        message: key ? CAST_ERRORS[key] : `투표 제출에 실패했습니다.\n${error.message}`,
        onClose: key === 'ALREADY_VOTED' ? () => router.replace(`/vote/${code}`) : undefined,
      });
      setSubmitting(false);
      return;
    }
    onSubmitted((data as { remaining: number }).remaining, election.title);
  };

  return (
    <>
      <p className="mt-6 text-sm" style={{ color: 'var(--ink-2)' }}>{describe(election)} · {election.round}차</p>
      <h1 className="mt-1 text-3xl sm:text-4xl">{election.title}</h1>
      <p className="mt-3" style={{ color: 'var(--ink-2)' }} aria-live="polite">
        {abstain
          ? '기권을 선택했습니다. 후보를 고르면 기권이 취소됩니다.'
          : `${election.max_selections}명을 선택하세요. 현재 ${picked.length}명 선택됨.`}
      </p>

      <hr className="rule mt-6" />

      {candidates.length === 0 ? (
        <p className="mt-8 text-center" style={{ color: 'var(--ink-3)' }}>후보자가 없습니다</p>
      ) : (
        <div className="mt-6 space-y-3" role="group" aria-label="후보자">
          {candidates.map((c, i) => {
            const on = picked.includes(c.id);
            return (
              <button key={c.id} onClick={() => togglePick(c.id)} className="row" aria-pressed={on}>
                <span className="mark" aria-hidden>{on ? '✓' : i + 1}</span>
                <span className="flex-1 text-lg font-semibold truncate">{c.name}</span>
              </button>
            );
          })}

          {election.election_type === 'officer' && (
            <button onClick={() => { setAbstain(!abstain); setPicked([]); }} className="row mt-6" aria-pressed={abstain}>
              <span className="mark" aria-hidden>{abstain ? '✓' : '–'}</span>
              <span className="flex-1">
                <span className="block text-lg font-semibold">기권</span>
                <span className="block text-sm" style={{ color: 'var(--ink-2)' }}>이 투표에 참여하지 않습니다</span>
              </span>
            </button>
          )}
        </div>
      )}

      <div className="sticky bottom-0 mt-8 py-4" style={{ background: 'var(--paper)' }}>
        <button onClick={() => setConfirmOpen(true)} disabled={submitting || !ready} className="btn btn-primary btn-lg w-full">
          {submitting ? '제출 중' : abstain ? '기권으로 제출' : '투표 제출'}
        </button>
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--ink-3)' }}>제출 후에는 변경할 수 없습니다</p>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        title="투표 제출"
        message={abstain
          ? '기권으로 제출하시겠습니까?\n제출 후에는 변경할 수 없습니다.'
          : `${picked.map((id) => candidates.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}\n\n위 후보에게 투표하시겠습니까?\n제출 후에는 변경할 수 없습니다.`}
        confirmText={abstain ? '기권 제출' : '투표하기'}
        cancelText="취소"
        variant="primary"
      />
    </>
  );
}
