import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import Loading from '../../components/Loading.jsx';
import FileDrop from '../../components/FileDrop.jsx';
import { listRoster, saveRosterEntry, deleteRosterEntry, saveRosterBulk } from '../../lib/db.js';
import { downloadRosterTemplate, readRosterSheet } from '../../lib/rosterSheet.js';

const empty = { grade: '', classNo: '', number: '', name: '' };

export default function Roster() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null); // {id, ...values}
  const [upload, setUpload] = useState(null); // {entries, errors}
  const [defGrade, setDefGrade] = useState('3');
  const [filter, setFilter] = useState('');

  async function reload() {
    try {
      setList(await listRoster());
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const valid = (e) => Number(e.grade) >= 1 && Number(e.grade) <= 6 && Number(e.classNo) > 0 && Number(e.number) > 0 && String(e.name).trim();

  async function add(ev) {
    ev.preventDefault();
    if (!valid(form)) return setError('학년·반·번호·이름을 모두 입력해 주세요.');
    const id = `${Number(form.grade)}-${Number(form.classNo)}-${Number(form.number)}`;
    if (list.some((x) => x.id === id) && !confirm(`${form.grade}학년 ${form.classNo}반 ${form.number}번이 이미 있습니다. 이름을 바꿀까요?`)) return;
    setError('');
    await saveRosterEntry(form);
    setForm({ ...empty, grade: form.grade, classNo: form.classNo, number: String(Number(form.number) + 1) });
    setMsg(`${form.name} 학생을 추가했습니다.`);
    reload();
  }

  async function saveEdit() {
    if (!valid(editing)) return setError('학년·반·번호·이름을 모두 입력해 주세요.');
    setError('');
    await saveRosterEntry(editing, editing.id);
    setEditing(null);
    reload();
  }

  async function remove(x) {
    if (!confirm(`${x.grade}학년 ${x.classNo}반 ${x.number}번 ${x.name} 학생을 명단에서 지울까요?\n(이미 본 평가 결과는 지워지지 않습니다)`)) return;
    await deleteRosterEntry(x.id);
    reload();
  }

  async function readFile(file) {
    setError('');
    setMsg('');
    try {
      setUpload(await readRosterSheet(await file.arrayBuffer(), defGrade));
    } catch (e) {
      setError(`엑셀을 읽지 못했습니다: ${e.message}`);
    }
  }

  async function applyUpload(replace) {
    if (replace && !confirm('지금 명단을 모두 지우고 엑셀의 명단으로 바꿀까요?')) return;
    await saveRosterBulk(upload.entries, replace);
    setMsg(`${upload.entries.length}명을 ${replace ? '새 명단으로 저장' : '명단에 추가'}했습니다.`);
    setUpload(null);
    reload();
  }

  const shown = (list || []).filter((x) => !filter || `${x.grade}-${x.classNo}` === filter);
  const classes = [...new Set((list || []).map((x) => `${x.grade}-${x.classNo}`))];

  return (
    <>
      <TopBar home="/teacher/dashboard" who="관리자">
        <Link to="/teacher/dashboard" className="btn sm">목록</Link>
      </TopBar>
      <div className="container" style={{ maxWidth: 900 }}>
        <h1>학생 명단</h1>
        <p className="muted">명단에 있는 학생만 학년·반·번호·이름으로 로그인할 수 있습니다. 이름까지 정확히 같아야 합니다.</p>
        {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}
        {msg && <div className="alert success" style={{ marginBottom: 12 }}>{msg}</div>}

        <div className="card stack">
          <h2 style={{ margin: 0 }}>엑셀로 한꺼번에 등록</h2>
          <div className="row">
            <button className="btn" onClick={() => downloadRosterTemplate(defGrade)}>학생 명단 양식 다운로드</button>
            <label className="small row" style={{ gap: 6 }}>
              학년 칸이 없으면
              <select value={defGrade} onChange={(e) => setDefGrade(e.target.value)} style={{ width: 90, padding: '5px 8px' }} aria-label="기본 학년">
                {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>{g}학년</option>)}
              </select>
              으로
            </label>
          </div>
          <FileDrop accept=".xlsx" onFile={readFile} label="학생 명단 엑셀" hint="반 · 번호 · 이름(학년) 엑셀을 끌어다 놓거나 눌러서 고르세요" testId="roster-drop" />
          {upload && (
            <div className="stack">
              <div>
                엑셀에서 <b>{upload.entries.length}명</b>을 찾았습니다.
                {upload.entries.length > 0 && (
                  <span className="muted small"> ({upload.entries.slice(0, 5).map((e) => `${e.classNo}-${e.number} ${e.name}`).join(', ')}{upload.entries.length > 5 ? ' …' : ''})</span>
                )}
              </div>
              {upload.errors.length > 0 && <div className="alert warn"><ul>{upload.errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              <div className="row">
                <button className="btn primary" disabled={!upload.entries.length} onClick={() => applyUpload(false)}>명단에 추가 (같은 번호는 덮어쓰기)</button>
                <button className="btn danger" disabled={!upload.entries.length} onClick={() => applyUpload(true)}>지금 명단을 지우고 새로 바꾸기</button>
                <button className="btn" onClick={() => setUpload(null)}>취소</button>
              </div>
            </div>
          )}
        </div>

        <form className="card row" onSubmit={add} style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ width: 90 }}><span>학년</span><input type="number" min="1" max="6" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} aria-label="추가 학년" /></label>
          <label className="field" style={{ width: 80 }}><span>반</span><input type="number" min="1" value={form.classNo} onChange={(e) => setForm({ ...form, classNo: e.target.value })} aria-label="추가 반" /></label>
          <label className="field" style={{ width: 80 }}><span>번호</span><input type="number" min="1" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} aria-label="추가 번호" /></label>
          <label className="field" style={{ flex: 1, minWidth: 140 }}><span>이름</span><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="추가 이름" /></label>
          <button className="btn primary">+ 학생 추가</button>
        </form>

        <div className="card" style={{ padding: 0 }}>
          <div className="row" style={{ padding: '12px 14px', justifyContent: 'space-between' }}>
            <b>{list ? `${shown.length}명` : ''}</b>
            {classes.length > 1 && (
              <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 160, padding: '5px 8px' }} aria-label="반 고르기">
                <option value="">전체</option>
                {classes.map((c) => <option key={c} value={c}>{c.replace('-', '학년 ')}반</option>)}
              </select>
            )}
          </div>
          {!list ? (
            <Loading />
          ) : !list.length ? (
            <div className="center muted">아직 등록된 학생이 없습니다. 엑셀로 올리거나 한 명씩 추가하세요.</div>
          ) : (
            <table className="data compact-table">
              <thead><tr><th>학년</th><th>반</th><th>번호</th><th>이름</th><th /></tr></thead>
              <tbody>
                {shown.map((x) =>
                  editing?.id === x.id ? (
                    <tr key={x.id}>
                      <td><input type="number" value={editing.grade} onChange={(e) => setEditing({ ...editing, grade: e.target.value })} style={{ width: 60 }} /></td>
                      <td><input type="number" value={editing.classNo} onChange={(e) => setEditing({ ...editing, classNo: e.target.value })} style={{ width: 60 }} /></td>
                      <td><input type="number" value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} style={{ width: 60 }} /></td>
                      <td><input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="이름 수정" /></td>
                      <td className="nowrap">
                        <button className="btn sm primary" onClick={saveEdit}>저장</button>{' '}
                        <button className="btn sm" onClick={() => setEditing(null)}>취소</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={x.id}>
                      <td>{x.grade}</td><td>{x.classNo}</td><td>{x.number}</td><td>{x.name}</td>
                      <td className="nowrap" style={{ textAlign: 'right' }}>
                        <button className="btn sm" onClick={() => setEditing({ ...x })}>수정</button>{' '}
                        <button className="btn sm danger" onClick={() => remove(x)}>삭제</button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
