// 문제지 첫 쪽 머리글(첫 문항 위쪽)과 파일 이름에서 평가 정보를 찾는다.
// 예) "5학년 2학기 과학 2. 생물과 환경 단원평가", "국어  2. 유창하게 읽고 발표해요 (1회)  3-2"
import { SUBJECTS } from './subjects.js';

const SUBJECT_RE = new RegExp(`(${SUBJECTS.filter((s) => s !== '기타').join('|')})`);

/** 첫 쪽에서 첫 문항(또는 지문 안내) 위에 있는 줄들 */
function headerLines(pages, questions) {
  const first = pages[0]?.lines || [];
  const tops = (questions || []).filter((q) => q.anchor?.page === 1).map((q) => q.anchor.top);
  const limit = tops.length ? Math.min(...tops) : null;
  const out = [];
  for (const l of first) {
    if (limit != null && l.top >= limit - 0.002) break;
    if (/^\s*※/.test(l.text)) break;
    out.push(l.text);
    if (out.length >= 8) break;
  }
  if (limit == null) return out.slice(0, 3);
  return out;
}

function cleanUnit(s) {
  return s
    .replace(/\s*(단원\s*평가|평가|단원|형성\s*평가|수행\s*평가)\s*$/, '')
    .replace(/\s*[(（]\s*\d+\s*회\s*[)）]\s*$/, '')
    .replace(/[\s·,.-]+$/, '')
    .trim();
}

function findUnit(line) {
  // 과목·학년·학기 표시, 회차, 쪽수 등을 지운 뒤 "2. 원" 또는 "5단원"을 찾는다
  const s = line
    .replace(/<[^>]*>/g, ' ')
    .replace(/[1-6]\s*학년|[12]\s*학기/g, ' ')
    .replace(/(^|\s)[1-6]\s*-\s*[12](?=\s|$)/g, ' ')
    .replace(SUBJECT_RE, ' ')
    .replace(/[(（]\s*[^()（）]*회\s*[)）]/g, ' ')
    .replace(/(기본|심화|실력)?\s*[①-⑩\d]\s*회/g, ' ')
    .replace(/[(（]\s*[)）]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let m = s.match(/(?:^|\s)(\d{1,2})\s*\.\s*([^\d\s].*)$/);
  if (m) {
    const name = cleanUnit(m[2]);
    if (name && name.length <= 30) return `${m[1]}. ${name}`;
  }
  m = s.match(/(?:^|\s)(\d{1,2})\s*단원/);
  if (m) return `${m[1]}단원`;
  return '';
}

/**
 * @param {{lines:{text:string,top:number}[]}[]} pages  extractPages 결과
 * @param {object[]} questions parseQuestions 결과 (첫 문항 위치로 머리글 범위를 정함)
 * @param {string} [fileName]
 * @returns {{subject?:string, grade?:string, semester?:string, unit?:string}}
 */
export function detectMeta(pages, questions, fileName = '') {
  const lines = headerLines(pages, questions).filter((t) => !/이름|쪽|\(\s*\)\s*반/.test(t));
  const text = lines.join(' ');
  const name = fileName.replace(/\.pdf$/i, '');
  const meta = {};

  const subj = text.match(SUBJECT_RE) || name.match(SUBJECT_RE);
  if (subj) meta.subject = subj[1];

  const g = text.match(/([1-6])\s*학년/) || name.match(/([1-6])\s*학년/);
  const s = text.match(/([12])\s*학기/) || name.match(/([12])\s*학기/);
  const gs = text.match(/(?:^|\s)([1-6])\s*-\s*([12])(?=\s|$)/) || name.match(/(?:^|[\s_])([1-6])\s*-\s*([12])(?=[\s_]|$)/);
  if (g) meta.grade = g[1];
  else if (gs) meta.grade = gs[1];
  if (s) meta.semester = s[1];
  else if (gs) meta.semester = gs[2];

  for (const l of lines) {
    const u = findUnit(l);
    if (u) {
      meta.unit = u;
      break;
    }
  }
  return meta;
}
