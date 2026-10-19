import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { useDirectory, schoolsOf } from '../components/SchoolSelect.jsx';
import { watchClassStats } from '../lib/db.js';

/** 점수 → 막대·글자 색 */
function tone(avg) {
  if (avg >= 90) return 'great';
  if (avg >= 80) return 'good';
  if (avg >= 70) return 'mid';
  return 'low';
}

/**
 * 반별 평가 평균 (로그인 없이): 학교 · 학년 · 반을 누르면 평가별 평균 점수만 보여 준다.
 * 고른 값은 주소(?s=학교&g=학년&c=반)에 남아서 그 반 주소를 그대로 알려 줄 수 있다.
 */
export default function ClassScores() {
  const [params, setParams] = useSearchParams();
  const dir = useDirectory();
  const schools = schoolsOf(dir);
  const school = params.get('s') || '';
  const grade = Number(params.get('g')) || 0;
  const classNo = Number(params.get('c')) || 0;
  const [subject, setSubject] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  const pick = (s, g, c) => {
    const next = {};
    if (s) next.s = s;
    if (s && g) next.g = String(g);
    if (s && g && c) next.c = String(c);
    setParams(next, { replace: true });
    setSubject('');
  };
  // 학교가 하나뿐이면 저절로 고른다
  useEffect(() => {
    if (!school && schools.length === 1) pick(schools[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);

  const grades = useMemo(
    () => [...new Set((dir || []).filter((d) => d.school === school).map((d) => d.grade))].sort((a, b) => a - b),
    [dir, school],
  );
  const classes = useMemo(
    () => [...new Set((dir || []).filter((d) => d.school === school && d.grade === grade).map((d) => d.classNo))].sort((a, b) => a - b),
    [dir, school, grade],
  );

  useEffect(() => {
    setList(null);
    setError('');
    if (!school || !grade || !classNo) return undefined;
    return watchClassStats(
      school, grade, classNo,
      (l) => setList(l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))),
      () => setError('평균을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'),
    );
  }, [school, grade, classNo]);

  const subjects = useMemo(() => [...new Set((list || []).map((x) => x.subject).filter(Boolean))], [list]);
  const shown = (list || []).filter((x) => !subject || x.subject === subject);

  return (
    <>
      <TopBar />
      <div className="container scores">
        <h1>📊 반별 평가 평균</h1>
        <div className="card scores-pick">
          <label className="field">
            <span>학교</span>
            <select value={school} onChange={(e) => pick(e.target.value)} aria-label="학교" disabled={dir === null}>
              <option value="">{dir === null ? '불러오는 중…' : '학교를 고르세요'}</option>
              {schools.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {school && (
            <div className="scores-row">
              <span className="scores-label">학년</span>
              <div className="chips" role="group" aria-label="학년">
                {grades.map((g) => (
                  <button key={g} type="button" className={`chip${g === grade ? ' on' : ''}`} aria-pressed={g === grade} onClick={() => pick(school, g)}>
                    {g}학년
                  </button>
                ))}
              </div>
            </div>
          )}
          {school && grade > 0 && (
            <div className="scores-row">
              <span className="scores-label">반</span>
              <div className="chips" role="group" aria-label="반">
                {classes.map((c) => (
                  <button key={c} type="button" className={`chip${c === classNo ? ' on' : ''}`} aria-pressed={c === classNo} onClick={() => pick(school, grade, c)}>
                    {c}반
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {school && grade > 0 && classNo > 0 && (
          <>
            <div className="scores-head">
              <h2>{grade}학년 {classNo}반</h2>
              {subjects.length > 1 && (
                <div className="chips" role="group" aria-label="과목">
                  <button type="button" className={`chip sm${!subject ? ' on' : ''}`} aria-pressed={!subject} onClick={() => setSubject('')}>전체</button>
                  {subjects.map((s) => (
                    <button key={s} type="button" className={`chip sm${s === subject ? ' on' : ''}`} aria-pressed={s === subject} onClick={() => setSubject(s)}>{s}</button>
                  ))}
                </div>
              )}
            </div>
            {error && <div className="alert error">{error}</div>}
            {!error && list === null && <div className="muted">불러오는 중…</div>}
            {list && !list.length && <div className="card muted scores-empty">아직 결과가 나온 평가가 없어요.</div>}
            <div className="scores-grid">
              {shown.map((x) => (
                <div key={x.id} className={`card score-card ${tone(x.avg)}`}>
                  <div className="score-card-top">
                    <span className="subj">{x.subject}</span>
                    <span className="muted small">{x.semester}학기</span>
                    {x.status === 'open' && <span className="badge open">응시 중</span>}
                  </div>
                  <div className="score-card-unit" title={x.title}>{x.unit || x.title}</div>
                  <div className="score-card-avg">
                    <b>{x.avg}</b><span>점</span>
                  </div>
                  <div className="score-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, x.avg))}%` }} /></div>
                  <div className="muted small">{x.count}명 응시 평균</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
