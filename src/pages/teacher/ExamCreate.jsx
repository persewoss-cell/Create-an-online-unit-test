import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import ExamPreviewEditor from '../../components/ExamPreviewEditor.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { openPdf, extractPages, renderPages, readFileAsArrayBuffer } from '../../lib/pdfText.js';
import { parseQuestions, fillDefaultPoints } from '../../lib/parseQuestions.js';
import { toItems, fromItems, validateItems } from '../../lib/editorModel.js';
import { createExam, updateExam } from '../../lib/db.js';
import { LENIENCY } from '../../lib/grading.js';
import MetaFields, { defaultTitle, parseClasses, subjectName } from '../../components/MetaFields.jsx';

export default function ExamCreate() {
  const { teacher } = useTeacher();
  const nav = useNavigate();
  const [meta, setMeta] = useState({
    subject: '', subjectCustom: '', grade: '', semester: '1', unit: '', title: '', classesText: '', leniency: 'normal',
  });
  const [qFile, setQFile] = useState(null);
  const [groups, setGroups] = useState([]);
  const [aspects, setAspects] = useState([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [pages, setPages] = useState([]);
  const [items, setItems] = useState([]);
  const [saveErrors, setSaveErrors] = useState([]);

  async function recognize(e) {
    e.preventDefault();
    setError('');
    if (!meta.subject || !meta.grade || !meta.semester) return setError('과목, 학년, 학기를 입력해 주세요.');
    if (!qFile) return setError('문제 PDF 파일을 선택해 주세요.');
    try {
      setBusy('문제지를 읽는 중…');
      const qDoc = await openPdf(await readFileAsArrayBuffer(qFile));
      const qPages = await extractPages(qDoc);
      const { questions, groups: grps, warnings: qWarn } = parseQuestions(qPages);
      setBusy('문항 이미지를 만드는 중…');
      const imgs = await renderPages(qDoc, { onProgress: (i, n) => setBusy(`문항 이미지를 만드는 중… (${i}/${n})`) });
      setPages(imgs.map((x) => x.src));
      setAspects(imgs.map((x) => x.aspect));
      setGroups(grps);
      setItems(toItems(fillDefaultPoints(questions), {}));
      setWarnings(qWarn);
      setStep(2);
    } catch (err) {
      console.error(err);
      setError(`PDF를 읽지 못했습니다: ${err.message}`);
    } finally {
      setBusy('');
    }
  }

  async function save(open) {
    const errs = validateItems(items, pages.length);
    setSaveErrors(errs);
    if (errs.length) return window.scrollTo({ top: 0, behavior: 'smooth' });
    const { questions, keys } = fromItems(items);
    try {
      setBusy('저장 중…');
      const id = await createExam(
        {
          meta: {
            subject: subjectName(meta),
            grade: Number(meta.grade),
            semester: Number(meta.semester),
            unit: meta.unit.trim(),
            title: meta.title.trim() || defaultTitle(meta),
            classes: parseClasses(meta.classesText),
            leniency: meta.leniency,
            groups,
            pageAspects: aspects,
          },
          questions,
          keys,
          pages,
          ownerUid: teacher.uid,
          ownerName: teacher.name,
        },
        (i, n) => setBusy(`문제지 이미지 저장 중… (${i}/${n})`),
      );
      if (open) await updateExam(id, { status: 'open' });
      nav(`/teacher/exam/${id}`);
    } catch (err) {
      setError(`저장하지 못했습니다: ${err.message}`);
      setBusy('');
    }
  }

  return (
    <>
      <TopBar home="/teacher/dashboard" who="관리자">
        <Link to="/teacher/dashboard" className="btn sm">목록</Link>
      </TopBar>
      <div className="container">
        <h1>새 단원평가 만들기</h1>
        {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}
        {busy && <div className="alert info" style={{ marginBottom: 12 }}><span className="spinner" /> {busy}</div>}

        {step === 1 && (
          <form className="stack" onSubmit={recognize}>
            <div className="card stack">
              <h2>1. 평가 정보</h2>
              <MetaFields meta={meta} setMeta={setMeta} />
            </div>
            <div className="card stack">
              <h2>2. 문제지 PDF 올리기</h2>
              <label className="field">
                <span>문제 PDF *</span>
                <input type="file" accept="application/pdf,.pdf" onChange={(e) => setQFile(e.target.files[0] || null)} aria-label="문제 PDF" />
              </label>
              <p className="muted small">
                문항 번호와 지문(“※ 다음 글을 읽고 물음에 답하시오. (1~4)”)을 자동으로 찾아 문항별로 잘라 줍니다.
                정답은 다음 화면에서 엑셀 양식으로 넣습니다.
              </p>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary lg" disabled={!!busy}>문제 인식하기 →</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="stack">
            {saveErrors.length > 0 && (
              <div className="alert error">
                저장하기 전에 확인해 주세요.
                <ul>{saveErrors.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="alert warn">
                인식 결과를 확인해 주세요.
                <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            <ExamPreviewEditor
              view={{ groups, pageAspects: aspects }}
              pages={pages}
              items={items}
              onChange={setItems}
              title={meta.title.trim() || defaultTitle(meta) || '단원평가'}
            />
            <div className="card row" style={{ justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setStep(1)} disabled={!!busy}>← 다시 올리기</button>
              <div className="row">
                <span className="muted small">채점 기준: {LENIENCY[meta.leniency].label}</span>
                <button className="btn" onClick={() => save(false)} disabled={!!busy}>저장 (준비 중)</button>
                <button className="btn primary" onClick={() => save(true)} disabled={!!busy}>저장하고 응시 열기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
