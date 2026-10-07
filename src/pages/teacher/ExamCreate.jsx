import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import TeacherBar, { ListButton } from '../../components/TeacherBar.jsx';
import FileDrop from '../../components/FileDrop.jsx';
import ExamPreviewEditor from '../../components/ExamPreviewEditor.jsx';
import StudentPreview from '../../components/StudentPreview.jsx';
import { useTeacher } from '../../components/TeacherAuth.jsx';
import { openPdf, extractPages, renderPages, readFileAsArrayBuffer } from '../../lib/pdfText.js';
import { parseQuestions, fillDefaultPoints } from '../../lib/parseQuestions.js';
import { toItems, fromItems, validateItems } from '../../lib/editorModel.js';
import { trimRegions, markAnswerSpots } from '../../lib/trimRegions.js';
import { createExam, watchMyExams } from '../../lib/db.js';
import { findSameExam, sameExamMessage } from '../../lib/examDup.js';
import SaveErrorDialog, { ErrorLine } from '../../components/SaveErrorDialog.jsx';
import { LENIENCY } from '../../lib/grading.js';
import { detectMeta } from '../../lib/detectMeta.js';
import MetaFields, { defaultTitle, subjectName } from '../../components/MetaFields.jsx';
import { classTarget } from '../../lib/school.js';

export default function ExamCreate() {
  const { owner } = useTeacher();
  const target = classTarget(owner); // 평가는 늘 이 선생님 학년·반에만 나간다
  const nav = useNavigate();
  const [meta, setMeta] = useState({
    subject: '', subjectCustom: '', grade: target ? String(target.grade) : '', semester: '1', unit: '', title: '', leniency: 'normal',
  });
  const [qFile, setQFile] = useState(null);
  const [groups, setGroups] = useState([]);
  const [masks, setMasks] = useState([]);
  const [previewing, setPreviewing] = useState(false); // 저장 전 학생 화면 미리보기 // 선생님이 문제지에서 가린 부분(흰 칸)
  const [aspects, setAspects] = useState([]);
  const [widthsCm, setWidthsCm] = useState([]);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // 단계는 주소(?step=2)에 둔다 → 2단계에서 뒤로가기를 누르면 1단계로 (올린 문제지·인식 결과는 그대로)
  const [ready2, setReady2] = useState(false);
  const pushedStep = useRef(false); // 2단계를 기록에 하나 쌓았는지
  const step = params.get('step') === '2' && ready2 ? 2 : 1;
  const setStep = (n) => {
    if (n === 2) {
      setReady2(true);
      if (params.get('step') !== '2') {
        pushedStep.current = true;
        setParams({ step: '2' }, { state: location.state });
      }
    } else if (params.get('step') === '2') {
      if (pushedStep.current && (window.history.state?.idx ?? 0) > 0) {
        pushedStep.current = false;
        nav(-1);
      }
      else setParams({}, { replace: true, state: location.state });
    }
  };
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [pages, setPages] = useState([]);
  const [items, setItems] = useState([]);
  const [saveErrors, setSaveErrors] = useState([]);
  // 이미 만든 평가 (같은 학년·학기·과목·단원으로 또 만들지 않도록)
  const [myExams, setMyExams] = useState([]);
  useEffect(() => (owner?.uid ? watchMyExams(owner.uid, setMyExams, () => {}) : undefined), [owner?.uid]);
  /** 겹치는 평가가 있으면 경고하고 true */
  function warnSame() {
    const same = findSameExam(myExams, { ...meta, subject: subjectName(meta), unit: meta.unit.trim() });
    if (!same) return false;
    const text = sameExamMessage(same);
    setError(text.replace(/\n+/g, ' '));
    alert(text);
    return true;
  }
  const [errorPopup, setErrorPopup] = useState(null); // 지금 화면에 띄울 저장 오류
  const [analyzed, setAnalyzed] = useState(null); // PDF 분석 결과 (문항 수, 채운 항목)
  const [analyzing, setAnalyzing] = useState('');
  const run = useRef(0);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const autoVals = useRef({ semester: '1', grade: target ? String(target.grade) : '' }); // 자동으로 채운 값 (선생님이 고치지 않았으면 다시 올릴 때 바꿔도 됨)

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
        if (k === 'grade' && target) continue; // 학년은 선생님 학년으로 고정
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
      setMasks([]);
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
    if (warnSame()) return;
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  const FOUND_LABEL = { subject: '과목', grade: '학년', semester: '학기', unit: '단원' };

  async function save() {
    const errs = validateItems(items, pages.length);
    setSaveErrors(errs);
    if (errs.length) return setErrorPopup(errs);
    if (warnSame()) return setStep(1);
    const { questions, keys } = fromItems(items);
    try {
      setBusy('저장 중…');
      const id = await createExam(
        {
          meta: {
            subject: subjectName(meta),
            grade: target ? target.grade : Number(meta.grade),
            semester: Number(meta.semester),
            unit: meta.unit.trim(),
            title: meta.title.trim() || defaultTitle(meta),
            classes: target ? target.classes : [],
            leniency: meta.leniency,
            groups,
            masks,
            pageAspects: aspects,
            pageWidthsCm: widthsCm,
          },
          questions,
          keys,
          pages,
          owner,
        },
        (i, n) => setBusy(`문제지 이미지 저장 중… (${i}/${n})`),
      );
      // 저장하면 만들기 화면(1·2단계)은 기록에서 빼고 평가 화면으로 → 거기서 뒤로가기하면 목록
      const finish = () => nav(`/teacher/exam/${id}`, { replace: true, state: location.state });
      if (pushedStep.current) {
        pushedStep.current = false;
        window.addEventListener('popstate', () => setTimeout(finish, 0), { once: true });
        nav(-1);
      } else finish();
    } catch (err) {
      setError(`저장하지 못했습니다: ${err.message}`);
      setErrorPopup([`저장 중 오류가 났어요: ${err.message}`, '인터넷 연결을 확인한 뒤 다시 저장해 주세요.']);
      setBusy('');
    }
  }

  return (
    <>
      <TeacherBar>
        <ListButton />
      </TeacherBar>
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
              <MetaFields meta={meta} setMeta={setMeta} lockedGrade={!!target} />
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
                <ul>{saveErrors.map((w, i) => <li key={i}><ErrorLine text={w} /></li>)}</ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="alert warn">
                인식 결과를 확인해 주세요.
                <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            <ExamPreviewEditor
              view={{ groups, pageAspects: aspects, pageWidthsCm: widthsCm, masks }}
              onViewChange={(v) => {
                if (v.groups) setGroups(v.groups);
                if (v.masks) setMasks(v.masks);
              }}
              pages={pages}
              items={items}
              onChange={setItems}
              title={meta.title.trim() || defaultTitle(meta) || '단원평가'}
            />
            {saveErrors.length > 0 && (
              <div className="alert error">
                저장하기 전에 확인해 주세요. (번호를 누르면 그 문항으로 이동)
                <ul>{saveErrors.map((w, i) => <li key={i}><ErrorLine text={w} /></li>)}</ul>
              </div>
            )}
            <div className="card row" style={{ justifyContent: 'space-between' }}>
              <button className="btn" onClick={() => setStep(1)} disabled={!!busy}>← 다시 올리기</button>
              <div className="row">
                <span className="muted small">채점 기준: {LENIENCY[meta.leniency].label} · 저장한 뒤 <b>시험 개시</b>를 눌러야 학생에게 보여요</span>
                <button className="btn" onClick={() => setPreviewing(true)} disabled={!items.length || !pages.length} title="학생 시험 화면 그대로 처음부터 넘겨 보기 (답은 저장되지 않아요)">
                  👀 전체 미리보기
                </button>
                <button className="btn primary" onClick={() => save()} disabled={!!busy}>저장</button>
                {previewing && (
                  <StudentPreview
                    exam={{ groups, masks, pageAspects: aspects, pageWidthsCm: widthsCm, title: meta.title.trim() || defaultTitle(meta) || '단원평가', questions: fromItems(items).questions }}
                    pages={pages}
                    startNo={items[0]?.no}
                    onClose={() => setPreviewing(false)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <SaveErrorDialog errors={errorPopup} onClose={() => setErrorPopup(null)} />
    </>
  );
}
