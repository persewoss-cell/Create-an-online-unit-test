// 규칙 기반 자동 채점
//  - 객관식: 번호 일치
//  - 단답형: 띄어쓰기·문장부호·조사/어미 차이 무시, 숫자+단위 비교, 여러 정답 허용
//  - 서술형: 핵심어 포함 비율 + 모범답안과의 유사도. 애매하면 'review'(교사 검토)
// 결과 상태: 'correct' | 'wrong' | 'review'

import {
  normalizeText, sameWord, containsWord, jamoSimilarity, diceSimilarity, parseNumeric, hasNegation,
  samePredicate, predicateStem, extractKeywords,
} from './korean.js';

export const LENIENCY = {
  strict: { label: '엄격', essayCorrect: 0.8, essayReview: 0.4, diceReview: 0.4, typoReview: 0.85, containCorrect: false },
  normal: { label: '보통', essayCorrect: 0.6, essayReview: 0.25, diceReview: 0.3, typoReview: 0.75, containCorrect: true },
  lenient: { label: '관대', essayCorrect: 0.5, essayReview: 0.2, diceReview: 0.25, typoReview: 0.65, containCorrect: true },
};

const NO_ANSWER_RE = /^(모름|모르겠|몰라|없음|\?+|x|-+|\.+)$/;

export function isBlank(answer, question) {
  if (answer == null) return true;
  if (question?.draw || question?.type === 'draw') {
    // 그리기 문항: 그림을 그렸으면 답 칸은 비워도 제출할 수 있다 (그림+답 문항은 둘 중 하나만 해도 됨)
    if (answer.strokes?.length) return false;
    return question.type === 'draw' || isBlank(answer.text, { ...question, draw: false });
  }
  if (question?.blankCount > 1) {
    return !Array.isArray(answer) || answer.length < question.blankCount || answer.some((v) => !String(v ?? '').trim());
  }
  if (question?.type === 'match') {
    return !Array.isArray(answer) || answer.length < (question.matchCount || 1) || answer.some((v) => !v);
  }
  if (Array.isArray(answer)) return answer.length === 0;
  return String(answer).trim() === '';
}

function gradeChoice(key, answer) {
  const want = [...new Set(key.choices || [])].sort();
  const got = [...new Set((Array.isArray(answer) ? answer : [answer]).map(Number))].sort();
  if (!want.length) return { status: 'review', reason: '정답이 등록되지 않음' };
  const ok = want.length === got.length && want.every((v, i) => v === got[i]);
  return { status: ok ? 'correct' : 'wrong' };
}

/** 한 개의 정답 표현(쉼표로 구분된 필수 요소 포함)과 학생 답 비교 */
function compareShort(expected, answer, rule) {
  const parts = expected.split(/\s*[,，、]\s*/).filter(Boolean);
  if (parts.length > 1) {
    const hits = parts.filter((p) => containsWord(answer, p) || compareShort(p, answer, rule).status === 'correct');
    if (hits.length === parts.length) return { status: 'correct' };
    if (hits.length > 0) return { status: 'review', reason: `필수 요소 ${parts.length}개 중 ${hits.length}개 일치` };
    return { status: 'wrong' };
  }
  const ne = normalizeText(expected);
  const na = normalizeText(answer);
  if (!ne) return { status: 'wrong' };
  if (sameWord(expected, answer) || samePredicate(expected, answer)) return { status: 'correct' };

  const kNum = parseNumeric(expected);
  if (kNum) {
    const aNum = parseNumeric(answer);
    if (!aNum) return { status: 'wrong' };
    if (Math.abs(kNum.value - aNum.value) > 1e-9) return { status: 'wrong' };
    if (!aNum.unit || !kNum.unit || aNum.unit === kNum.unit) return { status: 'correct' };
    return { status: 'review', reason: `단위가 다름 (${kNum.unit} / ${aNum.unit})` };
  }

  // 한쪽이 다른 쪽을 포함 (예: 정답 "광합성", 학생 "광합성 작용")
  if (na.includes(ne) || ne.includes(na)) {
    const ratio = Math.min(na.length, ne.length) / Math.max(na.length, ne.length);
    if (ratio >= 0.6 && rule.containCorrect) return { status: 'correct' };
    if (ratio >= 0.34 && Math.min(na.length, ne.length) >= 2) {
      return { status: 'review', reason: '정답과 일부만 일치' };
    }
  }
  const sim = jamoSimilarity(expected, answer);
  if (ne.length >= 2 && sim >= rule.typoReview) {
    return { status: 'review', reason: `철자가 비슷함 (유사도 ${Math.round(sim * 100)}%)` };
  }
  return { status: 'wrong' };
}

/** 칸이 여러 개인 문항: 칸마다 순서대로 비교 */
function gradeBoxes(key, answers, rule) {
  const accepted = (key.accepted || []).filter((a) => String(a).trim());
  if (!accepted.length) return { status: 'review', reason: '정답이 등록되지 않음' };
  let best = { status: 'wrong' };
  let compared = false;
  for (const alt of accepted) {
    const parts = alt.split(/\s*[,，、]\s*/).filter(Boolean);
    if (parts.length !== answers.length) continue;
    compared = true;
    const rs = parts.map((p, i) => compareShort(p, String(answers[i] ?? ''), rule));
    if (rs.every((r) => r.status === 'correct')) return { status: 'correct' };
    if (rs.every((r) => r.status !== 'wrong')) best = { status: 'review', reason: '칸 일부 확인 필요' };
  }
  // 정답의 칸 수가 학생 칸 수와 다르게 등록된 경우에만 이어 붙여서 비교
  if (!compared) return gradeShortText(key, answers.join(', '), rule);
  return best;
}

function gradeShort(key, answer, rule) {
  if (Array.isArray(answer)) return gradeBoxes(key, answer, rule);
  return gradeShortText(key, answer, rule);
}

function gradeShortText(key, answer, rule) {
  const accepted = (key.accepted || []).filter((a) => String(a).trim());
  if (!accepted.length) return { status: 'review', reason: '정답이 등록되지 않음' };
  let best = { status: 'wrong' };
  for (const exp of accepted) {
    const r = compareShort(exp, answer, rule);
    if (r.status === 'correct') return r;
    if (r.status === 'review') best = r;
  }
  return best;
}

function matchKeyword(answer, keyword) {
  const words = String(answer).split(/[\s,.!?·]+/).filter(Boolean);
  return String(keyword)
    .split('|')
    .map((k) => k.trim())
    .filter(Boolean)
    .some((k) => {
      if (containsWord(answer, k)) return true;
      // 활용형이 달라도 어간이 같으면 인정 ("낮아지" ↔ "낮아져서")
      const ks = predicateStem(k);
      return ks.length >= 2 && words.some((w) => predicateStem(w).startsWith(ks));
    });
}

function gradeMatch(key, answer) {
  const want = key.pairs || [];
  if (!want.length) return { status: 'review', reason: '정답이 등록되지 않음' };
  const got = Array.isArray(answer) ? answer.map(Number) : [];
  const ok = want.every((v, i) => got[i] === v);
  return { status: ok ? 'correct' : 'wrong' };
}

/** 예시 답안이 여러 개인 서술형: 하나라도 충분히 비슷하면 정답, 열린 문항이면 나머지는 선생님 확인 */
function gradeExamples(key, answer, rule) {
  let best = { status: 'wrong' };
  for (const ex of key.examples) {
    const r = gradeEssay({ model: ex, keywords: extractKeywords(ex) }, answer, rule);
    if (r.status === 'correct') return { ...r, reason: `예시 답안과 일치 (${ex})` };
    if (r.status === 'review' && best.status !== 'review') best = r;
  }
  if (key.open && normalizeText(answer).length >= 2) {
    return { status: 'review', reason: best.status === 'review' ? best.reason : '예시 답안과 다른 답 — 선생님 확인' };
  }
  return best;
}

function gradeEssay(key, answer, rule) {
  const keywords = (key.keywords || []).filter((k) => String(k).trim());
  const model = key.model || '';
  if (!keywords.length && !model.trim()) return { status: 'review', reason: '모범 답안이 등록되지 않음' };
  if (normalizeText(answer).length < 2) return { status: 'wrong' };

  const hits = keywords.filter((k) => matchKeyword(answer, k));
  const coverage = keywords.length ? hits.length / keywords.length : 0;
  const dice = model.trim() ? diceSimilarity(model, answer) : 0;
  const detail = keywords.length
    ? `핵심어 ${hits.length}/${keywords.length}개 포함${hits.length ? ` (${hits.join(', ')})` : ''}`
    : `모범 답안 유사도 ${Math.round(dice * 100)}%`;

  // 모범답안 문장과 거의 같으면 정답
  if (dice >= 0.85) return { status: 'correct', reason: detail };
  const strongCoverage = keywords.length ? coverage >= rule.essayCorrect : dice >= 0.6;
  if (strongCoverage) {
    // 핵심어는 들어 있지만 부정 표현이 모범답안과 다르면 교사 확인
    if (hasNegation(answer) !== hasNegation(model)) {
      return { status: 'review', reason: `${detail} · 부정 표현이 모범 답안과 다름` };
    }
    return { status: 'correct', reason: detail };
  }
  if ((keywords.length && coverage >= rule.essayReview) || dice >= rule.diceReview) {
    return { status: 'review', reason: detail };
  }
  return { status: 'wrong', reason: detail };
}

/**
 * @param {{type:'mc'|'short'|'essay'}} question
 * @param {object} key 정답 키
 * @param {any} answer 학생 답 (객관식: number[] / 그 외: string)
 * @param {'strict'|'normal'|'lenient'} leniency
 */
export function gradeAnswer(question, key, answer, leniency = 'normal') {
  const rule = LENIENCY[leniency] || LENIENCY.normal;
  if (isBlank(answer, question)) return { status: 'wrong', reason: '답 없음' };
  if (question.manual) return { status: 'review', reason: '선생님이 직접 채점하는 문항' };
  if (question.type === 'draw') return { status: 'review', reason: '그린 그림 — 선생님 확인' };
  if (question.draw) {
    // 그림 + 답: 답은 자동으로 확인하되, 그림 때문에 최종 판정은 선생님이
    if (isBlank(answer.text, { ...question, draw: false })) return { status: 'review', reason: '그린 그림 확인 필요 (답 칸 비움)' };
    const r = gradeAnswer({ ...question, draw: false }, key, answer.text, leniency);
    return { status: 'review', reason: `그린 그림 확인 필요 · 적은 답 ${r.status === 'correct' ? '맞음' : r.status === 'wrong' ? '틀림' : '확인 필요'}` };
  }
  if (question.type === 'mc') return gradeChoice(key || {}, answer);
  if (question.type === 'match') return gradeMatch(key || {}, answer);
  if (Array.isArray(answer)) return gradeShort(key || {}, answer, rule); // □ 칸이 여러 개
  const text = String(answer).trim();
  if (NO_ANSWER_RE.test(normalizeText(text))) return { status: 'wrong', reason: '답 없음' };
  if (question.type === 'essay') {
    if (key?.examples?.length) return gradeExamples(key, text, rule);
    return gradeEssay(key || {}, text, rule);
  }
  return gradeShort(key || {}, text, rule);
}

/**
 * 제출물 전체 채점. 교사 판정(overrides)이 있으면 자동 채점보다 우선한다.
 * @param {{questions:object[], leniency?:string}} exam
 * @param {Record<string,object>} keys  문항 번호 → 정답 키
 * @param {{answers:Record<string,any>, overrides?:Record<string,'correct'|'wrong'>}} submission
 */
export function gradeSubmission(exam, keys, submission) {
  const overrides = submission.overrides || {};
  const items = exam.questions.map((q) => {
    const auto = gradeAnswer(q, keys[q.no], submission.answers?.[q.no], exam.leniency);
    const ov = overrides[q.no];
    const status = ov || auto.status;
    const points = Number(q.points) || 0;
    return {
      no: q.no,
      type: q.type,
      points,
      auto,
      overridden: !!ov,
      status,
      earned: status === 'correct' ? points : 0,
    };
  });
  const total = items.reduce((s, it) => s + it.points, 0);
  const earned = items.reduce((s, it) => s + it.earned, 0);
  return {
    items,
    total: round1(total),
    earned: round1(earned),
    score100: total ? round1((earned / total) * 100) : 0,
    correctCount: items.filter((it) => it.status === 'correct').length,
    reviewCount: items.filter((it) => it.status === 'review').length,
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
