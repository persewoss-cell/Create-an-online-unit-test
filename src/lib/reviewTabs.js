// 검토 요청 탭(전체 · 문항 번호들)의 순서
//  - 처음 열 때는 각 문항에서 가장 먼저 들어온 검토 시각 순
//  - 그 뒤에는 이미 있던 탭 순서를 그대로 두고, 새로 생긴 번호는 맨 뒤에 (들어온 시각 순)
//  - 검토할 것이 없어진 번호의 탭은 빠지고, 나중에 다시 들어오면 맨 뒤에 새로 붙는다

/** @param {number[]} prev 지금 탭 순서 @param {Map<number, number>} firstAt 번호 → 가장 먼저 들어온 시각 */
export function nextTabOrder(prev, firstAt) {
  const kept = prev.filter((no) => firstAt.has(no));
  const added = [...firstAt.keys()].filter((no) => !kept.includes(no)).sort((a, b) => firstAt.get(a) - firstAt.get(b) || a - b);
  return [...kept, ...added];
}

/** 보던 탭이 없어졌을 때 갈 탭: 바로 오른쪽 → 없으면 왼쪽 → 없으면 전체('all') */
export function tabAfterRemoval(prev, next, sel) {
  if (sel === 'all' || next.includes(sel)) return sel;
  const i = prev.indexOf(sel);
  for (let j = i + 1; j < prev.length; j++) if (next.includes(prev[j])) return prev[j];
  for (let j = i - 1; j >= 0; j--) if (next.includes(prev[j])) return prev[j];
  return 'all';
}
