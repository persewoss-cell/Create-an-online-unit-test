import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import { GradedPaper } from '../../components/ExamViews.jsx';
import RetakeHistory from '../../components/RetakeHistory.jsx';
import { loadStudent } from '../../lib/student.js';
import {
  getExam, getKeys, getMySubmission, getPages, studentIdOf, ensureStudentSession, watchMySubmissionLive, watchExamLive, watchKeysLive,
} from '../../lib/db.js';
import { useToast } from '../../components/Toast.jsx';
import { gradeSubmission } from '../../lib/grading.js';
import { retakeState } from '../../lib/retake.js';
import { stableKey } from '../../lib/format.js';

export default function Result() {
  const { id } = useParams();
  const nav = useNavigate();
  const p = loadStudent();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [toast, notify] = useToast(10000);
  useEffect(() => {
    if (!p) return undefined;
    let unsub = () => {};
    let alive = true;
    const fail = (e) =>
      setError(e.code === 'permission-denied' ? '결과를 볼 수 없습니다. 선생님께 문의하세요.' : e.message);
    (async () => {
      try {
        await ensureStudentSession(p);
        const sid = studentIdOf(p);
        const first = await getMySubmission(id, sid);
        if (!first) throw new Error('제출 기록을 찾을 수 없습니다.');
        const [exam, keys, pages] = await Promise.all([getExam(id), getKeys(id), getPages(id)]);
        if (!exam) throw new Error('평가가 마감되어 결과를 볼 수 없습니다. 선생님께 문의하세요.');
        if (!alive) return;
        // 선생님이 채점·검토하거나, 문제·정답을 고치거나, 오답 재응시를 열면 새로고침하지 않아도 바로 바뀌고 알림이 뜬다
        const cur = { exam, keys, sub: first };
        let ready = false;
        const redraw = () => setData({ ...cur, pages, result: gradeSubmission(cur.exam, cur.keys, cur.sub) });
        const unsubs = [
          watchMySubmissionLive(id, sid, (sub) => {
            if (!sub) {
              // 선생님이 "전체 재응시"로 응시 기록을 지움
              if (ready) {
                notify('선생님이 처음부터 다시 볼 수 있게 했어요.', {
                  kind: 'success',
                  sticky: true,
                  action: { label: '다시 보기', onClick: () => nav(`/exam/${id}`, { replace: true }) },
                });
              }
              return;
            }
            const old = cur.sub;
            cur.sub = sub;
            redraw();
            if (!ready) return;
            if (stableKey(sub.overrides || {}) !== stableKey(old.overrides || {})) notify('선생님이 답을 확인했어요. 점수가 새로 반영되었어요.', { kind: 'success' });
            if (!old.retake?.on && sub.retake?.on) notify('선생님이 오답 재응시를 열었어요. 틀린 문제를 다시 풀어 보세요!', { kind: 'success' });
            if (old.retake?.on && !sub.retake?.on) notify('선생님이 오답 재응시를 닫았어요.');
            const oj = old.retake?.judge || {};
            const nj = sub.retake?.judge || {};
            for (const k of Object.keys(nj)) {
              if (oj[k] === nj[k]) continue;
              const no = k.split('_q')[1];
              notify(
                nj[k] === 'correct'
                  ? `선생님이 다시 푼 ${no}번을 맞았다고 했어요! 🎉`
                  : `선생님이 다시 푼 ${no}번을 확인했어요. 한 번 더 풀어 보세요.`,
                { kind: nj[k] === 'correct' ? 'success' : 'warn' },
              );
            }
          }, fail),
          watchExamLive(id, (e) => {
            if (!e) return;
            const changed = stableKey(e.questions) !== stableKey(cur.exam.questions);
            cur.exam = e;
            redraw();
            if (ready && changed) notify('선생님이 문제를 고쳤어요. 점수가 새로 반영되었어요.');
          }),
          watchKeysLive(id, (k) => {
            const changed = stableKey(k) !== stableKey(cur.keys);
            cur.keys = k;
            redraw();
            if (ready && changed) notify('선생님이 정답을 고쳤어요. 점수가 새로 반영되었어요.');
          }),
        ];
        ready = true;
        unsub = () => unsubs.forEach((u) => u());
      } catch (e) {
        fail(e);
      }
    })();
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!p) return <Navigate to="/" replace />;
  const who = `${p.grade}학년 ${p.classNo}반 ${p.number}번 ${p.name}`;
  if (error) {
    return (
      <>
        <TopBar who={who} />
        <div className="container narrow">
          <div className="alert warn">{error}</div>
          <p><button className="btn" onClick={() => nav('/exams')}>평가 목록으로</button></p>
        </div>
      </>
    );
  }
  if (!data) return (<><TopBar who={who} /><Loading text="채점 중…" /></>);

  const { exam, keys, sub, pages, result } = data;
  const rt = retakeState(exam, keys, sub, result);
  return (
    <>
      <TopBar who={who}>
        <button className="btn sm" onClick={() => nav('/exams')}>평가 목록</button>
      </TopBar>
      {toast}
      <div className="container" style={{ maxWidth: 940 }}>
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div className="muted">{exam.title}</div>
          <div className="score-big" data-testid="score">{result.score100}점</div>
          <div className="score-sub">
            {exam.questions.length}문항 중 {result.correctCount}문항 정답
          </div>
          {result.reviewCount > 0 && (
            <div className="alert warn" style={{ marginTop: 14, textAlign: 'left' }}>
              선생님이 확인해야 하는 답이 {result.reviewCount}개 있어요(노란색 표시). 확인 후 점수가 올라갈 수 있어요.
            </div>
          )}
        </div>
        {rt.enabled && (
          <div className="card retake-card" style={{ marginBottom: 16 }}>
            <div>
              <b>오답 재응시</b>
              <div className="small muted" style={{ marginTop: 4 }}>
                {rt.done
                  ? `틀린 문제를 모두 다시 풀어 맞혔어요!${rt.attempts ? ` (${rt.attempts}번 도전)` : ''}`
                  : rt.remaining.length
                    ? `틀린 문제 ${rt.remaining.join(', ')}번을 다시 풀어요. 점수는 처음 제출한 점수 그대로예요.`
                    : '다시 푼 답을 선생님이 확인하고 있어요.'}
                {!rt.done && rt.fixed.length > 0 && ` 다시 풀어 맞힌 문제: ${rt.fixed.join(', ')}번`}
                {!rt.done && rt.remaining.length > 0 && rt.pending.length > 0 && ` 선생님 확인 중: ${rt.pending.map((x) => x.no).join(', ')}번`}
              </div>
            </div>
            <div className="row">
              {rt.attempts > 0 && (
                <button className="btn" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
                  {showHistory ? '재응시 결과 닫기' : '재응시 결과 보기'}
                </button>
              )}
              {rt.done ? (
                <button className="btn retake-done" disabled aria-label="오답 재응시 완료">✔ 오답 재응시 완료</button>
              ) : !rt.remaining.length ? (
                <button className="btn retake-done" disabled aria-label="선생님 확인 중">선생님 확인 중</button>
              ) : (
                <button className="btn primary" onClick={() => nav(`/exam/${id}/retake`)}>
                  오답 재응시 ({rt.remaining.length}문제)
                </button>
              )}
            </div>
          </div>
        )}
        {rt.enabled && showHistory && (
          <div style={{ marginBottom: 16 }}>
            <RetakeHistory exam={exam} pages={pages} history={rt.history} />
          </div>
        )}
        <GradedPaper exam={exam} pages={pages} keys={keys} answers={sub.answers} result={result} hideKeys />
      </div>
    </>
  );
}
