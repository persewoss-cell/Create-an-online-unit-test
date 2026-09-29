import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar.jsx';
import FileDrop from '../../components/FileDrop.jsx';
import ExamPreviewEditor from '../../components/ExamPreviewEditor.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { openPdf, extractPages, renderPages, readFileAsArrayBuffer } from '../../lib/pdfText.js';
import { parseQuestions, fillDefaultPoints } from '../../lib/parseQuestions.js';
import { toItems, fromItems, validateItems } from '../../lib/editorModel.js';
import { trimRegions, markAnswerSpots } from '../../lib/trimRegions.js';
import { createExam, updateExam } from '../../lib/db.js';
import { LENIENCY } from '../../lib/grading.js';
import { detectMeta } from '../../lib/detectMeta.js';
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
  const [widthsCm, setWidthsCm] = useState([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [pages, setPages] = useState([]);
  const [items, setItems] = useState([]);
  const [saveErrors, setSaveErrors] = useState([]);
  const [analyzed, setAnalyzed] = useState(null); // PDF 분석 결과 (문항 수, 채운 항목)
  const [analyzing, setAnalyzing] = useState('');
  const run = useRef(0);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const autoVals = useRef({ semester: '1' }); // 자동으로 채운 값 (선생님이 고치지 않았으면 다시 올릴 때 바꿔도 됨)

  /** PDF를 고르면 바로 분석: 문항 인식 + 문항 이미지 + 평가 정보 자동 채우기 */
  async function analyze(file) {
    const my = ++run.current;
    setQFile(file);
    setAnalyzed(null);
    setError('');
    try {
      setAnalyzing('문제지를 읽는 중…');
      const qDoc = await openPdf(await readFileAsArrayBuffer(file));
      const qPages = await extractPages(qDoc);
      const { questions, groups: grps, warnings: qWarn } = parseQuestions(qPages);
      const found = detectMeta(qPages, questions, file.name);
      if (my !== run.current) return;
      // 비어 있거나 전에 자동으로 채운 값 그대로인 칸만 채운다 (선생님이 고친 칸은 그대로)
      const cur = metaRef.current;
      const nextMeta = { ...cur };
      for (const [k, v] of Object.entries(found)) {
        if (v && (cur[k] === '' || cur[k] === autoVals.current[k])) {
          nextMeta[k] = v;
          autoVals.current[k] = v;
        }
      }
      setMeta(nextMeta);
      setAnalyzing('문항 이미지를 만드는 중…');
      const imgs = await renderPages(qDoc, { onProgress: (i, n) => my === run.current && setAnalyzing(`문항 이미지를 만드는 중… (${i}/${n})`) });
      await trimRegions(imgs.map((x) => x.src), questions, grps);
      await markAnswerSpots(imgs.map((x) => x.src), questions);
      if (my !== run.current) return;
      setPages(imgs.map((x) => x.src));
      setAspects(imgs.map((x) => x.aspect));
      setWidthsCm(imgs.map((x) => Math.round(x.widthCm * 100) / 100));
      setGroups(grps);
      setItems(toItems(fillDefaultPoints(questions), {}));
      setWarnings(qWarn);
      setAnalyzed({ count: questions.length, pageCount: imgs.length, found });
    } catch (err) {
      console.error(err);
      if (my === run.current) setError(`PDF를 읽지 못했습니다: ${err.message}`);
    } finally {
      if (my === run.current) setAnalyzing('');
    }
  }

  function next(e) {
    e.preventDefault();
    setError('');
    if (!qFile) return setError('문제지 PDF를 먼저 올려 주세요.');
    if (!analyzed) return setError(analyzing ? '문제지를 분석하는 중입니다. 잠시만 기다려 주세요.' : '문제지를 다시 올려 주세요.');
    if (!meta.subject || !meta.grade || !meta.semester) return setError('과목, 학년, 학기를 입력해 주세요.');
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  const FOUND_LABEL = { subject: '과목', grade: '학년', semester: '학기', unit: '단원' };

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
            pageWidthsCm: widthsCm,
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
          <form className="stack" onSubmit={next}>
            <div className="card stack">
              <h2>1. 문제지 PDF 올리기</h2>
              <FileDrop accept=".pdf,application/pdf" onFile={analyze} file={qFile} label="문제 PDF" hint="문제지 PDF를 여기로 끌어다 놓거나 눌러서 고르세요" />
              {analyzing && <div className="alert info"><span className="spinner" /> {analyzing}</div>}
              {analyzed && (
                <div className="alert success" data-testid="analyzed">
                  ✔ {analyzed.pageCount}쪽에서 문항 {analyzed.count}개를 찾았어요.
                  {Object.keys(analyzed.found).length > 0
                    ? ` 문제지에서 찾은 ${Object.keys(analyzed.found).map((k) => FOUND_LABEL[k]).join('·')} 정보를 아래에 채웠어요. 맞는지 확인해 주세요.`
                    : ' 평가 정보는 문제지에서 찾지 못했어요. 아래에 입력해 주세요.'}
                </div>
              )}
              {!qFile && (
                <p className="muted small">
                  올리면 바로 분석해서 문항 번호와 지문(“※ 다음 글을 읽고 물음에 답하시오. (1~4)”)을 찾아 문항별로 잘라 주고,
                  머리글에서 과목·학년·학기·단원을 찾아 평가 정보를 채워 줍니다. 정답은 다음 화면에서 엑셀 양식으로 넣습니다.
                </p>
              )}
            </div>
            <div className="card stack">
              <h2>2. 평가 정보</h2>
              <MetaFields meta={meta} setMeta={setMeta} />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary lg" disabled={!!busy || !!analyzing}>다음: 문항·정답 확인 →</button>
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
