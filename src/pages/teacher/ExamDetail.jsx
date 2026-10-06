import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TeacherBar, { ListButton } from '../../components/TeacherBar.jsx';
import Loading from '../../components/Loading.jsx';
import ExamPreviewEditor from '../../components/ExamPreviewEditor.jsx';
import { GradedPaper, Regions, regionsOf, stackRatio } from '../../components/ExamViews.jsx';
import { DrawLayer } from '../../components/Drawing.jsx';
import MetaFields, { subjectName, SUBJECTS } from '../../components/MetaFields.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { classTarget } from '../../lib/school.js';
import { findSameExam, sameExamMessage } from '../../lib/examDup.js';
import {
  watchExamLive, watchKeysLive, watchSubmissionsLive, setOverride, deleteSubmission, setRetake, setRetakeJudge, updateExam, saveQuestionsAndKeys, deleteExam, getPages, replacePages, watchMyExams,
} from '../../lib/db.js';
import { gradeSubmission, partPoints, partEarned } from '../../lib/grading.js';
import { retakeState } from '../../lib/retake.js';
import { DrawnAnswer } from '../../components/RetakeHistory.jsx';
import SaveErrorDialog, { ErrorLine } from '../../components/SaveErrorDialog.jsx';
import { exportResultsXlsx, sortSubmissions } from '../../lib/excel.js';
import { answerToText, keyToText, TYPE_LABEL, STATUS_LABEL, stableKey } from '../../lib/format.js';
import { toItems, fromItems, validateItems } from '../../lib/editorModel.js';
import { STATUS } from './Dashboard.jsx';
import FileDrop from '../../components/FileDrop.jsx';
import PrintSheets from '../../components/PrintSheets.jsx';
import { openPdf, renderPages, readFileAsArrayBuffer } from '../../lib/pdfText.js';

const MARK = { correct: 'O', wrong: 'X', review: '?' };
const TABS = [
  ['results', '결과'],
  ['review', '검토 요청'],
  ['analysis', '문항 분석'],
  ['edit', '문항·정답 수정'],
  ['settings', '설정'],
];

export default function ExamDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'results';
  const [exam, setExam] = useState(null);
  const [keys, setKeys] = useState(null);
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailPaper, setDetailPaper] = useState(false);
  const [pages, setPages] = useState(null);

  // 평가·정답·답안 모두 실시간: 학생이 제출하거나 오답 재응시를 내면 바로 결과표에 들어온다
  // (제출 알림은 선생님 화면 전체에서 TeacherAlerts가 띄움)
  useEffect(() => {
    const fail = (err) => setError(err.code === 'permission-denied' ? '이 평가를 볼 권한이 없습니다.' : err.message);
    const unsubs = [
      watchExamLive(id, (e) => (e ? setExam(e) : setError('평가를 찾을 수 없습니다.')), fail),
      watchKeysLive(id, setKeys, fail),
      watchSubmissionsLive(id, setSubs, fail),
    ];
    getPages(id).then(setPages).catch(() => setPages([]));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [printRows, setPrintRows] = useState(null); // 인쇄할 결과지 (학생들)
  const graded = useMemo(() => {
    if (!exam || !keys || !subs) return [];
    return sortSubmissions(subs).map((s) => ({ s, r: gradeSubmission(exam, keys, s) }));
  }, [exam, keys, subs]);

  // 검토 요청 = 처음 답안 중 확인이 필요한 것 + 선생님 확인을 기다리는 오답 재응시 답
  const reviewCount = graded.reduce((a, g) => a + g.r.reviewCount + retakeState(exam, keys, g.s, g.r).pending.length, 0);

  if (error) return (<><TeacherBar /><div className="container"><div className="alert error">{error}</div></div></>);
  if (!exam || !keys || !subs) return (<><TeacherBar /><Loading /></>);

  async function judge(sub, no, value) {
    try {
      await setOverride(id, sub.id, no, value);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    }
  }

  const avg = graded.length ? Math.round((graded.reduce((a, g) => a + g.r.score100, 0) / graded.length) * 10) / 10 : '-';
  const detailRow = detail && graded.find((g) => g.s.id === detail);

  return (
    <>
      <TeacherBar>
        <ListButton />
      </TeacherBar>
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="muted small">{exam.subject} · {exam.grade}학년 {exam.semester}학기 · {exam.unit}</div>
            <h1 style={{ margin: '4px 0 8px' }}>{exam.title}</h1>
            <span className={`badge ${exam.status}`}>{STATUS[exam.status]}</span>
          </div>
          <div className="row">
            <StatusButtons exam={exam} onChange={(status) => updateExam(id, { status }).then(() => setExam({ ...exam, status }))} />
            <button className="btn primary" onClick={() => exportResultsXlsx(exam, keys, subs)} disabled={!subs.length}>
              시험 결과 엑셀 다운로드
            </button>
          </div>
        </div>

        <div className="grid2" style={{ margin: '16px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="stat"><div className="v">{graded.length}명</div><div className="l">응시</div></div>
          <div className="stat"><div className="v">{avg}</div><div className="l">평균 (100점)</div></div>
          <div className="stat"><div className="v">{exam.questions.length}</div><div className="l">문항</div></div>
          <div className="stat"><div className="v" style={{ color: reviewCount ? 'var(--warn)' : undefined }}>{reviewCount}건</div><div className="l">검토 요청</div></div>
        </div>

        <div className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setParams({ tab: k }, { replace: true, state: location.state })}>
              {label}{k === 'review' && reviewCount ? ` (${reviewCount})` : ''}
            </button>
          ))}
        </div>

        {tab === 'results' && (
          <ResultsTab
            exam={exam}
            graded={graded}
            onOpen={(sid, paper) => {
              setDetailPaper(!!paper);
              setDetail(sid);
            }}
            onJudge={judge}
            examId={id}
            keys={keys}
            onPrint={pages?.length ? setPrintRows : null}
          />
        )}
        {tab === 'review' && <ReviewTab exam={exam} keys={keys} graded={graded} onJudge={judge} pages={pages} examId={id} />}
        {tab === 'analysis' && <AnalysisTab exam={exam} keys={keys} graded={graded} />}
        {tab === 'edit' && (
          <EditTab
            exam={exam}
            keys={keys}
            pages={pages}
            hasSubs={subs.length > 0}
            onSaved={(questions, newKeys) => {
              setExam({ ...exam, questions });
              setKeys(newKeys);
            }}
          />
        )}
        {tab === 'settings' && (
          <SettingsTab
            exam={exam}
            onSaved={(patch) => setExam({ ...exam, ...patch })}
            onPages={setPages}
            onDeleted={() => nav('/teacher/dashboard', { replace: true })}
          />
        )}
      </div>

      {detailRow && (
        <StudentDetail exam={exam} keys={keys} row={detailRow} onJudge={judge} onClose={() => setDetail(null)} pages={pages} initialPaper={detailPaper} onPrint={() => setPrintRows([detailRow])} />
      )}
      {printRows && <PrintSheets exam={exam} keys={keys} pages={pages} rows={printRows} onDone={() => setPrintRows(null)} />}
    </>
  );
}

/** [시험 개시] [응시 마감] — 지금 상태에서 누를 수 없는 버튼은 흐리게 */
function StatusButtons({ exam, onChange }) {
  const open = exam.status === 'open';
  return (
    <>
      <button
        className="btn ok"
        disabled={open}
        onClick={() => onChange('open')}
        title={open ? '이미 응시 중입니다' : '학생 목록에 이 시험이 보이고 응시할 수 있게 됩니다'}
      >
        {exam.status === 'closed' ? '시험 다시 개시' : '시험 개시'}
      </button>
      <button
        className="btn danger"
        disabled={!open}
        onClick={() => confirm('응시를 마감할까요?\n마감하면 학생 목록에서 시험이 빠지고, 제출한 학생은 결과만 볼 수 있어요.') && onChange('closed')}
        title={open ? '응시를 마감합니다' : '응시 중일 때만 마감할 수 있습니다'}
      >
        응시 마감
      </button>
    </>
  );
}

/** 결과표의 오답 재응시 진행 상황 */
function RetakeCell({ st }) {
  if (!st.enabled) return <span className="muted">-</span>;
  if (st.pending.length && !st.remaining.length) {
    return <span className="badge review" title={`${st.pending.map((p) => p.no).join(', ')}번 — 검토 요청 탭에서 확인`}>확인 필요 {st.pending.length}</span>;
  }
  if (st.done) return <span className="badge open">완료{st.attempts ? ` · ${st.attempts}회` : ''}</span>;
  return (
    <span className="badge review" title={`남은 문제: ${st.remaining.join(', ')}번`}>
      남은 {st.remaining.length}문제{st.attempts ? ` · ${st.attempts}회` : ''}
    </span>
  );
}

function nextOverride(item) {
  // 클릭할 때마다: 자동 → 정답 → 오답 → 자동
  if (!item.overridden) return 'correct';
  if (item.status === 'correct') return 'wrong';
  return null;
}

function ResultsTab({ exam, graded, onOpen, onJudge, examId, keys, onPrint }) {
  if (!graded.length) return <div className="card center muted">아직 제출한 학생이 없습니다.</div>;
  const states = Object.fromEntries(graded.map(({ s, r }) => [s.id, retakeState(exam, keys, s, r)]));
  async function allowRetake(s) {
    if (!confirm(`${s.classNo}반 ${s.number}번 ${s.name} 학생의 응시 기록을 모두 삭제할까요?\n삭제하면 이 학생이 처음부터 다시 응시할 수 있습니다.`)) return;
    await deleteSubmission(examId, s);
  }
  const retakeError = (err) =>
    alert(
      err.code === 'permission-denied'
        ? '저장하지 못했습니다. Firebase 보안 규칙이 아직 오답 재응시용 새 규칙이 아닙니다.\nFirebase 콘솔 → Firestore Database → 규칙 탭에 새 규칙을 붙여 넣고 게시해 주세요.'
        : `저장 실패: ${err.message}`,
    );
  async function toggleWrongRetake(s) {
    const on = !states[s.id].enabled;
    try {
      await setRetake(examId, [s.id], on);
    } catch (err) {
      retakeError(err);
    }
  }
  // 틀린 문제가 있는데 아직 오답 재응시가 꺼진 학생
  const waiting = graded.filter(({ s }) => !states[s.id].enabled && states[s.id].firstWrong.length > 0);
  async function allWrongRetake() {
    if (!confirm(`틀린 문제가 있는 학생 ${waiting.length}명 모두에게 오답 재응시를 켤까요?\n처음 점수는 바뀌지 않습니다.`)) return;
    try {
      await setRetake(examId, waiting.map(({ s }) => s.id), true);
    } catch (err) {
      retakeError(err);
    }
  }
  return (
    <div className="card table-wrap" style={{ padding: 0 }}>
      <div className="row" style={{ padding: '10px 12px', justifyContent: 'flex-end' }}>
        <button
          className="btn sm"
          onClick={() => onPrint(graded)}
          disabled={!onPrint}
          title={onPrint ? '채점된 결과지를 학생마다 새 쪽으로 한꺼번에 인쇄합니다' : '문제지 이미지를 불러오는 중입니다'}
        >
          🖨 전체 결과지 인쇄 ({graded.length}명)
        </button>
        <button className="btn sm" onClick={allWrongRetake} disabled={!waiting.length}>
          전체 학생 오답만 재응시{waiting.length ? ` (${waiting.length}명)` : ''}
        </button>
      </div>
      <table className="data results-table">
        <thead>
          <tr>
            <th>반</th><th>번</th><th>이름</th><th className="c">점수</th><th className="c">오답 재응시</th><th className="c">결과지</th>
            {exam.questions.map((q) => <th key={q.no} className="c qcol">{q.no}</th>)}
            <th />
          </tr>
        </thead>
        <tbody>
          {graded.map(({ s, r }) => (
            <tr key={s.id}>
              <td>{s.classNo}</td>
              <td>{s.number}</td>
              <td className="nowrap">{s.name}</td>
              <td className="c"><b>{r.score100}</b></td>
              <td className="c nowrap small"><RetakeCell st={states[s.id]} /></td>
              <td className="c">
                <span className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'center' }}>
                  <button className="btn xs" onClick={() => onOpen(s.id, true)} aria-label={`${s.name} 결과지`}>📄 보기</button>
                  <button className="btn xs" onClick={() => onPrint([{ s, r }])} disabled={!onPrint} aria-label={`${s.name} 결과지 인쇄`} title="이 학생 결과지 인쇄">🖨 인쇄</button>
                </span>
              </td>
              {r.items.map((it, i) => (
                <td key={it.no} className="c qcol">
                  <button
                    className={`mark sm ${it.status} ${it.overridden ? 'overridden' : ''}`}
                    title={`${answerToText(exam.questions[i], s.answers?.[it.no])}\n${it.overridden ? '교사 판정' : it.auto.reason || '자동 채점'}\n(클릭: 판정 바꾸기)`}
                    onClick={() => onJudge(s, it.no, nextOverride(it))}
                  >
                    {it.partial ? it.earned : MARK[it.status]}
                  </button>
                </td>
              ))}
              <td className="nowrap">
                <button
                  className={`btn xs ${states[s.id].enabled ? '' : 'primary'}`}
                  onClick={() => toggleWrongRetake(s)}
                  disabled={!states[s.id].enabled && !states[s.id].firstWrong.length}
                  title={states[s.id].firstWrong.length ? '틀린 문제만 다시 풀게 합니다 (처음 점수는 그대로)' : '틀린 문제가 없습니다'}
                >
                  {states[s.id].enabled ? '오답 재응시 끄기' : '오답만 재응시'}
                </button>{' '}
                <button className="btn xs danger" onClick={() => allowRetake(s)}>전체 재응시</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ padding: '0 12px' }}>
        O/X/? 를 누르면 판정을 바꿀 수 있습니다 (자동 → 정답 → 오답 → 자동). 테두리가 있는 표시는 교사가 직접 판정한 것입니다. “오답만 재응시”는 틀린 문제만 맞힐 때까지 다시 풀게 합니다(점수는 처음 제출한 점수 그대로). “전체 재응시”는 응시 기록을 지워 처음부터 다시 보게 합니다.
      </p>
    </div>
  );
}

function ReviewTab({ exam, keys, graded, onJudge, pages, examId }) {
  const items = [];
  const retakeItems = [];
  for (const { s, r } of graded) {
    r.items.forEach((it, i) => {
      if (it.status === 'review') items.push({ s, it, q: exam.questions[i] });
    });
    for (const p of retakeState(exam, keys, s, r).pending) {
      const q = exam.questions.find((x) => x.no === p.no);
      if (q) retakeItems.push({ s, p, q });
    }
  }
  if (!items.length && !retakeItems.length) return <div className="card center muted">검토할 답안이 없습니다. 👍</div>;
  async function judgeRetake(s, p, value) {
    try {
      await setRetakeJudge(examId, s.id, p.round, p.no, value);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    }
  }
  return (
    <div>
      {retakeItems.length > 0 && (
        <>
          <p className="muted">
            <b>오답 재응시</b>에서 다시 푼 답 중 자동 채점으로 판단하기 어려운 답입니다. 정답으로 인정하면 그 문제는 다 맞힌 것으로,
            오답으로 처리하면 학생이 다시 풀게 됩니다. (처음 점수는 바뀌지 않아요)
          </p>
          {retakeItems.map(({ s, p, q }) => (
            <div key={`${s.id}-r${p.round}-${p.no}`} className="review-item" data-testid="retake-review-item">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <b>{q.no}번</b> <span className="muted small">{TYPE_LABEL[q.type]}</span>
                  <span style={{ marginLeft: 10 }}>{s.classNo}반 {s.number}번 {s.name}</span>
                </div>
                <span className="badge review">{p.round}차 오답 재응시{p.reason ? ` · ${p.reason}` : ''}</span>
              </div>
              <div className="review-grid">
                <div className="review-q">
                  {pages == null ? (
                    <Loading text="문제 불러오는 중…" />
                  ) : p.answer?.strokes?.length ? (
                    <DrawnAnswer exam={exam} pages={pages} q={q} strokes={p.answer.strokes} />
                  ) : (
                    <ReviewQuestion exam={exam} q={q} pages={pages} />
                  )}
                </div>
                <div>
                  <div className="small" style={{ fontWeight: 600 }}>학생이 다시 푼 답</div>
                  <div className="ans">
                    {answerToText({ ...q, type: q.type === 'draw' ? 'short' : q.type, draw: false }, p.answer?.strokes ? p.answer.text : p.answer)
                      || (p.answer?.strokes?.length ? '(왼쪽 그림)' : '')}
                  </div>
                  <div className="small" style={{ fontWeight: 600, marginTop: 8 }}>정답</div>
                  <div className="ans" style={{ background: 'var(--ok-weak)' }}>{keyToText(q, keys[q.no])}</div>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn ok lg" onClick={() => judgeRetake(s, p, 'correct')}>정답 인정</button>
                    <button className="btn bad lg" onClick={() => judgeRetake(s, p, 'wrong')}>오답 처리</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {items.length > 0 && <h3 style={{ marginTop: 24 }}>처음 제출한 답안</h3>}
        </>
      )}
      <p className="muted">자동 채점으로 판단하기 어려운 답안입니다. 정답으로 인정할지 결정해 주세요. 결정하면 학생 점수에 바로 반영됩니다.</p>
      {items.map(({ s, it, q }) => (
        <div key={`${s.id}-${it.no}`} className="review-item" data-testid="review-item">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <b>{q.no}번</b> <span className="muted small">{TYPE_LABEL[q.type]} · {it.points}점</span>
              <span style={{ marginLeft: 10 }}>{s.classNo}반 {s.number}번 {s.name}</span>
            </div>
            <span className="badge review">{it.auto.reason || '검토 필요'}</span>
          </div>
          <div className="review-grid">
            <div className="review-q">
              {pages == null ? (
                <Loading text="문제 불러오는 중…" />
              ) : (
                <ReviewQuestion exam={exam} q={q} pages={pages} strokes={s.answers?.[q.no]?.strokes} />
              )}
            </div>
            <div>
              <div className="small" style={{ fontWeight: 600 }}>학생 답</div>
              <div className="ans">{answerToText(q, s.answers?.[q.no])}</div>
              <div className="small" style={{ fontWeight: 600, marginTop: 8 }}>정답</div>
              <div className="ans" style={{ background: 'var(--ok-weak)' }}>{keyToText(q, keys[q.no])}</div>
              {partPoints(q) ? (
                <PartialJudge q={q} it={it} onJudge={(v) => onJudge(s, q.no, v)} />
              ) : (
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn ok lg" onClick={() => onJudge(s, q.no, 'correct')}>정답 인정</button>
                  <button className="btn bad lg" onClick={() => onJudge(s, q.no, 'wrong')}>오답 처리</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 부분 점수 문항 판정: 확인할 부분을 인정/불인정하거나 점수를 직접 준다 */
function PartialJudge({ q, it, onJudge }) {
  const points = Number(q.points) || 0;
  const ps = it.auto.partStatus;
  // 선생님이 직접 채점하는 문항이면 부분마다 자동 결과가 없다 → 모두 확인할 부분
  const ok = ps ? partEarned(q, ps, ['correct', 'review']) : points;
  const base = ps ? partEarned(q, ps, ['correct']) : 0;
  const [custom, setCustom] = useState('');
  const pp = partPoints(q);
  return (
    <div className="stack" style={{ marginTop: 12, gap: 8 }}>
      <div className="small muted">부분 점수: {pp.map((p, i) => `(${i + 1}) ${p}점`).join(' · ')}</div>
      <div className="row">
        <button className="btn ok lg" onClick={() => onJudge(ok >= points ? 'correct' : ok)}>
          {ps ? '확인할 부분 정답 인정' : '정답 인정'} ({ok}점)
        </button>
        <button className="btn bad lg" onClick={() => onJudge(base > 0 ? base : 'wrong')}>
          {ps ? '확인할 부분 오답 처리' : '오답 처리'} ({base}점)
        </button>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <input
          type="number"
          min="0"
          max={points}
          step="0.5"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          style={{ width: 80 }}
          aria-label={`${q.no}번 줄 점수`}
        />
        <button className="btn" disabled={custom === '' || !(Number(custom) >= 0)} onClick={() => onJudge(Math.min(points, Number(custom)))}>
          점 주기 (최대 {points}점)
        </button>
      </div>
    </div>
  );
}

function ReviewQuestion({ exam, q, pages, strokes }) {
  const { passage, question } = regionsOf(exam, q);
  return (
    <div className="stack">
      {passage.length > 0 && (
        <details>
          <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>지문 보기</summary>
          <div className="fit-card passage" style={{ marginTop: 6 }}>
            <Regions exam={exam} pages={pages} regions={passage} />
          </div>
        </details>
      )}
      <div className="fit-card">
        <div style={{ position: 'relative' }}>
          <Regions exam={exam} pages={pages} regions={question} />
          {strokes?.length > 0 && <DrawLayer ratio={stackRatio(exam, question)} strokes={strokes} readOnly />}
        </div>
      </div>
    </div>
  );
}

function AnalysisTab({ exam, keys, graded }) {
  if (!graded.length) return <div className="card center muted">아직 제출한 학생이 없습니다.</div>;
  return (
    <div className="card table-wrap" style={{ padding: 0 }}>
      <table className="data analysis-table">
        <thead>
          <tr><th className="c">번호</th><th>유형</th><th>정답</th><th>정답률</th><th className="c">검토</th></tr>
        </thead>
        <tbody>
          {exam.questions.map((q, i) => {
            const st = graded.map((g) => g.r.items[i].status);
            const c = st.filter((x) => x === 'correct').length;
            const rv = st.filter((x) => x === 'review').length;
            const pct = Math.round((c / graded.length) * 100);
            return (
              <tr key={q.no}>
                <td className="c">{q.no}</td>
                <td className="nowrap">{TYPE_LABEL[q.type]}</td>
                {/* 서술형만 줄바꿈, 나머지 정답은 한 줄 */}
                <td className={`small ${q.type === 'essay' ? 'wrap' : 'one-line'}`} title={keyToText(q, keys[q.no])}>
                  {keyToText(q, keys[q.no])}
                </td>
                <td className="rate">
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <div className="progress" style={{ flex: 1, marginTop: 0 }}>
                      <div style={{ width: `${pct}%`, background: pct < 50 ? 'var(--bad)' : 'var(--ok)' }} />
                    </div>
                    <span className="small nowrap" style={{ minWidth: 76 }}>{pct}% ({c}명)</span>
                  </div>
                </td>
                <td className="c">{rv || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditTab({ exam, keys, hasSubs, onSaved, pages }) {
  const [items, setItems] = useState(() => toItems(exam.questions, keys));
  const [errs, setErrs] = useState([]);
  const [popup, setPopup] = useState(null); // 지금 화면 가운데에 띄울 저장 오류
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const e = validateItems(items, exam.pageCount);
    setErrs(e);
    setMsg('');
    if (e.length) return setPopup(e);
    const { questions, keys: k } = fromItems(items);
    setBusy(true);
    try {
      // 고친 문항 번호 (문항 형식이나 정답이 바뀐 것) → 학생 화면 알림에 쓴다
      const view = (q) => (q ? { ...q, regions: undefined, anchor: undefined, blanks: undefined, answerSpots: undefined, blankInfo: undefined, fullText: undefined } : null);
      const changed = questions
        .filter((q) => {
          const old = exam.questions.find((o) => o.no === q.no);
          return stableKey(view(old)) !== stableKey(view(q)) || stableKey(keys[q.no] ?? keys[String(q.no)]) !== stableKey(k[q.no]);
        })
        .map((q) => q.no);
      await saveQuestionsAndKeys(exam.id, questions, k, changed);
      onSaved(questions, k);
      setMsg('저장했습니다. 모든 학생의 점수가 새 정답으로 다시 채점됩니다.');
    } catch (err) {
      setErrs([err.message]);
      setPopup([`저장 중 오류가 났어요: ${err.message}`, '인터넷 연결을 확인한 뒤 다시 저장해 주세요.']);
    } finally {
      setBusy(false);
    }
  }

  if (!pages) return <Loading />;
  return (
    <div className="stack">
      {hasSubs && <div className="alert info">이미 응시한 학생이 있습니다. 정답을 고치면 저장 즉시 모든 학생이 새 정답으로 다시 채점됩니다.</div>}
      {errs.length > 0 && <div className="alert error"><ul>{errs.map((x, i) => <li key={i}><ErrorLine text={x} /></li>)}</ul></div>}
      {msg && <div className="alert success">{msg}</div>}
      <ExamPreviewEditor view={exam} pages={pages} items={items} onChange={setItems} title={exam.title} />
      <div className="save-bar">
        {/* 저장 버튼 바로 옆에도 결과를 보여 준다 (맨 위까지 올라가지 않아도 되게) */}
        {errs.length > 0 && (
          <button type="button" className="btn sm danger" onClick={() => setPopup(errs)}>⚠️ 고칠 곳 {errs.length}개 보기</button>
        )}
        {msg && !errs.length && <span className="save-ok">✓ 저장했어요</span>}
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : '문항·정답 저장'}</button>
      </div>
      <SaveErrorDialog errors={popup} onClose={() => setPopup(null)} />
    </div>
  );
}

function SettingsTab({ exam, onSaved, onPages, onDeleted }) {
  const { owner } = useTeacher();
  const target = classTarget(owner);
  const [myExams, setMyExams] = useState([]);
  useEffect(() => (owner?.uid ? watchMyExams(owner.uid, setMyExams, () => {}) : undefined), [owner?.uid]);
  const [meta, setMeta] = useState(() => ({
    subject: SUBJECTS.includes(exam.subject) ? exam.subject : '기타',
    subjectCustom: SUBJECTS.includes(exam.subject) ? '' : exam.subject,
    grade: String(target ? target.grade : exam.grade),
    semester: String(exam.semester),
    unit: exam.unit || '',
    title: exam.title,
    leniency: exam.leniency || 'normal',
  }));
  const [msg, setMsg] = useState('');
  const [imgMsg, setImgMsg] = useState({ kind: '', text: '' });

  /** 같은 문제지 PDF를 다시 올려 이미지만 고화질로 바꾸기 */
  async function reimage(file) {
    try {
      setImgMsg({ kind: 'info', text: '문제지를 읽는 중…' });
      const pdf = await openPdf(await readFileAsArrayBuffer(file));
      const count = exam.pageCount || exam.pageAspects?.length;
      if (count && pdf.numPages !== count) {
        return setImgMsg({ kind: 'error', text: `쪽수가 달라요 (지금 ${count}쪽, 올린 파일 ${pdf.numPages}쪽). 같은 문제지 PDF를 올려 주세요.` });
      }
      const imgs = await renderPages(pdf, { onProgress: (i, n) => setImgMsg({ kind: 'info', text: `고화질 이미지 만드는 중… (${i}/${n})` }) });
      setImgMsg({ kind: 'info', text: '저장 중…' });
      const patch = {
        pageAspects: imgs.map((x) => x.aspect),
        pageWidthsCm: imgs.map((x) => Math.round(x.widthCm * 100) / 100),
      };
      await replacePages(exam.id, imgs.map((x) => x.src), patch, (i, n) => setImgMsg({ kind: 'info', text: `저장 중… (${i}/${n})` }));
      onSaved(patch);
      onPages(imgs.map((x) => x.src));
      setImgMsg({ kind: 'success', text: '문제지 이미지를 고화질로 바꿨어요. 학생 화면도 다음에 열 때부터 선명하게 보여요.' });
    } catch (err) {
      setImgMsg({ kind: 'error', text: `바꾸지 못했습니다: ${err.message}` });
    }
  }

  async function save() {
    const patch = {
      subject: subjectName(meta),
      grade: target ? target.grade : Number(meta.grade),
      semester: Number(meta.semester),
      unit: meta.unit.trim(),
      title: meta.title.trim() || exam.title,
      classes: target ? target.classes : exam.classes || [],
      leniency: meta.leniency,
    };
    const same = findSameExam(myExams, patch, exam.id);
    if (same) {
      setMsg('');
      return alert(sameExamMessage(same));
    }
    await updateExam(exam.id, patch);
    onSaved(patch);
    setMsg('저장했습니다.');
  }

  async function remove() {
    if (!confirm('이 평가와 모든 학생 응시 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
    await deleteExam(exam.id);
    onDeleted();
  }

  return (
    <div className="stack">
      <div className="card stack">
        <MetaFields meta={meta} setMeta={setMeta} lockedGrade={!!target} />
        {msg && <div className="alert success">{msg}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={save}>설정 저장</button>
        </div>
      </div>
      <div className="card stack">
        <div>
          <b>문제지 이미지 고화질로 바꾸기</b>
          <div className="muted small">예전에 만든 평가의 문제가 흐리게 보이면, 같은 문제지 PDF를 다시 올려 주세요. 문항·정답·응시 기록은 그대로 두고 이미지만 바꿉니다.</div>
        </div>
        <FileDrop accept=".pdf,application/pdf" onFile={reimage} label="같은 문제지 PDF" compact testId="reimage" />
        {imgMsg.text && <div className={`alert ${imgMsg.kind}`}>{imgMsg.kind === 'info' && <span className="spinner" />} {imgMsg.text}</div>}
      </div>
      <div className="card row" style={{ justifyContent: 'space-between' }}>
        <div>
          <b>평가 삭제</b>
          <div className="muted small">문제지, 정답, 모든 응시 기록이 삭제됩니다. 필요하면 먼저 엑셀로 내려받으세요.</div>
        </div>
        <button className="btn danger" onClick={remove}>삭제</button>
      </div>
    </div>
  );
}

function StudentDetail({ exam, keys, row, onJudge, onClose, pages, initialPaper, onPrint }) {
  const { s, r } = row;
  const [paper, setPaper] = useState(!!initialPaper);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 960, maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>{s.classNo}반 {s.number}번 {s.name} — {r.score100}점</h2>
          <div className="row">
            <button className="btn sm" onClick={() => setPaper(!paper)} disabled={!pages?.length}>
              {paper ? '표로 보기' : '채점된 시험지 보기'}
            </button>
            <button className="btn sm" onClick={onPrint} disabled={!pages?.length}>🖨 결과지 인쇄</button>
            <button className="btn sm" onClick={onClose}>닫기</button>
          </div>
        </div>
        {paper && pages?.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <GradedPaper exam={exam} pages={pages} keys={keys} answers={s.answers} result={r} />
          </div>
        ) : (
        <table className="data" style={{ marginTop: 12 }}>
          <thead><tr><th className="c">번호</th><th>학생 답</th><th>정답</th><th>판정</th></tr></thead>
          <tbody>
            {exam.questions.map((q, i) => {
              const it = r.items[i];
              return (
                <tr key={q.no}>
                  <td className="c">{q.no}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{answerToText(q, s.answers?.[q.no])}</td>
                  <td className="small muted">{keyToText(q, keys[q.no])}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={`mark ${it.status} ${it.overridden ? 'overridden' : ''}`}>{MARK[it.status]}</span>{' '}
                    <span className="small muted">{it.overridden ? '교사 판정' : `${STATUS_LABEL[it.status]}${it.auto.reason ? ` · ${it.auto.reason}` : ''}`}{it.partial ? ` · 부분 점수 ${it.earned}/${it.points}점` : ''}</span>
                    <div className="row" style={{ gap: 4, marginTop: 4 }}>
                      <button className="btn sm" onClick={() => onJudge(s, q.no, 'correct')}>O</button>
                      <button className="btn sm" onClick={() => onJudge(s, q.no, 'wrong')}>X</button>
                      {it.overridden && <button className="btn sm" onClick={() => onJudge(s, q.no, null)}>자동</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
