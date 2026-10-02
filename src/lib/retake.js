// 오답 재응시: 처음 제출한 점수는 그대로 두고, 틀린 문제만 다시 풀어 맞힐 때까지 반복한다.
//  submission.retake  = { on: true }               선생님이 "오답만 재응시"를 켬
//  submission.retakes = [{ answers: {번호: 답}, at }]  학생이 다시 푼 기록 (차례대로)
import { gradeAnswer, gradeSubmission } from './grading.js';

/**
 * @returns {{enabled:boolean, firstWrong:number[], remaining:number[], fixed:number[], attempts:number, done:boolean}}
 *  firstWrong: 처음(선생님 판정 포함) 틀린 문제 · remaining: 아직 못 맞힌 문제 · fixed: 다시 풀어 맞힌 문제
 */
export function retakeState(exam, keys, sub, result = gradeSubmission(exam, keys, sub)) {
  const firstWrong = result.items.filter((it) => it.status === 'wrong').map((it) => it.no);
  const byNo = Object.fromEntries(exam.questions.map((q) => [q.no, q]));
  let remaining = firstWrong.filter((no) => byNo[no]);
  const attempts = sub.retakes || [];
  for (const at of attempts) {
    remaining = remaining.filter((no) => {
      const ans = at.answers?.[no];
      if (ans == null) return true;
      // 선생님 확인이 필요한 답(?)은 다시 묻지 않는다 — 확실히 틀린 것만 남김
      return gradeAnswer(byNo[no], keys?.[no], ans, exam.leniency, exam.subject).status === 'wrong';
    });
  }
  return {
    enabled: !!sub.retake?.on,
    firstWrong,
    remaining,
    fixed: firstWrong.filter((no) => !remaining.includes(no)),
    attempts: attempts.length,
    done: remaining.length === 0,
  };
}
