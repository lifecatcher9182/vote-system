// 득표율 기준 필요 득표수.
// Math.ceil(base * 66.67 / 100) 은 base 가 3의 배수일 때 1표를 더 요구한다
// (27 * 0.6667 = 18.0009 → 19). 백분율을 먼저 정수로 반올림해 부동소수 찌꺼기를 없앤다.
//   27명 · 66.67% → 18   28명 → 19   30명 → 20   27명 · 50% → 14
export function requiredVotes(base: number, percentage: number): number {
  return Math.ceil(Math.round(base * percentage) / 100);
}

if (process.env.NODE_ENV === 'test') {
  const cases: [number, number, number][] = [[27, 66.67, 18], [28, 66.67, 19], [30, 66.67, 20], [27, 50, 14], [10, 66.67, 7]];
  for (const [b, p, want] of cases) {
    if (requiredVotes(b, p) !== want) throw new Error(`requiredVotes(${b}, ${p}) = ${requiredVotes(b, p)}, want ${want}`);
  }
}
