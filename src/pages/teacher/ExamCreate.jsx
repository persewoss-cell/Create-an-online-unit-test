import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import QuestionEditor from '../../components/QuestionEditor.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { openPdf, extractPages, renderPages, readFileAsArrayBuffer } from '../../lib/pdfText.js';
import { parseQuestions, fillDefaultPoints } from '../../lib/parseQuestions.js';
import { parseAnswerText, mergeQuestionsAndAnswers } from '../../lib/parseAnswers.js';
import { toItems, fromItems, validateItems } from '../../lib/editorModel.js';
import { createExam, updateExam } from '../../lib/db.js';
import { LENIENCY } from '../../lib/grading.js';
import MetaFields, { defaultTitle, parseClasses, subjectName } from '../../components/MetaFields.jsx';

export default function ExamCreate() {
  const { teacher } = useTeacher();
  const nav = useNavigate();
  const [meta, setMeta] = useState({
    subject: '', subjectCustom: '', grade: '', semester: '1', unit: '', title: '', classesText: '', leniency: 'normal', showAnswers: false,
  });
  const [qFile, setQFile] = useState(null);
  const [aFile, setAFile] = useState(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [pages, setPages] = useState([]);
  const [items, setItems] = useState([]);
  const [zoom, setZoom] = useState(null);
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
      const { questions, warnings: qWarn } = parseQuestions(qPages);
      let answerMap = new Map();
      if (aFile) {
        setBusy('정답지를 읽는 중…');
        const aDoc = await openPdf(await readFileAsArrayBuffer(aFile));
        const aPages = await extractPages(aDoc);
        answerMap = parseAnswerText(aPages.flatMap((p) => p.lines));
        if (!answerMap.size) qWarn.push('정답지에서 번호별 정답을 찾지 못했습니다. 아래 “정답 빠르게 입력하기”를 이용해 주세요.');
      } else {
        qWarn.push('정답 PDF를 올리지 않았습니다. 문항별 정답을 직접 입력해 주세요.');
      }
      const merged = mergeQuestionsAndAnswers(questions, answerMap);
      setBusy('학생 화면용 문제지 이미지를 만드는 중…');
      const imgs = await renderPages(qDoc, { onProgress: (i, n) => setBusy(`학생 화면용 문제지 이미지를 만드는 중… (${i}/${n})`) });
      setPages(imgs);
      setItems(toItems(fillDefaultPoints(merged.questions), merged.keys));
      setWarnings([...qWarn, ...merged.warnings]);
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
            showAnswers: meta.showAnswers,
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
      <TopBar home="/teacher/dashboard" who={`${teacher.name} 선생님`}>
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
              <h2>2. PDF 올리기</h2>
              <div className="grid2">
                <label className="field">
                  <span>문제 PDF *</span>
                  <input type="file" accept="application/pdf,.pdf" onChange={(e) => setQFile(e.target.files[0] || null)} aria-label="문제 PDF" />
                </label>
                <label className="field">
                  <span>정답 PDF</span>
                  <input type="file" accept="application/pdf,.pdf" onChange={(e) => setAFile(e.target.files[0] || null)} aria-label="정답 PDF" />
                </label>
              </div>
              <p className="muted small">
                문항 번호(1. / 1) / 1번 / 문제 1 / [1] 등)와 보기(①~⑤, (1)~(5))를 과목별 양식에 맞춰 자동으로 찾습니다.
                정답지는 “1. ③”, “1③ 2④”, 표(번호 줄 + 정답 줄), “1번 답: …” 형식을 인식하며, 서술형은 “핵심어: …” 줄이 있으면 채점 기준으로 씁니다.
                인식 결과는 다음 화면에서 확인·수정할 수 있습니다.
              </p>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary lg" disabled={!!busy}>문제·정답 인식하기 →</button>
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
            <div className="card">
              <h2>문제지 미리보기 ({pages.length}쪽)</h2>
              <div className="thumbs">
                {pages.map((src, i) => (
                  <img key={i} src={src} alt={`${i + 1}쪽`} onClick={() => setZoom(src)} />
                ))}
              </div>
              <p className="muted small">학생에게는 이 문제지가 왼쪽에, 아래 문항별 답 입력칸이 오른쪽에 보입니다. 이미지를 누르면 크게 볼 수 있어요.</p>
            </div>
            <div className="card">
              <h2>문항과 정답 확인</h2>
              <QuestionEditor items={items} onChange={setItems} pageCount={pages.length} />
            </div>
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
      {zoom && (
        <div className="modal-back" onClick={() => setZoom(null)}>
          <img src={zoom} alt="확대" />
        </div>
      )}
    </>
  );
}
