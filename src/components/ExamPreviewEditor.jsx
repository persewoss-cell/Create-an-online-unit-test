// 교사용 "문항과 정답 확인": 왼쪽에 잘라낸 문항, 오른쪽에 학생이 보는 답 입력칸 + 정답 표시
import { useState } from 'react';
import { QuestionView, AnswerInput } from './ExamViews.jsx';
import FileDrop from './FileDrop.jsx';
import { QuestionRow } from './QuestionEditor.jsx';
import { fromItems, toItems, answerCount, withPoints } from '../lib/editorModel.js';
import { buildKey, hasAnswer } from '../lib/parseAnswers.js';
import { downloadAnswerTemplate, readAnswerSheet, answerHint, withSheetPoints } from '../lib/answerSheet.js';
import { TYPE_LABEL } from '../lib/format.js';
import AiPromptDialog from './AiPromptDialog.jsx';
import RegionEditor from './RegionEditor.jsx';
import StudentPreview from './StudentPreview.jsx';
import QuickAdjust from './QuickAdjust.jsx';
import { FULL_PAGE } from './ExamViews.jsx';
import { renumber, blankItem, insertAfter, move, duplicate, mergeWithNext, split } from '../lib/questionOps.js';

const partOk = (it) => Array.isArray(it.partPoints) && it.partPoints.length >= 2 && it.partPoints.length === answerCount(it);

function keyOf(it) {
  const { keys } = fromItems([it]);
  return keys[Number(it.no)];
}

/**
 * @param {{view:{groups?:object[], pageAspects?:number[], masks?:object[]}, pages:string[], items:object[], onChange:(items)=>void, title:string,
 *   onViewChange?:(patch:{groups?:object[], masks?:object[]})=>void, structureLocked?:boolean}} props
 *   onViewChange: 지문 묶음(groups)·가리기(masks)를 바꿀 때 / structureLocked: 응시한 학생이 있어 문항 추가·순서 바꾸기를 막음
 */
export default function ExamPreviewEditor({ view, pages, items, onChange, title, onViewChange, structureLocked = false }) {
  const [open, setOpen] = useState({});
  const [editing, setEditing] = useState(null);
  const [previewNo, setPreviewNo] = useState(null);
  const [quick, setQuick] = useState(null); // 마우스 간편조정 중인 문항 {idx, regions} // 학생 화면 미리보기를 시작할 문항 번호 // {kind:'q', idx, drawFirst} | {kind:'g', id, idx, drawFirst}
  const groups = view.groups || [];
  const canEditView = !!onViewChange;

  /** 문항을 추가·이동·삭제한 뒤: 번호를 1부터 다시 매기고 지문 묶음 범위도 맞춘다 */
  function restructure(next) {
    const r = renumber(next, groups);
    setOpen({});
    setQuick(null);
    onChange(r.items);
    if (canEditView) onViewChange({ groups: r.groups });
    return r.items;
  }
  function addAfter(idx) {
    const base = items[idx] || items[items.length - 1];
    const next = restructure(insertAfter(items, idx, blankItem(base)));
    // 새 문항은 바로 캡쳐 상세 조정 창을 열어 문제 부분을 끌어 그리게 한다
    setEditing({ kind: 'q', idx: idx + 1, drawFirst: true, page: next[idx + 1]?.page });
  }
  function removeAt(idx) {
    if (!confirm(`${items[idx].no}번 문항을 삭제할까요? 아래 문항 번호가 하나씩 당겨져요.`)) return;
    restructure(items.filter((_, i) => i !== idx));
  }
  function mergeAt(idx) {
    if (!confirm(`${items[idx].no}번과 ${items[idx + 1].no}번을 한 문항으로 합칠까요?\n캡쳐는 이어 붙이고, 정답 형식은 ${items[idx].no}번 것을 쓰고, 배점은 더해요.`)) return;
    restructure(mergeWithNext(items, idx));
  }
  function splitAt(idx) {
    if (!confirm(`${items[idx].no}번을 두 문항으로 나눌까요?\n캡쳐를 반으로 나누고, 아래 문항은 정답 없는 단답형으로 새로 만들어요. 나눈 뒤 캡쳐와 정답을 확인하세요.`)) return;
    restructure(split(items, idx));
  }
  /** 지문 연결 바꾸기 / 새 지문 만들기 */
  function setGroup(idx, value) {
    if (value === '__new') {
      const id = `g${Date.now()}`;
      const it = items[idx];
      const nextGroups = [...groups, { id, from: it.no, to: it.no, regions: [] }];
      onViewChange({ groups: nextGroups });
      update(idx, { group: id });
      setEditing({ kind: 'g', id, idx, drawFirst: true, page: it.page });
      return;
    }
    const nextItems = items.map((x, i) => (i === idx ? { ...x, group: value || null } : x));
    onChange(nextItems);
    onViewChange({ groups: renumber(nextItems, groups).groups });
  }
  function applyEdit({ regions, masks }) {
    const e = editing;
    if (e.kind === 'q') update(e.idx, { regions, ...(regions[0] ? { page: regions[0].page } : {}) });
    const patch = {};
    if (e.kind === 'g') patch.groups = groups.map((g) => (g.id === e.id ? { ...g, regions } : g));
    if (canEditView) patch.masks = masks;
    if (canEditView) onViewChange(patch);
    setEditing(null);
  }
  const groupLabel = (g) => (g.from ? `지문 ${g.from === g.to ? `${g.from}번` : `${g.from}~${g.to}번`}` : '지문 (연결된 문항 없음)');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const update = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const totalPoints = Math.round(items.reduce((s, it) => s + (Number(it.points) || 0), 0) * 10) / 10;
  const missing = items.filter((it) => !it.manual && !hasAnswer(keyOf(it))).map((it) => it.no);

  function distribute() {
    if (!items.length) return;
    const each = Math.floor((100 / items.length) * 10) / 10;
    const rest = Math.round((100 - each * items.length) * 10) / 10;
    onChange(items.map((it, i) => withPoints(it, i === items.length - 1 ? Math.round((each + rest) * 10) / 10 : each)));
  }

  async function uploadSheet(file) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const { answers, points, partPoints } = await readAnswerSheet(await file.arrayBuffer());
      if (!answers.size) throw new Error('엑셀에서 정답을 찾지 못했습니다. 양식의 “번호”, “정답” 칸을 확인해 주세요.');
      let applied = 0;
      const boxChanged = []; // 엑셀 쉼표 수에 맞춰 답 칸 수가 바뀐 문항
      const ppMismatch = []; // 부분 점수 개수가 답 개수와 달라 총점만 넣은 문항
      const next = items.map((it) => {
        const no = Number(it.no);
        if (!answers.has(no)) return it;
        applied++;
        const { question, key } = buildKey(it, answers.get(no));
        const fresh = toItems([question], { [question.no]: key })[0];
        const before = it.type === 'short' ? Math.max(1, Number(it.blankCount) || 1) : 0;
        const after = question.type === 'short' ? Math.max(1, Number(question.blankCount) || 1) : 0;
        if (before && after && before !== after) boxChanged.push(`${no}번 ${before}→${after}칸`);
        // 부분 점수: 엑셀 배점 칸에 "2 ; 2"처럼 답마다 적은 경우에만 (답 개수와 맞아야 함)
        const pp = partPoints.get(no);
        const n = answerCount(fresh);
        if (pp && pp.length !== n) ppMismatch.push(`${no}번(배점 ${pp.length}개 / 답 ${n}개)`);
        return { ...fresh, points: points.get(no) ?? it.points, partPoints: pp && pp.length === n ? pp : null };
      });
      const unknown = [...answers.keys()].filter((n) => !items.some((it) => Number(it.no) === n));
      onChange(withSheetPoints(next, points));
      const withPP = next.filter(partOk).length;
      setMsg({
        type: unknown.length || ppMismatch.length ? 'warn' : 'success',
        text: `${applied}개 문항에 정답을 넣었습니다.${boxChanged.length ? ` 엑셀 정답에 맞춰 답 칸 수를 바꿨습니다: ${boxChanged.join(', ')}.` : ''}${unknown.length ? ` 문제지에 없는 번호: ${unknown.join(', ')}번` : ''}${withPP ? ` 부분 점수 ${withPP}문항.` : ''}${ppMismatch.length ? ` 부분 점수 개수가 답 개수와 달라 총점만 넣었어요: ${ppMismatch.join(', ')} — 세부 수정에서 확인하세요.` : ''}`,
      });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card stack" style={{ background: 'var(--primary-weak)', borderColor: '#bfd3fb' }}>
        <h2 style={{ margin: 0 }}>정답 넣기</h2>
        <div className="row" style={{ columnGap: 24 }}>
          <span className="row">
            <span><b>①</b> 양식 받기 →</span>
            <button type="button" className="btn" onClick={() => downloadAnswerTemplate(items, title)}>
              정답 엑셀 양식 다운로드 ({items.length}문항)
            </button>
          </span>
          <span className="row">
            <span><b>②</b> AI로 엑셀 양식에 넣을 정답 정리 (선택) →</span>
            <button type="button" className="btn" onClick={() => setAiOpen(true)} title="정답지를 AI 채팅에 맡겨 엑셀 정답 칸에 붙여 넣을 정답을 위아래로 나열하게 하는 명령어">
              🤖 AI 명령어 복사하기
            </button>
          </span>
        </div>
        <div className="row">
          <span><b>③</b> 엑셀 양식 채워서 올리기 →</span>
          <div style={{ flex: 1, minWidth: 260 }}>
            <FileDrop compact accept=".xlsx" onFile={uploadSheet} label={busy ? '읽는 중…' : '정답 엑셀'} hint="작성한 정답 엑셀을 끌어다 놓거나 눌러서 고르세요" />
          </div>
        </div>
        <div className="small muted">
          답이 여러 개일 때는 답 칸마다 쉼표(<code>3, 6, 9</code>), 여러 답 중 하나만 맞아도 정답이면 빗금(<code>답1 / 답2</code>), 한 문항에 답 종류가 여러 개면 세미콜론(<code>문장 ; 20 cm</code>)으로 구분해요.
        </div>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
        {aiOpen && <AiPromptDialog questions={fromItems(items).questions} title={title} onClose={() => setAiOpen(false)} />}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <b>{items.length}문항</b> · 총점 <b style={{ color: totalPoints === 100 ? 'var(--ok)' : 'var(--warn)' }}>{totalPoints}점</b>
          {missing.length > 0 && <span style={{ color: 'var(--warn)', marginLeft: 10 }}>정답 없음: {missing.join(', ')}번</span>}
        </div>
        <span className="row" style={{ gap: 6 }}>
          <button type="button" className="btn sm" onClick={distribute}>배점 100점 균등 분배</button>
          <button type="button" className="btn sm" onClick={() => setPreviewNo(items[0]?.no)} disabled={!items.length || !pages.length} title="학생이 보는 시험 화면 그대로 처음부터 넘겨 보기 (답은 저장되지 않아요)">
            👀 전체 미리보기
          </button>
        </span>
      </div>

      {items.map((it, idx) => {
        const key = keyOf(it);
        const q = fromItems([it]).questions[0];
        return (
          <div key={idx} className={`pcard ${hasAnswer(key) ? '' : 'warn'}`} data-testid={`preview-${it.no}`}>
            <div className="pcard-bar">
              <b>{it.no}번</b>
              {!structureLocked && (
                <>
                <button type="button" className="btn xs" onClick={() => restructure(move(items, idx, -1))} disabled={idx === 0} title="위로 (번호도 바뀜)" aria-label={`${it.no}번 위로`}>▲</button>
                <button type="button" className="btn xs" onClick={() => restructure(move(items, idx, 1))} disabled={idx === items.length - 1} title="아래로 (번호도 바뀜)" aria-label={`${it.no}번 아래로`}>▼</button>
                <span className="sep" />
                <button type="button" className="btn xs" onClick={() => addAfter(idx)} title="이 문항 바로 아래에 새 문항 추가">＋ 아래에 문항 추가</button>
                <button type="button" className="btn xs" onClick={() => restructure(duplicate(items, idx))} title="이 문항을 복사해 바로 아래에">⧉ 복제</button>
                <button type="button" className="btn xs" onClick={() => mergeAt(idx)} disabled={idx === items.length - 1} title="바로 아래 문항과 한 문항으로">⇣ 아래 문항과 합치기</button>
                <button type="button" className="btn xs" onClick={() => splitAt(idx)} title="두 문항으로 나누기">✂ 둘로 나누기</button>
                <span className="sep" />
                <button type="button" className="btn xs danger" onClick={() => removeAt(idx)}>🗑 삭제</button>
                </>
              )}
              <button type="button" className="btn xs bar-end" onClick={() => setPreviewNo(it.no)} disabled={!pages.length} title="이 문항을 학생 시험 화면 그대로 보기">
                👀 미리보기
              </button>
            </div>
            <div className="left">
              <div className="pcard-tools">
                <button type="button" className="btn xs primary" onClick={() => setEditing({ kind: 'q', idx, page: it.regions?.[0]?.page || it.page })} disabled={!pages.length}>
                  ✂️ 캡쳐 상세 조정{it.regions?.length > 1 ? ` (${it.regions.length}개)` : ''}
                </button>
                {canEditView && (
                  <>
                    <select value={it.group || ''} onChange={(e) => setGroup(idx, e.target.value)} aria-label={`${it.no}번 지문`}>
                      <option value="">지문 없음</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
                      <option value="__new">＋ 새 지문 만들기</option>
                    </select>
                    {it.group && groups.some((g) => g.id === it.group) && (
                      <button type="button" className="btn xs" onClick={() => setEditing({ kind: 'g', id: it.group, idx, page: groups.find((g) => g.id === it.group)?.regions?.[0]?.page || it.page })}>
                        📄 지문 캡쳐 조정
                      </button>
                    )}
                  </>
                )}
                <span className="tools-end">
                  {quick?.idx === idx ? (
                    <>
                      <button type="button" className="btn xs" onClick={() => setQuick(null)}>취소</button>
                      <button
                        type="button"
                        className="btn xs primary"
                        onClick={() => {
                          update(idx, { regions: quick.regions, page: quick.regions[0]?.page || it.page });
                          setQuick(null);
                        }}
                      >
                        저장
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn xs"
                      disabled={!pages.length}
                      title="문제 그림 위에서 마우스 휠로 확대·축소, 끌어서 옮기기"
                      onClick={() => setQuick({ idx, regions: it.regions?.length ? it.regions.map((r) => ({ ...r })) : [FULL_PAGE(it.page || 1)] })}
                    >
                      🖱 마우스 간편조정
                    </button>
                  )}
                </span>
              </div>
              {quick?.idx === idx && <div className="quick-hint">🖱 휠: 확대·축소 · ✋ 그림 끌기: 옮기기 · ↔ 파란 테두리 끌기: 안으로 끌면 그만큼 잘리고, 밖으로 끌면 더 보여요. 다 되면 저장.</div>}
              {quick?.idx === idx ? (
                <QuickAdjust
                  exam={view}
                  pages={pages}
                  group={it.group ? groups.find((g) => g.id === it.group) : null}
                  regions={quick.regions}
                  onChange={(regions) => setQuick({ idx, regions })}
                />
              ) : (
                <QuestionView exam={view} q={q} pages={pages} />
              )}
            </div>
            <div className="right">
              <div className="head">
                <span className="qno">{it.no}번</span>
                <span className="badge draft">{TYPE_LABEL[it.type]}</span>
                {it.manual && <span className="badge review">선생님 채점</span>}
                {it.draw && it.type !== 'draw' && <span className="badge draft">+ 그리기</span>}
                <label className="small row" style={{ gap: 4, marginLeft: 'auto' }}>
                  배점
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={it.points}
                    onChange={(e) => update(idx, withPoints(it, e.target.value))}
                    style={{ width: 70, padding: '4px 6px' }}
                    aria-label={`${it.no}번 배점`}
                  />
                </label>
                {partOk(it) && (
                  <span className="badge draft" title="맞힌 답만큼 점수 (세부 수정에서 바꿀 수 있어요)">부분 점수 {it.partPoints.join(' + ')}</span>
                )}
              </div>
              <div className="small muted">학생 화면 미리보기 (초록색이 정답)</div>
              <div className="small" style={{ color: 'var(--primary)' }}>답 쓰는 법: {answerHint(fromItems([it]).questions[0])}</div>
              {it.manual && (
                <div className="key-box" style={{ background: 'var(--warn-weak)', color: '#6b4a0f' }}>
                  선생님이 직접 채점하는 문항입니다. 학생 답은 모두 검토 요청으로 넘어옵니다.
                </div>
              )}
              <AnswerInput q={q} value={q.type === 'mc' || q.type === 'match' ? [] : ''} answerKey={it.manual ? null : key} disabled />
              {!hasAnswer(key) && <div className="small" style={{ color: 'var(--warn)' }}>⚠ 정답이 없습니다. 엑셀로 올리거나 세부 수정에서 입력하세요.</div>}
              <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen({ ...open, [idx]: !open[idx] })}>
                {open[idx] ? '세부 수정 닫기 ▴' : '세부 수정 ▾'}
              </button>
              {open[idx] && (
                <QuestionRow it={it} pageCount={pages.length} onChange={(p) => update(idx, p)} onRemove={structureLocked ? undefined : () => removeAt(idx)} />
              )}
            </div>
          </div>
        );
      })}
      {structureLocked ? (
        <div className="small muted">이미 응시한 학생이 있어 문항 추가·삭제·순서 바꾸기는 할 수 없어요 (학생 답이 문항 번호로 저장되어 있어서). 캡쳐 조정과 정답 수정은 할 수 있어요.</div>
      ) : (
        <div className="add-between">
          <button type="button" className="btn" onClick={() => addAfter(items.length - 1)}>＋ 맨 끝에 문항 추가</button>
        </div>
      )}
      {previewNo != null && (
        <StudentPreview
          exam={{ ...view, title, questions: fromItems(items).questions }}
          pages={pages}
          startNo={previewNo}
          onClose={() => setPreviewNo(null)}
        />
      )}
      {editing && (() => {
        const e = editing;
        const it = items[e.idx];
        if (!it) return null;
        const g = e.kind === 'g' ? groups.find((x) => x.id === e.id) : null;
        const ghosts = items.flatMap((x, i) => (i === e.idx ? [] : (x.regions || []).map((region) => ({ label: `${x.no}번`, region }))));
        return (
          <RegionEditor
            key={`${e.kind}${e.idx}${e.id || ''}`}
            title={e.kind === 'g' ? `📄 ${groupLabel(g || {})} — 지문 캡쳐 조정` : `✂️ ${it.no}번 — 캡쳐 상세 조정`}
            note={e.kind === 'g'
              ? '이 지문을 쓰는 문항 모두에 함께 적용돼요. 지문은 문제 위에 따로 보여요.'
              : '파란 네모가 학생에게 보이는 부분이에요. 한 문제가 두 곳에 나뉘어 있으면 ＋ 캡쳐 추가로 하나 더 그리세요 (위에서부터 순서대로 이어 붙여 보여요).'}
            view={view}
            pages={pages}
            regions={e.kind === 'g' ? g?.regions || [] : it.regions || []}
            masks={view.masks || []}
            startPage={e.page}
            drawFirst={e.drawFirst}
            ghosts={ghosts}
            onApply={applyEdit}
            onClose={() => setEditing(null)}
          />
        );
      })()}
    </div>
  );
}

