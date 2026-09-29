import { describe, it, expect } from 'vitest';
import { recognizeOptions, nextRecognition, applyRecognition, formatSignature } from '../src/lib/rerecognize.js';

const b = (alone, isRef = false) => ({ page: 1, x0: 0.2, x1: 0.3, top: 0.3, bottom: 0.32, alone, isRef });

describe('답안 유형 다시 인식하기', () => {
  const q17 = {
    no: 17, type: 'short', blankCount: 4, answerText: '반려동물',
    fullText: '다음 ( ) 안에 공통으로 들어갈 말을 쓰시오.\n( )(이)란 사람과 더불어 살아가는 동물을\n뜻합니다. 오늘날 우리 사회에는 ( )과/와 더\n( )',
    blankInfo: [b(false, true), b(false), b(false), b(true)],
  };

  it('공통으로 들어갈 말 → 답 칸 1개가 첫 후보', () => {
    const r = nextRecognition(q17, 0);
    expect(r.option.label).toMatch(/공통/);
    const next = applyRecognition(q17, r.option.patch);
    expect(next.type).toBe('short');
    expect(next.blankCount).toBe(0);
    expect(next.answerText).toBe('반려동물');
    expect(next.blanks).toHaveLength(1);
  });

  it('누를 때마다 지금과 다른 형식으로 바뀌고, 한 바퀴 돌면 처음으로', () => {
    let it = q17;
    let step = 0;
    const sigs = [];
    const total = recognizeOptions(q17).length;
    for (let i = 0; i < total + 2; i++) {
      const r = nextRecognition(it, step);
      expect(formatSignature(r.option.patch)).not.toBe(formatSignature(it));
      it = applyRecognition(it, r.option.patch);
      step = r.nextStep;
      sigs.push(formatSignature(it));
    }
    expect(new Set(sigs).size).toBe(total); // 모든 후보를 한 번씩 거친다
  });

  it('보기 ①~④가 있는 문제는 객관식 후보가 먼저', () => {
    const q = { no: 1, type: 'short', fullText: '다음 중 알맞은 것은?\n① 가 ② 나\n③ 다 ④ 라', blankInfo: [] };
    const r = nextRecognition(q, 0);
    expect(r.option.patch.type).toBe('mc');
    expect(r.option.patch.choiceCount).toBe(4);
  });

  it('두 가지를 쓰시오 → 답 칸 2개', () => {
    const q = { no: 2, type: 'essay', fullText: '식물이 사는 곳을 두 가지 쓰시오.', blankInfo: [] };
    const r = nextRecognition(q, 0);
    expect(r.option.patch).toMatchObject({ type: 'short', blankCount: 2 });
  });

  it('옛 평가(원본 글 없음)도 후보를 만든다', () => {
    const q = { no: 3, type: 'short', text: '원의 중심을 찾아 써 보세요.', blanks: [b(true)] };
    expect(recognizeOptions(q).length).toBeGreaterThan(3);
    expect(nextRecognition(q, 0)).not.toBeNull();
  });
});
