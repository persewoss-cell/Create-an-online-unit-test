import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import ExamPreviewEditor from '../../components/ExamPreviewEditor.jsx';
import { GradedPaper, Regions, regionsOf, stackRatio } from '../../components/ExamViews.jsx';
import { DrawLayer } from '../../components/Drawing.jsx';
import MetaFields, { parseClasses, subjectName, SUBJECTS } from '../../components/MetaFields.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import {
  getExam, getKeys, watchSubmissions, setOverride, deleteSubmission, updateExam, saveQuestionsAndKeys, deleteExam, getPages,
} from '../../lib/db.js';
import { gradeSubmission } from '../../lib/grading.js';
import { exportResultsXlsx, sortSubmissions } from '../../lib/excel.js';
import { answerToText, keyToText, TYPE_LABEL, STATUS_LABEL } from '../../lib/format.js';
import { toItems, fromItems, validateItems } from '../../lib/editorModel.js';
import { STATUS } from './Dashboard.jsx';

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
  const { teacher } = useTeacher();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'results';
  const [exam, setExam] = useState(null);
  const [keys, setKeys] = useState(null);
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailPaper, setDetailPaper] = useState(false);
  const [pages, setPages] = useState(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const e = await getExam(id);
        if (!e) throw new Error('평가를 찾을 수 없습니다.');
        setExam(e);
        setKeys(await getKeys(id));
        unsub = watchSubmissions(id, setSubs, (err) => setError(err.message));
        getPages(id).then(setPages).catch(() => setPages([]));
      } catch (err) {
        setError(err.message);
      }
    })();
    return () => unsub();
  }, [id]);

  const graded = useMemo(() => {
    if (!exam || !keys || !subs) return [];
    return sortSubmissions(subs).map((s) => ({ s, r: gradeSubmission(exam, keys, s) }));
  }, [exam, keys, subs]);

  const reviewCount = graded.reduce((a, g) => a + g.r.reviewCount, 0);

  if (error) return (<><TopBar home="/teacher/dashboard" /><div className="container"><div className="alert error">{error}</div></div></>);
  if (!exam || !keys || !subs) return (<><TopBar home="/teacher/dashboard" /><Loading /></>);

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
      <TopBar home="/teacher/dashboard" who="관리자">
        <Link to="/teacher/dashboard" className="btn sm">목록</Link>
      </TopBar>
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
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setParams({ tab: k })}>
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
          />
        )}
        {tab === 'review' && <ReviewTab exam={exam} keys={keys} graded={graded} onJudge={judge} pages={pages} />}
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
            onDeleted={() => nav('/teacher/dashboard')}
          />
        )}
      </div>

      {detailRow && (
        <StudentDetail exam={exam} keys={keys} row={detailRow} onJudge={judge} onClose={() => setDetail(null)} pages={pages} initialPaper={detailPaper} />
      )}
    </>
  );
}

function StatusButtons({ exam, onChange }) {
  if (exam.status === 'open') return <button className="btn danger" onClick={() => onChange('closed')}>응시 마감</button>;
  return (
    <button className="btn ok" onClick={() => onChange('open')}>
      {exam.status === 'closed' ? '응시 다시 열기' : '응시 열기'}
    </button>
  );
}

function nextOverride(item) {
  // 클릭할 때마다: 자동 → 정답 → 오답 → 자동
  if (!item.overridden) return 'correct';
  if (item.status === 'correct') return 'wrong';
  return null;
}

function ResultsTab({ exam, graded, onOpen, onJudge, examId }) {
  if (!graded.length) return <div className="card center muted">아직 제출한 학생이 없습니다.</div>;
  async function allowRetake(s) {
    if (!confirm(`${s.classNo}반 ${s.number}번 ${s.name} 학생의 응시 기록을 삭제할까요?\n삭제하면 이 학생이 다시 응시할 수 있습니다.`)) return;
    await deleteSubmission(examId, s);
  }
  return (
    <div className="card table-wrap" style={{ padding: 0 }}>
      <table className="data results-table">
        <thead>
          <tr>
            <th>반</th><th>번</th><th>이름</th><th className="c">점수</th><th className="c">결과지</th>
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
              <td className="c">
                <button className="btn xs" onClick={() => onOpen(s.id, true)} aria-label={`${s.name} 결과지`}>📄 보기</button>
              </td>
              {r.items.map((it, i) => (
                <td key={it.no} className="c qcol">
                  <button
                    className={`mark sm ${it.status} ${it.overridden ? 'overridden' : ''}`}
                    title={`${answerToText(exam.questions[i], s.answers?.[it.no])}\n${it.overridden ? '교사 판정' : it.auto.reason || '자동 채점'}\n(클릭: 판정 바꾸기)`}
                    onClick={() => onJudge(s, it.no, nextOverride(it))}
                  >
                    {MARK[it.status]}
                  </button>
                </td>
              ))}
              <td className="nowrap"><button className="btn xs danger" onClick={() => allowRetake(s)}>재응시</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ padding: '0 12px' }}>
        O/X/? 를 누르면 판정을 바꿀 수 있습니다 (자동 → 정답 → 오답 → 자동). 테두리가 있는 표시는 교사가 직접 판정한 것입니다. “재응시”는 응시 기록을 지워 다시 볼 수 있게 합니다.
      </p>
    </div>
  );
}

function ReviewTab({ exam, keys, graded, onJudge, pages }) {
  const items = [];
  for (const { s, r } of graded) {
    r.items.forEach((it, i) => {
      if (it.status === 'review') items.push({ s, it, q: exam.questions[i] });
    });
  }
  if (!items.length) return <div className="card center muted">검토할 답안이 없습니다. 👍</div>;
  return (
    <div>
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
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn ok lg" onClick={() => onJudge(s, q.no, 'correct')}>정답 인정</button>
                <button className="btn bad lg" onClick={() => onJudge(s, q.no, 'wrong')}>오답 처리</button>
              </div>
            </div>
          </div>
        </div>
      ))}
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
      <table className="data">
        <thead>
          <tr><th className="c">번호</th><th>유형</th><th>정답</th><th style={{ width: '35%' }}>정답률</th><th className="c">검토</th></tr>
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
                <td>{TYPE_LABEL[q.type]}</td>
                <td className="small">{keyToText(q, keys[q.no])}</td>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <div className="progress" style={{ flex: 1, marginTop: 0 }}>
                      <div style={{ width: `${pct}%`, background: pct < 50 ? 'var(--bad)' : 'var(--ok)' }} />
                    </div>
                    <span className="small" style={{ width: 70 }}>{pct}% ({c}명)</span>
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
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const e = validateItems(items, exam.pageCount);
    setErrs(e);
    setMsg('');
    if (e.length) return;
    const { questions, keys: k } = fromItems(items);
    setBusy(true);
    try {
      await saveQuestionsAndKeys(exam.id, questions, k);
      onSaved(questions, k);
      setMsg('저장했습니다. 모든 학생의 점수가 새 정답으로 다시 채점됩니다.');
    } catch (err) {
      setErrs([err.message]);
    } finally {
      setBusy(false);
    }
  }

  if (!pages) return <Loading />;
  return (
    <div className="stack">
      {hasSubs && <div className="alert info">이미 응시한 학생이 있습니다. 정답을 고치면 저장 즉시 모든 학생이 새 정답으로 다시 채점됩니다.</div>}
      {errs.length > 0 && <div className="alert error"><ul>{errs.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      {msg && <div className="alert success">{msg}</div>}
      <ExamPreviewEditor view={exam} pages={pages} items={items} onChange={setItems} title={exam.title} />
      <div className="row" style={{ justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '10px 0' }}>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : '문항·정답 저장'}</button>
      </div>
    </div>
  );
}

function SettingsTab({ exam, onSaved, onDeleted }) {
  const [meta, setMeta] = useState(() => ({
    subject: SUBJECTS.includes(exam.subject) ? exam.subject : '기타',
    subjectCustom: SUBJECTS.includes(exam.subject) ? '' : exam.subject,
    grade: String(exam.grade),
    semester: String(exam.semester),
    unit: exam.unit || '',
    title: exam.title,
    classesText: (exam.classes || []).join(', '),
    leniency: exam.leniency || 'normal',
  }));
  const [msg, setMsg] = useState('');

  async function save() {
    const patch = {
      subject: subjectName(meta),
      grade: Number(meta.grade),
      semester: Number(meta.semester),
      unit: meta.unit.trim(),
      title: meta.title.trim() || exam.title,
      classes: parseClasses(meta.classesText),
      leniency: meta.leniency,
    };
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
        <MetaFields meta={meta} setMeta={setMeta} />
        {msg && <div className="alert success">{msg}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={save}>설정 저장</button>
        </div>
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

function StudentDetail({ exam, keys, row, onJudge, onClose, pages, initialPaper }) {
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
                    <span className="small muted">{it.overridden ? '교사 판정' : `${STATUS_LABEL[it.status]}${it.auto.reason ? ` · ${it.auto.reason}` : ''}`}</span>
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
