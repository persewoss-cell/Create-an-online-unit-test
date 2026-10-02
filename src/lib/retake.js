// 오답 재응시: 처음 제출한 점수는 그대로 두고, 틀린 문제만 다시 풀어 맞힐 때까지 반복한다.
//  submission.retake  = { on: true, judge: { r1_q9: 'correct' } }
//                       선생님이 "오답만 재응시"를 켬 / 확인이 필요한 재응시 답(그림 등)에 대한 선생님 판정
//  submission.retakes = [{ answers: {번호: 답}, at }]  학생이 다시 푼 기록 (차례대로)
import { gradeAnswer, gradeSubmission } from './grading.js';

/**
 * @returns {{enabled:boolean, firstWrong:number[], remaining:number[], fixed:number[], attempts:number, done:boolean,
 *            pending:{no:number, round:number, answer:any, reason?:string}[],
 *            history:Record<number, {round:number, answer:any, status:'correct'|'wrong'|'review', judged:boolean}[]>}}
 *  firstWrong: 처음(선생님 판정 포함) 틀린 문제 · remaining: 아직 못 맞힌 문제 · fixed: 다시 풀어 맞힌 문제
 *  pending: 선생님 확인을 기다리는 재응시 답 (선생님이 정답/오답을 정할 때까지 완료가 아님)
 *  history: 문제마다 처음 답(round 0)과 n차 재응시 답·채점 결과
 */
export function retakeState(exam, keys, sub, result = gradeSubmission(exam, keys, sub)) {
  const firstWrong = result.items.filter((it) => it.status === 'wrong').map((it) => it.no);
  const byNo = Object.fromEntries(exam.questions.map((q) => [q.no, q]));
  let remaining = firstWrong.filter((no) => byNo[no]);
  const history = Object.fromEntries(remaining.map((no) => [no, [{ round: 0, answer: sub.answers?.[no], status: 'wrong', judged: false }]]));
  const judge = sub.retake?.judge || {};
  const pending = [];
  const attempts = sub.retakes || [];
  attempts.forEach((at, i) => {
    const round = i + 1;
    remaining = remaining.filter((no) => {
      const ans = at.answers?.[no];
      if (ans == null) return true;
      const auto = gradeAnswer(byNo[no], keys?.[no], ans, exam.leniency, exam.subject);
      const judged = judge[retakeJudgeKey(round, no)];
      const status = judged || auto.status;
      history[no].push({ round, answer: ans, status, judged: !!judged });
      // 자동으로 판단하기 어려운 답(그림 등)은 선생님이 정할 때까지 기다린다 — 오답으로 정하면 다시 풀게 됨
      if (status === 'review') pending.push({ no, round, answer: ans, reason: auto.reason });
      return status === 'wrong';
    });
  });
  return {
    enabled: !!sub.retake?.on,
    firstWrong,
    remaining,
    fixed: firstWrong.filter((no) => !remaining.includes(no) && !pending.some((p) => p.no === no)),
    attempts: attempts.length,
    pending,
    done: remaining.length === 0 && pending.length === 0,
    history,
  };
}

/** 선생님 판정을 저장하는 칸 이름 (retake.judge 안): r{회차}_q{문제 번호} */
export function retakeJudgeKey(round, no) {
  return `r${round}_q${no}`;
}
