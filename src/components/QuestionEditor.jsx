import { useState } from 'react';
import { numberToCircled, extractKeywords } from '../lib/korean.js';
import { choiceLabel } from '../lib/parseQuestions.js';
import { parseAnswerText, buildKey } from '../lib/parseAnswers.js';
import { newItem, toItems, newPart, partMissing, boxAnswersOf } from '../lib/editorModel.js';

const BOX_ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째'];
import { nextRecognition, applyRecognition } from '../lib/rerecognize.js';

/**
 * 인식된 문항·정답을 교사가 확인하고 고치는 편집기
 * @param {{items:object[], onChange:(items)=>void, pageCount:number}} props
 */
export default function QuestionEditor({ items, onChange, pageCount }) {
  const [quick, setQuick] = useState('');
  const [quickMsg, setQuickMsg] = useState('');
  const [bulkN, setBulkN] = useState('');

  const update = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const add = () => {
    const last = items[items.length - 1];
    onChange([...items, newItem((last ? Number(last.no) : 0) + 1, last?.page || 1)]);
  };
  const totalPoints = Math.round(items.reduce((s, it) => s + (Number(it.points) || 0), 0) * 10) / 10;

  function distribute() {
    if (!items.length) return;
    const each = Math.floor((100 / items.length) * 10) / 10;
    const rest = Math.round((100 - each * items.length) * 10) / 10;
    onChange(items.map((it, i) => ({ ...it, points: i === items.length - 1 ? Math.round((each + rest) * 10) / 10 : each })));
  }

  function makeN() {
    const n = Number(bulkN);
    if (!(n > 0 && n <= 100)) return;
    onChange(Array.from({ length: n }, (_, i) => items[i] || newItem(i + 1, 1)));
  }

  // "1.③ 2.④ 3.광합성" 처럼 한 번에 입력한 정답 반영
  function applyQuick() {
    const map = parseAnswerText(quick.split(/\n/));
    if (!map.size) {
      setQuickMsg('번호를 찾지 못했습니다. 예) 1.③ 2.④ 3.광합성');
      return;
    }
    let applied = 0;
    const next = items.map((it) => {
      if (!map.has(Number(it.no))) return it;
      applied++;
      const { question, key } = buildKey(it, map.get(Number(it.no)));
      return { ...it, ...toItems([question], { [question.no]: key })[0], points: it.points, page: it.page, text: it.text };
    });
    onChange(next);
    setQuickMsg(`${applied}개 문항에 정답을 반영했습니다.`);
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <b>{items.length}문항</b> · 총점 <b style={{ color: totalPoints === 100 ? 'var(--ok)' : 'var(--warn)' }}>{totalPoints}점</b>
        </div>
        <div className="row">
          <button type="button" className="btn sm" onClick={distribute}>배점 100점 균등 분배</button>
          <input type="number" min="1" max="100" placeholder="문항 수" value={bulkN} onChange={(e) => setBulkN(e.target.value)} style={{ width: 90, padding: '5px 8px' }} />
          <button type="button" className="btn sm" onClick={makeN}>문항 수로 만들기</button>
        </div>
      </div>

      <details className="card" style={{ padding: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>정답 빠르게 입력하기 (정답 PDF 인식이 잘 안 될 때)</summary>
        <p className="muted small">예) <code>1.③ 2.④ 3.광합성 / 광합성 작용 4.②,④</code> — 줄바꿈이나 띄어쓰기로 구분해도 됩니다.</p>
        <textarea value={quick} onChange={(e) => setQuick(e.target.value)} rows={3} aria-label="정답 빠르게 입력" />
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn sm primary" onClick={applyQuick}>반영</button>
          {quickMsg && <span className="small muted">{quickMsg}</span>}
        </div>
      </details>

      {items.map((it, idx) => (
        <QuestionRow key={idx} it={it} pageCount={pageCount} onChange={(p) => update(idx, p)} onRemove={() => remove(idx)} />
      ))}
      <button type="button" className="btn" onClick={add}>+ 문항 추가</button>
    </div>
  );
}

const TYPE_OPTIONS = [
  ['mc', '객관식 (고르기)'],
  ['mc-ox', '객관식 O/X'],
  ['mc-custom', '객관식 (보기 직접 입력)'],
  ['short', '단답형'],
  ['essay', '서술형'],
  ['match', '선 잇기'],
  ['draw', '그리기'],
];
const isOX = (it) => it.type === 'mc' && Number(it.choiceCount) === 2 && it.choiceLabels?.[0] === 'O' && it.choiceLabels?.[1] === 'X';

/** 유형 선택 칸에 보일 값 */
function typeValue(it) {
  if (isOX(it)) return 'mc-ox';
  if (it.type === 'mc' && it.customLabels) return 'mc-custom';
  return it.type;
}

/** 유형을 바꿀 때 함께 바꿀 칸들 */
function typePatch(v, it) {
  if (v === 'mc-ox') {
    return { type: 'mc', choiceCount: 2, choiceLabels: ['O', 'X'], choices: ['', ''], keyChoices: [], multi: false, customLabels: false };
  }
  if (v === 'mc-custom') {
    const n = it.type === 'mc' && !isOX(it) ? Math.max(2, Number(it.choiceCount) || 3) : 3;
    return { type: 'mc', choiceCount: n, choiceLabels: Array(n).fill(''), choices: Array.from({ length: n }, (_, i) => it.choices?.[i] || ''), keyChoices: [], customLabels: true };
  }
  if (v === 'mc') {
    return { type: 'mc', customLabels: false, ...(isOX(it) || it.type !== 'mc' ? { choiceCount: it.type === 'mc' ? 5 : Number(it.choiceCount) || 5, choiceLabels: null, choices: [], keyChoices: [] } : {}) };
  }
  return { type: v, customLabels: false };
}

const LABEL_SETS = {
  circled: { name: '①②③', make: (n) => Array.from({ length: n }, (_, i) => numberToCircled(i + 1)) },
  paren: { name: '(1)(2)(3)', make: (n) => Array.from({ length: n }, (_, i) => `(${i + 1})`) },
  hangul: { name: '㉮㉯㉰', make: (n) => Array.from({ length: n }, (_, i) => '㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷'[i] || `${i + 1}`) },
  korean: { name: '㉠㉡㉢', make: (n) => Array.from({ length: n }, (_, i) => '㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩'[i] || `${i + 1}`) },
  side: { name: '왼쪽/오른쪽', make: (n) => (n === 2 ? ['왼쪽', '오른쪽'] : n === 3 ? ['왼쪽', '가운데', '오른쪽'] : Array.from({ length: n }, (_, i) => `${i + 1}번째`)) },
  ox: { name: 'O / X', make: () => ['O', 'X'] },
  custom: { name: '직접 입력', make: (n) => Array(n).fill('') },
};

/** 객관식 보기 편집: 보기 추가·삭제, 기호와 내용 고치기, 정답 표시 */
function ChoiceEditor({ it, onChange, idPrefix }) {
  const n = Math.max(2, Number(it.choiceCount) || 5);
  const custom = !!it.customLabels;
  const labels = Array.from({ length: n }, (_, i) => it.choiceLabels?.[i] || (custom ? '' : numberToCircled(i + 1)));
  const texts = Array.from({ length: n }, (_, i) => it.choices?.[i] || '');
  const keys = it.keyChoices || [];
  const setCount = (m) => {
    const c = Math.max(2, Math.min(10, m));
    // 기호 모양을 유지하며 늘리기
    const kind = Object.entries(LABEL_SETS).find(([, v]) => v.make(n).join() === labels.join())?.[0];
    // ①②③처럼 차례가 있는 기호는 이어서 만들고, 그 밖(왼쪽/오른쪽 등)은 기존 기호를 그대로 두고 뒤에 붙인다 (정답 위치가 바뀌지 않게)
    const ord = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];
    const nextLabels = custom
      ? Array.from({ length: c }, (_, i) => labels[i] || '')
      : kind && kind !== 'side' && kind !== 'ox'
        ? LABEL_SETS[kind].make(c)
        : Array.from({ length: c }, (_, i) => labels[i] || ord[i] || `${i + 1}`);
    onChange({
      choiceCount: c,
      choiceLabels: nextLabels,
      choices: Array.from({ length: c }, (_, i) => texts[i] || ''),
      keyChoices: keys.filter((k) => k <= c),
    });
  };
  const removeAt = (idx) => {
    if (n <= 2) return;
    const del = (arr) => arr.filter((_, i) => i !== idx);
    onChange({
      choiceCount: n - 1,
      choiceLabels: del(labels),
      choices: del(texts),
      keyChoices: keys.filter((k) => k !== idx + 1).map((k) => (k > idx + 1 ? k - 1 : k)),
    });
  };
  const toggleKey = (k) => onChange({ keyChoices: keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k].sort((a, b) => a - b) });
  return (
    <div className="choice-editor">
      <div className="row small" style={{ gap: 6 }}>
        <span className="muted">보기 기호:</span>
        {Object.entries(LABEL_SETS).map(([k, v]) => (
          <button
            type="button"
            key={k}
            className={`btn xs ${(k === 'custom' ? custom : !custom && v.make(n).join() === labels.join() && (k !== 'ox' || n === 2)) ? 'primary' : ''}`}
            onClick={() => {
              if (k === 'ox') onChange({ choiceCount: 2, choiceLabels: ['O', 'X'], choices: texts.slice(0, 2), keyChoices: keys.filter((x) => x <= 2), customLabels: false });
              else onChange({ choiceLabels: v.make(n), customLabels: k === 'custom' });
            }}
          >
            {v.name}
          </button>
        ))}
        <span className="muted" style={{ marginLeft: 8 }}>보기 수</span>
        <button type="button" className="btn xs" onClick={() => setCount(n - 1)} aria-label={`${idPrefix} 보기 줄이기`}>−</button>
        <b>{n}</b>
        <button type="button" className="btn xs" onClick={() => setCount(n + 1)} aria-label={`${idPrefix} 보기 늘리기`}>+</button>
      </div>
      {custom && <div className="small muted">보기 기호(예: 가, 나, 다 / 참, 거짓 / ㄱ, ㄴ)와 내용을 직접 적어 주세요. 학생 화면 버튼에 적은 그대로 보입니다.</div>}
      {labels.map((lab, i) => (
        <div key={i} className="choice-row">
          <button
            type="button"
            className={`key-toggle ${keys.includes(i + 1) ? 'on' : ''}`}
            onClick={() => toggleKey(i + 1)}
            title="정답으로 표시"
            aria-label={`${idPrefix} 정답 ${i + 1}`}
          >
            {keys.includes(i + 1) ? '✓ 정답' : '정답'}
          </button>
          <input
            className={`lab ${custom && !lab ? 'need' : ''}`}
            value={lab}
            placeholder={custom ? '기호' : ''}
            onChange={(e) => onChange({ choiceLabels: labels.map((l, j) => (j === i ? e.target.value : l)) })}
            aria-label={`${idPrefix} 보기 ${i + 1} 기호`}
          />
          <input
            value={texts[i]}
            placeholder="보기 내용 (선택)"
            onChange={(e) => onChange({ choices: texts.map((t, j) => (j === i ? e.target.value : t)), showChoiceText: true })}
            aria-label={`${idPrefix} 보기 ${i + 1} 내용`}
          />
          <button type="button" className="btn xs danger" onClick={() => removeAt(i)} disabled={n <= 2} aria-label={`${idPrefix} 보기 ${i + 1} 삭제`}>✕</button>
        </div>
      ))}
      <div className="row small">
        <button type="button" className="btn xs" onClick={() => setCount(n + 1)}>+ 보기 추가</button>
        <label className="row" style={{ gap: 4 }}>
          <input type="checkbox" checked={!!it.showChoiceText} onChange={(e) => onChange({ showChoiceText: e.target.checked })} />
          학생 화면 버튼에 보기 내용도 표시
        </label>
        <label className="row" style={{ gap: 4 }}>
          <input type="checkbox" checked={!!it.multi || keys.length > 1} onChange={(e) => onChange({ multi: e.target.checked })} />
          여러 개 고르는 문제
        </label>
      </div>
    </div>
  );
}

/** 답 유형별 정답 편집 (문항 전체 또는 한 부분) */
function AnswerFields({ it, onChange, idPrefix }) {
  return (
    <>
      {it.type === 'draw' && <div className="small muted">학생이 문제 그림 위에 직접 그립니다. 제출하면 선생님 확인으로 넘어옵니다.</div>}
      {it.type === 'mc' && <ChoiceEditor it={it} onChange={onChange} idPrefix={idPrefix} />}
      {it.type === 'match' && (
        <div className="stack">
          <label className="small row" style={{ gap: 6 }}>
            잇는 개수
            <input type="number" min="1" max="10" value={it.matchCount || 2} onChange={(e) => onChange({ matchCount: Number(e.target.value) })} style={{ width: 70 }} />
          </label>
          {Array.from({ length: Number(it.matchCount) || 2 }, (_, i) => (
            <div key={i} className="row">
              <b>({i + 1})</b> →
              <div className="keypick">
                {Array.from({ length: Math.max(Number(it.matchCount) || 2, (it.matchLabels || []).length) }, (_, k) => k + 1).map((v) => (
                  <button
                    type="button"
                    key={v}
                    className={it.keyPairs?.[i] === v ? 'on' : ''}
                    onClick={() => {
                      const next = [...(it.keyPairs || [])];
                      next[i] = v;
                      onChange({ keyPairs: next });
                    }}
                  >
                    {it.matchLabels?.[v - 1] || numberToCircled(v)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {it.type === 'short' && (
        <div className="stack" style={{ gap: 6 }}>
          <label className="small row" style={{ gap: 6 }}>
            답 칸 수
            <input
              type="number"
              min="1"
              max="8"
              value={Math.max(1, Number(it.blankCount) || 1)}
              onChange={(e) => {
                const n = Math.max(1, Math.min(8, Number(e.target.value) || 1));
                const cur = boxAnswersOf(it);
                const boxes = Array.from({ length: n }, (_, i) => cur[i] ?? '');
                // 칸이 하나로 돌아가면 칸별 정답을 한 줄 정답으로
                onChange(n > 1 ? { blankCount: n, boxAnswers: boxes } : { blankCount: 0, answerText: it.answerText || cur.filter(Boolean).join(', ') });
              }}
              style={{ width: 70 }}
              aria-label={`${idPrefix} 답 칸 수`}
            />
            <span className="muted">(2 이상이면 학생 화면에 입력칸이 그 수만큼, 정답도 칸마다)</span>
          </label>
          {Number(it.blankCount) > 1 ? (
            <div className="box-answers">
              <div className="small">
                칸별 정답 <span className="muted">— 학생이 쓰는 순서대로 · 한 칸에 여러 답 인정은 <code>/</code></span>
              </div>
              {boxAnswersOf(it).map((v, i) => (
                <label key={i} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                  <span className="small" style={{ width: 64, flexShrink: 0, fontWeight: 600 }}>{BOX_ORD[i]} 칸</span>
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => {
                      const next = boxAnswersOf(it);
                      next[i] = e.target.value;
                      onChange({ boxAnswers: next, answerText: '' });
                    }}
                    aria-label={`${idPrefix} ${BOX_ORD[i]} 칸 정답`}
                  />
                </label>
              ))}
              <label className="small row" style={{ gap: 4 }}>
                <input type="checkbox" checked={!!it.anyOrder} onChange={(e) => onChange({ anyOrder: e.target.checked })} aria-label={`${idPrefix} 순서 무관`} />
                순서가 달라도 정답으로 인정 <span className="muted">(끄면 칸 순서대로 맞아야 정답)</span>
              </label>
            </div>
          ) : (
            <label className="field">
              <span className="small">정답 <span className="muted" style={{ fontWeight: 400 }}>— 여러 답 인정: <code>/</code></span></span>
              <input type="text" value={it.answerText} onChange={(e) => onChange({ answerText: e.target.value })} aria-label={`${idPrefix} 정답`} />
            </label>
          )}
        </div>
      )}
      {it.type === 'essay' && (
        <div className="grid2">
          <label className="field">
            <span className="small">모범 답안</span>
            <textarea rows={2} value={it.model} onChange={(e) => onChange({ model: e.target.value })} aria-label={`${idPrefix} 모범 답안`} />
            <label className="small row" style={{ gap: 4, fontWeight: 400, marginTop: 4 }}>
              <input type="checkbox" checked={!!it.open} onChange={(e) => onChange({ open: e.target.checked })} />
              예시 답안 (여러 개는 / 로 구분, 예시와 다른 답은 선생님 확인)
            </label>
          </label>
          <label className="field">
            <span className="small">
              핵심어 <span className="muted" style={{ fontWeight: 400 }}>— 쉼표로 구분, 같은 뜻은 <code>|</code> (예: 증발|기화)</span>
            </span>
            <textarea rows={2} value={it.keywordsText} onChange={(e) => onChange({ keywordsText: e.target.value })} aria-label={`${idPrefix} 핵심어`} />
            <button type="button" className="btn sm" style={{ marginTop: 4 }} onClick={() => onChange({ keywordsText: extractKeywords(it.model).join(', ') })}>
              모범 답안에서 핵심어 다시 뽑기
            </button>
          </label>
        </div>
      )}
    </>
  );
}

export function QuestionRow({ it, pageCount, onChange, onRemove }) {
  const hasParts = it.parts?.length > 0;
  const [recog, setRecog] = useState({ step: 0, msg: '' });
  const noAnswer = !it.manual && (hasParts ? it.parts.some(partMissing) : !(it.draw && it.type === 'short') && partMissing(it));
  const setPart = (i, patch) => onChange({ parts: it.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const addPart = () => {
    if (hasParts) return onChange({ parts: [...it.parts, newPart('short')] });
    // 지금 답 형식을 (1)로, 새 칸을 (2)로
    const { no, page, points, text, regions, anchor, group, blanks, answerSpots, manual, oxBlanks, fillBoxes, parts, draw, fullText, blankInfo, commonBlank, ...first } = it;
    onChange({ parts: [{ ...first, type: it.type === 'draw' ? 'short' : it.type }, newPart('short')], draw: false });
  };
  const removePart = (i) => {
    const rest = it.parts.filter((_, j) => j !== i);
    if (rest.length === 1) onChange({ ...rest[0], parts: null }); // 하나만 남으면 보통 문항으로
    else onChange({ parts: rest });
  };

  const recognizeAgain = () => {
    const r = nextRecognition(it, recog.step);
    if (!r) return setRecog({ ...recog, msg: '다른 방법으로 읽을 수 있는 답안 유형이 없어요. 아래에서 직접 고쳐 주세요.' });
    onChange(applyRecognition(it, r.option.patch));
    setRecog({ step: r.nextStep, msg: `다시 인식 (${r.index}/${r.total}): ${r.option.label}` });
  };

  return (
    <div className={`qedit ${noAnswer ? 'warn' : ''}`} data-testid={`edit-${it.no}`}>
      <div className="recog-bar">
        <button type="button" className="btn sm primary" onClick={recognizeAgain} aria-label={`${it.no}번 답안 유형 다시 인식하기`}>
          🔄 답안 유형 다시 인식하기
        </button>
        <span className="small muted" data-testid={`recog-${it.no}`}>
          {recog.msg ? `${recog.msg} — 또 틀리면 한 번 더 누르세요` : '인식이 틀렸으면 누르세요. 누를 때마다 다른 방법으로 다시 읽어요.'}
        </span>
      </div>
      <div className="top">
        <label>번호<input type="number" value={it.no} onChange={(e) => onChange({ no: e.target.value })} /></label>
        {!hasParts && (
          <label>
            유형
            <select value={typeValue(it)} onChange={(e) => onChange(typePatch(e.target.value, it))} aria-label={`${it.no}번 유형`}>
              {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        <label>배점<input type="number" min="0" step="0.5" value={it.points} onChange={(e) => onChange({ points: e.target.value })} aria-label={`${it.no}번 배점`} /></label>
        <label>쪽<input type="number" min="1" max={pageCount || 99} value={it.page} onChange={(e) => onChange({ page: e.target.value })} /></label>
        <label>
          문제 요약 (학생 화면에 표시)
          <input type="text" value={it.text || ''} onChange={(e) => onChange({ text: e.target.value })} />
        </label>
        <button type="button" className="btn sm danger" onClick={onRemove} title="문항 삭제">삭제</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`btn sm manual-toggle ${it.manual ? 'on' : ''}`}
          onClick={() => onChange({ manual: !it.manual })}
          aria-pressed={!!it.manual}
          style={{ marginBottom: 8 }}
        >
          {it.manual ? '✔ 선생님이 직접 채점 (켜짐)' : '선생님이 직접 채점'}
        </button>
        {it.manual && (
          <div className="small muted" style={{ marginBottom: 8 }}>
            자동 채점하지 않고 학생이 제출하면 모두 검토 요청으로 넘어옵니다. 정답은 비워 둬도 됩니다(적어 두면 검토할 때 참고로 보입니다).
          </div>
        )}
        {!hasParts && (it.type === 'short' || it.type === 'essay') && (
          <label className="small row" style={{ gap: 4, marginBottom: 6 }}>
            <input type="checkbox" checked={!!it.draw} onChange={(e) => onChange({ draw: e.target.checked })} />
            그리기도 함께 하는 문항 (예: 반지름을 그어 보고 길이 쓰기)
          </label>
        )}

        {hasParts ? (
          <div className="stack">
            <div className="small muted">한 문제에 답이 여러 부분입니다. 모든 부분이 맞아야 정답입니다.</div>
            {it.parts.map((p, i) => (
              <div key={i} className="part-edit">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row">
                    <b>({i + 1})</b>
                    <select value={typeValue(p)} onChange={(e) => setPart(i, typePatch(e.target.value, p))} aria-label={`${it.no}번 (${i + 1}) 유형`} style={{ width: 200 }}>
                      {TYPE_OPTIONS.filter(([v]) => v !== 'draw').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <button type="button" className="btn xs danger" onClick={() => removePart(i)}>이 부분 삭제</button>
                </div>
                <AnswerFields it={p} onChange={(patch) => setPart(i, patch)} idPrefix={`${it.no}번 (${i + 1})`} />
              </div>
            ))}
          </div>
        ) : (
          <AnswerFields it={it} onChange={onChange} idPrefix={`${it.no}번`} />
        )}
        {it.type !== 'draw' && (
          <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={addPart}>
            + 답 유형 추가 (한 문제에 답이 여러 개일 때)
          </button>
        )}
        {noAnswer && <div className="small" style={{ color: 'var(--warn)', marginTop: 6 }}>⚠ 정답이 입력되지 않았습니다.</div>}
      </div>
    </div>
  );
}
