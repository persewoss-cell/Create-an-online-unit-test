import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loading from '../../components/Loading.jsx';
import { watchSharedExams, importSharedExam } from '../../lib/db.js';
import { classTarget, sharerLabel, teacherLabel } from '../../lib/school.js';
import { uniqueUnit } from '../../lib/examDup.js';
import { sortExams, sharedTime } from '../../lib/examSort.js';
import SortThBase, { loadSort, saveSort } from '../../components/SortTh.jsx';

/** 공유 시험지 가져오기: 다른 선생님(모든 학교)이 공유한 시험지를 골라 내 학교·학년·반 평가로 복사 */
export default function SharedImport({ owner, myExams = [], onClose }) {
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  // 정렬 (내 단원평가 목록과 같은 세모 방식, 이 기기에 기억) — 기본은 최근에 공유한 것이 위로
  const [sort, setSortState] = useState(() => loadSort('shared-list-sort'));
  const setSort = (v) => {
    setSortState(v);
    saveSort('shared-list-sort', v);
  };
  const SortTh = (p) => <SortThBase {...p} sort={sort} setSort={setSort} baseLabel="최근 공유 순" />;

  useEffect(() => watchSharedExams(setList, (e) => setError(e.code === 'permission-denied'
    ? '공유 시험지를 불러오지 못했어요. Firebase 보안 규칙을 새 규칙으로 게시했는지 확인해 주세요.'
    : e.message)), []);

  /** 가져왔을 때의 단원명: 내 평가에 같은 학년·학기·과목·단원이 있으면 "2. 원(2)"처럼 */
  const unitFor = (e) => uniqueUnit(myExams, { grade: classTarget(owner)?.grade ?? e.grade, semester: e.semester, subject: e.subject, unit: e.unit });

  async function take(e) {
    const unit = unitFor(e);
    const renamed = unit !== String(e.unit ?? '').trim();
    if (!confirm(`"${e.unit || e.title}" 시험지를 가져올까요?\n${teacherLabel(owner)} 평가로 복사되고, "개시 전" 상태로 만들어져요.${renamed ? `\n\n같은 단원 평가가 이미 있어서 단원명을 "${unit}"(으)로 붙여요.` : ''}`)) return;
    setBusy(e.id);
    setError('');
    try {
      const id = await importSharedExam(e, owner, { unit });
      onClose();
      nav(`/teacher/exam/${id}`, { state: { back: '/teacher/dashboard' } });
    } catch (err) {
      setError(`가져오지 못했어요: ${err.message}`);
      setBusy('');
    }
  }

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = sortExams(
    (list || [])
      .filter((e) => e.ownerUid !== owner.uid)
      .filter((e) => !words.length || words.every((w) => `${e.title} ${e.subject} ${e.unit} ${e.grade}학년 ${e.semester}학기 ${sharerLabel(e)} ${e.school}`.toLowerCase().includes(w))),
    {}, sort, sharedTime,
  );

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="shared-title" onClick={onClose}>
      <div className="modal stack shared-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="shared-title" style={{ margin: 0 }}>공유 시험지 가져오기</h2>
          <button type="button" className="btn sm" onClick={onClose}>닫기</button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          다른 선생님들이 공유한 시험지예요. 가져오면 문항·정답·문제지가 그대로 복사되어 <b>{teacherLabel(owner)}</b> 평가가 되고,
          "개시 전" 상태로 만들어져요. (학생 답안은 복사되지 않아요)
        </p>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기: 과목, 단원, 학년, 학교…" aria-label="공유 시험지 찾기" />
        {error && <div className="alert error">{error}</div>}
        {!list && !error && <Loading />}
        {list && !shown.length && <div className="center muted">{q ? '찾는 시험지가 없어요.' : '아직 공유된 시험지가 없어요.'}</div>}
        {shown.length > 0 && (
          <div className="table-wrap">
            <table className="data exam-list">
              <thead>
                <tr>
                  <SortTh k="grade" center>학년</SortTh>
                  <SortTh k="semester" center>학기</SortTh>
                  <SortTh k="subject">과목</SortTh>
                  <SortTh k="unit" cls="unit-col">단원</SortTh>
                  <SortTh k="questions" center>문항</SortTh>
                  <SortTh k="sharer">공유 정보</SortTh>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id}>
                    <td className="c">{e.grade}학년</td>
                    <td className="c">{e.semester}학기</td>
                    <td>{e.subject}</td>
                    <td className="unit-col" title={e.title}><b>{e.unit || e.title}</b></td>
                    <td className="c">{e.questions?.length || 0}</td>
                    <td>{sharerLabel(e)}</td>
                    <td>
                      <button className="btn sm primary" disabled={!!busy} onClick={() => take(e)}>
                        {busy === e.id ? '가져오는 중…' : '가져오기'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
