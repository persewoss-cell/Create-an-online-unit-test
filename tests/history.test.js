import { describe, it, expect } from 'vitest';
import { historyReducer, initHistory, singleTextChange, wordCount } from '../src/lib/history.js';

const S0 = { items: [{ no: 1, key: '', points: 5 }, { no: 2, key: '3', points: 5 }], groups: [], masks: [] };
const setKey = (s, v, i = 0) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, key: v } : it)) });

// 글자를 하나씩 치는 것처럼 (매번 다른 tick)
function type(state, text, i = 0, t0 = 100) {
  let st = state;
  for (let n = 1; n <= text.length; n++) st = historyReducer(st, { type: 'set', next: setKey(st.present, text.slice(0, n), i), tick: t0 + n });
  return st;
}

describe('되돌리기 기록', () => {
  it('어절 수 세기', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('서울 ')).toBe(1);
    expect(wordCount('서울 부')).toBe(2);
  });

  it('한 칸만 바뀐 글자 변경을 찾는다', () => {
    expect(singleTextChange(S0, setKey(S0, 'a'))).toMatchObject({ path: '/items/0/key', before: '', after: 'a' });
    expect(singleTextChange(S0, { ...S0, items: [...S0.items, { no: 3 }] })).toBeNull();
    expect(singleTextChange(S0, setKey(setKey(S0, 'a'), 'b', 1))).toBeNull();
  });

  it('입력은 어절 단위로 되돌린다', () => {
    let st = type(initHistory(S0), '서울 부산 대구');
    expect(st.past.length).toBe(3); // '서울 ', '부산 ', '대구'
    st = historyReducer(st, { type: 'undo' });
    expect(st.present.items[0].key).toBe('서울 부산 ');
    st = historyReducer(st, { type: 'undo' });
    expect(st.present.items[0].key).toBe('서울 ');
    st = historyReducer(st, { type: 'undo' });
    expect(st.present.items[0].key).toBe('');
    st = historyReducer(st, { type: 'redo' });
    st = historyReducer(st, { type: 'redo' });
    expect(st.present.items[0].key).toBe('서울 부산 ');
  });

  it('다른 칸으로 옮겨 입력하면 새 칸, 같은 tick 변경은 한 칸', () => {
    let st = type(initHistory(S0), '12');
    st = type(st, '7', 1, 200);
    expect(st.past.length).toBe(2);
    // 문항 추가 + 지문 묶음 갱신이 한 클릭에 → 한 칸
    const a = { ...st.present, items: [...st.present.items, { no: 3 }] };
    st = historyReducer(st, { type: 'set', next: a, tick: 300 });
    st = historyReducer(st, { type: 'set', next: { ...a, groups: [{ id: 'g1' }] }, tick: 300 });
    expect(st.past.length).toBe(3);
    st = historyReducer(st, { type: 'undo' });
    expect(st.present.items.length).toBe(2);
    expect(st.present.groups).toEqual([]);
  });

  it('누르기(체크·선택)는 한 번에 한 칸, 되돌린 뒤 새로 바꾸면 다시 실행 기록은 지운다', () => {
    let st = initHistory(S0);
    st = historyReducer(st, { type: 'set', next: { ...st.present, items: st.present.items.map((it) => ({ ...it, multi: true })) }, tick: 1 });
    st = historyReducer(st, { type: 'set', next: { ...st.present, masks: [{ page: 1 }] }, tick: 2 });
    expect(st.past.length).toBe(2);
    st = historyReducer(st, { type: 'undo' });
    expect(st.future.length).toBe(1);
    st = historyReducer(st, { type: 'set', next: setKey(st.present, 'x'), tick: 3 });
    expect(st.future.length).toBe(0);
  });

  it('지우기도 어절 단위', () => {
    let st = type(initHistory(S0), '가나 다라');
    const n = st.past.length;
    for (const v of ['가나 다', '가나 ', '가나', '가']) st = historyReducer(st, { type: 'set', next: setKey(st.present, v), tick: 900 + v.length });
    expect(st.past.length).toBe(n + 2); // '다라' 지우기 한 칸, '가나' 지우기 한 칸
    st = historyReducer(st, { type: 'undo' });
    expect(st.present.items[0].key).toBe('가나 ');
    st = historyReducer(st, { type: 'undo' });
    expect(st.present.items[0].key).toBe('가나 다라');
  });
});
